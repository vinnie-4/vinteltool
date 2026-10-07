import { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { useSmartChartAdaptor } from '@/hooks/useSmartChartAdaptor';

type Tick = { price: string; digit: number };\nconst MAX_TICKS = 3000;\nconst DIGITS = Array.from({ length: 10 }, (_, index) => index);

const getLastDigit = (value: string | number) => {
    const text = String(value);
    const match = text.match(/(\d)$/);
    return match ? Number(match[1]) : 0;
};

const toTick = (value: string | number): Tick => {
    const price = String(value);
    return { price, digit: getLastDigit(price) };
};

const LDP = observer(() => {
    const { chart_store } = useStore();
    const { symbol, updateSymbol } = chart_store;
    const { getQuotes, subscribeQuotes } = useSmartChartAdaptor();
    const [ticks, setTicks] = useState<Tick[]>([]);
    const [livePrice, setLivePrice] = useState<string>('—');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!symbol) updateSymbol();
    }, [symbol, updateSymbol]);

    useEffect(() => {
        if (!symbol) return;
        let active = true;
        let unsubscribe: (() => void) | undefined;

        const load = async () => {
            setLoading(true);
            try {
                const result = await getQuotes({ symbol, granularity: 0, count: 3000 });
                const prices = result?.history?.prices ?? [];
                if (active) {
                    const history = prices.slice(-MAX_TICKS).map(toTick);
                    setTicks(history);
                    if (history.length) setLivePrice(history[history.length - 1].price);
                }
            } catch (error) {
                console.error('Failed to load LDP tick history', error);
            } finally {
                if (active) setLoading(false);
            }

            if (!active) return;
            unsubscribe = subscribeQuotes({ symbol, granularity: 0 }, quote => {
                const price = quote?.Close ?? quote?.close ?? quote?.price;
                if (price === undefined || price === null) return;
                const next = toTick(price);
                setLivePrice(next.price);
                setTicks(current => [...current, next].slice(-MAX_TICKS));
            });
        };

        load();

        const latest = ticks[ticks.length - 1];
    const ranked = [...stats].sort((a, b) => b.count - a.count || a.digit - b.digit);
    const rankTone = (digit: number) => {
        const rank = ranked.findIndex(item => item.digit === digit);
        if (rank === 0) return 'most';
        if (rank === 1) return 'second-most';
        if (rank === 8) return 'second-least';
        if (rank === 9) return 'least';
        return 'normal';
    };

    return (
        <div className='ldp'>
            <div className='ldp__header'>
                <div>
                    <div className='ldp__title'>LDP · Last Digit Prediction</div>
                    <div className='ldp__subtitle'>{symbol || 'Market'} · rolling 3,000 ticks</div>
                </div>
                <div className='ldp__live'><span /> LIVE TICKS</div>
            </div>

            <div className='ldp__price-card'>
                <div><span className='ldp__label'>LIVE PRICE</span><strong>{livePrice}</strong></div>
                <div className='ldp__digit'><span>LAST DIGIT</span><strong>{loading ? '—' : latest?.digit ?? '—'}</strong></div>
            </div>

            <div className='ldp__live-analysis'><span>📊</span> LIVE · analysing the latest {MAX_TICKS.toLocaleString()} ticks</div>

            <div className='ldp__section'>
                <div className='ldp__section-title'>Last Digit Distribution</div>
                <div className='ldp__digit-grid'>
                    {stats.map(item => (
                        <div className={`ldp__digit-stat ldp__digit-stat--${rankTone(item.digit)}`} key={item.digit}>
                            <div className='ldp__digit-number'>{item.digit}</div>
                            <strong>{item.percentage.toFixed(2)}%</strong>
                            <span>{item.count.toLocaleString()} ticks</span>
                            <div className='ldp__bar'><span className='ldp__bar-fill' style={{ width: `${Math.min(100, item.percentage * 10)}%` }} /></div>
                        </div>
                    ))}
                </div>
            </div>

            <div className='ldp__section'>
                <div className='ldp__section-title'>Prediction Ranking</div>
                {ranked.slice(0, 4).map((item, index) => (
                    <div className='ldp__ranking-row' key={item.digit}>
                        <span>#{index + 1}</span><strong>Digit {item.digit}</strong><b>{item.percentage.toFixed(2)}%</b>
                    </div>
                ))}
            </div>

            <div className='ldp__section'>
                <div className='ldp__section-title'>Recent Last Digits</div>
                <div className='ldp__streaks'>
                    {ticks.slice(-30).map((tick, index) => <span key={index} className={`ldp__chip ldp__chip--${rankTone(tick.digit)}`}>{tick.digit}</span>)}
                </div>
                <div className='ldp__foot'>{ticks.length.toLocaleString()} / {MAX_TICKS.toLocaleString()} ticks analyzed · rolling window</div>
            </div>
        </div>
    );
 { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { useSmartChartAdaptor } from '@/hooks/useSmartChartAdaptor';

type Tick = { price: string; digit: number };\nconst MAX_TICKS = 3000;\nconst DIGITS = Array.from({ length: 10 }, (_, index) => index);

const getLastDigit = (value: string | number) => {
    const text = String(value);
    const match = text.match(/(\d)$/);
    return match ? Number(match[1]) : 0;
};

const toTick = (value: string | number): Tick => {
    const price = String(value);
    return { price, digit: getLastDigit(price) };
};

const LDP = observer(() => {
    const { chart_store } = useStore();
    const { symbol, updateSymbol } = chart_store;
    const { getQuotes, subscribeQuotes } = useSmartChartAdaptor();
    const [ticks, setTicks] = useState<Tick[]>([]);
    const [livePrice, setLivePrice] = useState<string>('—');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!symbol) updateSymbol();
    }, [symbol, updateSymbol]);

    useEffect(() => {
        if (!symbol) return;
        let active = true;
        let unsubscribe: (() => void) | undefined;

        const load = async () => {
            setLoading(true);
            try {
                const result = await getQuotes({ symbol, granularity: 0, count: 3000 });
                const prices = result?.history?.prices ?? [];
                if (active) {
                    const history = prices.slice(-MAX_TICKS).map(toTick);
                    setTicks(history);
                    if (history.length) setLivePrice(history[history.length - 1].price);
                }
            } catch (error) {
                console.error('Failed to load LDP tick history', error);
            } finally {
                if (active) setLoading(false);
            }

            if (!active) return;
            unsubscribe = subscribeQuotes({ symbol, granularity: 0 }, quote => {
                const price = quote?.Close ?? quote?.close ?? quote?.price;
                if (price === undefined || price === null) return;
                const next = toTick(price);
                setLivePrice(next.price);
                setTicks(current => [...current, next].slice(-MAX_TICKS));
            });
        };

        load();

        return () => {
            active = false;
            unsubscribe?.();
        };
    }, [symbol, getQuotes, subscribeQuotes]);

    const stats = useMemo(() => {
        const sample = ticks.slice(-MAX_TICKS);
        const total = sample.length || 1;
        return DIGITS.map(digit => {
            const count = sample.filter(tick => tick.digit === digit).length;
            return { digit, count, percentage: (count / total) * 100 };
        });
    }, [ticks]);

    const Bar = useCallback(({ label, value, tone }: { label: string; value: number; tone: 'green' | 'red' }) => (
        <div className='ldp__metric'>
            <div className='ldp__metric-head'><span>{label}</span><strong>{value.toFixed(2)}%</strong></div>
            <div className='ldp__bar'><span className={`ldp__bar-fill ldp__bar-fill--${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
        </div>
    ), []);

    const latest = ticks[ticks.length - 1];

    return (
        <div className='ldp'>
            <div className='ldp__header'>
                <div>
                    <div className='ldp__title'>LDP · Last Digit</div>
                    <div className='ldp__subtitle'>3,000 ticks · LIVE analysis</div>
                </div>
                <div className='ldp__live'><span /> LIVE</div>
            </div>

            <div className='ldp__price-card'>
                <div><span className='ldp__label'>PRICE</span><strong>{livePrice}</strong></div>
                <div className='ldp__digit'><span>LAST DIGIT</span><strong>{loading ? '—' : latest?.digit ?? '—'}</strong></div>
            </div>

            <div className='ldp__live-analysis'><span>📊</span> LIVE · Last 3,000 ticks</div>

            <div className='ldp__section'>
                <div className='ldp__section-title'>Even / Odd</div>
                <Bar label='Even' value={stats.evenPct} tone='green' />
                <Bar label='Odd' value={stats.oddPct} tone='red' />
            </div>

            <div className='ldp__section'>
                <div className='ldp__section-title'>Over 4 / Under 5</div>
                <Bar label='Over 4' value={stats.over4Pct} tone='green' />
                <Bar label='Under 5' value={stats.under5Pct} tone='red' />
            </div>

            <div className='ldp__section'>
                <div className='ldp__streak-head'><span className='ldp__section-title'>Even / Odd streak</span><strong>{stats.streakType || '—'} {stats.streak || 0}</strong></div>
                <div className='ldp__streaks'>
                    {stats.streaks.map((type, index) => <span key={index} className={type === 'E' ? 'ldp__chip ldp__chip--even' : 'ldp__chip ldp__chip--odd'}>{type}</span>)}
                </div>
                <div className='ldp__foot'>{ticks.length.toLocaleString()} / 3,000 ticks analyzed</div>
            </div>
        </div>
    );
});

export default LDP;
