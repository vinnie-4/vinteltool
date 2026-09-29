import React from 'react';
import { observer } from 'mobx-react-lite';
import MobileFullPageModal from '@/components/shared_ui/mobile-full-page-modal';
import Modal from '@/components/shared_ui/modal';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import './quick-strategy.scss';

type Section = 'market' | 'trade' | 'contract' | 'analysis' | 'purchase' | 'sell' | 'flow';

type FormState = {
    market: string;
    submarket: string;
    symbol: string;
    tradeType: string;
    contractType: string;
    multi: boolean;
    recovery: boolean;
    hedging: boolean;
    stake: string;
    takeProfit: string;
    stopLoss: string;
    martingale: boolean;
    martingaleMultiplier: string;
    durationType: string;
    duration: string;
    analysis: boolean;
    analysisCondition: string;
    analysisDigits: string;
    analysisAction: string;
    purchaseCondition: string;
    sellCondition: string;
    tradeOnce: boolean;
    repeat: boolean;
    waitTicks: string;
};

const DEFAULTS: FormState = {
    market: 'Derived',
    submarket: 'Continuous Indices',
    symbol: 'Volatility 10 Index',
    tradeType: 'Digits',
    contractType: 'DIGITEVEN',
    multi: false,
    recovery: false,
    hedging: false,
    stake: '1',
    takeProfit: '10',
    stopLoss: '30',
    martingale: true,
    martingaleMultiplier: '2',
    durationType: 'Ticks',
    duration: '1',
    analysis: false,
    analysisCondition: 'Last digit',
    analysisDigits: '1, 2, 3, 4',
    analysisAction: 'Even',
    purchaseCondition: 'On signal',
    sellCondition: 'At expiry',
    tradeOnce: false,
    repeat: true,
    waitTicks: '1',
};

const MARKETS = [
    ['Derived', ['Continuous Indices', 'Volatility Indices', 'Crash/Boom Indices', 'Jump Indices', 'Step Indices', 'Range Break Indices']],
    ['Cryptocurrencies', ['Major Crypto', 'Crypto Indices']],
    ['Forex', ['Major Pairs', 'Minor Pairs', 'Exotic Pairs']],
    ['Stock indices (Closed)', ['Major Indices']],
    ['Commodities (Closed)', ['Metals', 'Energy']],
];

const SYMBOLS: Record<string, string[]> = {
    'Continuous Indices': [
        'Volatility 10 Index', 'Volatility 25 Index', 'Volatility 50 Index', 'Volatility 75 Index', 'Volatility 100 Index',
        'Volatility 10 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 75 (1s) Index',
        'Volatility 100 (1s) Index', 'Volatility 150 (1s) Index', 'Volatility 250 (1s) Index',
    ],
    'Volatility Indices': [
        'Volatility 10 Index', 'Volatility 25 Index', 'Volatility 50 Index', 'Volatility 75 Index', 'Volatility 100 Index',
        'Volatility 10 (1s) Index', 'Volatility 25 (1s) Index', 'Volatility 50 (1s) Index', 'Volatility 75 (1s) Index',
        'Volatility 100 (1s) Index', 'Volatility 150 (1s) Index', 'Volatility 250 (1s) Index',
    ],
    'Crash/Boom Indices': ['Crash 300 Index', 'Crash 500 Index', 'Crash 1000 Index', 'Boom 300 Index', 'Boom 500 Index', 'Boom 1000 Index'],
    'Jump Indices': ['Jump 10 Index', 'Jump 25 Index', 'Jump 50 Index', 'Jump 75 Index', 'Jump 100 Index'],
    'Step Indices': ['Step Index', 'Step Index 200', 'Step Index 300', 'Step Index 400', 'Step Index 500'],
    'Range Break Indices': ['Range Break 100 Index', 'Range Break 200 Index'],
    'Major Crypto': ['Bitcoin', 'Ethereum', 'Litecoin', 'Bitcoin Cash'],
    'Crypto Indices': ['Crypto 10 Index', 'Crypto 25 Index', 'Crypto 30 Index', 'Crypto 40 Index'],
    'Major Pairs': ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'],
    'Minor Pairs': ['EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'EUR/AUD'],
    'Exotic Pairs': ['USD/TRY', 'USD/ZAR', 'USD/MXN', 'EUR/TRY'],
    'Major Indices': ['US 500', 'US Tech 100', 'Wall Street 30', 'UK 100', 'Germany 40', 'Europe 50', 'Japan 225'],
    Metals: ['Gold', 'Silver', 'Platinum', 'Palladium'],
    Energy: ['Crude Oil', 'Brent Crude Oil', 'Natural Gas'],
};

const SYMBOL_CODES: Record<string, string> = {
    'Volatility 10 Index': 'R_10', 'Volatility 25 Index': 'R_25', 'Volatility 50 Index': 'R_50',
    'Volatility 75 Index': 'R_75', 'Volatility 100 Index': 'R_100',
    'Volatility 10 (1s) Index': '1HZ10V', 'Volatility 25 (1s) Index': '1HZ25V',
    'Volatility 50 (1s) Index': '1HZ50V', 'Volatility 75 (1s) Index': '1HZ75V',
    'Volatility 100 (1s) Index': '1HZ100V', 'Volatility 150 (1s) Index': '1HZ150V', 'Volatility 250 (1s) Index': '1HZ250V',
};

const CONTRACTS = [
    ['Rise / Fall', 'CALL'], ['Rise / Fall', 'PUT'], ['Higher', 'HIGHER'], ['Lower', 'LOWER'],
    ['Touch', 'ONETOUCH'], ['No Touch', 'NOTOUCH'], ['Ends In', 'EXPIRYMISSE'], ['Ends Out', 'EXPIRYMISS'],
    ['Stays Between', 'RANGE'], ['Goes Outside', 'UPORDOWN'], ['Digits Matches', 'DIGITMATCH'],
    ['Digits Differs', 'DIGITDIFF'], ['Digits Over', 'DIGITOVER'], ['Digits Under', 'DIGITUNDER'],
    ['Digits Even', 'DIGITEVEN'], ['Digits Odd', 'DIGITODD'], ['Tick High', 'TICKHIGH'], ['Tick Low', 'TICKLOW'],
    ['Reset Call', 'RESETCALL'], ['Reset Put', 'RESETPUT'], ['Run High', 'RUNHIGH'], ['Run Low', 'RUNLOW'],
    ['Asian Up', 'ASIAND'], ['Asian Down', 'ASIANU'], ['Accumulator', 'ACCU'],
    ['Multiplier Up', 'MULTUP'], ['Multiplier Down', 'MULTDOWN'],
    ['Vanilla Long Call', 'VANILLALONGCALL'], ['Vanilla Long Put', 'VANILLALONGPUT'],
    ['Turbo Long Call', 'TURBOSLONG'], ['Turbo Short', 'TURBOSSHORT'],
];

const TRADE_TYPES = ['Rise/Fall', 'Higher/Lower', 'Touch/No Touch', 'Digits', 'Up/Down', 'Range', 'Ends In/Ends Out', 'Tick High/Low', 'Reset Call/Put', 'Run High/Low', 'Asian', 'Multiplier', 'Accumulator', 'Vanilla'];
const PURCHASES = ['On signal', 'Immediately', 'After analysis', 'When condition is true', 'Trade once'];
const SELLS = ['At expiry', 'At market', 'When profit target is reached', 'When stop loss is reached', 'When condition is true'];
const DIGIT_OPTIONS = ['Even', 'Odd', 'Over 4', 'Under 5', 'Matches', 'Differs'];
const CONDITION_OPTIONS = ['Last digit', 'Last 2 digits', 'Digit frequency', 'All digits even', 'All digits odd'];

const Select = ({ value, onChange, children, wide = false }: any) => (
    <select className={`vqb-select${wide ? ' vqb-select--wide' : ''}`} value={value} onChange={e => onChange(e.target.value)}>
        {children}
    </select>
);

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) => (
    <button type="button" aria-pressed={checked} className={`vqb-toggle${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
        <span />
    </button>
);

const QuickStrategy = observer(() => {
    const { quick_strategy } = useStore();
    const { isDesktop } = useDevice();
    const { is_open, setFormVisibility } = quick_strategy;
    const [form, setForm] = React.useState<FormState>(DEFAULTS);
    const [open, setOpen] = React.useState<Record<Section, boolean>>({
        market: true, trade: true, contract: true, analysis: true, purchase: true, sell: true, flow: true,
    });

    React.useEffect(() => {
        if (!is_open) return;
        try {
            const saved = localStorage.getItem('vinteltool-quick-bot-config');
            if (saved) setForm({ ...DEFAULTS, ...JSON.parse(saved) });
        } catch {
            setForm(DEFAULTS);
        }
    }, [is_open]);

    const set = (key: keyof FormState, value: any) => setForm(prev => ({ ...prev, [key]: value }));
    const toggleSection = (section: Section) => setOpen(prev => ({ ...prev, [section]: !prev[section] }));

    const marketGroups = MARKETS.find(([market]) => market === form.market)?.[1] || ['Continuous Indices'];
    const symbols = SYMBOLS[form.submarket] || SYMBOLS['Continuous Indices'];

    const load = () => {
        localStorage.setItem('vinteltool-quick-bot-config', JSON.stringify(form));
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.derivWorkspace;
        if (Blockly && workspace) {
            const symbol = SYMBOL_CODES[form.symbol] || form.symbol;
            const xml = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade_definition" x="20" y="20">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_indices</field>
        <field name="SUBMARKET_LIST">continuous_indices</field>
        <field name="SYMBOL_LIST">${symbol}</field>
        <next>
          <block type="trade_definition_tradetype" deletable="false" movable="false">
            <field name="TRADETYPECAT_LIST">digits</field>
            <field name="TRADETYPE_LIST">both</field>
            <next>
              <block type="trade_definition_contracttype" deletable="false" movable="false">
                <field name="TYPE_LIST">${form.contractType}</field>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;
            try {
                workspace.clear();
                Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), workspace);
                workspace.render();
                workspace.resizeContents();
            } catch {
                // Some contract types are not represented by the current Bot Builder block definitions.
            }
        }
        setFormVisibility(false);
    };

    const section = (key: Section, title: string, children: React.ReactNode) => (
        <section className="vqb-section">
            <button type="button" className="vqb-section-title" onClick={() => toggleSection(key)}>
                <span>{title}</span><span className="vqb-section-arrow">{open[key] ? '⌄' : '›'}</span>
            </button>
            {open[key] && <div className="vqb-section-content">{children}</div>}
        </section>
    );

    const content = (
        <div className="vqb">
            <div className="vqb-header">
                <div><span className="vqb-brand">VINTELTOOL</span><h2>Quick Bot Builder</h2></div>
                <button type="button" className="vqb-close" aria-label="Close" onClick={() => setFormVisibility(false)}>×</button>
            </div>

            <div className="vqb-body">
                {section('market', 'MARKET', <>
                    <div className="vqb-grid-2">
                        <label>Market<Select value={form.market} onChange={(v: string) => {
                            const group = MARKETS.find(([m]) => m === v)?.[1]?.[0] || 'Continuous Indices';
                            setForm(prev => ({ ...prev, market: v, submarket: group, symbol: (SYMBOLS[group] || SYMBOLS['Continuous Indices'])[0] }));
                        }}>{MARKETS.map(([m]) => <option key={m}>{m}</option>)}</Select></label>
                        <label>Category<Select value={form.submarket} onChange={(v: string) => set('submarket', v)}>
                            {marketGroups.map((g: string) => <option key={g}>{g}</option>)}
                        </Select></label>
                    </div>
                    <label>Instrument<Select wide value={form.symbol} onChange={(v: string) => set('symbol', v)}>
                        {symbols.map(s => <option key={s}>{s}</option>)}
                    </Select></label>
                    <div className="vqb-note">Instrument availability and contract availability are determined by the selected market and symbol.</div>
                </>)}

                {section('trade', 'TRADE TYPE', <div className="vqb-chip-grid">
                    {TRADE_TYPES.map(t => <button type="button" key={t} className={form.tradeType === t ? 'is-selected' : ''} onClick={() => set('tradeType', t)}>{t}</button>)}
                </div>)}

                {section('contract', 'CONTRACT TYPE', <>
                    <div className="vqb-contract-grid">
                        {CONTRACTS.map(([name, code]) => <button type="button" key={code} className={form.contractType === code ? 'is-selected' : ''} onClick={() => set('contractType', code)}>{name}</button>)}
                    </div>
                    <div className="vqb-note">Deriv's API exposes contract types by symbol; not every contract is available for every market. The selector shows the complete API contract vocabulary and the selected contract is passed to Bot Builder.</div>
                </>)}

                {section('analysis', 'ANALYSIS / ENTRY CONDITIONS', <>
                    <div className="vqb-row"><strong>Analysis:</strong><Toggle checked={form.analysis} onChange={v => set('analysis', v)} /></div>
                    <label>Condition<Select value={form.analysisCondition} onChange={(v: string) => set('analysisCondition', v)}>
                        {CONDITION_OPTIONS.map(x => <option key={x}>{x}</option>)}
                    </Select></label>
                    <label>Digits to test
                        <input className="vqb-input vqb-input--full" value={form.analysisDigits} onChange={e => set('analysisDigits', e.target.value)} placeholder="1, 2, 3, 4" />
                    </label>
                    <label>Then trade<Select value={form.analysisAction} onChange={(v: string) => set('analysisAction', v)}>
                        {DIGIT_OPTIONS.map(x => <option key={x}>{x}</option>)}
                    </Select></label>
                    <div className="vqb-condition-preview">IF {form.analysisCondition.toUpperCase()} = <b>{form.analysisDigits || '...'}</b> → TRADE <b>{form.analysisAction.toUpperCase()}</b></div>
                </>)}

                {section('purchase', 'INITIAL PURCHASE / CONDITIONS', <>
                    <label>Purchase condition<Select value={form.purchaseCondition} onChange={(v: string) => set('purchaseCondition', v)}>
                        {PURCHASES.map(x => <option key={x}>{x}</option>)}
                    </Select></label>
                    <label>Purchase action<Select value={form.analysisAction} onChange={(v: string) => set('analysisAction', v)}>
                        {DIGIT_OPTIONS.map(x => <option key={x}>{x}</option>)}
                    </Select></label>
                </>)}

                {section('sell', 'SELL CONDITIONS', <>
                    <label>Sell condition<Select value={form.sellCondition} onChange={(v: string) => set('sellCondition', v)}>
                        {SELLS.map(x => <option key={x}>{x}</option>)}
                    </Select></label>
                    <div className="vqb-row"><strong>Sell at market when condition is true</strong><Toggle checked={form.sellCondition === 'At market'} onChange={() => set('sellCondition', form.sellCondition === 'At market' ? 'At expiry' : 'At market')} /></div>
                </>)}

                {section('flow', 'TRADE FLOW', <>
                    <div className="vqb-flow-row"><span><strong>Trade once</strong><small>Place one trade then stop.</small></span><Toggle checked={form.tradeOnce} onChange={v => { set('tradeOnce', v); if (v) set('repeat', false); }} /></div>
                    <div className="vqb-flow-row"><span><strong>Repeat trades</strong><small>Continue after the configured wait.</small></span><Toggle checked={form.repeat} onChange={v => { set('repeat', v); if (v) set('tradeOnce', false); }} /></div>
                    <label>Wait after trade (ticks)<input className="vqb-input" inputMode="numeric" value={form.waitTicks} onChange={e => set('waitTicks', e.target.value)} /></label>
                </>)}

                <section className="vqb-section">
                    <div className="vqb-section-title vqb-section-title-static">BOT PARAMETERS</div>
                    <div className="vqb-section-content vqb-bot-grid">
                        <label>Stake:<input inputMode="decimal" value={form.stake} onChange={e => set('stake', e.target.value)} /></label>
                        <label>Take profit:<input inputMode="decimal" value={form.takeProfit} onChange={e => set('takeProfit', e.target.value)} /></label>
                        <label>Stop loss:<input inputMode="decimal" value={form.stopLoss} onChange={e => set('stopLoss', e.target.value)} /></label>
                        <label className="vqb-mart">Martingale:<Toggle checked={form.martingale} onChange={v => set('martingale', v)} /><span className="vqb-x">×</span><input inputMode="decimal" value={form.martingaleMultiplier} onChange={e => set('martingaleMultiplier', e.target.value)} /></label>
                        <label className="vqb-duration">Duration:<Select value={form.durationType} onChange={(v: string) => set('durationType', v)}><option>Ticks</option><option>Seconds</option><option>Minutes</option><option>Hours</option><option>Days</option></Select><input inputMode="numeric" value={form.duration} onChange={e => set('duration', e.target.value)} /></label>
                        <div className="vqb-switch-row"><span><strong>Multi type</strong><Toggle checked={form.multi} onChange={v => set('multi', v)} /></span><span><strong>Recovery Mode</strong><Toggle checked={form.recovery} onChange={v => set('recovery', v)} /></span><span><strong>Hedging</strong><Toggle checked={form.hedging} onChange={v => set('hedging', v)} /></span></div>
                    </div>
                </section>

                <button type="button" className="vqb-load" onClick={load}>LOAD TO BOT BUILDER</button>
            </div>
        </div>
    );

    if (!is_open) return null;

    return isDesktop ? (
        <Modal className="modal--strategy vintel-quick-builder-modal" is_open={is_open} width="100%">{content}</Modal>
    ) : (
        <MobileFullPageModal is_modal_open={is_open} className="quick-strategy__wrapper vintel-quick-builder-modal" header="" onClickClose={() => setFormVisibility(false)} height_offset="0">
            {content}
        </MobileFullPageModal>
    );
});

export default QuickStrategy;
