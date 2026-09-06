import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import ContractResultOverlay from '@/components/contract-result-overlay';
import ExecutionControl from '@/components/run-panel/execution-control';
import { DBOT_TABS } from '@/constants/bot-contents';
import { contract_stages } from '@/constants/contract-stage';
import { useStore } from '@/hooks/useStore';
import { LabelPairedPlayLgFillIcon, LabelPairedSquareLgFillIcon } from '@deriv/quill-icons/LabelPaired';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
/* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
/* [/AI] */
import Button from '../shared_ui/button';
import Tooltip from '../shared_ui/tooltip/tooltip';
import CircularWrapper from './circular-wrapper';
import ContractStageText from './contract-stage-text';
import './run-panel-tooltip.scss';

type TTradeAnimation = {
    className?: string;
    should_show_overlay?: boolean;
};

const TradeAnimation = observer(({ className, should_show_overlay }: TTradeAnimation) => {
    const { dashboard, run_panel, summary_card, blockly_store } = useStore();
    const { active_tab } = dashboard;
    const { has_active_bot, has_saved_bots } = blockly_store;
    const { isMobile } = useDevice();
    const { is_contract_completed, profit } = summary_card;
    const { contract_stage, is_stop_button_visible, is_stop_button_disabled, onRunButtonClick, stopBot } = run_panel;
    const [shouldDisable, setShouldDisable] = React.useState(false);
    const is_unavailable_for_payment_agent = false;
    const { load_modal } = useStore();
    const { dashboard_strategies, is_delete_modal_open } = load_modal;
    const prevDeleteModalOpen = React.useRef(is_delete_modal_open);

    React.useEffect(() => {
        const checkBots = async () => { await blockly_store.checkForSavedBots(); };
        checkBots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dashboard_strategies, is_delete_modal_open, is_stop_button_visible]);

    React.useEffect(() => {
        if (prevDeleteModalOpen.current && !is_delete_modal_open) {
            const checkBotsAfterDelete = async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                await blockly_store.checkForSavedBots();
                if (!is_stop_button_visible) {
                    setShouldDisable(true);
                    setTimeout(() => setShouldDisable(false), 0);
                }
            };
            checkBotsAfterDelete();
        }
        prevDeleteModalOpen.current = is_delete_modal_open;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_delete_modal_open, is_stop_button_visible]);

    React.useEffect(() => {
        if (shouldDisable) setTimeout(() => setShouldDisable(false), 1000);
    }, [shouldDisable, is_stop_button_visible]);

    const status_classes = ['', '', ''];
    const is_purchase_sent = contract_stage === (contract_stages.PURCHASE_SENT as unknown);
    const is_purchase_received = contract_stage === (contract_stages.PURCHASE_RECEIVED as unknown);
    let progress_status = contract_stage - (is_purchase_sent || is_purchase_received ? 2 : 3);

    if (progress_status >= 0) {
        if (progress_status < status_classes.length) status_classes[progress_status] = 'active';
        if (is_contract_completed) progress_status += 1;
        for (let i = 0; i < progress_status - 1; i++) status_classes[i] = 'completed';
    }

    const has_no_bots = !has_active_bot && !has_saved_bots;
    const is_bot_builder_tab = active_tab === DBOT_TABS.BOT_BUILDER;
    const should_disable_run = has_no_bots && !is_bot_builder_tab;
    const is_run_disabled = is_stop_button_visible || shouldDisable || should_disable_run || contract_stage === 3;
    const should_show_tooltip = !is_stop_button_visible && !is_bot_builder_tab && has_no_bots;

    const runButton = (
        <Button
            is_disabled={is_run_disabled && !is_unavailable_for_payment_agent}
            className='animation__run-button'
            id='db-animation__run-button'
            icon={<LabelPairedPlayLgFillIcon fill='#fff' />}
            onClick={() => {
                setShouldDisable(true);
                onRunButtonClick();
            }}
            has_effect
            {...(!is_unavailable_for_payment_agent ? { primary: true } : { green: true })}
        >
            <Localize i18n_default_text='Run' />
        </Button>
    );

    const stopButton = is_stop_button_visible ? (
        <Button
            is_disabled={is_stop_button_disabled}
            className='animation__stop-button'
            id='db-animation__stop-button'
            icon={<LabelPairedSquareLgFillIcon fill='#fff' />}
            onClick={() => {
                setShouldDisable(true);
                try {
                    window.__vinteltool_stopping = true;
                    window.setTimeout(() => { window.__vinteltool_stopping = false; }, 10000);
                } catch (error) {
                    console.warn('[TradeAnimation] Could not set stop guard.', error);
                }
                try {
                    stopBot();
                } catch (error) {
                    console.warn('[TradeAnimation] Stop action failed; keeping app alive.', error);
                }
            }}
            has_effect
            primary
        >
            <Localize i18n_default_text='Stop' />
        </Button>
    ) : null;

    const show_overlay = should_show_overlay && is_contract_completed;

    const determineTooltipAlignment = (): string => {
        if (isMobile) return 'top';
        try {
            const runPanelElement = document.querySelector('.run__button_wrapper');
            if (runPanelElement) {
                const rect = runPanelElement.getBoundingClientRect();
                return rect.bottom > window.innerHeight - 150 ? 'top' : 'left';
            }
        } catch (error) {
            console.error('Error determining tooltip position:', error);
        }
        return 'left';
    };

    return (
        <div className={classNames('animation__wrapper', className)}>
            {should_show_tooltip ? (
                <div className='run__button_wrapper'>
                    <Tooltip alignment={determineTooltipAlignment()} message={localize('The Run button is disabled because no Bot has been created yet.')} icon='info' className='qs__tooltip' />
                    <div style={{ opacity: 0.5, marginLeft: '8px' }}>
                        {runButton}
                    </div>
                </div>
            ) : (
                <>
                    {runButton}
                    {stopButton}
                </>
            )}

            <div className={classNames('animation__container', className, {
                'animation--running': contract_stage > 0,
                'animation--completed': show_overlay,
                'animation--disabled': is_run_disabled,
            })}>
                <ExecutionControl />
                {show_overlay && <ContractResultOverlay profit={profit} />}
                <span className='animation__text'><ContractStageText contract_stage={contract_stage} /></span>
                <div className='animation__progress'>
                    <div className='animation__progress-line'><div className={`animation__progress-bar animation__progress-${contract_stage}`} /></div>
                    {status_classes.map((status_class, i) => <CircularWrapper key={`status_class-${status_class}-${i}`} className={status_class} />)}
                </div>
            </div>
        </div>
    );
});

export default TradeAnimation;
