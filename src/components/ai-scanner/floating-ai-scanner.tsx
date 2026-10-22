import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import martingaleXml from '@/xml/martingale.xml';
import './floating-ai-scanner.scss';

type Tick = { quote: number; digit: number };
type Signal = 'Over 1' | 'Over 2' | 'Over 3' | 'Under 6' | 'Under 7' | 'Under 8' | 'Waiting';
type Market = { name: string; symbol: string };
type Analysis = {
    counts: number[];
    total: number;
    signal: Signal;
    confidence: number;
    strength: 'WAITING' | 'WEAK' | 'MEDIUM' | 'STRONG';
    hot: number | null;
    secondHot: number | null;
    cold: number | null;
    secondCold: number | null;
    evenPct: number;
    overPct: number;
    recentPressure: number;
    rationale: string;
    winRate: number;
    momentumBurst: number;
    missingDigits: number[];
};

const MARKETS: Market[] = [
    { name: 'Volatility Index 10', symbol: 'R_10' },
    { name: 'Volatility Index 10 (1s)', symbol: '1HZ10V' },
    { name: 'Volatility Index 15 (1s)', symbol: '1HZ15V' },
    { name: 'Volatility Index 25', symbol: 'R_25' },
    { name: 'Volatility Index 25 (1s)', symbol: '1HZ25V' },
    { name: 'Volatility Index 30 (1s)', symbol: '1HZ30V' },
    { name: 'Volatility Index 50', symbol: 'R_50' },
    { name: 'Volatility Index 50 (1s)', symbol: '1HZ50V' },
    { name: 'Volatility Index 75', symbol: 'R_75' },
    { name: 'Volatility Index 75 (1s)', symbol: '1HZ75V' },
    { name: 'Volatility Index 90 (1s)', symbol: '1HZ90V' },
    { name: 'Volatility Index 100', symbol: 'R_100' },
    { name: 'Volatility Index 100 (1s)', symbol: '1HZ100V' },
];

const TICK_WINDOWS = [3000, 1000, 500, 300, 100, 60, 30];
const DEFAULT_TICK_WINDOW = 1000;
const SCAN_TRADE_TYPES = ['Over1 / Under8', 'Over2 / Under7', 'Over3 / Under6'] as const;
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
    secondHot: null,
    cold: null,
    secondCold: null,
    evenPct: 0,
    overPct: 0,
    recentPressure: 0,
    rationale: 'Waiting for enough live tick data.',
    winRate: 0,
    momentumBurst: 0,
    missingDigits: [],
});

const analyseTicks = (ticks: Tick[], windowSize = DEFAULT_TICK_WINDOW, requestedType?: (typeof SCAN_TRADE_TYPES)[number]): Analysis => {
    const values = ticks.slice(-Math.min(MAX_TICKS, Math.max(30, windowSize)));
    const counts = Array(10).fill(0) as number[];
    values.forEach(tick => { if (tick.digit >= 0 && tick.digit <= 9) counts[tick.digit] += 1; });
    const total = values.length;
    const missingDigits = counts.map((count, digit) => count === 0 ? digit : -1).filter(digit => digit >= 0);
    if (total < 20) return { ...emptyAnalysis(), counts, total, missingDigits };

    const ranked = counts.map((count, digit) => ({ count, digit })).sort((a, b) => b.count - a.count || a.digit - b.digit);
    const hot = ranked[0]?.digit ?? null;
    const secondHot = ranked[1]?.digit ?? null;
    const cold = ranked[ranked.length - 1]?.digit ?? null;
    const secondCold = ranked[ranked.length - 2]?.digit ?? null;
    const even = counts.filter((_, digit) => digit % 2 === 0).reduce((a, b) => a + b, 0);
    const over4 = counts.slice(5).reduce((a, b) => a + b, 0);
    const evenPct = even / total * 100;
    const overPct = over4 / total * 100;
    const recent = values.slice(-Math.min(100, values.length));
    const last20 = recent.slice(-Math.min(20, recent.length));
    const last30 = values.slice(-Math.min(30, values.length));
    const recentCounts = Array(10).fill(0) as number[];
    last30.forEach(tick => { recentCounts[tick.digit] += 1; });
    const recentTop = Math.max(...recentCounts);
    const momentumBurst = last30.length ? Math.round(recentTop / last30.length * 100) : 0;

    const pairs = requestedType ? [requestedType] : [...SCAN_TRADE_TYPES];
    const contractOptions = pairs.flatMap(pair => {
        const pairIndex = SCAN_TRADE_TYPES.indexOf(pair);
        const overThreshold = pairIndex + 1;
        const underThreshold = 8 - pairIndex;
        const overWins = counts.filter((_, digit) => digit > overThreshold).reduce((sum, n) => sum + n, 0);
        const underWins = counts.filter((_, digit) => digit < underThreshold).reduce((sum, n) => sum + n, 0);
        return [
            { rate: overWins / total * 100, side: ('Over ' + overThreshold) as Signal, threshold: overThreshold, isOver: true },
            { rate: underWins / total * 100, side: ('Under ' + underThreshold) as Signal, threshold: underThreshold, isOver: false },
        ];
    }).sort((x, y) => y.rate - x.rate);
    const selected = contractOptions[0];
    const recentWinCount = last20.filter(tick => selected.isOver ? tick.digit > selected.threshold : tick.digit < selected.threshold).length;
    const recentRate = last20.length ? recentWinCount / last20.length * 100 : 0;
    const confidence = Math.round(Math.min(99, Math.max(0, selected.rate * 0.75 + recentRate * 0.25)));
    const strength = confidence >= 80 ? 'STRONG' : confidence >= 65 ? 'MEDIUM' : 'WEAK';
    return {
        counts, total, signal: selected.side, confidence, strength, hot, secondHot, cold, secondCold, evenPct, overPct,
        recentPressure: Math.round(Math.abs(recentRate - selected.rate)),
        winRate: Math.round(selected.rate * 10) / 10, momentumBurst, missingDigits,
        rationale: selected.side + ' recorded ' + selected.rate.toFixed(1) + '% historical hits in the selected ' + total + '-tick sample; recent 20-tick hit rate ' + recentRate.toFixed(1) + '%.',
    };
};

const scannerXml = (market: Market, signal: Signal, config: { stake: number; duration: number; martingale: number; stopLoss: number; takeProfit: number }) => {
    const match = /^(Over|Under) (\\d)$/.exec(signal);
    const side = match?.[1] ?? 'Under';
    const prediction = Number(match?.[2] ?? 6);
    const contract = side === 'Over' ? 'DIGITOVER' : 'DIGITUNDER';
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
    field('TRADETYPE_LIST', 'overunder', 'callput');
    field('TYPE_LIST', contract, 'both');
    field('DURATIONTYPE_LIST', 't', 'm');
    field('PURCHASE_LIST', contract, 'CALL');
    const durationField = doc.querySelector('block[type="trade_definition_tradeoptions"] value[name="DURATION"] field[name="NUM"]');
    if (durationField) durationField.textContent = String(config.duration);
    const setNumericValue = (strategyValue: string, amount: number) => {
        const value = doc.querySelector(`value[strategy_value="${strategyValue}"]`);
        if (!value) return;
        const block = doc.createElement('block');
        block.setAttribute('type', 'math_number');
        const fieldNode = doc.createElement('field');
        fieldNode.setAttribute('name', 'NUM');
        fieldNode.textContent = String(amount);
        block.appendChild(fieldNode);
        value.replaceChildren(block);
    };
    setNumericValue('stake', config.stake);
    setNumericValue('loss', config.stopLoss);
    setNumericValue('profit', config.takeProfit);
    const multiplierValue = doc.querySelector('value:has(field[name="VAR"][variabletype=""])');
    const multiplierVar = Array.from(doc.querySelectorAll('field[name="VAR"]')).find(node => node.textContent === 'martingale:multiplier');
    const multiplierBlock = multiplierVar?.closest('block[type="variables_set"]');
    const multiplierNum = multiplierBlock?.querySelector('value[name="VALUE"] shadow[type="math_number"] field[name="NUM"]');
    if (multiplierNum) multiplierNum.textContent = String(config.martingale);
    const mutation = doc.querySelector('block[type="trade_definition_tradeoptions"] > mutation');
    if (mutation) mutation.setAttribute('has_prediction', 'true');
    const tradeOptions = doc.querySelector('block[type="trade_definition_tradeoptions"]');
    let predictionValue = tradeOptions?.querySelector('value[name="PREDICTION"]');
    if (!predictionValue && tradeOptions) {
        predictionValue = doc.createElement('value');
        predictionValue.setAttribute('name', 'PREDICTION');
        const shadow = doc.createElement('shadow');
        shadow.setAttribute('type', 'math_number_positive');
        const num = doc.createElement('field');
        num.setAttribute('name', 'NUM');
        shadow.appendChild(num);
        predictionValue.appendChild(shadow);
        tradeOptions.appendChild(predictionValue);
    }
    const num = predictionValue?.querySelector('field[name="NUM"]');
    if (num) num.textContent = String(prediction);
    return new XMLSerializer().serializeToString(doc);
};

// Nested routes/layouts may mount the shared widget more than once.
const AI_SCANNER_OWNER_KEY = '__vinteltoolFloatingAiScannerOwner';

const FloatingAIScanner = () => {
    const { quick_strategy, dashboard } = useStore();
    const [isDuplicateInstance, setIsDuplicateInstance] = useState(false);
    useEffect(() => {
        const host = window as any;
        if (host[AI_SCANNER_OWNER_KEY]) {
            setIsDuplicateInstance(true);
            return;
        }
        const owner = {};
        host[AI_SCANNER_OWNER_KEY] = owner;
        return () => {
            if (host[AI_SCANNER_OWNER_KEY] === owner) {
                delete host[AI_SCANNER_OWNER_KEY];
            }
        };
    }, []);
    const [open, setOpen] = useState(false);
    const [showLoadConfig, setShowLoadConfig] = useState(false);
    const [recoveryExpanded, setRecoveryExpanded] = useState(false);
    const [configStake, setConfigStake] = useState('0.5');
    const [configDuration, setConfigDuration] = useState('1');
    const [configWins, setConfigWins] = useState('4');
    const [configMartingale, setConfigMartingale] = useState('2');
    const [configStopLoss, setConfigStopLoss] = useState('10');
    const [configTakeProfit, setConfigTakeProfit] = useState('10');
    const [configRecoveryDigits, setConfigRecoveryDigits] = useState('2');
    const [selectedTradeType, setSelectedTradeType] = useState<(typeof SCAN_TRADE_TYPES)[number]>('Over1 / Under8');
    const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(null);
    const fabDragRef = useRef<{ pointerX: number; pointerY: number; left: number; top: number; moved: boolean } | null>(null);
    const fabMovedRef = useRef(false);

    const onFabPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        fabDragRef.current = { pointerX: event.clientX, pointerY: event.clientY, left: rect.left, top: rect.top, moved: false };
        fabMovedRef.current = false;
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const onFabPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        const drag = fabDragRef.current;
        if (!drag || !(event.buttons & 1)) return;
        const dx = event.clientX - drag.pointerX;
        const dy = event.clientY - drag.pointerY;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        fabMovedRef.current = true;
        const rect = event.currentTarget.getBoundingClientRect();
        const maxX = Math.max(0, window.innerWidth - rect.width);
        const maxY = Math.max(0, window.innerHeight - rect.height);
        setFabPosition({
            x: Math.min(maxX, Math.max(0, drag.left + dx)),
            y: Math.min(maxY, Math.max(0, drag.top + dy)),
        });
    };
    const onFabPointerUp = () => {
        fabDragRef.current = null;
    };
    const resetScan = useCallback(() => {
        setScanComplete(false);
        setScanning(false);
        setScanProgress(0);
        setScanMessage('');
        setError('');
        setTicks([]);
        setConnected(false);
        setMarket(MARKETS[8]);
    }, []);

    const closeScanner = useCallback(() => {
        setOpen(false);
        setShowLoadConfig(false);
        setRecoveryExpanded(false);
        resetScan();
    }, [resetScan]);

    const onFabClick = () => {
        if (fabMovedRef.current) {
            fabMovedRef.current = false;
            return;
        }
        resetScan();
        setShowLoadConfig(false);
        setRecoveryExpanded(false);
        setOpen(true);
    };
    const [market, setMarket] = useState(MARKETS[8]);
    const [tickWindow, setTickWindow] = useState(DEFAULT_TICK_WINDOW);
    const [ticks, setTicks] = useState<Tick[]>([]);
    const [connected, setConnected] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanMessage, setScanMessage] = useState('');
    const [scanProgress, setScanProgress] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);
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
                const history = data.history.prices.map(Number).filter(Number.isFinite).slice(-tickWindow).map((quote: number) => ({
                    quote,
                    digit: digitOf(quote, decimalsRef.current),
                }));
                setTicks(history);
                setConnected(true);
            }

            if (data?.msg_type === 'tick' && data.tick?.symbol === symbol && data.tick?.quote !== undefined) {
                const quote = Number(data.tick.quote);
                if (!Number.isFinite(quote)) return;
                setTicks(previous => [...previous, { quote, digit: digitOf(quote, decimalsRef.current) }].slice(-tickWindow));
                setConnected(true);
                if (data.tick.id) subscriptionRef.current = data.tick.id;
            }

            if (data?.subscription?.id && data?.echo_req?.req_id === tickReqId) {
                subscriptionRef.current = data.subscription.id;
            }
        });

        listenerRef.current = listener;

        try {
            await api_base.api.send({ ticks_history: symbol, count: tickWindow, end: 'latest', style: 'ticks', req_id: historyReqId });
            const response: any = await api_base.api.send({ ticks: symbol, subscribe: 1, req_id: tickReqId });
            if (response?.subscription?.id) subscriptionRef.current = response.subscription.id;
            setConnected(true);
        } catch (e: any) {
            setConnected(false);
            setError(e?.error?.message || 'Unable to connect scanner to Deriv');
        }
    }, [disconnect, tickWindow]);

    useEffect(() => {
        if (!open || scanComplete) return;
        let cancelled = false;
        const start = async () => {
            for (let attempt = 0; attempt < 8 && !cancelled && !api_base.api; attempt += 1) {
                await new Promise(resolve => window.setTimeout(resolve, 500));
            }
            if (!cancelled) void connectMarket(market.symbol);
        };
        void start();
        return () => { cancelled = true; void disconnect(); };
    }, [open, scanComplete, market.symbol, connectMarket, disconnect]);

    const analysis = useMemo(() => analyseTicks(ticks.slice(-tickWindow), tickWindow, selectedTradeType), [ticks, tickWindow, selectedTradeType]);

    useEffect(() => setConfidence(analysis.confidence), [analysis.confidence]);

    const scanMarkets = useCallback(async () => {
        if (!api_base.api) {
            setError('Deriv connection is not ready');
            return;
        }

        setScanning(true);
        setScanProgress(0);
        setScanComplete(false);
        setError('');
        setConnected(false);
        setScanMessage('Scanning volatility markets…');
        await disconnect();

        try {
            let cycle = 0;
            while (true) {
                cycle += 1;
                const results: Array<{ market: Market; ticks: Tick[]; analysis: Analysis }> = [];
                let completed = 0;
                await Promise.all(MARKETS.map(async (item, index) => {
                    setScanMessage(item.name + '|' + (index + 1) + '/' + MARKETS.length);
                    try {
                        const response: any = await api_base.api.send({
                            ticks_history: item.symbol,
                            count: tickWindow,
                            end: 'latest',
                            style: 'ticks',
                            req_id: ++requestIdRef.current,
                        });
                        if (!response?.error && Array.isArray(response?.history?.prices)) {
                            const decimals = Number(response?.pip_size);
                            const precision = Number.isFinite(decimals) && decimals >= 0 ? decimals : 2;
                            const history = response.history.prices.map(Number).filter(Number.isFinite).slice(-tickWindow).map((quote: number) => ({
                                quote,
                                digit: digitOf(quote, precision),
                            }));
                            if (history.length >= tickWindow) {
                                const result = analyseTicks(history, tickWindow, selectedTradeType);
                                results.push({ market: item, ticks: history, analysis: result });
                            }
                        }
                    } catch {
                        // One unavailable market should not delay the rest of the scan.
                    } finally {
                        completed += 1;
                        setScanProgress(Math.round((completed / MARKETS.length) * 100));
                        setScanMessage(item.name + '|' + completed + '/' + MARKETS.length);
                    }
                }));
                const qualified = results
                    .filter(result => result.analysis.winRate >= 80 && result.analysis.confidence >= 80)
                    .sort((a, b) => b.analysis.winRate - a.analysis.winRate || b.analysis.confidence - a.analysis.confidence || b.analysis.momentumBurst - a.analysis.momentumBurst);

                if (qualified.length) {
                    const winner = qualified[0];
                    setMarket(winner.market);
                    setTicks(winner.ticks);
                    setScanProgress(100);
                    setScanComplete(true);
                    setScanMessage(winner.market.name + ' · ' + winner.analysis.signal + ' · ' + winner.analysis.winRate.toFixed(1) + '% observed win rate');
                    break;
                }

                setScanMessage('Volatility · cycle ' + (cycle + 1));
                setScanProgress(0);
                await new Promise(resolve => window.setTimeout(resolve, 250));
            }
        } catch (e: any) {
            setError(e?.message || 'Unable to scan the volatility markets');
            setScanMessage('Market scan failed');
        } finally {
            setScanning(false);
        }
    }, [disconnect, connectMarket, tickWindow, selectedTradeType]);

    const loadScannerBot = useCallback(async () => {
        if (analysis.signal === 'Waiting') {
            setError('Collecting more ticks before loading a scanner bot.');
            return;
        }

        const xml = scannerXml(market, analysis.signal, {
            stake: Math.max(0.01, Number(configStake) || 0.5),
            duration: Math.max(1, Math.floor(Number(configDuration) || 1)),
            martingale: Math.max(1, Number(configMartingale) || 2),
            stopLoss: Math.max(0, Number(configStopLoss) || 0),
            takeProfit: Math.max(0, Number(configTakeProfit) || 0),
        });
        setOpen(false);
        dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
        await new Promise<void>(resolve => window.setTimeout(resolve, 80));
        await quick_strategy.loadFreeBotXml(xml, 'AI Scanner • ' + market.name + ' • ' + analysis.signal);
    }, [analysis.signal, configDuration, configMartingale, configStake, configStopLoss, configTakeProfit, dashboard, market, quick_strategy]);

    if (isDuplicateInstance) return null;

    return <>
        {open && <div className='ai-scanner__backdrop' aria-hidden='true' />}

        {open && <section className='ai-scanner__panel' aria-label='AI Scanner'>
            <header className='ai-scanner__header'>
                <div>
                    <span className='ai-scanner__spark'>✦</span>
                    <strong>{showLoadConfig ? 'SCANNER BOT CONFIGURATION' : 'AI SCANNER'}</strong>
                </div>
                <button type='button' onClick={closeScanner} aria-label='Close scanner'>×</button>
            </header>

            <div className='ai-scanner__body'>
                {showLoadConfig ? <section className='ai-scanner__config-layout' aria-label='Scanner bot configuration'>
                    <div className='ai-scanner__config-row'>
                        <label>Stake<input type='number' value={configStake} onChange={e => setConfigStake(e.target.value)} min='0.01' step='0.01' /></label>
                        <label>Ticks<input type='number' value={configDuration} onChange={e => setConfigDuration(e.target.value)} min='1' step='1' /></label>
                        <label>No. of wins<input type='number' value={configWins} onChange={e => setConfigWins(e.target.value)} min='1' step='1' /></label>
                    </div>
                    <div className='ai-scanner__config-row'>
                        <label>Martingale<input type='number' value={configMartingale} onChange={e => setConfigMartingale(e.target.value)} min='1' step='0.1' /></label>
                        <label>Stop loss<input type='number' value={configStopLoss} onChange={e => setConfigStopLoss(e.target.value)} min='0' step='0.1' /></label>
                        <label>Take profit<input type='number' value={configTakeProfit} onChange={e => setConfigTakeProfit(e.target.value)} min='0' step='0.1' /></label>
                        <button type='button' className={'ai-scanner__recovery-toggle' + (recoveryExpanded ? ' is-expanded' : '')} onClick={() => setRecoveryExpanded(value => !value)} aria-expanded={recoveryExpanded}>Recovery (Even/Odd) <span>{recoveryExpanded ? '−' : '+'}</span></button>
                    </div>
                    {recoveryExpanded && <div className='ai-scanner__recovery-options'>
                        <strong>Recovery</strong>
                        <label>Analyse last <input type='number' value={configRecoveryDigits} onChange={e => setConfigRecoveryDigits(e.target.value)} min='1' max='30' /> digits</label>
                    </div>}
                    <div className='ai-scanner__config-actions'>
                        <button type='button' onClick={() => setShowLoadConfig(false)}>Back</button>
                        <button type='button' onClick={() => void loadScannerBot()}>Load Scanner Bot</button>
                    </div>
                </section> : <>
                <div className='ai-scanner__trade-types' role='group' aria-label='Trade type to scan'>
                    {SCAN_TRADE_TYPES.map(type => (
                        <button key={type} type='button' className={'ai-scanner__trade-type' + (selectedTradeType === type ? ' is-active' : '')} aria-pressed={selectedTradeType === type} onClick={() => { if (selectedTradeType !== type) { setSelectedTradeType(type); resetScan(); } }}>{type}</button>
                    ))}
                </div>

                <section className='ai-scanner__intro-card'>
                    <div>
                        <strong>{selectedTradeType === 'Over1 / Under8' ? 'Digits Scanner' : selectedTradeType === 'Over2 / Under7' ? 'Digits Scanner' : 'Over3 / Under6'}</strong>
                        
                    </div>
                    <label className='ai-scanner__ticks'>TICKS
                        <select value={tickWindow} onChange={e => setTickWindow(Number(e.target.value))}>
                            {TICK_WINDOWS.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </label>
                </section>

                <section className='ai-scanner__market-summary'>
                    <div><label>SELECTED MARKET</label><strong>{scanComplete ? market.name : 'Scan to find the best market'}</strong></div>
                    <div><label>TRADE TYPE</label><strong>{scanComplete ? analysis.signal : 'Waiting for scan'}</strong></div>
                    {scanComplete && <div className='ai-scanner__result-metrics'>
                        <div><label>AI SCORE</label><strong>{analysis.confidence}%</strong></div>
                        <div><label>OBSERVED WIN RATE</label><strong>{analysis.winRate.toFixed(1)}%</strong></div>
                        <div><label>MOMENTUM</label><strong>{analysis.momentumBurst}%</strong></div>
                        <div><label>LAST TICKS ANALYSED</label><strong>{analysis.total}/{tickWindow}</strong></div>
                    </div>}
                </section>

                {scanning && <section className='ai-scanner__scan-progress-card is-scanning' aria-live='polite'>
                    <div className='ai-scanner__scan-market-name'>{(scanMessage.split('|')[0] || 'Volatility Index 10')}</div>
                    <div className='ai-scanner__scan-progress-track'><span style={{ width: Math.max(0, scanProgress) + '%' }} /></div>
                    <div className='ai-scanner__scan-market-count'>Scanning markets {scanMessage.split('|')[1] || '1/' + MARKETS.length}</div>
                </section>}

                {!scanning && !scanComplete && (error ? <p className='ai-scanner__error'>{error}</p> : <div className='ai-scanner__status' aria-live='polite'>Not scanned yet</div>)}

                {scanComplete && <>
                    <div className='ai-scanner__result-table' role='table' aria-label='Best market scan result'>
                        <div role='row'><span role='columnheader'>BEST MARKET</span><span role='columnheader'>TRADE TYPE</span><span role='columnheader'>AI SCORE</span><span role='columnheader'>WIN RATE</span><span role='columnheader'>TICKS</span></div>
                        <div role='row'><strong role='cell'>{market.name}</strong><strong role='cell'>{analysis.signal}</strong><strong role='cell'>{analysis.confidence}%</strong><strong role='cell'>{analysis.winRate.toFixed(1)}%</strong><strong role='cell'>{analysis.total}/{tickWindow}</strong></div>
                    </div>
                    <div className='ai-scanner__digits'>
                        {analysis.counts.map((count, digit) => (
                            <div key={digit} className={digit === analysis.hot ? 'is-hot' : digit === analysis.secondHot ? 'is-second-hot' : digit === analysis.cold ? 'is-cold' : digit === analysis.secondCold ? 'is-second-cold' : ''}>
                                <span>{digit}</span><b>{analysis.total ? ((count / analysis.total) * 100).toFixed(0) : 0}%</b>
                            </div>
                        ))}
                    </div>
                </>}

                <div className='ai-scanner__actions'>
                    <button type='button' className='ai-scanner__scan-button' disabled={scanning} onClick={() => void scanMarkets()}>
                        {scanning ? 'Scanning Markets…' : scanComplete ? 'Scan Again' : 'Scan Markets'}
                    </button>
                    <button type='button' className='ai-scanner__load-button' disabled={!scanComplete || analysis.signal === 'Waiting'} onClick={() => setShowLoadConfig(true)}>
                        Load Scanner Bot
                    </button>
                </div>
                {error && <p className='ai-scanner__error'>{error}</p>}
                </>}
            </div>
        </section>}

        {!open && <button
            type='button'
            className={'ai-scanner__fab' + (fabPosition ? ' is-positioned' : '')}
            style={fabPosition ? { left: fabPosition.x, top: fabPosition.y, right: 'auto', bottom: 'auto' } : undefined}
            onPointerDown={onFabPointerDown}
            onPointerMove={onFabPointerMove}
            onPointerUp={onFabPointerUp}
            onPointerCancel={onFabPointerUp}
            onClick={onFabClick}
            aria-label='Open AI Scanner'
            title='Drag to move • Tap to open'
        >
            <span className='ai-scanner__fab-label'>AI</span><i className='ai-scanner__fab-dot' />
        </button>}
    </>;
};

export default FloatingAIScanner;
