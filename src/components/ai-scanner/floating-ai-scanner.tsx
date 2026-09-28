import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import martingaleXml from '@/xml/martingale.xml';
import './floating-ai-scanner.scss';

type Tick = { quote: number; digit: number };
type Signal = 'Even' | 'Odd' | 'Over 4' | 'Under 5' | 'Waiting';
type Market = { name: string; symbol: string };
type Analysis = {
    counts: number[];
    total: number;
    signal: Signal;
    confidence: number;
    strength: 'WAITING' | 'WEAK' | 'MEDIUM' | 'STRONG';
    hot: number | null;
    cold: number | null;
    evenPct: number;
    overPct: number;
    recentPressure: number;
    rationale: string;
};

const MARKETS: Market[] = [
    { name: 'Volatility 10', symbol: 'R_10' },
    { name: 'Volatility 10 (1s)', symbol: '1HZ10V' },
    { name: 'Volatility 25', symbol: 'R_25' },
    { name: 'Volatility 25 (1s)', symbol: '1HZ25V' },
    { name: 'Volatility 50', symbol: 'R_50' },
    { name: 'Volatility 50 (1s)', symbol: '1HZ50V' },
    { name: 'Volatility 75', symbol: 'R_75' },
    { name: 'Volatility 75 (1s)', symbol: '1HZ75V' },
    { name: 'Volatility 100', symbol: 'R_100' },
    { name: 'Volatility 100 (1s)', symbol: '1HZ100V' },
];

const TICK_WINDOWS = [3000, 1000, 500, 300, 100, 60, 30];
const DEFAULT_TICK_WINDOW = 3000;
const MAX_TICKS = 3000;

const digitOf = (quote: number, decimals: number) =>
    Number(quote.toFixed(Math.max(0, Math.min(8, decimals))).replace('.', '').slice(-1));

const emptyAnalysis = (): Analysis => ({
    counts: Array(10).fill(0),
    total: 0,
    signal: 'Waiting',
    confidence: 0,
    strength: 'WAITING',
    hot: null,
    cold: null,
    evenPct: 0,
    overPct: 0,
    recentPressure: 0,
    rationale: 'Waiting for enough live tick data.',
});

const analyseTicks = (ticks: Tick[], windowSize = DEFAULT_TICK_WINDOW): Analysis => {
    const values = ticks.slice(-Math.min(MAX_TICKS, Math.max(30, windowSize)));
    const counts = Array(10).fill(0) as number[];
    values.forEach(tick => {
        if (tick.digit >= 0 && tick.digit <= 9) counts[tick.digit] += 1;
    });

    const total = values.length;
    if (total < 20) return { ...emptyAnalysis(), counts, total };

    const even = counts.filter((_, digit) => digit % 2 === 0).reduce((a, b) => a + b, 0);
    const over4 = counts.slice(5).reduce((a, b) => a + b, 0);
    const evenPct = (even / total) * 100;
    const overPct = (over4 / total) * 100;

    const recent = values.slice(-20);
    const recentEvenPct = (recent.filter(tick => tick.digit % 2 === 0).length / recent.length) * 100;
    const recentOverPct = (recent.filter(tick => tick.digit >= 5).length / recent.length) * 100;
    const recentParityPressure = Math.abs(recentEvenPct - 50);
    const recentOverPressure = Math.abs(recentOverPct - 50);

    const ranked = counts
        .map((count, digit) => ({ count, digit }))
        .sort((a, b) => b.count - a.count || a.digit - b.digit);
    const hot = ranked[0]?.digit ?? null;
    const cold = ranked[ranked.length - 1]?.digit ?? null;

    const parityEdge = Math.abs(evenPct - 50);
    const overEdge = Math.abs(overPct - 50);
    const recentEdge = Math.max(recentParityPressure, recentOverPressure);
    const hotEdge = hot === null ? 0 : Math.abs((counts[hot] / total) * 100 - 10);
    const score = Math.min(42, parityEdge * 0.65 + overEdge * 0.35 + recentEdge * 0.45 + hotEdge * 0.2);
    const confidence = Math.round(Math.min(92, 50 + score));

    const candidates: Array<{ signal: Signal; edge: number; reason: string }> = [
        {
            signal: evenPct >= 50 ? 'Even' : 'Odd',
            edge: parityEdge,
            reason: evenPct >= 50 ? 'Even digits have higher observed frequency.' : 'Odd digits have higher observed frequency.',
        },
        {
            signal: overPct >= 50 ? 'Over 4' : 'Under 5',
            edge: overEdge,
            reason: overPct >= 50 ? 'Digits 5–9 have higher observed frequency.' : 'Digits 0–4 have higher observed frequency.',
        },
    ];

    const best = candidates.sort((a, b) => b.edge - a.edge)[0];
    let signal = best.signal;
    let rationale = best.reason;

    if (recentEdge >= best.edge + 3) {
        signal = recentParityPressure >= recentOverPressure
            ? (recentEvenPct >= 50 ? 'Even' : 'Odd')
            : (recentOverPct >= 50 ? 'Over 4' : 'Under 5');
        rationale = 'Recent 20-tick pressure is stronger than the full-window bias.';
    }

    const strength = confidence >= 75 ? 'STRONG' : confidence >= 62 ? 'MEDIUM' : 'WEAK';

    return {
        counts,
        total,
        signal,
        confidence,
        strength,
        hot,
        cold,
        evenPct,
        overPct,
        recentPressure: Math.round(recentEdge),
        rationale,
    };
};

const scannerXml = (market: Market, signal: Signal) => {
    const isEvenOdd = signal === 'Even' || signal === 'Odd';
    const contract = signal === 'Even' ? 'DIGITEVEN' : signal === 'Odd' ? 'DIGITODD' : signal === 'Over 4' ? 'DIGITOVER' : 'DIGITUNDER';
    const tradeType = isEvenOdd ? 'evenodd' : 'overunder';
    const prediction = signal === 'Over 4' ? 4 : signal === 'Under 5' ? 5 : 0;

    const doc = new DOMParser().parseFromString(martingaleXml, 'text/xml');
    const field = (name: string, value: string, previous?: string) => {
        const nodes = Array.from(doc.querySelectorAll(`field[name="${name}"]`));
        const node = previous ? nodes.find(item => item.textContent === previous) : nodes[0];
        if (node) node.textContent = value;
    };

    field('MARKET_LIST', 'synthetic_index', 'basket_index');
    field('SUBMARKET_LIST', 'random_index', 'forex_basket');
    field('SYMBOL_LIST', market.symbol, 'WLDAUD');
    field('TRADETYPECAT_LIST', 'digits', 'callput');
    field('TRADETYPE_LIST', tradeType, 'callput');
    field('TYPE_LIST', contract, 'both');
    field('DURATIONTYPE_LIST', 't', 'm');
    field('PURCHASE_LIST', contract, 'CALL');

    const duration = doc.querySelector('block[type="trade_definition_tradeoptions"] value[name="DURATION"] field[name="NUM"]');
    if (duration) duration.textContent = '1';

    const predictionMutation = doc.querySelector('block[type="trade_definition_tradeoptions"] > mutation');
    if (predictionMutation) predictionMutation.setAttribute('has_prediction', isEvenOdd ? 'false' : 'true');

    const tradeOptions = doc.querySelector('block[type="trade_definition_tradeoptions"]');
    if (tradeOptions) {
        const predictionValue = tradeOptions.querySelector('value[name="PREDICTION"]');
        if (isEvenOdd) {
            predictionValue?.remove();
        } else if (predictionValue) {
            const num = predictionValue.querySelector('field[name="NUM"]');
            if (num) num.textContent = String(prediction);
        }

        if (!isEvenOdd && !predictionValue) {
            const value = doc.createElement('value');
            value.setAttribute('name', 'PREDICTION');
            const shadow = doc.createElement('shadow');
            shadow.setAttribute('type', 'math_number_positive');
            const num = doc.createElement('field');
            num.setAttribute('name', 'NUM');
            num.textContent = String(prediction);
            shadow.appendChild(num);
            value.appendChild(shadow);
            tradeOptions.appendChild(value);
        }
    }

    const initialization = doc.querySelector('statement[name="INITIALIZATION"]');
    if (initialization) {
        const initialStakeSet = Array.from(initialization.querySelectorAll('block[type="variables_set"]'))
            .find(block => block.querySelector('field[name="VAR"]')?.textContent === 'martingale:initialStake');
        const initialStakeNum = initialStakeSet?.querySelector('value[name="VALUE"] field[name="NUM"]');
        if (initialStakeNum) initialStakeNum.textContent = '1';

        const multiplierSet = Array.from(initialization.querySelectorAll('block[type="variables_set"]'))
            .find(block => block.querySelector('field[name="VAR"]')?.textContent === 'martingale:multiplier');
        const multiplierNum = multiplierSet?.querySelector('value[name="VALUE"] field[name="NUM"]');
        if (multiplierNum) multiplierNum.textContent = '2';
    }

    return new XMLSerializer().serializeToString(doc);
};

const FloatingAIScanner = () => {
    const { quick_strategy, dashboard } = useStore();
    const [open, setOpen] = useState(false);
    const [market, setMarket] = useState(MARKETS[8]);
    const [tickWindow, setTickWindow] = useState(DEFAULT_TICK_WINDOW);
    const [ticks, setTicks] = useState<Tick[]>([]);
    const [connected, setConnected] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanMessage, setScanMessage] = useState('');
    const [error, setError] = useState('');
    const [confidence, setConfidence] = useState(0);
    const subscriptionRef = useRef<string | null>(null);
    const listenerRef = useRef<any>(null);
    const decimalsRef = useRef(2);
    const requestIdRef = useRef(10000);

    const disconnect = useCallback(async () => {
        if (subscriptionRef.current && api_base.api) {
            try { await api_base.api.forget(subscriptionRef.current); } catch { /* subscription may already be closed */ }
        }
        subscriptionRef.current = null;
        listenerRef.current?.unsubscribe?.();
        listenerRef.current = null;
    }, []);

    const connectMarket = useCallback(async (symbol: string) => {
        await disconnect();
        if (!api_base.api) {
            setConnected(false);
            setError('Deriv connection is not ready');
            return;
        }

        const historyReqId = ++requestIdRef.current;
        const tickReqId = ++requestIdRef.current;
        setError('');

        const listener = api_base.api.onMessage().subscribe(({ data }: any) => {
            if (data?.error) {
                setConnected(false);
                setError(data.error.message || 'Deriv rejected the scanner request');
                return;
            }

            const pipSize = Number(data?.pip_size ?? data?.tick?.pip_size);
            if (Number.isFinite(pipSize) && pipSize >= 0) decimalsRef.current = pipSize;

            if (data?.msg_type === 'history' && data?.echo_req?.req_id === historyReqId && Array.isArray(data.history?.prices)) {
                const history = data.history.prices.map(Number).filter(Number.isFinite).slice(-MAX_TICKS).map((quote: number) => ({
                    quote,
                    digit: digitOf(quote, decimalsRef.current),
                }));
                setTicks(history);
                setConnected(true);
            }

            if (data?.msg_type === 'tick' && data.tick?.symbol === symbol && data.tick?.quote !== undefined) {
                const quote = Number(data.tick.quote);
                if (!Number.isFinite(quote)) return;
                setTicks(previous => [...previous, { quote, digit: digitOf(quote, decimalsRef.current) }].slice(-MAX_TICKS));
                setConnected(true);
                if (data.tick.id) subscriptionRef.current = data.tick.id;
            }

            if (data?.subscription?.id && data?.echo_req?.req_id === tickReqId) {
                subscriptionRef.current = data.subscription.id;
            }
        });

        listenerRef.current = listener;

        try {
            await api_base.api.send({ ticks_history: symbol, count: MAX_TICKS, end: 'latest', style: 'ticks', req_id: historyReqId });
            const response: any = await api_base.api.send({ ticks: symbol, subscribe: 1, req_id: tickReqId });
            if (response?.subscription?.id) subscriptionRef.current = response.subscription.id;
            setConnected(true);
        } catch (e: any) {
            setConnected(false);
            setError(e?.error?.message || 'Unable to connect scanner to Deriv');
        }
    }, [disconnect]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const start = async () => {
            for (let attempt = 0; attempt < 8 && !cancelled && !api_base.api; attempt += 1) {
                await new Promise(resolve => window.setTimeout(resolve, 500));
            }
            if (!cancelled) void connectMarket(market.symbol);
        };
        void start();
        return () => { cancelled = true; void disconnect(); };
    }, [open, market.symbol, connectMarket, disconnect]);

    const analysis = useMemo(() => analyseTicks(ticks, tickWindow), [ticks, tickWindow]);

    useEffect(() => setConfidence(analysis.confidence), [analysis.confidence]);

    const scanMarkets = useCallback(async () => {
        if (!api_base.api) {
            setError('Deriv connection is not ready');
            return;
        }

        setScanning(true);
        setError('');
        setConnected(false);
        setScanMessage('Scanning volatility markets…');
        await disconnect();

        const results: Array<{ market: Market; ticks: Tick[]; analysis: Analysis }> = [];

        try {
            for (let index = 0; index < MARKETS.length; index += 1) {
                const item = MARKETS[index];
                setScanMessage('Scanning ' + (index + 1) + '/' + MARKETS.length + ' • ' + item.name);
                const response: any = await api_base.api.send({
                    ticks_history: item.symbol,
                    count: MAX_TICKS,
                    end: 'latest',
                    style: 'ticks',
                    req_id: ++requestIdRef.current,
                });

                if (response?.error || !Array.isArray(response?.history?.prices)) continue;

                const decimals = Number(response?.pip_size);
                const precision = Number.isFinite(decimals) && decimals >= 0 ? decimals : 2;
                const history = response.history.prices.map(Number).filter(Number.isFinite).slice(-MAX_TICKS).map((quote: number) => ({
                    quote,
                    digit: digitOf(quote, precision),
                }));

                if (history.length < 20) continue;
                results.push({ market: item, ticks: history, analysis: analyseTicks(history, tickWindow) });
            }

            if (!results.length) throw new Error('No usable tick history was returned by Deriv.');

            results.sort((a, b) => b.analysis.confidence - a.analysis.confidence);
            const winner = results[0];
            setMarket(winner.market);
            setTicks(winner.ticks);
            setScanMessage(winner.market.name + ' • ' + winner.analysis.signal + ' • ' + winner.analysis.confidence + '% heuristic confidence');
            await connectMarket(winner.market.symbol);
        } catch (e: any) {
            setError(e?.message || 'Unable to scan the volatility markets');
            setScanMessage('Market scan failed');
        } finally {
            setScanning(false);
        }
    }, [disconnect, connectMarket]);

    const loadScannerBot = useCallback(async () => {
        if (analysis.signal === 'Waiting') {
            setError('Collecting more ticks before loading a scanner bot.');
            return;
        }

        const xml = scannerXml(market, analysis.signal);
        setOpen(false);
        dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
        await new Promise<void>(resolve => window.setTimeout(resolve, 80));
        await quick_strategy.loadFreeBotXml(xml, 'AI Scanner • ' + market.name + ' • ' + analysis.signal);
    }, [analysis.signal, dashboard, market, quick_strategy]);

    return <>
        {open && <div className='ai-scanner__backdrop' onClick={() => setOpen(false)} aria-hidden='true' />}

        {open && <section className='ai-scanner__panel' aria-label='AI Scanner'>
            <header className='ai-scanner__header'>
                <div>
                    <span className='ai-scanner__spark'>✦</span>
                    <strong>AI SCANNER</strong>
                    <small>Live Deriv Options signal scanner</small>
                </div>
                <button type='button' onClick={() => setOpen(false)} aria-label='Close scanner'>×</button>
            </header>

            <div className='ai-scanner__body'>
                <label className='ai-scanner__market'>
                    MARKET
                    <select value={market.symbol} onChange={e => setMarket(MARKETS.find(item => item.symbol === e.target.value) || MARKETS[8])}>
                        {MARKETS.map(item => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}
                    </select>
                </label>

                <div className='ai-scanner__controls-row'>
                    <label>WINDOW
                        <select value={tickWindow} onChange={e => setTickWindow(Number(e.target.value))}>
                            {TICK_WINDOWS.map(value => <option key={value} value={value}>{value} ticks</option>)}
                        </select>
                    </label>
                    <button type='button' className='ai-scanner__scan-button' disabled={scanning} onClick={() => void scanMarkets()}>
                        {scanning ? 'SCANNING…' : 'SCAN MARKETS'}
                    </button>
                </div>

                <div className={'ai-scanner__status ' + (connected ? 'is-live' : '')}>
                    <span />{scanning ? scanMessage : connected ? 'LIVE SCANNING' : 'CONNECTING TO DERIV'}
                </div>

                <div className='ai-scanner__signal'>
                    <small>AI SIGNAL</small>
                    <strong>{analysis.signal}</strong>
                    <div className='ai-scanner__confidence'><span style={{ width: confidence + '%' }} /></div>
                    <b>{confidence}% HEURISTIC CONFIDENCE</b>
                    <em>{analysis.strength}</em>
                </div>

                <div className='ai-scanner__stats'>
                    <div><small>HOT</small><strong>{analysis.hot ?? '—'}</strong></div>
                    <div><small>COLD</small><strong>{analysis.cold ?? '—'}</strong></div>
                    <div><small>TICKS</small><strong>{analysis.total}</strong></div>
                </div>

                <div className='ai-scanner__stats ai-scanner__stats--secondary'>
                    <div><small>EVEN</small><strong>{analysis.total ? analysis.evenPct.toFixed(1) : '—'}%</strong></div>
                    <div><small>OVER 4</small><strong>{analysis.total ? analysis.overPct.toFixed(1) : '—'}%</strong></div>
                    <div><small>RECENT PRESSURE</small><strong>{analysis.total ? analysis.recentPressure : '—'}</strong></div>
                </div>

                <div className='ai-scanner__digits'>
                    {analysis.counts.map((count, digit) => (
                        <div key={digit} className={digit === analysis.hot ? 'is-hot' : digit === analysis.cold ? 'is-cold' : ''}>
                            <span>{digit}</span>
                            <b>{analysis.total ? ((count / analysis.total) * 100).toFixed(0) : 0}%</b>
                        </div>
                    ))}
                </div>

                <div className='ai-scanner__rationale'>
                    <strong>Analysis</strong>
                    <span>{analysis.rationale}</span>
                </div>

                <button type='button' className='ai-scanner__load-button' disabled={analysis.signal === 'Waiting'} onClick={() => void loadScannerBot()}>
                    LOAD SCANNER BOT
                </button>

                <p className='ai-scanner__note'>
                    Signal and confidence are derived from observed tick statistics and recent pressure. Confidence is a heuristic strength score, not a guaranteed probability or prediction of the next contract result.
                </p>

                {error && <p className='ai-scanner__error'>{error}</p>}
            </div>
        </section>}

        {!open && <button type='button' className='ai-scanner__fab' onClick={() => setOpen(true)} aria-label='Open AI Scanner'>
            <span>✦</span><b>AI</b>
        </button>}
    </>;
};

export default FloatingAIScanner;
