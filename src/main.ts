import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { get as httpsGet } from 'node:https';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import type { Server as HttpsServer } from 'node:https';

import axios from 'axios';
import TelegramBot, {
    type CallbackQuery,
    type EditMessageMediaParams,
    type Message,
    type ParseMode,
    type TelegramBotOptions,
    type Update,
    type User,
} from 'node-telegram-bot-api';

import { Adapter, EXIT_CODES, getAbsoluteDefaultDataDir, type AdapterOptions, I18n } from '@iobroker/adapter-core';
import { WebServer } from '@iobroker/webserver';

type Server = HttpServer | HttpsServer;
type ServerExt = Server & { __server: any };

import type {
    CallOptions,
    CommandConfig,
    MessageIds,
    NotificationInstanceMessage,
    NotificationMessage,
    Question,
    SaveFileResult,
    SendOptions,
    TelegramConfig,
    Users,
} from './types';

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

class Telegram extends Adapter {
    declare config: TelegramConfig;
    private bot: TelegramBot | undefined;
    private storedUsers: Users = {};
    private systemLang: ioBroker.Languages = 'en';
    private reconnectTimer: ioBroker.Interval | undefined;
    private pollConnectionStatus: ioBroker.Timeout | undefined;
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
                            this.setState('communicate.users', JSON.stringify(userObj), true, err => {
                                if (!err) {
                                    this.sendTo(obj.from, obj.command, userID, obj.callback);
                                    this.updateUsers();
                                    this.log.warn(`User ${userID} has been deleted!`);
                                }
                            });
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
                            this.setState('communicate.users', JSON.stringify(userObj), true, err => {
                                if (!err) {
                                    this.sendTo(obj.from, obj.command, userID, obj.callback);
                                    this.updateUsers();
                                    this.log.info(
                                        `Receiving of system messages for user "${userID}" has been changed to ${checked}!`,
                                    );
                                }
                            });
                        } catch (err) {
                            this.log.error(err);
                            this.log.error(`Cannot change user ${userID}!`);
                        }
                    }
                });
            } else if (obj.command === 'delAllUser') {
                try {
                    this.setState('communicate.users', '{}', true, err => {
                        if (!err) {
                            this.sendTo(obj.from, obj.command, true, obj.callback);
                            this.updateUsers();
                            this.log.warn(
                                'List of saved users has been wiped. Every User has to reauthenticate with the new password!',
                            );
                        }
                    });
                } catch (err) {
                    this.log.error(err);
                    this.log.error('Cannot wipe list of saved users!');
                }
            } else if (obj.command === 'sendNotification') {
                this.processNotification(obj);
            } else {
                this.processMessage(obj);
            }
        }
    }

    async onReady(): Promise<void> {
        this.isServer = this.config.server === 'true';
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
                    this.terminate
                        ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                        : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
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
                            this.terminate
                                ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                                : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                        }
                    });

                    this.getPort(
                        this.config.port,
                        !this.config.bind || this.config.bind === '0.0.0.0' ? undefined : this.config.bind || undefined,
                        port => {
                            if (parseInt(String(port), 10) !== this.config.port && !this.config.findNextPort) {
                                this.log.error(`port ${this.config.port} already in use`);
                                this.terminate ? this.terminate() : process.exit(1);
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

        if (this.garbageCollectorInterval) {
            this.clearInterval(this.garbageCollectorInterval);
            this.garbageCollectorInterval = undefined;
        }

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
                    );
                } else {
                    this.sendSystemMessage(this.config.restarting);
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
                this.getForeignStateAsync(id).then(
                    state => (this.commands[id].lastState = state ? state.val : undefined),
                );
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

    connectionState(connected: boolean, logSuccess?: boolean): void {
        let errorCounter = 0;

        const checkConnection = (): void => {
            this.pollConnectionStatus = undefined;
            this.bot
                ?.getMe?.()
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
            this.setState('info.connection', this.isConnected, true);
            if (this.isConnected && this.pollConnectionStatus) {
                this.clearTimeout(this.pollConnectionStatus);
                this.pollConnectionStatus = undefined;
            } else if (!this.isConnected) {
                checkConnection();
            }
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
                this.bot!.processUpdate(msg);
            });
        } else {
            res.writeHead(404, 'Resource Not Found', {
                'Content-Type': 'text/html',
            });
            res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>');
        }
    }

    saveSendRequest(msg: Message | boolean): void {
        this.log.debug(`Request [saveSendRequest]: ${JSON.stringify(msg)}`);

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

    sendMessageHelper(dest: number | string, name: string, text: any, options: SendOptions): Promise<string> {
        const bot = this.bot!;
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
                            bot.editMessageReplyMarkup(
                                options.editMessageReplyMarkup!.reply_markup,
                                options.editMessageReplyMarkup!.options,
                            ),
                        options,
                        resolve,
                    );
                }
            } else if (options?.editMessageText !== undefined) {
                this.log.debug(`Send editMessageText to "${name}"`);
                if (bot) {
                    this.executeSending(
                        () => bot.editMessageText({ ...options.editMessageText!.options, text }),
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
                        // The library resolves the file itself (local path / Buffer / stream / URL /
                        // file_id) and builds the multipart form + `attach://` reference internally.
                        // We only pass the InputMedia object and the extra form fields.
                        const inputMedia: {
                            type: 'photo' | 'animation' | 'video' | 'audio' | 'document';
                            media: string;
                            caption?: string;
                            parse_mode?: ParseMode;
                        } = {
                            type: mediaInput.type as 'photo' | 'animation' | 'video' | 'audio' | 'document',
                            media: mediaInput.media,
                        };

                        if (options.editMessageMedia.options?.caption) {
                            inputMedia.caption = options.editMessageMedia.options.caption;
                        }
                        if (options.editMessageMedia.options?.parse_mode) {
                            inputMedia.parse_mode = options.editMessageMedia.options.parse_mode;
                        }

                        const form: Omit<EditMessageMediaParams, 'media'> = {};
                        if (options.editMessageMedia.options?.chat_id !== undefined) {
                            form.chat_id = options.editMessageMedia.options.chat_id;
                        }
                        if (options.editMessageMedia.options?.message_id !== undefined) {
                            form.message_id = options.editMessageMedia.options.message_id;
                        }
                        if (options.editMessageMedia.options?.reply_markup) {
                            form.reply_markup = options.editMessageMedia.options.reply_markup;
                        }

                        if (bot) {
                            this.executeSending(() => bot.editMessageMedia(inputMedia, form), options, resolve);
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
                        () => bot.editMessageCaption(text, options.editMessageCaption!.options),
                        options,
                        resolve,
                    );
                }
            } else if (options?.deleteMessage !== undefined) {
                this.log.debug(`Send deleteMessage to "${name}"`);
                if (bot) {
                    this.executeSending(
                        () =>
                            bot.deleteMessage(
                                options.deleteMessage!.options.chat_id,
                                options.deleteMessage!.options.message_id,
                            ),
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
                            bot.sendVenue(
                                dest,
                                parseFloat(String(options.latitude)),
                                parseFloat(String(options.longitude)),
                                options.title!,
                                options.address!,
                                options,
                            ),
                        options,
                        resolve,
                    );
                }
            } else if (options?.latitude !== undefined && options.longitude !== undefined) {
                this.log.debug(`Send location to "${name}": ${options.latitude},${options.longitude}`);
                if (bot) {
                    this.executeSending(
                        () =>
                            bot.sendLocation(
                                dest,
                                parseFloat(String(options.latitude)),
                                parseFloat(String(options.longitude)),
                                options,
                            ),
                        options,
                        resolve,
                    );
                }
            } else if (options?.type === 'mediagroup') {
                this.log.debug(`Send media group to "${name}": `);
                if (bot) {
                    const { media: fileNames } = options;
                    if (fileNames instanceof Array) {
                        bot.sendChatAction(dest, 'upload_photo')
                            .then(() => {
                                if (fileNames.every((name: string) => existsSync(name))) {
                                    const filesAsArray = fileNames
                                        .map((element: string) => {
                                            try {
                                                return { type: 'photo', media: readFileSync(element) };
                                            } catch (err) {
                                                this.log.error(`Cannot read file ${element}: ${err}`);
                                                return undefined;
                                            }
                                        })
                                        .filter(element => element !== undefined);

                                    const size = filesAsArray
                                        .map(element => element.media.length)
                                        .reduce((acc, val) => acc + val);

                                    this.log.info(`Send media group to "${name}": ${size} bytes`);
                                    if (filesAsArray.length > 0) {
                                        this.executeSending(
                                            () => bot.sendMediaGroup(dest, filesAsArray),
                                            options,
                                            resolve,
                                        );
                                    }
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
                    this.executeSending(() => bot.sendChatAction(dest, text), options, resolve);
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
                    this.executeSending(() => bot.sendSticker(dest, text, options), options, resolve);
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
                    this.executeSending(() => bot.sendAnimation(dest, text, options), options, resolve);
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
                    this.executeSending(() => bot.sendVideo(dest, text, options), options, resolve);
                }
            } else if (
                text &&
                ((typeof text === 'string' && text.match(/\.(txt|doc|docx|csv|pdf|xls|xlsx)$/i) && existsSync(text)) ||
                    options?.type === 'document')
            ) {
                this.log.debug(`Send document to "${name}": ${typeof text === 'string' ? text : text.length}`);
                if (bot) {
                    this.executeSending(() => bot.sendDocument(dest, text, options), options, resolve);
                }
            } else if (
                text &&
                ((typeof text === 'string' && text.match(/\.(wav|mp3|ogg)$/i) && existsSync(text)) ||
                    (options && options?.type === 'audio'))
            ) {
                this.log.debug(`Send audio to "${name}": ${typeof text === 'string' ? text : text.length}`);

                if (bot) {
                    this.executeSending(() => bot.sendAudio(dest, text, options), options, resolve);
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
                    this.executeSending(() => bot.sendPhoto(dest, text, options), options, resolve);
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
                            bot.answerCallbackQuery(originalChatId, {
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
                    this.executeSending(() => bot.sendMessage(dest, text || '', options), options, resolve);
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
                        (this.config.useUsername && this.storedUsers[id].userName === userName) ||
                        (!this.config.useUsername && this.storedUsers[id].firstName === userName)
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
                    (this.config.useUsername && this.storedUsers[id_t].userName.match(re)) ||
                    (!this.config.useUsername && this.storedUsers[id_t].firstName.match(re))
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
                        this.config.useUsername ? this.storedUsers[id].userName : this.storedUsers[id].firstName,
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

        this.bot!.getFileLink(fileID)
            .then(url => {
                this.log.debug(`Received message: ${url}`);
                httpsGet(url, res => {
                    if (res.statusCode === 200) {
                        const buf: Buffer[] = [];
                        res.on('data', data => buf.push(data));
                        res.on('end', () => {
                            if (this.config.saveFilesTo == 'filesystem') {
                                const fileLocation = join(this.tmpDirName, fileName);
                                try {
                                    writeFileSync(fileLocation, Buffer.concat(buf));

                                    callback({
                                        info: `media file has been saved to "${this.config.saveFilesTo}": ${fileLocation}`,
                                        location: this.config.saveFilesTo,
                                        path: fileLocation,
                                    });
                                } catch (err) {
                                    return callback({ error: `Error: ${err}` });
                                }
                            } else if (this.config.saveFilesTo == 'iobroker') {
                                try {
                                    const fileLocation = join(this.tmpDirName, fileName); // TODO: check new urn format https://github.com/ioBroker/ioBroker.js-controller/issues/2710

                                    this.writeFileAsync(this.namespace, fileName, Buffer.concat(buf)).then(() => {
                                        callback({
                                            info: `media file has been saved to "${this.config.saveFilesTo}": ${fileLocation}`,
                                            location: this.config.saveFilesTo,
                                            path: fileLocation,
                                        });
                                    });
                                } catch (err) {
                                    return callback({ error: `Error: ${err}` });
                                }
                            }
                        });

                        res.on('error', err => callback({ error: `Error: ${err}` }));
                    } else {
                        callback({ error: 'Error: statusCode !== 200' });
                    }
                });
            })
            .catch(err => callback({ error: `Error bot.getFileLink: ${err}` }));
    }

    getMessage(msg: Message): void {
        const date = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
        this.log.debug(`Received message: ${JSON.stringify(msg)}`);

        // Media messages (photo, document, voice, ...) do not contain `msg.text`, so they are not handled
        // by `processTelegramText` (which is bound via `bot.onText`). As a result the request metadata
        // (chat id, message id, user id) would stay empty for received files. Populate it here so the
        // sender can be identified. See https://github.com/iobroker-community-adapters/ioBroker.telegram/issues/1043
        if (msg.voice || msg.photo || msg.video || msg.video_note || msg.audio || msg.document) {
            this.setState('communicate.requestChatId', { val: msg.chat.id, ack: true });
            this.setState('communicate.requestMessageId', { val: msg.message_id, ack: true });
            this.setState('communicate.requestMessageThreadId', {
                val: msg.is_topic_message ? msg.message_thread_id : 0,
                ack: true,
            });
            if (msg.from) {
                this.setState('communicate.requestUserId', { val: msg.from.id.toString(), ack: true });
            }
        }

        if (msg.voice) {
            try {
                this.saveFile(
                    msg.voice.file_id,
                    this.config.saveFiles ? `/voice/${date}.ogg` : '/voice/temp.ogg',
                    res => {
                        if (!res.error) {
                            this.log.info(res.info!);
                            this.setState(
                                'communicate.pathFile',
                                res.path!,
                                true,
                                err => err && this.log.error(err.message),
                            );
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
                            this.setState(
                                'communicate.pathFile',
                                res.path!,
                                true,
                                err => err && this.log.error(err.message),
                            );
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
                        this.setState(
                            'communicate.pathFile',
                            res.path!,
                            true,
                            err => err && this.log.error(err.message),
                        );
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
                        this.setState(
                            'communicate.pathFile',
                            res.path!,
                            true,
                            err => err && this.log.error(err.message),
                        );
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
                        this.setState(
                            'communicate.pathFile',
                            res.path!,
                            true,
                            err => err && this.log.error(err.message),
                        );
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
                        this.setState(
                            'communicate.pathFile',
                            res.path!,
                            true,
                            err => err && this.log.error(err.message),
                        );
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
                                    this.bot.editMessageReplyMarkup(
                                        { inline_keyboard: [] },
                                        {
                                            chat_id: q.chatId,
                                            message_id: q.msgId,
                                        },
                                    );
                                    this.log.debug(`removed inline_keyboard for msg ${q.msgId}: ${JSON.stringify(q)}`);
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
                this.setState('communicate.users', JSON.stringify(this.storedUsers), true);
            }
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

        this.bot!.sendMessage(chatId, I18n.translate('Select option'), {
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

                    // Remove keyboard
                    if (this.bot && question?.chatId && question?.msgId) {
                        this.bot.editMessageReplyMarkup(
                            { inline_keyboard: [] },
                            {
                                chat_id: question.chatId,
                                message_id: question.msgId,
                            },
                        );
                        this.log.debug(
                            `removed inline_keyboard for msg ${question.msgId}: ${JSON.stringify(question)}`,
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
     * @param instance target instance id, e.g. `assistant.0`
     * @param command the `sendTo` command
     * @param message the payload to forward
     */
    async sendToIfAlive(
        instance: string,
        command: string,
        message: Record<string, unknown>,
    ): Promise<ioBroker.Message | undefined> {
        try {
            const aliveState = await this.getForeignStateAsync(`system.adapter.${instance}.alive`);
            if (!aliveState?.val) {
                this.log.warn(`Cannot forward message to "${instance}": instance is not running`);
                return;
            }
        } catch (err) {
            this.log.warn(`Cannot check if "${instance}" is alive: ${err instanceof Error ? err.message : err}`);
            return;
        }
        return await this.sendToAsync(instance, command, message);
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
            return bot
                .sendMessage(from.id, I18n.translate('Message ignored: ') + msgText)
                .catch(error => this.log.error(`send Message Error: ${error}`));
        }

        msgText = (msgText || '').trim();

        // sometimes telegram sends messages like "message@user_name"
        const pos = msgText.lastIndexOf('@');
        if (pos !== -1) {
            msgText = msgText.substring(0, pos);
        }

        if (msgText === '/password' && !this.config.doNotAcceptNewUser) {
            return bot
                .sendMessage(from.id, I18n.translate('Please enter password in form "/password phrase"'))
                .catch(error => this.log.error(`send Message Error:${error}`));
        }

        if (this.config.password && !this.config.doNotAcceptNewUsers) {
            // if user sent password
            let m = msgText.match(/^\/password (.+)$/);
            m ||= msgText.match(/^\/p (.+)$/);

            if (m) {
                this.garbageCollector();

                if (this.protection[user] && this.protection[user].length >= 5) {
                    return bot
                        .sendMessage(
                            from.id,
                            `${I18n.translate('Too many attempts. Blocked for')} ${Math.round((now - this.protection[user][this.protection[user].length - 1]) / 1000)} ${I18n.translate('seconds')}`,
                        )
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
                    await bot
                        .deleteMessage(msg.chat.id, msg.message_id)
                        .catch(error => this.log.warn(`Cannot delete password message: ${error}`));

                    return bot
                        .sendMessage(from.id, I18n.translate('Welcome ') + user)
                        .catch(error => this.log.error(`send Message Error: ${error}`));
                }
                this.protection[user] ||= [];
                this.protection[user].push(Date.now());

                this.gcInterval ||= this.setInterval(() => this.garbageCollector(), 60000);

                this.log.warn(`Got invalid password from ${user}: ${m[1]}`);

                bot.sendMessage(from.id, I18n.translate('Invalid password')).catch(error =>
                    this.log.error(`send Message Error: ${error}`),
                );

                if (this.storedUsers[from.id]) {
                    delete this.storedUsers[from.id];
                }
            }
        }

        // todo support commands: instances, running, restart

        // If a user is not in the trusted list
        if ((this.config.password || this.config.doNotAcceptNewUsers) && !this.storedUsers[from.id]) {
            return bot
                .sendMessage(
                    from.id,
                    I18n.translate(
                        this.config.doNotAcceptNewUsers
                            ? 'User is not in the list'
                            : 'Please enter password in form "/password phrase"',
                    ),
                )
                .catch(error => this.log.error(`send Message Error: ${error}`));
        }

        if (msgText === '/help') {
            return bot
                .sendMessage(from.id, this.getListOfCommands())
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
                        this.getForeignState(id, (err, state) =>
                            bot
                                .sendMessage(msg.chat.id, this.getStatus(id, state))
                                .catch(error => this.log.error(`send Message Error: ${error}`)),
                        );
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
                                bot.sendMessage(msg.chat.id, I18n.translate('Invalid number %s', sValue)).catch(error =>
                                    this.log.error(`send Message Error: ${error}`),
                                );
                                continue;
                            }
                        } else {
                            value = sValue;
                        }

                        this.setForeignStateAsync(id, value, false, () =>
                            bot.sendMessage(msg.chat.id, I18n.translate('Done')),
                        )?.catch(error => this.log.error(`send Message Error: ${error}`));
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

                this.getForeignState(id1, (err, state) => {
                    if (memoryLeak1) {
                        this.clearTimeout(memoryLeak1);
                        memoryLeak1 = undefined;
                        m = null;
                    }
                    if (currentMsg) {
                        if (err) {
                            bot.sendMessage(from.id, err.message).catch(error =>
                                this.log.error(`send Message Error: ${error}`),
                            );
                        }
                        if (state) {
                            this.setForeignState(id1 as string, val1, false, err => {
                                if (currentMsg) {
                                    if (err) {
                                        bot.sendMessage(from.id, err.message).catch(error =>
                                            this.log.error(`send Message Error: ${error}`),
                                        );
                                    } else {
                                        bot.sendMessage(from.id, I18n.translate('Done')).catch(error =>
                                            this.log.error(`send Message Error: ${error}`),
                                        );
                                    }
                                }
                            });
                        } else {
                            bot.sendMessage(from.id, I18n.translate('ID "%s" not found.', id1 as string)).catch(error =>
                                this.log.error(`send Message Error: ${error}`),
                            );
                        }
                    }
                });
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

                this.getForeignState(id2, (err, state) => {
                    if (memoryLeak2) {
                        this.clearTimeout(memoryLeak2);
                        memoryLeak2 = undefined;
                        m = null;
                    }
                    if (currentMsg) {
                        if (err) {
                            bot.sendMessage(from.id, err.message).catch(error =>
                                this.log.error(`send Message Error: ${error}`),
                            );
                        }
                        if (state) {
                            bot.sendMessage(from.id, String(state.val)).catch(error =>
                                this.log.error(`send Message Error: ${error}`),
                            );
                        } else {
                            bot.sendMessage(from.id, I18n.translate('ID "%s" not found.', id2 as string)).catch(error =>
                                this.log.error(`send Message Error: ${error}`),
                            );
                        }
                    }
                });
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
                        bot.sendMessage(response.id, text, options).catch(error =>
                            this.log.error(`send Message Error: ${error}`),
                        );
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
                        bot.sendMessage(msg.chat.id, text, options).catch(error =>
                            this.log.error(`send Message Error: ${error}`),
                        );
                    }
                })
                .catch(err => this.log.error(`Cannot send message to ${this.config.assistantInstance}: ${err}`));
        }

        this.setState('communicate.requestChatId', { val: msg.chat.id, ack: true });
        this.setState('communicate.requestMessageId', { val: msg.message_id, ack: true });
        this.setState('communicate.requestMessageThreadId', {
            val: msg.is_topic_message ? msg.message_thread_id : 0,
            ack: true,
        });
        this.setState('communicate.requestUserId', {
            val: from.id.toString(),
            ack: true,
        });
        this.setState('communicate.request', { val: `[${user}]${msgText}`, ack: true });
    }

    connect(): void {
        if (this.bot) {
            const bot = this.bot;
            if (!this.isServer) {
                try {
                    if (bot.isPolling()) {
                        this.log.debug('bot polling OK');
                    } else {
                        this.log.debug('bot restarting...');
                        bot.stopPolling().then(
                            () => {
                                this.log.debug('Start Polling');
                                void bot.startPolling();
                            },
                            error => {
                                this.log.error(`Error stop polling: ${error}`);
                            },
                        );
                    }
                } catch {
                    // looks empty
                }
            }
            // Check connection
            bot.getMe()
                .then(data => {
                    this.log.debug(`getMe (reconnect): ${JSON.stringify(data)}`);
                    this.connectionState(true);
                })
                .catch(error => this.log.error(`getMe (reconnect) Error:${error}`));
        } else {
            if (this.isServer) {
                // Setup server way
                const serverOptions: TelegramBotOptions = {
                    polling: false,
                    filepath: true,
                    baseApiUrl: this.config.baseApiUrl,
                };
                this.bot = new TelegramBot(this.config.token, serverOptions);
                if (this.config.url[this.config.url.length - 1] === '/') {
                    this.config.url = this.config.url.substring(0, this.config.url.length - 1);
                }
                this.bot.setWebhook(`${this.config.url}/${this.config.token}`);
            } else {
                // Setup polling way
                const pollingOptions = {
                    polling: {
                        interval: parseInt(String(this.config.pollingInterval), 10) || 300,
                    },
                    filepath: true,
                    baseApiUrl: this.config.baseApiUrl,
                };
                this.log.debug(
                    `Start polling with: ${pollingOptions.polling.interval}(${typeof pollingOptions.polling.interval}) ms interval`,
                );
                this.bot = new TelegramBot(this.config.token, pollingOptions);
                this.bot.setWebhook('').catch(error => {
                    this.log.error(`setWebhook Error:${error}`);
                });
            }

            const bot = this.bot;

            // Check connection
            bot.getMe()
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
                            this.sendSystemMessage(I18n.translate('Started!'));
                        } else {
                            this.sendSystemMessage(this.config.restarted);
                        }
                    }
                })
                .catch(error => {
                    this.log.error(`getMe Error:${error}`);
                    this.connectionState(false);
                });

            // Matches /echo [whatever]
            bot.onText(/(.+)/, msg => this.processTelegramText(msg));
            bot.on('message', msg => {
                this.connectionState(true);

                if (this.config.storeRawRequest) {
                    this.setState('communicate.requestRaw', { val: JSON.stringify(msg, null, 2), ack: true });
                }

                this.getMessage(msg);
            });

            // callback InlineKeyboardButton
            bot.on('callback_query', (callbackQuery: CallbackQuery) => {
                this.connectionState(true);

                // write received answer into variable
                this.log.debug(`callback_query: ${JSON.stringify(callbackQuery)}`);
                this.callbackQueryId[callbackQuery.from.id] = { id: callbackQuery.id, ts: Date.now() };

                if (this.config.storeRawRequest) {
                    this.setState(
                        'communicate.requestRaw',
                        JSON.stringify(callbackQuery),
                        true,
                        err => err && this.log.error(err.message),
                    );
                }

                this.setState(
                    'communicate.requestMessageId',
                    callbackQuery.message!.message_id,
                    true,
                    err => err && this.log.error(err.message),
                );
                this.setState(
                    'communicate.requestChatId',
                    callbackQuery.message!.chat.id,
                    true,
                    err => err && this.log.error(err.message),
                );
                this.setState(
                    'communicate.request',
                    `[${
                        !this.config.useUsername
                            ? callbackQuery.from.first_name
                            : !callbackQuery.from.username
                              ? callbackQuery.from.first_name
                              : callbackQuery.from.username
                    }]${callbackQuery.data}`,
                    true,
                    err => err && this.log.error(err.message),
                );

                this.isAnswerForQuestion(callbackQuery);
            });

            bot.on('polling_error', (error: Error & { code?: string }) => {
                if (this.isConnected) {
                    this.log.warn(`polling_error: ${error.code}, ${error.message.replace(/<[^>]+>/g, '')}`); // => 'EFATAL'
                    this.connectionState(false);
                }
            });

            bot.on('webhook_error', (error: Error & { code?: string }) => {
                this.log.error(`webhook_error:${error.code}, ${error.message.replace(/<[^>]+>/g, '')}`); // => 'EPARSE'
                this.log.debug('bot restarting...');

                bot.stopPolling().then(
                    () => {
                        this.log.debug('Start Polling');
                        void bot.startPolling();
                    },
                    error => {
                        this.log.error(`Error stop polling: ${error}`);
                    },
                );
            });
        }
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
