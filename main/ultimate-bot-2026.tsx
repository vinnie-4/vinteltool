import React, { useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
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

const STRATEGIES = ['Even/Odd', 'Over/Under', 'Matches/Differs', 'Last Digit', 'Rise/Fall'];
const RECOVERY = ['Fixed Stake', 'Martingale', 'Anti-Martingale', 'Custom Multiplier'];
const CONTRACT_TYPES: Record<string, string> = { Even: 'DIGITEVEN', Odd: 'DIGITODD', Over: 'DIGITOVER', Under: 'DIGITUNDER' };
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
    const request: Record<string, unknown> = { proposal: 1, amount, basis: 'stake', contract_type: contractType, currency, duration, duration_unit: 't', underlying_symbol: symbol };
    if (contractType === 'DIGITOVER' || contractType === 'DIGITUNDER') request.barrier = prediction;
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

const waitForContractResult = async (api: any, contractId: string) => {
    const started = Date.now();
    while (Date.now() - started < 120000) {
        const response = await api.send({ proposal_open_contract: 1, contract_id: contractId });
        if (response?.error) throw new Error(response.error.message || 'Unable to read contract result.');
        const contract = response?.proposal_open_contract;
        if (contract && (contract.is_sold || contract.status === 'won' || contract.status === 'lost')) return contract;
        await sleep(500);
    }
    throw new Error('Timed out waiting for the Deriv contract result.');
};

const UltimateBot2026 = () => {
    const [volatility, setVolatility] = useState('Volatility 100');
    const [strategy, setStrategy] = useState('Even/Odd');
    const [sample, setSample] = useState('100');
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
    const tradeLockRef = useRef(false);
    const stopRequestedRef = useRef(false);
    const status = useMemo(() => (running ? 'RUNNING' : 'READY'), [running]);

    const handleRun = async () => {
        if (running) {
            stopRequestedRef.current = true;
            setRunning(false);
            return;
        }
        if (tradeLockRef.current) return;

        const amount = Number(stake);
        const count = Math.max(1, Math.floor(Number(maxTrades) || 1));
        const ticks = Math.max(1, Math.floor(Number(duration) || 1));
        const tp = Math.max(0, Number(takeProfit) || 0);
        const sl = Math.max(0, Number(stopLoss) || 0);
        const baseMultiplier = Math.max(1, Number(multiplier) || 2);
        const recoveryLimit = Math.max(0, Math.floor(Number(maxRecovery) || 0));

        if (!Number.isFinite(amount) || amount <= 0) { window.alert('Enter a valid stake greater than 0.'); return; }
        if (!['Even/Odd', 'Over/Under'].includes(strategy)) { window.alert(`${strategy} live execution is not enabled yet. Select Even/Odd or Over/Under for real trades.`); return; }
        if (strategy === 'Over/Under' && (!Number.isInteger(Number(prediction)) || Number(prediction) < 0 || Number(prediction) > 9)) { window.alert('Prediction must be a digit from 0 to 9.'); return; }

        tradeLockRef.current = true;
        stopRequestedRef.current = false;
        setLastError('');
        setTradesPlaced(0);
        setRunning(true);

        try {
            const api = await waitForTradingApi();
            const contractType = strategy === 'Even/Odd' ? CONTRACT_TYPES[tradeType] : CONTRACT_TYPES[tradeType === 'Under' ? 'Under' : 'Over'];
            let currentStake = amount;
            let consecutiveLosses = 0;
            let sessionProfit = 0;
            let placed = 0;

            while (placed < count && !stopRequestedRef.current) {
                const buy = await buyContract(api, contractType, currentStake, VOLATILITY_SYMBOLS[volatility], ticks, Number(prediction));
                const result = await waitForContractResult(api, String(buy.contract_id));
                const profit = Number(result.profit) || 0;
                sessionProfit += profit;
                placed += 1;
                setTradesPlaced(placed);

                if (tp > 0 && sessionProfit >= tp) break;
                if (sl > 0 && sessionProfit <= -Math.abs(sl)) break;

                const won = result.status === 'won' || profit > 0;
                if (won) {
                    consecutiveLosses = 0;
                    currentStake = recovery === 'Anti-Martingale' ? amount * baseMultiplier : amount;
                } else {
                    consecutiveLosses += 1;
                    if (recovery === 'Martingale' || recovery === 'Custom Multiplier') {
                        currentStake = consecutiveLosses <= recoveryLimit ? amount * Math.pow(baseMultiplier, consecutiveLosses) : amount;
                    } else {
                        currentStake = amount;
                    }
                }

                if (placed < count && !stopRequestedRef.current && Number(cooldown) > 0) await sleep(Math.max(0, Number(cooldown)) * 1000);
            }
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
            <div className='ultimate-bot-2026__hero'><div><div className='ultimate-bot-2026__eyebrow'>VINTEL TOOL</div><h2>Ultimate Bot 2026</h2><p>Advanced strategy automation with live market intelligence.</p></div><span className={`ultimate-bot-2026__status ultimate-bot-2026__status--${running ? 'running' : 'ready'}`}>{status}</span></div>
            <div className='ultimate-bot-2026__card'><h3>Strategy</h3><div className='ultimate-bot-2026__grid'>
                <label>Strategy<select value={strategy} onChange={e => setStrategy(e.target.value)}>{STRATEGIES.map(item => <option key={item}>{item}</option>)}</select></label>
                <label>Volatility<select value={volatility} onChange={e => setVolatility(e.target.value)}>{VOLATILITY_OPTIONS.map(item => <option key={item}>{item}</option>)}</select></label>
            </div>
            {(strategy === 'Even/Odd' || strategy === 'Over/Under') && <div className='ultimate-bot-2026__grid'>
                <label>Trade type<select value={tradeType} onChange={e => setTradeType(e.target.value)}>{strategy === 'Even/Odd' ? <><option>Even</option><option>Odd</option></> : <><option>Over</option><option>Under</option></>}</select></label>
                {strategy === 'Over/Under' && <label>Prediction digit<input inputMode='numeric' min='0' max='9' value={prediction} onChange={e => setPrediction(e.target.value)} /></label>}
            </div>}
            <div className='ultimate-bot-2026__signal'><div><b>DCircles</b><span>Live digit signal</span></div><div className='ultimate-bot-2026__signal-values'><span className='green'>Most</span><span className='blue'>2nd</span><span className='yellow'>2nd least</span><span className='red'>Least</span></div></div>
            <div className='ultimate-bot-2026__sample-row'><span>Analysis sample</span>{['30', '60', '100', '300', '500', '1000'].map(item => <button key={item} className={sample === item ? 'active' : ''} onClick={() => setSample(item)}>{item}</button>)}</div></div>
            <div className='ultimate-bot-2026__card'><h3>Trade & recovery</h3><div className='ultimate-bot-2026__inputs'>
                <label>Initial stake<input inputMode='decimal' value={stake} onChange={e => setStake(e.target.value)} /></label><label>Recovery<select value={recovery} onChange={e => setRecovery(e.target.value)}>{RECOVERY.map(item => <option key={item}>{item}</option>)}</select></label><label>Multiplier<input inputMode='decimal' value={multiplier} onChange={e => setMultiplier(e.target.value)} /></label><label>Max recovery<input inputMode='numeric' value={maxRecovery} onChange={e => setMaxRecovery(e.target.value)} /></label><label>Max trades<input inputMode='numeric' value={maxTrades} onChange={e => setMaxTrades(e.target.value)} /></label><label>Cooldown<input inputMode='numeric' value={cooldown} onChange={e => setCooldown(e.target.value)} /></label><label>Ticks<input inputMode='numeric' value={duration} onChange={e => setDuration(e.target.value)} /></label>
            </div></div>
            <div className='ultimate-bot-2026__card'><h3>Safety limits</h3><div className='ultimate-bot-2026__inputs ultimate-bot-2026__inputs--limits'><label>Take profit<input inputMode='decimal' value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></label><label>Stop loss<input inputMode='decimal' value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></label></div><div className='ultimate-bot-2026__safety'>Maximum loss • Maximum profit • Consecutive-loss protection • Emergency stop</div></div>
            <div className='ultimate-bot-2026__live'><div><span>Market</span><b>{volatility}</b></div><div><span>Strategy</span><b>{strategy} {tradeType}</b></div><div><span>Stake</span><b>{stake} USD</b></div><div><span>Trades placed</span><b>{tradesPlaced}/{maxTrades}</b></div></div>
            {lastError && <div className='ultimate-bot-2026__error'>{lastError}</div>}
            <button className={`ultimate-bot-2026__run ${running ? 'stop' : ''}`} onClick={handleRun}>{running ? 'Stop Ultimate Bot' : 'Run Ultimate Bot'}</button>
        </section>
    );
};

export default UltimateBot2026;
