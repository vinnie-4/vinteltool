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
const STRATEGIES = [
    { label: 'Over1 / Under8', description: 'Scans Over 1 and Under 8 with recovery confirmation.' },
    { label: 'Over2 / Under7', description: 'Scans Over 2 and Under 7 with recovery confirmation.' },
    { label: 'Over3 / Under6', description: 'Scans Over 3 and Under 6 with recovery confirmation.' },
];
const digitOf = (quote: number, decimals: number) => Number(quote.toFixed(Math.max(0, Math.min(8, decimals))).replace('.', '').slice(-1));

const FloatingAIScanner = () => {
    const [open, setOpen] = useState(false);
    const [market, setMarket] = useState(MARKETS[11]);
    const [tickWindow, setTickWindow] = useState(1000);
    const [marketExpanded, setMarketExpanded] = useState(false);
    const [ticksExpanded, setTicksExpanded] = useState(false);
    const [strategyIndex, setStrategyIndex] = useState(0);
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
        setError(''); setConnected(false);
        const historyReqId = ++requestIdRef.current;
        const tickReqId = ++requestIdRef.current;
        const listener = api_base.api.onMessage().subscribe(({ data }: any) => {
            if (data?.error) { setConnected(false); setError(data.error.message || 'Deriv rejected the scanner request'); return; }
            const pipSize = Number(data?.pip_size ?? data?.tick?.pip_size);
            if (Number.isFinite(pipSize) && pipSize >= 0) decimalsRef.current = pipSize;
            if (data?.msg_type === 'history' && data?.echo_req?.req_id === historyReqId && Array.isArray(data.history?.prices)) {
                const history = data.history.prices.map(Number).filter(Number.isFinite).slice(-1000).map((quote: number) => ({ quote, digit: digitOf(quote, decimalsRef.current) }));
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
    }, [disconnect, market.symbol]);

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
        movedRef.current = false; setDragging(true);
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
        window.addEventListener('pointermove', handlePointerMove); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
        return () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    }, [dragging, handlePointerMove]);

    const handleFabClick = useCallback(() => {
        if (movedRef.current) { movedRef.current = false; return; }
        setOpen(true);
    }, []);

    const analysis = useMemo(() => {
        const visibleTicks = ticks.slice(-tickWindow); const counts = Array(10).fill(0) as number[];
        visibleTicks.forEach(tick => { counts[tick.digit] += 1; });
        const ranked = counts.map((count, digit) => ({ digit, count })).sort((a, b) => b.count - a.count || a.digit - b.digit);
        const total = visibleTicks.length; const even = counts.filter((_, digit) => digit % 2 === 0).reduce((a, b) => a + b, 0); const over4 = counts.slice(5).reduce((a, b) => a + b, 0);
        const evenPct = total ? even / total * 100 : 0; const overPct = total ? over4 / total * 100 : 0;
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
    const selectedStrategy = STRATEGIES[strategyIndex];
    const transform = { transform: `translate3d(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px), 0)` };

    return <>
        {open && <div className='ai-scanner__backdrop' onClick={() => setOpen(false)} aria-hidden='true' />}
        {open && <section className='ai-scanner__panel' style={transform} aria-label='Entry Scanner'>
            <div className='entry-scanner__header'>
                <h2>Entry Scanner</h2>
                <button type='button' onClick={() => setOpen(false)} aria-label='Close scanner'>×</button>
            </div>
            <div className='entry-scanner__tabs'>
                {STRATEGIES.map((strategy, index) => <button key={strategy.label} type='button' className={index === strategyIndex ? 'is-active' : ''} onClick={() => setStrategyIndex(index)}>{strategy.label}</button>)}
            </div>
            <div className='entry-scanner__info'>
                <div><strong>Digits Scanner</strong><span>{selectedStrategy.description}</span></div>
                <div className='entry-scanner__ticks-badge'><small>TICKS</small><b>{tickWindow}</b></div>
            </div>
            <div className='entry-scanner__meta'>
                <div><small>Selected Market</small><strong>{connected ? market.name : 'Scan to find the best market'}</strong></div>
                <div><small>Trade Type</small><strong>{connected && analysis.signal !== 'Waiting' ? analysis.signal : 'Waiting for scan'}</strong></div>
            </div>
            <div className='entry-scanner__status'>{connected ? `Live ${market.name} scanner ready.` : `Ready to scan ${selectedStrategy.label}.`}</div>
            <div className='entry-scanner__actions'>
                <button type='button' className='entry-scanner__scan' onClick={() => void connect()}>Scan Markets</button>
                <button type='button' className='entry-scanner__load' onClick={() => setOpen(false)}>Load Scanner Bot</button>
            </div>
            <div className='entry-scanner__controls'>
                <div className='ai-scanner__accordion'>
                    <button type='button' className='ai-scanner__accordion-button' onClick={() => { setMarketExpanded(value => !value); setTicksExpanded(false); }} aria-expanded={marketExpanded}>
                        <span><small>MARKET</small><strong>{market.name}</strong></span><b>{marketExpanded ? '⌃' : '⌄'}</b>
                    </button>
                    {marketExpanded && <div className='ai-scanner__accordion-options'>{MARKETS.map(item => <button type='button' key={item.symbol} className={item.symbol === market.symbol ? 'is-selected' : ''} onClick={() => { setMarket(item); setMarketExpanded(false); }}>{item.name}</button>)}</div>}
                </div>
                <div className='ai-scanner__accordion'>
                    <button type='button' className='ai-scanner__accordion-button' onClick={() => { setTicksExpanded(value => !value); setMarketExpanded(false); }} aria-expanded={ticksExpanded}>
                        <span><small>TICKS</small><strong>{tickWindow}</strong></span><b>{ticksExpanded ? '⌃' : '⌄'}</b>
                    </button>
                    {ticksExpanded && <div className='ai-scanner__accordion-options'>{TICK_WINDOWS.map(size => <button type='button' key={size} className={size === tickWindow ? 'is-selected' : ''} onClick={() => { setTickWindow(size); setTicksExpanded(false); }}>{size}</button>)}</div>}
                </div>
            </div>
            {error && <p className='ai-scanner__error'>{error}</p>}
        </section>}
        {!open && <div className={`floating-ai-container ${dragging ? 'is-dragging' : ''}`} style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }} aria-label='AI Scanner' onPointerDown={e => { if (e.button === 0) beginDrag(e.clientX, e.clientY); }}>
            <div className='glow-halo' aria-hidden='true' />
            <button type='button' className='ai-button' onClick={handleFabClick} aria-label='Open AI Scanner'>
                <span className='reticle-frame' aria-hidden='true'><span className='bracket bracket-top-left' /><span className='bracket bracket-top-right' /><span className='bracket bracket-bottom-left' /><span className='bracket bracket-bottom-right' /><span className='ai-text'>AI</span></span>
                <span className='status-dot' aria-label='Online' />
            </button>
        </div>}
    </>;
};

export default FloatingAIScanner;
