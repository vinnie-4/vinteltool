import React from 'react';
import { TContractInfo } from '@/components/summary/summary-card.types';
import './trade-digit-streak.scss';

type Tick = { digit: number; epoch: number };
const WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';
const isDigitContract = (contract?: TContractInfo | null) => /^DIGIT/.test(String(contract?.contract_type || '').toUpperCase());
const getDigit = (quote: number, precision: number) => Number(quote.toFixed(Math.max(0, Math.min(8, precision))).replace('.', '').slice(-1));

/** Contextual live analysis for an already-issued digit contract. It never places trades. */
const TradeDigitStreak = ({ contract }: { contract?: TContractInfo | null }) => {
    const [ticks, setTicks] = React.useState<Tick[]>([]);
    const [status, setStatus] = React.useState('Connecting…');
    const socketRef = React.useRef<WebSocket | null>(null);
    const symbol = String((contract as any)?.underlying_symbol || (contract as any)?.underlying || '');
    const contractKey = String((contract as any)?.contract_id || (contract as any)?.id || (contract as any)?.transaction_ids?.buy || '');

    React.useEffect(() => {
        if (!isDigitContract(contract) || !symbol || !contractKey) {
            setTicks([]);
            setStatus('Waiting for digit trade');
            return;
        }
        let disposed = false;
        let retry: number | undefined;
        let socket: WebSocket | null = null;
        let precision = 2;
        let retryCount = 0;
        const connect = () => {
            if (disposed) return;
            setStatus('Connecting…');
            socket = new WebSocket(WS_URL);
            socketRef.current = socket;
            socket.onopen = () => {
                if (!disposed) socket?.send(JSON.stringify({ ticks_history: symbol, count: 20, end: 'latest', style: 'ticks', subscribe: 1 }));
            };
            socket.onmessage = event => {
                if (disposed) return;
                try {
                    const data = JSON.parse(event.data);
                    if (data.error || Array.isArray(data.errors)) {
                        setStatus('Reconnecting…');
                        socket?.close();
                        return;
                    }
                    const precisionValue = Number(data.pip_size ?? data.tick?.pip_size);
                    if (Number.isFinite(precisionValue) && precisionValue >= 0) precision = Math.min(8, Math.floor(precisionValue));
                    if (data.msg_type === 'history' && Array.isArray(data.history?.prices)) {
                        const times: number[] = Array.isArray(data.history.times) ? data.history.times.map(Number) : [];
                        const next = data.history.prices.map((price: number, i: number) => ({
                            digit: getDigit(Number(price), precision), epoch: Number(times[i]),
                        })).filter((tick: Tick) => Number.isFinite(tick.digit) && Number.isFinite(tick.epoch)).slice(-20);
                        setTicks(next);
                        setStatus('Live');
                    } else if (data.msg_type === 'tick' && data.tick?.quote !== undefined) {
                        const epoch = Number(data.tick.epoch);
                        const quote = Number(data.tick.quote);
                        if (!Number.isFinite(epoch) || !Number.isFinite(quote)) return;
                        const nextTick = { digit: getDigit(quote, precision), epoch };
                        setTicks(previous => [...previous.filter(t => t.epoch !== epoch), nextTick].sort((a, b) => a.epoch - b.epoch).slice(-20));
                        setStatus('Live');
                    }
                } catch {
                    setStatus('Reconnecting…');
                    socket?.close();
                }
            };
            socket.onerror = () => socket?.close();
            socket.onclose = () => {
                if (!disposed) {
                    setStatus('Reconnecting…');
                    retryCount += 1;
                    retry = window.setTimeout(connect, Math.min(10000, 1500 * retryCount));
                }
            };
        };
        connect();
        return () => {
            disposed = true;
            if (retry) window.clearTimeout(retry);
            if (socket) {
                socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null;
                socket.close();
            }
            if (socketRef.current === socket) socketRef.current = null;
        };
    }, [symbol, contractKey, contract?.contract_type]);

    if (!isDigitContract(contract) || !contractKey) return null;
    const parities = ticks.map(t => t.digit % 2 === 0 ? 'Even' : 'Odd');
    const latest = ticks[ticks.length - 1];
    const latestParity = parities[parities.length - 1];
    let streak = 0;
    for (let i = parities.length - 1; i >= 0 && parities[i] === latestParity; i--) streak++;
    const even = parities.filter(p => p === 'Even').length;
    const odd = parities.length - even;

    return <section className='trade-digit-streak' aria-live='polite'>
        <div className='trade-digit-streak__heading'><strong>Live last-digit analysis</strong><span className={status === 'Live' ? 'is-live' : ''}>● {status}</span></div>
        <div className='trade-digit-streak__stats'>
            <span>Last digit <b>{latest ? latest.digit : '—'}</b></span>
            <span>Even <b>{even}/20</b></span>
            <span>Odd <b>{odd}/20</b></span>
        </div>
        <div className='trade-digit-streak__current'>Current streak: <b>{latestParity ? latestParity + ' × ' + streak : 'Waiting for ticks'}</b></div>
        <div className='trade-digit-streak__ticks'>{ticks.map((tick, i) => <span key={tick.epoch + '-' + i} className={tick.digit % 2 === 0 ? 'is-even' : 'is-odd'} title={'Digit ' + tick.digit}>{tick.digit % 2 === 0 ? 'E' : 'O'}</span>)}</div>
        <small>Analysis uses the latest 20 ticks for {symbol}. Recent streaks do not predict or guarantee the next outcome.</small>
    </section>;
};
export default TradeDigitStreak;
