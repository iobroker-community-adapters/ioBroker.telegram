/**
 * `telegram_ask` - send a question with answer buttons and run a statement per answer.
 *
 * The number of answers is a mutation, so this block brings the two helper blocks the mutator
 * dialog is built from along with it.
 */
import type { Block, BlockSvg, Connection, Workspace } from 'blockly/core';

import {
    instanceOptions,
    logLevelOptions,
    logLine,
    parseModeOptions,
    reconnectChild,
    registerGenerator,
} from '../helpers';

const Blockly = window.Blockly;

/** Blockly 13 removed `Blockly.ALIGN_RIGHT`; `inputs.Align.RIGHT` replaced it with the same value */
const ALIGN_RIGHT = Blockly.inputs?.Align.RIGHT ?? 1;

/** The block plus the state its mutation keeps */
interface AskBlock extends Block {
    /** label of every answer, in order */
    answers_: string[];
    itemCount_: number;
    updateShape_: () => void;
}

/** A block in the mutator dialog remembers what used to hang on its input */
interface MutatorItemBlock extends Block {
    valueConnection_?: Connection | null;
}

export function installTelegramAsk(): void {
    Blockly.Sendto.blocks.telegram_ask = `<sep gap="5"></sep>
<block type="telegram_ask">
  <mutation>
    <answer id="ANSWER_0" name="yes"></answer>
  </mutation>
  <field name="INSTANCE"></field>
  <field name="LOG"></field>
  <field name="PARSEMODE">default</field>
  <value name="QUESTION">
    <shadow type="text">
      <field name="TEXT">text</field>
    </shadow>
  </value>
  <value name="ANSWER_0">
    <shadow type="text">
      <field name="TEXT">Yes, please</field>
    </shadow>
  </value>
</block>`;

    /** Mutator dialog: the container the answer blocks are stacked in */
    Blockly.Blocks.telegram_ask_container = {
        init: function (this: Block): void {
            this.setColour(Blockly.Object.HUE);

            this.appendDummyInput().appendField(Blockly.Translate('telegram_ask_answers'));

            this.appendStatementInput('STACK');
            this.setTooltip(Blockly.Translate('object_new_tooltip'));

            this.contextMenu = false;
        },
    };

    /** Mutator dialog: one answer */
    Blockly.Blocks.telegram_ask_mutator = {
        init: function (this: Block): void {
            this.setColour(Blockly.Sendto.HUE);

            this.appendDummyInput('ANSWER')
                .appendField(Blockly.Translate('telegram_ask_answer'))
                .appendField(new Blockly.FieldTextInput('okay'), 'ANSWER');

            this.setPreviousStatement(true);
            this.setNextStatement(true);

            this.setTooltip(Blockly.Translate('telegram_ask_tooltip'));

            this.contextMenu = false;
        },
    };

    Blockly.Blocks.telegram_ask = {
        init: function (this: AskBlock): void {
            this.answers_ = [];
            this.itemCount_ = 0;
            // In the editor the block is always rendered, so it really is a BlockSvg here
            const self = this as unknown as BlockSvg;
            if (Blockly.icons) {
                this.setMutator(new Blockly.icons.MutatorIcon(['telegram_ask_mutator'], self));
            } else if (Blockly.Mutator) {
                // Blockly 9.x
                this.setMutator(new Blockly.Mutator(['telegram_ask_mutator'], self) as never);
            }

            this.appendDummyInput('INSTANCE')
                .appendField(Blockly.Translate('telegram_ask'))
                .appendField(new Blockly.FieldDropdown(instanceOptions()), 'INSTANCE');

            this.appendValueInput('QUESTION').appendField(Blockly.Translate('telegram_ask_question'));

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

            this.appendDummyInput('PARSEMODE')
                .appendField('Parsemode')
                .appendField(new Blockly.FieldDropdown(parseModeOptions()), 'PARSEMODE');

            this.setInputsInline(false);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);

            this.setColour(Blockly.Sendto.HUE);
            this.setTooltip(Blockly.Translate('telegram_tooltip'));
            this.setHelpUrl(Blockly.Translate('telegram_help'));
        },

        /** Stores the answers in the workspace XML */
        mutationToDom: function (this: AskBlock): Element {
            const container = document.createElement('mutation');

            for (let i = 0; i < this.answers_.length; i++) {
                const parameter = document.createElement('answer');
                parameter.setAttribute('id', `ANSWER_${i}`);
                parameter.setAttribute('name', this.answers_[i]);
                container.appendChild(parameter);
            }

            return container;
        },

        /**
         * Restores the answers from the workspace XML
         *
         * @param xmlElement
         */
        domToMutation: function (this: AskBlock, xmlElement: Element): void {
            this.answers_ = [];

            for (let i = 0, childNode; (childNode = xmlElement.childNodes[i]); i++) {
                if (childNode.nodeName.toLowerCase() === 'answer') {
                    this.answers_.push((childNode as Element).getAttribute('name') || '');
                }
            }

            this.itemCount_ = this.answers_.length;
            this.updateShape_();
        },

        /**
         * Builds the stack shown in the mutator dialog
         *
         * @param workspace
         */
        decompose: function (this: AskBlock, workspace: Workspace): Block {
            const containerBlock = workspace.newBlock('telegram_ask_container') as BlockSvg;
            containerBlock.initSvg();

            let connection = containerBlock.getInput('STACK')!.connection;
            for (let i = 0; i < this.itemCount_; i++) {
                const itemBlock = workspace.newBlock('telegram_ask_mutator') as BlockSvg;
                itemBlock.setFieldValue(this.answers_[i], 'ANSWER');
                itemBlock.initSvg();
                connection!.connect(itemBlock.previousConnection!);
                connection = itemBlock.nextConnection;
            }

            return containerBlock;
        },

        /**
         * Applies what the mutator dialog was left in
         *
         * @param containerBlock
         */
        compose: function (this: AskBlock, containerBlock: Block): void {
            this.answers_ = [];

            let itemBlock: MutatorItemBlock | null = containerBlock.getInputTargetBlock('STACK');
            // Count number of inputs.
            const connections: (Connection | null | undefined)[] = [];
            while (itemBlock) {
                this.answers_.push(itemBlock.getFieldValue('ANSWER'));

                connections.push(itemBlock.valueConnection_);
                itemBlock = itemBlock.nextConnection?.targetBlock() || null;
            }

            // Disconnect any children that don't belong.
            for (let k = 0; k < this.itemCount_; k++) {
                const connection = this.getInput(`ANSWER_${k}`)?.connection?.targetConnection;
                if (connection && !connections.includes(connection)) {
                    connection.disconnect();
                }
            }

            this.itemCount_ = connections.length;
            this.updateShape_();

            // Reconnect any child blocks.
            for (let i = 0; i < this.itemCount_; i++) {
                reconnectChild(connections[i] ?? null, this, `ANSWER_${i}`);
            }
        },

        /**
         * Remembers what hangs on each answer input before the dialog rearranges things
         *
         * @param containerBlock
         */
        saveConnections: function (this: AskBlock, containerBlock: Block): void {
            let itemBlock: MutatorItemBlock | null = containerBlock.getInputTargetBlock('STACK');
            let i = 0;

            while (itemBlock) {
                const input = this.getInput(`ANSWER_${i}`);
                itemBlock.valueConnection_ = input?.connection?.targetConnection;
                i++;
                itemBlock = itemBlock.nextConnection?.targetBlock() || null;
            }
        },

        /** Adds and removes the answer inputs so the block matches `itemCount_` */
        updateShape_: function (this: AskBlock): void {
            const workspace = this.workspace;

            // Add new inputs.
            for (let i = 0; i < this.itemCount_; i++) {
                let input = this.getInput(`ANSWER_${i}`);

                if (!input) {
                    input = this.appendValueInput(`ANSWER_${i}`).setAlign(ALIGN_RIGHT);
                    input.appendField(this.answers_[i]);
                } else {
                    input.fieldRow[0].setValue(this.answers_[i]);
                }

                if (!this.getInput(`STATEMENT_${i}`)) {
                    this.appendStatementInput(`STATEMENT_${i}`);
                }

                // A fresh input gets an empty text block, so the answer is never left dangling
                setTimeout(
                    (__input: typeof input) => {
                        if (!__input.connection?.isConnected()) {
                            const shadow = workspace.newBlock('text') as BlockSvg;
                            shadow.setShadow(true);
                            shadow.setFieldValue('text', 'TEXT');
                            shadow.initSvg();
                            shadow.render();
                            shadow.outputConnection!.connect(__input.connection!);
                        }
                    },
                    100,
                    input,
                );
            }

            // Remove deleted inputs.
            for (let i = this.itemCount_; this.getInput(`ANSWER_${i}`); i++) {
                this.removeInput(`ANSWER_${i}`);
                this.removeInput(`STATEMENT_${i}`);
            }
        },
    };

    registerGenerator('telegram_ask', (block: Block): string => {
        const askBlock = block as AskBlock;

        const answers: { id: number; answer: string; statement: string }[] = [];
        for (let id = 0; id < askBlock.itemCount_; id++) {
            const answer = Blockly.JavaScript.valueToCode(block, `ANSWER_${id}`, Blockly.JavaScript.ORDER_ATOMIC);
            const statement = Blockly.JavaScript.statementToCode(block, `STATEMENT_${id}`);
            if (answer && statement) {
                answers.push({ id, answer, statement });
            }
        }

        const instance = block.getFieldValue('INSTANCE');
        const logLevel = block.getFieldValue('LOG');
        const parseMode = block.getFieldValue('PARSEMODE');
        const question = Blockly.JavaScript.valueToCode(block, 'QUESTION', Blockly.JavaScript.ORDER_ATOMIC);
        const username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);
        const chatId = Blockly.JavaScript.valueToCode(block, 'CHATID', Blockly.JavaScript.ORDER_ATOMIC);

        const logAnswer = logLevel
            ? `  console.${logLevel}('telegramAsk answer: ' + (msg?.data ?? '[no answer]'));\n`
            : '';

        const keyboard = answers.map(a => `      [ { text: ${a.answer}, callback_data: '${a.id}' } ],`).join('\n');
        const branches = answers
            .map(
                a =>
                    `  if (msg?.data && msg.data == '${a.id}') {\n${Blockly.JavaScript.prefixLines(a.statement, Blockly.JavaScript.INDENT)}  }`,
            )
            .join('\n');

        const lines = [`sendTo('telegram${instance}', 'ask', {\n`];
        // an unconnected input yields no code at all - `text: ,` would not parse
        if (question) {
            lines.push(`  text: ${question},\n`);
        }
        if (username) {
            lines.push(`  user: ${username},\n`);
        }
        if (chatId) {
            lines.push(`  chatId: ${chatId},\n`);
        }
        if (parseMode !== 'default') {
            lines.push(`  parse_mode: '${parseMode}',\n`);
        }
        lines.push('  reply_markup: {\n');
        lines.push('    inline_keyboard: [\n');
        lines.push(`${keyboard}\n`);
        lines.push('    ],\n');
        lines.push('  }\n');
        lines.push(`}, async (msg) => {\n${logAnswer}`);
        lines.push(branches);
        lines.push(`\n});\n${logLine(logLevel, 'telegramAsk', username, question)}`);

        return lines.join('');
    });
}
