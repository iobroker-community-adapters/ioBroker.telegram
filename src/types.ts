// Shared type definitions for the telegram adapter backend.

import type {
    EditMessageCaptionParams,
    EditMessageReplyMarkupParams,
    EditMessageTextParams,
    InlineKeyboardMarkup,
    ParseMode,
    ReplyKeyboardMarkup,
} from 'node-telegram-bot-api';

/**
 * The adapter configuration: the io-package `native` fields plus a few properties that are attached
 * to `adapter.config` at runtime (certificates, secure, ...), which are not part of io-package.json.
 */
export interface TelegramConfig {
    pollingInterval: number;
    token: string;
    baseApiUrl: string;
    password: string;
    rememberUsers: boolean;
    doNotAcceptNewUsers: boolean;
    useUsername: boolean;
    saveFiles: boolean;
    saveFilesTo: string;
    saveFilesQuality: string;
    allowStates: boolean;
    proxy: boolean;
    proxyHost: string;
    proxyPort: number;
    proxyLogin: string;
    proxyPassword: string;
    passwordRepeat: string;
    restarted: string;
    restarting: string;
    keyboard: string;
    rooms: boolean;
    storeRawRequest: boolean;
    text2command: string;
    assistantInstance: string;
    answerTimeoutSec: number;
    url: string;
    bind: string;
    port: number;
    certPublic: string;
    certPrivate: string;
    certChained: string;
    leEnabled: boolean;
    leUpdate: boolean;
    leCheckPort: number;

    certificates?: ioBroker.Certificates;
    leConfig?: any;
    secure?: boolean;
    findNextPort?: boolean;
    doNotAcceptNewUser?: boolean;
    server: 'false' | 'true';
}

/** A user that has authenticated against the bot and is stored in `communicate.users`. */
export interface StoredUser {
    firstName: string;
    userName: string;
    sysMessages: boolean;
}

/** Map of chat/user id => stored user. */
export type Users = Record<string, StoredUser>;

/**
 * Per-state custom configuration (the `common.custom[namespace]` object) enriched at runtime with
 * a few properties copied from the object's `common` (type, states, unit, min, max, ...).
 */
export interface CommandConfig {
    enabled?: boolean;
    alias?: string;
    type?: ioBroker.CommonType;
    states?: Record<string, string> | null;
    unit?: string;
    min?: number;
    max?: number;
    recipients?: string;
    report?: boolean;
    reportChanges?: boolean;
    reportSilent?: boolean;
    readOnly?: boolean;
    writeOnly?: boolean;
    onlyTrue?: boolean;
    buttons?: number;
    onCommand?: string;
    offCommand?: string;
    onStatus?: string;
    offStatus?: string;
    lastState?: ioBroker.StateValue;
}

/** A pending `ask` question awaiting the user's reply. */
export interface Question {
    cb?: ioBroker.MessageCallbackInfo;
    from: string;
    ts: number;
    chatId?: number | string;
    user?: string;
    msgId?: number;
    timeout?: ioBroker.Timeout | null;
}

/** The extra options accepted for an `editMessageMedia` request (caption/parse_mode are applied to the media). */
export interface EditMessageMediaOptions {
    caption?: string;
    parse_mode?: ParseMode;
    reply_markup?: InlineKeyboardMarkup;
    chat_id?: number | string;
    message_id?: number;
}

/**
 * The polymorphic option bag threaded through `sendMessage` / `sendMessageHelper` / `executeSending`.
 * Only a subset of these fields is set for any given call; the internal control flow decides which
 * telegram API method to invoke based on which of them are present.
 */
export interface SendOptions {
    chatId?: number | string;
    chat_id?: number | string;
    user?: string;
    text?: string;
    type?: string;
    media?: string | string[];
    parse_mode?: ParseMode;
    disable_notification?: boolean;
    message_thread_id?: number;
    reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup;
    caption?: string;
    latitude?: number | string;
    longitude?: number | string;
    title?: string;
    address?: string;
    editMessageReplyMarkup?: {
        reply_markup: InlineKeyboardMarkup;
        options?: Omit<EditMessageReplyMarkupParams, 'reply_markup'>;
    };
    editMessageText?: { options: Omit<EditMessageTextParams, 'text'> };
    editMessageMedia?: { options?: EditMessageMediaOptions };
    editMessageCaption?: { options?: Omit<EditMessageCaptionParams, 'caption'> };
    deleteMessage?: { options: { chat_id: number | string; message_id: number } };
    answerCallbackQuery?: { text?: string; showAlert?: boolean };
}

/** Result map returned (as JSON string) by the send helpers: chatId => messageId (+ optional error map). */
export type MessageIds = Record<string, number | string | Record<string, unknown>>;

/** Result passed to the `saveFile` callback: either a success descriptor (info/location/path) or an error. */
export interface SaveFileResult {
    info?: string;
    location?: string;
    path?: string;
    error?: string;
}

/** Newest-first entry of a notification category instance. */
export interface NotificationInstanceMessage {
    ts: number;
    message: string;
}

/** A single instance entry within a notification category. */
export interface NotificationCategoryInstance {
    messages: NotificationInstanceMessage[];
}

/** The `message` payload of a `sendNotification` request coming from the notification manager. */
export interface NotificationMessage {
    host: string;
    category: {
        name: string;
        description: string;
        instances: Record<string, NotificationCategoryInstance>;
    };
}

/** Options for a CallMeBot voice call (the `call` command message). */
export interface CallOptions {
    message?: string;
    text?: string;
    user?: string;
    users?: string | string[];
    lang?: string;
    file?: string;
    repeats?: number;
}
