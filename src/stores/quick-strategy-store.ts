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
            onSubmit: action, setAdditionalData: action, setCurrentDurationMinMax: action, setFormVisibility: action,
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

    // Free Bots first enter Quick Strategy, then immediately import their XML into Bot Builder.
    loadFreeBotXml = async (xml: string, botName = 'Free Bot') => {
        if (!xml?.trim()) return;
        this.pending_free_bot = { xml, name: botName };
        this.setFormVisibility(true);
        void this.importPendingFreeBot();
    };

    // Same queued Blockly loader used by Quick Strategy, with no competing workspace loader.
    importPendingFreeBot = async () => {
        if (!this.pending_free_bot) return;
        const pending = this.pending_free_bot;
        const runImport = async () => {
            let workspace = window.Blockly?.derivWorkspace;
            for (let attempt = 0; !workspace && attempt < 100; attempt += 1) {
                await new Promise<void>(resolve => setTimeout(resolve, 50));
                workspace = window.Blockly?.derivWorkspace;
            }
            if (!workspace) {
                console.error(`Quick Strategy workspace did not mount while loading free bot: ${pending.name}`);
                return;
            }
            const strategy_dom = window.Blockly.utils.xml.textToDom(pending.xml);
            const blockTypes = Array.from(strategy_dom.querySelectorAll('block')).map(block => block.getAttribute('type')).filter(Boolean);
            removeLimitedBlocks(workspace, blockTypes);
            loadBlocks(strategy_dom, null, `quick-strategy-free-bot-${Date.now()}`, workspace);
            this.pending_free_bot = null;
            this.setAdditionalData({ free_bot_name: pending.name });
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
            const workspace = window.Blockly?.derivWorkspace;
            if (!workspace) return;
            const blockly_xml = strategy_dom.querySelectorAll('block');
            removeLimitedBlocks(workspace, Array.from(blockly_xml).map(block => block.getAttribute('type')));
            loadBlocks(strategy_dom, null, `quick-strategy-load${Date.now()}`, workspace);
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