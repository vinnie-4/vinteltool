import React from 'react';
import './free-bots.scss';
// PROTECTED BOT: this source is isolated from user-uploaded XML bots.
// Do not point this import at a user-uploadable XML path.
// @ts-ignore — raw-loader exposes XML assets as strings at build time.
import VINTEL_OVER_UNDER_DESTROYER_XML from '@/xml/protected/VintelTool Under Destroyer.locked.xml';
// @ts-ignore — raw-loader exposes XML assets as strings at build time.
import VINTEL_UNDER_6_RECOVERY_UNDER_5_XML from '@/xml/VintelTool Under 6 Recovery Under 5.xml';

export type TFreeBot = { id: string; name: string; xml: string; description?: string; tags?: string[] };
type TFreeBotsProps = { bots?: TFreeBot[]; onLoadBot: (bot: TFreeBot) => void | Promise<void> };

// Under Destroyer remains isolated and its source cannot be replaced by uploaded XML bots.
export const FREE_BOTS: TFreeBot[] = [
    {
        id: 'vintel-over-under-destroyer',
        name: 'VintelTool Under Destroyer',
        description: 'Digits • UNDER 7 → UNDER 4 on loss • R_50 • 1 tick • base stake $1 • Martingale ×2',
        tags: ['Digits', 'UNDER 7', 'LOSS → UNDER 4', 'R_50', '1 TICK', '$1 STAKE', 'MARTINGALE ×2'],
        xml: VINTEL_OVER_UNDER_DESTROYER_XML,
    },
    {
        id: 'vintel-under-6-recovery-under-5',
        name: 'VintelTool Under 6 Recovery Under 5',
        description: 'Digits • UNDER 6 → UNDER 5 on loss • R_25 • 1 tick • base stake $1 • Martingale ×2',
        tags: ['Digits', 'UNDER 6', 'LOSS → UNDER 5', 'R_25', '1 TICK', '$1 STAKE', 'MARTINGALE ×2'],
        xml: VINTEL_UNDER_6_RECOVERY_UNDER_5_XML,
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
