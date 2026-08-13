/**
 * `telegram_call` - place a call and read a text out.
 */
import type { Block } from 'blockly/core';

import { instanceOptions, logLevelOptions, logLine, registerGenerator } from '../helpers';
import { CALL_VOICES } from '../voices';

const Blockly = window.Blockly;

export function installTelegramCall(): void {
    Blockly.Sendto.blocks.telegram_call = `<sep gap="5"></sep>
<block type="telegram_call">
  <field name="INSTANCE"></field>
  <field name="LANGUAGE"></field>
  <field name="REPEATS">1</field>
  <field name="LOG"></field>
  <value name="MESSAGE">
    <shadow type="text">
      <field name="TEXT">text</field>
    </shadow>
  </value>
  <value name="USERNAME">
    <shadow type="text">
      <field name="TEXT"></field>
    </shadow>
  </value>
</block>`;

    Blockly.Blocks.telegram_call = {
        init: function (this: Block): void {
            this.appendDummyInput('INSTANCE')
                .appendField(Blockly.Translate('telegram_call'))
                .appendField(new Blockly.FieldDropdown(instanceOptions()), 'INSTANCE');

            this.appendValueInput('MESSAGE').appendField(Blockly.Translate('telegram_message'));

            const input = this.appendValueInput('USERNAME')
                .setCheck('String')
                .appendField(Blockly.Translate('telegram_username'));
            if (input.connection) {
                // Blockly has no public API for an optional input
                (input.connection as unknown as { _optional: boolean })._optional = true;
            }

            this.appendDummyInput('LANGUAGE')
                .appendField(Blockly.Translate('telegram'))
                .appendField(
                    new Blockly.FieldDropdown([[Blockly.Translate('telegram_call_system'), ''], ...CALL_VOICES]),
                    'LANGUAGE',
                );

            this.appendDummyInput('REPEATS')
                .appendField(Blockly.Translate('telegram_call_repeats'))
                .appendField(
                    new Blockly.FieldDropdown([
                        ['1', '1'],
                        ['2', '2'],
                        ['3', '3'],
                        ['4', '4'],
                        ['5', '5'],
                    ]),
                    'REPEATS',
                );

            this.appendDummyInput('LOG')
                .appendField(Blockly.Translate('telegram_log'))
                .appendField(new Blockly.FieldDropdown(logLevelOptions()), 'LOG');

            this.setInputsInline(false);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);

            this.setColour(Blockly.Sendto.HUE);
            this.setTooltip(Blockly.Translate('telegram_call_tooltip'));
            this.setHelpUrl(Blockly.Translate('telegram_call_help'));
        },
    };

    registerGenerator('telegram_call', (block: Block): string => {
        const instance = block.getFieldValue('INSTANCE');
        const language = block.getFieldValue('LANGUAGE');
        const repeats = block.getFieldValue('REPEATS');
        const logLevel = block.getFieldValue('LOG');
        const text = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC);
        const username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);

        const lines = [`sendTo('telegram${instance}', 'call', {\n`];
        // an unconnected message input yields no code at all - `text: ,` would not parse
        if (text) {
            lines.push(`  text: ${text},\n`);
        }
        if (username) {
            lines.push(`  user: ${username},\n`);
        }
        lines.push(`  lang: '${language}',\n`);
        lines.push(`  repeats: ${parseInt(repeats, 10) || 1},\n`);
        lines.push(`});\n${logLine(logLevel, 'telegramCall', username, text)}`);

        return lines.join('');
    });
}
