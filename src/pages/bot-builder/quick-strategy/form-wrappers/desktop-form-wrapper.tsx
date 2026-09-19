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
    <>
        <div className='qs__selected-options'>
            <div className='qs__selected-options__item'>
                <span className='qs__selected-options__eyebrow'>{localize('Trade type')}</span>
                <Text size='xs' weight='bold' lineHeight='s'>{selected_trade_type}</Text>
            </div>
            <div className='qs__selected-options__item'>
                <span className='qs__selected-options__eyebrow'>{localize('Bot template')}</span>
                <Text className='qs__selected-options__item__description' weight='bold' lineHeight='s'>{selected_startegy_label}</Text>
            </div>
            <div className='qs__selected-options__status'>
                <span className='qs__status-dot' />
                <span>{localize('Ready to configure')}</span>
            </div>
        </div>
        <StrategyTabContent formfields={children} active_tab='TRADE_PARAMETERS' />
    </>
);

const FormWrapper = observer(({
    children,
    current_step,
    setCurrentStep,
    onClickClose,
    selected_trade_type,
    setSelectedTradeType,
}: TDesktopFormWrapper) => {
    const scroll_ref = React.useRef<HTMLDivElement & SVGSVGElement>(null);
    const { submitForm, isValid, setFieldValue, validateForm, values } = useFormikContext<TFormValues>();
    const { quick_strategy } = useStore();
    const { selected_strategy, onSubmit, is_stop_bot_dialog_open } = quick_strategy;
    const selected_startegy_label = STRATEGIES()[selected_strategy as keyof typeof STRATEGIES].label;
    const is_selected_strategy_step = current_step === QsSteps.StrategySelect;

    React.useEffect(() => {
        if (isValid && current_step === QsSteps.StrategyVerified) setCurrentStep(QsSteps.StrategyCompleted);
        if (!isValid && current_step === QsSteps.StrategyCompleted) setCurrentStep(QsSteps.StrategyVerified);
    }, [isValid, current_step, setCurrentStep]);

    React.useEffect(() => { validateForm(); }, [selected_strategy, validateForm]);

    const onLoad = async () => {
        await setFieldValue('action', 'EDIT');
        const errors = await validateForm();
        if (Object.keys(errors).length) return;
        const form_data = { ...values, action: 'EDIT' } as TFormData;
        await submitForm();
        await onSubmit(form_data);
        onClickClose();
    };

    const onBack = () => setCurrentStep(QsSteps.StrategySelect);

    const renderContent = React.useCallback(() => {
        if (is_selected_strategy_step) {
            return (
                <div className='qs__builder-start'>
                    <div className='qs__builder-intro'>
                        <span className='qs__builder-kicker'>{localize('VintelTool')}</span>
                        <h2>{localize('Choose a bot template')}</h2>
                        <p>{localize('Start with a trading template, then configure the rules and risk controls before loading it into Bot Builder.')}</p>
                    </div>
                    <StrategyTemplatePicker setCurrentStep={setCurrentStep} setSelectedTradeType={setSelectedTradeType} />
                </div>
            );
        }

        return (
            <div className='qs__builder-configure'>
                <div className='qs__builder-intro qs__builder-intro--compact'>
                    <span className='qs__builder-kicker'>{localize('Bot configuration')}</span>
                    <h2>{localize('Configure your bot')}</h2>
                    <p>{localize('Set the market, contract, stake and risk controls. Nothing is loaded until you press Load into Bot Builder.')}</p>
                </div>
                <QuickSelectionPanel selected_trade_type={selected_trade_type} selected_startegy_label={selected_startegy_label}>
                    {children}
                </QuickSelectionPanel>
            </div>
        );
    }, [
        children,
        is_selected_strategy_step,
        selected_startegy_label,
        selected_trade_type,
        setCurrentStep,
        setSelectedTradeType,
    ]);

    return !is_stop_bot_dialog_open && (
        <div className='qs qs--professional'>
            <header className='qs__head'>
                <div className='qs__brand'>
                    <span className='qs__brand-mark'>QB</span>
                    <div>
                        <Text weight='bold'>{localize('Quick Bot Builder')}</Text>
                        <span>{localize('Build a strategy. Load it into your bot.')}</span>
                    </div>
                </div>
                <button className='qs__close' type='button' onClick={onClickClose} aria-label={localize('Close')}>
                    <LegacyClose1pxIcon height='20px' width='20px' />
                </button>
            </header>

            <div className='qs__progress'>
                <button type='button' className={is_selected_strategy_step ? 'is-active' : 'is-complete'} onClick={() => setCurrentStep(QsSteps.StrategySelect)}>
                    <span>01</span>{localize('Template')}
                </button>
                <span className='qs__progress-line' />
                <button type='button' className={!is_selected_strategy_step ? 'is-active' : ''} disabled={is_selected_strategy_step}>
                    <span>02</span>{localize('Configure')}
                </button>
                <div className='qs__progress-spacer' />
                <span className='qs__live-pill'><span className='qs__status-dot' />{localize('Bot Builder ready')}</span>
            </div>

            <main className='qs__body qs__body--professional'>
                <ThemedScrollbars
                    className='qs__form__container qs__form__container--footer'
                    autohide={false}
                    refSetter={scroll_ref}
                >
                    {renderContent()}
                </ThemedScrollbars>

                {!is_selected_strategy_step && (
                    <footer className='qs__body__content__footer'>
                        <Button transparent classNameSpan='qs__body__content__footer--back' onClick={onBack}>
                            {localize('Back')}
                        </Button>
                        <Button primary disabled={!isValid || quick_strategy.is_options_loading} onClick={onLoad}>
                            {localize('Load into Bot Builder')}
                        </Button>
                    </footer>
                )}
            </main>
        </div>
    );
});

export default React.memo(FormWrapper);
