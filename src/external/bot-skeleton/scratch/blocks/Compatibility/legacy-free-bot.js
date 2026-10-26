import { localize } from '@deriv-com/translations';
import { getContractTypeOptions } from '../../shared';
import { modifyContextMenu } from '../../utils';

// Legacy Quick Bot Builder blocks retained so previously published XML can load.
window.Blockly.Blocks.quick_bot_fixed_variables = {
    init() {
        this.appendDummyInput().appendField(localize('Quick Bot Builder setup'));
        this.appendStatementInput('SETUP');
        this.setColour(window.Blockly.Colours?.RootBlock?.colour || 230);
        this.setTooltip(localize('Initializes variables for a legacy Quick Bot Builder strategy.'));
        this.setDeletable(false);
        this.setCollapsed(true);
    },
};

window.Blockly.Blocks.last_digits_condition = {
    init() {
        this.appendDummyInput().appendField(localize('Last digit condition'));
        this.appendDummyInput().appendField(new window.Blockly.FieldDropdown([
            [localize('≤'), 'LESS_OR_EQUAL'],
            [localize('≥'), 'GREATER_OR_EQUAL'],
            [localize('='), 'EQUAL'],
            [localize('<'), 'LESS'],
            [localize('>'), 'GREATER'],
            [localize('≠'), 'NOT_EQUAL'],
        ]), 'CONDITION');
        this.appendValueInput('N').setCheck('Number').appendField(localize('Threshold'));
        this.appendValueInput('COMPARE_VALUE').setCheck('Number').appendField(localize('Compare value'));
        this.setOutput(true, 'Boolean');
        this.setColour(window.Blockly.Colours?.Base?.colour || 210);
        this.setTooltip(localize('Compares the current last digit with the configured comparison value.'));
        this.setInputsInline(false);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_digits_condition = block => {
    const left = window.Blockly.JavaScript.javascriptGenerator.valueToCode(block, 'N', window.Blockly.JavaScript.javascriptGenerator.ORDER_RELATIONAL) || '0';
    const right = window.Blockly.JavaScript.javascriptGenerator.valueToCode(block, 'COMPARE_VALUE', window.Blockly.JavaScript.javascriptGenerator.ORDER_RELATIONAL) || '0';
    const operators = { LESS_OR_EQUAL: '<=', GREATER_OR_EQUAL: '>=', EQUAL: '===', LESS: '<', GREATER: '>', NOT_EQUAL: '!==' };
    const operator = operators[block.getFieldValue('CONDITION')] || '<=';
    return [`(Number(Bot.getLastDigit()) ${operator} Number(${right}))`, window.Blockly.JavaScript.javascriptGenerator.ORDER_RELATIONAL];
};

window.Blockly.Blocks.apollo_purchase2 = {
    init() {
        this.appendDummyInput().appendField(localize('Purchase')).appendField(new window.Blockly.FieldDropdown([['', '']]), 'PURCHASE_LIST');
        this.appendValueInput('PREDICTION').setCheck('Number').appendField(localize('Prediction'));
        this.setPreviousStatement(true);
        this.setColour(window.Blockly.Colours?.Special1?.colour || 20);
        this.setTooltip(localize('Legacy purchase block with a digit prediction.'));
        this.setInputsInline(false);
        this.setOnChange(function(event) {
            if (!this.workspace || this.workspace.isFlyout || this.workspace.isDragging()) return;
            const root = this.workspace.getTradeDefinitionBlock?.();
            if (!root) return;
            const tradeTypeBlock = root.getChildByType?.('trade_definition_tradetype');
            const contractTypeBlock = root.getChildByType?.('trade_definition_contracttype');
            if (!tradeTypeBlock || !contractTypeBlock) return;
            const options = getContractTypeOptions(contractTypeBlock.getFieldValue('TYPE_LIST'), tradeTypeBlock.getFieldValue('TRADETYPE_LIST'));
            const field = this.getField('PURCHASE_LIST');
            if (field && Array.isArray(options) && options.length) {
                field.updateOptions(options, { default_value: field.getValue(), event_group: event?.group, should_pretend_empty: true });
            }
        });
        modifyContextMenu?.(this);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.apollo_purchase2 = block => {
    const contract = block.getFieldValue('PURCHASE_LIST') || 'DIGITOVER';
    const prediction = window.Blockly.JavaScript.javascriptGenerator.valueToCode(block, 'PREDICTION', window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC) || '0';
    return `Bot.purchase('${contract}');\n`;
};
