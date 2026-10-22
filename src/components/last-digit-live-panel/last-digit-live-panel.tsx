import React from 'react';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import './last-digit-live-panel.scss';

type Tick = { digit: number; quote: number; epoch: number };
const WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';
const SYMBOL = '1HZ100V';

export const LastDigitLivePanel = ({ compact = false }: { compact?: boolean }) => {
    const { dashboard } = useStore();
    const [ticks, setTicks] = React.useState<Tick[]>([]);
    const [status, setStatus] = React.useState('Connecting…');
    const [market, setMarket] = React.useState(SYMBOL);
    const socketRef = React.useRef<WebSocket | null>(null);

    React.useEffect(() => {
        let disposed = false;
        let retry: number | undefined;
        let socket: WebSocket | null = null;
        const connect = () => {
            if (disposed) return;
            setStatus('Connecting…');
            socket = new WebSocket(WS_URL);
            socketRef.current = socket;
            socket.onopen = () => {
                if (disposed) return;
                socket?.send(JSON.stringify({ ticks_history: market, count: 20, end: 'latest', style: 'ticks', subscribe: 1 }));
            };
            socket.onmessage = event => {
                if (disposed) return;
                try {
                    const data = JSON.parse(event.data);
                    if (data.error) {
                        setStatus('Feed unavailable · retrying');
                        socket?.close();
                        return;
                    }
                    const precisionValue = Number(data.pip_size ?? data.tick?.pip_size);
                    const precision = Number.isFinite(precisionValue) && precisionValue >= 0 ? Math.min(8, Math.floor(precisionValue)) : 2;
                    if (data.msg_type === 'history' && Array.isArray(data.history?.prices)) {
                        const times: number[] = data.history.times ?? [];
                        const next = data.history.prices.map((price: number, i: number) => ({
                            quote: Number(price), epoch: Number(times[i]),
                            digit: Number(Number(price).toFixed(precision).replace('.', '').slice(-1)),
                        })).filter((t: Tick) => Number.isFinite(t.quote) && Number.isFinite(t.epoch)).slice(-20);
                        setTicks(next);
                        setStatus('Live');
                    } else if (data.msg_type === 'tick' && data.tick?.quote !== undefined) {
                        const quote = Number(data.tick.quote);
                        const epoch = Number(data.tick.epoch);
                        if (!Number.isFinite(quote) || !Number.isFinite(epoch)) return;
                        const digit = Number(quote.toFixed(precision).replace('.', '').slice(-1));
                        setTicks(previous => [...previous.filter(t => t.epoch !== epoch), { quote, epoch, digit }].sort((a,b)=>a.epoch-b.epoch).slice(-20));
                        setStatus('Live');
                    }
                } catch {
                    setStatus('Feed response error · retrying');
                    socket?.close();
                }
            };
            socket.onclose = () => {
                if (!disposed) {
                    setStatus('Reconnecting…');
                    retry = window.setTimeout(connect, 2000);
                }
            };
            socket.onerror = () => socket?.close();
        };
        connect();
        return () => {
            disposed = true;
            if (retry) window.clearTimeout(retry);
            if (socket) {
                socket.onopen = null; socket.onmessage = null; socket.onclose = null; socket.onerror = null;
                socket.close();
            }
            socketRef.current = null;
        };
    }, [market]);

    const latest = ticks[ticks.length - 1];
    const parity = ticks.map(t => t.digit % 2 === 0 ? 'E' : 'O');
    let streak = 0;
    for (let i = parity.length - 1; i >= 0 && parity[i] === parity[parity.length - 1]; i--) streak++;
    const even = parity.filter(p => p === 'E').length;
    const odd = parity.length - even;
    const choose = (contract: 'Even' | 'Odd') => {
        window.dispatchEvent(new CustomEvent('vinteltool:last-digit-contract-selected', { detail: { contract, symbol: market, recentTicks: ticks } }));
        dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    return <section className={`last-digit-live ${compact ? 'last-digit-live--compact' : ''}`}>
        <header className='last-digit-live__header'><strong>Last Digit · Even/Odd</strong><span className={status === 'Live' ? 'is-live' : ''}>● {status}</span></header>
        <label className='last-digit-live__market'>Market
            <select value={market} onChange={e => setMarket(e.target.value)}>
                <option value='1HZ100V'>Volatility 100 (1s)</option>
                <option value='1HZ75V'>Volatility 75 (1s)</option>
                <option value='1HZ50V'>Volatility 50 (1s)</option>
                <option value='1HZ25V'>Volatility 25 (1s)</option>
                <option value='R_100'>Volatility 100</option>
                <option value='R_75'>Volatility 75</option>
                <option value='R_50'>Volatility 50</option>
                <option value='R_25'>Volatility 25</option>
                <option value='R_10'>Volatility 10</option>
            </select>
        </label>
        <div className='last-digit-live__metrics'>
            <div><small>Last digit</small><strong>{latest ? latest.digit : '—'}</strong></div>
            <div><small>Even · 20 ticks</small><strong>{even}</strong></div>
            <div><small>Odd · 20 ticks</small><strong>{odd}</strong></div>
        </div>
        <div className='last-digit-live__streak'><span>Current streak</span><strong>{parity.length ? (parity[parity.length - 1] === 'E' ? 'Even' : 'Odd') + ' × ' + streak : 'Waiting for ticks'}</strong></div>
        <div className='last-digit-live__history' aria-label='Latest twenty last-digit parity outcomes'>
            {ticks.map((tick, i) => <span key={tick.epoch + '-' + i} className={tick.digit % 2 === 0 ? 'is-even' : 'is-odd'} title={`Digit ${tick.digit}`}>{tick.digit % 2 === 0 ? 'E' : 'O'}</span>)}
        </div>
        <div className='last-digit-live__actions'>
            <button type='button' onClick={() => choose('Even')}>Build Even trade</button>
            <button type='button' onClick={() => choose('Odd')}>Build Odd trade</button>
        </div>
        <p className='last-digit-live__note'>Recent frequencies describe the last 20 ticks, not a guarantee of the next outcome. Selecting a direction opens Bot Builder; review the blocks before running.</p>
    </section>;
};

export default LastDigitLivePanel;
