import React from 'react';
import { observer } from 'mobx-react-lite';
import MobileFullPageModal from '@/components/shared_ui/mobile-full-page-modal';
import Modal from '@/components/shared_ui/modal';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import './quick-strategy.scss';

type FormState = {
    market: string;
    submarket: string;
    symbol: string;
    tradeType: string;
    contractFamily: string;
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
    purchase: string;
    analysis: boolean;
};

const DEFAULTS: FormState = {
    market: 'Derived',
    submarket: 'Continuous Indices',
    symbol: 'Volatility 10 Index',
    tradeType: 'Digits',
    contractFamily: 'Even/Odd',
    contractType: 'Both',
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
    purchase: 'Trade Even',
    analysis: false,
};

const SYMBOLS = ['Volatility 10 Index', 'Volatility 25 Index', 'Volatility 50 Index', 'Volatility 75 Index', 'Volatility 100 Index'];
const SYMBOL_CODES: Record<string, string> = {
    'Volatility 10 Index': 'R_10',
    'Volatility 25 Index': 'R_25',
    'Volatility 50 Index': 'R_50',
    'Volatility 75 Index': 'R_75',
    'Volatility 100 Index': 'R_100',
};

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

    const load = () => {
        localStorage.setItem('vinteltool-quick-bot-config', JSON.stringify(form));
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.derivWorkspace;
        if (!Blockly || !workspace) {
            setFormVisibility(false);
            return;
        }

        const symbol = SYMBOL_CODES[form.symbol] || 'R_10';
        const contract = form.purchase === 'Trade Odd' ? 'DIGITODD' : 'DIGITEVEN';
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
                <field name="TYPE_LIST">${contract}</field>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
  <block type="trade_definition_tradeoptions" x="20" y="230">
    <field name="DURATIONTYPE_LIST">${form.durationType.toLowerCase()}</field>
    <field name="CURRENCY_LIST">USD</field>
    <value name="DURATION"><shadow type="math_number"><field name="NUM">${Number(form.duration) || 1}</field></shadow></value>
    <value name="AMOUNT"><shadow type="math_number"><field name="NUM">${Number(form.stake) || 1}</field></shadow></value>
  </block>
  <block type="before_purchase" x="20" y="410">
    <statement name="BEFOREPURCHASE">
      <block type="purchase">
        <field name="PURCHASE_LIST">${contract}</field>
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
            // Keep the existing workspace intact if a block definition is unavailable.
        }
        setFormVisibility(false);
    };

    const content = (
        <div className="vqb">
            <div className="vqb-header">
                <h2>Quick Bot Builder</h2>
                <button type="button" className="vqb-close" aria-label="Close" onClick={() => setFormVisibility(false)}>×</button>
            </div>

            <div className="vqb-body">
                <section className="vqb-section">
                    <div className="vqb-section-title">TRADE PARAMETERS</div>
                    <div className="vqb-section-content">
                        <div className="vqb-row vqb-market-row">
                            <label>Market:</label>
                            <Select value={form.market} onChange={(v: string) => set('market', v)}><option>Derived</option></Select>
                            <span className="vqb-chevron">›</span>
                            <Select value={form.submarket} onChange={(v: string) => set('submarket', v)}><option>Continuous Indices</option></Select>
                            <span className="vqb-chevron">›</span>
                        </div>
                        <Select wide value={form.symbol} onChange={(v: string) => set('symbol', v)}>
                            {SYMBOLS.map(s => <option key={s}>{s}</option>)}
                        </Select>
                        <div className="vqb-row vqb-trade-row">
                            <strong>Trade type:</strong>
                            <Select value={form.tradeType} onChange={(v: string) => set('tradeType', v)}><option>Digits</option></Select>
                            <Select value={form.contractFamily} onChange={(v: string) => set('contractFamily', v)}><option>Even/Odd</option><option>Over/Under</option></Select>
                        </div>
                        <div className="vqb-row vqb-contract-row">
                            <strong>Contract type:</strong>
                            <Select value={form.contractType} onChange={(v: string) => set('contractType', v)}><option>Both</option><option>Single</option></Select>
                        </div>
                        <div className="vqb-switch-row">
                            <span><strong>Multi type:</strong><Toggle checked={form.multi} onChange={v => set('multi', v)} /></span>
                            <span><strong>Recovery Mode:</strong><Toggle checked={form.recovery} onChange={v => set('recovery', v)} /></span>
                            <span><strong>Hedging:</strong><Toggle checked={form.hedging} onChange={v => set('hedging', v)} /></span>
                        </div>
                    </div>
                </section>

                <section className="vqb-section">
                    <div className="vqb-section-title">BOT PARAMETERS</div>
                    <div className="vqb-section-content vqb-bot-grid">
                        <label>Stake:<input inputMode="decimal" value={form.stake} onChange={e => set('stake', e.target.value)} /></label>
                        <label>Take profit:<input inputMode="decimal" value={form.takeProfit} onChange={e => set('takeProfit', e.target.value)} /></label>
                        <label>Stop loss:<input inputMode="decimal" value={form.stopLoss} onChange={e => set('stopLoss', e.target.value)} /></label>
                        <label className="vqb-mart">Martingale: <Toggle checked={form.martingale} onChange={v => set('martingale', v)} /><span className="vqb-x">x</span><input inputMode="decimal" value={form.martingaleMultiplier} onChange={e => set('martingaleMultiplier', e.target.value)} /></label>
                        <label className="vqb-duration">Duration:
                            <Select value={form.durationType} onChange={(v: string) => set('durationType', v)}><option>Ticks</option><option>Minutes</option></Select>
                            <input inputMode="numeric" value={form.duration} onChange={e => set('duration', e.target.value)} />
                        </label>
                    </div>
                </section>

                <section className="vqb-section">
                    <div className="vqb-section-title vqb-initial-title">
                        <span>INITIAL PURCHASE</span>
                        <span className="vqb-analysis">ENABLE ANALYSIS <Toggle checked={form.analysis} onChange={v => set('analysis', v)} /></span>
                    </div>
                    <div className="vqb-section-content vqb-purchase">
                        <strong>Purchase</strong>
                        <Select value={form.purchase} onChange={(v: string) => set('purchase', v)}>
                            <option>Trade Even</option>
                            <option>Trade Odd</option>
                            <option>Trade Over</option>
                            <option>Trade Under</option>
                        </Select>
                    </div>
                </section>

                <button type="button" className="vqb-load" onClick={load}>LOAD</button>
            </div>
        </div>
    );

    if (!is_open) return null;

    return isDesktop ? (
        <Modal className="modal--strategy vintel-quick-builder-modal" is_open={is_open} width="42rem">{content}</Modal>
    ) : (
        <MobileFullPageModal is_modal_open={is_open} className="quick-strategy__wrapper vintel-quick-builder-modal" header="" onClickClose={() => setFormVisibility(false)} height_offset="0">
            {content}
        </MobileFullPageModal>
    );
});

export default QuickStrategy;
