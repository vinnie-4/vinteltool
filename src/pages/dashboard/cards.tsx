// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
// TODO: Complete MobX integration for popup functionality
// Some code is kept commented out pending popup integration
import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import GoogleDrive from '@/components/load-modal/google-drive';
import Dialog from '@/components/shared_ui/dialog';
import MobileFullPageModal from '@/components/shared_ui/mobile-full-page-modal';
import Text from '@/components/shared_ui/text';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
/* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
/* [/AI] */
import DashboardBotList from './bot-list/dashboard-bot-list';

type TCardProps = { has_dashboard_strategies: boolean; is_mobile: boolean; };
type TCardArray = { id: string; icon: React.ReactElement; content: React.ReactElement; callback: () => void; };

const ModernIcon = ({ type }: { type: 'local' | 'bot' | 'quick' }) => {
    const common = { width: '50', height: '50', viewBox: '0 0 72 72', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };
    if (type === 'local') return <svg {...common} aria-hidden='true'>
        <rect x='10' y='13' width='52' height='37' rx='6' stroke='#2563EB' strokeWidth='3.5'>
            <animate attributeName='opacity' values='1;0.72;1' dur='2s' repeatCount='indefinite' />
        </rect>
        <path d='M25 59H47M30 50V59M42 50V59' stroke='#2563EB' strokeWidth='3.5' strokeLinecap='round'/>
        <path d='M26 32L32 38L46 24' stroke='#16A34A' strokeWidth='4' strokeLinecap='round' strokeLinejoin='round' strokeDasharray='32' strokeDashoffset='32'>
            <animate attributeName='stroke-dashoffset' values='32;0;0;32' keyTimes='0;0.25;0.8;1' dur='2s' repeatCount='indefinite'/>
        </path>
    </svg>;
    if (type === 'bot') return <svg {...common} aria-hidden='true'>
        <rect x='13' y='22' width='46' height='37' rx='11' stroke='#2563EB' strokeWidth='3.5'>
            <animate attributeName='opacity' values='1;0.8;1' dur='2.4s' repeatCount='indefinite'/>
        </rect>
        <path d='M36 12V22M31 12H41' stroke='#7C3AED' strokeWidth='3.5' strokeLinecap='round'/>
        <circle cx='36' cy='10' r='2.5' fill='#7C3AED'>
            <animate attributeName='r' values='2.5;4;2.5' dur='1.4s' repeatCount='indefinite'/>
            <animate attributeName='opacity' values='1;0.45;1' dur='1.4s' repeatCount='indefinite'/>
        </circle>
        <circle cx='28' cy='38' r='3' fill='#2563EB'>
            <animate attributeName='opacity' values='1;0.25;1' dur='2.4s' repeatCount='indefinite' begin='0.2s'/>
        </circle>
        <circle cx='44' cy='38' r='3' fill='#2563EB'>
            <animate attributeName='opacity' values='1;0.25;1' dur='2.4s' repeatCount='indefinite' begin='0.35s'/>
        </circle>
        <path d='M27 48H45' stroke='#7C3AED' strokeWidth='3.5' strokeLinecap='round'>
            <animate attributeName='stroke-width' values='3.5;4.5;3.5' dur='2.4s' repeatCount='indefinite'/>
        </path>
        <path d='M7 32V49M65 32V49' stroke='#2563EB' strokeWidth='3.5' strokeLinecap='round'/>
    </svg>;
    return <svg {...common} aria-hidden='true'>
        <path d='M39 8L19 39H34L29 64L53 30H38L39 8Z' fill='#F59E0B' stroke='#D97706' strokeWidth='3.5' strokeLinejoin='round'>
            <animate attributeName='opacity' values='1;0.72;1' dur='1.6s' repeatCount='indefinite'/>
        </path>
        <circle cx='39' cy='36' r='25' stroke='#F59E0B' strokeWidth='2'>
            <animate attributeName='r' values='24;27;24' dur='1.6s' repeatCount='indefinite'/>
            <animate attributeName='opacity' values='0.9;0.25;0.9' dur='1.6s' repeatCount='indefinite'/>
        </circle>
        <circle cx='39' cy='11' r='2.2' fill='#D97706'>
            <animateMotion dur='1.6s' repeatCount='indefinite' path='M0 25A25 25 0 1 1 0 -25A25 25 0 1 1 0 25'/>
        </circle>
    </svg>;
};

const GoogleDriveIcon = () => <svg width='50' height='50' viewBox='0 0 72 72' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
    <path d='M25 12H47L62 39H40L25 12Z' stroke='#4285F4' strokeWidth='3.5' strokeLinejoin='round'>
        <animate attributeName='opacity' values='1;0.65;1' dur='2.2s' repeatCount='indefinite'/>
    </path>
    <path d='M25 12L10 39L21 59H43L62 39' stroke='#34A853' strokeWidth='3.5' strokeLinejoin='round'/>
    <path d='M21 59L40 39' stroke='#FBBC05' strokeWidth='3.5' strokeLinecap='round'>
        <animate attributeName='stroke-width' values='3.5;5;3.5' dur='2.2s' repeatCount='indefinite'/>
    </path>
</svg>;

const Cards = observer(({ is_mobile, has_dashboard_strategies }: TCardProps) => {
    const { dashboard, load_modal, quick_strategy, google_drive } = useStore();
    const { toggleLoadModal, setActiveTabIndex } = load_modal;
    const { is_google_drive_configured } = google_drive;
    const { isDesktop } = useDevice();
    const { onCloseDialog, dialog_options, is_dialog_open, setActiveTab, setPreviewOnPopup } = dashboard;
    const { setFormVisibility } = quick_strategy;
    const openFileLoader = () => { toggleLoadModal(); setActiveTabIndex(is_mobile ? 0 : 1); setActiveTab(DBOT_TABS.BOT_BUILDER); };
    const openGoogleDriveDialog = () => { const google_drive_tab_index = isDesktop ? 2 : 1; toggleLoadModal(); setActiveTabIndex(google_drive_tab_index); setActiveTab(DBOT_TABS.BOT_BUILDER); };
    const actions: TCardArray[] = [
        { id: 'my-computer', icon: <ModernIcon type='local' />, content: is_mobile ? <Localize i18n_default_text='Local' /> : <Localize i18n_default_text='My computer' />, callback: openFileLoader },
        { id: 'google-drive', icon: <GoogleDriveIcon />, content: <Localize i18n_default_text='Google Drive' />, callback: openGoogleDriveDialog },
        { id: 'bot-builder', icon: <ModernIcon type='bot' />, content: <Localize i18n_default_text='Bot Builder' />, callback: () => setActiveTab(DBOT_TABS.BOT_BUILDER) },
        { id: 'quick-bot-builder', icon: <ModernIcon type='quick' />, content: <Localize i18n_default_text='Quick Bot Builder' />, callback: () => { setActiveTab(DBOT_TABS.BOT_BUILDER); setFormVisibility(true); } },
    ].filter(action => action.id !== 'google-drive' || is_google_drive_configured);
    const cardFrameStyles: Record<string, React.CSSProperties> = {
        'my-computer': { border: '2px solid #2563EB', background: '#EFF6FF' },
        'google-drive': { border: '2px solid #34A853', background: '#F0FDF4' },
        'bot-builder': { border: '2px solid #7C3AED', background: '#F5F3FF' },
        'quick-bot-builder': { border: '2px solid #F97316', background: '#FFF7ED' },
    };
    return React.useMemo(() => (
        <div className={classNames('tab__dashboard__table', { 'tab__dashboard__table--minimized': has_dashboard_strategies && is_mobile })}>
            <div className={classNames('tab__dashboard__table__tiles', { 'tab__dashboard__table__tiles--minimized': has_dashboard_strategies && is_mobile })} id='tab__dashboard__table__tiles'>
                {actions.map(({ icon, content, callback, id }) => (
                    <div key={id} className={classNames('tab__dashboard__table__block', { 'tab__dashboard__table__block--minimized': has_dashboard_strategies && is_mobile })}>
                        <div className={classNames('tab__dashboard__table__images', { 'tab__dashboard__table__images--minimized': has_dashboard_strategies })} id={id} onClick={callback} style={{ ...cardFrameStyles[id], borderRadius: '14px', minHeight: '108px', minWidth: '108px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', boxSizing: 'border-box', cursor: 'pointer' }}>
                            {icon}
                            <span style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.1, color: '#111827', textAlign: 'center' }}>{content}</span>
                        </div>
                    </div>
                ))}
                {!isDesktop ? <Dialog title={dialog_options.title} is_visible={is_dialog_open} onCancel={onCloseDialog} is_mobile_full_width className='dc-dialog__wrapper--google-drive' has_close_icon><GoogleDrive /></Dialog> : <MobileFullPageModal is_modal_open={is_dialog_open} className='load-strategy__wrapper' header={localize('Load strategy')} onClickClose={() => { setPreviewOnPopup(false); onCloseDialog(); }} height_offset='80px'><div label='Google Drive' className='google-drive-label'><GoogleDrive /></div></MobileFullPageModal>}
            </div>
            <DashboardBotList />
        </div>
    ), [is_dialog_open, has_dashboard_strategies, is_google_drive_configured]);
});
export default Cards;
