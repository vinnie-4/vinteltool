// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import GoogleDrive from '@/components/load-modal/google-drive';
import Dialog from '@/components/shared_ui/dialog';
import MobileFullPageModal from '@/components/shared_ui/mobile-full-page-modal';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';

type TCardProps = { has_dashboard_strategies: boolean; is_mobile: boolean };

type TQuickCard = {
    id: 'local' | 'free-bots' | 'bot-builder' | 'quick-bot-builder';
    icon: React.ReactElement;
    title: React.ReactElement;
    description: React.ReactElement;
    tone: 'blue' | 'green' | 'purple' | 'amber';
    callback: () => void;
};

const ModernIcon = ({ type }: { type: 'local' | 'bot' | 'quick' }) => {
    const common = { width: '50', height: '50', viewBox: '0 0 72 72', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };

    if (type === 'local') return (
        <svg {...common} aria-hidden='true'>
            <path d='M12 22C12 18.7 14.7 16 18 16H31L36 21H54C57.3 21 60 23.7 60 27V52C60 55.3 57.3 58 54 58H18C14.7 58 12 55.3 12 52V22Z' fill='#F7C843' stroke='#F59E0B' strokeWidth='3' strokeLinejoin='round' />
            <path d='M12 27H60' stroke='#F59E0B' strokeWidth='3' />
        </svg>
    );

    if (type === 'bot') return (
        <svg {...common} aria-hidden='true'>
            <rect x='17' y='20' width='38' height='33' rx='8' fill='#34D399' fillOpacity='0.16' stroke='#34D399' strokeWidth='3' />
            <rect x='23' y='28' width='26' height='20' rx='5' fill='#94A3B8' />
            <circle cx='31' cy='37' r='3' fill='#0F172A' />
            <circle cx='41' cy='37' r='3' fill='#0F172A' />
            <path d='M30 44C33 46 39 46 42 44' stroke='#0F172A' strokeWidth='2.5' strokeLinecap='round' />
            <path d='M36 28V21' stroke='#34D399' strokeWidth='3' strokeLinecap='round' />
            <circle cx='36' cy='18' r='3' fill='#34D399' />
            <path d='M14 33H10M58 33H62' stroke='#34D399' strokeWidth='3' strokeLinecap='round' />
        </svg>
    );

    return (
        <svg {...common} aria-hidden='true'>
            <path d='M40 7L18 39H33L28 65L54 29H39L40 7Z' fill='#FBBF24' stroke='#F59E0B' strokeWidth='3' strokeLinejoin='round' />
        </svg>
    );
};

const Cards = observer(({ is_mobile, has_dashboard_strategies: _has_dashboard_strategies }: TCardProps) => {
    const { dashboard, load_modal, quick_strategy, google_drive } = useStore();
    const { toggleLoadModal, setActiveTabIndex } = load_modal;
    const { is_google_drive_configured } = google_drive;
    const { isDesktop } = useDevice();
    const { onCloseDialog, dialog_options, is_dialog_open, setActiveTab, setPreviewOnPopup } = dashboard;
    const { setFormVisibility } = quick_strategy;

    const openFileLoader = () => {
        toggleLoadModal();
        setActiveTabIndex(is_mobile ? 0 : 1);
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const cards: TQuickCard[] = [
        {
            id: 'local',
            icon: <ModernIcon type='local' />,
            title: <Localize i18n_default_text='Local' />,
            description: <Localize i18n_default_text='Access and manage your local trading environment' />,
            tone: 'blue',
            callback: openFileLoader,
        },
        {
            id: 'free-bots',
            icon: <ModernIcon type='bot' />,
            title: <Localize i18n_default_text='Free Bots' />,
            description: <Localize i18n_default_text='Browse ready-made trading strategies' />,
            tone: 'green',
            callback: () => setActiveTab(DBOT_TABS.FREE_BOTS),
        },
        {
            id: 'bot-builder',
            icon: <ModernIcon type='bot' />,
            title: <Localize i18n_default_text='Bot Builder' />,
            description: <Localize i18n_default_text='Build a custom bot with the visual editor' />,
            tone: 'purple',
            callback: () => setActiveTab(DBOT_TABS.BOT_BUILDER),
        },
        {
            id: 'quick-bot-builder',
            icon: <ModernIcon type='quick' />,
            title: <Localize i18n_default_text='Quick Bot Builder' />,
            description: <Localize i18n_default_text='Create a bot with custom trade and risk settings' />,
            tone: 'amber',
            callback: () => {
                setActiveTab(DBOT_TABS.BOT_BUILDER);
                setFormVisibility(true);
            },
        },
    ];

    return (
        <div className='tab__dashboard__table'>
            <div className='tab__dashboard__quick-actions'>
                <div className='tab__dashboard__quick-actions__line' />
                <span><Localize i18n_default_text='QUICK ACTIONS' /></span>
                <div className='tab__dashboard__quick-actions__line' />
            </div>

            <div className='tab__dashboard__table__tiles' id='tab__dashboard__table__tiles'>
                {cards.map(({ icon, title, description, callback, id, tone }) => (
                    <button
                        key={id}
                        type='button'
                        className={classNames('tab__dashboard__quick-card', `tab__dashboard__quick-card--${tone}`)}
                        onClick={callback}
                    >
                        <div className='tab__dashboard__quick-card__icon'>{icon}</div>
                        <div className='tab__dashboard__quick-card__arrow'>→</div>
                        <div className='tab__dashboard__quick-card__body'>
                            <div className='tab__dashboard__quick-card__title'>{title}</div>
                            <div className='tab__dashboard__quick-card__description'>{description}</div>
                        </div>
                        <div className='tab__dashboard__quick-card__footer'>
                            <span><Localize i18n_default_text='Open' /> →</span>
                        </div>
                    </button>
                ))}

                {!isDesktop ? (
                    <Dialog
                        title={dialog_options.title}
                        is_visible={is_dialog_open}
                        onCancel={onCloseDialog}
                        is_mobile_full_width
                        className='dc-dialog__wrapper--google-drive'
                        has_close_icon
                    >
                        <GoogleDrive />
                    </Dialog>
                ) : (
                    <MobileFullPageModal
                        is_modal_open={is_dialog_open}
                        className='load-strategy__wrapper'
                        header={localize('Load strategy')}
                        onClickClose={() => {
                            setPreviewOnPopup(false);
                            onCloseDialog();
                        }}
                        height_offset='80px'
                    >
                        <div label='Google Drive' className='google-drive-label'>
                            <GoogleDrive />
                        </div>
                    </MobileFullPageModal>
                )}
            </div>
        </div>
    );
});

export default Cards;
