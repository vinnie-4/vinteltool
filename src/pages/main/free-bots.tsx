import React from 'react';
import './free-bots.scss';
// @ts-ignore — raw-loader exposes XML assets as strings at build time.
import VINTEL_OVER_UNDER_DESTROYER_XML from '@/xml/VintelTool Over Under destroyer.xml';
import { ULTIMATE_EVEN_ODD_SWITCHER_XML } from '@/xml/ultimate-even-odd-switcher';

export type TFreeBot = { id: string; name: string; xml: string; description?: string; tags?: string[] };
type TFreeBotsProps = { bots?: TFreeBot[]; onLoadBot: (bot: TFreeBot) => void | Promise<void> };

export const FREE_BOTS: TFreeBot[] = [
    {
        id: 'vintel-over-under-destroyer',
        name: 'VintelTool Over/Under destroyer',
        description: 'Over/Under • R_10 • $1 stake • Martingale ×2 • TP $5 • SL $50',
        tags: ['Digits', 'OVER/UNDER', 'R_10', '$1 STAKE'],
        xml: VINTEL_OVER_UNDER_DESTROYER_XML,
    },
    {
        id: 'ultimate-even-odd-switcher-ai',
        name: 'Ultimate Even ODD Switcher Ai DBot',
        description: 'Even/Odd percentage strategy • R_100 • 1 tick • base stake $0.50 • Martingale ×2.1 • TP $10 • SL $20',
        tags: ['Digits', 'EVEN/ODD', 'R_100', '1 TICK', 'AI SWITCHER'],
        xml: ULTIMATE_EVEN_ODD_SWITCHER_XML,
    },
];

const FreeBots = ({ bots = FREE_BOTS, onLoadBot }: TFreeBotsProps) => {
    const [loading_bot_id, setLoadingBotId] = React.useState<string | null>(null);

    if (!bots.length) return null;

    const handleLoad = async (bot: TFreeBot) => {
        if (loading_bot_id) return;
        setLoadingBotId(bot.id);
        try {
            await onLoadBot(bot);
        } catch (error) {
            console.error('Failed to load free bot:', error);
        } finally {
            setLoadingBotId(null);
        }
    };

    return (
        <section className='free-bots' id='free-bots-panel' aria-label='Free Bots'>
            <div className='free-bots__grid'>
                {bots.map(bot => {
                    const is_loading = loading_bot_id === bot.id;
                    return (
                        <article className='free-bots__card' key={bot.id}>
                            <div className='free-bots__body'>
                                <h3 className='free-bots__name'>{bot.name}</h3>
                                {bot.description && <p className='free-bots__description'>{bot.description}</p>}
                                {!!bot.tags?.length && (
                                    <div className='free-bots__tags'>
                                        {bot.tags.map(tag => <span key={tag}>{tag}</span>)}
                                    </div>
                                )}
                            </div>
                            <button
                                type='button'
                                className='free-bots__load'
                                onClick={() => void handleLoad(bot)}
                                disabled={!!loading_bot_id}
                                aria-busy={is_loading}
                            >
                                {is_loading ? 'Loading…' : 'Load'}
                            </button>
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

export default FreeBots;
