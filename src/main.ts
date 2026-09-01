import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import type { Server as HttpsServer } from 'node:https';

import axios from 'axios';
import {
    Bot,
    InputFile,
    isTransientError,
    ParseError,
    type CallbackQuery,
    type Chat,
    type EditMessageMediaParams,
    type InputMediaPhoto,
    type Message,
    type ParseMode,
    type SendAnimationParams,
    type SendAudioParams,
    type SendDocumentParams,
    type SendLocationParams,
    type SendMediaGroupParams,
    type SendMessageParams,
    type SendPhotoParams,
    type SendStickerParams,
    type SendVenueParams,
    type SendVideoParams,
    type Update,
    type User,
} from 'node-telegram-bot-api';
import { fromPath } from 'node-telegram-bot-api/node';

import { Adapter, EXIT_CODES, getAbsoluteDefaultDataDir, type AdapterOptions, I18n } from '@iobroker/adapter-core';
import { WebServer } from '@iobroker/webserver';

type Server = HttpServer | HttpsServer;
type ServerExt = Server & { __server: any };

import type {
    CallOptions,
    CommandConfig,
    IobUri,
    IobUriParsed,
    MessageIds,
    NotificationInstanceMessage,
    NotificationMessage,
    Question,
    Chats,
    SaveFileResult,
    SendOptions,
    TelegramConfig,
    Users,
} from './types';
import { detectMediaTypeFromName, iobUriFromString, isIobUri, mimeToMediaType } from './iobUri';
import { createProxiedFetch, createProxyDispatcher } from './proxy';

const systemLang2CallMe: Record<string, string> = {
    en: 'en-GB-Standard-A',
    de: 'de-DE-Standard-A',
    ru: 'ru-RU-Standard-A',
    pt: 'pt-BR-Standard-A',
    nl: 'nl-NL-Standard-A',
    fr: 'fr-FR-Standard-A',
    it: 'it-IT-Standard-A',
    es: 'es-ES-Standard-A',
    pl: 'pl-PL-Standard-A',
    uk: 'uk-UA-Standard-A',
    'zh-cn': 'en-GB-Standard-A',
};

const actions = [
    'typing',
    'upload_photo',
    'upload_video',
    'record_video',
    'record_audio',
    'upload_document',
    'find_location',
];

/**
 * Keys of the `SendOptions` bag that steer the adapter itself (recipient selection, media type detection,
 * the edit/delete/answer sub-commands, ...). Everything else is forwarded to the Bot API unchanged, so callers
 * can pass any documented parameter of the underlying method (e.g. `parse_mode`, `reply_markup`,
 * `protect_content`, `message_thread_id`).
 */
const INTERNAL_OPTION_KEYS = new Set<string>([
    'chatId',
    'user',
    'text',
    'type',
    'fileName',
    'media',
    'latitude',
    'longitude',
    'title',
    'address',
    'editMessageReplyMarkup',
    'editMessageText',
    'editMessageMedia',
    'editMessageCaption',
    'deleteMessage',
    'answerCallbackQuery',
]);

/**
 * Pick the Bot API parameters out of the option bag, dropping the adapter-internal keys.
 *
 * @param options the option bag of a send request
 * @returns the parameters to forward to the Bot API method
 */
function toApiParams<T extends object>(options: SendOptions | undefined): Partial<T> {
    const params: Record<string, unknown> = {};
    if (options) {
        for (const [key, value] of Object.entries(options)) {
            if (!INTERNAL_OPTION_KEYS.has(key) && value !== undefined) {
                params[key] = value;
            }
        }
    }
    return params as Partial<T>;
}

/**
 * File names telegram gets to see when raw bytes are uploaded and the caller did not provide one. The extension
 * matters: the library does no content sniffing, so the name decides how telegram treats the upload.
 */
const DEFAULT_FILE_NAMES: Record<string, string> = {
    photo: 'photo.jpg',
    animation: 'animation.gif',
    video: 'video.mp4',
    audio: 'audio.mp3',
    document: 'document.bin',
    sticker: 'sticker.webp',
};

class Telegram extends Adapter {
    declare config: TelegramConfig;
    private bot: Bot | undefined;
    /** The fetch used by the Bot API client and for media downloads - bound to the proxy when one is configured */
    private fetchImpl: typeof fetch = globalThis.fetch;
    private storedUsers: Users = {};
    private storedChats: Chats = {};
    private systemLang: ioBroker.Languages = 'en';
    private reconnectTimer: ioBroker.Interval | undefined;
    private pollConnectionStatus: ioBroker.Timeout | undefined;
    private pollingRestartTimer: ioBroker.Timeout | undefined;
    private isConnected: boolean | null = null;
    private lastMessageTime = 0;
    private lastMessageText = '';
    private readonly enumsCache: { rooms: { [roomId: string]: ioBroker.EnumCommon } } = { rooms: {} };
    private readonly protection: Record<string, number[]> = {};
    private gcInterval: ioBroker.Interval | undefined;

    private readonly commands: Record<string, CommandConfig> = {};
    private readonly callbackQueryId: Record<string, { id: string; ts: number }> = {};
    private readonly mediaGroupExport: Record<string, { id: number; count: number }> = {};
    private tmpDirName = '';

    private questions: Question[] = [];
    private garbageCollectorInterval: ioBroker.Interval | undefined;
    private isServer = false;

    /**
     * In-memory queue of outgoing sends that failed because telegram was unreachable. They are resent (FIFO)
     * as soon as the connection is re-established. See issue #839. The queue is intentionally NOT persisted,
     * so an adapter restart clears it.
     */
    private readonly sendQueue: { action: () => Promise<any>; label: string; ts: number; attempts: number }[] = [];
    private sendQueueFlushing = false;
    private sendQueueRetryTimer: ioBroker.Timeout | undefined;
    private static readonly MAX_SEND_QUEUE_LENGTH = 100;
    private static readonly SEND_QUEUE_RETRY_MS = 30000;
    private static readonly MAX_SEND_QUEUE_AGE_MS = 24 * 60 * 60 * 1000; // 24 h
    private static readonly MAX_SEND_ATTEMPTS = 10;
    /** Delay before the long-poll loop is restarted after it ended with a fatal error */
    private static readonly POLLING_RESTART_MS = 30000;

    private readonly server: {
        server: ServerExt | null;
        settings: TelegramConfig | null;
    } = {
        server: null,
        settings: null,
    };

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({
            ...options,
            name: 'telegram',
            error: (err: Error): boolean => {
                // Identify unhandled errors originating from callbacks in scripts
                // These are not caught by wrapping the execution code in try-catch
                if (err) {
                    const errStr = err.toString();
                    if (
                        errStr.includes('getaddrinfo') ||
                        errStr.includes('api.telegram.org') ||
                        errStr.includes('EAI_AGAIN')
                    ) {
                        return true;
                    }
                }
                return false;
            },
            ready: () => this.onReady(),
            message: obj => this.onMessage(obj),
            unload: callback => this.onUnload(callback),
            stateChange: (id, state) => this.onStateChange(id, state),
            objectChange: (id, obj) => this.onObjectChange(id, obj),
        });

        this.server.settings = this.config;
    }

    onMessage(obj: ioBroker.Message): void {
        if (obj) {
            if (obj.command === 'adminuser') {
                let adminUserData: Users;
                this.getState('communicate.users', (err, state) => {
                    if (err) {
                        this.log.error(err.toString());
                    }
                    if (state?.val) {
                        try {
                            adminUserData = JSON.parse(state.val as string);
                            this.sendTo(obj.from, obj.command, adminUserData, obj.callback);
                        } catch (err) {
                            this.log.error(err);
                            this.log.error('Cannot parse stored user IDs!');
                        }
                    }
                });
            } else if (obj.command === 'delUser') {
                const userID = obj.message;
                let userObj: Users = {};
                this.getState('communicate.users', (err, state) => {
                    if (err) {
                        this.log.error(err.toString());
                    }
                    if (state?.val) {
                        try {
                            userObj = JSON.parse(state.val as string);
                            delete userObj[userID];
                            this.setState('communicate.users', JSON.stringify(userObj), true)
                                .then(() => {
                                    this.sendTo(obj.from, obj.command, userID, obj.callback);
                                    void this.updateUsers();
                                    this.log.warn(`User ${userID} has been deleted!`);
                                })
                                .catch(e => this.log.error(`Cannot set state communicate.users: ${e}`));
                        } catch (err) {
                            this.log.error(err);
                            this.log.error(`Cannot delete user ${userID}!`);
                        }
                    }
                });
            } else if (obj.command === 'systemMessages') {
                const userID = obj.message.itemId;
                const checked = obj.message.checked;
                let userObj: Users = {};
                this.getState('communicate.users', (err, state) => {
                    if (err) {
                        this.log.error(err.toString());
                    }
                    if (state?.val) {
                        try {
                            userObj = JSON.parse(state.val as string);
                            userObj[userID].sysMessages = checked;
                            this.setState('communicate.users', JSON.stringify(userObj), true)
                                .then(() => {
                                    this.sendTo(obj.from, obj.command, userID, obj.callback);
                                    void this.updateUsers();
                                    this.log.info(
                                        `Receiving of system messages for user "${userID}" has been changed to ${checked}!`,
                                    );
                                })
                                .catch(e => this.log.error(`Cannot set state communicate.users: ${e}`));
                        } catch (err) {
                            this.log.error(err);
                            this.log.error(`Cannot change user ${userID}!`);
                        }
                    }
                });
            } else if (obj.command === 'delAllUser') {
                try {
                    this.setState('communicate.users', '{}', true)
                        .then(() => {
                            this.sendTo(obj.from, obj.command, true, obj.callback);
                            void this.updateUsers();
                            this.log.warn(
                                'List of saved users has been wiped. Every User has to reauthenticate with the new password!',
                            );
                        })
                        .catch(e => this.log.error(`Cannot set state communicate.users: ${e}`));
                } catch (err) {
                    this.log.error(err);
                    this.log.error('Cannot wipe list of saved users!');
                }
            } else if (obj.command === 'sendNotification') {
                this.processNotification(obj).catch(err => this.log.error(err));
            } else {
                this.processMessage(obj).catch(err => this.log.error(err));
            }
        }
    }

    /**
     * Normalize the configured text2command/assistant instance ids to the short form (`text2command.0`).
     *
     * The config UI before v1.12.6 stored the instance in the long form (`system.adapter.text2command.0`).
     * `sendTo` accepts both forms, so such a value kept working unnoticed for years - but the jsonConfig
     * instance selector expects the short form and shows an empty field for it. Persist the short form once,
     * so the config dialog displays the selected instance again. The controller restarts the instance after
     * the config update; until then the normalized value is used in memory.
     * See https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/1365
     */
    async migrateInstanceIds(): Promise<void> {
        const migrated: Partial<Pick<TelegramConfig, 'text2command' | 'assistantInstance'>> = {};

        for (const key of ['text2command', 'assistantInstance'] as const) {
            const value = this.config[key];
            if (typeof value === 'string' && value.startsWith('system.adapter.')) {
                const shortId = value.substring('system.adapter.'.length);
                migrated[key] = shortId;
                this.config[key] = shortId;
            }
        }

        if (Object.keys(migrated).length) {
            this.log.info(`Migrating instance id(s) to the short form: ${JSON.stringify(migrated)}`);
            try {
                await this.updateConfig(migrated);
            } catch (err) {
                this.log.warn(`Cannot store migrated instance id(s): ${err instanceof Error ? err.message : err}`);
            }
        }
    }

    async onReady(): Promise<void> {
        this.isServer = this.config.server === 'true';
        await this.migrateInstanceIds();

        // An empty "API URL" field must fall back to the default: node-telegram-bot-api >= 1.x takes the
        // configured value as-is (`??` instead of the former `||`), so "" would produce relative request URLs
        // and every API call fails with "EFATAL: Failed to parse URL". A trailing slash is stripped as well,
        // because the library builds `${baseApiUrl}/bot<token>/...`.
        // See https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/1371
        this.config.baseApiUrl =
            (this.config.baseApiUrl || '').trim().replace(/\/+$/, '') || 'https://api.telegram.org';
        // i18n JSON files live in `<packageRoot>/i18n`; main.js runs from `<packageRoot>/build`
        await I18n.init(join(__dirname, '..'), this);

        this.questions = [];
        this.garbageCollectorInterval = this.setInterval(() => {
            const now = Date.now();
            Object.keys(this.callbackQueryId).forEach(id => {
                if (now - this.callbackQueryId[id].ts > 120000) {
                    delete this.callbackQueryId[id];
                }
            });
        }, 10000);

        this.tmpDirName = join(getAbsoluteDefaultDataDir(), this.namespace.replace('.', '_'));

        // Create file system directories for media files
        if (this.config.saveFilesTo == 'filesystem') {
            try {
                if (!existsSync(this.tmpDirName)) {
                    mkdirSync(this.tmpDirName);
                }

                const subDirectories = ['voice'];
                if (this.config.saveFiles) {
                    // Create subdirs for other attachment types
                    subDirectories.push('photo', 'video', 'audio', 'document');
                }

                for (const subDir of subDirectories) {
                    const subDirPath = join(this.tmpDirName, subDir);
                    if (!existsSync(subDirPath)) {
                        mkdirSync(subDirPath);
                    }
                }
            } catch (err) {
                this.log.error(`Cannot create tmp directory: ${this.tmpDirName}: ${err}`);
            }
        }

        if (this.isServer) {
            this.config.port = parseInt(String(this.config.port), 10);

            // Load certificates
            this.getCertificates(undefined, undefined, undefined, async (err, certificates, leConfig) => {
                this.config.certificates = certificates;
                this.config.leConfig = leConfig;
                this.config.secure = true;

                try {
                    const webserver = new WebServer({
                        app: (req: IncomingMessage, res: ServerResponse) => this.handleWebHook(req, res),
                        adapter: this,
                        secure: this.config.secure,
                    });

                    this.server.server = (await webserver.init()) as ServerExt;
                } catch (err) {
                    this.log.error(`Cannot create webserver: ${err}`);
                    this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                    return;
                }
                if (this.server.server) {
                    this.server.server.__server = this.server;

                    let serverListening = false;
                    let serverPort: number = this.config.port;
                    this.server.server.on('error', (e: Error) => {
                        if (e.toString().includes('EACCES') && serverPort <= 1024) {
                            this.log.error(
                                `node.js process has no rights to start server on the port ${serverPort}.\n` +
                                    `Do you know that on linux you need special permissions for ports under 1024?\n` +
                                    `You can call in shell following scrip to allow it for node.js: "iobroker fix"`,
                            );
                        } else {
                            this.log.error(
                                `Cannot start server on ${this.config.bind || '0.0.0.0'}:${serverPort}: ${e}`,
                            );
                        }
                        if (!serverListening) {
                            this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                        }
                    });

                    this.getPort(
                        this.config.port,
                        !this.config.bind || this.config.bind === '0.0.0.0' ? undefined : this.config.bind || undefined,
                        port => {
                            if (parseInt(String(port), 10) !== this.config.port && !this.config.findNextPort) {
                                this.log.error(`port ${this.config.port} already in use`);
                                this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                            }
                            serverPort = port;

                            this.server.server?.listen(
                                port,
                                !this.config.bind || this.config.bind === '0.0.0.0'
                                    ? undefined
                                    : this.config.bind || undefined,
                                () => (serverListening = true),
                            );
                            this.log.info(`https server listening on port ${port}`);

                            this.main().catch(e => this.log.error(`Cannot start adapter: ${e}`));
                        },
                    );
                }
            });
        } else {
            this.main().catch(e => this.log.error(`Cannot start adapter: ${e}`));
        }
    }

    onUnload(callback: () => void): void {
        if (this.reconnectTimer) {
            this.clearInterval(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }

        if (this.gcInterval) {
            this.clearInterval(this.gcInterval);
            this.gcInterval = undefined;
        }

        if (this.pollConnectionStatus) {
            this.clearTimeout(this.pollConnectionStatus);
            this.pollConnectionStatus = undefined;
        }

        if (this.sendQueueRetryTimer) {
            this.clearTimeout(this.sendQueueRetryTimer);
            this.sendQueueRetryTimer = undefined;
        }

        if (this.garbageCollectorInterval) {
            this.clearInterval(this.garbageCollectorInterval);
            this.garbageCollectorInterval = undefined;
        }

        if (this.pollingRestartTimer) {
            this.clearTimeout(this.pollingRestartTimer);
            this.pollingRestartTimer = undefined;
        }

        // stop the long-poll loop (no-op in webhook mode)
        this.bot?.stop();

        // cancel any pending question answer-timeouts so they cannot fire after unload
        this.questions?.forEach(q => q.timeout && this.clearTimeout(q.timeout));
        this.questions = [];

        if (this.config) {
            if (this.config.restarting !== '') {
                // default text
                if (
                    this.config.restarting === '_' ||
                    this.config.restarting === null ||
                    this.config.restarting === undefined
                ) {
                    this.sendSystemMessage(
                        this.config.rememberUsers
                            ? I18n.translate('Restarting...')
                            : I18n.translate('Restarting... Reauthenticate!'),
                    ).catch(err => this.log.error(err));
                } else {
                    this.sendSystemMessage(this.config.restarting).catch(err => this.log.error(err));
                }
            }
            try {
                if (this.server.server) {
                    this.server.server.close();
                }
            } catch (e) {
                console.error(`Cannot close server: ${e}`);
            }
        }

        if (this.isConnected && this.setState) {
            this.setState('info.connection', false, true).catch(e => this.log.error(`Cannot set state: ${e}`));
        }
        this.isConnected = false;

        callback();
    }

    // This handler is called if a subscribed state changes
    async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (state) {
            if (!state.ack) {
                if (id.endsWith('communicate.response')) {
                    if (typeof state.val === 'object') {
                        this.log.error(
                            `communicate.response only supports passing a message to send as string. You provided ${JSON.stringify(state.val)}. Please use "communicate.responseJson" instead with a stringified JSON object!`,
                        );
                        return;
                    }

                    // Send to someone this message
                    await this.sendMessage(state.val as string | number);
                    await this.setState('communicate.response', { val: state.val, ack: true });
                } else if (id.endsWith('communicate.responseSilent')) {
                    if (typeof state.val === 'object') {
                        this.log.error(
                            `communicate.responseSilent only supports passing a message to send as string. You provided ${JSON.stringify(state.val)}. Please use "communicate.responseSilentJson" instead with a stringified JSON object!`,
                        );
                        return;
                    }
                    // Send to someone this message
                    await this.sendMessage(state.val as string | number, null, null, { disable_notification: true });
                    await this.setState('communicate.responseSilent', { val: state.val, ack: true });
                } else if (id.endsWith('communicate.responseJson')) {
                    try {
                        const val: string | number | SendOptions = JSON.parse(state.val as string);
                        let options: SendOptions | undefined;
                        let text: string | number | undefined;
                        let chatId: string | number | undefined;
                        let user: string | undefined;
                        if (val && typeof val === 'object' && val.text !== undefined && typeof val.text === 'string') {
                            options = val;
                            text = options.text;
                            if (options.chatId) {
                                chatId = options.chatId;
                            }
                            if (options.user) {
                                user = options.user;
                            }
                        } else {
                            text = val as number | string;
                        }

                        if (text) {
                            // Send to someone this message
                            await this.sendMessage(text, user, chatId, options);
                        } else {
                            this.log.warn(`Invalid message: no text found: ${JSON.stringify(state.val)}`);
                        }
                        await this.setState('communicate.responseJson', { val: state.val, ack: true });
                    } catch (err) {
                        this.log.error(
                            `could not parse Json in communicate.responseJon state: ${err instanceof Error ? err.message : err}`,
                        );
                    }
                } else if (id.endsWith('communicate.responseSilentJson')) {
                    try {
                        const val: string | number | SendOptions = JSON.parse(state.val as string);
                        let options: SendOptions | undefined;
                        let text: string | number | undefined;
                        let chatId: string | number | undefined;
                        let user: string | undefined;
                        if (val && typeof val === 'object' && val.text !== undefined && typeof val.text === 'string') {
                            options = val;
                            text = options.text;
                            if (options.chatId) {
                                chatId = options.chatId;
                            }
                            if (options.user) {
                                user = options.user;
                            }
                        } else {
                            text = val as number | string;
                        }

                        if (text) {
                            // Send to someone this message
                            await this.sendMessage(text, user, chatId, { disable_notification: true, ...options });
                        } else {
                            this.log.warn(`Invalid message: no text found: ${JSON.stringify(state.val)}`);
                        }

                        await this.setState('communicate.responseSilentJson', { val: state.val, ack: true });
                    } catch (err) {
                        this.log.error(
                            `could not parse Json in communicate.responseSilentJon state: ${err instanceof Error ? err.message : err}`,
                        );
                    }
                } else if (id.endsWith('communicate.requestResponse')) {
                    try {
                        const text = state.val as string;
                        const chatIdState = await this.getStateAsync('communicate.requestChatId');
                        const threadIdState = await this.getStateAsync('communicate.requestMessageThreadId');

                        const options: SendOptions = {};

                        if (threadIdState && (threadIdState.val as number) > 0) {
                            options.message_thread_id = threadIdState.val as number;
                        }

                        // Send to someone this message
                        await this.sendMessage(text, null, chatIdState ? (chatIdState.val as string) : null, options);
                        await this.setState('communicate.requestResponse', { val: state.val, ack: true });
                    } catch (err) {
                        this.log.error(
                            `could not parse Json in communicate.requestResponse state: ${err instanceof Error ? err.message : err}`,
                        );
                    }
                }
            } else if (this.commands[id]?.report) {
                this.log.debug(`reporting state change of ${id}: ${JSON.stringify(this.commands[id])}`);

                const options: SendOptions =
                    this.commands[id].reportSilent == true ? { disable_notification: true } : {};
                let users: string | null = null;

                if (this.commands[id]?.recipients) {
                    users = this.commands[id].recipients;
                }

                if (this.commands[id].reportChanges) {
                    if (state.val !== this.commands[id].lastState) {
                        this.commands[id].lastState = state.val;
                        await this.sendMessage(this.getStatus(id, state), users, null, options);
                    }
                } else {
                    await this.sendMessage(this.getStatus(id, state), users, null, options);
                }
            }
        }
    }

    onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
        if ((obj?.common as ioBroker.StateCommon)?.custom?.[this.namespace]?.enabled) {
            const stateObj = obj as ioBroker.StateObject;
            const alias = this.getName(stateObj);
            if (!this.commands[id]) {
                this.log.info(`enabled logging of ${id}, Alias=${alias}`);
                setImmediate(() => this.subscribeForeignStates(id));
            }

            this.commands[id] = stateObj.common.custom?.[this.namespace];
            this.commands[id].type = stateObj.common.type;
            this.commands[id].states = this.parseStates(stateObj.common?.states);
            this.commands[id].unit = stateObj.common?.unit;
            this.commands[id].min = stateObj.common?.min;
            this.commands[id].max = stateObj.common?.max;
            this.commands[id].alias = alias;

            // read actual state to detect changes
            if (this.commands[id].reportChanges) {
                this.getForeignStateAsync(id)
                    .then(state => (this.commands[id].lastState = state ? state.val : undefined))
                    .catch(err => this.log.error(err));
            }
        } else if (this.commands[id]) {
            this.log.debug(`Removed command: ${id}`);
            delete this.commands[id];
            setImmediate(() => this.unsubscribeForeignStates(id));
        } else if (id.startsWith('enum.rooms') && this.config.rooms) {
            if (obj?.common?.members?.length) {
                this.enumsCache.rooms[id] = obj.common as ioBroker.EnumCommon;
            } else if (this.enumsCache.rooms[id]) {
                delete this.enumsCache.rooms[id];
            }
        }
    }

    /**
     * Send a message to all system users
     *
     * @param text text to send
     * @param options additional options, e.g. parse_mode
     */
    async sendSystemMessage(text: string, options: SendOptions = {}): Promise<void> {
        const _users = Object.keys(this.storedUsers)
            .filter(id => this.storedUsers[id].sysMessages !== false)
            .map(id => (this.config.useUsername ? this.storedUsers[id].userName : this.storedUsers[id].firstName));

        await this.sendMessage(text, _users, null, { ...options, disable_notification: true });
    }

    getStatus(id: string, state?: ioBroker.State | null): string {
        const cmd = this.commands[id];
        // If the state has no value yet, we cannot tell ON from OFF - report it as uncertain instead of
        // rendering a not-set boolean as "ON" (falsy 'State not set' string used to leak through here).
        if (state?.val == null) {
            return `${cmd.alias} => ${I18n.translate('uncertain')}`;
        }
        let val: ioBroker.StateValue | string = state.val;
        if (cmd.type === 'boolean') {
            return `${cmd.alias} => ${val ? cmd.onStatus || I18n.translate('ON-Status') : cmd.offStatus || I18n.translate('OFF-Status')}`;
        }
        if (cmd.states?.[String(val)] !== undefined) {
            val = cmd.states[String(val)];
        }
        return `${cmd.alias} => ${val}${cmd.unit ? ` ${cmd.unit}` : ''}`;
    }

    /**
     * Fire-and-forget `setState` that never rejects: a failure is logged instead of surfacing as an
     * unhandled promise rejection (which would otherwise terminate the adapter).
     *
     * @param id the (namespaced) state id
     * @param value the value or a settable-state object (e.g. `{ val, ack: true }`)
     */
    setStateSafe(id: string, value: ioBroker.SettableState): void {
        this.setState(id, value).catch(e => this.log.error(`Cannot set state "${id}": ${e}`));
    }

    connectionState(connected: boolean, logSuccess?: boolean): void {
        let errorCounter = 0;

        const checkConnection = (): void => {
            this.pollConnectionStatus = undefined;
            this.bot?.api
                .getMe()
                .then(data => {
                    this.log.debug(`getMe (reconnect): ${JSON.stringify(data)}`);
                    this.connectionState(true, errorCounter > 0);
                })
                .catch(error => {
                    if (errorCounter % 10 === 0) {
                        this.log.error(`getMe (reconnect #${errorCounter}) Error:${error}`);
                    }
                    errorCounter++;
                    if (this.pollConnectionStatus) {
                        this.clearTimeout(this.pollConnectionStatus);
                    }
                    this.pollConnectionStatus = this.setTimeout(checkConnection, 1000);
                });
        };

        if (connected && logSuccess) {
            this.log.info('getMe (reconnect): Success');
        }
        if (this.isConnected !== connected) {
            this.isConnected = connected;
            this.setStateSafe('info.connection', { val: this.isConnected, ack: true });
            if (this.isConnected) {
                if (this.pollConnectionStatus) {
                    this.clearTimeout(this.pollConnectionStatus);
                    this.pollConnectionStatus = undefined;
                }
                // Connection (re)established: resend everything that piled up while telegram was unreachable.
                void this.flushSendQueue();
            } else {
                checkConnection();
            }
        }
    }

    /**
     * Whether a failed send is worth retrying. Only transient/network problems are retried; permanent
     * telegram errors (e.g. 400 "chat not found", 403 "bot was blocked") must not be requeued, otherwise
     * they would be retried forever. See issue #839.
     *
     * @param error the error thrown by the telegram API call
     * @returns true if the send should be queued and retried later
     */
    isRetryableSendError(error: unknown): boolean {
        // NetworkError/TimeoutError: telegram is unreachable; TelegramApiError with 429 or 5xx: rate limit or
        // server-side problem; ParseError: telegram answered with a non-JSON body, typically a transient
        // gateway error. Everything else (400 "chat not found", 403 "bot was blocked", ...) is permanent.
        return isTransientError(error) || error instanceof ParseError;
    }

    /**
     * Queue a send that failed because telegram was unreachable, so it can be resent on reconnect. The
     * queue is bounded: when it is full the oldest entry is dropped. See issue #839.
     *
     * @param action the telegram API call to repeat later
     * @param label a human-readable recipient label for logging
     * @param error the error that caused the enqueue (for the log message)
     */
    enqueueFailedSend(action: () => Promise<any>, label: string, error: unknown): void {
        if (this.sendQueue.length >= Telegram.MAX_SEND_QUEUE_LENGTH) {
            this.sendQueue.shift();
            this.log.warn(
                `Outgoing message queue is full (${Telegram.MAX_SEND_QUEUE_LENGTH}); dropped the oldest queued message`,
            );
        }
        this.sendQueue.push({ action, label, ts: Date.now(), attempts: 1 });
        this.log.info(
            `Telegram not reachable - queued message for "${label}" to resend on reconnect (queue size: ${this.sendQueue.length}). Reason: ${String(error)}`,
        );
        // Safety net for transient failures that do not trigger a full disconnect/reconnect cycle: keep
        // retrying the queue periodically until it is empty (see flushSendQueue).
        this.scheduleSendQueueRetry();
    }

    /** Schedule a delayed flush of the send queue (once), unless one is already pending. */
    scheduleSendQueueRetry(): void {
        if (this.sendQueueRetryTimer || !this.sendQueue.length) {
            return;
        }
        this.sendQueueRetryTimer = this.setTimeout(() => {
            this.sendQueueRetryTimer = undefined;
            void this.flushSendQueue();
        }, Telegram.SEND_QUEUE_RETRY_MS);
    }

    /**
     * Resend all queued messages (FIFO) once the connection is back. Entries older than the max age are
     * dropped; if a resend fails again with a retryable error, the queue is kept and the flush stops (the
     * server is probably down again) to be retried on the next reconnect. See issue #839.
     */
    async flushSendQueue(): Promise<void> {
        if (this.sendQueueFlushing || !this.sendQueue.length) {
            return;
        }
        this.sendQueueFlushing = true;
        try {
            // drop messages that are too old to be worth sending
            const now = Date.now();
            for (let i = this.sendQueue.length - 1; i >= 0; i--) {
                if (now - this.sendQueue[i].ts >= Telegram.MAX_SEND_QUEUE_AGE_MS) {
                    const [dropped] = this.sendQueue.splice(i, 1);
                    this.log.warn(`Dropped queued message for "${dropped.label}" (older than 24 h)`);
                }
            }

            if (this.sendQueue.length) {
                this.log.info(`Connection restored - resending ${this.sendQueue.length} queued message(s)`);
            }

            while (this.sendQueue.length) {
                const item = this.sendQueue[0];
                try {
                    const response = await item.action();
                    this.saveSendRequest(response);
                    this.sendQueue.shift();
                    this.log.debug(`Resent queued message for "${item.label}"`);
                } catch (error) {
                    item.attempts++;
                    if (
                        this.isRetryableSendError(error) &&
                        item.attempts <= Telegram.MAX_SEND_ATTEMPTS &&
                        Date.now() - item.ts < Telegram.MAX_SEND_QUEUE_AGE_MS
                    ) {
                        // still unreachable: keep the queue and wait for the next reconnect
                        this.log.warn(
                            `Resending queued message for "${item.label}" failed again (attempt ${item.attempts}); will retry on next reconnect: ${error}`,
                        );
                        break;
                    }
                    // permanent error or too many attempts: give up on this message and continue with the rest
                    this.sendQueue.shift();
                    this.log.error(
                        `Giving up on queued message for "${item.label}" after ${item.attempts} attempt(s): ${error}`,
                    );
                }
            }
        } finally {
            this.sendQueueFlushing = false;
            // if anything is still queued (server still down), make sure we try again later
            this.scheduleSendQueueRetry();
        }
    }

    parseStates(
        states: { [value: string]: string } | string | string[] | undefined,
    ): { [value: string]: string } | undefined {
        if (!states) {
            return undefined;
        }
        if (Array.isArray(states)) {
            const obj: { [value: string]: string } = {};
            states.forEach(value => (obj[value] = value));
            return obj;
        }
        if (typeof states === 'string') {
            const parts = states.split(';');
            const obj: { [value: string]: string } = {};
            parts.forEach(value => (obj[value] = value));
            return obj;
        }

        return states;
    }

    getName(obj: ioBroker.Object): string {
        const custom = (obj.common as ioBroker.StateCommon).custom!;
        if (custom[this.namespace].alias) {
            return custom[this.namespace].alias;
        }
        let name: string | ioBroker.Translated = obj.common.name;
        if (typeof name === 'object') {
            name = name[this.systemLang] || name.en;
        }
        return name || obj._id;
    }

    handleWebHook(req: IncomingMessage, res: ServerResponse): void {
        if (req.method === 'POST' && req.url === `/${this.config.token}`) {
            let body = '';
            req.on('data', data => {
                body += data;
                if (body.length > 100_000) {
                    res.writeHead(413, 'Request Entity Too Large', {
                        'Content-Type': 'text/html',
                    });
                    res.end(
                        '<!doctype html><html><head><title>413</title></head><body>413: Request Entity Too Large</body></html>',
                    );
                }
            });
            req.on('end', () => {
                let msg: Update;
                try {
                    msg = JSON.parse(body);
                } catch (e) {
                    this.log.error(`Cannot parse webhook response!: ${e}`);
                    return;
                }
                res.end('OK');
                void this.bot!.handleUpdate(msg);
            });
        } else {
            res.writeHead(404, 'Resource Not Found', {
                'Content-Type': 'text/html',
            });
            res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>');
        }
    }

    saveSendRequest(result: Message | Message[] | boolean): void {
        this.log.debug(`Request [saveSendRequest]: ${JSON.stringify(result)}`);

        // sendMediaGroup answers with the list of sent messages - remember the first one
        const msg = Array.isArray(result) ? result[0] : result;

        if (typeof msg === 'object') {
            if (this.config.storeRawRequest) {
                this.setState('communicate.botSendRaw', JSON.stringify(msg, null, 2), true).catch(err =>
                    this.log.error(err.message),
                );
            }

            if (msg?.message_id) {
                this.setState('communicate.botSendMessageId', msg.message_id, true).catch(err =>
                    this.log.error(err.message),
                );
            }

            if (msg?.message_thread_id) {
                this.setState('communicate.botSendMessageThreadId', msg.message_thread_id, true).catch(err =>
                    this.log.error(err.message),
                );
            }

            if (msg?.chat?.id) {
                this.setState('communicate.botSendChatId', msg.chat.id.toString(), true).catch(err =>
                    this.log.error(err.message),
                );
            }
        }
    }

    /**
     * Resolve an ioBroker URI to a payload that can be handed to the telegram send functions.
     *
     * File and (base64) object/state content is returned as a Buffer, so that it can be uploaded even when
     * the file is not present on the local filesystem. `http(s)` URLs and filesystem paths are returned as a
     * string and forwarded as-is (telegram / the bot library fetch them).
     *
     * @param uri the ioBroker URI (string or already parsed)
     * @param depth internal recursion guard (a state may reference another URI)
     * @returns the resolved payload or null if it could not be resolved
     */
    async resolveIobUri(
        uri: IobUri | IobUriParsed,
        depth = 0,
    ): Promise<{ content: Buffer | string; type?: string; fileName?: string } | null> {
        if (depth > 5) {
            this.log.warn('Too many nested ioBroker URI references');
            return null;
        }
        const parsed = typeof uri === 'string' ? iobUriFromString(uri) : uri;

        if (parsed.type === 'http') {
            return { content: parsed.address, type: detectMediaTypeFromName(parsed.address) };
        }

        if (parsed.type === 'file') {
            const result = await this.readFileAsync(parsed.address, parsed.path || '');
            const file = result?.file;
            if (file === undefined || file === null) {
                return null;
            }
            const content = Buffer.isBuffer(file) ? file : Buffer.from(file, 'binary');
            const fileName = (parsed.path || '').split('/').pop() || undefined;
            let type = detectMediaTypeFromName(parsed.path || '');
            if (!type && result?.mimeType) {
                type = mimeToMediaType(result.mimeType);
            }
            return { content, type: type || 'document', fileName };
        }

        if (parsed.type === 'state') {
            const state = await this.getForeignStateAsync(parsed.address);
            return this.valueToPayload(state ? state.val : null, depth);
        }

        // parsed.type === 'object'
        const obj = await this.getForeignObjectAsync(parsed.address);
        let value: any = obj;
        if (parsed.path) {
            for (const key of parsed.path.split('/')) {
                if (value && typeof value === 'object') {
                    value = value[key];
                } else {
                    value = undefined;
                    break;
                }
            }
        }
        return this.valueToPayload(value, depth);
    }

    /**
     * Convert an ioBroker state/object value into a send payload. Data URLs are decoded to a Buffer, nested
     * ioBroker/http URIs are resolved recursively, everything else is returned as a string.
     *
     * @param value the raw value
     * @param depth current recursion depth (see {@link resolveIobUri})
     * @returns the resolved payload or null
     */
    async valueToPayload(
        value: unknown,
        depth: number,
    ): Promise<{ content: Buffer | string; type?: string; fileName?: string } | null> {
        if (value === undefined || value === null) {
            return null;
        }
        if (typeof value === 'string') {
            const dataUrl = value.match(/^data:([^;]+);base64,(.*)$/s);
            if (dataUrl) {
                const mime = dataUrl[1];
                return {
                    content: Buffer.from(dataUrl[2], 'base64'),
                    type: mimeToMediaType(mime),
                    fileName: `data.${mime.split('/')[1] || 'bin'}`,
                };
            }
            if (isIobUri(value) || /^https?:\/\//i.test(value)) {
                return this.resolveIobUri(value, depth + 1);
            }
            return { content: value, type: detectMediaTypeFromName(value) };
        }
        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
            return { content: String(value) };
        }
        if (typeof value === 'object') {
            return { content: JSON.stringify(value) };
        }
        return null;
    }

    /**
     * Convert a send payload into what the Bot API client expects for a file parameter: raw bytes and local
     * files become an upload (`InputFile`, streamed as multipart part), everything else - an `http(s)` URL or a
     * telegram `file_id` - is passed through as string.
     *
     * @param content the payload: a Buffer, a local file path, a URL or a file_id
     * @param fileName the file name telegram should see for an upload
     * @param defaultName file name used for raw bytes when the caller did not provide one
     * @returns the value for the file parameter of the send method
     */
    async toInputFile(
        content: unknown,
        fileName: string | undefined,
        defaultName: string,
    ): Promise<InputFile | string> {
        // a Buffer that travelled through the ioBroker message bus arrives JSON-serialized
        if (
            content &&
            typeof content === 'object' &&
            (content as { type?: string }).type === 'Buffer' &&
            Array.isArray((content as { data?: unknown }).data)
        ) {
            content = Buffer.from((content as { data: number[] }).data);
        }
        if (Buffer.isBuffer(content)) {
            return new InputFile(content, { filename: fileName || defaultName });
        }
        if (typeof content === 'string' && existsSync(content)) {
            return fromPath(content, fileName ? { filename: fileName } : undefined);
        }
        return String(content);
    }

    async sendMessageHelper(dest: number | string, name: string, text: any, options: SendOptions): Promise<string> {
        const bot = this.bot!;

        // Resolve ioBroker URIs (iobfile://, iobobject://, iobstate://) to their content before dispatching.
        // This allows sending files that live in the ioBroker file storage (e.g. behind Redis/jsonl) and are
        // therefore not accessible through the local filesystem. See issue #907.
        if (typeof text === 'string' && isIobUri(text)) {
            try {
                const resolved = await this.resolveIobUri(text);
                if (!resolved) {
                    this.log.error(`Cannot resolve ioBroker URI: ${text}`);
                    return JSON.stringify({
                        error: { [String(options.chatId ?? dest)]: 'Cannot resolve ioBroker URI' },
                    });
                }
                text = resolved.content;
                if (resolved.type && !options.type) {
                    options.type = resolved.type;
                }
                if (resolved.fileName && !options.fileName) {
                    options.fileName = resolved.fileName;
                }
            } catch (err) {
                this.log.error(`Cannot resolve ioBroker URI "${text}": ${err instanceof Error ? err.message : err}`);
                return JSON.stringify({ error: { [String(options.chatId ?? dest)]: String(err) } });
            }
        }

        return new Promise(resolve => {
            const messageIds: MessageIds = {};
            if (options?.chatId !== undefined && options.user === undefined) {
                options.user = this.config.useUsername
                    ? this.storedUsers[options.chatId].userName
                    : this.storedUsers[options.chatId].firstName;
            }
            // to push chatId value for the group chats - useful to process the errors, and list of processed messages.
            if (options.chatId === undefined && options.user === undefined && name === 'chat' && dest) {
                options.chatId = dest;
            }
            if (options?.editMessageReplyMarkup !== undefined) {
                this.log.debug(`Send editMessageReplyMarkup to "${name}"`);
                if (bot) {
                    this.executeSending(
                        () =>
                            bot.api.editMessageReplyMarkup({
                                ...options.editMessageReplyMarkup!.options,
                                reply_markup: options.editMessageReplyMarkup!.reply_markup,
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (options?.editMessageText !== undefined) {
                this.log.debug(`Send editMessageText to "${name}"`);
                if (bot) {
                    this.executeSending(
                        () => bot.api.editMessageText({ ...options.editMessageText!.options, text }),
                        options,
                        resolve,
                    );
                }
            } else if (options?.editMessageMedia !== undefined) {
                this.log.debug(`Send editMessageMedia to "${name}"`);
                if (text) {
                    let mediaInput:
                        | {
                              type:
                                  | 'media'
                                  | 'thumbnail'
                                  | 'cover'
                                  | 'photo'
                                  | 'animation'
                                  | 'video'
                                  | 'audio'
                                  | 'document';
                              media: string;
                              fileOptions?: unknown;
                          }
                        | undefined;
                    if (
                        (typeof text === 'string' &&
                            text.match(/\.(jpg|png|jpeg|bmp|gif)$/i) &&
                            (existsSync(text) || text.match(/^(https|http)/i))) ||
                        options?.type === 'photo'
                    ) {
                        mediaInput = {
                            type: 'photo',
                            media: text,
                        };
                    } else if (
                        (typeof text === 'string' && text.match(/\.(gif)/i) && existsSync(text)) ||
                        options?.type === 'animation'
                    ) {
                        mediaInput = {
                            type: 'animation',
                            media: text,
                        };
                    } else if (
                        (typeof text === 'string' && text.match(/\.(mp4)$/i) && existsSync(text)) ||
                        options?.type === 'video'
                    ) {
                        mediaInput = {
                            type: 'video',
                            media: text,
                        };
                    } else if (
                        (typeof text === 'string' && text.match(/\.(wav|mp3|ogg)$/i) && existsSync(text)) ||
                        options?.type === 'audio'
                    ) {
                        mediaInput = {
                            type: 'audio',
                            media: text,
                        };
                    } else if (
                        (typeof text === 'string' &&
                            text.match(/\.(txt|doc|docx|csv|pdf|xls|xlsx)$/i) &&
                            existsSync(text)) ||
                        options?.type === 'document'
                    ) {
                        mediaInput = {
                            type: 'document',
                            media: text,
                        };
                    }

                    if (mediaInput) {
                        const { type: mediaType, media } = mediaInput;
                        const editOptions = options.editMessageMedia.options;

                        const form: Omit<EditMessageMediaParams, 'media'> = {};
                        if (editOptions?.chat_id !== undefined) {
                            form.chat_id = editOptions.chat_id;
                        }
                        if (editOptions?.message_id !== undefined) {
                            form.message_id = editOptions.message_id;
                        }
                        if (editOptions?.reply_markup) {
                            form.reply_markup = editOptions.reply_markup;
                        }

                        if (bot) {
                            this.executeSending(
                                async () => {
                                    // a local file is uploaded as multipart part (the library adds the
                                    // `attach://` reference), a URL or file_id is passed through as string
                                    const inputMedia: {
                                        type: string;
                                        media: InputFile | string;
                                        caption?: string;
                                        parse_mode?: ParseMode;
                                    } = {
                                        type: mediaType,
                                        media: await this.toInputFile(
                                            media,
                                            options.fileName,
                                            DEFAULT_FILE_NAMES[mediaType] || 'media.bin',
                                        ),
                                    };
                                    if (editOptions?.caption) {
                                        inputMedia.caption = editOptions.caption;
                                    }
                                    if (editOptions?.parse_mode) {
                                        inputMedia.parse_mode = editOptions.parse_mode;
                                    }
                                    return bot.api.editMessageMedia({ ...form, media: inputMedia });
                                },
                                options,
                                resolve,
                            );
                        }
                    } else {
                        this.log.error(
                            `Cannot send editMessageMedia [chatId - ${options.chatId}]: unsupported media type`,
                        );
                        resolve(JSON.stringify(messageIds));
                    }
                } else {
                    this.log.error(
                        `Cannot send editMessageMedia [chatId - ${options.chatId}]: no media found. "text" may not be empty`,
                    );
                    resolve(JSON.stringify(messageIds));
                }
            } else if (options?.editMessageCaption !== undefined) {
                this.log.debug(`Send editMessageCaption to "${name}"`);
                if (bot) {
                    this.executeSending(
                        () => bot.api.editMessageCaption({ ...options.editMessageCaption!.options, caption: text }),
                        options,
                        resolve,
                    );
                }
            } else if (options?.deleteMessage !== undefined) {
                this.log.debug(`Send deleteMessage to "${name}"`);
                if (bot) {
                    this.executeSending(
                        () =>
                            bot.api.deleteMessage({
                                chat_id: options.deleteMessage!.options.chat_id,
                                message_id: options.deleteMessage!.options.message_id,
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (
                options &&
                options.latitude !== undefined &&
                options.longitude !== undefined &&
                options.title !== undefined &&
                options.address !== undefined
            ) {
                this.log.debug(`Send venue to "${name}": ${options.latitude},${options.longitude}`);
                if (bot) {
                    this.executeSending(
                        () =>
                            bot.api.sendVenue({
                                ...toApiParams<SendVenueParams>(options),
                                chat_id: dest,
                                latitude: parseFloat(String(options.latitude)),
                                longitude: parseFloat(String(options.longitude)),
                                title: options.title!,
                                address: options.address!,
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (options?.latitude !== undefined && options.longitude !== undefined) {
                this.log.debug(`Send location to "${name}": ${options.latitude},${options.longitude}`);
                if (bot) {
                    this.executeSending(
                        () =>
                            bot.api.sendLocation({
                                ...toApiParams<SendLocationParams>(options),
                                chat_id: dest,
                                latitude: parseFloat(String(options.latitude)),
                                longitude: parseFloat(String(options.longitude)),
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (options?.type === 'mediagroup') {
                this.log.debug(`Send media group to "${name}": `);
                if (bot) {
                    const { media: fileNames } = options;
                    if (fileNames instanceof Array) {
                        bot.api
                            .sendChatAction({ chat_id: dest, action: 'upload_photo' })
                            .then(() => {
                                if (fileNames.every((name: string) => existsSync(name))) {
                                    this.log.info(`Send media group to "${name}": ${fileNames.length} file(s)`);
                                    this.executeSending(
                                        async () => {
                                            // the files are streamed from disk as multipart parts
                                            const media: InputMediaPhoto[] = [];
                                            for (const element of fileNames) {
                                                media.push({ type: 'photo', media: await fromPath(element) });
                                            }
                                            return bot.api.sendMediaGroup({
                                                ...toApiParams<SendMediaGroupParams>(options),
                                                chat_id: dest,
                                                media,
                                            });
                                        },
                                        options,
                                        resolve,
                                    );
                                } else {
                                    this.log.debug('files must exists');
                                    resolve(JSON.stringify(messageIds));
                                }
                            })
                            .catch(error => {
                                this.log.error(`upload Error: ${error}`);
                            });
                    } else {
                        this.log.debug('option media should be an array');
                        resolve(JSON.stringify(messageIds));
                    }
                } else {
                    this.log.debug('no files added!');
                    resolve(JSON.stringify(messageIds));
                }
            } else if (text && typeof text === 'string' && actions.includes(text)) {
                this.log.debug(`Send action to "${name}": ${text}`);
                if (bot) {
                    this.executeSending(
                        () => bot.api.sendChatAction({ chat_id: dest, action: text }),
                        options,
                        resolve,
                    );
                }
            } else if (
                text &&
                ((typeof text === 'string' && text.match(/\.webp$/i) && existsSync(text)) ||
                    options?.type === 'sticker')
            ) {
                if (typeof text === 'string') {
                    this.log.debug(`Send sticker to "${name}": ${text}`);
                } else {
                    this.log.debug(`Send sticker to "${name}": ${text.length} bytes`);
                }
                if (bot) {
                    this.executeSending(
                        async () =>
                            bot.api.sendSticker({
                                ...toApiParams<SendStickerParams>(options),
                                chat_id: dest,
                                sticker: await this.toInputFile(text, options.fileName, DEFAULT_FILE_NAMES.sticker),
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (
                text &&
                ((typeof text === 'string' && text.match(/\.(gif)/i) && existsSync(text)) ||
                    options?.type === 'animation')
            ) {
                if (typeof text === 'string') {
                    this.log.debug(`Send animation to "${name}": ${text}`);
                } else {
                    this.log.debug(`Send animation to "${name}": ${text.length} bytes`);
                }
                if (bot) {
                    this.executeSending(
                        async () =>
                            bot.api.sendAnimation({
                                ...toApiParams<SendAnimationParams>(options),
                                chat_id: dest,
                                animation: await this.toInputFile(text, options.fileName, DEFAULT_FILE_NAMES.animation),
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (
                text &&
                ((typeof text === 'string' && text.match(/\.(mp4)$/i) && existsSync(text)) || options?.type === 'video')
            ) {
                if (typeof text === 'string') {
                    this.log.debug(`Send video to "${name}": ${text}`);
                } else {
                    this.log.debug(`Send video to "${name}": ${text.length} bytes`);
                }
                if (bot) {
                    this.executeSending(
                        async () =>
                            bot.api.sendVideo({
                                ...toApiParams<SendVideoParams>(options),
                                chat_id: dest,
                                video: await this.toInputFile(text, options.fileName, DEFAULT_FILE_NAMES.video),
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (
                text &&
                ((typeof text === 'string' && text.match(/\.(txt|doc|docx|csv|pdf|xls|xlsx)$/i) && existsSync(text)) ||
                    options?.type === 'document')
            ) {
                this.log.debug(`Send document to "${name}": ${typeof text === 'string' ? text : text.length}`);
                if (bot) {
                    this.executeSending(
                        async () =>
                            bot.api.sendDocument({
                                ...toApiParams<SendDocumentParams>(options),
                                chat_id: dest,
                                document: await this.toInputFile(text, options.fileName, DEFAULT_FILE_NAMES.document),
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (
                text &&
                ((typeof text === 'string' && text.match(/\.(wav|mp3|ogg)$/i) && existsSync(text)) ||
                    (options && options?.type === 'audio'))
            ) {
                this.log.debug(`Send audio to "${name}": ${typeof text === 'string' ? text : text.length}`);

                if (bot) {
                    this.executeSending(
                        async () =>
                            bot.api.sendAudio({
                                ...toApiParams<SendAudioParams>(options),
                                chat_id: dest,
                                audio: await this.toInputFile(text, options.fileName, DEFAULT_FILE_NAMES.audio),
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (
                text &&
                ((typeof text === 'string' && // if the message is a string, and it is a path to file or URL
                    text.match(/\.(jpg|png|jpeg|bmp|gif)$/i) &&
                    (existsSync(text) || text.match(/^(https|http)/i))) ||
                    options?.type === 'photo') // if the type of message is photo
            ) {
                this.log.debug(`Send photo to "${name}": ${typeof text === 'string' ? text : text.length}`);

                if (bot) {
                    this.executeSending(
                        async () =>
                            bot.api.sendPhoto({
                                ...toApiParams<SendPhotoParams>(options),
                                chat_id: dest,
                                photo: await this.toInputFile(text, options.fileName, DEFAULT_FILE_NAMES.photo),
                            }),
                        options,
                        resolve,
                    );
                }
            } else if (options?.answerCallbackQuery !== undefined) {
                this.log.debug(`Send answerCallbackQuery to "${name}"`);
                if (options.answerCallbackQuery.showAlert === undefined) {
                    options.answerCallbackQuery.showAlert = false;
                }
                if (bot && this.callbackQueryId[String(options.chatId)]) {
                    const originalChatId = this.callbackQueryId[String(options.chatId)].id;
                    delete this.callbackQueryId[String(options.chatId)];
                    this.executeSending(
                        () =>
                            bot.api.answerCallbackQuery({
                                callback_query_id: originalChatId,
                                text: options.answerCallbackQuery!.text,
                                show_alert: options.answerCallbackQuery!.showAlert,
                            }),
                        options,
                        resolve,
                    );
                }
            } else {
                this.log.debug(`Send message to [${name}]: "${text}"`);
                if (text && typeof text === 'string') {
                    options ||= {};
                    if (text.startsWith('<MarkdownV2>') && text.endsWith('</MarkdownV2>')) {
                        options.parse_mode = 'MarkdownV2';
                        text = text.substring(12, text.length - 13);
                    } else if (text.startsWith('<HTML>') && text.endsWith('</HTML>')) {
                        options.parse_mode = 'HTML';
                        text = text.substring(6, text.length - 7);
                    } else if (text.startsWith('<Markdown>') && text.endsWith('</Markdown>')) {
                        options.parse_mode = 'Markdown';
                        text = text.substring(10, text.length - 11);
                    }
                }
                if (bot) {
                    this.executeSending(
                        () =>
                            bot.api.sendMessage({
                                ...toApiParams<SendMessageParams>(options),
                                chat_id: dest,
                                text: text || '',
                            }),
                        options,
                        resolve,
                    );
                }
            }
        });
    }

    /**
     * executes the given method and handles, what to do next
     *
     * @param action the telegram API call to execute
     * @param options the send options bag
     * @param resolve resolves the surrounding promise with the collected message ids
     */
    executeSending(action: () => Promise<any>, options: SendOptions, resolve: (value: string) => void): void {
        // create an empty object, to store chat id and message id of successfully sent messages
        const messageIds: MessageIds = {};
        action()
            .then(response => {
                // put chat id and message id to the object, that will be returned
                // delete message command return only true in response,
                // to return deleted message id and chat id the next if construction is used:
                if (response?.message_id) {
                    // The chatId is mostly used in code, instead of chat_id.
                    messageIds[String(options.chat_id ?? options.chatId)] = response.message_id;
                } else if (
                    typeof response === 'boolean' &&
                    options?.deleteMessage?.options?.chat_id &&
                    options?.deleteMessage?.options?.message_id
                ) {
                    messageIds[options.deleteMessage.options.chat_id] = options.deleteMessage.options.message_id;
                }
                // puts ids to the ioBroker database
                this.saveSendRequest(response);
            })
            .then(() => {
                this.log.debug('Message sent');
                // return all the collected message ids to the callback
                resolve(JSON.stringify(messageIds));
            })
            .catch(error => {
                // add the error to the message ids object
                messageIds.error = { [String(options.chat_id ?? options.chatId)]: error };
                // log error to the system
                this.log.error(
                    `Failed sending [${options.chatId ? 'chatId' : 'user'} - ${options.chatId ? options.chatId : options.user}]: ${error}`,
                );
                // If telegram was unreachable, queue the send so it can be retried on reconnect (issue #839).
                // The original promise is still resolved right away so callers never block on the retry.
                if (this.isRetryableSendError(error)) {
                    const label = String(options.chat_id ?? options.chatId ?? options.user ?? 'all');
                    this.enqueueFailedSend(action, label, error);
                }
                // send the successfully sent messages as callback
                resolve(JSON.stringify(messageIds));
            });
    }

    // https://core.telegram.org/bots/api
    sendMessage(
        text: string | number,
        user?: string | string[] | null,
        chatId?: number | string | null,
        options?: SendOptions,
    ): Promise<string[]> {
        if (!text && typeof options !== 'object' && text !== 0 && (!options || !(options as SendOptions).latitude)) {
            this.log.warn('Invalid text: null');
            return Promise.resolve([]);
        }

        if (options && typeof options === 'object') {
            if (options.chatId !== undefined) {
                delete options.chatId;
            }
            if (options.text !== undefined) {
                delete options.text;
            }
            if (options.user !== undefined) {
                delete options.user;
            }
        }

        options ||= {};

        if (text && typeof text === 'string') {
            if (text && text.startsWith('<MarkdownV2>') && text.endsWith('</MarkdownV2>')) {
                options.parse_mode = 'MarkdownV2';
                text = text.substring(12, text.length - 13);
            } else if (text && text.startsWith('<HTML>') && text.endsWith('</HTML>')) {
                options.parse_mode = 'HTML';
                text = text.substring(6, text.length - 7);
            } else if (text && text.startsWith('<Markdown>') && text.endsWith('</Markdown>')) {
                options.parse_mode = 'Markdown';
                text = text.substring(10, text.length - 11);
            }
        }

        // deleteMessage / editMessage* already carry their target chat in their own options. If the caller
        // did not address a specific recipient, dispatch the operation exactly once to that chat instead of
        // broadcasting it to every stored user (which made all but the first recipient fail, see
        // https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/885).
        if (!chatId && !user) {
            const targetedChatId =
                options.deleteMessage?.options?.chat_id ??
                options.editMessageText?.options?.chat_id ??
                options.editMessageCaption?.options?.chat_id ??
                options.editMessageMedia?.options?.chat_id ??
                options.editMessageReplyMarkup?.options?.chat_id;
            if (targetedChatId !== undefined && targetedChatId !== null) {
                chatId = targetedChatId;
            }
        }

        const tPromiseList: Promise<string>[] = [];
        // convert
        if (text !== undefined && text !== null && typeof text !== 'object') {
            text = text.toString();
        }
        if (chatId) {
            tPromiseList.push(this.sendMessageHelper(chatId, 'chat', text, options));
            return Promise.all(tPromiseList).catch(e => e);
        } else if (user) {
            if (typeof user !== 'string' && !(user instanceof Array)) {
                this.log.warn(`Invalid type of user parameter: ${typeof user}. Expected is string or array.`);
            }

            const userArray = Array.isArray(user)
                ? user
                : (user || '')
                      .toString()
                      .split(/[,;\s]/)
                      .map(u => u.trim())
                      .filter(u => !!u);
            let matches = 0;
            userArray.forEach(userName => {
                for (const id in this.storedUsers) {
                    if (!Object.prototype.hasOwnProperty.call(this.storedUsers, id)) {
                        continue;
                    }

                    if (
                        // allow addressing a recipient by its numeric user/chat id (storedUsers is keyed by id)
                        id === userName ||
                        // Match by username when one is stored, otherwise fall back to the first name. A
                        // recipient without a public telegram username is stored with an empty userName, so
                        // usernames and first names can be mixed in one recipient list. See issue #854.
                        (this.config.useUsername && this.storedUsers[id].userName
                            ? this.storedUsers[id].userName === userName
                            : this.storedUsers[id].firstName === userName)
                    ) {
                        if (options) {
                            options.chatId = id;
                        }
                        matches++;
                        tPromiseList.push(this.sendMessageHelper(id, userName, text, options));
                        break;
                    }
                }
            });

            if (userArray.length !== matches) {
                this.log.warn(`${userArray.length - matches} of ${userArray.length} recipients are unknown!`);
            }

            return Promise.all(tPromiseList).catch(e => e);
        }

        const m = typeof text === 'string' ? text.match(/^@(.+?)\b/) : null;

        if (m) {
            text = (text || '').toString();
            text = text.replace(`@${m[1]}`, '').trim().replace(/\s\s/g, ' ');
            const re = new RegExp(m[1], 'i');
            let id = '';
            for (const id_t in this.storedUsers) {
                if (!Object.prototype.hasOwnProperty.call(this.storedUsers, id_t)) {
                    continue;
                }
                if (
                    // Match by username when one is stored, otherwise fall back to the first name (see #854).
                    this.config.useUsername && this.storedUsers[id_t].userName
                        ? this.storedUsers[id_t].userName.match(re)
                        : this.storedUsers[id_t].firstName.match(re)
                ) {
                    id = id_t;
                    break;
                }
            }
            if (id) {
                if (options) {
                    options.chatId = id;
                }
                tPromiseList.push(this.sendMessageHelper(id, m[1], text, options));
            }
        } else {
            // Send to all users
            Object.keys(this.storedUsers).forEach(id => {
                if (options) {
                    options.chatId = id;
                }
                tPromiseList.push(
                    this.sendMessageHelper(
                        id,
                        this.config.useUsername && this.storedUsers[id].userName
                            ? this.storedUsers[id].userName
                            : this.storedUsers[id].firstName,
                        text,
                        options,
                    ),
                );
            });
        }

        return Promise.all(tPromiseList).catch(e => e);
    }

    saveFile(fileID: string, fileName: string, callback: (result: SaveFileResult) => void): void {
        this.log.debug(`Saving media file ${fileID} to ${fileName} (location = ${this.config.saveFilesTo})`);

        this.bot!.api.getFile({ file_id: fileID })
            .then(async file => {
                if (!file.file_path) {
                    throw new Error('telegram did not return a file path');
                }
                // the library offers no download helper, so build the file URL ourselves
                const url = `${this.config.baseApiUrl}/file/bot${this.config.token}/${file.file_path}`;
                this.log.debug(`Download media file: ${url.replace(this.config.token, '<token>')}`);
                const response = await this.fetchImpl(url);
                if (!response.ok) {
                    throw new Error(`statusCode ${response.status}`);
                }
                const content = Buffer.from(await response.arrayBuffer());

                if (this.config.saveFilesTo == 'filesystem') {
                    const fileLocation = join(this.tmpDirName, fileName);
                    writeFileSync(fileLocation, content);

                    callback({
                        info: `media file has been saved to "${this.config.saveFilesTo}": ${fileLocation}`,
                        location: this.config.saveFilesTo,
                        path: fileLocation,
                    });
                } else if (this.config.saveFilesTo == 'iobroker') {
                    const fileLocation = join(this.tmpDirName, fileName); // TODO: check new urn format https://github.com/ioBroker/ioBroker.js-controller/issues/2710
                    await this.writeFileAsync(this.namespace, fileName, content);

                    callback({
                        info: `media file has been saved to "${this.config.saveFilesTo}": ${fileLocation}`,
                        location: this.config.saveFilesTo,
                        path: fileLocation,
                    });
                }
            })
            .catch(err => callback({ error: `Error: ${err}` }));
    }

    getMessage(msg: Message): void {
        const date = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
        this.log.debug(`Received message: ${JSON.stringify(msg)}`);

        // Remember the chat/group so other adapters can pick it by id (issue #312).
        this.storeChat(msg.chat);

        // Media messages (photo, document, voice, ...) do not contain `msg.text`, so they are not handled
        // by `processTelegramText` (which only runs for text messages). As a result the request metadata
        // (chat id, message id, user id) would stay empty for received files. Populate it here so the
        // sender can be identified. See https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/1043
        if (
            msg.voice ||
            msg.photo ||
            msg.video ||
            msg.video_note ||
            msg.audio ||
            msg.document ||
            msg.location ||
            msg.venue
        ) {
            this.setStateSafe('communicate.requestChatId', { val: msg.chat.id, ack: true });
            this.setStateSafe('communicate.requestMessageId', { val: msg.message_id, ack: true });
            this.setStateSafe('communicate.requestMessageThreadId', {
                val: msg.is_topic_message ? msg.message_thread_id : 0,
                ack: true,
            });
            if (msg.from) {
                this.setStateSafe('communicate.requestUserId', { val: msg.from.id.toString(), ack: true });
            }
        }

        // A shared location (paperclip -> location) or a venue (location + title/address) carries a
        // latitude/longitude. Expose it as a "latitude;longitude" GPS string so it can be shown e.g. on a
        // vis/jarvis map. See https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/853
        const location = msg.venue?.location || msg.location;
        if (location) {
            this.setStateSafe('communicate.requestLocation', {
                val: `${location.latitude};${location.longitude}`,
                ack: true,
            });
            // `live_period` and `heading` are only present while a live location is active. When the sharing
            // is stopped (or expires) Telegram sends a final `edited_message` without them, so
            // `requestLocationLive` drops back to false and the heading is cleared at that point.
            this.setStateSafe('communicate.requestLocationLive', { val: !!location.live_period, ack: true });
            this.setStateSafe('communicate.requestLocationHeading', { val: location.heading ?? null, ack: true });
            this.setStateSafe('communicate.requestLocationAccuracy', {
                val: location.horizontal_accuracy ?? null,
                ack: true,
            });
        }

        if (msg.voice) {
            try {
                this.saveFile(
                    msg.voice.file_id,
                    this.config.saveFiles ? `/voice/${date}.ogg` : '/voice/temp.ogg',
                    res => {
                        if (!res.error) {
                            this.log.info(res.info!);
                            this.setStateSafe('communicate.pathFile', { val: res.path!, ack: true });
                        } else {
                            this.log.debug(res.error);
                        }
                    },
                );
            } catch (err) {
                this.log.error(`Error saving voice file: ${err}`);
            }
        } else if (this.config.saveFiles && msg.photo) {
            try {
                const qualityMap: Record<number, string> = {
                    0: 'low',
                    1: 'med',
                    2: 'high',
                    3: 'highdef',
                };

                let saveOnlyQuality: string | null = this.config.saveFilesQuality;
                if (saveOnlyQuality) {
                    const saveOnlyQualityNum = parseInt(saveOnlyQuality, 10);
                    if (msg.photo.length <= saveOnlyQualityNum) {
                        saveOnlyQuality = null;
                    } else {
                        saveOnlyQuality = saveOnlyQualityNum.toString();
                    }
                }

                msg.photo.forEach((item, i) => {
                    // skip if quality is set and not equal
                    if (saveOnlyQuality && i.toString() !== saveOnlyQuality) {
                        return;
                    }
                    const quality = qualityMap[i] || 'none';

                    let fileName = '';
                    if (msg.media_group_id) {
                        if (!Object.prototype.hasOwnProperty.call(this.mediaGroupExport, msg.media_group_id)) {
                            const id = Object.keys(this.mediaGroupExport).length;
                            this.mediaGroupExport[msg.media_group_id] = {
                                id,
                                count: 0,
                            };
                        } else {
                            this.mediaGroupExport[msg.media_group_id].count++;
                        }
                        fileName = `/photo/${date}_grpID_${this.mediaGroupExport[msg.media_group_id].id}_${this.mediaGroupExport[msg.media_group_id].count}_${quality}.jpg`;
                    } else {
                        fileName = `/photo/${date}_${quality}.jpg`;
                        if (existsSync(join(this.tmpDirName, fileName))) {
                            let tIdx = 0;
                            do {
                                fileName = `/photo/${date}_${tIdx}_${quality}.jpg`;
                                tIdx++;
                            } while (existsSync(join(this.tmpDirName, fileName)));
                        }
                    }

                    this.saveFile(item.file_id, fileName, res => {
                        if (!res.error) {
                            this.log.info(res.info!);
                            this.setStateSafe('communicate.pathFile', { val: res.path!, ack: true });
                        } else {
                            this.log.debug(res.error);
                        }
                    });
                });
            } catch (err) {
                this.log.error(`Error saving photo file: ${err}`);
            }
        } else if (this.config.saveFiles && msg.video) {
            try {
                this.saveFile(msg.video.file_id, `/video/${date}.mp4`, res => {
                    if (!res.error) {
                        this.log.info(res.info!);
                        this.setStateSafe('communicate.pathFile', { val: res.path!, ack: true });
                    } else {
                        this.log.debug(res.error);
                    }
                });
            } catch (err) {
                this.log.error(`Error saving video file: ${err}`);
            }
        } else if (this.config.saveFiles && msg.video_note) {
            try {
                this.saveFile(msg.video_note.file_id, `/video/${date}.mp4`, res => {
                    if (!res.error) {
                        this.log.info(res.info!);
                        this.setStateSafe('communicate.pathFile', { val: res.path!, ack: true });
                    } else {
                        this.log.debug(res.error);
                    }
                });
            } catch (err) {
                this.log.error(`Error saving video file: ${err}`);
            }
        } else if (this.config.saveFiles && msg.audio) {
            try {
                this.saveFile(msg.audio.file_id, `/audio/${date}.mp3`, res => {
                    if (!res.error) {
                        this.log.info(res.info!);
                        this.setStateSafe('communicate.pathFile', { val: res.path!, ack: true });
                    } else {
                        this.log.debug(res.error);
                    }
                });
            } catch (err) {
                this.log.error(`Error saving audio file: ${err}`);
            }
        } else if (this.config.saveFiles && msg.document) {
            try {
                this.saveFile(msg.document.file_id, `/document/${msg.document.file_name}`, res => {
                    if (!res.error) {
                        this.log.info(res.info!);
                        this.setStateSafe('communicate.pathFile', { val: res.path!, ack: true });
                    } else {
                        this.log.debug(res.error);
                    }
                });
            } catch (err) {
                this.log.error(`Error saving document file: ${err}`);
            }
        }
    }

    async processMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj?.command) {
            return;
        }
        // Ignore own answers
        if (obj.message?.response) {
            return;
        }

        // filter out the double messages
        const json = JSON.stringify(obj);
        if (this.lastMessageTime && this.lastMessageText === json && Date.now() - this.lastMessageTime < 1200) {
            return this.log.debug(
                `Filter out double message [first was for ${Date.now() - this.lastMessageTime}ms]: ${json}`,
            );
        }

        this.lastMessageTime = Date.now();
        this.lastMessageText = json;

        this.log.debug(`Received command "${obj.command}": ${JSON.stringify(obj.message)}`);

        switch (obj.command) {
            case 'send':
                if (obj.message) {
                    let tPromise: Promise<string[]>;
                    if (typeof obj.message === 'object') {
                        tPromise = this.sendMessage(
                            obj.message.text,
                            obj.message?.user,
                            obj.message?.chatId,
                            obj.message,
                        );
                    } else {
                        tPromise = this.sendMessage(obj.message as string | number);
                    }

                    tPromise
                        .then(
                            results => obj.callback && this.sendTo(obj.from, obj.command, results.length, obj.callback),
                        )
                        .catch(e => this.log.error(`Cannot send command: ${e}`));
                }
                break;

            case 'ask':
                if (obj.message) {
                    const question: Question = {
                        cb: obj.callback,
                        from: obj.from,
                        ts: Date.now(),
                    };

                    if (typeof obj.message === 'object') {
                        const messages = await this.sendMessage(
                            obj.message.text,
                            obj.message.user,
                            obj.message.chatId,
                            obj.message,
                        );
                        const msgIds: { [chatId: string]: number } =
                            messages.length > 0 ? messages.map(m => JSON.parse(m))[0] : {};

                        question.chatId = obj.message.chatId;
                        question.user = obj.message.user;
                        question.msgId = msgIds?.[String(question.chatId)];
                    } else {
                        await this.sendMessage(obj.message as string | number);
                    }

                    if (obj.callback) {
                        this.questions.push(question);
                        this.log.debug(
                            `added question: ${JSON.stringify(question)} - answer timeout: ${this.config.answerTimeoutSec}`,
                        );

                        question.timeout = this.setTimeout(
                            (q: Question) => {
                                q.timeout = null;
                                this.sendTo(q.from, 'ask', '__timeout__', q.cb);

                                this.log.info(`question timeout for: ${JSON.stringify(q)}`);

                                // Remove keyboard
                                if (this.bot && q?.chatId && q?.msgId) {
                                    // Catch the rejection: if the message was already deleted/edited or is too
                                    // old, telegram answers "message to edit not found". Without a catch this
                                    // rejection is unhandled and terminates the whole adapter. See
                                    // https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/879
                                    this.bot.api
                                        .editMessageReplyMarkup({
                                            chat_id: q.chatId,
                                            message_id: q.msgId,
                                            reply_markup: { inline_keyboard: [] },
                                        })
                                        .then(() =>
                                            this.log.debug(
                                                `removed inline_keyboard for msg ${q.msgId}: ${JSON.stringify(q)}`,
                                            ),
                                        )
                                        .catch(error =>
                                            this.log.warn(`Cannot remove inline_keyboard for msg ${q.msgId}: ${error}`),
                                        );
                                }

                                const pos = this.questions.indexOf(q);
                                pos !== -1 && this.questions.splice(pos, 1);
                            },
                            this.config.answerTimeoutSec + 1000,
                            question,
                        );
                    }
                }
                break;

            case 'call':
                if (obj.message) {
                    let call: CallOptions = {};
                    if (typeof obj.message === 'object') {
                        call = obj.message;
                    } else {
                        call.message = obj.message;
                    }

                    if (call.users && call.user) {
                        this.log.error(`Please provide only user or users as array. Attribute user will be ignored!`);
                    }
                    if (!call.users && call.user) {
                        call.users = [call.user];
                    }
                    if (!call.users && !call.user) {
                        call.users = Object.keys(this.storedUsers)
                            .filter(id => this.storedUsers[id] && this.storedUsers[id].userName)
                            .map(id =>
                                this.storedUsers[id].userName.startsWith('@')
                                    ? this.storedUsers[id].userName
                                    : `@${this.storedUsers[id].userName}`,
                            );
                    }
                    if (!(call.users instanceof Array)) {
                        call.users = [call.users as string];
                    }
                    // set language
                    call.lang ||= systemLang2CallMe[this.systemLang] || systemLang2CallMe.en;
                    if (!call.file) {
                        // Set message
                        call.message = call.message || call.text || I18n.translate('Call text');
                    } else {
                        call.message = '';
                    }

                    if (!call.users || !call.users.length) {
                        this.log.error(
                            `Cannot make a call, because no users stored in ${this.namespace}.communicate.users`,
                        );
                    } else {
                        this.callUsers(call.users, call.message, call.lang, call.file, call.repeats);
                    }
                }
                break;
        }
    }

    callUsers(users: string[], text?: string, lang?: string, file?: string, repeats?: number, cb?: () => void): void {
        if (!users || !users.length) {
            cb && cb();
        } else {
            let user = users.shift() as string;
            if (!user.startsWith('@') && !user.startsWith('+') && !user.startsWith('00')) {
                user = `@${user}`;
            }

            let url = 'http://api.callmebot.com/start.php?source=iobroker&';
            const params = [`user=${encodeURIComponent(user)}`];
            if (file) {
                params.push(`file=${encodeURIComponent(file)}`);
            } else {
                params.push(`text=${encodeURIComponent(text as string)}`);
            }
            if (repeats !== undefined) {
                params.push(`rpt=${parseInt(String(repeats), 10) || 0}`);
            }

            params.push(`lang=${lang || systemLang2CallMe[this.systemLang]}`);
            url += params.join('&');
            this.log.debug(`CALL: ${url}`);

            axios
                .get(url)
                .then(response => {
                    const body = response && response.data;
                    if (!body || !response || response.status !== 200) {
                        this.log.error(
                            `Cannot make a call to ${user}: ${body || (response && response.status) || 'Unknown error'}`,
                        );
                    } else {
                        this.log.debug(
                            `Call to ${user} was made: ${body.substring(body.indexOf('<p>')).replace(/<p>/g, ' ')}`,
                        );
                    }
                    setImmediate(() => this.callUsers(users, text, lang, file, repeats, cb));
                })
                .catch(err => {
                    this.log.error(`Cannot make a call to ${user}: ${err || 'Unknown error'}`);
                    setImmediate(() => this.callUsers(users, text, lang, file, repeats, cb));
                });
        }
    }

    storeUser(id: number | string, firstName: string, userName: string): void {
        if (
            !this.storedUsers[id] ||
            this.storedUsers[id].firstName !== firstName ||
            this.storedUsers[id].userName !== userName
        ) {
            Object.keys(this.storedUsers).forEach(uid => {
                if (userName && this.storedUsers[uid].userName === userName) {
                    delete this.storedUsers[uid];
                }
                if (!userName && !this.storedUsers[uid].userName && this.storedUsers[uid].firstName === firstName) {
                    delete this.storedUsers[uid];
                }
            });

            this.storedUsers[id] = { firstName, userName, sysMessages: false };

            if (this.config.rememberUsers) {
                this.setStateSafe('communicate.users', { val: JSON.stringify(this.storedUsers), ack: true });
            }
        }
    }

    /**
     * Remember a chat the bot has seen (private chat, group, supergroup or channel) in `communicate.chats`,
     * so other adapters can offer a chat/group picker (e.g. to address a group by id). See issue #312.
     *
     * @param chat the `msg.chat` object of a received message
     */
    storeChat(chat?: Chat): void {
        if (chat?.id == null) {
            return;
        }
        const id = String(chat.id);
        const title = chat.title || [chat.first_name, chat.last_name].filter(n => !!n).join(' ') || chat.username || id;
        const type = chat.type || 'private';

        if (!this.storedChats[id] || this.storedChats[id].title !== title || this.storedChats[id].type !== type) {
            this.storedChats[id] = { title, type };
            this.setStateSafe('communicate.chats', { val: JSON.stringify(this.storedChats), ack: true });
        }
    }

    getListOfCommands(): string {
        const ids = Object.keys(this.commands).sort(
            (a, b) => (this.commands[b].alias as unknown as number) - (this.commands[a].alias as unknown as number),
        );
        const lines: string[] = [];

        ids.forEach(id => {
            if (!this.commands[id].readOnly) {
                if (this.commands[id].type === 'boolean') {
                    if (this.commands[id].writeOnly) {
                        lines.push(
                            `${this.commands[id].alias} ${this.commands[id].onCommand || I18n.translate('ON-Command')}|${this.commands[id].offCommand || I18n.translate('OFF-Command')}`,
                        );
                    } else {
                        lines.push(
                            `${this.commands[id].alias} ${this.commands[id].onCommand || I18n.translate('ON-Command')}|${this.commands[id].offCommand || I18n.translate('OFF-Command')}|?`,
                        );
                    }
                } else {
                    if (this.commands[id].writeOnly) {
                        lines.push(
                            `${this.commands[id].alias} ${I18n.translate(`value as ${this.commands[id].type}`)}`,
                        );
                    } else {
                        lines.push(
                            `${this.commands[id].alias} ${I18n.translate(`value as ${this.commands[id].type}`)}|?`,
                        );
                    }
                }
            }
        });

        if (!lines.length) {
            lines.push(I18n.translate('No commands found.'));
        }

        return lines.join('\n');
    }

    getCommandsKeyboard(chatId: number | string): void {
        const ids = Object.keys(this.commands).sort(
            (a, b) => (this.commands[b].alias as unknown as number) - (this.commands[a].alias as unknown as number),
        );
        const keyboard: string[][] = [];

        ids.forEach(id => {
            const cmd = this.commands[id];
            if (!cmd.readOnly) {
                if (cmd.type === 'boolean') {
                    if (cmd.onlyTrue) {
                        if (cmd.buttons === 1) {
                            keyboard.push([`${cmd.alias} ${cmd.onCommand || I18n.translate('ON-Command')}`]);
                            !cmd.writeOnly && keyboard.push([`${cmd.alias} ?`]);
                        } else {
                            cmd.writeOnly
                                ? keyboard.push([`${cmd.alias} ${cmd.onCommand || I18n.translate('ON-Command')}`])
                                : keyboard.push([
                                      `${cmd.alias} ${cmd.onCommand || I18n.translate('ON-Command')}`,
                                      `${cmd.alias} ?`,
                                  ]);
                        }
                    } else {
                        if (cmd.buttons === 1) {
                            keyboard.push([`${cmd.alias} ${cmd.onCommand || I18n.translate('ON-Command')}`]);
                            keyboard.push([`${cmd.alias} ${cmd.offCommand || I18n.translate('OFF-Command')}`]);
                            !cmd.writeOnly && keyboard.push([`${cmd.alias} ?`]);
                        } else if (cmd.buttons === 2) {
                            keyboard.push([
                                `${cmd.alias} ${cmd.onCommand || I18n.translate('ON-Command')}`,
                                `${cmd.alias} ${cmd.offCommand || I18n.translate('OFF-Command')}`,
                            ]);
                            !cmd.writeOnly && keyboard.push([`${cmd.alias} ?`]);
                        } else {
                            cmd.writeOnly
                                ? keyboard.push([
                                      `${cmd.alias} ${cmd.onCommand || I18n.translate('ON-Command')}`,
                                      `${cmd.alias} ${cmd.offCommand || I18n.translate('OFF-Command')}`,
                                  ])
                                : keyboard.push([
                                      `${cmd.alias} ${cmd.onCommand || I18n.translate('ON-Command')}`,
                                      `${cmd.alias} ${cmd.offCommand || I18n.translate('OFF-Command')}`,
                                      `${cmd.alias} ?`,
                                  ]);
                        }
                    }
                } else if (cmd.states) {
                    let s: string[] = [];
                    const stat = Object.keys(cmd.states);
                    for (let i = 0; i < stat.length; i++) {
                        s.push(`${cmd.alias} ${cmd.states[stat[i]]}`);
                        if (s.length >= (cmd.buttons || 3)) {
                            keyboard.push(s);
                            s = [];
                        }
                    }
                    !cmd.writeOnly && s.push(`${cmd.alias} ?`);
                    keyboard.push(s);
                } else if (cmd.type === 'number' && cmd.unit === '%') {
                    let s: string[] = [];
                    const step = ((cmd.max || 100) - (cmd.min || 0)) / 4;
                    for (let i = cmd.min || 0; i <= (cmd.max || 100); i += step) {
                        s.push(`${cmd.alias} ${i}%`);
                        if (s.length >= (cmd.buttons || 3)) {
                            keyboard.push(s);
                            s = [];
                        }
                    }
                    !cmd.writeOnly && s.push(`${cmd.alias} ?`);
                    keyboard.push(s);
                } else {
                    this.log.warn(
                        `Unsupported state type for keyboard: ${cmd.type}. Only numbers and booleans are supported`,
                    );
                }
            } else {
                keyboard.push([`${cmd.alias} ?`]);
            }
        });

        this.bot!.api.sendMessage({
            chat_id: chatId,
            text: I18n.translate('Select option'),
            reply_markup: {
                keyboard: keyboard.map(row => row.map(text => ({ text }))),
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        })
            .then(() => {
                this.log.debug('Message sent');
            })
            .catch(error => {
                this.log.error(`Send message error: ${error}`);
            });
    }

    isAnswerForQuestion(msg: Message | CallbackQuery): void {
        if (this.questions?.length) {
            const now = Date.now();
            const chatId = 'chat' in msg ? msg.chat?.id : undefined;
            const fromId = msg.from?.id;

            let question =
                chatId &&
                this.questions.find(
                    q => q.chatId === chatId && q.user === fromId && now - q.ts < this.config.answerTimeoutSec,
                );
            question ||=
                chatId && this.questions.find(q => q.chatId === chatId && now - q.ts < this.config.answerTimeoutSec);
            question ||= this.questions.find(q => now - q.ts < this.config.answerTimeoutSec);

            // user have 60 seconds for answer
            if (question && Date.now() - question.ts < this.config.answerTimeoutSec) {
                if (question.timeout) {
                    this.clearTimeout(question.timeout);
                    question.timeout = null;
                    this.sendTo(question.from, 'ask', msg, question.cb);

                    // Remove the inline keyboard. For a broadcast question `question.chatId`/`msgId` are
                    // empty (the question was not tied to a single chat), so prefer the chat/message the
                    // button was actually pressed on - it is carried by the incoming CallbackQuery. Fall back
                    // to the stored question for text-message answers.
                    const callbackMessage = 'data' in msg ? msg.message : undefined;
                    const answeredChatId = callbackMessage?.chat.id ?? question.chatId;
                    const answeredMsgId = callbackMessage?.message_id ?? question.msgId;

                    if (this.bot && answeredChatId && answeredMsgId) {
                        // Catch the rejection: if the message was already deleted/edited or is too old,
                        // telegram answers "message to edit not found". Without a catch this rejection is
                        // unhandled and terminates the whole adapter. See
                        // https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/879
                        this.bot.api
                            .editMessageReplyMarkup({
                                chat_id: answeredChatId,
                                message_id: answeredMsgId,
                                reply_markup: { inline_keyboard: [] },
                            })
                            .then(() => this.log.debug(`removed inline_keyboard for msg ${answeredMsgId}`))
                            .catch(error =>
                                this.log.warn(`Cannot remove inline_keyboard for msg ${answeredMsgId}: ${error}`),
                            );
                    }
                }
                this.questions.splice(this.questions.indexOf(question), 1);
            }

            // remove old questions
            this.questions = this.questions.filter(q => now - q.ts < this.config.answerTimeoutSec);
        }
    }

    garbageCollector(): void {
        const now = Date.now() - 5 * 60000; // last 5 minutes

        Object.keys(this.protection).forEach(user => {
            let a;
            for (a = 0; a < this.protection[user].length; a++) {
                // find first entry newer than 5 minutes
                if (this.protection[user][a] > now) {
                    break;
                }
            }
            // remove all old entries
            if (a < this.protection[user].length && a) {
                this.protection[user].splice(0, a);
            }
            if (!this.protection[user].length) {
                delete this.protection[user];
            }
        });

        if (!Object.keys(this.protection).length) {
            this.gcInterval && this.clearInterval(this.gcInterval);
            this.gcInterval = undefined;
        }
    }

    /**
     * Forward a message to another instance, but only if that instance is currently alive. If the
     * target is not running, `sendTo` would queue the message unanswered and the callback would never
     * fire, so we skip it (and log) instead.
     *
     * @param instance target instance id, e.g. `assistant.0` or `system.adapter.assistant.0`
     * @param command the `sendTo` command
     * @param message the payload to forward
     */
    async sendToIfAlive(
        instance: string,
        command: string,
        message: Record<string, unknown>,
    ): Promise<ioBroker.Message | undefined> {
        // depending on the admin version the configured instance is stored as `text2command.0` or as
        // `system.adapter.text2command.0`, so normalize it to the short form
        const instanceId = instance.startsWith('system.adapter.')
            ? instance.substring('system.adapter.'.length)
            : instance;

        try {
            const aliveState = await this.getForeignStateAsync(`system.adapter.${instanceId}.alive`);
            if (!aliveState?.val) {
                this.log.warn(`Cannot forward message to "${instanceId}": instance is not running`);
                return;
            }
        } catch (err) {
            this.log.warn(`Cannot check if "${instanceId}" is alive: ${err instanceof Error ? err.message : err}`);
            return;
        }
        return await this.sendToAsync(instanceId, command, message);
    }

    async processTelegramText(msg: Message): Promise<Message | void> {
        this.connectionState(true);
        const bot = this.bot!;
        const from: User = msg.from!;
        let msgText: string = msg.text ?? '';

        // see https://core.telegram.org/bots/api#message
        this.log.debug(JSON.stringify(msg));

        const user = !this.config.useUsername ? from.first_name : !from.username ? from.first_name : from.username;

        const now = Date.now();
        let pollingInterval = 0;
        if (this.config && this.config.pollingInterval !== undefined) {
            pollingInterval = parseInt(String(this.config.pollingInterval), 10) || 0;
        }

        // ignore all messages older than 30 seconds + polling interval
        if (now - msg.date * 1000 > pollingInterval + 30000) {
            this.log.warn(
                `Message from ${from.first_name} ignored, because too old: (${pollingInterval + 30000}) ${msgText}`,
            );
            return bot.api
                .sendMessage({ chat_id: from.id, text: I18n.translate('Message ignored: ') + msgText })
                .catch(error => this.log.error(`send Message Error: ${error}`));
        }

        msgText = (msgText || '').trim();

        // sometimes telegram sends messages like "message@user_name"
        const pos = msgText.lastIndexOf('@');
        if (pos !== -1) {
            msgText = msgText.substring(0, pos);
        }

        if (msgText === '/password' && !this.config.doNotAcceptNewUser) {
            return bot.api
                .sendMessage({
                    chat_id: from.id,
                    text: I18n.translate('Please enter password in form "/password phrase"'),
                })
                .catch(error => this.log.error(`send Message Error:${error}`));
        }

        if (this.config.password && !this.config.doNotAcceptNewUsers) {
            // if user sent password
            let m = msgText.match(/^\/password (.+)$/);
            m ||= msgText.match(/^\/p (.+)$/);

            if (m) {
                this.garbageCollector();

                if (this.protection[user] && this.protection[user].length >= 5) {
                    return bot.api
                        .sendMessage({
                            chat_id: from.id,
                            text: `${I18n.translate('Too many attempts. Blocked for')} ${Math.round((now - this.protection[user][this.protection[user].length - 1]) / 1000)} ${I18n.translate('seconds')}`,
                        })
                        .catch(error => this.log.error(`send Message Error: ${error}`));
                }

                if (this.config.password === m[1]) {
                    if (this.protection[user]) {
                        delete this.protection[user];
                    }
                    this.storeUser(from.id, from.first_name, from.username ?? '');

                    if (!from.username) {
                        this.log.warn(`User ${from.first_name} hast not set an username in the Telegram App!!`);
                    }

                    // delete the message that contains the password, so the passphrase is not left in the chat
                    await bot.api
                        .deleteMessage({ chat_id: msg.chat.id, message_id: msg.message_id })
                        .catch(error => this.log.warn(`Cannot delete password message: ${error}`));

                    return bot.api
                        .sendMessage({ chat_id: from.id, text: I18n.translate('Welcome ') + user })
                        .catch(error => this.log.error(`send Message Error: ${error}`));
                }
                this.protection[user] ||= [];
                this.protection[user].push(Date.now());

                this.gcInterval ||= this.setInterval(() => this.garbageCollector(), 60000);

                this.log.warn(`Got invalid password from ${user}: ${m[1]}`);

                bot.api
                    .sendMessage({ chat_id: from.id, text: I18n.translate('Invalid password') })
                    .catch(error => this.log.error(`send Message Error: ${error}`));

                if (this.storedUsers[from.id]) {
                    delete this.storedUsers[from.id];
                }
            }
        }

        // todo support commands: instances, running, restart

        // If a user is not in the trusted list
        if ((this.config.password || this.config.doNotAcceptNewUsers) && !this.storedUsers[from.id]) {
            return bot.api
                .sendMessage({
                    chat_id: from.id,
                    text: I18n.translate(
                        this.config.doNotAcceptNewUsers
                            ? 'User is not in the list'
                            : 'Please enter password in form "/password phrase"',
                    ),
                })
                .catch(error => this.log.error(`send Message Error: ${error}`));
        }

        if (msgText === '/help') {
            return bot.api
                .sendMessage({ chat_id: from.id, text: this.getListOfCommands() })
                .catch(error => this.log.error(`send Message Error: ${error}`));
        }

        this.isAnswerForQuestion(msg);

        if (msgText === this.config.keyboard || msgText === '/commands') {
            this.log.debug('Response keyboard');
            if (this.config.rooms) {
                this.getCommandsKeyboard(msg.chat.id);
                //getRoomsKeyboard(msg.chat.id)
            } else {
                this.getCommandsKeyboard(msg.chat.id);
            }
            return;
        }

        if (this.config.rooms) {
            // detect if some room is selected
        }

        // Search all user's states and try to detect something like "device-alias on"
        let found = false;
        for (const id in this.commands) {
            if (Object.prototype.hasOwnProperty.call(this.commands, id)) {
                if (msgText.startsWith(`${this.commands[id].alias} `)) {
                    let sValue = msgText.substring((this.commands[id].alias as string).length + 1);
                    found = true;
                    if (sValue === '?') {
                        const state = await this.getForeignStateAsync(id);
                        bot.api
                            .sendMessage({ chat_id: msg.chat.id, text: this.getStatus(id, state) })
                            .catch(error => this.log.error(`send Message Error: ${error}`));
                    } else {
                        let value;
                        if (this.commands[id].states) {
                            const sState = Object.keys(this.commands[id].states).find(
                                val => this.commands[id].states![val] === sValue,
                            );
                            if (sState !== null && sState !== undefined) {
                                sValue = sState;
                            }
                        }

                        if (this.commands[id].type === 'boolean') {
                            value = this.commands[id].onCommand
                                ? sValue === this.commands[id].onCommand
                                : sValue === I18n.translate('ON-Command') ||
                                  sValue === 'true' ||
                                  sValue.toLowerCase() === 'on' ||
                                  sValue === '1';
                        } else if (this.commands[id].type === 'number') {
                            sValue = sValue.replace('%', '').trim();
                            value = parseFloat(sValue);
                            if (sValue !== value.toString()) {
                                bot.api
                                    .sendMessage({
                                        chat_id: msg.chat.id,
                                        text: I18n.translate('Invalid number %s', sValue),
                                    })
                                    .catch(error => this.log.error(`send Message Error: ${error}`));
                                continue;
                            }
                        } else {
                            value = sValue;
                        }

                        this.setForeignStateAsync(id, value, false, () =>
                            bot.api
                                .sendMessage({ chat_id: msg.chat.id, text: I18n.translate('Done') })
                                .catch(error => this.log.error(`send Message Error: ${error}`)),
                        )?.catch(error => this.log.error(`setForeignState Error: ${error}`));
                    }
                }
            }
        }
        if (found) {
            return;
        }

        this.storeUser(from.id, from.first_name, from.username ?? '');

        if (!from.username) {
            this.log.warn(`User ${from.first_name} hast not set an username in the Telegram App!!`);
        }

        if (this.config.allowStates) {
            // Check set state
            let m = msgText.match(/^\/state (.+) (.+)$/);
            if (m) {
                let id1: string | null = m[1];
                let val1: string | null = m[2];
                let currentMsg: Message | null = msg;

                // clear by timeout id
                let memoryLeak1: ioBroker.Timeout | undefined = this.setTimeout(() => {
                    currentMsg = null;
                    memoryLeak1 = undefined;
                    id1 = null;
                    val1 = null;
                }, 1000);

                let state: ioBroker.State | null | undefined = null;
                try {
                    state = await this.getForeignStateAsync(id1);
                } catch (err) {
                    bot.api
                        .sendMessage({ chat_id: from.id, text: err.message })
                        .catch(error => this.log.error(`send Message Error: ${error}`));
                }
                if (memoryLeak1) {
                    this.clearTimeout(memoryLeak1);
                    memoryLeak1 = undefined;
                    m = null;
                }
                if (currentMsg) {
                    if (state) {
                        try {
                            await this.setForeignStateAsync(id1, val1, false);
                            if (currentMsg) {
                                bot.api
                                    .sendMessage({ chat_id: from.id, text: I18n.translate('Done') })
                                    .catch(error => this.log.error(`send Message Error: ${error}`));
                            }
                        } catch (err) {
                            if (currentMsg) {
                                bot.api
                                    .sendMessage({ chat_id: from.id, text: err.message })
                                    .catch(error => this.log.error(`send Message Error: ${error}`));
                            }
                        }
                    } else {
                        try {
                            await bot.api.sendMessage({
                                chat_id: from.id,
                                text: I18n.translate('ID "%s" not found.', id1),
                            });
                        } catch (err) {
                            this.log.error(`send Message Error: ${err}`);
                        }
                    }
                }
                return;
            }

            // Check get state
            m = msgText.match(/^\/state (.+)$/);
            if (m) {
                let id2: string | null = m[1];
                let currentMsg: Message | null = msg;

                // clear by timeout id
                let memoryLeak2: ioBroker.Timeout | undefined = this.setTimeout(() => {
                    id2 = null;
                    currentMsg = null;
                    memoryLeak2 = undefined;
                }, 1000);

                let state: ioBroker.State | null | undefined = null;
                try {
                    state = await this.getForeignStateAsync(id2);
                } catch (err) {
                    if (currentMsg) {
                        bot.api
                            .sendMessage({ chat_id: from.id, text: err.message })
                            .catch(error => this.log.error(`send Message Error: ${error}`));
                    }
                }
                if (memoryLeak2) {
                    this.clearTimeout(memoryLeak2);
                    memoryLeak2 = undefined;
                    m = null;
                }
                if (currentMsg) {
                    if (state) {
                        try {
                            await bot.api.sendMessage({ chat_id: from.id, text: String(state.val) });
                        } catch (error) {
                            this.log.error(`send Message Error: ${error}`);
                        }
                    } else {
                        try {
                            await bot.api.sendMessage({
                                chat_id: from.id,
                                text: I18n.translate('ID "%s" not found.', id2),
                            });
                        } catch (error) {
                            this.log.error(`send Message Error: ${error}`);
                        }
                    }
                }
                return;
            }
        }

        this.log.debug(`Got message from ${user}: ${msgText}`);

        // Send to text2command
        if (this.config.text2command) {
            this.sendToIfAlive(this.config.text2command, 'send', {
                text: msgText.replace(/\//g, '#').replace(/_/g, ' '),
                id: msg.chat.id,
                user,
            })
                // @ts-expect-error types fixed in js-controller
                .then((response: { response?: string; id: string } | null) => {
                    if (response?.response) {
                        let text = response.response;
                        let options: { parse_mode: ParseMode } | undefined;
                        if (text && typeof text === 'string') {
                            if (text.startsWith('<MarkdownV2>') && text.endsWith('</MarkdownV2>')) {
                                options = { parse_mode: 'MarkdownV2' };
                                text = text.substring(12, text.length - 13);
                            } else if (text.startsWith('<HTML>') && text.endsWith('</HTML>')) {
                                options = { parse_mode: 'HTML' };
                                text = text.substring(6, text.length - 7);
                            } else if (text.startsWith('<Markdown>') && text.endsWith('</Markdown>')) {
                                options = { parse_mode: 'Markdown' };
                                text = text.substring(10, text.length - 11);
                            }
                        }

                        this.log.debug(`Send response: ${text}`);
                        bot.api
                            .sendMessage({ ...options, chat_id: response.id, text })
                            .catch(error => this.log.error(`send Message Error: ${error}`));
                    }
                })
                .catch(err => this.log.error(`Cannot send message to ${this.config.text2command}: ${err}`));
        }

        // Forward messages that no internal rule/command matched to the ioBroker.assistant instance and
        // reply with its answer. The reply is routed via this closure (msg.chat.id), so the answer always
        // goes back to the right chat/thread.
        if (this.config.assistantInstance) {
            this.sendToIfAlive(this.config.assistantInstance, 'ask', {
                text: msgText,
                source: `telegram:${user}`,
                user,
                chatId: msg.chat.id,
                userId: from.id.toString(),
                messageThreadId: msg.is_topic_message ? msg.message_thread_id : 0,
            })
                // @ts-expect-error types fixed in js-controller
                .then((response: { answer?: string; error?: string }) => {
                    const text = response && (response.answer || response.error);
                    if (text) {
                        this.log.debug(`Assistant response: ${text}`);
                        const options = msg.is_topic_message ? { message_thread_id: msg.message_thread_id } : undefined;
                        bot.api
                            .sendMessage({ ...options, chat_id: msg.chat.id, text })
                            .catch(error => this.log.error(`send Message Error: ${error}`));
                    }
                })
                .catch(err => this.log.error(`Cannot send message to ${this.config.assistantInstance}: ${err}`));
        }

        this.setStateSafe('communicate.requestChatId', { val: msg.chat.id, ack: true });
        this.setStateSafe('communicate.requestMessageId', { val: msg.message_id, ack: true });
        this.setStateSafe('communicate.requestMessageThreadId', {
            val: msg.is_topic_message ? msg.message_thread_id : 0,
            ack: true,
        });
        this.setStateSafe('communicate.requestUserId', {
            val: from.id.toString(),
            ack: true,
        });
        this.setStateSafe('communicate.request', { val: `[${user}]${msgText}`, ack: true });
    }

    connect(): void {
        if (this.bot) {
            const bot = this.bot;
            if (!this.isServer) {
                if (bot.isRunning()) {
                    this.log.debug('bot polling OK');
                } else {
                    this.log.debug('bot restarting...');
                    this.startPolling();
                }
            }
            // Check connection
            bot.api
                .getMe()
                .then(data => {
                    this.log.debug(`getMe (reconnect): ${JSON.stringify(data)}`);
                    this.connectionState(true);
                })
                .catch(error => this.log.error(`getMe (reconnect) Error:${error}`));
        } else {
            // Route every telegram request (API calls and file downloads) through the configured proxy
            try {
                const proxy = createProxyDispatcher(this.config);
                if (proxy) {
                    this.fetchImpl = createProxiedFetch(proxy.dispatcher);
                    this.log.info(`Connecting to telegram via ${proxy.description}`);
                }
            } catch (err) {
                this.log.error(
                    `Proxy is enabled but cannot be used: ${err instanceof Error ? err.message : String(err)} - connecting directly`,
                );
            }

            const bot = new Bot(this.config.token, { apiRoot: this.config.baseApiUrl, fetch: this.fetchImpl });
            this.bot = bot;

            // Route errors thrown by the update handlers to the ioBroker log (the library's default boundary
            // prints them to the console). The update is consumed either way, so polling keeps running.
            bot.catch((err, ctx) =>
                this.log.error(
                    `Cannot process update ${ctx.update.update_id}: ${err instanceof Error ? err.stack || err.message : String(err)}`,
                ),
            );
            this.registerUpdateHandlers(bot);

            if (this.isServer) {
                // Setup server way: telegram pushes the updates to our own https server (see handleWebHook)
                if (this.config.url[this.config.url.length - 1] === '/') {
                    this.config.url = this.config.url.substring(0, this.config.url.length - 1);
                }
                bot.api
                    .setWebhook({ url: `${this.config.url}/${this.config.token}` })
                    .catch(error => this.log.error(`setWebhook Error: ${error}`));
            } else {
                // Setup polling way. A webhook left over from a previous "server" configuration must be removed
                // first: getUpdates is rejected with 409 while a webhook is active, which would end the loop.
                bot.api
                    .deleteWebhook()
                    .catch(error => this.log.error(`deleteWebhook Error: ${error}`))
                    .finally(() => this.startPolling());
            }

            // Check connection
            bot.api
                .getMe()
                .then(data => {
                    this.log.debug(`getMe: ${JSON.stringify(data)}`);
                    this.connectionState(true);

                    if (this.config.restarted !== '') {
                        // default text
                        if (
                            this.config.restarted === '_' ||
                            this.config.restarted === null ||
                            this.config.restarted === undefined
                        ) {
                            this.sendSystemMessage(I18n.translate('Started!')).catch(err => this.log.error(err));
                        } else {
                            this.sendSystemMessage(this.config.restarted).catch(err => this.log.error(err));
                        }
                    }
                })
                .catch(error => {
                    this.log.error(`getMe Error:${error}`);
                    this.connectionState(false);
                });
        }
    }

    /**
     * Start the long-poll loop (polling mode only). Transient errors (network, timeout, 429, 5xx) are retried by
     * the library itself and only mirrored into `info.connection`. A fatal error (e.g. 401 invalid token, or 409
     * because another bot instance polls with the same token) ends the loop; it is restarted after a delay.
     */
    startPolling(): void {
        const bot = this.bot;
        if (!bot || this.isServer || bot.isRunning()) {
            return;
        }
        if (this.pollingRestartTimer) {
            this.clearTimeout(this.pollingRestartTimer);
            this.pollingRestartTimer = undefined;
        }

        this.log.debug('Start polling');
        bot.startPolling(undefined, {
            onError: error => {
                if (this.isConnected) {
                    this.log.warn(
                        `polling_error: ${error instanceof Error ? error.message.replace(/<[^>]+>/g, '') : String(error)}`,
                    );
                    this.connectionState(false);
                }
            },
        })
            .then(() => this.log.debug('Polling stopped'))
            .catch(error => {
                this.log.error(`Polling stopped: ${error}. Restart in ${Telegram.POLLING_RESTART_MS / 1000} seconds`);
                this.pollingRestartTimer = this.setTimeout(() => {
                    this.pollingRestartTimer = undefined;
                    this.startPolling();
                }, Telegram.POLLING_RESTART_MS);
            });
    }

    /**
     * Register the handlers for the incoming update types.
     *
     * @param bot the bot instance
     */
    registerUpdateHandlers(bot: Bot): void {
        bot.on('message', ctx => {
            const msg = ctx.message;
            if (!msg) {
                return;
            }
            this.connectionState(true);

            if (this.config.storeRawRequest) {
                this.setStateSafe('communicate.requestRaw', { val: JSON.stringify(msg, null, 2), ack: true });
            }

            this.getMessage(msg);

            // Text messages run through the auth/command pipeline (communicate.request, text2command, ...).
            // Media messages (photo, video, document, ...) carry their text in `msg.caption`, not in
            // `msg.text` - route the caption through the same pipeline by treating it as the message text.
            if (msg.text) {
                this.processTelegramText(msg).catch(error => this.log.error(`Cannot process message: ${error}`));
            } else if (msg.caption) {
                this.processTelegramText({ ...msg, text: msg.caption }).catch(error =>
                    this.log.error(`Cannot process message: ${error}`),
                );
            }
        });

        // Telegram live location updates are delivered as `edited_message` events (only the first position
        // arrives as a normal `message`). Route them through getMessage() so communicate.requestLocation
        // (and requestRaw) follow the moving position.
        bot.on('edited_message', ctx => {
            const msg = ctx.editedMessage;
            // Only location updates are relevant here. Any other edit (typo fix in a text, changed caption
            // of a photo/document) would otherwise re-run getMessage() and e.g. download the media file a
            // second time and overwrite the request* states with the data of an old message.
            if (!msg?.location) {
                return;
            }

            this.connectionState(true);

            if (this.config.storeRawRequest) {
                this.setStateSafe('communicate.requestRaw', { val: JSON.stringify(msg, null, 2), ack: true });
            }

            this.getMessage(msg);
        });

        // Channel posts (in a channel where the bot is an admin) are delivered as a separate event, not
        // as `message`, so they were ignored before. They are anonymous (no `msg.from`), therefore the
        // auth/command pipeline cannot run; instead expose the post text and metadata so scripts can
        // react. See https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/289
        bot.on('channel_post', ctx => {
            const msg = ctx.channelPost;
            if (!msg) {
                return;
            }
            this.connectionState(true);

            if (this.config.storeRawRequest) {
                this.setStateSafe('communicate.requestRaw', { val: JSON.stringify(msg, null, 2), ack: true });
            }

            // stores the channel in communicate.chats and handles/saves any attached media
            this.getMessage(msg);

            const text = msg.text ?? msg.caption;
            if (text !== undefined) {
                const name = msg.chat.title || String(msg.chat.id);
                this.setStateSafe('communicate.requestChatId', { val: msg.chat.id, ack: true });
                this.setStateSafe('communicate.requestMessageId', { val: msg.message_id, ack: true });
                this.setStateSafe('communicate.requestMessageThreadId', {
                    val: msg.is_topic_message ? msg.message_thread_id : 0,
                    ack: true,
                });
                this.setStateSafe('communicate.request', { val: `[${name}]${text}`, ack: true });
            }
        });

        // callback InlineKeyboardButton
        bot.on('callback_query', ctx => {
            const callbackQuery = ctx.callbackQuery;
            if (!callbackQuery) {
                return;
            }
            this.connectionState(true);

            // write received answer into variable
            this.log.debug(`callback_query: ${JSON.stringify(callbackQuery)}`);
            this.callbackQueryId[callbackQuery.from.id] = { id: callbackQuery.id, ts: Date.now() };

            if (this.config.storeRawRequest) {
                this.setStateSafe('communicate.requestRaw', { val: JSON.stringify(callbackQuery), ack: true });
            }

            this.setStateSafe('communicate.requestMessageId', {
                val: callbackQuery.message!.message_id,
                ack: true,
            });
            this.setStateSafe('communicate.requestChatId', { val: callbackQuery.message!.chat.id, ack: true });
            this.setStateSafe('communicate.request', {
                val: `[${
                    !this.config.useUsername
                        ? callbackQuery.from.first_name
                        : !callbackQuery.from.username
                          ? callbackQuery.from.first_name
                          : callbackQuery.from.username
                }]${callbackQuery.data}`,
                ack: true,
            });

            this.isAnswerForQuestion(callbackQuery);
        });
    }

    async updateUsers(): Promise<void> {
        if (this.config.rememberUsers) {
            try {
                const state = await this.getStateAsync('communicate.users');
                if (state?.val) {
                    try {
                        this.storedUsers = JSON.parse(state.val as string);

                        // convert old format to new format
                        Object.keys(this.storedUsers).forEach(id => {
                            if (typeof this.storedUsers[id] !== 'object') {
                                if (this.config.useUsername) {
                                    this.storedUsers[id] = {
                                        userName: this.storedUsers[id],
                                        firstName: this.storedUsers[id],
                                        sysMessages:
                                            (this.storedUsers[id] as unknown as { sysMessages?: boolean })
                                                .sysMessages !== false,
                                    };
                                } else {
                                    this.storedUsers[id] = {
                                        firstName: this.storedUsers[id],
                                        userName: '',
                                        sysMessages:
                                            (this.storedUsers[id] as unknown as { sysMessages?: boolean })
                                                .sysMessages !== false,
                                    };
                                }
                            }
                        });
                    } catch (err) {
                        if (err) {
                            this.log.error(err);
                        }
                        this.log.error('Cannot parse stored user IDs!');
                    }
                }
            } catch (err) {
                this.log.error(err);
            }
        }
    }

    /** Restore the list of known chats/groups from `communicate.chats` on startup. See issue #312. */
    async updateChats(): Promise<void> {
        try {
            const state = await this.getStateAsync('communicate.chats');
            if (state?.val) {
                try {
                    this.storedChats = JSON.parse(state.val as string);
                } catch (err) {
                    this.log.error(`Cannot parse stored chat IDs: ${err instanceof Error ? err.message : err}`);
                }
            }
        } catch (err) {
            this.log.error(err);
        }
    }

    // Read all Object names sequentially, that do not have aliases
    async readAllNames(ids: string[]): Promise<void> {
        for (let i = 0; i < ids.length; i++) {
            try {
                const obj = await this.getForeignObjectAsync(ids[i]);
                if (obj) {
                    this.commands[ids[i]].alias = this.getName(obj);
                    this.commands[ids[i]].type = (obj.common as ioBroker.StateCommon)?.type;
                    this.commands[ids[i]].states = this.parseStates((obj.common as ioBroker.StateCommon)?.states);
                    this.commands[ids[i]].unit = (obj.common as ioBroker.StateCommon)?.unit;
                    this.commands[ids[i]].min = (obj.common as ioBroker.StateCommon)?.min;
                    this.commands[ids[i]].max = (obj.common as ioBroker.StateCommon)?.max;
                    // read actual state to detect changes
                    if (this.commands[ids[i]].reportChanges) {
                        const state = await this.getForeignStateAsync(ids[i]);
                        this.commands[ids[i]].lastState = state ? state.val : undefined;
                    }
                    await this.subscribeForeignStatesAsync(ids[i]);
                }
            } catch (err) {
                this.log.error(`Cannot process object "${ids[i]}": ${err}`);
            }
        }
    }

    async readStatesCommands(): Promise<void> {
        const doc = await this.getObjectViewAsync('system', 'custom', {});
        const readNames: string[] = [];
        if (doc && doc.rows) {
            for (let i = 0, l = doc.rows.length; i < l; i++) {
                if (doc.rows[i].value) {
                    const id = doc.rows[i].id;
                    const obj = doc.rows[i].value as Record<string, CommandConfig>;
                    if (obj[this.namespace] && obj[this.namespace].enabled) {
                        this.commands[id] = obj[this.namespace];
                        readNames.push(id);
                    }
                }
            }
        }

        await this.readAllNames(readNames);
    }

    async readEnums(name?: 'rooms'): Promise<{ rooms: { [roomId: string]: ioBroker.EnumCommon } }> {
        name ||= 'rooms';
        this.enumsCache[name] = {};
        try {
            const doc = await this.getObjectViewAsync('system', 'enum', {
                startkey: `enum.${name}.`,
                endkey: `enum.${name}.香`,
            });
            if (doc && doc.rows) {
                for (let i = 0, l = doc.rows.length; i < l; i++) {
                    if (doc.rows[i].value) {
                        const id = doc.rows[i].id;
                        const obj = doc.rows[i].value;
                        if (obj && obj.common && obj.common.members && obj.common.members.length) {
                            this.enumsCache[name][id] = obj.common;
                        }
                    }
                }
            }
        } catch (err) {
            this.log.error(`Cannot read enum ${name}: ${err}`);
        }

        return this.enumsCache;
    }

    async main(): Promise<void> {
        if (!this.config.token) {
            this.log.error('Token is not set!');
            return;
        }

        await this.setState('info.connection', false, true);

        await this.subscribeStatesAsync('communicate.request');
        await this.subscribeStatesAsync('communicate.response');
        await this.subscribeStatesAsync('communicate.responseSilent');
        await this.subscribeStatesAsync('communicate.responseJson');
        await this.subscribeStatesAsync('communicate.responseSilentJson');
        await this.subscribeStatesAsync('communicate.requestResponse');

        // clear states
        await this.setState('communicate.request', { val: '', ack: true });
        await this.setState('communicate.response', { val: '', ack: true });
        await this.setState('communicate.responseSilent', { val: '', ack: true });
        await this.setState('communicate.responseJson', { val: '', ack: true });
        await this.setState('communicate.responseSilentJson', { val: '', ack: true });
        await this.setState('communicate.requestResponse', { val: '', ack: true });
        await this.setState('communicate.pathFile', { val: '', ack: true });

        this.config.password ||= '';
        this.config.keyboard ||= '/cmds';

        await this.updateUsers();
        await this.updateChats();
        // Default to enabled only when the option is missing (old configs); respect an explicit `false`.
        if (this.config.allowStates == null) {
            this.config.allowStates = true;
        }
        this.config.answerTimeoutSec = parseInt(String(this.config.answerTimeoutSec), 10) || 60;
        this.config.answerTimeoutSec *= 1000;
        this.config.rememberUsers =
            (this.config.rememberUsers as unknown) === 'true' || this.config.rememberUsers === true;

        try {
            const obj = await this.getForeignObjectAsync('system.config');

            if (obj) {
                this.systemLang = obj.common.language || 'en';
            }

            await this.readStatesCommands();
            if (this.config.rooms) {
                await this.readEnums();
            }
            // init polling every hour
            this.reconnectTimer = this.setInterval(() => this.connect(), 3600000);

            this.connect();

            // detect changes of objects
            await this.subscribeForeignObjectsAsync('*');
        } catch (err) {
            this.log.error(err);
        }
    }

    /**
     * Process a `sendNotification` request
     *
     * @param obj the message object with the notification payload
     */
    async processNotification(obj: ioBroker.Message): Promise<void> {
        this.log.info(`New notification received from ${obj.from}`);

        const notificationMessage = this.buildMessageFromNotification(obj.message as NotificationMessage);
        try {
            await this.sendSystemMessage(notificationMessage, { parse_mode: 'MarkdownV2' });
            if (obj.callback) {
                this.sendTo(obj.from, 'sendNotification', { sent: true }, obj.callback);
            }
        } catch {
            if (obj.callback) {
                this.sendTo(obj.from, 'sendNotification', { sent: false }, obj.callback);
            }
        }
    }

    /**
     * Build up a mail object from the notification message
     *
     * @param message the notification message payload
     * @returns the formatted, character-escaped message text
     */
    buildMessageFromNotification(message: NotificationMessage): string {
        const subject = message.category.name;
        const { instances } = message.category;

        const readableInstances = Object.entries(instances).map(
            ([instance, entry]) =>
                `${instance.substring('system.adapter.'.length)}: ${this.getNewestMessage(entry.messages)}`,
        );

        const text = `${message.category.description}
${message.host}:
${readableInstances.join('\n')}
    `;

        return this.replaceReservedCharacters(`*${subject}*\n\n${text}`);
    }

    /**
     * Replace reserved characters in outgoing message
     *
     * @param text string to sanitize
     * @returns the sanitized string
     */
    replaceReservedCharacters(text: string): string {
        return text.replace(/([.!()\-_*[\]~`><&#+=|{}])/g, '\\$1');
    }

    /**
     * Extract the newest message out of a notification messages together with the localized date
     *
     * @param messages the list of notification messages
     * @returns the formatted newest message
     */
    getNewestMessage(messages: NotificationInstanceMessage[]): string {
        if (!messages?.length) {
            return '';
        }

        const newestMessage = messages.sort((a, b) => (a.ts < b.ts ? 1 : -1))[0];

        return `${new Date(newestMessage.ts).toLocaleString()} ${newestMessage.message}`;
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new Telegram(options);
} else {
    // otherwise start the instance directly
    (() => new Telegram())();
}
