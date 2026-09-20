import React from 'react';
import { observer } from 'mobx-react-lite';
import { useFormikContext } from 'formik';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import SymbolSelect from './selects/symbol';
import TradeTypeSelect from './selects/trade-type';
import ContractTypeSelect from './selects/contract-type';
import DurationTypeSelect from './selects/duration-type';
import GrowthRateSelect from './selects/growth-rate-type';
import SellConditions from './selects/sell-conditions';
import QSInput from './inputs/qs-input';
import QSCheckbox from './inputs/qs-toggle-switch';
import { TFormData } from './types';

const Card = ({ title, description, children }: any) => (
    <section className='vintel-qs__card'>
        <div className='vintel-qs__card-head'><h3>{title}</h3>{description && <p>{description}</p>}</div>
        <div className='vintel-qs__card-body'>{children}</div>
    </section>
);

const ValueInput = ({ name, label, ...props }: any) => {
    const { values, setFieldValue } = useFormikContext<TFormData>();
    const { quick_strategy } = useStore();
    return <QSInput name={name} label={label} value={values[name]} onChange={(key: string, value: any) => { quick_strategy.setValue(key, value); setFieldValue(key, value, false); }} {...props} />;
};

const QuickStrategyForm = observer(() => {
    const { quick_strategy } = useStore();
    const { values, setFieldValue } = useFormikContext<TFormData>();
    const { selected_strategy } = quick_strategy;
    const update = (name: string, value: string | number | boolean) => {
        quick_strategy.setValue(name, value);
        setFieldValue(name, value, false);
    };
    React.useEffect(() => {
        quick_strategy.setAdditionalData({
            vinteltool_analysis: values.analysis ?? 'last_digit',
            vinteltool_entry: values.entry_condition ?? 'immediate',
            vinteltool_restart: values.restart_condition ?? 'every_trade',
        });
    }, [values.analysis, values.entry_condition, values.restart_condition]);
    return (
        <div className='vintel-qs'>
            <div className='vintel-qs__intro'>
                <div><span className='vintel-qs__eyebrow'>VINTELTOOL</span><h2>{localize('Strategy Studio')}</h2><p>{localize('Configure your strategy, then load it into Bot Builder as editable blocks.')}</p></div>
                <div className='vintel-qs__strategy-pill'>{selected_strategy.replaceAll('_', ' ')}</div>
            </div>

            <Card title={localize('Trade Parameters')} description={localize('Market, trade type, contract, duration and stake.')}>
                <div className='vintel-qs__grid'>
                    <div><label>{localize('Market')}</label><SymbolSelect /></div>
                    <div><label>{localize('Trade type')}</label><TradeTypeSelect /></div>
                    <div><label>{localize('Contract type')}</label><ContractTypeSelect name='type' /></div>
                    <div><label>{localize('Duration unit')}</label><DurationTypeSelect /></div>
                    <ValueInput name='duration' label={localize('Duration')} type='number' min={1} />
                    <ValueInput name='stake' label={localize('Stake')} type='number' min={0.35} />
                </div>
            </Card>

            <Card title={localize('Analysis')} description={localize('Define the market information used before entry.')}>
                <div className='vintel-qs__grid'>
                    <div className='vintel-qs__field'><label>{localize('Analysis method')}</label><select value={String(values.analysis ?? 'last_digit')} onChange={e => update('analysis', e.target.value)}><option value='last_digit'>{localize('Last digit')}</option><option value='price_action'>{localize('Price action')}</option><option value='trend'>{localize('Trend')}</option><option value='momentum'>{localize('Momentum')}</option></select></div>
                    <div className='vintel-qs__field'><label>{localize('Lookback')}</label><input type='number' min='1' value={String(values.lookback ?? 10)} onChange={e => update('lookback', e.target.value)} /></div>
                </div>
                <div className='vintel-qs__block-preview'><span>ANALYSIS</span><b>{String(values.analysis ?? 'last_digit')}</b><span>→</span><b>{String(values.lookback ?? 10)} periods</b></div>
            </Card>

            <Card title={localize('Entry Conditions')} description={localize('Define the event that starts a contract.')}>
                <div className='vintel-qs__grid'>
                    <div className='vintel-qs__field'><label>{localize('Entry rule')}</label><select value={String(values.entry_condition ?? 'immediate')} onChange={e => update('entry_condition', e.target.value)}><option value='immediate'>{localize('Immediate')}</option><option value='signal'>{localize('When analysis signal matches')}</option><option value='after_win'>{localize('After a winning trade')}</option><option value='after_loss'>{localize('After a losing trade')}</option></select></div>
                    <ValueInput name='last_digit_prediction' label={localize('Prediction / target digit')} type='number' min={0} max={9} />
                </div>
                <div className='vintel-qs__block-preview'><span>ENTRY</span><b>{String(values.entry_condition ?? 'immediate')}</b><span>→</span><b>OPEN CONTRACT</b></div>
            </Card>

            <Card title={localize('Sell Conditions')} description={localize('Set profit and tick limits for the strategy cycle.')}>
                <SellConditions name='sell_conditions' />
                <div className='vintel-qs__grid vintel-qs__compact'><ValueInput name='take_profit' label={localize('Take profit')} type='number' min={0} /><ValueInput name='tick_count' label={localize('Maximum ticks')} type='number' min={0} /></div>
                <div className='vintel-qs__block-preview'><span>SELL</span><b>{values.take_profit ? `PROFIT ≥ ${values.take_profit}` : 'TAKE PROFIT'}</b><span>or</span><b>{values.tick_count ? `TICKS ≥ ${values.tick_count}` : 'TICK LIMIT'}</b></div>
            </Card>

            <Card title={localize('Money Management')} description={localize('Control stake progression and exposure limits.')}>
                <div className='vintel-qs__grid'><div><GrowthRateSelect name='growth_rate' /></div><ValueInput name='max_stake' label={localize('Maximum stake')} type='number' min={0} /><ValueInput name='max_payout' label={localize('Maximum payout')} type='number' min={0} /><ValueInput name='size' label={localize('Multiplier size')} type='number' min={1} /></div>
                <div className='vintel-qs__block-preview'><span>MONEY</span><b>STAKE → LIMIT → PROGRESSION</b></div>
            </Card>

            <Card title={localize('Restart Conditions')} description={localize('Define when the strategy cycle starts again.')}>
                <div className='vintel-qs__grid'><div className='vintel-qs__field'><label>{localize('Restart after')}</label><select value={String(values.restart_condition ?? 'every_trade')} onChange={e => update('restart_condition', e.target.value)}><option value='every_trade'>{localize('Every trade')}</option><option value='win'>{localize('Winning trade')}</option><option value='loss'>{localize('Losing trade')}</option><option value='target'>{localize('Target reached')}</option></select></div><ValueInput name='max_ticks' label={localize('Cycle tick limit')} type='number' min={0} /></div>
            </Card>

            <Card title={localize('Advanced Settings')} description={localize('Optional controls for the generated strategy.')}>
                <div className='vintel-qs__advanced-row'><QSCheckbox name='boolean_max_stake' label={localize('Enable maximum stake')} isEnabledToggleSwitch={!!values.boolean_max_stake} setIsEnabledToggleSwitch={(v: boolean) => update('boolean_max_stake', v)} /><div className='vintel-qs__field'><label>{localize('Analysis confidence')}</label><select value={String(values.confidence ?? 'standard')} onChange={e => update('confidence', e.target.value)}><option value='standard'>{localize('Standard')}</option><option value='strict'>{localize('Strict')}</option><option value='aggressive'>{localize('Aggressive')}</option></select></div></div>
            </Card>
        </div>
    );
});
export default QuickStrategyForm;
