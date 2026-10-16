// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import { action, makeObservable, observable, reaction } from 'mobx';
import { ApiHelpers, config as qs_config } from '@/external/bot-skeleton';
import { save_types } from '@/external/bot-skeleton/constants/save-type';
import { addDynamicBlockToDOM } from '@/utils/xml-dom-quick-strategy';
import { loadBlocks } from '@/external/bot-skeleton/scratch/utils';
import { removeLimitedBlocks } from '@/external/bot-skeleton/utils/workspace';
import { STRATEGIES } from '../pages/bot-builder/quick-strategy/config';
import { TFormData } from '../pages/bot-builder/quick-strategy/types';
import { getSetting, storeSetting } from '../utils/settings';
import RootStore from './root-store';

export type TActiveSymbol = { group: string; text: string; value: string };
export type TLossThresholdWarningData = { show: boolean; loss_amount?: string | number; currency?: string; highlight_field?: Array<string>; already_shown?: boolean };

interface IQuickStrategyStore {
    additional_data: Record<string, unknown>;
    current_duration_min_max: { min: number; max: number };
    root_store: RootStore;
    is_open: boolean;
    selected_strategy: string;
    selected_strategy_for_notofy: string;
    form_data: TFormData;
    loss_threshold_warning_data: { show: boolean };
    is_contract_dialog_open: boolean;
    is_stop_bot_dialog_open: boolean;
    is_options_loading: boolean;
    pending_free_bot: { xml: string; name: string } | null;
    setLossThresholdWarningData: (data: TLossThresholdWarningData) => void;
    setFormVisibility: (is_open: boolean) => void;
    setSelectedStrategy: (strategy: string) => void;
    setValue: (name: string, value: string) => void;
    onSubmit: (data: TFormData) => void;
    loadConfiguredQuickBot: (configuration: Record<string, any>) => Promise<void>;
    loadFreeBotXml: (xml: string, botName?: string) => Promise<void>;
    importPendingFreeBot: () => Promise<void>;
    toggleStopBotDialog: () => void;
    setCurrentDurationMinMax: (min: number, max: number) => void;
    setOptionsLoading: (is_loading: boolean) => void;
}

export default class QuickStrategyStore implements IQuickStrategyStore {
    root_store: RootStore;
    is_open = false;
    selected_strategy = 'MARTINGALE';
    selected_strategy_for_notofy = '';
    form_data: TFormData = {
        symbol: qs_config().QUICK_STRATEGY.DEFAULT.symbol,
        tradetype: qs_config().QUICK_STRATEGY.DEFAULT.tradetype,
        durationtype: qs_config().QUICK_STRATEGY.DEFAULT.durationtype,
        action: 'RUN',
    };
    is_contract_dialog_open = false;
    is_stop_bot_dialog_open = false;
    is_options_loading = false;
    current_duration_min_max = { min: 0, max: 10 };
    loss_threshold_warning_data: TLossThresholdWarningData = { show: false };
    additional_data = {};
    pending_free_bot: { xml: string; name: string } | null = null;
    workspace_load_queue: Promise<void> = Promise.resolve();

    constructor(root_store: RootStore) {
        makeObservable(this, {
            additional_data: observable, current_duration_min_max: observable, form_data: observable,
            is_contract_dialog_open: observable, is_open: observable, is_stop_bot_dialog_open: observable,
            is_options_loading: observable, pending_free_bot: observable, initializeLossThresholdWarningData: action,
            selected_strategy: observable, selected_strategy_for_notofy: observable, loss_threshold_warning_data: observable,
            onSubmit: action, loadConfiguredQuickBot: action, setAdditionalData: action, setCurrentDurationMinMax: action, setFormVisibility: action,
            setSelectedStrategy: action, setLossThresholdWarningData: action, setValue: action,
            toggleStopBotDialog: action, setOptionsLoading: action, loadFreeBotXml: action, importPendingFreeBot: action,
        });
        this.root_store = root_store;
        const savedStrategy = getSetting('selected_strategy_for_notofy');
        if (savedStrategy) this.selected_strategy_for_notofy = savedStrategy;
        reaction(() => this.is_open, () => { if (!this.is_open) this.selected_strategy = 'MARTINGALE'; });
    }

    setAdditionalData = (data: Record<string, unknown>) => { this.additional_data = { ...this.additional_data, ...data }; };
    setLossThresholdWarningData = (data: TLossThresholdWarningData) => { this.loss_threshold_warning_data = { ...this.loss_threshold_warning_data, ...data }; };
    initializeLossThresholdWarningData = () => { this.loss_threshold_warning_data = { show: false, highlight_field: [], already_shown: false }; };
    setFormVisibility = (is_open: boolean) => { this.is_open = is_open; };
    setSelectedStrategy = (strategy: string) => { this.selected_strategy = strategy; };
    setValue = (name: string, value: string | number | boolean) => { this.form_data[name as keyof TFormData] = value; };
    setCurrentDurationMinMax = (min = 0, max = 10) => { this.current_duration_min_max = { min, max }; };

    loadFreeBotXml = async (xml: string, botName = 'Free Bot') => {
        if (!xml?.trim()) return;
        this.pending_free_bot = { xml, name: botName };
        this.setFormVisibility(true);
        void this.importPendingFreeBot();
    };

    waitForWorkspace = async () => {
        for (let attempt = 0; attempt < 240; attempt += 1) {
            const workspace = window.Blockly?.derivWorkspace;
            if (workspace && window.Blockly?.utils?.xml) return workspace;
            await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
        throw new Error('Bot Builder workspace is not ready.');
    };

    importPendingFreeBot = async () => {
        if (!this.pending_free_bot) return;
        const pending = this.pending_free_bot;
        const runImport = async () => {
            try {
                const workspace = await this.waitForWorkspace();
                const strategy_dom = window.Blockly.utils.xml.textToDom(pending.xml);
                const blockTypes = Array.from(strategy_dom.querySelectorAll('block'))
                    .map(block => block.getAttribute('type'))
                    .filter(Boolean);
                removeLimitedBlocks(workspace, blockTypes);
                loadBlocks(strategy_dom, null, `quick-strategy-free-bot-${Date.now()}`, workspace);
                this.pending_free_bot = null;
                this.setAdditionalData({ free_bot_name: pending.name });
                this.setFormVisibility(false);
            } catch (error) {
                console.error('Quick Strategy free bot load failed:', error);
            }
        };
        const previous = this.workspace_load_queue;
        const current = previous.catch(() => undefined).then(runImport);
        this.workspace_load_queue = current.then(() => undefined, () => undefined);
        await current;
    };

    loadConfiguredQuickBot = async (configuration: Record<string, any>) => {
        const runImport = async () => {
            const workspace = await this.waitForWorkspace();
            const cfg = configuration || {};
            const tradeFamily = String(cfg.tradeFamily || 'Digits');
            const tradeType = String(cfg.tradeType || 'Even/Odd');
            const purchase = String(cfg.purchase || 'Trade Even');
            const contract = String(cfg.contract || 'Both');
            const durationType = ['t', 's', 'm'].includes(String(cfg.durationType)) ? String(cfg.durationType) : 't';
            const duration = Math.max(1, Number(cfg.duration) || 1);
            const stake = Math.max(0.35, Number(cfg.stake) || 1);
            const marketGroup = String(cfg.marketGroup || 'Derived');
            const marketType = String(cfg.marketType || 'Continuous Indices');
            const symbol = String(cfg.symbol || 'R_10');
            const category = tradeFamily === 'Up/Down' || tradeType === 'Rise/Fall' ? 'callput' : 'digits';
            const tradeTypeCode = tradeType === 'Over/Under' ? 'overunder' : tradeType === 'Matches/Differs' ? 'matchdiff' : tradeType === 'Rise/Fall' ? 'callput' : 'evenodd';
            const purchaseMap: Record<string, string> = {
                'Trade Even': 'EVEN', Even: 'EVEN', 'Trade Odd': 'ODD', Odd: 'ODD',
                Over: 'DIGITOVER', Under: 'DIGITUNDER', Matches: 'DIGITMATCH', Differs: 'DIGITDIFF',
                'Trade Rise': 'CALL', Rise: 'CALL', 'Trade Fall': 'PUT', Fall: 'PUT',
            };
            const contractMap: Record<string, string> = {
                Even: 'EVEN', Odd: 'ODD', Over: 'DIGITOVER', Under: 'DIGITUNDER',
                Rise: 'CALL', Fall: 'PUT', Matches: 'DIGITMATCH', Differs: 'DIGITDIFF',
            };
            const purchaseCode = contractMap[contract] || purchaseMap[purchase] || 'EVEN';
            const marketCode = marketGroup === 'Derived' ? 'synthetic_index' : marketGroup === 'Forex' ? 'forex' : 'commodities';
            const submarketCode = marketGroup === 'Derived' ? 'random_index' : marketGroup === 'Forex' ? 'major_pairs' : 'metals';
            const safe = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch] || ch));
            const recoveryPurchase = String(cfg.recoveryPurchase || purchase);
            const recoveryPurchaseCode = contractMap[recoveryPurchase] || purchaseMap[recoveryPurchase] || purchaseCode;
            const prediction = Math.max(0, Math.min(9, Number(cfg.prediction ?? 5)));
            const recoveryPrediction = Math.max(0, Math.min(9, Number(cfg.recoveryPrediction ?? prediction)));
            const recoveryEnabled = Boolean(cfg.recoveryMode);
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="http://www.w3.org/1999/xhtml" is_dbot="true" collection="false">
  <variables>
    <variable type="" id="vintel_qbb_stake">Stake</variable>
    <variable type="" id="vintel_qbb_martingale">Martingale</variable>
    <variable type="" id="vintel_qbb_prediction">Prediction</variable>
  </variables>
  <block type="trade_definition" id="vintel_qbb_trade" x="20" y="20">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="vintel_qbb_market" deletable="false" movable="false">
        <field name="MARKET_LIST">${safe(marketCode)}</field><field name="SUBMARKET_LIST">${safe(submarketCode)}</field><field name="SYMBOL_LIST">${safe(symbol)}</field>
        <next><block type="trade_definition_tradetype" id="vintel_qbb_trade_type" deletable="false" movable="false">
          <field name="TRADETYPECAT_LIST">${category}</field><field name="TRADETYPE_LIST">${tradeTypeCode}</field>
          <next><block type="trade_definition_contracttype" id="vintel_qbb_contract" deletable="false" movable="false">
            <field name="TYPE_LIST">${purchaseCode}</field>
            <next><block type="trade_definition_candleinterval" id="vintel_qbb_candle"><field name="CANDLEINTERVAL_LIST">60</field>
              <next><block type="trade_definition_restartbuysell" id="vintel_qbb_restart"><field name="TIME_MACHINE_ENABLED">FALSE</field>
                <next><block type="trade_definition_restartonerror" id="vintel_qbb_error"><field name="RESTARTONERROR">FALSE</field></block></next>
              </block></next>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="vintel_qbb_init_stake"><field name="VAR" id="vintel_qbb_stake">Stake</field><value name="VALUE"><block type="math_number"><field name="NUM">${stake}</field></block></value>
        <next><block type="variables_set" id="vintel_qbb_init_martingale"><field name="VAR" id="vintel_qbb_martingale">Martingale</field><value name="VALUE"><block type="math_number"><field name="NUM">${Math.max(1, Number(cfg.multiplier) || 2)}</field></block></value>
          <next><block type="variables_set" id="vintel_qbb_init_prediction"><field name="VAR" id="vintel_qbb_prediction">Prediction</field><value name="VALUE"><block type="math_number"><field name="NUM">${prediction}</field></block></value></next>
        </block></next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="vintel_qbb_options">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${['Over/Under','Matches/Differs'].includes(tradeType) ? 'true' : 'false'}"></mutation>
        <field name="DURATIONTYPE_LIST">${durationType}</field>
        <value name="DURATION"><shadow type="math_number"><field name="NUM">${duration}</field></shadow></value>
        <value name="AMOUNT"><shadow type="math_number"><field name="NUM">${stake}</field></shadow><block type="variables_get"><field name="VAR" id="vintel_qbb_stake">Stake</field></block></value>
        ${['Over/Under','Matches/Differs'].includes(tradeType) ? `<value name="PREDICTION"><shadow type="math_number_positive"><field name="NUM">${prediction}</field></shadow><block type="variables_get"><field name="VAR" id="vintel_qbb_prediction">Prediction</field></block></value>` : ''}
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="vintel_qbb_before_purchase" x="20" y="620">
    <statement name="BEFOREPURCHASE_STACK"><block type="purchase" id="vintel_qbb_purchase"><field name="PURCHASE_LIST">${purchaseCode}</field></block></statement>
  </block>
  <block type="after_purchase" id="vintel_qbb_after_purchase" x="520" y="620">
    <statement name="AFTERPURCHASE_STACK"><block type="controls_if" id="vintel_qbb_result"><mutation else="1"></mutation>
      <value name="IF0"><block type="contract_check_result"><field name="CHECK_RESULT">win</field></block></value>
      <statement name="DO0">
        <block type="variables_set" id="vintel_qbb_win_stake"><field name="VAR" id="vintel_qbb_stake">Stake</field><value name="VALUE"><block type="math_number"><field name="NUM">${stake}</field></block></value>
          <next><block type="variables_set" id="vintel_qbb_win_prediction"><field name="VAR" id="vintel_qbb_prediction">Prediction</field><value name="VALUE"><block type="math_number"><field name="NUM">${prediction}</field></block></value></next>
        </block>
      </statement>
      <statement name="ELSE">
        <block type="controls_if" id="vintel_qbb_recovery_gate">
          <value name="IF0"><block type="logic_boolean"><field name="BOOL">${recoveryEnabled ? 'TRUE' : 'FALSE'}</field></block></value>
          <statement name="DO0">
            <block type="variables_set" id="vintel_qbb_loss_stake"><field name="VAR" id="vintel_qbb_stake">Stake</field><value name="VALUE"><block type="math_arithmetic"><field name="OP">MULTIPLY</field><value name="A"><block type="variables_get"><field name="VAR" id="vintel_qbb_stake">Stake</field></block></value><value name="B"><block type="variables_get"><field name="VAR" id="vintel_qbb_martingale">Martingale</field></block></value></block></value>
              <next><block type="variables_set" id="vintel_qbb_loss_prediction"><field name="VAR" id="vintel_qbb_prediction">Prediction</field><value name="VALUE"><block type="math_number"><field name="NUM">${recoveryPrediction}</field></block></value></block></next>
            </block>
          </statement>
        </block>
      </statement>
      <next><block type="trade_again" id="vintel_qbb_trade_again"></block></next>
    </block></statement>
  </block>
</xml>`;
            const strategyDom = window.Blockly.utils.xml.textToDom(xml);
            const blockTypes = Array.from(strategyDom.querySelectorAll('block')).map((block: Element) => block.getAttribute('type')).filter(Boolean);
            removeLimitedBlocks(workspace, blockTypes);
            loadBlocks(strategyDom, null, `vintel-quick-builder-${Date.now()}`, workspace);
            // Keep the same values in the native Quick Strategy form state used by
            // Bot Builder/Run, not only in the Quick Bot Builder component.
            const nativeFormData = {
                ...this.form_data,
                symbol,
                tradetype: tradeTypeCode,
                type: purchaseCode,
                stake: String(stake),
                durationtype: durationType,
                duration: String(duration),
                profit: String(Math.max(0, Number(cfg.profit) || 0)),
                loss: String(Math.max(0, Number(cfg.loss) || 0)),
                last_digit_prediction: String(prediction),
                action: 'EDIT',
            };
            Object.entries(nativeFormData).forEach(([key, value]) => this.setValue(key, value as string));
            try {
                const saved = JSON.parse(localStorage.getItem('qs-fields') || '{}');
                localStorage.setItem('qs-fields', JSON.stringify({ ...saved, ...nativeFormData }));
                localStorage.setItem('vintel-quick-bot-builder-config', JSON.stringify(cfg));
            } catch (error) {
                console.warn('Could not persist Quick Bot Builder parameters:', error);
            }
            this.setAdditionalData({
                quick_bot_builder_config: cfg,
                quick_bot_builder_parameters: {
                    symbol, tradeType: tradeTypeCode, contractType: purchaseCode,
                    stake, durationType, duration,
                    takeProfit: Math.max(0, Number(cfg.profit) || 0),
                    stopLoss: Math.max(0, Number(cfg.loss) || 0),
                    martingale: Boolean(cfg.martingale || cfg.recoveryMode),
                    recoveryMode: Boolean(cfg.recoveryMode),
                    martingaleMultiplier: Math.max(1, Number(cfg.multiplier) || 2),
                    prediction,
                    recoveryPrediction,
                    analysisEnabled: Boolean(cfg.analysisEnabled),
                    analysisCondition: cfg.analysisCondition ?? cfg.condition ?? null,
                },
            });
            this.setFormVisibility(false);
        };
        const previous = this.workspace_load_queue;
        const current = previous.catch(() => undefined).then(runImport);
        this.workspace_load_queue = current.then(() => undefined, () => undefined);
        await current;
    };

    onSubmit = async (data: TFormData) => {
        const runImport = async () => {
            const { contracts_for } = ApiHelpers?.instance ?? {};
            if (!contracts_for) return;
            const market = await contracts_for.getMarketBySymbol(data.symbol);
            const submarket = await contracts_for.getSubmarketBySymbol(data.symbol);
            const trade_type_cat = await contracts_for.getTradeTypeCategoryByTradeType(data.tradetype);
            const selected_strategy = STRATEGIES()[this.selected_strategy];
            if (!selected_strategy) return;
            this.selected_strategy_for_notofy = this.selected_strategy;
            storeSetting('selected_strategy_for_notofy', this.selected_strategy);
            const strategy_xml = await import(/* webpackChunkName: `[request]` */ `../xml/${selected_strategy.name}.xml`);
            const strategy_dom = window.Blockly.utils.xml.textToDom(strategy_xml.default);
            addDynamicBlockToDOM('PREDICTION', 'last_digit_prediction', trade_type_cat, strategy_dom);
            const modifyValueInputs = (key: string, value: number) => {
                const el_value_inputs = strategy_dom?.querySelectorAll(`value[strategy_value="${key}"]`);
                el_value_inputs?.forEach((el_value_input: HTMLElement) => {
                    if (key.includes('boolean')) el_value_input.innerHTML = value ? `<block type="logic_boolean"><field name="BOOL">TRUE</field></block>` : `<block type="logic_boolean"><field name="BOOL">FALSE</field></block>`;
                    else el_value_input.innerHTML = `<shadow type="math_number"><field name="NUM">${value}</field></shadow>`;
                });
            };
            const modifyFieldDropdownValues = (name: string, value: string) => {
                const name_list = `${name.toUpperCase()}_LIST`;
                strategy_dom?.querySelectorAll(`field[name="${name_list}"]`)?.forEach((el_block: HTMLElement) => { el_block.innerHTML = value; });
            };
            const { unit, action, type, growth_rate, ...rest_data } = data;
            const fields_to_update = { market, submarket, tradetypecat: trade_type_cat, dalembert_unit: unit, oscar_unit: unit, type: 'both', ...rest_data, purchase: type, growthrate: growth_rate ? growth_rate.toString() : undefined };
            Object.keys(fields_to_update).forEach(key => {
                const value = fields_to_update[key as keyof typeof fields_to_update];
                if (!isNaN(value as number) && key !== 'growthrate') modifyValueInputs(key, value as number);
                else if (typeof value === 'string') modifyFieldDropdownValues(key, value);
            });
            const workspace = await this.waitForWorkspace();
            const blockly_xml = strategy_dom.querySelectorAll('block');
            const blockTypes = Array.from(blockly_xml)
                .map(block => block.getAttribute('type'))
                .filter(Boolean);
            removeLimitedBlocks(workspace, blockTypes);
            loadBlocks(strategy_dom, null, `quick-strategy-load${Date.now()}`, workspace);
            if (action === 'EDIT') {
                this.setFormVisibility(false);
                return;
            }
            if (action === 'RUN') return;
        };
        const previous = this.workspace_load_queue;
        const current = previous.catch(() => undefined).then(runImport);
        this.workspace_load_queue = current.then(() => undefined, () => undefined);
        await current;
    };

    toggleStopBotDialog = (): void => {
        this.is_contract_dialog_open = !this.is_contract_dialog_open;
        this.is_stop_bot_dialog_open = !this.is_stop_bot_dialog_open;
        this.setFormVisibility(false);
    };
    setOptionsLoading = (is_loading: boolean): void => { this.is_options_loading = is_loading; };
}
