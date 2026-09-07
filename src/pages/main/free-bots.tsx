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

const VINTEL_EVEN_BOT_XML = `<xml xmlns="http://www.w3.org/1999/xhtml" collection="false">
  <block type="trade" id="vintel_even_bot_trade" x="0" y="0">
    <statement name="SUBMARKET"><block type="market" id="vintel_even_bot_market"><field name="MARKET_LIST">volidx</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">R_25_1S</field><field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">evenodd</field><field name="TYPE_LIST">both</field><field name="CANDLEINTERVAL_LIST">60</field><field name="DURATIONTYPE_LIST">t</field><field name="PAYOUTTYPE_LIST">stake</field><field name="CURRENCY_LIST">USD</field><field name="RESTARTONERROR">FALSE</field><value name="DURATION"><block type="math_number"><field name="NUM">1</field></block></value><value name="AMOUNT"><block type="math_number"><field name="NUM">0.5</field></block></value></block></statement>
  </block>
  <block type="before_purchase" id="vintel_even_bot_before_purchase" x="0" y="268"><statement name="BEFOREPURCHASE_STACK"><block type="purchase" id="vintel_even_bot_purchase"><field name="PURCHASE_LIST">DIGITEVEN</field></block></statement></block>
</xml>`;

// Native DBot trade-definition structure: the mandatory Purchase Conditions block
// is a real before_purchase stack containing the purchase block.
const VINTEL_OVER_UNDER_DESTROYER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="http://www.w3.org/1999/xhtml" is_dbot="true" collection="false">
  <variables>
    <variable type="" id="vintel_stake">Stake</variable>
    <variable type="" id="vintel_martingale">Martingale</variable>
    <variable type="" id="vintel_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="vintel_over_under_destroyer_trade" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="vintel_over_under_market" deletable="false" movable="false">
        <field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">R_10</field>
        <next><block type="trade_definition_tradetype" id="vintel_over_under_tradetype" deletable="false" movable="false"><field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">overunder</field>
          <next><block type="trade_definition_contracttype" id="vintel_over_under_contract" deletable="false" movable="false"><field name="TYPE_LIST">both</field>
            <next><block type="trade_definition_candleinterval" id="vintel_over_under_candle" deletable="false" movable="false"><field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="vintel_over_under_restart" deletable="false" movable="false"><field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="vintel_over_under_error" deletable="false" movable="false"><field name="RESTARTONERROR">FALSE</field></block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="vintel_set_stake"><field name="VAR" id="vintel_stake" variabletype="">Stake</field><value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value>
        <next><block type="variables_set" id="vintel_set_martingale"><field name="VAR" id="vintel_martingale" variabletype="">Martingale</field><value name="VALUE"><block type="math_number"><field name="NUM">2</field></block></value>
          <next><block type="variables_set" id="vintel_set_prediction"><field name="VAR" id="vintel_prediction" variabletype="">Prediction</field><value name="VALUE"><block type="math_number"><field name="NUM">4</field></block></value></next>
        </block></next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="vintel_over_under_options">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="true"></mutation><field name="DURATIONTYPE_LIST">t</field>
        <value name="DURATION"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
        <value name="AMOUNT"><shadow type="math_number"><field name="NUM">1</field></shadow><block type="variables_get"><field name="VAR" id="vintel_stake" variabletype="">Stake</field></block></value>
        <value name="PREDICTION"><shadow type="math_number_positive"><field name="NUM">4</field></shadow><block type="variables_get"><field name="VAR" id="vintel_prediction" variabletype="">Prediction</field></block></value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="vintel_over_under_before_purchase" x="0" y="620"><statement name="BEFOREPURCHASE_STACK"><block type="purchase" id="vintel_over_under_purchase"><field name="PURCHASE_LIST">DIGITUNDER</field></block></statement></block>
  <block type="after_purchase" id="vintel_over_under_after_purchase" x="500" y="620"><statement name="AFTERPURCHASE_STACK"><block type="controls_if" id="vintel_over_under_result"><mutation else="1"></mutation><value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value><statement name="DO0"><block type="variables_set"><field name="VAR" id="vintel_stake" variabletype="">Stake</field><value name="VALUE"><block type="math_number"><field name="NUM">1</field></block></value><next><block type="trade_again"/></next></block></statement><statement name="ELSE"><block type="variables_set"><field name="VAR" id="vintel_stake" variabletype="">Stake</field><value name="VALUE"><block type="math_arithmetic"><field name="OP">MULTIPLY</field><value name="A"><block type="variables_get"><field name="VAR" id="vintel_stake" variabletype="">Stake</field></block></value><value name="B"><block type="variables_get"><field name="VAR" id="vintel_martingale" variabletype="">Martingale</field></block></value></block></value><next><block type="trade_again"/></next></block></statement></block></statement></block>
</xml>`;

export const FREE_BOTS: TFreeBot[] = [
    {
        id: 'vintel-even-bot',
        name: 'Vintel Even bot',
        description: 'Digits Even • Volatility 25 (1s) • $0.50 stake • 1 tick',
        tags: ['Digits', 'EVEN', 'V25 1s'],
        xml: VINTEL_EVEN_BOT_XML,
    },
    {
        id: 'vintel-over-under-destroyer',
        name: 'VintelTool Over/Under destroyer',
        description: 'Over/Under • R_10 • $1 stake • Martingale ×2 • TP $5 • SL $50',
        tags: ['Digits', 'OVER/UNDER', 'R_10', '$1 STAKE'],
        xml: VINTEL_OVER_UNDER_DESTROYER_XML,
    },
];

const FreeBots = ({ bots = FREE_BOTS, onLoadBot }: TFreeBotsProps) => {
    const [loading_bot_id, setLoadingBotId] = React.useState<string | null>(null);
    if (!bots.length) return null;
    const handleLoad = async (bot: TFreeBot) => {
        if (loading_bot_id) return;
        setLoadingBotId(bot.id);
        try { await onLoadBot(bot); } catch (error) { console.error('Failed to load free bot:', error); } finally { setLoadingBotId(null); }
    };
    return <section className='free-bots' id='free-bots-panel' aria-label='Free Bots'><div className='free-bots__grid'>{bots.map(bot => { const is_loading = loading_bot_id === bot.id; return <article className='free-bots__card' key={bot.id}><div className='free-bots__icon' aria-hidden='true'>🤖</div><div className='free-bots__body'><h3 className='free-bots__name'>{bot.name}</h3>{bot.description && <p className='free-bots__description'>{bot.description}</p>}{!!bot.tags?.length && <div className='free-bots__tags'>{bot.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}</div><button type='button' className='free-bots__load' onClick={() => void handleLoad(bot)} disabled={!!loading_bot_id} aria-busy={is_loading}>{is_loading ? 'Loading…' : 'Load'}</button></article>; })}</div></section>;
};

export default FreeBots;
