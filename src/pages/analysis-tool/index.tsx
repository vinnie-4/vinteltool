import React, { useEffect, useMemo, useRef, useState } from 'react';
import './styles.scss';

const DIGITS = Array.from({ length: 10 }, (_, i) => i);
const VOLATILITY_INDICES = [
    'Volatility 10', 'Volatility 10 (1s)', 'Volatility 15 (1s)', 'Volatility 25', 'Volatility 25 (1s)',
    'Volatility 30 (1s)', 'Volatility 50', 'Volatility 50 (1s)', 'Volatility 75', 'Volatility 75 (1s)',
    'Volatility 90 (1s)', 'Volatility 100', 'Volatility 100 (1s)',
];

const SYMBOLS: Record<string, string> = {
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

const WINDOW_SIZE = 500;
const DEFAULT_APP_ID = '1089';

const getLastDigit = (quote: number | string) => {
    const text = String(quote);
    const decimal = text.split('.')[1];
    return Number((decimal || text).slice(-1));
};

const AnalysisTool = () => {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(VOLATILITY_INDICES[0]);
    const [digits, setDigits] = useState<number[]>([]);
    const [latestDigit, setLatestDigit] = useState<number | null>(null);
    const [connection, setConnection] = useState<'connecting' | 'live' | 'offline'>('connecting');
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sequenceRef = useRef<number[]>([]);
    const requestIdRef = useRef(1);

    const appId = (typeof window !== 'undefined' && (window as any).__DERIV_APP_ID__) ||
        (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DERIV_APP_ID) || DEFAULT_APP_ID;

    useEffect(() => {
        let disposed = false;

        const connect = () => {
            if (disposed) return;
            setConnection('connecting');
            const socket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`);
            socketRef.current = socket;

            socket.onopen = () => {
                if (disposed) return;
                setConnection('live');
                const symbol = SYMBOLS[selectedIndex];
                const historyId = requestIdRef.current++;
                socket.send(JSON.stringify({
                    ticks_history: symbol,
                    adjust_start_time: 1,
                    count: WINDOW_SIZE,
                    end: 'latest',
                    start: 1,
                    style: 'ticks',
                    req_id: historyId,
                }));
                socket.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: requestIdRef.current++ }));
            };

            socket.onmessage = event => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.error) return;

                    if (data.history?.prices) {
                        const historyDigits = data.history.prices.map((quote: number | string) => getLastDigit(quote));
                        sequenceRef.current = historyDigits.slice(-WINDOW_SIZE);
                        setDigits(sequenceRef.current);
                        const last = sequenceRef.current[sequenceRef.current.length - 1];
                        if (last !== undefined) setLatestDigit(last);
                    }

                    if (data.tick?.quote !== undefined) {
                        const digit = getLastDigit(data.tick.quote);
                        sequenceRef.current = [...sequenceRef.current, digit].slice(-WINDOW_SIZE);
                        setDigits(sequenceRef.current);
                        setLatestDigit(digit);
                    }
                } catch {
                    // Ignore malformed socket frames without affecting the rest of the app.
                }
            };

            socket.onerror = () => {
                if (!disposed) setConnection('offline');
            };

            socket.onclose = () => {
                if (socketRef.current === socket) socketRef.current = null;
                if (!disposed) {
                    setConnection('offline');
                    reconnectRef.current = setTimeout(connect, 2500);
                }
            };
        };

        sequenceRef.current = [];
        setDigits([]);
        setLatestDigit(null);
        connect();

        return () => {
            disposed = true;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
            const socket = socketRef.current;
            socketRef.current = null;
            if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        };
    }, [selectedIndex, appId]);

    const stats = useMemo(() => {
        const counts = DIGITS.map(digit => ({ digit, count: digits.filter(value => value === digit).length }));
        const total = counts.reduce((sum, item) => sum + item.count, 0);
        const max = Math.max(...counts.map(item => item.count), 0);
        const min = Math.min(...counts.map(item => item.count), 0);
        return counts.map(item => ({
            ...item,
            percentage: total ? (item.count / total) * 100 : 0,
            rankPercentage: max ? (item.count / max) * 100 : 0,
            isMost: total > 0 && item.count === max,
            isLeast: total > 0 && item.count === min,
        }));
    }, [digits]);

    return (
        <section className='lda'>
            <header className='lda__header'>
                <div>
                    <h2>🎯 Last Digit Analysis (LDA)</h2>
                    <p>Live analysis of the last digit appearing on each Deriv tick.</p>
                </div>
                <div>
                    <select value={selectedIndex} onChange={event => setSelectedIndex(event.target.value)}>
                        {VOLATILITY_INDICES.map(index => <option key={index}>{index}</option>)}
                    </select>
                    <small style={{ display: 'block', marginTop: 6 }}>
                        {connection === 'live' ? '🟢 Live' : connection === 'connecting' ? '🟡 Connecting…' : '🔴 Offline — reconnecting…'}
                    </small>
                </div>
            </header>

            <div className='lda__latest'>
                <span>Latest last digit</span>
                <strong>{latestDigit ?? '—'}{latestDigit !== null && <i className='lda__pointer' aria-hidden='true'>➤</i>}</strong>
                <small>{digits.length ? `${digits.length} live observations in the analysis window.` : 'Waiting for live ticks…'}</small>
            </div>

            <div className='lda__circles' aria-label={`${selectedIndex} live last digit analysis`}>
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
                <span>➤ = latest live digit</span>
            </div>

            <div className='lda__sections'>
                {[
                    ['frequency', '📊 Digit frequency', 'Live tick observations are counted for digits 0–9. The analysis window keeps the latest 500 observations.'],
                    ['distribution', '⚖️ Percentage distribution', 'Each percentage is calculated from the observed live ticks in the current window.'],
                    ['sequence', '🔢 Recent sequence', `The selected ${selectedIndex} stream updates automatically as new ticks arrive.`],
                    ['note', '⚠️ Important note', 'Frequency describes observed data only. A frequent or rare digit does not guarantee what the next tick will be.'],
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
