import React from 'react';
import './free-bots.scss';
// @ts-ignore — raw-loader exposes XML assets as strings at build time.
import VINTEL_UNDER_6_RECOVERY_UNDER_5_XML from '@/xml/VintelTool Under 6 Recovery Under 5.xml';

export type TFreeBot = { id: string; name: string; xml: string; description?: string; tags?: string[] };
type TFreeBotsProps = { bots?: TFreeBot[]; onLoadBot: (bot: TFreeBot) => void | Promise<void> };
type TPublishedBot = { id?: string; name?: string; description?: string; category?: string; filename?: string; xml?: string; visible?: boolean; tags?: string[]; created_at?: string | number; uploaded_at?: string | number; createdAt?: string | number; uploadedAt?: string | number; updated_at?: string | number; updatedAt?: string | number; timestamp?: string | number };

export const FREE_BOTS: TFreeBot[] = [
    {
        id: 'vintel-under-6-recovery-under-5',
        name: 'VintelTool Under 6 Recovery Under 5',
        xml: VINTEL_UNDER_6_RECOVERY_UNDER_5_XML,
    },
];

const FreeBots = ({ bots = FREE_BOTS, onLoadBot }: TFreeBotsProps) => {
    const [loading_bot_id, setLoadingBotId] = React.useState<string | null>(null);
    const [publishedBots, setPublishedBots] = React.useState<TFreeBot[]>([]);
    React.useEffect(() => {
        let active = true;
        fetch('https://raw.githubusercontent.com/DerivFX4/vinteltool/main/brand.config.json', { cache: 'no-store' })
            .then(response => response.ok ? response.json() : null)
            .then(config => {
                const records: TPublishedBot[] = config?.studio_settings?.bot_store?.bots;
                if (!active || !Array.isArray(records)) return;
                const mapped = records.filter(bot => bot && bot.visible !== false && typeof bot.xml === 'string' && /<\\s*xml\\b|<xml[\\s>]/i.test(bot.xml) && /<block\\b/i.test(bot.xml))
                    .map(bot => ({ id: String(bot.id || bot.filename || bot.name), name: String(bot.name || 'VintelTool Free Bot'), description: [bot.description, bot.category ? 'Category: ' + bot.category : ''].filter(Boolean).join(' · '), tags: bot.tags || (bot.category ? [bot.category, 'FREE XML BOT'] : ['FREE XML BOT']), xml: bot.xml as string }));
                setPublishedBots(mapped);
            }).catch(error => console.warn('Could not load published Free Bots catalog:', error));
        return () => { active = false; };
    }, []);
    const allBots = [
        ...bots.map((bot, index) => ({ ...bot, publishedAt: 0, sourceIndex: -bots.length + index })),
        ...publishedBots.filter(published => !bots.some(existing => existing.id === published.id)),
    ].sort((a, b) => b.publishedAt - a.publishedAt || b.sourceIndex - a.sourceIndex);

    if (!allBots.length) return null;

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
                {allBots.map(bot => {
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
