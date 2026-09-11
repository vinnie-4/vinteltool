import React, { useMemo, useState } from 'react';

const VOLATILITY_OPTIONS = [
    'Volatility 10',
    'Volatility 10 (1s)',
    'Volatility 15',
    'Volatility 15 (1s)',
    'Volatility 25',
    'Volatility 25 (1s)',
    'Volatility 30',
    'Volatility 30 (1s)',
    'Volatility 50',
    'Volatility 50 (1s)',
    'Volatility 75',
    'Volatility 75 (1s)',
    'Volatility 90',
    'Volatility 90 (1s)',
    'Volatility 100',
    'Volatility 100 (1s)',
];

const STRATEGIES = ['Even/Odd', 'Over/Under', 'Matches/Differs', 'Last Digit', 'Rise/Fall'];
const RECOVERY = ['Fixed Stake', 'Martingale', 'Anti-Martingale', 'Custom Multiplier'];

const UltimateBot2026 = () => {
    const [volatility, setVolatility] = useState('Volatility 100');
    const [strategy, setStrategy] = useState('Even/Odd');
    const [sample, setSample] = useState('100');
    const [recovery, setRecovery] = useState('Fixed Stake');
    const [stake, setStake] = useState('0.50');
    const [multiplier, setMultiplier] = useState('2');
    const [maxRecovery, setMaxRecovery] = useState('4');
    const [maxTrades, setMaxTrades] = useState('10');
    const [takeProfit, setTakeProfit] = useState('10');
    const [stopLoss, setStopLoss] = useState('10');
    const [cooldown, setCooldown] = useState('1');
    const [running, setRunning] = useState(false);

    const status = useMemo(() => (running ? 'RUNNING' : 'READY'), [running]);

    return (
        <section className='ultimate-bot-2026'>
            <div className='ultimate-bot-2026__hero'>
                <div>
                    <div className='ultimate-bot-2026__eyebrow'>VINTEL TOOL</div>
                    <h2>Ultimate Bot 2026</h2>
                    <p>Advanced strategy automation with live market intelligence.</p>
                </div>
                <span className={`ultimate-bot-2026__status ultimate-bot-2026__status--${running ? 'running' : 'ready'}`}>{status}</span>
            </div>

            <div className='ultimate-bot-2026__card'>
                <h3>Strategy</h3>
                <div className='ultimate-bot-2026__grid'>
                    <label>Strategy<select value={strategy} onChange={e => setStrategy(e.target.value)}>{STRATEGIES.map(item => <option key={item}>{item}</option>)}</select></label>
                    <label>Volatility<select value={volatility} onChange={e => setVolatility(e.target.value)}>{VOLATILITY_OPTIONS.map(item => <option key={item}>{item}</option>)}</select></label>
                </div>
                <div className='ultimate-bot-2026__signal'>
                    <div><b>DCircles</b><span>Live digit signal</span></div>
                    <div className='ultimate-bot-2026__signal-values'><span className='green'>Most</span><span className='blue'>2nd</span><span className='yellow'>2nd least</span><span className='red'>Least</span></div>
                </div>
                <div className='ultimate-bot-2026__sample-row'>
                    <span>Analysis sample</span>
                    {['30', '60', '100', '300', '500', '1000'].map(item => <button key={item} className={sample === item ? 'active' : ''} onClick={() => setSample(item)}>{item}</button>)}
                </div>
            </div>

            <div className='ultimate-bot-2026__card'>
                <h3>Trade & recovery</h3>
                <div className='ultimate-bot-2026__inputs'>
                    <label>Initial stake<input inputMode='decimal' value={stake} onChange={e => setStake(e.target.value)} /></label>
                    <label>Recovery<select value={recovery} onChange={e => setRecovery(e.target.value)}>{RECOVERY.map(item => <option key={item}>{item}</option>)}</select></label>
                    <label>Multiplier<input inputMode='decimal' value={multiplier} onChange={e => setMultiplier(e.target.value)} /></label>
                    <label>Max recovery<input inputMode='numeric' value={maxRecovery} onChange={e => setMaxRecovery(e.target.value)} /></label>
                    <label>Max trades<input inputMode='numeric' value={maxTrades} onChange={e => setMaxTrades(e.target.value)} /></label>
                    <label>Cooldown<input inputMode='numeric' value={cooldown} onChange={e => setCooldown(e.target.value)} /></label>
                </div>
            </div>

            <div className='ultimate-bot-2026__card'>
                <h3>Safety limits</h3>
                <div className='ultimate-bot-2026__inputs ultimate-bot-2026__inputs--limits'>
                    <label>Take profit<input inputMode='decimal' value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></label>
                    <label>Stop loss<input inputMode='decimal' value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></label>
                </div>
                <div className='ultimate-bot-2026__safety'>Maximum loss • Maximum profit • Consecutive-loss protection • Emergency stop</div>
            </div>

            <div className='ultimate-bot-2026__live'>
                <div><span>Market</span><b>{volatility}</b></div>
                <div><span>Strategy</span><b>{strategy}</b></div>
                <div><span>Stake</span><b>{stake} USD</b></div>
                <div><span>Sample</span><b>{sample} ticks</b></div>
            </div>

            <button className={`ultimate-bot-2026__run ${running ? 'stop' : ''}`} onClick={() => setRunning(value => !value)}>{running ? 'Stop Ultimate Bot' : 'Run Ultimate Bot'}</button>
        </section>
    );
};

export default UltimateBot2026;
