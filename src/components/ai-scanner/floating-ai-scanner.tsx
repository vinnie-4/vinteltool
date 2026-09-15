import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './floating-ai-scanner.scss';

type Tick = { quote: number; digit: number };
type Signal = 'Even' | 'Odd' | 'Over 4' | 'Under 5' | 'Waiting';
type Market = { name: string; symbol: string };

const MARKETS: Market[] = [
    { name: 'Volatility 10', symbol: 'R_10' }, { name: 'Volatility 10 (1s)', symbol: '1HZ10V' },
    { name: 'Volatility 15 (1s)', symbol: '1HZ15V' }, { name: 'Volatility 25', symbol: 'R_25' },
    { name: 'Volatility 25 (1s)', symbol: '1HZ25V' }, { name: 'Volatility 30 (1s)', symbol: '1HZ30V' },
    { name: 'Volatility 50', symbol: 'R_50' }, { name: 'Volatility 50 (1s)', symbol: '1HZ50V' },
    { name: 'Volatility 75', symbol: 'R_75' }, { name: 'Volatility 75 (1s)', symbol: '1HZ75V' },
    { name: 'Volatility 90 (1s)', symbol: '1HZ90V' }, { name: 'Volatility 100', symbol: 'R_100' },
    { name: 'Volatility 100 (1s)', symbol: '1HZ100V' },
];
const TICK_WINDOWS = [1000, 500, 300, 100, 60, 30];
const digitOf = (quote: number, decimals: number) => Number(quote.toFixed(Math.max(0, Math.min(8, decimals))).replace('.', '').slice(-1));

const FloatingAIScanner = () => {
    const [open, setOpen] = useState(false);
    const [market, setMarket] = useState(MARKETS[11]);
    const [tickWindow, setTickWindow] = useState(100);
    const [ticks, setTicks] = useState<Tick[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState('');
    const [confidence, setConfidence] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });
    const movedRef = useRef(false);
    const subscriptionRef = useRef<string | null>(null);
    const listenerRef = useRef<any>(null);
    const decimalsRef = useRef(2);
    const requestIdRef = useRef(10000);

    const disconnect = useCallback(async () => {
        if (subscriptionRef.current && api_base.api) {
            try { await api_base.api.forget(subscriptionRef.current); } catch { /* shared connection */ }
        }
        subscriptionRef.current = null;
        listenerRef.current?.unsubscribe?.();
        listenerRef.current = null;
    }, []);

    const connect = useCallback(async () => {
        await disconnect();
        if (!api_base.api) { setConnected(false); setError('Deriv connection is not ready'); return; }
        setError('');
        setConnected(false);
        const historyReqId = ++requestIdRef.current;
        const tickReqId = ++requestIdRef.current;
        const listener = api_base.api.onMessage().subscribe(({ data }: any) => {
            if (data?.error) { setConnected(false); setError(data.error.message || 'Deriv rejected the scanner request'); return; }
            const pipSize = Number(data?.pip_size ?? data?.tick?.pip_size);
            if (Number.isFinite(pipSize) && pipSize >= 0) decimalsRef.current = pipSize;
            if (data?.msg_type === 'history' && data?.echo_req?.req_id === historyReqId && Array.isArray(data.history?.prices)) {
                const history = data.history.prices.map(Number).filter(Number.isFinite).slice(-tickWindow).map((quote: number) => ({ quote, digit: digitOf(quote, decimalsRef.current) }));
                setTicks(history); setConnected(true);
            }
            if (data?.msg_type === 'tick' && data.tick?.symbol === market.symbol && data.tick?.quote !== undefined) {
                const quote = Number(data.tick.quote); if (!Number.isFinite(quote)) return;
                const digit = digitOf(quote, decimalsRef.current);
                setTicks(previous => [...previous, { quote, digit }].slice(-1000)); setConnected(true);
                if (data.tick.id) subscriptionRef.current = data.tick.id;
            }
            if (data?.subscription?.id && data?.echo_req?.req_id === tickReqId) subscriptionRef.current = data.subscription.id;
        });
        listenerRef.current = listener;
        try {
            await api_base.api.send({ ticks_history: market.symbol, count: 1000, end: 'latest', style: 'ticks', req_id: historyReqId });
            const response: any = await api_base.api.send({ ticks: market.symbol, subscribe: 1, req_id: tickReqId });
            if (response?.subscription?.id) subscriptionRef.current = response.subscription.id;
            setConnected(true);
        } catch (e: any) { setConnected(false); setError(e?.error?.message || 'Unable to connect scanner to Deriv'); }
    }, [disconnect, market.symbol, tickWindow]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const start = async () => {
            for (let attempt = 0; attempt < 8 && !cancelled && !api_base.api; attempt += 1) await new Promise(resolve => window.setTimeout(resolve, 500));
            if (!cancelled) void connect();
        };
        void start();
        return () => { cancelled = true; void disconnect(); };
    }, [open, connect, disconnect]);

    const beginDrag = useCallback((clientX: number, clientY: number) => {
        dragRef.current = { startX: clientX, startY: clientY, originX: position.x, originY: position.y };
        movedRef.current = false;
        setDragging(true);
    }, [position]);

    const handlePointerMove = useCallback((event: PointerEvent) => {
        if (!dragging) return;
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
        setPosition({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy });
    }, [dragging]);

    useEffect(() => {
        if (!dragging) return;
        const stop = () => setDragging(false);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
        return () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    }, [dragging, handlePointerMove]);

    const handleFabClick = useCallback(() => {
        if (movedRef.current) { movedRef.current = false; return; }
        setOpen(true);
    }, []);

    const analysis = useMemo(() => {
        const visibleTicks = ticks.slice(-tickWindow);
        const counts = Array(10).fill(0) as number[];
        visibleTicks.forEach(tick => { counts[tick.digit] += 1; });
        const ranked = counts.map((count, digit) => ({ digit, count })).sort((a, b) => b.count - a.count || a.digit - b.digit);
        const total = visibleTicks.length;
        const even = counts.filter((_, digit) => digit % 2 === 0).reduce((a, b) => a + b, 0);
        const over4 = counts.slice(5).reduce((a, b) => a + b, 0);
        const evenPct = total ? even / total * 100 : 0;
        const overPct = total ? over4 / total * 100 : 0;
        let signal: Signal = 'Waiting'; let strength = 'WAITING'; let score = 0;
        if (total >= 20) {
            if (evenPct >= 58) { signal = 'Even'; score = evenPct; } else if (evenPct <= 42) { signal = 'Odd'; score = 100 - evenPct; }
            else if (overPct >= 58) { signal = 'Over 4'; score = overPct; } else if (overPct <= 42) { signal = 'Under 5'; score = 100 - overPct; }
            else { signal = ranked[0].digit % 2 === 0 ? 'Even' : 'Odd'; score = Math.max(evenPct, 100 - evenPct); }
            strength = score >= 65 ? 'STRONG' : score >= 58 ? 'MEDIUM' : 'WEAK';
        }
        const confidenceValue = total >= 20 ? Math.round(Math.min(92, Math.max(50, 50 + Math.abs(score - 50) * 1.7))) : 0;
        return { counts, ranked, total, signal, strength, confidence: confidenceValue, hot: ranked[0]?.digit, cold: ranked.at(-1)?.digit };
    }, [ticks, tickWindow]);

    useEffect(() => setConfidence(analysis.confidence), [analysis.confidence]);
    const transform = { transform: `translate3d(${position.x}px, ${position.y}px, 0)` };

    return <>
        {open && <div className='ai-scanner__backdrop' onClick={() => setOpen(false)} aria-hidden='true' />}
        {open && <section className='ai-scanner__panel' style={transform} aria-label='AI Scanner'>
            <header className={`ai-scanner__header ${dragging ? 'is-dragging' : ''}`} onPointerDown={e => { e.stopPropagation(); beginDrag(e.clientX, e.clientY); }}>
                <div><span className='ai-scanner__spark'>✦</span><strong>AI SCANNER</strong><small>Live market signal scanner</small></div>
                <button type='button' onPointerDown={e => e.stopPropagation()} onClick={() => setOpen(false)} aria-label='Close scanner'>×</button>
            </header>
            <div className='ai-scanner__body' onPointerDown={e => e.stopPropagation()}>
                <div className='ai-scanner__selectors'>
                    <label className='ai-scanner__market'>MARKET<select value={market.symbol} onChange={e => setMarket(MARKETS.find(item => item.symbol === e.target.value) || MARKETS[11])}>{MARKETS.map(item => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}</select></label>
                    <label className='ai-scanner__ticks-control'>TICKS<select value={tickWindow} onChange={e => setTickWindow(Number(e.target.value))}>{TICK_WINDOWS.map(size => <option key={size} value={size}>Last {size}</option>)}</select></label>
                </div>
                <div className={`ai-scanner__status ${connected ? 'is-live' : ''}`}><span />{connected ? `LIVE • ${market.name} • LAST ${tickWindow}` : `CONNECTING • ${market.name}`}</div>
                <div className='ai-scanner__signal'><small>AI SIGNAL</small><strong>{analysis.signal}</strong><div className='ai-scanner__confidence'><span style={{ width: `${confidence}%` }} /></div><b>{confidence}% CONFIDENCE</b><em>{analysis.strength}</em></div>
                <div className='ai-scanner__stats'><div><small>HOT</small><strong>{analysis.hot ?? '—'}</strong></div><div><small>COLD</small><strong>{analysis.cold ?? '—'}</strong></div><div><small>TICKS</small><strong>{analysis.total}</strong></div></div>
                <div className='ai-scanner__digits'>{analysis.counts.map((count, digit) => <div key={digit} className={digit === analysis.hot ? 'is-hot' : digit === analysis.cold ? 'is-cold' : ''}><span>{digit}</span><b>{analysis.total ? ((count / analysis.total) * 100).toFixed(0) : 0}%</b></div>)}</div>
                <p className='ai-scanner__note'>Signal is calculated from recent observed ticks; it is not a guarantee of the next contract result.</p>
                {error && <p className='ai-scanner__error'>{error}</p>}
            </div>
        </section>}
        {!open && <div className={`floating-ai-container ${dragging ? 'is-dragging' : ''}`} style={transform} aria-label='AI Scanner' onPointerDown={e => { if (e.button === 0) beginDrag(e.clientX, e.clientY); }}>
            <span className='pulse-ring' aria-hidden='true' /><span className='pulse-ring' aria-hidden='true' />
            <button type='button' className='ai-fab-button' onClick={handleFabClick} aria-label='Open AI Scanner'><span className='ai-text'>AI</span></button>
        </div>}
    </>;
};

export default FloatingAIScanner;
