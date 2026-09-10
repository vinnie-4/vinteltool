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

const TICK_WINDOWS = [1000, 500, 300, 100, 50];
const MAX_TICKS = 1000;
const WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

const getLastDigit = (quote: number, pipSize = 2) => {
    const decimals = Math.max(0, Math.min(8, Number(pipSize) || 2));
    return Number(quote.toFixed(decimals).replace('.', '').slice(-1));
};
const formatPrice = (quote: number | null, pipSize: number) => quote === null ? '—' : quote.toFixed(Math.max(0, Math.min(8, Number(pipSize) || 2)));
const digitClass = (digit: number) => `dcircles__digit dcircles__digit--${digit}`;

const AnalysisTool = () => {
    const [activeTab, setActiveTab] = useState<AnalysisTab>('dcircles');
    const [selectedIndex, setSelectedIndex] = useState(VOLATILITY_INDICES.find(([name]) => name === 'Volatility 100')?.[0] || VOLATILITY_INDICES[0][0]);
    const [windowSize, setWindowSize] = useState(1000);
    const [prediction, setPrediction] = useState(0);
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
        setConnected(false);
        setConnectionError('');
        if (reconnectRef.current) {
            window.clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
        }

        const previous = wsRef.current;
        wsRef.current = null;
        if (previous) {
            previous.onopen = null;
            previous.onmessage = null;
            previous.onerror = null;
            previous.onclose = null;
            previous.close();
        }

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            if (stoppedRef.current || connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            setConnected(true);
            setConnectionError('');
            ws.send(JSON.stringify({
                ticks: selectedSymbol,
                subscribe: 1,
                req_id: 1,
            }));
        };

        ws.onmessage = event => {
            if (connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            try {
                const data = JSON.parse(event.data);
                if (data.error) {
                    setConnected(false);
                    setConnectionError(data.error.message || 'Deriv tick stream error');
                    return;
                }

                const receivedPipSize = Number(data.pip_size ?? data.tick?.pip_size);
                if (Number.isFinite(receivedPipSize) && receivedPipSize >= 0) {
                    pipSizeRef.current = receivedPipSize;
                    setPipSize(receivedPipSize);
                }
                const decimals = Number.isFinite(receivedPipSize) && receivedPipSize >= 0 ? receivedPipSize : pipSizeRef.current;

                if (data.msg_type === 'tick' && data.tick?.quote !== undefined) {
                    const quote = Number(data.tick.quote);
                    if (!Number.isFinite(quote)) return;
                    const digit = getLastDigit(quote, decimals);
                    setLatestPrice(quote);
                    setLatestDigit(digit);
                    setTicks(previous => [...previous, { quote, digit }].slice(-MAX_TICKS));
                    setConnected(true);
                    setConnectionError('');
                }
            } catch {
                setConnected(false);
                setConnectionError('Invalid response received from Deriv');
            }
        };

        ws.onclose = event => {
            if (connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            wsRef.current = null;
            setConnected(false);
            if (!stoppedRef.current) {
                const detail = event.reason || `WebSocket closed (${event.code})`;
                setConnectionError(detail);
                reconnectRef.current = window.setTimeout(() => {
                    if (!stoppedRef.current && connectionId === connectionIdRef.current) connect();
                }, 2500);
            }
        };
        ws.onerror = () => {
            if (connectionId !== connectionIdRef.current || wsRef.current !== ws) return;
            setConnected(false);
            setConnectionError('Unable to open Deriv public WebSocket');
        };
    }, [selectedSymbol]);

    useEffect(() => {
        setTicks([]); setLatestDigit(null); setLatestPrice(null); setPipSize(2); pipSizeRef.current = 2;
        connect();
        return () => {
            stoppedRef.current = true;
            ++connectionIdRef.current;
            if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws) {
                ws.onopen = null;
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                ws.close();
            }
        };
    }, [connect]);

    const analysisTicks = useMemo(() => ticks.slice(-windowSize), [ticks, windowSize]);
    const stats = useMemo(() => {
        const counts = DIGITS.map(digit => analysisTicks.filter(tick => tick.digit === digit).length);
        const total = counts.reduce((sum, count) => sum + count, 0);
        const ranked = DIGITS.map((digit, index) => ({ digit, count: counts[index] })).sort((a, b) => b.count - a.count || a.digit - b.digit);
        const tones = new Map<number, RankTone>();
        if (total) {
            tones.set(ranked[0].digit, 'most');
            tones.set(ranked[1].digit, 'second-most');
            tones.set(ranked[8].digit, 'second-least');
            tones.set(ranked[9].digit, 'least');
        }
        return DIGITS.map((digit, index) => ({ digit, count: counts[index], percentage: total ? counts[index] / total * 100 : 0, rankTone: tones.get(digit) || 'normal' as RankTone }));
    }, [analysisTicks]);

    const distribution = useMemo(() => {
        const total = analysisTicks.length;
        const matches = stats[prediction]?.count || 0;
        const overZero = stats.slice(1).reduce((sum, item) => sum + item.count, 0); // digits 1–9
        const underNine = stats.slice(0, 9).reduce((sum, item) => sum + item.count, 0); // digits 0–8
        const even = stats.filter(item => item.digit % 2 === 0).reduce((sum, item) => sum + item.count, 0);
        return {
            overZero: total ? overZero / total * 100 : 0,
            underNine: total ? underNine / total * 100 : 0,
            matches: total ? matches / total * 100 : 0,
            differs: total ? (total - matches) / total * 100 : 0,
            even: total ? even / total * 100 : 0,
            odd: total ? (total - even) / total * 100 : 0,
            streakType: latestDigit === null ? '—' : latestDigit % 2 === 0 ? 'Even' : 'Odd',
        };
    }, [analysisTicks, latestDigit, prediction, stats]);

    const renderDistributionCard = (label: string, value: number, tone: 'green' | 'red' | 'blue' | 'orange') => (
        <div className={`dcircles__distribution-card dcircles__distribution-card--${tone}`}>
            <div className='dcircles__distribution-icon' aria-hidden='true' /><strong>{label}</strong><b>{value.toFixed(1)}%</b>
            <div className='dcircles__distribution-bar'><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
        </div>
    );

    return <section className='dcircles'>
        <div className='dcircles__subtabs' role='tablist'>
            <button type='button' className={activeTab === 'dcircles' ? 'is-active' : ''} onClick={() => setActiveTab('dcircles')}>DCircles</button>
            <button type='button' className={activeTab === 'ldp' ? 'is-active' : ''} onClick={() => setActiveTab('ldp')}>LDP Analyzer</button>
        </div>
        {activeTab === 'ldp' ? <div className='dcircles__placeholder'><h2>Last Digit Probability Analyzer</h2><p>Choose DCircles for the live Deriv digit distribution view.</p><button type='button' onClick={() => setActiveTab('dcircles')}>Open DCircles</button></div> : <>
            <div className='dcircles__controls'>
                <label>Market<select value={selectedIndex} onChange={event => setSelectedIndex(event.target.value)}>{VOLATILITY_INDICES.map(([name]) => <option key={name}>{name}</option>)}</select></label>
                <label>Ticks<select value={windowSize} onChange={event => setWindowSize(Number(event.target.value))}>{TICK_WINDOWS.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
                <div className='dcircles__price'><span>Price</span><strong>{formatPrice(latestPrice, pipSize)}</strong></div>
            </div>
            <div className='dcircles__circle-panel'>
                <div className='dcircles__circles'>
                    {stats.map(item => <div className={`${digitClass(item.digit)} dcircles__digit--rank-${item.rankTone}`} key={item.digit}>
                        <div className='dcircles__circle'><span>{item.digit}</span>{item.digit === latestDigit && <i className='dcircles__pointer'>▲</i>}</div>
                        <b>{item.percentage.toFixed(2)}%</b><div className='dcircles__digit-bar'><span /></div>
                    </div>)}
                </div>
                <div className='dcircles__status'>{connected ? '● Live · Deriv' : '○ Connecting to Deriv…'} · {analysisTicks.length} / {windowSize} ticks{connectionError && <span className='dcircles__error'> · {connectionError}</span>}</div>
            </div>
            <div className='dcircles__section'><div className='dcircles__section-heading'><span className='dcircles__section-icon'>◧</span><strong>Over/Under 0/9</strong><small>Current digit {latestDigit ?? '—'}</small></div><div className='dcircles__cards'>{renderDistributionCard('Over 0', distribution.overZero, 'green')}{renderDistributionCard('Under 9', distribution.underNine, 'red')}</div></div>
            <div className='dcircles__section'><div className='dcircles__section-heading'><span className='dcircles__section-icon dcircles__section-icon--blue'>▣</span><strong>Matches/Differs Analysis</strong><label>Prediction<select value={prediction} onChange={event => setPrediction(Number(event.target.value))}>{DIGITS.map(digit => <option key={digit}>{digit}</option>)}</select></label><small>Current digit {latestDigit ?? '—'}</small></div><div className='dcircles__cards'>{renderDistributionCard(`Matches ${prediction}`, distribution.matches, 'blue')}{renderDistributionCard(`Differs ${prediction}`, distribution.differs, 'orange')}</div></div>
            <div className='dcircles__section'><div className='dcircles__section-heading'><span className='dcircles__section-icon dcircles__section-icon--purple'>✣</span><strong>Even/Odd Analysis</strong><small>Current streak: {distribution.streakType}</small></div><div className='dcircles__cards'>{renderDistributionCard('Even', distribution.even, 'blue')}{renderDistributionCard('Odd', distribution.odd, 'orange')}</div></div>
        </>}
    </section>;
};

export default AnalysisTool;
