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
    const subtitles = [
        'Trade with confidence.',
        'Build smarter. Trade with precision.',
        'Analyze every tick with confidence.',
        'Your strategy. Your edge.',
        'Make every decision count.',
        'Trade smarter with VintelTool.',
        'Turn market insights into strategy.',
        'Stay focused. Trade with purpose.',
        'Precision starts with analysis.',
        'Your next strategy starts here.',
        'Protect your capital first; consistent decisions matter more than chasing every move.',
        'A strong trading plan turns market uncertainty into decisions you can manage with discipline.',
        'Wait for your setup, respect your risk limits, and let patience do its work.',
    ];
    const [subtitleIndex, setSubtitleIndex] = React.useState(0);

    const currentSubtitle = subtitles[subtitleIndex];
    const subtitleWords = currentSubtitle.split(' ');
    // Leave enough time to read each sentence, plus time for the word-by-word reveal.
    const typingDurationMs = subtitleWords.length * 120;
    const readingDurationMs = Math.max(2600, currentSubtitle.length * 65);
    const subtitleDuration = (typingDurationMs + readingDurationMs + 900) / 1000;

    React.useEffect(() => {
        const duration = subtitleWords.length * 120 + Math.max(2600, subtitles[subtitleIndex].length * 65) + 900;
        const timeout = window.setTimeout(() => {
            setSubtitleIndex(index => (index + 1) % subtitles.length);
        }, duration);
        return () => window.clearTimeout(timeout);
    }, [subtitleIndex]);

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
                                style={{
                                    fontSize: isDesktop ? '32px' : '30px',
                                    color: '#38BDF8',
                                    fontWeight: 700,
                                    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                                    textShadow: '0 0 6px rgba(56, 189, 248, 0.45), 0 0 14px rgba(56, 189, 248, 0.22)',
                                }}
                            >
                                {greeting}
                            </Text>
                            <div
                                key={subtitleIndex}
                                className='dashboard-greeting-subtitle'
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'center',
                                    marginTop: '4px',
                                    fontSize: isDesktop ? '19px' : '17px',
                                    lineHeight: '1.3',
                                    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                                    fontWeight: 400,
                                    fontStyle: 'italic',
                                    color: '#9BB5D1',
                                    '--subtitle-duration': `${subtitleDuration}s`,
                                } as React.CSSProperties}
                            >
                                <span className='dashboard-greeting-quote dashboard-greeting-quote--open' aria-hidden='true'>“</span>
                                {subtitleWords.map((word, index) => (
                                    <React.Fragment key={`${subtitleIndex}-${index}`}>
                                        <span
                                            className='dashboard-greeting-word'
                                            style={{ animationDelay: `${index * 0.12}s` }}
                                        >
                                            {word}
                                        </span>
                                        {index < subtitleWords.length - 1 ? ' ' : ''}
                                    </React.Fragment>
                                ))}
                                <span className='dashboard-greeting-quote dashboard-greeting-quote--close' aria-hidden='true'>”</span>
                            </div>
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
