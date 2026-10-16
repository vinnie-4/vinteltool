// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React, { useRef, useState } from 'react';
import { Form as FormikForm, Formik, useFormikContext } from 'formik';
import { observer } from 'mobx-react-lite';
import * as Yup from 'yup';
import Modal from '@/components/shared_ui/modal';
import { config as qs_config } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
// Removed import for rudderStackSendCloseEvent as per V2 requirements - no close events needed
import { QsSteps } from './form-wrappers/trade-constants';
import LossThresholdWarningDialog from './parts/loss-threshold-warning-dialog';
import { STRATEGIES } from './config';
import Form from './form';
import { TConfigItem, TFormData } from './types';
import './quick-strategy.scss';

type TFormikWrapper = {
    children: React.ReactNode;
};

const getErrorMessage = (dir: 'MIN' | 'MAX', value: number, type = 'DEFAULT') => {
    const errors: { [key: string]: { MIN: string; MAX: string } } = {
        DURATION: {
            MIN: localize('Minimum duration: {{ value }}', { value }),
            MAX: localize('Maximum duration: {{ value }}', { value }),
        },
        LAST_DIGIT_PREDICTION: {
            MIN: localize('Enter a value from {{ value }} to 9.', { value }),
            MAX: localize('Enter a value from 0 to {{ value }}.', { value }),
        },
        DEFAULT: {
            MIN: localize('The value must be equal or greater than {{ value }}', { value }),
            MAX: localize('The value must be equal or less than {{ value }}', { value }),
        },
    };
    return errors[type][dir];
};

const FormikWrapper: React.FC<TFormikWrapper> = observer(({ children }) => {
    const { quick_strategy } = useStore();
    const { selected_strategy, form_data, initializeLossThresholdWarningData } = quick_strategy;
    const config: TConfigItem[][] = STRATEGIES()[selected_strategy]?.fields;
    const [dynamic_schema, setDynamicSchema] = useState(Yup.object().shape({}));
    const is_mounted = useRef(true);

    let initial_value: TFormData | null = null;

    const getSavedValues = () => {
        let data: TFormData | null = null;
        try {
            data = JSON.parse(localStorage.getItem('qs-fields') ?? '{}');
        } catch {
            data = null;
        }
        return data;
    };

    const getInitialValue = () => {
        const data = getSavedValues();
        initial_value = {
            symbol: data?.symbol ?? qs_config().QUICK_STRATEGY.DEFAULT.symbol,
            tradetype: data?.tradetype ?? '',
            type: data?.type ?? '',
            durationtype: data?.durationtype ?? qs_config().QUICK_STRATEGY.DEFAULT.durationtype,
            duration: data?.duration ?? '1',
            stake: data?.stake ?? '1',
            loss: data?.loss ?? '',
            profit: data?.profit ?? '',
            size: data?.size ?? String(qs_config().QUICK_STRATEGY.DEFAULT.size),
            unit: data?.unit ?? String(qs_config().QUICK_STRATEGY.DEFAULT.unit),
            action: data?.action ?? 'RUN',
            max_stake: data?.max_stake ?? 10,
            boolean_max_stake: data?.boolean_max_stake ?? false,
            last_digit_prediction: data?.last_digit_prediction ?? 1,
            growth_rate: data?.growth_rate ?? '0.01',
            tick_count: data?.tick_count ?? 0,
            take_profit: data?.take_profit ?? 0,
            boolean_tick_count: data?.boolean_tick_count ?? false,
            max_payout: data?.max_payout ?? 0,
            max_ticks: data?.max_ticks ?? 0,
        };
        return initial_value;
    };

    React.useEffect(() => {
        return () => {
            is_mounted.current = false;
        };
    }, []);

    React.useEffect(() => {
        initializeLossThresholdWarningData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateSchema = (formikData: TFormData) => {
        const sub_schema: Record<string, any> = {};
        config.forEach(group => {
            if (!group?.length) return null;
            group.forEach(field => {
                if (field?.validation?.length && field?.name) {
                    if (field.validation.includes('number')) {
                        let schema: Record<string, any> = Yup.number().typeError(localize('Must be a number'));
                        let min = 0;
                        let max = 10;
                        let min_error = getErrorMessage('MIN', min);
                        let max_error = getErrorMessage('MAX', max);
                        let integer_error_message = '';
                        const { current_duration_min_max } = quick_strategy;
                        if (field.name === 'duration' && current_duration_min_max) {
                            min = current_duration_min_max.min;
                            max = current_duration_min_max.max;
                            min_error = getErrorMessage('MIN', min, 'DURATION');
                            max_error = getErrorMessage('MAX', max, 'DURATION');
                        }
                        const should_validate = field.should_have
                            ? field.should_have?.every(item => {
                                  const item_value = formikData?.[item.key]?.toString();
                                  if (item.multiple) return item.multiple.includes(item_value);
                                  return formikData?.[item.key] === item.value;
                              })
                            : true;
                        if (should_validate && field.name === 'max_stake') {
                            min = +form_data?.stake;
                            if (isNaN(min)) {
                                min = +(initial_value?.stake ?? 0);
                            }
                            min_error = getErrorMessage('MIN', min);
                        }
                        if (should_validate && field.name === 'last_digit_prediction') {
                            min = 0;
                            max = 9;
                            max_error = getErrorMessage('MAX', max, 'LAST_DIGIT_PREDICTION');
                            integer_error_message = localize('Enter a value from 0 to 9.');
                        }
                        if (should_validate) {
                            field.validation.forEach(validation => {
                                if (typeof validation === 'string') {
                                    switch (validation) {
                                        case 'required':
                                            schema = schema.required(localize('Field cannot be empty'));
                                            break;
                                        case 'min':
                                            schema = schema.min(min, min_error);
                                            break;
                                        case 'max':
                                            schema = schema.max(max, max_error);
                                            break;
                                        case 'ceil':
                                            schema = schema.round('ceil');
                                            break;
                                        case 'floor':
                                            schema = schema.round('floor');
                                            break;
                                        case 'integer':
                                            schema = schema.integer(integer_error_message);
                                            break;
                                        default:
                                            break;
                                    }
                                } else if (typeof validation === 'object') {
                                    if (validation?.type) {
                                        // Use dynamic value if available
                                        const value = validation.getDynamicValue
                                            ? validation.getDynamicValue(quick_strategy)
                                            : validation.value;

                                        schema = schema[validation.type](value, localize(validation.getMessage(value)));
                                    }
                                }
                            });
                        }
                        sub_schema[field.name] = schema;
                    }
                }
            });
        });
        if (is_mounted.current) {
            setDynamicSchema(Yup.object().shape(sub_schema));
        }
    };

    const handleSubmit = (form_data: TFormData) => {
        updateSchema(form_data);
        localStorage?.setItem('qs-fields', JSON.stringify(form_data));
        return form_data;
    };

    return (
        <Formik
            initialValues={getInitialValue()}
            validationSchema={dynamic_schema}
            onSubmit={handleSubmit}
            validate={values => updateSchema(values)}
            validateOnChange={false}
        >
            {children}
        </Formik>
    );
});

const QuickStrategy = observer(() => {
    const { quick_strategy } = useStore();
    const { is_open, setFormVisibility } = quick_strategy;

    const [current_step, setCurrentStep] = React.useState(QsSteps.StrategySelect);
    const [selected_trade_type, setSelectedTradeType] = React.useState('');

    // Prevent body scrolling when modal is open
    React.useEffect(() => {
        if (is_open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [is_open]);

    const handleClose = () => {
        // Removed close event tracking as per V2 requirements
        setFormVisibility(false);
    };

    return (
        <FormikWrapper>
            <FormikForm>
                <LossThresholdWarningDialog />
                <Modal className='vintel-quick-builder-modal modal--strategy' is_open={is_open} width='72rem'>
                    <VintelQuickBotBuilder onClose={handleClose} />
                </Modal>
            </FormikForm>
        </FormikWrapper>
    );
});

const VintelQuickBotBuilder = observer(({ onClose }: { onClose: () => void }) => {
    const { quick_strategy } = useStore();
    const { values, setFieldValue } = useFormikContext();
    const [marketGroup, setMarketGroup] = React.useState('Derived');
    const [marketType, setMarketType] = React.useState('Continuous Indices');
    const [symbol, setSymbol] = React.useState('R_10');
    const [scanAll, setScanAll] = React.useState('All Volatility Indices');
    const [simultaneous, setSimultaneous] = React.useState(false);
    const [alternate, setAlternate] = React.useState(false);
    const [runs, setRuns] = React.useState('1');
    const [tradeFamily, setTradeFamily] = React.useState('Digits');
    const [tradeType, setTradeType] = React.useState('Even/Odd');
    const [contract, setContract] = React.useState('Both');
    const [multi, setMulti] = React.useState(false);
    const [recovery, setRecovery] = React.useState(false);
    const [hedging, setHedging] = React.useState(false);
    const [stake, setStake] = React.useState('1');
    const [profit, setProfit] = React.useState('10');
    const [loss, setLoss] = React.useState('30');
    const [martingale, setMartingale] = React.useState(true);
    const [multiplier, setMultiplier] = React.useState('2');
    const [durationType, setDurationType] = React.useState('t');
    const [duration, setDuration] = React.useState('1');
    const [purchase, setPurchase] = React.useState('Trade Even');
    const [analysis, setAnalysis] = React.useState(false);
    const [openSections, setOpenSections] = React.useState({ trade: true, bot: true, purchase: true });
    const toggleSection = (key: string) => setOpenSections(old => ({ ...old, [key]: !old[key] }));
    const toggle = (value: boolean, setter: (value: boolean) => void) => <button type='button' className={`vqb-toggle ${value ? 'is-on' : ''}`} aria-pressed={value} onClick={() => setter(!value)}><span /></button>;
    const field = (label: string, value: string, setter: (value: string) => void, options: string[]) => <label>{label}<select className='vqb-select' value={value} onChange={e => setter(e.target.value)}>{options.map(o => <option key={o}>{o}</option>)}</select></label>;
    const input = (label: string, value: string, setter: (value: string) => void) => <label>{label}<input className='vqb-input' type='number' min='0' value={value} onChange={e => setter(e.target.value)} /></label>;
    const load = async () => {
        await setFieldValue('symbol', symbol);
        await setFieldValue('tradetype', tradeType === 'Even/Odd' ? 'DIGITEVEN' : tradeType === 'Over/Under' ? 'DIGITOVER' : tradeType);
        await setFieldValue('type', contract.toLowerCase());
        await setFieldValue('stake', stake);
        await setFieldValue('profit', profit);
        await setFieldValue('loss', loss);
        await setFieldValue('durationtype', durationType);
        await setFieldValue('duration', duration);
        await setFieldValue('action', 'EDIT');
        const payload = { ...values, symbol, tradetype: tradeType === 'Even/Odd' ? 'DIGITEVEN' : tradeType === 'Over/Under' ? 'DIGITOVER' : tradeType, type: contract.toLowerCase(), stake, profit, loss, durationtype: durationType, duration, action: 'EDIT' };
        quick_strategy.onSubmit(payload);
    };
    return <div className='vqb'>
        <header className='vqb-header'><div><h2>Quick Bot Builder</h2></div><button type='button' className='vqb-close' aria-label='Close Quick Bot Builder' onClick={onClose}>×</button></header>
        <main className='vqb-body'>
            <section className='vqb-section'><button type='button' className='vqb-section-title' onClick={() => toggleSection('trade')}>TRADE PARAMETERS <span className='vqb-section-arrow'>{openSections.trade ? '−' : '+'}</span></button>
            {openSections.trade && <div className='vqb-section-content'>
                <div className='vqb-market-grid'>{field('Market',marketGroup,setMarketGroup,['Derived','Forex','Commodities'])}{field('Index type',marketType,setMarketType,['Continuous Indices','Continuous Indices 1s'])}<label>Market symbol<select className='vqb-select' value={symbol} onChange={e => setSymbol(e.target.value)}><optgroup label='Volatility Indices (1s)'><option value='1HZ100V'>Volatility 100 (1s) Index</option><option value='1HZ10V'>Volatility 10 (1s) Index</option><option value='1HZ15V'>Volatility 15 (1s) Index</option><option value='1HZ25V'>Volatility 25 (1s) Index</option><option value='1HZ30V'>Volatility 30 (1s) Index</option><option value='1HZ50V'>Volatility 50 (1s) Index</option><option value='1HZ75V'>Volatility 75 (1s) Index</option><option value='1HZ90V'>Volatility 90 (1s) Index</option></optgroup><optgroup label='Volatility Indices'><option value='R_10'>Volatility 10 Index</option><option value='R_100'>Volatility 100 Index</option><option value='R_25'>Volatility 25 Index</option><option value='R_50'>Volatility 50 Index</option><option value='R_75'>Volatility 75 Index</option></optgroup></select></label></div>
                <div className='vqb-row vqb-inline'><b>Alternate markets (Continuous Indices only):</b>{toggle(alternate,setAlternate)}<span>every</span><input className='vqb-input' type='number' value={runs} onChange={e=>setRuns(e.target.value)} /><span>run(s)</span></div>
                <div className='vqb-row vqb-inline'><b>Scan</b><select className='vqb-select' value={scanAll} onChange={e=>setScanAll(e.target.value)}><option>All Volatility Indices</option><option>Selected market only</option></select><b>simultaneously</b>{toggle(simultaneous,setSimultaneous)}</div>
                <div className='vqb-row vqb-inline'><b>Trade type:</b>{field('',tradeFamily,setTradeFamily,['Digits','Up/Down'])}{field('',tradeType,setTradeType,['Even/Odd','Over/Under','Matches/Differs','Rise/Fall'])}</div>
                <div className='vqb-row vqb-inline'><b>Contract type:</b>{field('',contract,setContract,['Both','Even','Odd','Over','Under','Rise','Fall'])}</div>
                <div className='vqb-switch-row'><span><b>Multi type:</b>{toggle(multi,setMulti)}</span><span><b>Recovery Mode</b>{toggle(recovery,setRecovery)}</span><span><b>Hedging:</b>{toggle(hedging,setHedging)}</span></div>
            </div>}</section>
            <section className='vqb-section'><button type='button' className='vqb-section-title' onClick={() => toggleSection('bot')}>BOT PARAMETERS <span className='vqb-section-arrow'>{openSections.bot ? '−' : '+'}</span></button>
            {openSections.bot && <div className='vqb-section-content'><div className='vqb-bot-grid'>{input('Stake:',stake,setStake)}{input('Take profit:',profit,setProfit)}{input('Stop loss:',loss,setLoss)}<label className='vqb-mart'>Martingale {toggle(martingale,setMartingale)}<b>x</b><input type='number' value={multiplier} onChange={e=>setMultiplier(e.target.value)} disabled={!martingale}/></label><label className='vqb-duration'>Duration: <select className='vqb-select' value={durationType} onChange={e=>setDurationType(e.target.value)}><option value='t'>Ticks</option><option value='s'>Seconds</option><option value='m'>Minutes</option></select><input type='number' value={duration} onChange={e=>setDuration(e.target.value)} /></label></div></div>}</section>
            <section className='vqb-section'><div className='vqb-section-title vqb-section-title-static'>INITIAL PURCHASE <span className='vqb-analysis'>ENABLE ANALYSIS {toggle(analysis,setAnalysis)}</span></div><div className='vqb-section-content'><div className='vqb-row vqb-inline'><b>Purchase</b>{field('',purchase,setPurchase,['Trade Even','Trade Odd','Over','Under','Matches','Differs'])}</div></div></section>
            <button type='button' className='vqb-load' onClick={load}>LOAD</button>
        </main>
    </div>;
});

export default QuickStrategy;

// Vercel redeploy trigger: 2026-10-02T12:41:40.101Z
