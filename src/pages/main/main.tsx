// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React, { lazy, Suspense, useEffect, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router';
import ChunkLoader from '@/components/loader/chunk-loader';
import { generateOAuthURL } from '@/components/shared';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import Dialog from '@/components/shared_ui/dialog';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import Tabs from '@/components/shared_ui/tabs/tabs';
import TradeTypeConfirmationModal from '@/components/trade-type-confirmation-modal';
import TradingViewModal from '@/components/trading-view-chart/trading-view-modal';
import { DBOT_TABS, TAB_IDS } from '@/constants/bot-contents';
import { api_base, updateWorkspaceName } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { isDbotRTL } from '@/external/bot-skeleton/utils/workspace';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { disableUrlParameterApplication, enableUrlParameterApplication, setupTradeTypeChangeListener } from '@/utils/blockly-url-param-handler';
import { checkAndShowTradeTypeModal, getModalState, handleTradeTypeCancel, handleTradeTypeConfirm, resetUrlParamProcessing, setModalStateChangeCallback } from '@/utils/trade-type-modal-handler';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import FreeBots from './free-bots';
import RunStrategy from '../dashboard/run-strategy';
import DerivCourse from '../deriv-course';
import AnalysisTool from '../analysis-tool';
import ManualTraderStructure from './manual-trader';
import UltimateBot2026 from './ultimate-bot-2026';
import './main.scss';

const ChartWrapper = lazy(() => import('../chart/chart-wrapper'));
const Tutorial = lazy(() => import('../tutorials'));

const ModernTabIcon = ({ icon }: { icon: string }) => {
    const paths: Record<string, string> = {
        house: 'M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5v-9Z',
        gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 3.5-2-.7a6.4 6.4 0 0 0-.6-1.5l.9-1.9-1.7-1.7-1.9.9a6.4 6.4 0 0 0-1.5-.6l-.7-2h-2.4l-.7 2a6.4 6.4 0 0 0-1.5.6L6 6.2 4.3 7.9l.9 1.9a6.4 6.4 0 0 0-.6 1.5l-2 .7v2.4l2 .7c.1.5.3 1 .6 1.5l-.9 1.9L6 20.2l1.9-.9c.5.3 1 .5 1.5.6l.7 2h2.4l.7-2c.5-.1 1-.3 1.5-.6l1.9.9 1.7-1.7-.9-1.9c.3-.5.5-1 .6-1.5l2-.7v-2.4Z',
        robot: 'M8 7V5h8v2h2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h2Zm-2 3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H6Zm3 2h2v2H9v-2Zm4 0h2v2h-2v-2ZM10 3h4v2h-4V3Z',
        chartUp: 'M4 19V9h3v10H4Zm6 0V5h3v14h-3Zm6 0V2h3v17h-3ZM3 21h18v-2H3v2Z',
        tv: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6v2h3v2H7v-2h3v-2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v10h16V7H4Z',
        sparkles: 'm12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9L12 2Zm7 12 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z',
        chart: 'M4 19V9h3v10H4Zm6 0V4h3v15h-3Zm6 0v-7h3v7h-3ZM3 21h18v-2H3v2Z',
        users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20a7 7 0 0 1 14 0v1H2v-1Zm14.5-5a5.5 5.5 0 0 1 5.5 5.5V21h-4v-.9a8.9 8.9 0 0 0-1.5-5.1Z',
        graduation: 'M12 3 2 8l10 5 8-4v6h2V8L12 3Zm-6 8v5c0 2.2 2.7 4 6 4s6-1.8 6-4v-5l-6 3-6-3Z',
    };
    return <svg aria-hidden='true' viewBox='0 0 24 24' width='22' height='22' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'><path d={paths[icon]} /></svg>;
};

const AppWrapper = observer(() => {
    const { connectionStatus } = useApiBase();
    const { dashboard, load_modal, run_panel, quick_strategy, summary_card, blockly_store } = useStore();
    const { is_loading } = blockly_store;
    const { active_tab, active_tour, is_chart_modal_visible, is_trading_view_modal_visible, setActiveTab, setWebSocketState, setActiveTour, setTourDialogVisibility } = dashboard;
    const { dashboard_strategies } = load_modal;
    const { is_dialog_open, is_drawer_open, dialog_options, onCancelButtonClick, onCloseDialog, onOkButtonClick, stopBot } = run_panel;
    const { is_open } = quick_strategy;
    const { cancel_button_text, ok_button_text, title, message, dismissable, is_closed_on_cancel } = dialog_options as { [key: string]: string };
    const { clear } = summary_card;
    const { DASHBOARD, BOT_BUILDER, FREE_BOTS } = DBOT_TABS;
    const init_render = React.useRef(true);
    const hash = ['dashboard', 'bot_builder', 'free_bots', 'analysis_tool', 'manual_trader', 'ultimate_bot_2026', 'chart', 'tutorial', 'deriv_course'];
    const { isDesktop } = useDevice();
    const location = useLocation();
    const navigate = useNavigate();
    const [left_tab_shadow, setLeftTabShadow] = useState<boolean>(false);
    const [right_tab_shadow, setRightTabShadow] = useState<boolean>(false);
    const [tradeTypeModalState, setTradeTypeModalState] = useState(getModalState());

    const getTradeTypeModalProps = () => {
        const { tradeTypeData } = tradeTypeModalState;
        return {
            is_visible: tradeTypeModalState.isVisible,
            trade_type_display_name: tradeTypeData?.displayName || '',
            current_trade_type: tradeTypeData?.currentTradeType ? `${tradeTypeData.currentTradeType.tradeTypeCategory}/${tradeTypeData.currentTradeType.tradeType}` : 'N/A',
            current_trade_type_display_name: tradeTypeData?.currentTradeTypeDisplayName || 'N/A',
            onConfirm: handleTradeTypeConfirm,
            onCancel: handleTradeTypeCancel,
        };
    };

    const is_preview_mode = window.location.pathname.includes('/preview');
    let tab_value: number | string = active_tab;
    const GetHashedValue = (tab: number) => {
        tab_value = location.hash?.split('#')[1];
        if (!tab_value) return is_preview_mode ? BOT_BUILDER : tab;
        return Number(hash.indexOf(String(tab_value)));
    };
    const active_hash_tab = GetHashedValue(active_tab);

    React.useEffect(() => { setModalStateChangeCallback(new_state => setTradeTypeModalState(new_state)); }, [is_loading]);
    React.useEffect(() => { resetUrlParamProcessing(); }, [location.search]);
    React.useEffect(() => {
        const el_dashboard = document.getElementById('id-dbot-dashboard');
        const el_tutorial = document.getElementById('id-tutorials');
        if (!el_dashboard || !el_tutorial) return;
        const observer_dashboard = new window.IntersectionObserver(([entry]) => setLeftTabShadow(!entry.isIntersecting), { root: null, threshold: 0.5 });
        const observer_tutorial = new window.IntersectionObserver(([entry]) => setRightTabShadow(!entry.isIntersecting), { root: null, threshold: 0.5 });
        observer_dashboard.observe(el_dashboard); observer_tutorial.observe(el_tutorial);
        return () => { observer_dashboard.disconnect(); observer_tutorial.disconnect(); };
    });
    React.useEffect(() => {
        if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) { clear(); stopBot(); api_base.setIsRunning(false); setWebSocketState(false); }
        }
    }, [clear, connectionStatus, setWebSocketState, stopBot]);
    const updateTabShadowsHeight = () => {
        const botBuilderEl = document.getElementById('id-bot-builder');
        const leftShadow = document.querySelector('.tabs-shadow--left') as HTMLElement;
        const rightShadow = document.querySelector('.tabs-shadow--right') as HTMLElement;
        if (botBuilderEl && leftShadow && rightShadow) { const height = botBuilderEl.offsetHeight; leftShadow.style.height = `${height}px`; rightShadow.style.height = `${height}px`; }
    };
    React.useEffect(() => {
        let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
        if (active_tab === BOT_BUILDER) {
            requestAnimationFrame(() => {
                disableUrlParameterApplication(); setupTradeTypeChangeListener();
                const handleTradeTypeModal = () => checkAndShowTradeTypeModal(() => enableUrlParameterApplication(), () => {});
                if (!blockly_store.is_loading) setTimeout(handleTradeTypeModal, 500);
                else { let pollAttempts = 0; const checkBlocklyLoaded = () => { if (!blockly_store.is_loading) return handleTradeTypeModal(); if (pollAttempts < 10) { pollAttempts++; pollTimeoutId = setTimeout(checkBlocklyLoaded, 500); } else console.warn('Blockly loading timeout after 5 seconds - proceeding without URL parameter check'); }; checkBlocklyLoaded(); }
            });
        }
        return () => { if (pollTimeoutId) clearTimeout(pollTimeoutId); };
    }, [active_tab, is_loading]);
    React.useEffect(() => {
        updateTabShadowsHeight(); if (is_open) setTourDialogVisibility(false);
        if (init_render.current) { setActiveTab(Number(active_hash_tab)); if (!isDesktop) handleTabChange(Number(active_hash_tab)); init_render.current = false; }
        else navigate(`${window.location.search}#${hash[active_tab] || hash[0]}`);
        if (active_tour !== '') setActiveTour('');
        const mainElement = document.querySelector('.main__container');
        if (active_tab === DBOT_TABS.TUTORIAL && !isDesktop) { document.body.style.overflow = 'hidden'; if (mainElement instanceof HTMLElement) mainElement.classList.add('no-scroll'); }
        else { document.body.style.overflow = ''; if (mainElement instanceof HTMLElement) mainElement.classList.remove('no-scroll'); }
    }, [active_tab]);
    React.useEffect(() => {
        const trashcan_init_id = setTimeout(() => { if (active_tab === BOT_BUILDER && Blockly?.derivWorkspace?.trashcan) { const trashcanY = window.innerHeight - 250; const trashcanX = is_drawer_open ? (isDbotRTL() ? 380 : window.innerWidth - 460) : (isDbotRTL() ? 20 : window.innerWidth - 100); Blockly?.derivWorkspace?.trashcan?.setTrashcanPosition(trashcanX, trashcanY); } }, 100);
        return () => clearTimeout(trashcan_init_id);
    }, [active_tab, is_drawer_open]);
    useEffect(() => { let timer: ReturnType<typeof setTimeout>; if (dashboard_strategies.length > 0) timer = setTimeout(() => updateWorkspaceName()); return () => { if (timer) clearTimeout(timer); }; }, [dashboard_strategies, active_tab]);
    const handleTabChange = React.useCallback((tab_index: number) => { setActiveTab(tab_index); const el_id = TAB_IDS[tab_index]; if (el_id) setTimeout(() => document.getElementById(el_id)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 10); }, [active_tab]);
    const handleFreeBotLoad = React.useCallback(async (bot) => { setActiveTab(BOT_BUILDER); await new Promise<void>(resolve => setTimeout(resolve, 50)); await quick_strategy.loadFreeBotXml(bot.xml, bot.name); }, [quick_strategy, setActiveTab]);
    const handleLoginGeneration = async () => { const oauthUrl = await generateOAuthURL(); if (oauthUrl) window.location.replace(oauthUrl); else console.error('Failed to generate OAuth URL'); };

    return <React.Fragment><div className='main'><div className={classNames('main__container', { 'main__container--active': active_tour && active_tab === DASHBOARD && !isDesktop })}><div>
        {!isDesktop && left_tab_shadow && <span className='tabs-shadow tabs-shadow--left' />}
        <Tabs active_index={active_tab} className='main__tabs' onTabItemClick={handleTabChange} top>
            <div label={<><ModernTabIcon icon='house' /><Localize i18n_default_text='Dashboard' /></>} id='id-dbot-dashboard'><Dashboard handleTabChange={handleTabChange} /></div>
            <div label={<><ModernTabIcon icon='gear' /><Localize i18n_default_text='Bot Builder' /></>} id='id-bot-builder' />
            <div label={<><ModernTabIcon icon='robot' /><Localize i18n_default_text='Free Bots' /></>} id='id-free-bots'><FreeBots onLoadBot={handleFreeBotLoad} /></div>
            <div label={<><ModernTabIcon icon='chartUp' /><Localize i18n_default_text='Analysis Tool' /></>} id='id-analysis-tool'><AnalysisTool /></div>
            <div label={<><ModernTabIcon icon='tv' /><Localize i18n_default_text='Manual Trader' /></>} id='id-manual-trader'><ManualTraderStructure /></div>
            <div label={<><ModernTabIcon icon='sparkles' /><Localize i18n_default_text='Ultimate Bot 2026' /></>} id='id-ultimate-bot-2026'><UltimateBot2026 /></div>
            <div label={<><ModernTabIcon icon='chart' /><Localize i18n_default_text='Charts' /></>} id='id-charts'><Suspense fallback={<ChunkLoader message={localize('Please wait, loading chart...')} />}><ChartWrapper show_digits_stats={false} /></Suspense></div>
            <div label={<><ModernTabIcon icon='users' /><Localize i18n_default_text='Tutorials' /></>} id='id-tutorials'><div className='tutorials-wrapper'><Suspense fallback={<ChunkLoader message={localize('Please wait, loading tutorials...')} />}><Tutorial handleTabChange={handleTabChange} /></Suspense></div></div>
            <div label={<><ModernTabIcon icon='graduation' /><Localize i18n_default_text='Deriv Course' /></>} id='id-deriv-course'><DerivCourse /></div>
        </Tabs>
        {!isDesktop && right_tab_shadow && <span className='tabs-shadow tabs-shadow--right' />}
    </div></div></div><DesktopWrapper><div className='main__run-strategy-wrapper'><RunStrategy /><RunPanel /></div><ChartModal /><TradingViewModal /></DesktopWrapper><MobileWrapper>{!is_open && <RunPanel />}</MobileWrapper><Dialog cancel_button_text={cancel_button_text || localize('Cancel')} className='dc-dialog__wrapper--fixed' confirm_button_text={ok_button_text || localize('Ok')} has_close_icon is_mobile_full_width={false} is_visible={is_dialog_open} onCancel={onCancelButtonClick} onClose={onCloseDialog} onConfirm={onOkButtonClick || onCloseDialog} portal_element_id='modal_root' title={title} login={handleLoginGeneration} dismissable={dismissable} is_closed_on_cancel={is_closed_on_cancel}>{message}</Dialog>{(() => { const modalProps = getTradeTypeModalProps(); return <TradeTypeConfirmationModal is_visible={modalProps.is_visible} trade_type_display_name={modalProps.trade_type_display_name} current_trade_type={modalProps.current_trade_type} current_trade_type_display_name={modalProps.current_trade_type_display_name} onConfirm={modalProps.onConfirm} onCancel={modalProps.onCancel} />; })()}</React.Fragment>;
});

export default AppWrapper;
