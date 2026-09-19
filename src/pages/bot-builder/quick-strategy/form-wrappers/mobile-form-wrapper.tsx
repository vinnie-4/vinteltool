// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React from 'react';
import classNames from 'classnames';
import { useFormikContext } from 'formik';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import ThemedScrollbars from '@/components/shared_ui/themed-scrollbars';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { STRATEGIES } from '../config';
import { TFormValues } from '../types';
import StrategyTabContent from './strategy-tab-content';
import StrategyTemplatePicker from './strategy-template-picker';
import { QsSteps } from './trade-constants';

type TMobileFormWrapper = {
    children: React.ReactNode;
    selected_trade_type: string;
    setSelectedTradeType: (selected_trade_type: string) => void;
    current_step: QsSteps;
    setCurrentStep: (current_step: QsSteps) => void;
};

const MobileFormWrapper = observer(({
    children,
    current_step,
    selected_trade_type,
    setCurrentStep,
    setSelectedTradeType,
}: TMobileFormWrapper) => {
    const { isValid, validateForm } = useFormikContext<TFormValues>();
    const { quick_strategy } = useStore();
    const { selected_strategy } = quick_strategy;
    const selected_startegy_label = STRATEGIES()[selected_strategy as keyof typeof STRATEGIES].label;
    const is_verified_or_completed_step =
        current_step === QsSteps.StrategyVerified || current_step === QsSteps.StrategyCompleted;
    const is_selected_strategy_step = current_step === QsSteps.StrategySelect;

    React.useEffect(() => { validateForm(); }, [selected_strategy, validateForm]);

    React.useEffect(() => {
        if (isValid && current_step === QsSteps.StrategyVerified) setCurrentStep(QsSteps.StrategyCompleted);
        if (!isValid && current_step === QsSteps.StrategyCompleted) setCurrentStep(QsSteps.StrategyVerified);
    }, [isValid, current_step, setCurrentStep]);

    return (
        <div className='qs qs--professional'>
            <div className='qs__mobile-progress'>
                <button type='button' className={is_selected_strategy_step ? 'is-active' : 'is-complete'} onClick={() => setCurrentStep(QsSteps.StrategySelect)}>
                    <span>01</span>{localize('Template')}
                </button>
                <span className='qs__progress-line' />
                <span className={!is_selected_strategy_step ? 'is-active' : ''}><span>02</span>{localize('Configure')}</span>
            </div>

            <div className='qs__body qs__body--professional'>
                <ThemedScrollbars
                    className={classNames('qs__form__container qs__form__container--footer', {
                        'qs__form__container--template': is_selected_strategy_step,
                    })}
                    autohide={false}
                >
                    {is_selected_strategy_step && (
                        <div className='qs__builder-start'>
                            <div className='qs__builder-intro'>
                                <span className='qs__builder-kicker'>{localize('VintelTool')}</span>
                                <h2>{localize('Choose a bot template')}</h2>
                                <p>{localize('Pick a starting template, then configure it for your bot.')}</p>
                            </div>
                            <StrategyTemplatePicker
                                setSelectedTradeType={setSelectedTradeType}
                                setCurrentStep={setCurrentStep}
                            />
                        </div>
                    )}

                    {is_verified_or_completed_step && (
                        <div className='qs__builder-configure'>
                            <div className='qs__builder-intro qs__builder-intro--compact'>
                                <span className='qs__builder-kicker'>{localize('Bot configuration')}</span>
                                <h2>{localize('Configure your bot')}</h2>
                                <p>{localize('Set your trading and risk controls before loading the bot.')}</p>
                            </div>
                            <div className='qs__selected-options'>
                                <div className='qs__selected-options__item'>
                                    <span className='qs__selected-options__eyebrow'>{localize('Trade type')}</span>
                                    <Text size='xs' weight='bold'>{selected_trade_type}</Text>
                                </div>
                                <div className='qs__selected-options__item'>
                                    <span className='qs__selected-options__eyebrow'>{localize('Bot template')}</span>
                                    <Text className='qs__selected-options__item__description' size='xs' weight='bold'>{selected_startegy_label}</Text>
                                </div>
                            </div>
                            <StrategyTabContent formfields={children} active_tab='TRADE_PARAMETERS' />
                        </div>
                    )}
                </ThemedScrollbars>
            </div>
        </div>
    );
});

export default MobileFormWrapper;
