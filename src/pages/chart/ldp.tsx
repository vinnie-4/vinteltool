import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { useSmartChartAdaptor } from '@/hooks/useSmartChartAdaptor';

type Tick = { price: string; digit: number };

const MAX_TICKS = 3000;
const DIGITS = Array.from({ length: 10 }, (_, index) => index);

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
    const [liveTickCount, setLiveTickCount] = useState(0);

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
                const result = await getQuotes({ symbol, granularity: 0, count: MAX_TICKS });
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
                setLiveTickCount(current => current + 1);
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

    const ranked = useMemo(() => [...stats].sort((a, b) => b.count - a.count || a.digit - b.digit), [stats]);

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

                </div>
<div className='ldp__live'><span /> LIVE</div>
            </div>

            <div className='ldp__price-card'>
                <div><span className='ldp__label'>LIVE PRICE</span><strong>{livePrice}</strong></div>
                <div className='ldp__digit'><span>LAST DIGIT</span><strong>{loading ? '—' : ticks[ticks.length - 1]?.digit ?? '—'}</strong></div>
            </div>

            <div className='ldp__live-analysis'><span>📊</span> LIVE · Deriv WebSocket · {liveTickCount.toLocaleString()} new ticks received</div>

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
                <div className='ldp__section-title'>Recent Digits</div>
                <div className='ldp__streaks'>
                    {ticks.slice(-30).map((tick, index) => (
                        <span key={index} className={`ldp__chip ldp__chip--${tick.digit % 2 === 0 ? 'even' : 'odd'}`}>
                            {tick.digit}<small>{tick.digit % 2 === 0 ? 'E' : 'O'}</small>
                        </span>
                    ))}
                </div>
                <div className='ldp__foot'>{ticks.length.toLocaleString()} / 3,000 ticks analyzed · rolling</div>
            </div>
        </div>
    );
});

export default LDP;
