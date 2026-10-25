import React, { useEffect, useRef, useState } from 'react';
import * as DerivTradeTypeIcons from '@deriv/quill-icons/TradeTypes';
import { api_base } from '@/external/bot-skeleton';
import AnalysisTool from '../analysis-tool';
import { useStore } from '@/hooks/useStore';
import './main.scss';


// Resolve the official Deriv TradeTypes exports by their exported names, so this stays
// compatible with the icon package's generated component naming.
type DerivTradeIconType = 'even' | 'odd' | 'over' | 'under' | 'matches' | 'differs';
const DERIV_TRADE_ICON_TERMS: Record<DerivTradeIconType, string[]> = {
    even: ['even'], odd: ['odd'], over: ['over'], under: ['under'], matches: ['match'], differs: ['differ'],
};
const DerivTradeTypeIcon = ({ type }: { type: DerivTradeIconType }) => {
    const entries = Object.entries(DerivTradeTypeIcons);
    const match = entries.find(([name]) => {
        const normalized = name.toLowerCase();
        return normalized.endsWith('icon') && DERIV_TRADE_ICON_TERMS[type].some(term => normalized.includes(term));
    });
    const Icon = match?.[1] as React.ElementType | undefined;
    return Icon ? <Icon aria-hidden='true' className={'deriv-contract-symbol deriv-contract-symbol--' + type} /> : null;
};

const VOLATILITY_SYMBOLS: Record<string, string> = {
    'Volatility 10': 'R_10',
    'Volatility 10 (1s)': '1HZ10V',
    'Volatility 15 (1s)': '1HZ15V',
    'Volatility 25': 'R_25',
    'Volatility 25 (1s)': '1HZ25V',
    'Volatility 30 (1s)': '1HZ30V',
    'Volatility 50': 'R_50',
    'Volatility 50 (1s)': '1HZ50V',
    'Volatility 75': 'R_75',
    'Volatility 75 (1s)': '1HZ75V',
    'Volatility 90 (1s)': '1HZ90V',
    'Volatility 100': 'R_100',
    'Volatility 100 (1s)': '1HZ100V',
};

const CONTRACT_TYPES: Record<string, string> = {
    Even: 'DIGITEVEN',
    Odd: 'DIGITODD',
    Over: 'DIGITOVER',
    Under: 'DIGITUNDER',
    Matches: 'DIGITMATCH',
    Differs: 'DIGITDIFF',
};

type ManualTradeRecord = {
    contractId: string; buyTransactionId: string; sellTransactionId: string;
    contractType: string; symbol: string; stake: number; buyPrice: number;
    profit: number | null; exitSpot: string; status: string; currency: string; purchasedAt: string;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForTradingApi = async () => {
    const started = Date.now();
    while (Date.now() - started < 10000) {
        const api = api_base.api;
        if (api?.connection?.readyState === WebSocket.OPEN && api_base.is_authorized) return api;
        await sleep(200);
    }
    throw new Error('Deriv trading connection is not ready. Please log in and select a trading account.');
};

const buyContract = async (api: any, contractType: string, amount: number, symbol: string, duration: number, prediction: number) => {
    const currency = api_base.account_info?.currency || 'USD';
    const request: Record<string, unknown> = {
        proposal: 1,
        amount,
        basis: 'stake',
        contract_type: contractType,
        currency,
        duration,
        duration_unit: 't',
        underlying_symbol: symbol,
    };
    if (['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(contractType)) request.barrier = prediction;

    const proposalResponse = await api.send(request);
    if (proposalResponse?.error) throw new Error(proposalResponse.error.message || 'Unable to create trade proposal.');
    const proposal = proposalResponse?.proposal;
    if (!proposal?.id || proposal.ask_price === undefined) throw new Error('Deriv returned an invalid trade proposal.');

    const buyResponse = await api.send({ buy: proposal.id, price: proposal.ask_price });
    if (buyResponse?.error) throw new Error(buyResponse.error.message || 'Unable to purchase the contract.');
    const buy = buyResponse?.buy;
    if (!buy?.contract_id) throw new Error('Deriv did not confirm the purchased contract.');
    return buy;
};

const ManualTraderStructure = () => {
    const { transactions, run_panel } = useStore();
    useEffect(() => () => document.body.classList.remove('manual-trade-in-progress'), []);
    const [tradeType, setTradeType] = useState('Even/Odd');
    const [symbol, setSymbol] = useState('1HZ100V');
    const [analysisTicks, setAnalysisTicks] = useState(3000);
    const [duration, setDuration] = useState(5);
    const [stake, setStake] = useState(10);
    const [bulkTrades, setBulkTrades] = useState(1);
    const [prediction, setPrediction] = useState(1);
    const [isTrading, setIsTrading] = useState(false);
    const [tradeRecords, setTradeRecords] = useState<ManualTradeRecord[]>([]);
    const tradeLockRef = useRef(false);
    const manualRunIdRef = useRef<string>('');
    const messageSubscriptionRef = useRef<any>(null);
    const resultDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordsByContractRef = useRef<Record<string, ManualTradeRecord>>({});

    const updateTradeRecord = (contractId: string, patch: Partial<ManualTradeRecord>) => {
        const current = recordsByContractRef.current[contractId];
        if (!current) return;
        const updated = { ...current, ...patch };
        recordsByContractRef.current[contractId] = updated;
        setTradeRecords(previous => [updated, ...previous.filter(record => record.contractId !== contractId)].slice(0, 50));
    };

    const applyOpenContract = (contract: any) => {
        if (!contract?.contract_id) return;
        const contractId = String(contract.contract_id);
        const exitValue = contract.exit_tick_display_value ?? contract.exit_tick ?? contract.exit_spot;
        const sellTransactionId = contract.sell_transaction_id ?? contract.transaction_ids?.sell;
        const profitValue = contract.profit;
        const normalizedStatus = String(contract.status || '').toLowerCase();
        const isClosed = contract.is_sold === 1 || contract.is_sold === true ||
            contract.is_expired === 1 || contract.is_expired === true ||
            ['won', 'lost', 'sold', 'expired'].includes(normalizedStatus);
        const currentRecord = recordsByContractRef.current[contractId];
        const updatedRecord = {
            ...(currentRecord || {}),
            ...(exitValue !== undefined && exitValue !== null ? { exitSpot: String(exitValue) } : {}),
            ...(profitValue !== undefined && profitValue !== null ? { profit: Number(profitValue) } : {}),
            ...(sellTransactionId ? { sellTransactionId: String(sellTransactionId) } : {}),
            ...(contract.status ? { status: String(contract.status) } : {}),
            ...(isClosed ? { status: String(contract.status || 'Closed') } : {}),
        } as ManualTradeRecord;
        updateTradeRecord(contractId, updatedRecord);
        // Update the compact Execution Run panel (not the Transactions drawer).
        // DBot's existing stage renderer displays "Contract bought" and then Won/Lost.
        if (isClosed) {
            document.body.classList.remove('manual-trade-in-progress');
            if (resultDisplayTimerRef.current) clearTimeout(resultDisplayTimerRef.current);
            // Deriv may report a settled contract as sold rather than won/lost.
            const settledProfit = profitValue !== undefined && profitValue !== null ? Number(profitValue) : Number(currentRecord?.profit ?? 0);
            const outcome: 'won' | 'lost' = normalizedStatus === 'won' || normalizedStatus === 'lost'
                ? normalizedStatus
                : settledProfit > 0 ? 'won' : 'lost';
            run_panel.setManualContractResult(outcome);
            resultDisplayTimerRef.current = setTimeout(() => {
                run_panel.setManualContractResult('');
                resultDisplayTimerRef.current = null;
            }, 2000);
            run_panel.setContractStage(6);
            run_panel.setHasOpenContract(false);
        } else {
            document.body.classList.add('manual-trade-in-progress');
            run_panel.setManualContractResult('bought');
            run_panel.setContractStage(4);
            run_panel.setHasOpenContract(true);
        }
        // Feed the same contract into DBot's native store for statistics/history.
        transactions.pushTransaction({
            ...contract,
            contract_id: Number(contractId),
            transaction_ids: {
                ...(contract.transaction_ids || {}),
                buy: Number(currentRecord?.buyTransactionId) || contract.transaction_ids?.buy || Number(contract.transaction_id) || undefined,
                sell: sellTransactionId ? Number(sellTransactionId) || sellTransactionId : contract.transaction_ids?.sell,
            },
            contract_type: contract.contract_type || CONTRACT_TYPES[currentRecord?.contractType || ''] || '',
            underlying_symbol: contract.underlying_symbol || currentRecord?.symbol,
            currency: contract.currency || currentRecord?.currency || api_base.account_info?.currency || 'USD',
            buy_price: Number(contract.buy_price ?? currentRecord?.buyPrice ?? currentRecord?.stake ?? 0),
            profit: profitValue !== undefined && profitValue !== null ? Number(profitValue) : 0,
            status: contract.status || (isClosed ? (Number(profitValue) > 0 ? 'won' : 'lost') : 'open'),
            is_sold: isClosed ? 1 : 0,
            entry_spot: contract.entry_tick_display_value ?? contract.entry_tick ?? contract.entry_spot,
            exit_spot: exitValue !== undefined && exitValue !== null ? exitValue : contract.exit_spot,
            is_completed: isClosed,
            date_start: contract.date_start || Math.floor(Date.now() / 1000),
        });
    };

    const ensureTradeMessageListener = (api: any) => {
        if (messageSubscriptionRef.current || typeof api.onMessage !== 'function') return;
        const stream = api.onMessage();
        if (stream && typeof stream.subscribe === 'function') {
            messageSubscriptionRef.current = stream.subscribe((message: any) => {
                const envelope = message?.data ?? message;
                const data = envelope?.data ?? envelope;
                const contract = data?.proposal_open_contract ?? envelope?.proposal_open_contract ?? data;
                if (data?.msg_type === 'proposal_open_contract' || envelope?.msg_type === 'proposal_open_contract' || data?.proposal_open_contract || envelope?.proposal_open_contract) {
                    applyOpenContract(contract);
                }
            });
        }
    };

    useEffect(() => () => {
        messageSubscriptionRef.current?.unsubscribe?.();
        messageSubscriptionRef.current = null;
        if (resultDisplayTimerRef.current) clearTimeout(resultDisplayTimerRef.current);
        document.body.classList.remove('manual-trade-in-progress');
    }, []);

    const selectedVolatility = Object.keys(VOLATILITY_SYMBOLS).find(name => VOLATILITY_SYMBOLS[name] === symbol) || 'Volatility 100 (1s)';

    const handleTrade = async (selection: 'Even' | 'Odd' | 'Over' | 'Under' | 'Matches' | 'Differs') => {
        if (tradeLockRef.current) return;
        const count = Math.max(1, Math.floor(Number(bulkTrades) || 1));
        const amount = Number(stake);
        const ticks = Math.max(1, Math.floor(Number(duration) || 1));

        if (!Number.isFinite(amount) || amount <= 0) { window.alert('Enter a valid stake greater than 0.'); return; }
        if (['Over', 'Under', 'Matches', 'Differs'].includes(selection) && (!Number.isInteger(Number(prediction)) || Number(prediction) < 0 || Number(prediction) > 9)) { window.alert('Prediction must be a digit from 0 to 9.'); return; }

        tradeLockRef.current = true;
        setIsTrading(true);
        try {
            const api = await waitForTradingApi();
            ensureTradeMessageListener(api);
            const currency = api_base.account_info?.currency || 'USD';
            // Keep the compact bottom Execution panel active without opening the Transactions drawer.
            if (!run_panel.is_running) {
                if (!manualRunIdRef.current) manualRunIdRef.current = `manual-${Date.now()}`;
                run_panel.run_id = manualRunIdRef.current;
            }
            document.body.classList.add('manual-trade-in-progress');
            run_panel.setManualContractResult('bought');
            run_panel.setContractStage(3);
            // Execute sequentially so bulk purchases do not race each other.
            for (let index = 0; index < count; index += 1) {
                const buy = await buyContract(api, CONTRACT_TYPES[selection], amount, symbol, ticks, Number(prediction));
                const contractId = String(buy.contract_id);
                const record: ManualTradeRecord = {
                    contractId,
                    buyTransactionId: String(buy.transaction_id ?? buy.transaction_ids?.buy ?? '—'),
                    sellTransactionId: '—', contractType: selection, symbol, stake: amount,
                    buyPrice: Number(buy.buy_price ?? amount), profit: null, exitSpot: 'Pending',
                    status: 'Open', currency, purchasedAt: new Date().toLocaleTimeString(),
                };
                recordsByContractRef.current[contractId] = record;
                setTradeRecords(previous => [record, ...previous.filter(item => item.contractId !== contractId)].slice(0, 50));
                transactions.pushTransaction({
                    contract_id: Number(contractId),
                    transaction_ids: { buy: Number(record.buyTransactionId) || buy.transaction_id || undefined },
                    contract_type: CONTRACT_TYPES[selection] || selection,
                    underlying_symbol: symbol,
                    currency,
                    buy_price: record.buyPrice,
                    payout: Number(buy.payout ?? 0),
                    profit: 0,
                    is_completed: false,
                    is_sold: 0,
                    status: 'open',
                    date_start: Math.floor(Date.now() / 1000),
                });
                try {
                    const openResponse = await api.send({ proposal_open_contract: 1, contract_id: Number(contractId), subscribe: 1 });
                    if (openResponse?.error) updateTradeRecord(contractId, { status: 'Tracking unavailable' });
                    else if (openResponse?.proposal_open_contract) applyOpenContract(openResponse.proposal_open_contract);
                } catch (trackingError) {
                    console.warn('[Manual Trader] Unable to subscribe to contract updates:', trackingError);
                    updateTradeRecord(contractId, { status: 'Tracking unavailable' });
                }
            }
            console.info(`[Manual Trader] ${count} ${selection} transaction(s) purchased.`);
        } catch (error) {
            console.error('[Manual Trader] transaction error:', error);
            window.alert(error instanceof Error ? error.message : 'Trade failed.');
        } finally {
            tradeLockRef.current = false;
            setIsTrading(false);
        }
    };

    return <div className='manual-trader'>
        <div className='manual-trader__top-row'>
            <div className='manual-trader__volatility'><span>Volatility</span><select value={selectedVolatility} onChange={event => setSymbol(VOLATILITY_SYMBOLS[event.target.value])}>{Object.keys(VOLATILITY_SYMBOLS).map(name => <option key={name}>{name}</option>)}</select></div>
            <div className='manual-trader__analysis-ticks'><span>Ticks</span><select value={analysisTicks} onChange={event => setAnalysisTicks(Number(event.target.value))}>{[3000, 1000, 500, 300, 100, 60].map(value => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className='manual-trader__trade-type'><span>TRADE TYPE</span><select value={tradeType} onChange={event => setTradeType(event.target.value)}><option>Even/Odd</option><option>Over/Under</option><option>Matches/Differs</option></select></div>
        </div>
        <AnalysisTool showLegend={false} showStreak showSubtabs={false} showControls={false} showPrice showContractProbabilities contractMode={tradeType as 'Even/Odd' | 'Over/Under' | 'Matches/Differs'} predictionDigit={prediction} selectedBarrierDigit={tradeType === 'Even/Odd' ? undefined : prediction} onDigitSelect={digit => { if (tradeType !== 'Even/Odd') setPrediction(digit); }} selectedIndex={selectedVolatility} windowSize={analysisTicks} />
        {tradeType !== 'Even/Odd' && <div className='manual-trader__selected-barrier' aria-live='polite'>Barrier: <strong>{prediction}</strong></div>}
        <div className='manual-trader__trade-inputs'>
            <label>Ticks<input type='number' min='1' step='1' value={duration} onChange={event => setDuration(Number(event.target.value))} /></label>
            <label>Stake<input type='number' min='0' step='0.01' value={stake} onChange={event => setStake(Number(event.target.value))} /></label>
            <label>Bulk trades<input type='number' min='1' step='1' value={bulkTrades} onChange={event => setBulkTrades(Number(event.target.value))} /></label>
            {tradeType !== 'Even/Odd' && <label>Barrier<input type='number' min='0' max='9' step='1' value={prediction} onChange={event => setPrediction(Number(event.target.value))} /></label>}
        </div>
        <div className='manual-trader__trade-buttons'>
            {tradeType === 'Even/Odd' ? <><button type='button' className='manual-trader__even' disabled={isTrading} onClick={() => handleTrade('Even')}><DerivTradeTypeIcon type='even' />Even</button><button type='button' className='manual-trader__odd' disabled={isTrading} onClick={() => handleTrade('Odd')}><DerivTradeTypeIcon type='odd' />Odd</button></>  : tradeType === 'Over/Under' ? <><button type='button' className='manual-trader__over' disabled={isTrading} onClick={() => handleTrade('Over')}><DerivTradeTypeIcon type='over' />Over</button><button type='button' className='manual-trader__under' disabled={isTrading} onClick={() => handleTrade('Under')}><DerivTradeTypeIcon type='under' />Under</button></> : <><button type='button' className='manual-trader__over' disabled={isTrading} onClick={() => handleTrade('Matches')}><DerivTradeTypeIcon type='matches' />Matches</button><button type='button' className='manual-trader__under' disabled={isTrading} onClick={() => handleTrade('Differs')}><DerivTradeTypeIcon type='differs' />Differs</button></>}
        </div>
        <section className='manual-trader__transactions' aria-live='polite'>
            <div className='manual-trader__transactions-heading'>
                <div><h3>Manual Trade Transactions</h3></div>
                <span>{tradeRecords.length} trades</span>
            </div>
            <div className='manual-trader__summary'>
                <div><span>Realised P/L</span><strong className={tradeRecords.filter(trade => ['won', 'lost', 'sold', 'expired'].includes(trade.status.toLowerCase())).reduce((sum, trade) => sum + (trade.profit ?? 0), 0) >= 0 ? 'is-positive' : 'is-negative'}>{tradeRecords.some(trade => trade.profit !== null && ['won', 'lost', 'sold', 'expired'].includes(trade.status.toLowerCase())) ? `${tradeRecords.filter(trade => ['won', 'lost', 'sold', 'expired'].includes(trade.status.toLowerCase())).reduce((sum, trade) => sum + (trade.profit ?? 0), 0).toFixed(2)} ${tradeRecords[0]?.currency || ''}` : '—'}</strong></div>
                <div><span>Open trades</span><strong>{tradeRecords.filter(trade => ['open', 'pending'].includes(trade.status.toLowerCase())).length}</strong></div>
            </div>
            {tradeRecords.length === 0 ? <div className='manual-trader__transactions-empty'>Your executed manual trades will appear here.</div> : <div className='manual-trader__transactions-scroll'><table className='manual-trader__transactions-table'>
                <thead><tr><th>Time</th><th>Contract</th><th>Contract ID</th><th>Buy transaction</th><th>Exit spot</th><th>P/L</th><th>Status</th></tr></thead>
                <tbody>{tradeRecords.map(trade => <tr key={trade.contractId}>
                    <td>{trade.purchasedAt}</td><td>{trade.contractType}<small>{trade.symbol}</small></td>
                    <td>{trade.contractId}</td><td>{trade.buyTransactionId}</td><td>{trade.exitSpot}</td>
                    <td className={trade.profit === null ? '' : trade.profit >= 0 ? 'is-positive' : 'is-negative'}>{trade.profit === null ? '—' : `${trade.profit.toFixed(2)} ${trade.currency}`}</td>
                    <td><span className={`manual-trader__trade-status manual-trader__trade-status--${trade.status.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{trade.status}</span>{trade.sellTransactionId !== '—' && <small>Sell TX: {trade.sellTransactionId}</small>}</td>
                </tr>)}</tbody>
            </table></div>}
        </section>
    </div>;
};

export default ManualTraderStructure;
