import React from 'react';
import { useFormikContext } from 'formik';
import { observer } from 'mobx-react-lite';
import Button from '@/components/shared_ui/button';
import Text from '@/components/shared_ui/text';
import ThemedScrollbars from '@/components/shared_ui/themed-scrollbars';
import { useStore } from '@/hooks/useStore';
import { LegacyClose1pxIcon } from '@deriv/quill-icons/Legacy';
import { localize } from '@deriv-com/translations';
import { STRATEGIES } from '../config';
import { TFormData, TFormValues } from '../types';
import QSStepper from './qs-stepper';
import StrategyTabContent from './strategy-tab-content';
import StrategyTemplatePicker from './strategy-template-picker';
import { QsSteps } from './trade-constants';

type TDesktopFormWrapper = {
    children: React.ReactNode;
    current_step: QsSteps;
    setCurrentStep: (current_step: QsSteps) => void;
    onClickClose: () => void;
    selected_trade_type: string;
    setSelectedTradeType: (selected_trade_type: string) => void;
};

const QuickSelectionPanel = ({
    selected_trade_type,
    selected_startegy_label,
    children,
}: Pick<TDesktopFormWrapper, 'selected_trade_type' | 'children'> & { selected_startegy_label: string }) => (
    <div className='qb-studio__configure'>
        <div className='qb-studio__section'>
            <div className='qb-studio__section-head'>
                <div><span className='qb-studio__eyebrow'>01</span><h3>{localize('Market & Entry')}</h3></div>
                <p>{localize('Define the market, contract and entry setup for your bot.')}</p>
            </div>
            <div className='qb-studio__selection'>
                <div><span>{localize('Trade type')}</span><strong>{selected_trade_type || '—'}</strong></div>
                <div><span>{localize('Strategy')}</span><strong>{selected_startegy_label}</strong></div>
            </div>
            <StrategyTabContent formfields={children} active_tab={'TRADE_PARAMETERS'} />
        </div>
        <div className='qb-studio__cycle'>
            <div className='qb-studio__section-head'>
                <div><span className='qb-studio__eyebrow'>02</span><h3>{localize('Trade Cycle')}</h3></div>
                <p>{localize('Visualize how the configured bot handles each trade result.')}</p>
            </div>
            <div className='qb-studio__cycle-flow'>
                <div><b>SIGNAL</b><span>Entry conditions</span></div><i>↓</i>
                <div><b>ENTRY</b><span>Place trade</span></div><i>↓</i>
                <div className='qb-studio__cycle-split'><div><b>WIN</b><span>Reset / continue</span></div><div><b>LOSS</b><span>Recovery / continue</span></div></div>
            </div>
        </div>
    </div>
);

const FormWrapper = observer(({ children, current_step, setCurrentStep, onClickClose, selected_trade_type, setSelectedTradeType }: TDesktopFormWrapper) => {
    const scroll_ref = React.useRef<HTMLDivElement & SVGSVGElement>(null);
    const { submitForm, isValid, setFieldValue, setValues, validateForm, values } = useFormikContext<TFormValues>();
    const { quick_strategy } = useStore();
    const { selected_strategy, onSubmit, is_stop_bot_dialog_open } = quick_strategy;
    const selected_startegy_label = STRATEGIES()[selected_strategy as keyof typeof STRATEGIES].label;
    const is_selected_strategy_step = current_step === QsSteps.StrategySelect;
    const [save_state, setSaveState] = React.useState('');

    React.useEffect(() => {
        if (isValid && current_step === QsSteps.StrategyVerified) setCurrentStep(QsSteps.StrategyCompleted);
        if (!isValid && current_step === QsSteps.StrategyCompleted) setCurrentStep(QsSteps.StrategyVerified);
    }, [isValid, current_step, setCurrentStep]);

    React.useEffect(() => { validateForm(); }, [selected_strategy, validateForm]);

    const saveStrategy = () => {
        localStorage.setItem('vinteltool-quick-bot-builder', JSON.stringify(values));
        setSaveState(localize('Saved'));
        window.setTimeout(() => setSaveState(''), 1600);
    };

    const loadStrategy = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('vinteltool-quick-bot-builder') || 'null');
            if (saved && typeof saved === 'object') {
                setValues(saved);
                setSaveState(localize('Loaded'));
            } else setSaveState(localize('No saved strategy'));
        } catch { setSaveState(localize('No saved strategy')); }
        window.setTimeout(() => setSaveState(''), 1600);
    };

    const onLoad = async () => {
        await setFieldValue('action', 'EDIT');
        const errors = await validateForm();
        if (Object.keys(errors).length) return;
        const form_data = { ...values, action: 'EDIT' } as TFormData;
        await submitForm();
        await onSubmit(form_data);
        onClickClose();
    };

    const renderContent = React.useCallback(() => {
        if (is_selected_strategy_step) return (
            <div className='qb-studio__start'>
                <div className='qb-studio__hero'>
                    <span className='qb-studio__eyebrow'>{localize('VintelTool Strategy Studio')}</span>
                    <h2>{localize('Build your bot strategy')}</h2>
                    <p>{localize('Choose a starting strategy, then configure the market, entry rules and risk controls before loading it into Bot Builder.')}</p>
                </div>
                <StrategyTemplatePicker setCurrentStep={setCurrentStep} setSelectedTradeType={setSelectedTradeType} />
            </div>
        );
        return (
            <div className='qb-studio__workspace'>
                <div className='qb-studio__main'><QuickSelectionPanel selected_trade_type={selected_trade_type} selected_startegy_label={selected_startegy_label}>{children}</QuickSelectionPanel></div>
                <aside className='qb-studio__preview'>
                    <div className='qb-studio__preview-head'><div><span className='qb-studio__eyebrow'>{localize('Live preview')}</span><h3>{localize('Strategy Preview')}</h3></div><span className='qb-studio__ready'><span />{localize('Ready')}</span></div>
                    <div className='qb-studio__preview-title'>{values.symbol || 'Market'} · {values.tradetype || 'Contract'}</div>
                    <div className='qb-studio__preview-list'>
                        <div><span>{localize('Entry')}</span><strong>{values.last_digit_prediction !== undefined ? localize('Digit prediction') + ' · ' + values.last_digit_prediction : localize('Configured')}</strong></div>
                        <div><span>{localize('Stake')}</span><strong>{values.stake || '—'}</strong></div>
                        <div><span>{localize('Duration')}</span><strong>{(values.duration || '—') + ' ' + (values.durationtype || '')}</strong></div>
                        <div><span>{localize('After loss')}</span><strong>{selected_startegy_label}</strong></div>
                        <div><span>{localize('Stop loss')}</span><strong>{values.loss || '—'}</strong></div>
                        <div><span>{localize('Take profit')}</span><strong>{values.profit || '—'}</strong></div>
                    </div>
                    <div className='qb-studio__preview-note'>{localize('Review the configuration, validate it, then load the generated strategy into Bot Builder.')}</div>
                </aside>
            </div>
        );
    }, [children, is_selected_strategy_step, selected_startegy_label, selected_trade_type, setCurrentStep, setSelectedTradeType, values]);

    return !is_stop_bot_dialog_open && (
        <div className='qs qb-studio'>
            <header className='qb-studio__header'>
                <div className='qb-studio__brand'><div className='qb-studio__mark'>VT</div><div><strong>{localize('Quick Bot Builder')}</strong><span>{localize('Strategy Studio')}</span></div></div>
                <div className='qb-studio__actions'>
                    {!is_selected_strategy_step && <><button type='button' onClick={saveStrategy}>{localize('Save Strategy')}</button><button type='button' onClick={loadStrategy}>{localize('Load Strategy')}</button>{save_state && <span className='qb-studio__toast'>{save_state}</span>}</>}
                    <button className='qb-studio__close' type='button' onClick={onClickClose} aria-label={localize('Close')}><LegacyClose1pxIcon height='20px' width='20px' /></button>
                </div>
            </header>
            <div className='qb-studio__steps'><div className={is_selected_strategy_step ? 'active' : 'complete'}><b>01</b>{localize('Strategy')}</div><span /><div className={!is_selected_strategy_step ? 'active' : ''}><b>02</b>{localize('Configure')}</div><div className='qb-studio__step-status'><span />{localize('Bot Builder connected')}</div></div>
            <div className='qb-studio__body'>
                <div className='qb-studio__sidebar'><QSStepper current_step={current_step} /></div>
                <ThemedScrollbars className='qs__form__container qs__form__container--footer' autohide={false} refSetter={scroll_ref}>{renderContent()}</ThemedScrollbars>
            </div>
            {!is_selected_strategy_step && <footer className='qb-studio__footer'><Button transparent onClick={() => setCurrentStep(QsSteps.StrategySelect)}>{localize('Back')}</Button><Button primary disabled={!isValid || quick_strategy.is_options_loading} onClick={onLoad}>{localize('Load into Bot Builder')}</Button></footer>}
        </div>
    );
});

export default React.memo(FormWrapper);
