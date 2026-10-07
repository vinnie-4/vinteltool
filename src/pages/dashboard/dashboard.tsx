import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import { useApiBase } from '@/hooks/useApiBase';
import OnboardTourHandler from '../tutorials/dbot-tours/onboarding-tour';
import Cards from './cards';
import InfoPanel from './info-panel';

type TMobileIconGuide = {
    handleTabChange: (active_number: number) => void;
};

const DashboardComponent = observer(({ handleTabChange }: TMobileIconGuide) => {
    const { load_modal, dashboard, google_drive } = useStore();
    const { activeLoginid } = useApiBase();
    const { dashboard_strategies } = load_modal;
    const { is_google_drive_configured } = google_drive;
    const { active_tab, active_tour } = dashboard;
    const has_dashboard_strategies = !!dashboard_strategies?.length;
    const { isDesktop } = useDevice();
    const [greeting, setGreeting] = React.useState('Good morning');

    React.useEffect(() => {
        const updateGreeting = () => {
            const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Nairobi' }).format(new Date()));
            setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
        };
        updateGreeting();
        const interval = window.setInterval(updateGreeting, 60_000);
        return () => window.clearInterval(interval);
    }, []);

    return (
        <React.Fragment>
            <div
                className={classNames('tab__dashboard', {
                    'tab__dashboard--tour-active': active_tour,
                })}
            >
                <div className='tab__dashboard__content'>
                    <div className='quick-panel'>
                        <div className='tab__dashboard__header'>
                            <Text
                                className='title'
                                as='h2'
                                color='prominent'
                                size={isDesktop ? 'sm' : 's'}
                                lineHeight='xxl'
                                weight='bold'
                                style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: 700 }}
                            >
                                {greeting}<span className='dashboard-greeting-exclamation'>!</span>
                            </Text>
                        </div>
                        <div
                            className={classNames('tab__dashboard__header', {
                                'tab__dashboard__header--listed': isDesktop && has_dashboard_strategies,
                            })}
                        >

                        </div>
                        <Cards has_dashboard_strategies={has_dashboard_strategies} is_mobile={!isDesktop} />
                    </div>
                </div>
            </div>
            <InfoPanel />
            {active_tab === 0 && <OnboardTourHandler is_mobile={!isDesktop} />}
        </React.Fragment>
    );
});

export default DashboardComponent;
