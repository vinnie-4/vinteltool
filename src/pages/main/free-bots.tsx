import React from 'react';

export type TFreeBot = {
    id: string;
    name: string;
    xml: string;
};

type TFreeBotsProps = {
    bots?: TFreeBot[];
    onLoadBot: (bot: TFreeBot) => void | Promise<void>;
};

/**
 * Free Bots is intentionally only a catalogue/wiring layer.
 * XML bots are supplied here and handed to Quick Strategy's existing
 * Blockly import pathway; Free Bots does not own a separate bot engine.
 */
const FreeBots = ({ bots = [], onLoadBot }: TFreeBotsProps) => {
    if (!bots.length) return null;

    return (
        <div className='free-bots' id='free-bots-panel'>
            {bots.map(bot => (
                <div className='free-bots__card' key={bot.id}>
                    <div className='free-bots__name'>{bot.name}</div>
                    <button type='button' className='free-bots__load' onClick={() => onLoadBot(bot)}>
                        Load to Bot Builder
                    </button>
                </div>
            ))}
        </div>
    );
};

export default FreeBots;
