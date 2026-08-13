/**
 * `telegram` - send a message.
 */
import type { Block } from 'blockly/core';

import { instanceOptions, logLevelOptions, logLine, parseModeOptions, registerGenerator } from '../helpers';

const Blockly = window.Blockly;

/** Characters Telegram's MarkdownV2 wants escaped */
const ESCAPE_SUFFIX = ".replace(/([-_*\\[\\]()~`>#+=|{}.!])/g, '\\\\$1')";

export function installTelegram(): void {
    Blockly.Sendto.blocks.telegram = `<block type="telegram">
  <field name="INSTANCE"></field>
  <field name="LOG"></field>
  <field name="SILENT">FALSE</field>
  <field name="PARSEMODE">default</field>
  <field name="ESCAPING">FALSE</field>
  <field name="DISABLE_WEB_PAGE_PREVIEW">FALSE</field>
  <value name="MESSAGE">
    <shadow type="text">
      <field name="TEXT">text</field>
    </shadow>
  </value>
</block>`;

    Blockly.Blocks.telegram = {
        init: function (this: Block): void {
            this.appendDummyInput('INSTANCE')
                .appendField(Blockly.Translate('telegram'))
                .appendField(new Blockly.FieldDropdown(instanceOptions()), 'INSTANCE');

            this.appendValueInput('MESSAGE').appendField(Blockly.Translate('telegram_message'));

            for (const [name, word] of [
                ['USERNAME', 'telegram_username'],
                ['CHATID', 'telegram_chatid'],
            ] as const) {
                const input = this.appendValueInput(name).setCheck('String').appendField(Blockly.Translate(word));
                if (input.connection) {
                    // Blockly has no public API for an optional input
                    (input.connection as unknown as { _optional: boolean })._optional = true;
                }
            }

            this.appendDummyInput('LOG')
                .appendField(Blockly.Translate('telegram_log'))
                .appendField(new Blockly.FieldDropdown(logLevelOptions()), 'LOG');

            this.appendDummyInput('SILENT')
                .appendField(Blockly.Translate('telegram_silent'))
                .appendField(new Blockly.FieldCheckbox('FALSE'), 'SILENT');

            this.appendDummyInput('PARSEMODE')
                .appendField('Parsemode')
                .appendField(new Blockly.FieldDropdown(parseModeOptions()), 'PARSEMODE');

            this.appendDummyInput('ESCAPING')
                .appendField(Blockly.Translate('telegram_escaping'))
                .appendField(new Blockly.FieldCheckbox('FALSE'), 'ESCAPING');

            this.appendDummyInput('DISABLE_WEB_PAGE_PREVIEW')
                .appendField(Blockly.Translate('telegram_disable_web_preview'))
                .appendField(new Blockly.FieldCheckbox('FALSE'), 'DISABLE_WEB_PAGE_PREVIEW');

            this.setInputsInline(false);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);

            this.setColour(Blockly.Sendto.HUE);
            this.setTooltip(Blockly.Translate('telegram_tooltip'));
            this.setHelpUrl(Blockly.Translate('telegram_help'));
        },
    };

    registerGenerator('telegram', (block: Block): string => {
        const instance = block.getFieldValue('INSTANCE');
        const logLevel = block.getFieldValue('LOG');
        const username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);
        const chatId = Blockly.JavaScript.valueToCode(block, 'CHATID', Blockly.JavaScript.ORDER_ATOMIC);
        const silent = block.getFieldValue('SILENT');
        const escaping = block.getFieldValue('ESCAPING');
        const disableWebPagePreview = block.getFieldValue('DISABLE_WEB_PAGE_PREVIEW');
        const parseMode = block.getFieldValue('PARSEMODE');

        let text = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC);

        // Built before the escaping is appended, so the log shows the message as the user wrote it
        const logText = logLine(logLevel, 'telegram', username, text);

        if (text && escaping === 'TRUE') {
            text += ESCAPE_SUFFIX;
        }

        const lines = [`sendTo('telegram${instance}', 'send', {\n`];
        // an unconnected input yields no code at all - `text: ,` would not parse
        if (text) {
            lines.push(`  text: ${text},\n`);
        }
        if (username) {
            lines.push(`  user: ${username},\n`);
        }
        if (chatId) {
            lines.push(`  chatId: ${chatId},\n`);
        }
        if (silent === 'TRUE') {
            lines.push('  disable_notification: true,\n');
        }
        if (disableWebPagePreview === 'TRUE') {
            lines.push('  disable_web_page_preview: true,\n');
        }
        if (parseMode !== 'default') {
            lines.push(`  parse_mode: '${parseMode}',\n`);
        }
        lines.push(`});\n${logText}`);

        return lines.join('');
    });
}
