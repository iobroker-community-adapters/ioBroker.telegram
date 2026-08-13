/**
 * Pieces all three telegram blocks share.
 */
import type { Block, Connection } from 'blockly/core';

const Blockly = window.Blockly;

/**
 * The instance dropdown: every `telegram.x` the admin knows about, or `telegram.0` .. `telegram.4`
 * while the editor has not reported any instances yet.
 */
export function instanceOptions(): [string, string][] {
    const options: [string, string][] = [[Blockly.Translate('telegram_anyInstance'), '']];

    const instances = window.main?.instances;
    if (instances) {
        for (let i = 0; i < instances.length; i++) {
            const m = instances[i].match(/^system\.adapter\.telegram\.(\d+)$/);
            if (m) {
                const n = parseInt(m[1], 10);
                options.push([`telegram.${n}`, `.${n}`]);
            }
        }
    }

    // Nothing but "all instances" so far - the editor does not know any telegram instance (yet),
    // so offer the usual ones. The original guarded this with `options.length === 0`, which can
    // never be true because "all instances" is already in, leaving the dropdown with that single
    // entry whenever the instance list held no telegram.
    if (options.length === 1) {
        for (let n = 0; n <= 4; n++) {
            options.push([`telegram.${n}`, `.${n}`]);
        }
    }

    return options;
}

/** The log level dropdown. The values are console method names, an empty one means "do not log". */
export function logLevelOptions(): [string, string][] {
    return [
        [Blockly.Translate('telegram_log_none'), ''],
        [Blockly.Translate('telegram_log_debug'), 'debug'],
        [Blockly.Translate('telegram_log_info'), 'log'],
        [Blockly.Translate('telegram_log_warn'), 'warn'],
        [Blockly.Translate('telegram_log_error'), 'error'],
    ];
}

/** Telegram's message formats. `default` means "send no parse_mode at all". */
export function parseModeOptions(): [string, string][] {
    return [
        [Blockly.Translate('telegram_parsemode_default'), 'default'],
        ['HTML', 'HTML'],
        ['MarkdownV2', 'MarkdownV2'],
    ];
}

/**
 * The log line the blocks append after the `sendTo`.
 *
 * `valueToCode` yields an empty string for an unconnected input, so appending `text` unconditionally
 * would emit `console.log('…' + );` and break the user's whole script with a syntax error.
 *
 * @param logLevel console method to call, empty when logging is switched off
 * @param prefix what the message starts with, e.g. `telegramAsk`
 * @param username generated code of the recipient, shown in brackets when there is one
 * @param text generated code of the message
 */
export function logLine(logLevel: string, prefix: string, username: string, text: string): string {
    if (!logLevel) {
        return '';
    }
    const withUser = username ? `[' + ${username} + ']` : '';
    return `console.${logLevel}('${prefix}${withUser}: '${text ? ` + ${text}` : ''});\n`;
}

/**
 * Reconnects a child that the mutator dialog had detached.
 *
 * Blockly 13 removed `MutatorIcon.reconnect` without a replacement, so it is carried here. Returns
 * whether anything was actually connected.
 *
 * @param connectionChild the child's connection, as remembered by `saveConnections`
 * @param block the block being recomposed
 * @param inputName input on `block` the child belongs to
 */
export function reconnectChild(connectionChild: Connection | null, block: Block, inputName: string): boolean {
    if (!connectionChild?.getSourceBlock().workspace) {
        return false;
    }
    const connectionParent = block.getInput(inputName)?.connection;
    if (!connectionParent) {
        return false;
    }
    const currentParent = connectionChild.targetBlock();
    if ((!currentParent || currentParent === block) && connectionParent.targetConnection !== connectionChild) {
        if (connectionParent.isConnected()) {
            connectionParent.disconnect();
        }
        connectionParent.connect(connectionChild);
        return true;
    }
    return false;
}

/**
 * Registers a generator. Blockly >= 10 looks it up in `forBlock`; registering on the plain slot is
 * not enough, because the editor migrates that slot to `forBlock` before it loads any adapter's
 * `blockly.js`, so an adapter registering the old way is never migrated.
 *
 * @param type block type
 * @param generator turns a block of that type into JavaScript
 */
export function registerGenerator(type: string, generator: (block: Block) => string): void {
    if (Blockly.JavaScript.forBlock) {
        Blockly.JavaScript.forBlock[type] = generator;
    } else {
        Blockly.JavaScript[type] = generator;
    }
}
