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

const VINTEL_EVEN_BOT_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade_definition" id="vintel_even_bot_trade" x="20" y="20">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="vintel_even_bot_market">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_25_1S</field>
        <next><block type="trade_definition_tradetype" id="vintel_even_bot_type">
          <field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">evenodd</field>
          <next><block type="trade_definition_contracttype" id="vintel_even_bot_contract">
            <field name="TYPE_LIST">EVEN</field>
            <next><block type="trade_definition_duration" id="vintel_even_bot_duration">
              <field name="DURATIONTYPE_LIST">t</field>
              <value name="DURATION"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
              <next><block type="trade_definition_amount" id="vintel_even_bot_amount">
                <value name="AMOUNT"><shadow type="math_number"><field name="NUM">0.5</field></shadow></value>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="vintel_even_bot_before_purchase" x="20" y="420">
    <statement name="BEFOREPURCHASE"><block type="purchase" id="vintel_even_bot_purchase"><field name="PURCHASE_LIST">EVEN</field></block></statement>
  </block>
</xml>`;

/** BinaryTool-style Free Bots catalogue. Each card carries its own XML and uses the existing Quick Strategy import path. */
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
    if (!bots.length) return null;

    return (
        <section className='free-bots' id='free-bots-panel' aria-label='Free Bots'>
            <div className='free-bots__grid'>
                {bots.map(bot => (
                    <article className='free-bots__card' key={bot.id}>
                        <div className='free-bots__icon' aria-hidden='true'>🤖</div>
                        <div className='free-bots__body'>
                            <h3 className='free-bots__name'>{bot.name}</h3>
                            {bot.description && <p className='free-bots__description'>{bot.description}</p>}
                            {!!bot.tags?.length && <div className='free-bots__tags'>{bot.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
                        </div>
                        <button type='button' className='free-bots__load' onClick={() => onLoadBot(bot)}>Load to Bot Builder</button>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default FreeBots;
