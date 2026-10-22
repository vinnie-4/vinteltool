import React from 'react';
import './recovery-analysis.scss';

type RecoveryState = { pending: boolean; symbol: string; contractId: string; streak: number; mode: 'even-odd'; };
type Tick = { epoch: number; digit: number };
const KEY = 'vinteltool-recovery-analysis-state';
const WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

const readState = (): RecoveryState | null => {
    try {
        const state = JSON.parse(localStorage.getItem(KEY) || 'null');
        return state?.pending && state?.symbol ? state : null;
    } catch { return null; }
};
const RecoveryAnalysis = () => {
    const [state, setState] = React.useState<RecoveryState | null>(null);
    const [ticks, setTicks] = React.useState<Tick[]>([]);
    const [matched, setMatched] = React.useState(false);

    React.useEffect(() => {
        const refresh = () => {
            const next = readState();
            setState(next);
            if (!next) { setTicks([]); setMatched(false); }
        };
        refresh();
        const interval = window.setInterval(refresh, 250);
        window.addEventListener('storage', refresh);
        return () => { window.clearInterval(interval); window.removeEventListener('storage', refresh); };
    }, []);

    React.useEffect(() => {
        if (!state?.pending || !state.symbol) return;
        let disposed = false;
        let socket: WebSocket | null = null;
        let retry: number | undefined;
        let pipSize = 2;
        let reconnectDelay = 1000;
        const connect = () => {
            if (disposed) return;
            socket = new WebSocket(WS_URL);
            socket.onopen = () => socket?.send(JSON.stringify({ ticks_history: state.symbol, count: 100, end: 'latest', style: 'ticks', subscribe: 1 }));
            socket.onmessage = event => {
                if (disposed) return;
                try {
                    const data = JSON.parse(event.data);
                    if (data.error) { socket?.close(); return; }
                    const pip = Number(data.pip_size ?? data.tick?.pip_size);
                    if (Number.isFinite(pip) && pip >= 0) pipSize = Math.min(8, Math.floor(pip));
                    if (data.msg_type === 'history' && Array.isArray(data.history?.prices)) {
                        const times: number[] = data.history.times || [];
                        setTicks(data.history.prices.map((price: number, i: number) => ({
                            epoch: Number(times[i]),
                            digit: Number(Number(price).toFixed(pipSize).replace('.', '').slice(-1)),
                        })).filter((t: Tick) => Number.isFinite(t.epoch) && Number.isInteger(t.digit)).slice(-100));
                    } else if (data.msg_type === 'tick' && data.tick?.quote !== undefined) {
                        const quote = Number(data.tick.quote);
                        const epoch = Number(data.tick.epoch);
                        if (!Number.isFinite(quote) || !Number.isFinite(epoch)) return;
                        const digit = Number(quote.toFixed(pipSize).replace('.', '').slice(-1));
                        setTicks(previous => [...previous.filter(t => t.epoch !== epoch), { epoch, digit }].sort((a,b)=>a.epoch-b.epoch).slice(-100));
                    }
                } catch { socket?.close(); }
            };
            socket.onerror = () => socket?.close();
            socket.onclose = () => { if (!disposed) { retry = window.setTimeout(connect, reconnectDelay); reconnectDelay = Math.min(8000, reconnectDelay * 2); } };
        };
        connect();
        return () => {
            disposed = true;
            if (retry) window.clearTimeout(retry);
            if (socket) { socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null; socket.close(); }
        };
    }, [state?.symbol, state?.contractId, state?.pending]);

    React.useEffect(() => {
        if (!state?.pending || ticks.length < state.streak) return;
        const recent = ticks.slice(-state.streak);
        const allOdd = recent.every(t => t.digit % 2 === 1);
        const allEven = recent.every(t => t.digit % 2 === 0);
        if (allOdd || allEven) setMatched(true);
        else setMatched(false);
    }, [ticks, state?.pending, state?.streak]);

    if (!state?.pending) return null;
    const n = Math.max(2, Math.min(30, Number(state.streak) || 2));
    const windows: { key: string; digits: number[]; ok: boolean }[] = [];
    for (let end = n; end <= ticks.length; end++) {
        const digits = ticks.slice(end - n, end).map(t => t.digit);
        const ok = digits.every(d => d % 2 === digits[0] % 2);
        windows.push({ key: String(ticks[end - 1]?.epoch || end), digits, ok });
    }
    const recentWindows = windows.slice(-18);
    return <section className='recovery-analysis' aria-live='polite'>
        <div className='recovery-analysis__windows'>
            {recentWindows.map(window => <div key={window.key} className={'recovery-analysis__window' + (window.ok ? ' is-match' : ' is-miss')}>
                <span className='recovery-analysis__digits'>{'[' + window.digits.join(',') + ']'}</span>
                <span className='recovery-analysis__mark'>{window.ok ? '☑' : '✕'}</span>
            </div>)}
            {matched && <span className='recovery-analysis__matched'>☑</span>}
        </div>
    </section>;
};
export default RecoveryAnalysis;
