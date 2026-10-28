import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import './main.scss';

const VOLATILITY_OPTIONS = [
    'Volatility 10', 'Volatility 10 (1s)', 'Volatility 15', 'Volatility 15 (1s)',
    'Volatility 25', 'Volatility 25 (1s)', 'Volatility 30', 'Volatility 30 (1s)',
    'Volatility 50', 'Volatility 50 (1s)', 'Volatility 75', 'Volatility 75 (1s)',
    'Volatility 90', 'Volatility 90 (1s)', 'Volatility 100', 'Volatility 100 (1s)',
];

const VOLATILITY_SYMBOLS: Record<string, string> = {
    'Volatility 10': 'R_10', 'Volatility 10 (1s)': '1HZ10V', 'Volatility 15': 'R_15', 'Volatility 15 (1s)': '1HZ15V',
    'Volatility 25': 'R_25', 'Volatility 25 (1s)': '1HZ25V', 'Volatility 30': 'R_30', 'Volatility 30 (1s)': '1HZ30V',
    'Volatility 50': 'R_50', 'Volatility 50 (1s)': '1HZ50V', 'Volatility 75': 'R_75', 'Volatility 75 (1s)': '1HZ75V',
    'Volatility 90': 'R_90', 'Volatility 90 (1s)': '1HZ90V', 'Volatility 100': 'R_100', 'Volatility 100 (1s)': '1HZ100V',
};

const STRATEGIES = ['Even/Odd', 'Over/Under'];
const RECOVERY = ['Fixed Stake', 'Martingale', 'Anti-Martingale', 'Custom Multiplier'];
const CONTRACT_TYPES: Record<string, string> = { Even: 'DIGITEVEN', Odd: 'DIGITODD', Over: 'DIGITOVER', Under: 'DIGITUNDER' };
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForTradingApi = async () => {
    const started = Date.now();
    while (Date.now() - started < 10000) {
        const api = api_base.api;
        if (api?.connection?.readyState === 1 && api_base.is_authorized) return api;
        await sleep(200);
    }
    throw new Error('Deriv trading connection is not ready. Please log in and select a trading account.');
};

// Deriv's shared API uses send() plus onMessage(); send() itself does not return the response.
const requestDeriv = (api: any, payload: Record<string, unknown>, responseKey: string, matches: (message: any) => boolean = () => true, timeoutMs = 15000): Promise<any> =>
    new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error, value?: any) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            subscription?.unsubscribe?.();
            if (error) reject(error); else resolve(value);
        };
        const subscription = api.onMessage().subscribe((message: any) => {
            if (message?.error && (!message.msg_type || message.msg_type === responseKey)) {
                finish(new Error(message.error.message || 'Deriv request failed.'));
                return;
            }
            if (message?.msg_type === responseKey && matches(message)) finish(undefined, message);
        });
        const timeout = setTimeout(() => finish(new Error(`Timed out waiting for Deriv ${responseKey} response.`)), timeoutMs);
        try { api.send(payload); } catch (error) { finish(error instanceof Error ? error : new Error('Unable to send Deriv request.')); }
    });

const buyContract = async (api: any, contractType: string, amount: number, symbol: string, duration: number, prediction: number) => {
    const currency = api_base.account_info?.currency || 'USD';
    const request: Record<string, unknown> = { proposal: 1, amount, basis: 'stake', contract_type: contractType, currency, duration, duration_unit: 't', underlying_symbol: symbol };
    if (contractType === 'DIGITOVER' || contractType === 'DIGITUNDER') request.barrier = prediction;
    const proposalResponse = await requestDeriv(api, request, 'proposal');
    const proposal = proposalResponse?.proposal;
    if (!proposal?.id || proposal.ask_price === undefined) throw new Error('Deriv returned an invalid trade proposal.');
    const buyResponse = await requestDeriv(api, { buy: proposal.id, price: proposal.ask_price }, 'buy');
    const buy = buyResponse?.buy;
    if (!buy?.contract_id) throw new Error('Deriv did not confirm the purchased contract.');
    return buy;
};

const waitForContractResult = async (api: any, contractId: string) => {
    const response = await requestDeriv(
        api,
        { proposal_open_contract: 1, contract_id: Number(contractId), subscribe: 1 },
        'proposal_open_contract',
        message => String(message?.proposal_open_contract?.contract_id) === String(contractId) &&
            Boolean(message?.proposal_open_contract?.is_sold || ['won', 'lost'].includes(message?.proposal_open_contract?.status)),
        120000
    );
    return response.proposal_open_contract;
};

const UltimateBot2026 = () => {
    const { transactions } = useStore();
    const [volatility, setVolatility] = useState('Volatility 100');
    const [strategy, setStrategy] = useState('Even/Odd');
    const [sample, setSample] = useState('3000');
    const [recovery, setRecovery] = useState('Fixed Stake');
    const [stake, setStake] = useState('0.50');
    const [multiplier, setMultiplier] = useState('2');
    const [maxRecovery, setMaxRecovery] = useState('4');
    const [maxTrades, setMaxTrades] = useState('10');
    const [takeProfit, setTakeProfit] = useState('10');
    const [stopLoss, setStopLoss] = useState('10');
    const [cooldown, setCooldown] = useState('1');
    const [duration, setDuration] = useState('1');
    const [prediction, setPrediction] = useState('5');
    const [tradeType, setTradeType] = useState('Even');
    const [running, setRunning] = useState(false);
    const [tradesPlaced, setTradesPlaced] = useState(0);
    const [lastError, setLastError] = useState('');
    const [recentDigits, setRecentDigits] = useState<number[]>([]);
    const [analysisStatus, setAnalysisStatus] = useState('Waiting for live market data');
    const tradeLockRef = useRef(false);
    const stopRequestedRef = useRef(false);
    const status = useMemo(() => (running ? 'RUNNING' : 'READY'), [running]);
    useEffect(() => {
        let cancelled = false;
        let subscription: any;
        let retryTimer: ReturnType<typeof setTimeout>;
        let pipSize = 2;
        const symbol = VOLATILITY_SYMBOLS[volatility];
        const loadTicks = async () => {
            const api = api_base.api;
            if (!api || api.connection?.readyState !== 1 || !api_base.is_authorized) {
                if (!cancelled) {
                    setAnalysisStatus('Log in to stream live digit analysis');
                    retryTimer = setTimeout(loadTicks, 1500);
                }
                return;
            }
            try {
                setAnalysisStatus('Loading tick history…');
                const history = await requestDeriv(api, { ticks_history: symbol, count: Math.max(60, Number(sample) || 3000), end: 'latest', style: 'ticks' }, 'history');
                if (cancelled) return;
                pipSize = Number(history?.pip_size ?? 2);
                const prices: number[] = history?.history?.prices || [];
                setRecentDigits(prices.map(price => Number(Number(price).toFixed(pipSize).slice(-1))));
                setAnalysisStatus(prices.length ? `Analysing ${prices.length} recent ticks` : 'No tick history returned');
                api.send({ ticks: symbol, subscribe: 1 });
                subscription = api.onMessage().subscribe((message: any) => {
                    if (cancelled || message?.msg_type !== 'tick' || message?.tick?.symbol !== symbol) return;
                    const quote = Number(message.tick.quote);
                    const precision = Number(message.tick.pip_size ?? pipSize);
                    const digit = Number(quote.toFixed(precision).slice(-1));
                    setRecentDigits(previous => [...previous.slice(-Math.max(59, (Number(sample) || 3000) - 1)), digit]);
                    setAnalysisStatus('Live digit analysis connected');
                });
            } catch (error) {
                if (!cancelled) {
                    setAnalysisStatus(error instanceof Error ? error.message : 'Unable to load digit analysis');
                    retryTimer = setTimeout(loadTicks, 3000);
                }
            }
        };
        void loadTicks();
        return () => {
            cancelled = true;
            clearTimeout(retryTimer);
            subscription?.unsubscribe?.();
            const api = api_base.api;
            if (api?.connection?.readyState === 1) api.send({ forget_all: 'ticks' });
        };
    }, [volatility, sample, api_base.is_authorized]);
    
    const digitCounts = useMemo(() => {
        const counts = Array(10).fill(0);
        recentDigits.forEach(digit => { if (digit >= 0 && digit <= 9) counts[digit] += 1; });
        const total = recentDigits.length || 1;
        const even = recentDigits.filter(digit => digit % 2 === 0).length;
        const over4 = recentDigits.filter(digit => digit > 4).length;
        return {
            counts,
            even: even / total * 100,
            odd: (recentDigits.length - even) / total * 100,
            over4: over4 / total * 100,
            under5: (recentDigits.length - over4) / total * 100,
        };
    }, [recentDigits]);


    const handleRun = async () => {
        if (running) {
            stopRequestedRef.current = true;
            return;
        }
        if (tradeLockRef.current) return;

        const baseAmount = Number(stake);
        const count = Math.max(1, Math.floor(Number(maxTrades) || 1));
        const ticks = Math.max(1, Math.floor(Number(duration) || 1));
        const tp = Math.max(0, Number(takeProfit) || 0);
        const sl = Math.max(0, Number(stopLoss) || 0);
        const baseMultiplier = Math.max(1, Number(multiplier) || 2);
        const recoveryLimit = Math.max(0, Math.floor(Number(maxRecovery) || 0));
        const waitSeconds = Math.max(0, Number(cooldown) || 0);
        const barrier = Number(prediction);

        if (!Number.isFinite(baseAmount) || baseAmount <= 0) { window.alert('Enter a valid stake greater than 0.'); return; }
        if (!['Even/Odd', 'Over/Under'].includes(strategy)) { window.alert(`${strategy} live execution is not enabled yet. Select Even/Odd or Over/Under for real trades.`); return; }
        if (strategy === 'Over/Under' && (!Number.isInteger(barrier) || barrier < 0 || barrier > 9)) { window.alert('Prediction must be a digit from 0 to 9.'); return; }
        if (!Number.isFinite(Number(takeProfit)) || Number(takeProfit) < 0 || !Number.isFinite(Number(stopLoss)) || Number(stopLoss) < 0) { window.alert('Take profit and stop loss must be zero or greater.'); return; }

        tradeLockRef.current = true;
        stopRequestedRef.current = false;
        setLastError('');
        setTradesPlaced(0);
        setRunning(true);

        try {
            const api = await waitForTradingApi();
            const contractType = strategy === 'Even/Odd'
                ? CONTRACT_TYPES[tradeType]
                : CONTRACT_TYPES[tradeType === 'Under' ? 'Under' : 'Over'];
            const symbol = VOLATILITY_SYMBOLS[volatility];
            const currency = api_base.account_info?.currency || 'USD';
            let currentStake = baseAmount;
            let consecutiveLosses = 0;
            let sessionProfit = 0;
            let completedTrades = 0;

            for (let index = 0; index < count && !stopRequestedRef.current; index += 1) {
                if (tp > 0 && sessionProfit >= tp) break;
                if (sl > 0 && sessionProfit <= -Math.abs(sl)) break;
                if (currentStake <= 0 || !Number.isFinite(currentStake)) throw new Error('Calculated stake is invalid; trading stopped for safety.');

                const buy = await buyContract(api, contractType, currentStake, symbol, ticks, barrier);
                completedTrades += 1;
                setTradesPlaced(completedTrades);
                transactions.pushTransaction({
                    contract_id: Number(buy.contract_id),
                    transaction_ids: { buy: Number(buy.transaction_id) || undefined },
                    contract_type: contractType, underlying_symbol: symbol, currency,
                    buy_price: Number(buy.buy_price ?? currentStake), payout: Number(buy.payout ?? 0),
                    profit: 0, is_completed: false, date_start: Math.floor(Date.now() / 1000),
                });

                const result = await waitForContractResult(api, String(buy.contract_id));
                const profit = Number(result.profit) || 0;
                sessionProfit = Number((sessionProfit + profit).toFixed(2));
                transactions.pushTransaction({
                    ...result,
                    contract_id: Number(result.contract_id ?? buy.contract_id),
                    transaction_ids: {
                        ...(result.transaction_ids || {}),
                        buy: Number(buy.transaction_id) || result.transaction_ids?.buy || undefined,
                        sell: Number(result.sell_transaction_id ?? result.transaction_ids?.sell) || result.transaction_ids?.sell,
                    },
                    contract_type: result.contract_type || contractType,
                    underlying_symbol: result.underlying || result.underlying_symbol || symbol,
                    currency: result.currency || currency,
                    buy_price: Number(result.buy_price ?? buy.buy_price ?? currentStake),
                    payout: Number(result.payout ?? buy.payout ?? 0),
                    profit, entry_spot: result.entry_tick_display_value ?? result.entry_tick ?? result.entry_spot,
                    exit_spot: result.exit_tick_display_value ?? result.exit_tick ?? result.exit_spot,
                    is_completed: true, date_start: result.date_start || Math.floor(Date.now() / 1000),
                });

                if (profit > 0) {
                    consecutiveLosses = 0;
                    currentStake = recovery === 'Anti-Martingale' ? Number((currentStake * baseMultiplier).toFixed(2)) : baseAmount;
                } else {
                    consecutiveLosses += 1;
                    if (recovery === 'Martingale' || recovery === 'Custom Multiplier') {
                        currentStake = consecutiveLosses > recoveryLimit ? baseAmount : Number((currentStake * baseMultiplier).toFixed(2));
                        if (consecutiveLosses > recoveryLimit) consecutiveLosses = 0;
                    } else {
                        currentStake = baseAmount;
                    }
                }

                if (tp > 0 && sessionProfit >= tp) break;
                if (sl > 0 && sessionProfit <= -Math.abs(sl)) break;
                if (!stopRequestedRef.current && index < count - 1 && waitSeconds > 0) {
                    await sleep(waitSeconds * 1000);
                }
            }

            if (stopRequestedRef.current) setLastError('Stop requested. Any open contract was allowed to finish before stopping.');
            else if (tp > 0 && sessionProfit >= tp) setLastError(`Take-profit limit reached: +${sessionProfit.toFixed(2)} ${currency}.`);
            else if (sl > 0 && sessionProfit <= -Math.abs(sl)) setLastError(`Stop-loss limit reached: ${sessionProfit.toFixed(2)} ${currency}.`);
            else if (completedTrades > 0) setLastError(`Session finished: ${completedTrades} trade(s), P/L ${sessionProfit >= 0 ? '+' : ''}${sessionProfit.toFixed(2)} ${currency}.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Trade failed.';
            setLastError(message);
            console.error('[Ultimate Bot 2026] transaction error:', error);
            window.alert(message);
        } finally {
            tradeLockRef.current = false;
            stopRequestedRef.current = false;
            setRunning(false);
        }
    };

    return (
        <section className='ultimate-bot-2026'>
            <div className='ultimate-bot-2026__hero'><div><div className='ultimate-bot-2026__eyebrow'>VINTEL TOOL</div><h2>Bulk Trader</h2></div><span className={`ultimate-bot-2026__status ultimate-bot-2026__status--${running ? 'running' : 'ready'}`}>{status}</span></div>
            <div className='ultimate-bot-2026__card'><h3>Strategy</h3><div className='ultimate-bot-2026__grid'>
                <label>Strategy<select value={strategy} onChange={e => setStrategy(e.target.value)}>{STRATEGIES.map(item => <option key={item}>{item}</option>)}</select></label>
                <label>Volatility<select value={volatility} onChange={e => setVolatility(e.target.value)}>{VOLATILITY_OPTIONS.map(item => <option key={item}>{item}</option>)}</select></label>
            </div>
            {(strategy === 'Even/Odd' || strategy === 'Over/Under') && <div className='ultimate-bot-2026__grid'>
                <label>Trade type<select value={tradeType} onChange={e => setTradeType(e.target.value)}>{strategy === 'Even/Odd' ? <><option>Even</option><option>Odd</option></> : <><option>Over</option><option>Under</option></>}</select></label>
                {strategy === 'Over/Under' && <label>Prediction digit<input inputMode='numeric' min='0' max='9' value={prediction} onChange={e => setPrediction(e.target.value)} /></label>}
            </div>}
            <div className='ultimate-bot-2026__signal'><div><b>Live digit analysis</b><span>{analysisStatus} · {recentDigits.length} ticks</span></div><div className='ultimate-bot-2026__signal-values'><span className='green'>Even {digitCounts.even.toFixed(0)}%</span><span className='blue'>Odd {digitCounts.odd.toFixed(0)}%</span><span className='yellow'>Over 4 {digitCounts.over4.toFixed(0)}%</span><span className='red'>Under 5 {digitCounts.under5.toFixed(0)}%</span></div></div>
            <div className='ultimate-bot-2026__digit-bars'>{digitCounts.counts.map((value, digit) => <div key={digit}><span>{digit}</span><i style={{ height: `${Math.max(3, value / (recentDigits.length || 1) * 100)}%` }} /><small>{recentDigits.length ? (value / recentDigits.length * 100).toFixed(0) : 0}%</small></div>)}</div>
            <div className='ultimate-bot-2026__recent-digits'>{recentDigits.slice(-20).map((digit, index) => <span key={index} className={digit % 2 === 0 ? 'digit-even' : 'digit-odd'}>{digit}</span>)}</div>
            <div className='ultimate-bot-2026__sample-row'><span>Analysis sample</span>{['60', '100', '300', '500', '1000', '3000'].map(item => <button key={item} className={sample === item ? 'active' : ''} onClick={() => setSample(item)}>{item}</button>)}</div></div>
            <div className='ultimate-bot-2026__card'><h3>Trade & recovery</h3><div className='ultimate-bot-2026__inputs'>
                <label>Initial stake<input inputMode='decimal' value={stake} onChange={e => setStake(e.target.value)} /></label><label>Recovery<select value={recovery} onChange={e => setRecovery(e.target.value)}>{RECOVERY.map(item => <option key={item}>{item}</option>)}</select></label><label>Multiplier<input inputMode='decimal' value={multiplier} onChange={e => setMultiplier(e.target.value)} /></label><label>Max recovery<input inputMode='numeric' value={maxRecovery} onChange={e => setMaxRecovery(e.target.value)} /></label><label>Max trades<input inputMode='numeric' value={maxTrades} onChange={e => setMaxTrades(e.target.value)} /></label><label>Cooldown<input inputMode='numeric' value={cooldown} onChange={e => setCooldown(e.target.value)} /></label><label>Ticks<input inputMode='numeric' value={duration} onChange={e => setDuration(e.target.value)} /></label>
            </div></div>
            <div className='ultimate-bot-2026__card'><h3>Safety limits</h3><div className='ultimate-bot-2026__inputs ultimate-bot-2026__inputs--limits'><label>Take profit<input inputMode='decimal' value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></label><label>Stop loss<input inputMode='decimal' value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></label></div><div className='ultimate-bot-2026__safety'>Maximum loss • Maximum profit • Consecutive-loss protection • Emergency stop</div></div>
            <div className='ultimate-bot-2026__live'><div><span>Market</span><b>{volatility}</b></div><div><span>Strategy</span><b>{strategy} {tradeType}</b></div><div><span>Stake</span><b>{stake} {api_base.account_info?.currency || 'USD'}</b></div><div><span>Trades placed</span><b>{tradesPlaced}/{maxTrades}</b></div></div>
            {lastError && <div className='ultimate-bot-2026__error'>{lastError}</div>}
            <button className={`ultimate-bot-2026__run ${running ? 'stop' : ''}`} onClick={handleRun}>{running ? 'Stop Bulk Trader' : 'Run Bulk Trader'}</button>
        </section>
    );
};

export default UltimateBot2026;
