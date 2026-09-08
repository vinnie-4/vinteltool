import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.scss';

const DIGITS = Array.from({ length: 10 }, (_, i) => i);
const VOLATILITY_INDICES = [
    ['Volatility 10', 'R_10'], ['Volatility 10 (1s)', '1HZ10V'], ['Volatility 15 (1s)', '1HZ15V'],
    ['Volatility 25', 'R_25'], ['Volatility 25 (1s)', '1HZ25V'], ['Volatility 30 (1s)', '1HZ30V'],
    ['Volatility 50', 'R_50'], ['Volatility 50 (1s)', '1HZ50V'], ['Volatility 75', 'R_75'],
    ['Volatility 75 (1s)', '1HZ75V'], ['Volatility 90 (1s)', '1HZ90V'], ['Volatility 100', 'R_100'],
    ['Volatility 100 (1s)', '1HZ100V'],
] as const;

const ANALYSIS_WINDOWS = [500, 300, 100, 50, 10];
const WS_URL = 'wss://ws.derivws.com/websockets/v3';

const getLastDigit = (quote: number) => {
    const text = String(quote);
    const decimal = text.split('.')[1];
    return Number((decimal || text).slice(-1));
};

const AnalysisTool = () => {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(VOLATILITY_INDICES[0][0]);
    const [windowSize, setWindowSize] = useState(500);
    const [ticks, setTicks] = useState<number[]>([]);
    const [latestDigit, setLatestDigit] = useState<number | null>(null);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<number | null>(null);
    const selectedSymbol = VOLATILITY_INDICES.find(([name]) => name === selectedIndex)?.[1] || 'R_10';

    const connect = useCallback(() => {
        if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
        wsRef.current?.close();

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            ws.send(JSON.stringify({ ticks_history: selectedSymbol, count: 500, end: 'latest', style: 'ticks', subscribe: 1 }));
        };

        ws.onmessage = event => {
            try {
                const data = JSON.parse(event.data);
                if (data.error) return;
                if (Array.isArray(data.history?.prices)) {
                    const history = data.history.prices.map(Number).filter(Number.isFinite);
                    setTicks(history.slice(-500));
                    if (history.length) setLatestDigit(getLastDigit(history[history.length - 1]));
                }
                if (data.tick?.quote !== undefined) {
                    const quote = Number(data.tick.quote);
                    if (!Number.isFinite(quote)) return;
                    const digit = getLastDigit(quote);
                    setLatestDigit(digit);
                    setTicks(previous => [...previous, quote].slice(-500));
                }
            } catch {
                // Ignore malformed/non-data WebSocket messages.
            }
        };

        ws.onclose = () => {
            setConnected(false);
            reconnectRef.current = window.setTimeout(connect, 2500);
        };
        ws.onerror = () => setConnected(false);
    }, [selectedSymbol]);

    useEffect(() => {
        setTicks([]);
        setLatestDigit(null);
        connect();
        return () => {
            if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [connect]);

    const analysisTicks = useMemo(() => ticks.slice(-windowSize), [ticks, windowSize]);
    const stats = useMemo(() => {
        const counts = DIGITS.map(digit => ({ digit, count: analysisTicks.filter(quote => getLastDigit(quote) === digit).length }));
        const total = counts.reduce((sum, item) => sum + item.count, 0);
        const max = Math.max(0, ...counts.map(item => item.count));
        const min = total ? Math.min(...counts.map(item => item.count)) : 0;
        return counts.map(item => ({
            ...item,
            percentage: total ? (item.count / total) * 100 : 0,
            rankPercentage: max ? (item.count / max) * 100 : 0,
            isMost: total > 0 && item.count === max,
            isLeast: total > 0 && item.count === min,
        }));
    }, [analysisTicks]);

    return (
        <section className='lda'>
            <header className='lda__header'>
                <div>
                    <h2>🎯 Last Digit Analysis (LDA)</h2>
                    <p>Live analysis of the last digit appearing on each tick.</p>
                </div>
                <div>
                    <select value={selectedIndex} onChange={event => setSelectedIndex(event.target.value)}>
                        {VOLATILITY_INDICES.map(([name]) => <option key={name}>{name}</option>)}
                    </select>
                    <select value={windowSize} onChange={event => setWindowSize(Number(event.target.value))} aria-label='Analysis tick window'>
                        {ANALYSIS_WINDOWS.map(size => <option key={size} value={size}>Last {size} ticks</option>)}
                    </select>
                </div>
            </header>

            <div className='lda__latest'>
                <span>Latest last digit</span>
                <strong>{latestDigit ?? '—'}</strong>
                <small>{connected ? '● Live' : '○ Reconnecting…'} · Analysing {analysisTicks.length} / {windowSize} ticks</small>
            </div>

            <div className='lda__circles' aria-label={`${selectedIndex} last digit analysis`}>
                {stats.map(item => (
                    <div className={`lda__digit ${item.isMost ? 'lda__digit--most' : ''} ${item.isLeast ? 'lda__digit--least' : ''}`} key={item.digit}>
                        <div className='lda__circle'>
                            <span>{item.digit}</span>
                            {item.digit === latestDigit && <i className='lda__pointer' aria-label='Latest digit pointer'>➤</i>}
                        </div>
                        <b>{item.percentage.toFixed(1)}%</b>
                        <div className='lda__bar'><span style={{ width: `${item.rankPercentage}%` }} /></div>
                        <small>{item.count} appearances</small>
                    </div>
                ))}
            </div>

            <div className='lda__legend'>
                <span>🟢 Green = most appearing digit</span>
                <span>🔴 Red = least appearing digit</span>
                <span>➤ = latest digit</span>
            </div>

            <div className='lda__sections'>
                {[
                    ['frequency', '📊 Digit frequency', `Frequency calculated from the selected last ${windowSize} ticks.`],
                    ['distribution', '⚖️ Percentage distribution', `Each digit's percentage is calculated from the ${analysisTicks.length} ticks currently collected for this window.`],
                    ['sequence', '🔢 Recent sequence', 'The analyzer follows live digits in order and continuously keeps the latest 500 ticks available for analysis.'],
                    ['note', '⚠️ Important note', 'A frequent or rare digit does not guarantee what the next tick will be. This tool describes observed market data only.'],
                ].map(([key, title, description]) => (
                    <button type='button' className='lda__section' key={key} onClick={() => setExpanded(expanded === key ? null : key)}>
                        <span>{title}</span><em>{expanded === key ? '−' : '+'}</em>
                        {expanded === key && <p>{description}</p>}
                    </button>
                ))}
            </div>
        </section>
    );
};

export default AnalysisTool;
