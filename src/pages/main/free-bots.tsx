import React from 'react';
import './free-bots.scss';

export type TFreeBot = {
    id: string;
    name: string;
    xml: string;
    description?: string;
    tags?: string[];
};

type TFreeBotsProps = {
    bots?: TFreeBot[];
    onLoadBot: (bot: TFreeBot) => void | Promise<void>;
};

// Keep this in the same XML shape used by the Bot Builder's native strategy files:
// `trade` -> SUBMARKET -> `market`, with `before_purchase` containing `purchase`.
// This is important because the workspace validator requires the native mandatory
// Purchase Conditions/Purchase block structure before Run can execute the strategy.
const VINTEL_EVEN_BOT_XML = `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false">
  <block type="trade" id="vintel_even_bot_trade" x="0" y="0">
    <statement name="SUBMARKET">
      <block type="market" id="vintel_even_bot_market">
        <field name="MARKET_LIST">volidx</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_25_1S</field>
        <field name="TRADETYPECAT_LIST">digits</field>
        <field name="TRADETYPE_LIST">evenodd</field>
        <field name="TYPE_LIST">both</field>
        <field name="CANDLEINTERVAL_LIST">60</field>
        <field name="DURATIONTYPE_LIST">t</field>
        <field name="PAYOUTTYPE_LIST">stake</field>
        <field name="CURRENCY_LIST">USD</field>
        <field name="RESTARTONERROR">FALSE</field>
        <value name="DURATION">
          <block type="math_number" id="vintel_even_bot_duration_value">
            <field name="NUM">1</field>
          </block>
        </value>
        <value name="AMOUNT">
          <block type="math_number" id="vintel_even_bot_amount_value">
            <field name="NUM">0.5</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="vintel_even_bot_before_purchase" x="0" y="268">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="vintel_even_bot_purchase">
        <field name="PURCHASE_LIST">DIGITEVEN</field>
      </block>
    </statement>
  </block>
</xml>`;

export const FREE_BOTS: TFreeBot[] = [
    {
        id: 'vintel-even-bot',
        name: 'Vintel Even bot',
        description: 'Digits Even • Volatility 25 (1s) • $0.50 stake • 1 tick',
        tags: ['Digits', 'EVEN', 'V25 1s'],
        xml: VINTEL_EVEN_BOT_XML,
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
                            <div className='free-bots__icon' aria-hidden='true'>🤖</div>
                            <div className='free-bots__body'>
                                <h3 className='free-bots__name'>{bot.name}</h3>
                                {bot.description && <p className='free-bots__description'>{bot.description}</p>}
                                {!!bot.tags?.length && <div className='free-bots__tags'>{bot.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
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
