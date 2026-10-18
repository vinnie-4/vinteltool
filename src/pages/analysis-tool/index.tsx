import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.scss';

type AnalysisTab = 'dcircles' | 'ldp';
type TickRecord = { quote: number; digit: number };
type RankTone = 'most' | 'second-most' | 'second-least' | 'least' | 'normal';

const DIGITS = Array.from({ length: 10 }, (_, i) => i);
const VOLATILITY_INDICES = [
    ['Volatility 10', 'R_10'], ['Volatility 10 (1s)', '1HZ10V'], ['Volatility 15 (1s)', '1HZ15V'],
    ['Volatility 25', 'R_25'], ['Volatility 25 (1s)', '1HZ25V'], ['Volatility 30 (1s)', '1HZ30V'],
    ['Volatility 50', 'R_50'], ['Volatility 50 (1s)', '1HZ50V'], ['Volatility 75', 'R_75'],
    ['Volatility 75 (1s)', '1HZ75V'], ['Volatility 90 (1s)', '1HZ90V'], ['Volatility 100', 'R_100'],
    ['Volatility 100 (1s)', '1HZ100V'],
] as const;
const TICK_WINDOWS = [3000, 1000, 500, 300, 100, 60];
const MAX_TICKS = 3000;
const WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

const getLastDigit = (quote: number, pipSize = 2) => {
    const decimals = Math.max(0, Math.min(8, Number(pipSize) || 2));
    return Number(quote.toFixed(decimals).replace('.', '').slice(-1));
};
const formatPrice = (quote: number | null, pipSize: number) => quote === null ? '—' : quote.toFixed(Math.max(0, Math.min(8, Number(pipSize) || 2)));

type AnalysisToolProps = {
    showLegend?: boolean;
    showStreak?: boolean;
    showSubtabs?: boolean;
    showControls?: boolean;
    showPrice?: boolean;
    selectedIndex?: string;
    onSelectedIndexChange?: (value: string) => void;
    windowSize?: number;
    onWindowSizeChange?: (value: number) => void;
    showContractProbabilities?: boolean;
    contractMode?: 'Even/Odd' | 'Over/Under' | 'Matches/Differs';
    predictionDigit?: number;
    onDigitSelect?: (digit: number) => void;
    selectedBarrierDigit?: number;
};

const AnalysisTool = ({
    showLegend = true,
    showStreak = false,
    showSubtabs = true,
    showControls = true,
    showPrice = false,
    selectedIndex: controlledSelectedIndex,
    onSelectedIndexChange,
    windowSize: controlledWindowSize,
    onWindowSizeChange,
    showContractProbabilities = true,
    contractMode = 'Even/Odd',
    predictionDigit = 1,
    onDigitSelect,
    selectedBarrierDigit,
}: AnalysisToolProps) => {
    const [activeTab, setActiveTab] = useState<AnalysisTab>('dcircles');
    const [internalSelectedIndex, setInternalSelectedIndex] = useState('Volatility 100 (1s)');
    const [internalWindowSize, setInternalWindowSize] = useState(3000);
    const selectedIndex = controlledSelectedIndex ?? internalSelectedIndex;
    const windowSize = controlledWindowSize ?? internalWindowSize;
    const [ticks, setTicks] = useState<TickRecord[]>([]);
    const [latestDigit, setLatestDigit] = useState<number | null>(null);
    const [latestPrice, setLatestPrice] = useState<number | null>(null);
    const [pipSize, setPipSize] = useState(2);
    const [connected, setConnected] = useState(false);
    const [connectionError, setConnectionError] = useState('');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<number | null>(null);
    const connectionIdRef = useRef(0);
    const stoppedRef = useRef(false);
    const pipSizeRef = useRef(2);
    const selectedSymbol = VOLATILITY_INDICES.find(([name]) => name === selectedIndex)?.[1] || '1HZ100V';

    const connect = useCallback(() => {
        stoppedRef.current = false;
        const connectionId = ++connectionIdRef.current;
        setConnected(false);
        setConnectionError('');
        if (reconnectRef.current) { window.clearTimeout(reconnectRef.current); reconnectRef.current = null; }
        const previous = wsRef.current;
        wsRef.current = null;
        if (previous) { previous.onopen = null; previous.onmessage = null; previous.onerror = null; previous.onclose = null; previous.close(); }
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => {
            if (stoppedRef.current || connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            setConnected(true);
            setConnectionError('');
            ws.send(JSON.stringify({ ticks_history: selectedSymbol, count: MAX_TICKS, end: 'latest', style: 'ticks', req_id: 1 }));
            ws.send(JSON.stringify({ ticks: selectedSymbol, subscribe: 1, req_id: 2 }));
        };
        ws.onmessage = event => {
            if (connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            try {
                const data = JSON.parse(event.data);
                if (data.error || Array.isArray(data.errors)) { setConnected(false); setConnectionError(data.error?.message || data.errors?.[0]?.message || 'Deriv public WebSocket rejected the request'); return; }
                const receivedPipSize = Number(data.pip_size ?? data.tick?.pip_size);
                if (Number.isFinite(receivedPipSize) && receivedPipSize >= 0) { pipSizeRef.current = receivedPipSize; setPipSize(receivedPipSize); }
                const decimals = Number.isFinite(receivedPipSize) && receivedPipSize >= 0 ? receivedPipSize : pipSizeRef.current;
                if (data.msg_type === 'history' && Array.isArray(data.history?.prices)) {
                    const prices = data.history.prices.map(Number).filter(Number.isFinite);
                    const historyTicks = prices.map(quote => ({ quote, digit: getLastDigit(quote, decimals) })).slice(-MAX_TICKS);
                    setTicks(historyTicks);
                    const last = historyTicks[historyTicks.length - 1];
                    if (last) { setLatestPrice(last.quote); setLatestDigit(last.digit); }
                    setConnected(true); setConnectionError('');
                    return;
                }
                if (data.msg_type === 'tick' && data.tick?.quote !== undefined) {
                    const quote = Number(data.tick.quote);
                    if (!Number.isFinite(quote)) return;
                    const digit = getLastDigit(quote, decimals);
                    setLatestPrice(quote); setLatestDigit(digit);
                    setTicks(previousTicks => [...previousTicks, { quote, digit }].slice(-MAX_TICKS));
                    setConnected(true); setConnectionError('');
                }
            } catch { setConnected(false); setConnectionError('Invalid response received from Deriv'); }
        };
        ws.onclose = event => {
            if (connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            wsRef.current = null;
            setConnected(false);
            if (!stoppedRef.current) {
                setConnectionError(event.reason || `WebSocket closed (${event.code})`);
                reconnectRef.current = window.setTimeout(() => {
                    if (!stoppedRef.current && connectionId === connectionIdRef.current) connect();
                }, 2500);
            }
        };
        ws.onerror = () => {
            if (connectionId === connectionIdRef.current && wsRef.current === ws) {
                setConnected(false);
                setConnectionError('Unable to open Deriv public WebSocket');
            }
        };
    }, [selectedSymbol]);

    useEffect(() => {
        setTicks([]);
        setLatestDigit(null);
        setLatestPrice(null);
        setPipSize(2);
        pipSizeRef.current = 2;
        connect();
        return () => {
            stoppedRef.current = true;
            ++connectionIdRef.current;
            if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws) { ws.onopen = null; ws.onmessage = null; ws.onerror = null; ws.onclose = null; ws.close(); }
        };
    }, [connect]);

    const analysisTicks = useMemo(() => ticks.slice(-windowSize), [ticks, windowSize]);
    const stats = useMemo(() => {
        const counts = DIGITS.map(digit => analysisTicks.filter(tick => tick.digit === digit).length);
        const total = counts.reduce((sum, count) => sum + count, 0);
        const ranked = DIGITS.map((digit, index) => ({ digit, count: counts[index] })).sort((a, b) => b.count - a.count || a.digit - b.digit);
        const tones = new Map<number, RankTone>();
        if (total) { tones.set(ranked[0].digit, 'most'); tones.set(ranked[1].digit, 'second-most'); tones.set(ranked[8].digit, 'second-least'); tones.set(ranked[9].digit, 'least'); }
        return DIGITS.map((digit, index) => ({ digit, count: counts[index], percentage: total ? counts[index] / total * 100 : 0, rankTone: tones.get(digit) || 'normal' as RankTone }));
    }, [analysisTicks]);

    const parityStats = useMemo(() => {
        const even = analysisTicks.filter(tick => tick.digit % 2 === 0).length;
        const odd = analysisTicks.length - even;
        const total = analysisTicks.length || 1;
        const streak = analysisTicks.slice(-50).map(tick => tick.digit % 2 === 0 ? 'E' : 'O');
        return { even, odd, evenPercent: even / total * 100, oddPercent: odd / total * 100, streak };
    }, [analysisTicks]);

    const contractProbabilities = useMemo(() => {
        const digits = analysisTicks.map(tick => tick.digit);
        const total = digits.length;
        const matchCount = digits.filter(digit => digit === predictionDigit).length;
        const underCount = digits.filter(digit => digit < 5).length;
        const evenCount = digits.filter(digit => digit % 2 === 0).length;
        const classify = (digit: number) => contractMode === 'Even/Odd'
            ? (digit % 2 === 0 ? 'first' : 'second')
            : contractMode === 'Over/Under' ? (digit < 5 ? 'first' : 'second')
            : (digit === predictionDigit ? 'first' : 'second');
        const lastClass = digits.length ? classify(digits[digits.length - 1]) : null;
        let streak = 0;
        for (let i = digits.length - 1; i >= 0 && classify(digits[i]) === lastClass; i--) streak++;
        const firstCount = contractMode === 'Even/Odd' ? evenCount : contractMode === 'Over/Under' ? underCount : matchCount;
        const firstName = contractMode === 'Even/Odd' ? 'Even' : contractMode === 'Over/Under' ? 'Under 5' : 'Matches ' + predictionDigit;
        const secondName = contractMode === 'Even/Odd' ? 'Odd' : contractMode === 'Over/Under' ? 'Over 4' : 'Differs ' + predictionDigit;
        return { total, streak, lastClass, firstName, secondName, firstPercent: total ? firstCount / total * 100 : 0, secondPercent: total ? (total - firstCount) / total * 100 : 0 };
    }, [analysisTicks, contractMode, predictionDigit]);

    const changeIndex = (value: string) => {
        setInternalSelectedIndex(value);
        onSelectedIndexChange?.(value);
    };
    const changeWindow = (value: number) => {
        setInternalWindowSize(value);
        onWindowSizeChange?.(value);
    };

    return <section className='dcircles'>
        {showSubtabs && <div className='dcircles__subtabs' role='tablist'>
            <button type='button' className={activeTab === 'dcircles' ? 'is-active' : ''} onClick={() => setActiveTab('dcircles')}>DCircles</button>
            <button type='button' className={activeTab === 'ldp' ? 'is-active' : ''} onClick={() => setActiveTab('ldp')}>LDP Analyzer</button>
        </div>}
        {activeTab === 'ldp' && showSubtabs ? <div className='dcircles__placeholder'><h2>Last Digit Probability Analyzer</h2><p>LDP Analyzer remains a separate analysis view.</p></div> : <>
            {showControls && <div className='dcircles__controls'>
                <label>Market<select value={selectedIndex} onChange={event => changeIndex(event.target.value)}>{VOLATILITY_INDICES.map(([name]) => <option key={name} value={name}>{name}</option>)}</select></label>
                <label>Ticks<select value={windowSize} onChange={event => changeWindow(Number(event.target.value))}>{TICK_WINDOWS.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
            </div>}
            <div className='dcircles__circle-panel'>
                <div className='dcircles__market-heading'><span>{formatPrice(latestPrice, pipSize)}</span><strong>{selectedIndex} Index</strong></div>
                <div className='dcircles__circles'>{stats.map(item => <div className={`dcircles__digit dcircles__digit--${item.digit} dcircles__digit--rank-${item.rankTone}${item.digit === latestDigit ? ' dcircles__digit--latest' : ''}${item.digit === selectedBarrierDigit ? ' dcircles__digit--selected-barrier' : ''}`} key={item.digit}>
                    <button type='button' className='dcircles__circle' onClick={() => onDigitSelect?.(item.digit)} aria-pressed={item.digit === selectedBarrierDigit} aria-label={`Select barrier digit ${item.digit}; ${item.percentage.toFixed(1)} percent, ${item.count} appearances${item.digit === latestDigit ? ', latest tick' : ''}`}><span>{item.digit}</span><b>{item.percentage.toFixed(1)}%</b>{item.digit === latestDigit && <i className='dcircles__pointer' aria-label='Latest tick cursor'>▲</i>}</button>
                    <strong className='dcircles__digit-count'>{item.count}</strong>
                </div>)}</div>
                <div className='dcircles__status'>{connected ? '● Live' : '○ Connecting'} · {Math.min(analysisTicks.length, windowSize)} / {windowSize}{connectionError && <span className='dcircles__error'> · {connectionError}</span>}</div>
                <div className='dcircles__recent-digits' aria-label='Last ten digits'>{analysisTicks.slice(-10).map((tick, index, recent) => <span key={index} className={tick.digit % 2 === 0 ? 'is-even' : 'is-odd'} aria-label={tick.digit % 2 === 0 ? 'Even' : 'Odd'}>{tick.digit % 2 === 0 ? 'E' : 'O'}</span>)}</div>
            </div>
            {showContractProbabilities && <div className='dcircles__contract-probabilities' aria-live='polite'>
                <div className='dcircles__contract-heading'><strong>Probabilities</strong><span>{Math.min(analysisTicks.length, windowSize)} / {windowSize}</span></div>
                {[{ name: contractProbabilities.firstName, percent: contractProbabilities.firstPercent, tone: 'first' }, { name: contractProbabilities.secondName, percent: contractProbabilities.secondPercent, tone: 'second' }].map(item => <div className='dcircles__contract-row' key={item.name}>
                    <div className='dcircles__contract-label'><span>{item.name}</span><b>{analysisTicks.length ? item.percent.toFixed(1) + '%' : '—'}</b></div>
                    <div className='dcircles__contract-track'><i className={'dcircles__contract-fill dcircles__contract-fill--' + item.tone} style={{ width: item.percent + '%' }} /></div>
                </div>)}
                <div className='dcircles__contract-streak'>Current {contractProbabilities.lastClass === 'first' ? contractProbabilities.firstName : contractProbabilities.lastClass === 'second' ? contractProbabilities.secondName : 'outcome'} streak: <strong>{analysisTicks.length ? contractProbabilities.streak : 0}</strong></div>
                
            </div>}
        </>}
    </section>;
};

export default AnalysisTool;

