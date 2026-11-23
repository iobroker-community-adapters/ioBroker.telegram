// message.send and message.ask of the shared catalog of message commands, under their full names: the short names
// send and ask are older commands with other answers (a number, the raw Telegram message) and stay as they are.
// Here only what needs no Bot API: the parameters, the buttons and the answers.

import type { CallbackQuery, InlineKeyboardMarkup, Message, ParseMode } from 'node-telegram-bot-api';
import type { MessageIds } from './types';

/** A text in <HTML>…</HTML>, <Markdown>…</Markdown> or <MarkdownV2>…</MarkdownV2> (as send takes it) */
const WRAPPED = /^<(HTML|Markdown|MarkdownV2)>([\s\S]*)<\/\1>$/;

/** Parameters of the catalog; they are not passed on to the Bot API */
export const CATALOG_KEYS = [
    'text',
    'title',
    'recipient',
    'file',
    'files',
    'contentType',
    'priority',
    'answers',
    'timeoutSec',
] as const;

/** The answer of message.send and message.ask */
export type StandardAnswer = Record<string, unknown>;

/**
 * The text with the title as its first line. A text in <HTML>, <Markdown> or <MarkdownV2> keeps its wrapper.
 *
 * @param text the message
 * @param title the title of the catalog (Telegram has none)
 * @returns the text to send
 */
export function withTitle(text: string, title: unknown): string {
    const head = typeof title === 'string' || typeof title === 'number' ? String(title).trim() : '';
    if (!head) {
        return text;
    }
    if (!text) {
        return head;
    }
    const wrapped = text.match(WRAPPED);
    return wrapped ? `<${wrapped[1]}>${head}\n${wrapped[2]}</${wrapped[1]}>` : `${head}\n${text}`;
}

/**
 * The text without its <HTML>, <Markdown> or <MarkdownV2> wrapper and the parse_mode it sets - for a caption, which
 * send does not unwrap.
 *
 * @param text the text
 */
export function parseModeOf(text: string): { text: string; parse_mode?: ParseMode } {
    const wrapped = text.match(WRAPPED);
    return wrapped ? { text: wrapped[2], parse_mode: wrapped[1] as ParseMode } : { text };
}

/**
 * Whether the message goes without a notification sound: priority low or lowest, or a negative number (as
 * Pushover -2 … 2).
 *
 * @param priority the priority of the catalog
 */
export function isSilent(priority: unknown): boolean {
    if (typeof priority === 'number') {
        return priority < 0;
    }
    if (typeof priority === 'string') {
        const value = priority.trim().toLowerCase();
        return value === 'low' || value === 'lowest' || (value !== '' && Number(value) < 0);
    }
    return false;
}

/**
 * The files of `file` and `files`, empty values left out.
 *
 * @param message the message of message.send
 * @param message.file one picture or file
 * @param message.files several
 */
export function fileList(message: { file?: unknown; files?: unknown }): unknown[] {
    const list = [message.file, ...(Array.isArray(message.files) ? message.files : [message.files])];
    return list.filter(file => file !== undefined && file !== null && file !== '');
}

/**
 * The texts of the buttons as a list: an array, or a text with "," or ";" between them.
 *
 * @param answers the answers of message.ask
 */
export function answerList(answers: unknown): string[] {
    const list = Array.isArray(answers)
        ? answers
        : typeof answers === 'string'
          ? answers.split(/[,;]/)
          : answers === undefined || answers === null
            ? []
            : [answers];
    return list.map(answer => String(answer ?? '').trim()).filter(answer => !!answer);
}

/**
 * The callback_data of each button: the answer itself, so that communicate.request shows it, or the index of all
 * answers when one is longer than the 64 bytes Telegram allows or two are the same.
 *
 * @param answers the texts of the buttons
 */
export function answerData(answers: string[]): string[] {
    const fits = answers.every(answer => Buffer.byteLength(answer) <= 64) && new Set(answers).size === answers.length;
    return answers.map((answer, i) => (fits ? answer : String(i)));
}

/**
 * The inline keyboard of the question: up to three short answers in one row, else one per row.
 *
 * @param answers the texts of the buttons
 * @param data their callback_data
 */
export function answerKeyboard(answers: string[], data: string[]): InlineKeyboardMarkup {
    const buttons = answers.map((text, i) => ({ text, callback_data: data[i] }));
    const oneRow = answers.length <= 3 && answers.every(answer => answer.length <= 12);
    return { inline_keyboard: oneRow ? [buttons] : buttons.map(button => [button]) };
}

/**
 * Whether a reply can answer a question of message.ask: it must come from a chat the question went to, and a button
 * must be one of the question's message (not of an older message in the same chat).
 *
 * @param sentTo chat id => message id of the question (0 = queued, not sent yet)
 * @param msg the text message or the callback query of the button
 */
export function repliesTo(sentTo: Record<string, number>, msg: Message | CallbackQuery): boolean {
    const button = 'chat_instance' in msg ? msg : undefined;
    const chat = button ? button.message?.chat.id : (msg as Message).chat?.id;
    if (chat === undefined || sentTo[String(chat)] === undefined) {
        return false;
    }
    // 0: the question still waits in the send queue, its message id is not known - any button in that chat
    return !button || !sentTo[String(chat)] || button.message?.message_id === sentTo[String(chat)];
}

/**
 * The answer of message.ask for a reply: a pressed button or a text.
 *
 * @param question the question
 * @param question.answers the texts of the buttons
 * @param question.answerData their callback_data
 * @param msg the text message or the callback query of the button
 * @param useUsername name the person by the username (setting of the adapter), else by the first name
 * @returns the answer: answer, index? and from?
 */
export function askAnswer(
    question: { answers?: string[]; answerData?: string[] },
    msg: Message | CallbackQuery,
    useUsername: boolean,
): StandardAnswer {
    const answers = question.answers || [];
    let answer: string;
    let index: number;
    if ('chat_instance' in msg) {
        const data = msg.data ?? '';
        index = (question.answerData || []).indexOf(data);
        answer = index >= 0 ? answers[index] : data;
    } else {
        answer = msg.text ?? msg.caption ?? '';
        const typed = answer.trim().toLowerCase();
        index = answers.findIndex(text => text.toLowerCase() === typed);
    }
    const result: StandardAnswer = { answer };
    if (index >= 0) {
        result.index = index;
    }
    const from = msg.from && (useUsername && msg.from.username ? msg.from.username : msg.from.first_name);
    if (from) {
        result.from = from;
    }
    return result;
}

/**
 * The answer of message.send from the results of its sends (the text and every file is one send).
 * A chat counts as sent when it got every part. A part that waits in the send queue (Telegram was not reachable)
 * is sent later by the adapter itself, so it is no failure: the answer says pending and the queued chats.
 *
 * @param parts per send the merged message ids ({<chatId>: messageId, error?: {<chatId>: reason}, queued?:
 *     {<chatId>: reason}}), or the error text of a send that failed as a whole (then the answer is that error)
 * @returns ok: true, sent, id? (with one chat), failed? (chat id => reason) and pending: true with queued (chat id =>
 *     reason), or error and reason?
 */
export function sendAnswer(parts: (MessageIds | string)[]): StandardAnswer {
    const firstIds: Record<string, number> = {};
    const failed: Record<string, string> = {};
    const queued: Record<string, string> = {};
    let failure = '';
    for (const part of parts) {
        if (typeof part === 'string') {
            failure ||= part;
            continue;
        }
        for (const [chat, value] of Object.entries(part)) {
            if (chat === 'error' || chat === 'queued') {
                const into = chat === 'error' ? failed : queued;
                for (const [errorChat, reason] of Object.entries(value as Record<string, unknown>)) {
                    into[errorChat] ??= String(reason);
                }
            } else if (firstIds[chat] === undefined) {
                firstIds[chat] = Number(value);
            }
        }
    }
    if (failure) {
        return { error: failure };
    }
    const sent = Object.keys(firstIds).filter(chat => failed[chat] === undefined && queued[chat] === undefined);
    const pending = Object.keys(queued).length > 0;
    if (!sent.length && !pending) {
        const reason = Object.values(failed)[0];
        return reason ? { error: reason } : { error: 'No recipient got the message', reason: 'NOT_FOUND' };
    }
    const answer: StandardAnswer = { ok: true, sent: sent.length };
    if (sent.length === 1) {
        answer.id = firstIds[sent[0]];
    }
    if (Object.keys(failed).length) {
        answer.failed = failed;
    }
    if (pending) {
        answer.pending = true;
        answer.queued = queued;
    }
    return answer;
}
