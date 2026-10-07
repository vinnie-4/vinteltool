import { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { useSmartChartAdaptor } from '@/hooks/useSmartChartAdaptor';

type Tick = { price: string; digit: number };

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
                if (active) setTicks(prices.slice(-3000).map(toTick));
            } catch (error) {
                console.error('Failed to load LDP tick history', error);
            } finally {
                if (active) setLoading(false);
            }

            if (!active) return;
            unsubscribe = subscribeQuotes({ symbol, granularity: 0 }, quote => {
                const price = quote?.Close ?? quote?.close ?? quote?.price;
                if (price === undefined || price === null) return;
                setTicks(current => [...current, toTick(price)].slice(-3000));
            });
        };

        load();

        return () => {
            active = false;
            unsubscribe?.();
        };
    }, [symbol, getQuotes, subscribeQuotes]);

    const stats = useMemo(() => {
        const total = ticks.length || 1;
        const even = ticks.filter(t => t.digit % 2 === 0).length;
        const over4 = ticks.filter(t => t.digit > 4).length;
        const recent = ticks.slice(-50);
        let streakType: 'E' | 'O' | '' = '';
        let streak = 0;

        for (let i = recent.length - 1; i >= 0; i--) {
            const type = recent[i].digit % 2 === 0 ? 'E' : 'O';
            if (!streakType) streakType = type;
            if (type !== streakType) break;
            streak++;
        }

        return {
            evenPct: (even / total) * 100,
            oddPct: 100 - (even / total) * 100,
            over4Pct: (over4 / total) * 100,
            under5Pct: 100 - (over4 / total) * 100,
            streakType,
            streak,
            streaks: recent.slice(-20).map(t => (t.digit % 2 === 0 ? 'E' : 'O')),
        };
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
                    <div className='ldp__subtitle'>Live price &amp; 3,000-tick analysis</div>
                </div>
                <div className='ldp__live'><span /> LIVE</div>
            </div>

            <div className='ldp__price-card'>
                <div><span className='ldp__label'>PRICE</span><strong>{loading ? '—' : latest?.price ?? '—'}</strong></div>
                <div className='ldp__digit'><span>LAST DIGIT</span><strong>{loading ? '—' : latest?.digit ?? '—'}</strong></div>
            </div>

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
