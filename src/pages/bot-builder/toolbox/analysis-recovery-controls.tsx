import React from 'react';
import AnalysisTool from '@/pages/analysis-tool';
import './analysis-recovery-controls.scss';

type Mode = 'even-odd' | 'over-under';
const STORAGE_KEY = 'vinteltool-analysis-recovery-settings';
const defaults = { enabled: false, mode: 'even-odd' as Mode, streak: 3, recovery: true, multiplier: 2, maxStake: 10 };
const AnalysisRecoveryControls = () => {
    const [settings, setSettings] = React.useState(() => {
        try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
        catch { return defaults; }
    });
    const [expanded, setExpanded] = React.useState(false);
    React.useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings]);
    return <section className='analysis-recovery'>
        <button type='button' className='analysis-recovery__toggle' aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
            <span>Analysis &amp; Recovery</span><span>{expanded ? '−' : '+'}</span>
        </button>
        {expanded && <>
            <label className='analysis-recovery__enable'><input type='checkbox' checked={settings.enabled} onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))}/> Enable analysis mode</label>
            <label>Signal type
                <select value={settings.mode} onChange={e => setSettings(s => ({ ...s, mode: e.target.value as Mode }))}>
                    <option value='even-odd'>Even / Odd</option><option value='over-under'>Over 4 / Under 5</option>
                </select>
            </label>
            <label>Same-outcome streak required
                <select value={settings.streak} onChange={e => setSettings(s => ({ ...s, streak: Number(e.target.value) }))}>
                    {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} consecutive ticks</option>)}
                </select>
            </label>
            <label className='analysis-recovery__enable'><input type='checkbox' checked={settings.recovery} onChange={e => setSettings(s => ({ ...s, recovery: e.target.checked }))}/> Enable recovery mode</label>
            {settings.recovery && <>
                <label>Stake multiplier after loss
                    <select value={settings.multiplier} onChange={e => setSettings(s => ({ ...s, multiplier: Number(e.target.value) }))}>
                        {[1.5,2,2.5,3,4,5].map(n => <option key={n} value={n}>{n}×</option>)}
                    </select>
                </label>
                <label>Maximum stake
                    <input type='number' min='0.35' step='0.01' value={settings.maxStake} onChange={e => setSettings(s => ({ ...s, maxStake: Math.max(0.35, Number(e.target.value) || 0.35) }))}/>
                </label>
            </>}
            <div className='analysis-recovery__rule'>
                {settings.enabled
                    ? settings.mode === 'even-odd'
                        ? `Signal rule: ${settings.streak} consecutive Odd → candidate Even; ${settings.streak} consecutive Even → candidate Odd.`
                        : `${settings.streak} consecutive digits Over 4 (5–9) → candidate Under 5 (0–4); ${settings.streak} consecutive digits Under 5 (0–4) → candidate Over 4 (5–9).`
                    : 'Analysis mode is disabled. Enable it to configure the signal rule.'}
            </div>
            <small>Settings are saved on this device. This panel configures the rule only; it does not yet alter trade execution or activate a Blockly strategy block. Verify and connect the rule to the bot before running live trades.</small>
        </>}
    </section>;
};
export default AnalysisRecoveryControls;
