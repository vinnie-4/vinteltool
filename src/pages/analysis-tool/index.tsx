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
const TICK_WINDOWS = [1000, 500, 300, 100, 60, 30];
const MAX_TICKS = 1000;
const WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

const getLastDigit = (quote: number, pipSize = 2) => {
    const decimals = Math.max(0, Math.min(8, Number(pipSize) || 2));
    return Number(quote.toFixed(decimals).replace('.', '').slice(-1));
};
const formatPrice = (quote: number | null, pipSize: number) => quote === null ? '—' : quote.toFixed(Math.max(0, Math.min(8, Number(pipSize) || 2)));

const AnalysisTool = ({ showLegend = true, showSubtabs = true }: { showLegend?: boolean; showSubtabs?: boolean }) => {
    const [activeTab, setActiveTab] = useState<AnalysisTab>('dcircles');
    const [selectedIndex, setSelectedIndex] = useState('Volatility 100');
    const [windowSize, setWindowSize] = useState(1000);
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
    const selectedSymbol = VOLATILITY_INDICES.find(([name]) => name === selectedIndex)?.[1] || 'R_100';

    const connect = useCallback(() => {
        stoppedRef.current = false;
        const connectionId = ++connectionIdRef.current;
        setConnected(false); setConnectionError('');
        if (reconnectRef.current) { window.clearTimeout(reconnectRef.current); reconnectRef.current = null; }
        const previous = wsRef.current; wsRef.current = null;
        if (previous) { previous.onopen = null; previous.onmessage = null; previous.onerror = null; previous.onclose = null; previous.close(); }
        const ws = new WebSocket(WS_URL); wsRef.current = ws;
        ws.onopen = () => {
            if (stoppedRef.current || connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            setConnected(true); setConnectionError('');
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
                    setTicks(historyTicks); const last = historyTicks[historyTicks.length - 1];
                    if (last) { setLatestPrice(last.quote); setLatestDigit(last.digit); }
                    setConnected(true); setConnectionError(''); return;
                }
                if (data.msg_type === 'tick' && data.tick?.quote !== undefined) {
                    const quote = Number(data.tick.quote); if (!Number.isFinite(quote)) return;
                    const digit = getLastDigit(quote, decimals); setLatestPrice(quote); setLatestDigit(digit);
                    setTicks(previousTicks => [...previousTicks, { quote, digit }].slice(-MAX_TICKS)); setConnected(true); setConnectionError('');
                }
            } catch { setConnected(false); setConnectionError('Invalid response received from Deriv'); }
        };
        ws.onclose = event => {
            if (connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            wsRef.current = null; setConnected(false);
            if (!stoppedRef.current) { setConnectionError(event.reason || `WebSocket closed (${event.code})`); reconnectRef.current = window.setTimeout(() => { if (!stoppedRef.current && connectionId === connectionIdRef.current) connect(); }, 2500); }
        };
        ws.onerror = () => { if (connectionId === connectionIdRef.current && wsRef.current === ws) { setConnected(false); setConnectionError('Unable to open Deriv public WebSocket'); } };
    }, [selectedSymbol]);

    useEffect(() => {
        setTicks([]); setLatestDigit(null); setLatestPrice(null); setPipSize(2); pipSizeRef.current = 2; connect();
        return () => {
            stoppedRef.current = true; ++connectionIdRef.current;
            if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
            const ws = wsRef.current; wsRef.current = null;
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

    const ranking = useMemo(() => stats.filter(item => item.rankTone !== 'normal'), [stats]);
    const rankDescription = (tone: RankTone) => ({ most: ['Green bar', 'Most appearing digit'], 'second-most': ['Blue bar', '2nd most appearing digit'], 'second-least': ['Yellow bar', '2nd least appearing digit'], least: ['Red bar', 'Least appearing digit'], normal: ['', ''] }[tone]);

    return <section className='dcircles'>
        {showSubtabs && <div className='dcircles__subtabs' role='tablist'><button type='button' className={activeTab === 'dcircles' ? 'is-active' : ''} onClick={() => setActiveTab('dcircles')}>DCircles</button><button type='button' className={activeTab === 'ldp' ? 'is-active' : ''} onClick={() => setActiveTab('ldp')}>LDP Analyzer</button></div>}
        {activeTab === 'ldp' && showSubtabs ? <div className='dcircles__placeholder'><h2>Last Digit Probability Analyzer</h2><p>LDP Analyzer is separate and will have its own analysis engine.</p></div> : <>
            <div className='dcircles__controls'><label>Market<select value={selectedIndex} onChange={event => setSelectedIndex(event.target.value)}>{VOLATILITY_INDICES.map(([name]) => <option key={name}>{name}</option>)}</select></label><label>Ticks<select value={windowSize} onChange={event => setWindowSize(Number(event.target.value))}>{TICK_WINDOWS.map(size => <option key={size} value={size}>{size}</option>)}</select></label><div className='dcircles__price'><span>Price</span><strong>{formatPrice(latestPrice, pipSize)}</strong></div></div>
            <div className='dcircles__circle-panel'><div className='dcircles__circles'>{stats.map(item => <div className={`dcircles__digit dcircles__digit--${item.digit} dcircles__digit--rank-${item.rankTone}`} key={item.digit}><div className='dcircles__circle'><span>{item.digit}</span>{item.digit === latestDigit && <i className='dcircles__pointer'>▲</i>}</div><b>{item.percentage.toFixed(2)}%</b><div className='dcircles__digit-bar'><span /></div></div>)}</div><div className='dcircles__status'>{connected ? '● Live · Deriv' : '○ Connecting to Deriv…'} · {analysisTicks.length} / {windowSize} ticks{connectionError && <span className='dcircles__error'> · {connectionError}</span>}</div></div>
            {showLegend && <div className='dcircles__legend'><h3>DCircles Bar Analysis</h3><p className='dcircles__legend-intro'>The bar colour identifies the digit's position in the current selected tick sample.</p>{(['most','second-most','second-least','least'] as RankTone[]).map(tone => { const [colour, meaning] = rankDescription(tone); const item = ranking.find(value => value.rankTone === tone); return <div className={`dcircles__legend-row dcircles__legend-row--${tone}`} key={tone}><span className='dcircles__legend-bar' /><div><strong>{colour}</strong><span>{meaning}{item ? ` — Digit ${item.digit} (${item.percentage.toFixed(2)}%, ${item.count} appearances)` : ''}</span></div></div>; })}</div>}
        </>}
    </section>;
};

export default AnalysisTool;
