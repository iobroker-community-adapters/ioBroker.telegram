/**
 *
 *      ioBroker telegram Adapter
 *
 *      Copyright (c) 2016-2023 bluefox <dogafox@gmail.com>
 *
 *      MIT License
 *
 */

/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
'use strict';

// https://github.com/yagop/node-telegram-bot-api/issues/319 (because of bluebird)
process.env.NTBA_FIX_319 = 1;

const TelegramBot = require('node-telegram-bot-api');
const utils       = require('@iobroker/adapter-core'); // Get common adapter utils
const adapterName = require('./package.json').name.split('.').pop();
const _           = require('./lib/words.js');
const fs          = require('fs');
const path        = require('path');
const LE          = utils.commonTools.letsEncrypt;
const https       = require('https');
const axios       = require('axios');

let socks;

let bot;
let users = {};
let systemLang = 'en';
let reconnectTimer = null;
let pollConnectionStatus = null;
let isConnected = null;
let lastMessageTime = 0;
let lastMessageText = '';
const enums = {};
const protection = {};
let gcInterval = null;

const commands = {};
const callbackQueryId = {};
const mediaGroupExport = {};
let tmpDirName;

const server = {
    app: null,
    server: null,
    settings: null
};

let adapter;

const systemLang2CallMe = {
    en: 'en-GB-Standard-A',
    de: 'de-DE-Standard-A',
    ru: 'ru-RU-Standard-A',
    pt: 'pt-BR-Standard-A',
    nl: 'nl-NL-Standard-A',
    fr: 'fr-FR-Standard-A',
    it: 'it-IT-Standard-A',
    es: 'es-ES-Standard-A',
    pl: 'pl-PL-Standard-A',
    'zh-cn': 'en-GB-Standard-A'
};

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: adapterName,
        /**
         * If the JS-Controller catches an unhandled error, this will be called
         * so we have a chance to handle it ourself.
         * @param {Error} err
         */
        error: (err) => {
            // Identify unhandled errors originating from callbacks in scripts
            // These are not caught by wrapping the execution code in try-catch
            if (err ) {
                const errStr = err.toString();
                if (errStr.includes('getaddrinfo') || errStr.includes('api.telegram.org') || errStr.includes('EAI_AGAIN')) {
                    return true;
                }
            }
            return false;
        }
    });

    adapter = new utils.Adapter(options);

    adapter.on('message', obj => {
        if (obj) {
            if (obj.command === 'adminuser') {
                let adminUserData;
                adapter.getState('communicate.users', (err, state) => {
                    err && adapter.log.error(err);
                    if (state && state.val) {
                        try {
                            adminUserData = JSON.parse(state.val);
                            adapter.sendTo(obj.from, obj.command, adminUserData, obj.callback);
                        } catch (err) {
                            err && adapter.log.error(err);
                            adapter.log.error('Cannot parse stored user IDs!');
                        }
                    }
                });
            } else if (obj.command === 'delUser') {
                const userID = obj.message;
                let userObj = {};
                adapter.getState('communicate.users', (err, state) => {
                    err && adapter.log.error(err);
                    if (state && state.val) {
                        try {
                            userObj = JSON.parse(state.val);
                            delete userObj[userID];
                            adapter.setState('communicate.users', JSON.stringify(userObj), true, err => {
                                if (!err) {
                                    adapter.sendTo(obj.from, obj.command, userID, obj.callback);
                                    updateUsers();
                                    adapter.log.warn(`User ${userID} has been deleted!`);
                                }
                            });
                        } catch (err) {
                            err && adapter.log.error(err);
                            adapter.log.error(`Cannot delete user ${userID}!`);
                        }
                    }
                });
            } else if (obj.command === 'systemMessages') {
                const userID = obj.message.itemId;
                const checked = obj.message.checked;
                let userObj = {};
                adapter.getState('communicate.users', (err, state) => {
                    err && adapter.log.error(err);
                    if (state && state.val) {
                        try {
                            userObj = JSON.parse(state.val);
                            userObj[userID].sysMessages = checked;
                            adapter.setState('communicate.users', JSON.stringify(userObj), true, err => {
                                if (!err) {
                                    adapter.sendTo(obj.from, obj.command, userID, obj.callback);
                                    updateUsers();
                                    adapter.log.info(`Receiving of system messages for user "${userID}" has been changed to ${checked}!`);
                                }
                            });
                        } catch (err) {
                            err && adapter.log.error(err);
                            adapter.log.error(`Cannot change user ${userID}!`);
                        }
                    }
                });
            } else if (obj.command === 'delAllUser') {
                try {
                    adapter.setState('communicate.users', '{}', true, err => {
                        if (!err) {
                            adapter.sendTo(obj.from, obj.command, true, obj.callback);
                            updateUsers();
                            adapter.log.warn('List of saved users has been wiped. Every User has to reauthenticate with the new password!');
                        }
                    });
                } catch (err) {
                    err && adapter.log.error(err);
                    adapter.log.error('Cannot wipe list of saved users!');
                }
            } else {
                processMessage(obj);
            }
        }
    });

    adapter.on('ready', () => {
        adapter.config.server = adapter.config.server === 'true';

        adapter._questions = [];
        adapter.garbageCollectorinterval = setInterval(() => {
            const now = Date.now();
            Object.keys(callbackQueryId).forEach(id => {
                if (now - callbackQueryId[id].ts > 120000) {
                    delete callbackQueryId[id];
                }
            });
        }, 10000);

        if (adapter.config.server) {
            adapter.config.port = parseInt(adapter.config.port, 10);

            // Load certificates
            adapter.getCertificates(async (err, certificates, leConfig) => {
                adapter.config.certificates = certificates;
                adapter.config.leConfig = leConfig;
                adapter.config.secure = true;

                try {
                    if (typeof LE.createServerAsync === 'function') {
                        server.server = await LE.createServerAsync(handleWebHook, adapter.config, adapter.config.certificates, adapter.config.leConfig, adapter.log, adapter);
                    } else {
                        server.server = LE.createServer(handleWebHook, adapter.config, adapter.config.certificates, adapter.config.leConfig, adapter.log);
                    }
                } catch (err) {
                    adapter.log.error(`Cannot create webserver: ${err}`);
                    adapter.terminate ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION) : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                    return;
                }
                if (server.server) {
                    server.server.__server = server;

                    let serverListening = false;
                    let serverPort = adapter.config.port;
                    server.server.on('error', e => {
                        if (e.toString().includes('EACCES') && serverPort <= 1024) {
                            adapter.log.error(`node.js process has no rights to start server on the port ${serverPort}.\n` +
                                `Do you know that on linux you need special permissions for ports under 1024?\n` +
                                `You can call in shell following scrip to allow it for node.js: "iobroker fix"`
                            );
                        } else {
                            adapter.log.error(`Cannot start server on ${adapter.config.bind || '0.0.0.0'}:${serverPort}: ${e}`);
                        }
                        if (!serverListening) {
                            adapter.terminate ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION) : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                        }
                    });

                    adapter.getPort(adapter.config.port, (!adapter.config.bind || adapter.config.bind === '0.0.0.0') ? undefined : adapter.config.bind || undefined, port => {
                        if (parseInt(port, 10) !== adapter.config.port && !adapter.config.findNextPort) {
                            adapter.log.error(`port ${adapter.config.port} already in use`);
                            adapter.terminate ? adapter.terminate() : process.exit(1);
                        }
                        serverPort = port;

                        server.server.listen(port, (!adapter.config.bind || adapter.config.bind === '0.0.0.0') ? undefined : adapter.config.bind || undefined, () =>
                            serverListening = true);
                        adapter.log.info(`https server listening on port ${port}`);

                        main()
                            .then(() => {});
                    });
                }
            });
        } else {
            main()
                .then(() => {});
        }
    });

    adapter.on('unload', () => {
        reconnectTimer && clearInterval(reconnectTimer);
        reconnectTimer = null;

        gcInterval && clearInterval(gcInterval);
        gcInterval = null;

        pollConnectionStatus && clearInterval(pollConnectionStatus);
        pollConnectionStatus = null;

        adapter.garbageCollectorinterval && clearInterval(adapter.garbageCollectorinterval);
        adapter.garbageCollectorinterval = null;

        if (adapter && adapter.config) {
            if (adapter.config.restarting !== '') {
                // default text
                if (adapter.config.restarting === '_' || adapter.config.restarting === null || adapter.config.restarting === undefined) {
                    sendSystemMessage(adapter.config.rememberUsers ? _('Restarting...') : _('Restarting... Reauthenticate!'));
                } else {
                    sendSystemMessage(adapter.config.restarting);
                }
            }
            try {
                if (server.server) {
                    server.server.close();
                }
            } catch (e) {
                console.error(`Cannot close server: ${e}`);
            }
        }
        isConnected && adapter && adapter.setState && adapter.setState('info.connection', false, true);
        isConnected = false;
    });

    // is called if a subscribed state changes
    adapter.on('stateChange', (id, state) => {
        if (state) {
            if (!state.ack) {
                if (id.endsWith('communicate.response')) {
                    if (typeof state.val === 'object') {
                        adapter.log.error(`communicate.response only supports passing a message to send as string. You provided ${JSON.stringify(state.val)}. Please use "communicate.responseJson" instead with a stringified JSON object!`);
                        return;
                    }
                    // Send to someone this message
                    sendMessage(state.val)
                        .then(data => adapter.setState('communicate.response', state.val, true));
                } else
                if (id.endsWith('communicate.responseSilent')) {
                    if (typeof state.val === 'object') {
                        adapter.log.error(`communicate.responseSilent only supports passing a message to send as string. You provided ${JSON.stringify(state.val)}. Please use "communicate.responseSilentJson" instead with a stringified JSON object!`);
                        return;
                    }
                    // Send to someone this message
                    sendMessage(state.val, null, null, {disable_notification: true})
                        .then(data => adapter.setState('communicate.responseSilent', state.val, true));
                } else
                if (id.endsWith('communicate.responseJson')) {
                    try {
                        const val = JSON.parse(state.val);
                        // Send to someone this message
                        sendMessage(val)
                            .then(data => adapter.setState('communicate.responseJson', state.val, true));
                    } catch (err) {
                        adapter.log.error(`could not parse Json in communicate.responseJon state: ${err.message}`);
                    }
                } else
                if (id.endsWith('communicate.responseSilentJson')) {
                    try {
                        const val = JSON.parse(state.val);
                        // Send to someone this message
                        sendMessage(val, null, null, {disable_notification: true})
                            .then(data => adapter.setState('communicate.responseSilent', state.val, true));
                    } catch (err) {
                        adapter.log.error(`could not parse Json in communicate.responseSilentJon state: ${err.message}`);
                    }
                }
            } else {
                if (commands[id] && commands[id].report) {
                    if (commands[id].reportChanges) {
                        if (state.val !== commands[id].lastState) {
                            commands[id].lastState = state.val;
                            sendMessage(getStatus(id, state));
                        }
                    } else {
                        sendMessage(getStatus(id, state));
                    }
                }
            }
        }
    });

    adapter.on('objectChange', (id, obj) => {
        if (obj && obj.common && obj.common.custom &&
            obj.common.custom[adapter.namespace] && obj.common.custom[adapter.namespace].enabled
        ) {
            const alias = getName(obj);
            if (!commands[id]) {
                adapter.log.info(`enabled logging of ${id}, Alias=${alias}`);
                setImmediate(() => adapter.subscribeForeignStates(id));
            }
            commands[id]        = obj.common.custom[adapter.namespace];
            commands[id].type   = obj.common.type;
            commands[id].states = parseStates(obj.common.states);
            commands[id].unit   = obj.common && obj.common.unit;
            commands[id].min    = obj.common && obj.common.min;
            commands[id].max    = obj.common && obj.common.max;
            commands[id].alias  = alias;
             // read actual state to detect changes
            if (commands[id].reportChanges) {
                adapter.getForeignStateAsync(id)
                    .then(state => commands[id].lastState = state ? state.val : undefined);
            }
        } else if (commands[id]) {
            adapter.log.debug(`Removed command: ${id}`);
            delete commands[id];
            setImmediate(() => adapter.unsubscribeForeignStates(id));
        } else if (id.startsWith('enum.rooms') && adapter.config.rooms) {
            if (obj && obj.common && obj.common.members && obj.common.members.length) {
                enums.rooms[id] = obj.common;
            } else if (enums.rooms[id]) {
                delete enums.rooms[id];
            }
        }
    });

    server.settings = adapter.config;

    tmpDirName = path.join(utils.getAbsoluteDefaultDataDir(), adapter.namespace.replace('.', '_'));
    try {
        !fs.existsSync(tmpDirName) && fs.mkdirSync(tmpDirName);
    } catch (e) {
        adapter.log.error(`Cannot create tmp directory: ${tmpDirName}`);
    }

    return adapter;
}

function sendSystemMessage(text) {
    const _users = Object.keys(users)
        .filter(id => users[id].sysMessages !== false)
        .map(id => adapter.config.useUsername ? users[id].userName : users[id].firstName);

    sendMessage(text, _users, null, {disable_notification: true});
}

function getStatus(id, state) {
    if (!state) {
        state = {val: 'State not set'};
    }
    if (commands[id].type === 'boolean') {
        return `${commands[id].alias} => ${state.val ? commands[id].onStatus || _('ON-Status') : commands[id].offStatus || _('OFF-Status')}`;
    } else {
        if (commands[id].states && commands[id].states[state.val] !== undefined) {
            state.val = commands[id].states[state.val];
        }
        return `${commands[id].alias} => ${state.val}`;
    }
}

function connectionState(connected, logSuccess) {
    let errorCounter = 0;

    function checkConnection() {
        pollConnectionStatus = null;
        bot && bot.getMe && bot.getMe()
            .then(data => {
                adapter.log.debug(`getMe (reconnect): ${JSON.stringify(data)}`);
                connectionState(true, errorCounter > 0);
            })
            .catch(error => {
                (errorCounter % 10 === 0) && adapter.log.error(`getMe (reconnect #${errorCounter}) Error:${error}`);
                errorCounter++;
                pollConnectionStatus && clearTimeout(pollConnectionStatus);
                pollConnectionStatus = setTimeout(checkConnection, 1000);
            });
    }

    if (connected && logSuccess) {
        adapter.log.info('getMe (reconnect): Success');
    }
    if (isConnected !== connected) {
        isConnected = connected;
        adapter.setState('info.connection', isConnected, true);
        if (isConnected && pollConnectionStatus) {
            clearTimeout(pollConnectionStatus);
            pollConnectionStatus = null;
        } else if (!isConnected) {
            checkConnection();
        }
    }
}

function parseStates(states) {
    // todo
    return states;
}

function getName(obj) {
    if (obj.common.custom[adapter.namespace].alias) {
        return obj.common.custom[adapter.namespace].alias;
    } else {
        let name = obj.common.name;
        if (typeof name === 'object') {
            name = name[systemLang] || name.en;
        }
        return name || obj._id;
    }
}

const actions = [
    'typing', 'upload_photo', 'upload_video', 'record_video', 'record_audio', 'upload_document', 'find_location'
];

function handleWebHook(req, res) {
    if (req.method === 'POST' && req.url === `/${adapter.config.token}`) {
        //
        //{
        //    "update_id":10000,
        //    "message":{
        //       "date":1441645532,
        //       "chat":{
        //           "last_name":"Test Lastname",
        //           "id":1111111,
        //           "first_name":"Test",
        //           "username":"Test"
        //       },
        //       "message_id":1365,
        //       "from": {
        //           "last_name":"Test Lastname",
        //           "id":1111111,
        //           "first_name":"Test",
        //           "username":"Test"
        //       },
        //       "text":"/start"
        //    }
        //}
        let body = '';
        req.on('data', data => {
            body += data;
            if (body.length > 100000) {
                res.writeHead(413, 'Request Entity Too Large', {
                    'Content-Type': 'text/html'
                });
                res.end('<!doctype html><html><head><title>413</title></head><body>413: Request Entity Too Large</body></html>');
            }
        });
        req.on('end', () => {
            let msg;
            try {
                msg = JSON.parse(body);
            } catch (e) {
                adapter.log.error(`Cannot parse webhook response!: ${e}`);
                return;
            }
            res.end('OK');
            bot.processUpdate(msg);
        });
    } else {
        res.writeHead(404, 'Resource Not Found', {
            'Content-Type': 'text/html'
        });
        res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>');
    }
}

function saveSendRequest(msg) {
    adapter.log.debug(`Request: ${JSON.stringify(msg)}`);

    if (msg && adapter.config.storeRawRequest) {
        adapter.setState('communicate.botSendRaw', JSON.stringify(msg), true, err =>
            err && adapter.log.error(err));
    }

    if (msg && msg.message_id) {
        adapter.setState('communicate.botSendMessageId', msg.message_id, true, err =>
            err && adapter.log.error(err));
    }

    if (msg && msg.chat && msg.chat.id) {
        adapter.setState('communicate.botSendChatId', msg.chat.id.toString(), true, err =>
            err && adapter.log.error(err));
    }
}

function _sendMessageHelper(dest, name, text, options) {
    return new Promise((resolve, reject) => {
        let count = 0;
        if (options && options.chatId !== undefined && options.user === undefined) {
            options.user = adapter.config.useUsername ? users[options.chatId].userName : users[options.chatId].firstName;
        }

        if (options && options.editMessageReplyMarkup !== undefined) {
            adapter.log.debug(`Send editMessageReplyMarkup to "${name}"`);
            bot && bot.editMessageReplyMarkup(options.editMessageReplyMarkup.reply_markup, options.editMessageReplyMarkup.options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send editMessageReplyMarkup [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send editMessageReplyMarkup [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (options && options.editMessageText !== undefined) {
            adapter.log.debug(`Send editMessageText to "${name}"`);
            bot && bot.editMessageText(text, options.editMessageText.options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send editMessageText [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send editMessageText [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (options && options.editMessageMedia !== undefined) {
            adapter.log.debug(`Send editMessageMedia to "${name}"`);
            if (text) {
                let mediaInput;
                if ((typeof text === 'string' && text.match(/\.(jpg|png|jpeg|bmp|gif)$/i) && (fs.existsSync(text) || text.match(/^(https|http)/i))) || (options && options.type === 'photo')) {
                    mediaInput = {
                        type: 'photo',
                        media: text
                    };
                } else
                if ((typeof text === 'string' && text.match(/\.(gif)/i) && fs.existsSync(text)) || (options && options.type === 'animation')) {
                    mediaInput = {
                        type: 'animation',
                        media: text
                    };
                } else
                if ((typeof text === 'string' && text.match(/\.(mp4)$/i) && fs.existsSync(text)) || (options && options.type === 'video')) {
                    mediaInput = {
                        type: 'video',
                        media: text
                    };
                } else
                if ((typeof text === 'string' && text.match(/\.(wav|mp3|ogg)$/i) && fs.existsSync(text)) || (options && options.type === 'audio')) {
                    mediaInput = {
                        type: 'audio',
                        media: text
                    };
                } else
                if ((typeof text === 'string' && text.match(/\.(txt|doc|docx|csv|pdf|xls|xlsx)$/i) && fs.existsSync(text)) || (options && options.type === 'document')) {
                    mediaInput = {
                        type: 'document',
                        media: text
                    };
                }

                if (mediaInput) {
                    const opts = {
                        qs:  options.editMessageMedia.options,
                    };
                    opts.formData = {};

                    const payload = Object.assign({}, mediaInput);

                    delete payload.media;
                    delete payload.fileOptions;

                    try {
                        const attachName = String(0);
                        const [formData, fileId] = bot._formatSendData(attachName, mediaInput.media, mediaInput.fileOptions);
                        if (formData) {
                            opts.formData[attachName] = formData[attachName];
                            payload.media = `attach://${attachName}`;
                        } else {
                            payload.media = fileId;
                        }
                    } catch (ex) {
                        return Promise.reject(ex);
                    }

                    opts.qs.media = JSON.stringify(payload);
                    bot && bot._request('editMessageMedia', opts)
                        .then(response => saveSendRequest(response))
                        .then(() => {
                            options = null;
                            count++;
                            resolve(count);
                        })
                        .catch(error => {
                            if (options.chatId) {
                                adapter.log.error(`Cannot send editMessageMedia [chatId - ${options.chatId}]: ${error}`);
                            } else {
                                adapter.log.error(`Cannot send editMessageMedia [user - ${options.user}]: ${error}`);
                            }
                            options = null;
                            resolve(count);
                        });
                } else {
                    adapter.log.error(`Cannot send editMessageMedia [chatId - ${options.chatId}]: unsupported media type`);
                    options = null;
                    resolve(count);
                }
            } else {
                adapter.log.error(`Cannot send editMessageMedia [chatId - ${options.chatId}]: no media found. "text" may not be empty`);
                options = null;
                resolve(count);
            }
        } else if (options && options.editMessageCaption !== undefined) {
            adapter.log.debug(`Send editMessageCaption to "${name}"`);
            bot && bot.editMessageCaption(text, options.editMessageCaption.options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send editMessageCaption [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send editMessageCaption [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (options && options.deleteMessage !== undefined) {
            adapter.log.debug(`Send deleteMessage to "${name}"`);
            bot && bot.deleteMessage(options.deleteMessage.options.chat_id, options.deleteMessage.options.message_id)
                .then(response => saveSendRequest(response))
                .then(() => {
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send deleteMessage [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send deleteMessage [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else
        if (options && options.latitude !== undefined) {
            adapter.log.debug(`Send location to "${name}": ${text}`);
            if (bot) {
                bot.sendLocation(dest, parseFloat(options.latitude), parseFloat(options.longitude), options)
                    .then(response => saveSendRequest(response))
                    .then(() => {
                        adapter.log.debug('Location sent');
                        options = null;
                        count++;
                        resolve(count);
                    })
                    .catch(error => {
                        if (options.chatId) {
                            adapter.log.error(`Cannot send location [chatId - ${options.chatId}]: ${error}`);
                        } else {
                            adapter.log.error(`Cannot send location [user - ${options.user}]: ${error}`);
                        }
                        options = null;
                        reject(error);
                    });
            }
        } else if (options && options.type === 'mediagroup') {
            adapter.log.debug(`Send media group to "${name}": `);
            if (bot) {
                const {media: fileNames} = options;
                if (fileNames instanceof Array) {
                    bot.sendChatAction(dest, 'upload_photo')
                        .then(param => {
                            if (fileNames.every(name => fs.existsSync(name))) {
                                const filesAsArray = fileNames
                                    .map(element => {
                                        try {
                                            return {type: 'photo', media: fs.readFileSync(element)}
                                        } catch (error) {
                                            adapter.log.error(`Cannot read file${element}`);
                                            return undefined;
                                        }
                                    })
                                    .filter(element => element !== undefined);

                                const size = filesAsArray
                                    .map(element => element.media.length)
                                    .reduce((acc, val) => acc + val);

                                adapter.log.info(`Send media group to "${name}": ${size} bytes`);
                                if (filesAsArray.length > 0) {
                                    bot.sendMediaGroup(dest, filesAsArray)
                                        .then((response) => saveSendRequest(response))
                                        .then(() => {
                                            adapter.log.debug('photos sent');
                                            count++;
                                            resolve(count);
                                            options = null;
                                        })
                                        .catch(error => {
                                            if (options.chatId) {
                                                adapter.log.error(`Cannot send media group [chatId - ${options.chatId}]: ${error}`);
                                            } else {
                                                adapter.log.error(`Cannot send media group [user - ${options.user}]: ${error}`);
                                            }
                                            options = null;
                                            resolve(count);
                                        });
                                }
                            } else {
                                adapter.log.debug('files must exists');
                                options = null;
                                resolve(count);
                            }
                        })
                        .catch(error => {
                            adapter.log.error(`upload Error:${error}`);
                        });
                } else {
                    adapter.log.debug('option media should be an array');
                    resolve(count);
                }
            } else {
                adapter.log.debug('no files added!');
                options = null;
                resolve(count);
            }
        } else if (text && typeof text === 'string' && actions.includes(text)) {
            adapter.log.debug(`Send action to "${name}": ${text}`);
            bot && bot.sendChatAction(dest, text)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Action sent');
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send action [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send action [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (text && ((typeof text === 'string' && text.match(/\.webp$/i) && fs.existsSync(text)) || (options && options.type === 'sticker'))) {
            if (typeof text === 'string') {
                adapter.log.debug(`Send sticker to "${name}": ${text}`);
            } else {
                adapter.log.debug(`Send sticker to "${name}": ${text.length} bytes`);
            }
            bot && bot.sendSticker(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Sticker sent');
                    count++;
                    resolve(count);
                    options = null;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send sticker [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send sticker [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (text && ((typeof text === 'string' && text.match(/\.(gif)/i) && fs.existsSync(text)) || (options && options.type === 'animation'))) {
            if (typeof text === 'string') {
                adapter.log.debug(`Send animation to "${name}": ${text}`);
            } else {
                adapter.log.debug(`Send animation to "${name}": ${text.length} bytes`);
            }
            bot && bot.sendAnimation(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('animation sent');
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send animation [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send animation [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (text && ((typeof text === 'string' && text.match(/\.(mp4)$/i) && fs.existsSync(text)) || (options && options.type === 'video'))) {
            if (typeof text === 'string') {
                adapter.log.debug(`Send video to "${name}": ${text}`);
            } else {
                adapter.log.debug(`Send video to "${name}": ${text.length} bytes`);
            }
            bot && bot.sendVideo(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Video sent');
                    count++;
                    resolve(count);
                    options = null;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send video [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send video [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (text && ((typeof text === 'string' && text.match(/\.(txt|doc|docx|csv|pdf|xls|xlsx)$/i) && fs.existsSync(text)) || (options && options.type === 'document'))) {
            if (typeof text === 'string') {
                adapter.log.debug(`Send document to "${name}": ${text}`);
            } else {
                adapter.log.debug(`Send document to "${name}": ${text.length} bytes`);
            }
            bot && bot.sendDocument(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Document sent');
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send document [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send document [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (text && ((typeof text === 'string' && text.match(/\.(wav|mp3|ogg)$/i) && fs.existsSync(text)) || (options && options.type === 'audio'))) {
            if (typeof text === 'string') {
                adapter.log.debug(`Send audio to "${name}": ${text}`);
            } else {
                adapter.log.debug(`Send audio to "${name}": ${text.length} bytes`);
            }
            bot && bot.sendAudio(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Audio sent');
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send audio [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send audio [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (text && ((typeof text === 'string' && text.match(/\.(jpg|png|jpeg|bmp|gif)$/i) && (fs.existsSync(text) || text.match(/^(https|http)/i))) || (options && options.type === 'photo'))) {
            if (typeof text === 'string') {
                adapter.log.debug(`Send photo to "${name}": ${text}`);
            } else {
                adapter.log.debug(`Send photo to "${name}": ${text.length} bytes`);
            }
            bot && bot.sendPhoto(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Photo sent');
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error(`Cannot send photo [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send photo [user - ${options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });
        } else if (options && options.answerCallbackQuery !== undefined) {
            adapter.log.debug(`Send answerCallbackQuery to "${name}"`);
            if (options.answerCallbackQuery.showAlert === undefined) {
                options.answerCallbackQuery.showAlert = false;
            }
            if (bot && callbackQueryId[options.chatId]) {
                const originalChatId = callbackQueryId[options.chatId].id;
                delete callbackQueryId[options.chatId];
                bot.answerCallbackQuery(originalChatId, options.answerCallbackQuery.text, options.answerCallbackQuery.showAlert)
                    .then(() => {
                        options = null;
                        count++;
                        resolve(count);
                    })
                    .catch(error => {
                        if (options.chatId) {
                            adapter.log.error(`Cannot send answerCallbackQuery [chatId - ${options.chatId}]: ${error}`);
                        } else {
                            adapter.log.error(`Cannot send answerCallbackQuery [user - ${options.user}]: ${error}`);
                        }
                        options = null;
                        resolve(count);
                    });
            }
        } else {
            adapter.log.debug(`Send message to [${name}]: "${text}"`);
            if (text && typeof text === 'string') {
                if (text.startsWith('<MarkdownV2>') && text.endsWith('</MarkdownV2>')) {
                    options = options || {};
                    options.parse_mode = 'MarkdownV2';
                    text = text.substring(12, text.length - 13);
                } else if (text.startsWith('<HTML>') && text.endsWith('</HTML>')) {
                    options = options || {};
                    options.parse_mode = 'HTML';
                    text = text.substring(6, text.length - 7);
                } else if (text.startsWith('<Markdown>') && text.endsWith('</Markdown>')) {
                    options = options || {};
                    options.parse_mode = 'Markdown';
                    text = text.substring(10, text.length - 11);
                }
            }

            bot && bot.sendMessage(dest, text || '', options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Message sent');
                    options = null;
                    count++;
                    resolve(count);
                })
                .catch(error => {
                    if (options && options.chatId) {
                        adapter.log.error(`Cannot send message [chatId - ${options.chatId}]: ${error}`);
                    } else {
                        adapter.log.error(`Cannot send message [user - ${options && options.user}]: ${error}`);
                    }
                    options = null;
                    resolve(count);
                });

        }
    });
}

function sendMessage(text, user, chatId, options) {
    if (!text && typeof options !== 'object' && text !== 0 && (!options || !options.latitude)) {
       adapter.log.warn('Invalid text: null');
       return Promise.resolve(0);
    }

    if (text && typeof text === 'object' && text.text !== undefined && typeof text.text === 'string' && options === undefined) {
        options = text;
        text = options.text;
        if (options.chatId) {
            chatId = options.chatId;
        }
        if (options.user) {
            user = options.user;
        }
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

    options = options || {};

    if (text && typeof text === 'string') {
        if (text && text.startsWith('<MarkdownV2>') && text.endsWith('</MarkdownV2>')) {
            options.parse_mode = 'MarkdownV2';
            text = text.substring(12, text.length - 13);
        } else
        if (text && text.startsWith('<HTML>') && text.endsWith('</HTML>')) {
            options.parse_mode = 'HTML';
            text = text.substring(6, text.length - 7);
        } else
        if (text && text.startsWith('<Markdown>') && text.endsWith('</Markdown>')) {
            options.parse_mode = 'Markdown';
            text = text.substring(10, text.length - 11);
        }
    }

    let tPromiseList = [];
    // convert
    if (text !== undefined && text !== null && typeof text !== 'object') {
        text = text.toString();
    }
    if (chatId) {
        tPromiseList.push(_sendMessageHelper(chatId, 'chat', text, options));
        return Promise.all(tPromiseList)
            .then(results =>
                results.reduce((e, acc) => acc + e, 0))
            .catch(e => e);
    } else if (user) {
        if (typeof user !== 'string' && !(user instanceof Array)) {
            adapter.log.warn(`Invalid type of user parameter: ${typeof user}. Expected is string or array.`);
        }

        const userArray = user instanceof Array ? user : (user || '').toString().split(',').map(build => build.trim());
        let matches = 0;
        userArray.forEach(userName => {
            for (const id in users) {
                if (!users.hasOwnProperty(id)) {
                    continue;
                }

                if ((adapter.config.useUsername && users[id].userName  === userName) ||
                   (!adapter.config.useUsername && users[id].firstName === userName)) {
                    if (options) {
                        options.chatId = id;
                    }
                    matches++;
                    tPromiseList.push(_sendMessageHelper(id, userName, text, options));
                    break;
                }
            }
        });

        if (userArray.length !== matches) {
            adapter.log.warn(`${userArray.length - matches} of ${userArray.length} recipients are unknown!`);
        }

        return Promise.all(tPromiseList)
            .then(results => results.reduce((e, acc) => acc + e, 0))
            .catch(e => e);
    }

    const m = typeof text === 'string' ? text.match(/^@(.+?)\b/) : null;

    if (m) {
        text = (text || '').toString();
        text = text.replace(`@${m[1]}`, '').trim().replace(/\s\s/g, ' ');
        const re = new RegExp(m[1], 'i');
        let id = '';
        for (const id_t in users) {
            if (!users.hasOwnProperty(id_t)) {
                continue;
            }
            if ((adapter.config.useUsername && users[id_t].userName.match(re)) || (!adapter.config.useUsername && users[id_t].firstName.match(re))) {
                id = id_t
                break;
            }
        }
        if (id) {
            if (options) {
                options.chatId = id;
            }
            tPromiseList.push(_sendMessageHelper(id, m[1], text, options));
        }
    } else {
        // Send to all users
        Object.keys(users).forEach(id => {
            if (options) {
                options.chatId = id;
            }
            tPromiseList.push(_sendMessageHelper(id, adapter.config.useUsername ? users[id].userName : users[id].firstName, text, options));
        });
    }

    return Promise.all(tPromiseList)
        .then(results =>
            results.reduce((e, acc) => acc + e, 0))
        .catch(e => -1);
}

function saveFile(fileID, fileName, callback) {
    bot.getFileLink(fileID)
        .then(url => {
            adapter.log.debug(`Received message: ${url}`);
            https.get(url, res => {
                if (res.statusCode === 200) {
                    const buf = [];
                    res.on('data', data => buf.push(data));
                    res.on('end', () => {
                        const fileLocation = path.join(tmpDirName, fileName);
                        try {
                            fs.writeFileSync(fileLocation, Buffer.concat(buf));
                        } catch (err) {
                            return callback({error: `Error: ${err}`});
                        }

                        callback({
                            info: `It's saved! : ${fileLocation}`,
                            path: fileLocation
                        });
                    });

                    res.on('error', err =>
                        callback({error: `Error: ${err}`}));
                } else {
                    callback({error: 'Error: statusCode !== 200'});
                }
            });
        })
        .catch(err => callback({error: `Error bot.getFileLink: ${err}`}));
}

function getMessage(msg) {
    const date = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    adapter.log.debug(`Received message: ${JSON.stringify(msg)}`);

    if (msg.voice) {
        try {
            const voiceFile = path.join(tmpDirName, 'voice');
            !fs.existsSync(voiceFile) && fs.mkdirSync(voiceFile);
            saveFile(msg.voice.file_id, adapter.config.saveFiles ? `/voice/${date}.ogg` : '/voice/temp.ogg', res => {
                if (!res.error) {
                    adapter.log.info(res.info);
                    adapter.setState('communicate.pathFile', res.path, true, err => err && adapter.log.error(err));
                } else {
                    adapter.log.debug(res.error);
                }
            })
        } catch (err) {
            adapter.log.error(`Error saving voice file: ${err}`);
        }
    } else if (adapter.config.saveFiles && msg.photo) {
        try {
            const photoFile = path.join(tmpDirName, 'photo');
            !fs.existsSync(photoFile) && fs.mkdirSync(photoFile);

            const qualityMap = {
                0: 'low',
                1: 'med',
                2: 'high',
                3: 'highdef'
            };

            let saveOnlyQuality = adapter.config.saveFilesQuality;
            if (saveOnlyQuality) {
                saveOnlyQuality = parseInt(saveOnlyQuality, 10);
                if (msg.photo.length <= saveOnlyQuality) {
                    saveOnlyQuality = null;
                } else {
                    saveOnlyQuality = saveOnlyQuality.toString();
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
                    if (!mediaGroupExport.hasOwnProperty(msg.media_group_id)) {
                        const id = Object.keys(mediaGroupExport).length;
                        mediaGroupExport[msg.media_group_id] = {
                            id,
                            count: 0
                        };
                    } else {
                        mediaGroupExport[msg.media_group_id].count++;
                    }
                    fileName = `/photo/${date}_grpID_${mediaGroupExport[msg.media_group_id].id}_${mediaGroupExport[msg.media_group_id].count}_${quality}.jpg`;
                } else {
                    fileName = `/photo/${date}_${quality}.jpg`;
                    if (fs.existsSync(path.join(tmpDirName, fileName))) {
                        let tIdx = 0;
                        do {
                            fileName = `/photo/${date}_${tIdx}_${quality}.jpg`;
                            tIdx++;
                        } while (fs.existsSync(path.join(tmpDirName, fileName)));
                    }
                }

                saveFile(item.file_id, fileName, res => {
                    if (!res.error) {
                        adapter.log.info(res.info);
                        adapter.setState('communicate.pathFile', res.path, true, err => err && adapter.log.error(err));
                    } else {
                        adapter.log.debug(res.error);
                    }
                });
            });
        } catch (err) {
            adapter.log.error(`Error saving photo file: ${err}`);
        }
    } else if (adapter.config.saveFiles && msg.video) {
        try {
            const videoFile = path.join(tmpDirName, 'video');
            !fs.existsSync(videoFile) && fs.mkdirSync(videoFile);
            saveFile(msg.video.file_id, `/video/${date}.mp4`, res => {
                if (!res.error) {
                    adapter.log.info(res.info);
                    adapter.setState('communicate.pathFile', res.path, true, err => err && adapter.log.error(err));
                } else {
                    adapter.log.debug(res.error);
                }
            });
        } catch (err) {
            adapter.log.error(`Error saving video file: ${err}`);
        }
    } else if (adapter.config.saveFiles && msg.audio) {
        try {
            const audioFile = path.join(tmpDirName, 'audio');
            !fs.existsSync(audioFile) && fs.mkdirSync(audioFile);
            saveFile(msg.audio.file_id, `/audio/${date}.mp3`, res => {
                if (!res.error) {
                    adapter.log.info(res.info);
                    adapter.setState('communicate.pathFile', res.path, true, err => err && adapter.log.error(err));
                } else {
                    adapter.log.debug(res.error);
                }
            });
        } catch (err) {
            adapter.log.error(`Error saving audio file: ${err}`);
        }
    } else if (adapter.config.saveFiles && msg.document) {
        try {
            const documentFile = path.join(tmpDirName, 'document');
            !fs.existsSync(documentFile) && fs.mkdirSync(documentFile);
            saveFile(msg.document.file_id, `/document/${msg.document.file_name}`, res => {
                if (!res.error) {
                    adapter.log.info(res.info);
                    adapter.setState('communicate.pathFile', res.path, true, err => err && adapter.log.error(err));
                } else {
                    adapter.log.debug(res.error);
                }
            });
        } catch (err) {
            adapter.log.error(`Error saving document file: ${err}`);
        }
    }
}

function processMessage(obj) {
    if (!obj || !obj.command) {
        return;
    }
    // Ignore own answers
    if (obj.message && obj.message.response) {
        return;
    }

    // filter out the double messages
    const json = JSON.stringify(obj);
    if (lastMessageTime && lastMessageText === JSON.stringify(obj) && Date.now() - lastMessageTime < 1200) {
        return adapter.log.debug(`Filter out double message [first was for ${Date.now() - lastMessageTime}ms]: ${json}`);
    }

    lastMessageTime = Date.now();
    lastMessageText = json;

    adapter.log.debug(`Received command "${obj.command}": ${JSON.stringify(obj.message)}`);

    switch (obj.command) {
        case 'send':
            if (obj.message) {
                let tPromise;
                if (typeof obj.message === 'object') {
                    tPromise = sendMessage(obj.message.text, obj.message.user, obj.message.chatId, obj.message);
                } else {
                    tPromise = sendMessage(obj.message);
                }

                tPromise
                    .then(count => obj.callback && adapter.sendTo(obj.from, obj.command, count, obj.callback))
                    .catch(e => adapter.log.error(`Cannot send command: ${e}`));
            }
            break;

        case 'ask':
            if (obj.message) {
                const question = {
                    cb:   obj.callback,
                    from: obj.from,
                    ts:   Date.now(),
                };
                if (typeof obj.message === 'object') {
                    sendMessage(obj.message.text, obj.message.user, obj.message.chatId, obj.message);
                    question.chatId = obj.message.chatId;
                    question.user = obj.message.user;
                } else {
                    sendMessage(obj.message);
                }

                if (obj.callback) {
                    adapter._questions.push(question);

                    question.timeout = setTimeout(q => {
                        q.timeout = null;
                        adapter.sendTo(q.from, 'ask', '__timeout__', q.callback);

                        const pos = adapter._questions.indexOf(q);
                        pos !== -1 && adapter._questions.splice(pos);
                    }, adapter.config.answerTimeoutSec + 1000, question);
                }
            }
            break;

        case 'call':
            if (obj.message) {
                let call = {};
                if (typeof obj.message === 'object') {
                    call = obj.message;
                } else {
                    call.message = obj.message;
                }

                if (call.users && call.user) {
                    adapter.log.error(`Please provide only user or users as array. Attribute user will be ignored!`);
                }
                if (!call.users && call.user) {
                    call.users = [call.user];
                }
                if (!call.users && !call.user) {
                    call.users = Object.keys(users)
                        .filter(id => users[id] && users[id].userName)
                        .map(id => users[id].userName.startsWith('@') ? users[id].userName : (`@${users[id].userName}`));
                }
                if (!(call.users instanceof Array)) {
                    call.users = [call.users];
                }
                // set language
                call.lang = call.lang || systemLang2CallMe[systemLang] || systemLang2CallMe.en;
                if (!call.file) {
                    // Set message
                    call.message = call.message || call.text || _('Call text', call.lang || systemLang);
                } else {
                    call.message = '';
                }

                //
                if (!call.users || !call.users.length) {
                    adapter.log.error(`Cannot make a call, because no users stored in ${adapter.namespace}.communicate.users`);
                } else {
                    callUsers(call.users, call.message, call.lang, call.file, call.repeats);
                }
            }
            break;
    }
}

function callUsers(users, text, lang, file, repeats, cb) {
    if (!users || !users.length) {
        cb && cb();
    } else {
        let user = users.shift();
        if (!user.startsWith('@') && !user.startsWith('+') && !user.startsWith('00')) {
            user = `@${user}`;
        }

        let url = 'http://api.callmebot.com/start.php?source=iobroker&';
        const params = [`user=${encodeURIComponent(user)}`];
        if (file) {
            params.push(`file=${encodeURIComponent(file)}`);
        } else {
            params.push(`text=${encodeURIComponent(text)}`);
        }
        if (repeats !== undefined) {
            params.push(`rpt=${parseInt(repeats, 10) || 0}`);
        }

        params.push(`lang=${lang || systemLang2CallMe[systemLang]}`);
        url += params.join('&');
        adapter.log.debug(`CALL: ${url}`);

        axios.get(url)
            .then(response => {
                const body = response && response.data;
                if (!body || !response || response.status !== 200) {
                    adapter.log.error(`Cannot make a call to ${user}: ${body || (response && response.status) || 'Unknown error'}`);
                } else {
                    adapter.log.debug(`Call to ${user} was made: ${body.substring(body.indexOf('<p>')).replace(/<p>/g, ' ')}`);
                }
                setImmediate(callUsers, users, text, lang, file, repeats, cb);
            })
            .catch(err => {
                adapter.log.error(`Cannot make a call to ${user}: ${err || 'Unknown error'}`);
                setImmediate(callUsers, users, text, lang, file, repeats, cb);
            });
    }
}

function storeUser(id, firstName, userName) {
    if (!users[id] || users[id].firstName !== firstName || users[id].userName !== userName) {
        Object.keys(users).forEach(id => {
            if (userName && users[id].userName === userName) {
                delete users[id];
            }
            if (!userName && !users[id].userName && users[id].firstName === firstName) {
                delete users[id];
            }
        });

        users[id] = {firstName, userName, sysMessages: false};

        if (adapter.config.rememberUsers) {
            adapter.setState('communicate.users', JSON.stringify(users), true);
        }
    }
}

function getListOfCommands() {
    const ids = Object.keys(commands).sort((a, b) => commands[b].alias - commands[a].alias);
    const lines = [];

    ids.forEach(id => {
        if (!commands[id].readOnly) {
            if (commands[id].type === 'boolean') {
                if (commands[id].writeOnly) {
                    lines.push(`${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}|${commands[id].offCommand || _('OFF-Command')}`);
                } else {
                    lines.push(`${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}|${commands[id].offCommand || _('OFF-Command')}|?`);
                }
            } else {
                if (commands[id].writeOnly) {
                    lines.push(`${commands[id].alias} ${_(`value as ${commands[id].type}`)}`);
                } else {
                    lines.push(`${commands[id].alias} ${_(`value as ${commands[id].type}`)}|?`);
                }
            }
        }
    });

    if (!lines.length) {
        lines.push(_('No commands found.'));
    }

    return lines.join('\n');
}

function getCommandsKeyboard(chatId) {
    const ids = Object.keys(commands).sort((a, b) => commands[b].alias - commands[a].alias);
    const keyboard = [];

    ids.forEach(id => {
        if (!commands[id].readOnly) {
            if (commands[id].type === 'boolean') {
                if (commands[id].onlyTrue) {
                    if (commands[id].buttons === 1) {
                        keyboard.push([`${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}`]);
                        !commands[id].writeOnly && keyboard.push([`${commands[id].alias} ?`]);
                    } else {
                        commands[id].writeOnly ?
                            keyboard.push([
                                `${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}`
                            ]) :
                            keyboard.push([
                                `${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}`,
                                `${commands[id].alias} ?`
                            ]);
                    }
                } else {
                    if (commands[id].buttons === 1) {
                        keyboard.push([`${commands[id].alias} ${commands[id].onCommand  || _('ON-Command')}`,]);
                        keyboard.push([`${commands[id].alias} ${commands[id].offCommand || _('OFF-Command')}`,]);
                        !commands[id].writeOnly && keyboard.push([`${commands[id].alias} ?`]);
                    } else if (commands[id].buttons === 2) {
                        keyboard.push([
                            `${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}`,
                            `${commands[id].alias} ${commands[id].offCommand || _('OFF-Command')}`,
                        ]);
                        !commands[id].writeOnly && keyboard.push([`${commands[id].alias} ?`]);
                    } else {
                        commands[id].writeOnly ?
                            keyboard.push([
                                `${commands[id].alias} ${commands[id].onCommand  || _('ON-Command')}`,
                                `${commands[id].alias} ${commands[id].offCommand || _('OFF-Command')}`
                            ]) :
                            keyboard.push([
                                `${commands[id].alias} ${commands[id].onCommand  || _('ON-Command')}`,
                                `${commands[id].alias} ${commands[id].offCommand || _('OFF-Command')}`,
                                `${commands[id].alias} ?`
                            ]);
                    }
                }
            } else if (commands[id].states) {
                let s = [];
                const stat = Object.keys(commands[id].states);
                for (let i = 0; i <= stat.length; i++) {
                    s.push(`${commands[id].alias} ${commands[id].states[stat[i]]}`);
                    if (s.length >= (commands[id].buttons || 3)) {
                        keyboard.push(s);
                        s = [];
                    }
                }
                !commands[id].writeOnly && s.push(`${commands[id].alias} ?`);
                keyboard.push(s);
            } else if (commands[id].type === 'number' && commands[id].unit === '%') {
                let s = [];
                const step = ((commands[id].max || 100) - (commands[id].min || 0)) / 4;
                for (let i = commands[id].min || 0; i <= (commands[id].max || 100); i += step) {
                    s.push(`${commands[id].alias} ${i}%`);
                    if (s.length >= (commands[id].buttons || 3)) {
                        keyboard.push(s);
                        s = [];
                    }
                }
                !commands[id].writeOnly && s.push(`${commands[id].alias} ?`);
                keyboard.push(s);
            } else {
                adapter.log.warn(`Unsupported state type for keyboard: ${commands[id].type}. Only numbers and booleans are supported`);
            }
        } else {
            keyboard.push([`${commands[id].alias} ?`]);
        }
    });

    bot.sendMessage(chatId, _('Select option'), {
        reply_markup: {
            keyboard,
            resize_keyboard: true,
            one_time_keyboard: true
        },
        chatId
    })
        .then(response => {
            adapter.log.debug('Message sent');
        })
        .catch(error => {
            adapter.log.error(`Send message error: ${error}`);
        });
}

function isAnswerForQuestion(adapter, msg) {
    if (adapter._questions && adapter._questions.length) {
        const now = Date.now();
        const chatId = msg.chat && msg.chat.id;
        let question = chatId && adapter._questions.find(q => q.chatId === chatId && q.user === msg.from.id && now - q.ts < adapter.config.answerTimeoutSec);
        question = question || (chatId && adapter._questions.find(q => q.chatId === chatId && now - q.ts < adapter.config.answerTimeoutSec));
        question = question || adapter._questions.find(q => now - q.ts < adapter.config.answerTimeoutSec);

        // user have 60 seconds for answer
        if (question && Date.now() - question.ts < adapter.config.answerTimeoutSec) {
            if (question.timeout) {
                clearTimeout(question.timeout);
                question.timeout = null;
                adapter.sendTo(question.from, 'ask', msg, question.cb);
            }
            adapter._questions.splice(adapter._questions.indexOf(question), 1);
        }

        // remove old questions
        adapter._questions = adapter._questions.filter(q => now - q.ts < adapter.config.answerTimeoutSec);
    }
}

function garbageCollector() {
    const now = Date.now() - 5 * 60000; // last 5 minutes

    Object.keys(protection)
        .forEach(user => {
            let a;
            for (a = 0; a < protection[user].length; a++) {
                // find first entry newer than 5 minutes
                if (protection[user][a] > now) {
                    break;
                }
            }
            // remove all old entries
            if (a < protection[user].length && a) {
                protection[user].splice(0, a);
            }
            if (!protection[user].length) {
                delete protection[user];
            }
        });

    if (!Object.keys(protection).length) {
        gcInterval && clearInterval(gcInterval);
        gcInterval = null;
    }
}

function processTelegramText(msg) {
    connectionState(true);

    // see https://core.telegram.org/bots/api#message
    adapter.log.debug(JSON.stringify(msg));

    const user = !adapter.config.useUsername ? msg.from.first_name : (!msg.from.username ? msg.from.first_name : msg.from.username);

    const now = Date.now();
    let pollingInterval = 0;
    if (adapter.config && adapter.config.pollingInterval !== undefined) {
        pollingInterval = parseInt(adapter.config.pollingInterval, 10) || 0;
    }

    // ignore all messages older than 30 seconds + polling interval
    if (now - msg.date * 1000 > pollingInterval + 30000) {
        adapter.log.warn(`Message from ${msg.from.name} ignored, because too old: (${pollingInterval + 30000}) ${msg.text}`);
        return bot.sendMessage(msg.from.id, _('Message ignored: ', systemLang) + msg.text)
            .catch(error => adapter.log.error(`send Message Error: ${error}`));

    }

    msg.text = (msg.text ||'').trim();

    // sometimes telegram sends messages like "message@user_name"
    const pos = msg.text.lastIndexOf('@');
    if (pos !== -1) {
        msg.text = msg.text.substring(0, pos);
    }

    if (msg.text === '/password' && !adapter.config.doNotAcceptNewUser) {
        return bot.sendMessage(msg.from.id, _('Please enter password in form "/password phrase"', systemLang))
            .catch(error => adapter.log.error(`send Message Error:${error}`));
    }

    if (adapter.config.password && !adapter.config.doNotAcceptNewUsers) {
        // if user sent password
        let m = msg.text.match(/^\/password (.+)$/);
        m = m || msg.text.match(/^\/p (.+)$/);

        if (m) {
            garbageCollector();

            if (protection[user] && protection[user].length >= 5) {
                return bot.sendMessage(msg.from.id, `${_('Too many attempts. Blocked for', systemLang)} ${Math.round((now - protection[user][protection[user].length - 1]) / 1000)} ${_('seconds', systemLang)}`)
                    .catch(error => adapter.log.error(`send Message Error: ${error}`));
            }

            if (adapter.config.password === m[1]) {
                if (protection[user]) {
                    delete protection[user];
                }
                storeUser(msg.from.id, msg.from.first_name, msg.from.username);

                if (!msg.from.username) {
                    adapter.log.warn(`User ${msg.from.first_name} hast not set an username in the Telegram App!!`);
                }

                return bot.sendMessage(msg.from.id, _('Welcome ', systemLang) + user)
                    .catch(error => adapter.log.error(`send Message Error: ${error}`));
            } else {
                protection[user] = protection[user] || [];
                protection[user].push(Date.now());

                gcInterval = gcInterval || setInterval(() => garbageCollector(), 60000);

                adapter.log.warn(`Got invalid password from ${user}: ${m[1]}`);

                bot.sendMessage(msg.from.id, _('Invalid password', systemLang))
                    .catch(error => adapter.log.error(`send Message Error: ${error}`));

                if (users[msg.from.id]) {
                    delete users[msg.from.id];
                }
            }
        }
    }

    // todo support commands: instances, running, restart

    // If user is not in the trusted list
    if ((adapter.config.password || adapter.config.doNotAcceptNewUsers) && !users[msg.from.id]) {
        return bot.sendMessage(msg.from.id, _(adapter.config.doNotAcceptNewUsers ? 'User is not in the list' : 'Please enter password in form "/password phrase"', systemLang))
            .catch(error => adapter.log.error(`send Message Error: ${error}`));
    }

    if (msg.text === '/help') {
        return bot.sendMessage(msg.from.id, getListOfCommands())
            .catch(error => adapter.log.error(`send Message Error: ${error}`));
    }

    isAnswerForQuestion(adapter, msg);

    if (msg.text === adapter.config.keyboard || msg.text === '/commands') {
        adapter.log.debug('Response keyboard');
        if (adapter.config.rooms) {
            getCommandsKeyboard(msg.chat.id);
            //getRoomsKeyboard(msg.chat.id)
        } else {
            getCommandsKeyboard(msg.chat.id);
        }
        return;
    }

    if (adapter.config.rooms) {
        // detect if some room is selected
    }

    // Search all user's states and try to detect something like "device-alias on"
    let found = false;
    for (const id in commands) {
        if (commands.hasOwnProperty(id)) {
            if (msg.text.startsWith(commands[id].alias + ' ')) {
                let sValue = msg.text.substring(commands[id].alias.length + 1);
                found = true;
                if (sValue === '?') {
                    adapter.getForeignState(id, (err, state) =>
                        bot.sendMessage(msg.chat.id, getStatus(id, state))
                            .catch(error => adapter.log.error(`send Message Error: ${error}`)));
                } else {
                    let value;
                    if (commands[id].states) {
                        const sState = Object.keys(commands[id].states)
                            .find(val => commands[id].states[val] === sValue);
                        if (sState !== null && sState !== undefined) {
                            sValue = sState;
                        }
                    }

                    if (commands[id].type === 'boolean') {
                        value = commands[id].onCommand ? sValue === commands[id].onCommand : sValue === _('ON-Command') || sValue === 'true' || sValue.toLowerCase() === 'on' || sValue === '1';
                    } else if (commands[id].type === 'number') {
                        sValue = sValue.replace('%', '').trim();
                        value = parseFloat(sValue);
                        if (sValue !== value.toString()) {
                            bot.sendMessage(msg.chat.id, _('Invalid number %s', sValue))
                                .catch(error => adapter.log.error(`send Message Error: ${error}`));
                            continue;
                        }
                    } else {
                        value = sValue
                    }

                    adapter.setForeignState(id, value, false, err =>
                        bot.sendMessage(msg.chat.id, _('Done')))
                        .catch(error => adapter.log.error(`send Message Error: ${error}`));
                }
            }
        }
    }
    if (found) {
        return;
    }

    storeUser(msg.from.id, msg.from.first_name, msg.from.username);

    if (!msg.from.username) {
        adapter.log.warn(`User ${msg.from.first_name} hast not set an username in the Telegram App!!`);
    }

    if (adapter.config.allowStates) {
        // Check set state
        let m = msg.text.match(/^\/state (.+) (.+)$/);
        if (m) {
            let id1 = m[1];
            let val1 = m[2];

            // clear by timeout id
            let memoryLeak1 = setTimeout(() => {
                msg = null;
                memoryLeak1 = null;
                id1 = null;
                val1 = null;
            }, 1000);

            adapter.getForeignState(id1, (err, state) => {
                if (memoryLeak1) {
                    clearTimeout(memoryLeak1);
                    memoryLeak1 = null;
                    m = null;
                }
                if (msg) {
                    if (err) {
                        bot.sendMessage(msg.from.id, err)
                            .catch(error => adapter.log.error(`send Message Error: ${error}`));
                    }
                    if (state) {
                        adapter.setForeignState(id1, val1, false, err => {
                            if (msg) {
                                if (err) {
                                    bot.sendMessage(msg.from.id, err)
                                        .catch(error => adapter.log.error(`send Message Error: ${error}`));
                                } else {
                                    bot.sendMessage(msg.from.id, _('Done', systemLang))
                                        .catch(error => adapter.log.error(`send Message Error: ${error}`));
                                }
                            }
                        });
                    } else {
                        bot.sendMessage(msg.from.id, _('ID "%s" not found.', systemLang).replace('%s', id1))
                            .catch(error => adapter.log.error(`send Message Error: ${error}`));
                    }
                }
            });
            return;
        }

        // Check get state
        m = msg.text.match(/^\/state (.+)$/);
        if (m) {
            let id2 = m[1];

            // clear by timeout id
            let memoryLeak2 = setTimeout(() => {
                id2 = null;
                msg = null;
                memoryLeak2 = null;
            }, 1000);

            adapter.getForeignState(id2, (err, state) => {
                if (memoryLeak2) {
                    clearTimeout(memoryLeak2);
                    memoryLeak2 = null;
                    m = null;
                }
                if (msg) {
                    if (err) {
                        bot.sendMessage(msg.from.id, err)
                            .catch(error => adapter.log.error(`send Message Error: ${error}`));
                    }
                    if (state) {
                        bot.sendMessage(msg.from.id, state.val.toString())
                            .catch(error => adapter.log.error(`send Message Error: ${error}`));
                    } else {
                        bot.sendMessage(msg.from.id, _('ID "%s" not found.', systemLang).replace('%s', id2))
                            .catch(error => adapter.log.error(`send Message Error: ${error}`));
                    }
                }
            });
            return;
        }
    }

    adapter.log.debug(`Got message from ${user}: ${msg.text}`);

    // Send to text2command
    if (adapter.config.text2command) {
        adapter.sendTo(adapter.config.text2command, 'send', {
            text: msg.text.replace(/\//g, '#').replace(/_/g, ' '),
            id: msg.chat.id,
            user
        }, response => {
            if (response && response.response) {
                let text = response.response;
                let options;
                if (text && typeof text === 'string') {
                    if (text.startsWith('<MarkdownV2>') && text.endsWith('</MarkdownV2>')) {
                        options = {parse_mode: 'MarkdownV2'};
                        text = text.substring(12, text.length - 13);
                    } else if (text.startsWith('<HTML>') && text.endsWith('</HTML>')) {
                        options = {parse_mode: 'HTML'};
                        text = text.substring(6, text.length - 7);
                    } else if (text.startsWith('<Markdown>') && text.endsWith('</Markdown>')) {
                        options = {parse_mode: 'Markdown'};
                        text = text.substring(10, text.length - 11);
                    }
                }

                adapter.log.debug(`Send response: ${text}`);
                bot.sendMessage(response.id, text, options)
                    .catch(error => adapter.log.error(`send Message Error: ${error}`));
            }
        });
    }

    adapter.setState('communicate.requestChatId', msg.chat.id, true, err => err && adapter.log.error(err));
    adapter.setState('communicate.requestMessageId', msg.message_id, true, err => err && adapter.log.error(err));
    adapter.setState('communicate.requestUserId', msg.from && msg.from.id !== undefined && msg.from.id !== null ? msg.from.id.toString() : '', true, err => err && adapter.log.error(err));
    adapter.setState('communicate.request', `[${user}]${msg.text}`, true, err => err && adapter.log.error(err));
}

function connect() {
    const proxy = adapter.config.proxy;

    if (bot) {
        if (!adapter.config.server) {
            try {
                if (bot.isPolling())
                    adapter.log.debug('bot polling OK');
                else {
                    adapter.log.debug('bot restarting...');
                    bot.stopPolling().then(
                        response => {
                            adapter.log.debug('Start Polling');
                            bot.startPolling();
                        },
                        error => {
                            adapter.log.error(`Error stop polling: ${error}`);
                        }
                    );
                }
            } catch (e) {

            }
        }
        // Check connection
        bot.getMe()
            .then(data => {
                adapter.log.debug(`getMe (reconnect): ${JSON.stringify(data)}`);
                connectionState(true);
            })
            .catch(error => adapter.log.error(`getMe (reconnect) Error:${error}`));
    } else {
        let agent;
        if (proxy === true) {
            adapter.log.debug('proxy enabled');
            let proxyHost = '';
            if (adapter.config && adapter.config.proxyHost !== undefined) {
                proxyHost = adapter.config.proxyHost;
                adapter.log.debug(`proxyHost: ${proxyHost}`);
            }
            let proxyPort = 1080;
            if (adapter.config && adapter.config.proxyPort !== undefined) {
                proxyPort = parseInt(adapter.config.proxyPort, 10) || 0;
                adapter.log.debug(`proxyPort: ${proxyPort}`);
            }
            let proxyLogin = '';
            if (adapter.config && adapter.config.proxyLogin !== undefined) {
                proxyLogin = adapter.config.proxyLogin;
                adapter.log.debug(`proxyLogin: ${proxyLogin}`);
            }
            let proxyPassword = '';
            if (adapter.config && adapter.config.proxyPassword !== undefined) {
                proxyPassword = adapter.config.proxyPassword;
                adapter.log.debug(`proxyPassword: ${proxyPassword}`);
            }
            const socksConfig = {
                proxyHost: proxyHost,
                proxyPort: proxyPort,
                auths: []
            };
            socks = socks || require('socksv5');

            if (proxyLogin) {
                socksConfig.auths.push(socks.auth.UserPassword(proxyLogin, proxyPassword));
            } else {
                socksConfig.auths.push(socks.auth.None());
            }
            agent = new socks.HttpsAgent(socksConfig);
        }

        if (adapter.config.server) {
            // Setup server way
            const serverOptions = {
                polling: false,
                filepath: true,
                baseApiUrl: adapter.config.baseApiUrl
            };
            if (agent) {
                serverOptions.request = { agent: agent };
            }
            bot = new TelegramBot(adapter.config.token, serverOptions);
            if (adapter.config.url[adapter.config.url.length - 1] === '/') {
                adapter.config.url = adapter.config.url.substring(0, adapter.config.url.length - 1);
            }
            bot.setWebHook(`${adapter.config.url}/${adapter.config.token}`);
        } else {
            // Setup polling way
            const pollingOptions = {
                polling: {
                    interval: parseInt(adapter.config.pollingInterval, 10) || 300
                },
                filepath: true,
                baseApiUrl: adapter.config.baseApiUrl
            };
            if (agent) {
                pollingOptions.request = { agent };
            }
            adapter.log.debug(`Start polling with: ${pollingOptions.polling.interval}(${typeof pollingOptions.polling.interval}) ms interval`);
            bot = new TelegramBot(adapter.config.token, pollingOptions);
            bot.setWebHook('').catch(error => {
                adapter.log.error(`setWebHook Error:${error}`)
            });
        }

        // Check connection
        bot.getMe().then(data => {
            adapter.log.debug(`getMe: ${JSON.stringify(data)}`);
            connectionState(true);

            if (adapter.config.restarted !== '') {
                // default text
                if (adapter.config.restarted === '_' || adapter.config.restarted === null || adapter.config.restarted === undefined) {
                    sendSystemMessage(_('Started!'));
                } else {
                    sendSystemMessage(adapter.config.restarted);
                }
            }
        }).catch(error => {
            adapter.log.error(`getMe Error:${error}`)
            connectionState(false);
        });

        // Matches /echo [whatever]
        bot.onText(/(.+)/, processTelegramText);
        bot.on('message', msg => {
            connectionState(true);

            if (adapter.config.storeRawRequest) {
                adapter.setState('communicate.requestRaw', JSON.stringify(msg), true, err =>
                    err && adapter.log.error(err));
            }

            getMessage(msg);
        });

        // callback InlineKeyboardButton
        bot.on('callback_query', callbackQuery => {
            connectionState(true);

            // write received answer into variable
            adapter.log.debug(`callback_query: ${JSON.stringify(callbackQuery)}`);
            callbackQueryId[callbackQuery.from.id] = {id: callbackQuery.id, ts: Date.now()};
            if (adapter.config.storeRawRequest) {
                adapter.setState('communicate.requestRaw', JSON.stringify(callbackQuery), true, err =>
                    err && adapter.log.error(err));
            }
            adapter.setState('communicate.requestMessageId', callbackQuery.message.message_id, true, err => err && adapter.log.error(err));
            adapter.setState('communicate.requestChatId', callbackQuery.message.chat.id, true, err => err && adapter.log.error(err));
            adapter.setState('communicate.request', `[${!adapter.config.useUsername ? callbackQuery.from.first_name :
                !callbackQuery.from.username ? callbackQuery.from.first_name :
                    callbackQuery.from.username}]${callbackQuery.data}`, true, err => err && adapter.log.error(err));

            isAnswerForQuestion(adapter, callbackQuery);

            // following code should be deleted: BF 2020.02.23
            //const action = callbackQuery.data;
            /* const msg    = callbackQuery.message;
            const opts = {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
            };
            let text = 'Ok';// = 'You hit button ' + action;

            bot.editMessageText(text, opts); */
        });

        bot.on('polling_error', error => {
            if (isConnected) {
                adapter.log.warn(`polling_error: ${error.code}, ${error.message.replace(/<[^>]+>/g, '')}`); // => 'EFATAL'
                connectionState(false);
            }
        });

        bot.on('webhook_error', error => {
            adapter.log.error(`webhook_error:${error.code}, ${error.message.replace(/<[^>]+>/g, '')}`); // => 'EPARSE'
            adapter.log.debug('bot restarting...');

            bot.stopPolling().then(
                response => {
                    adapter.log.debug('Start Polling');
                    bot.startPolling();
                },
                error => {
                    adapter.log.error(`Error stop polling: ${error}`);
                }
            );
        });
    }
}

async function updateUsers() {
    if (adapter.config.rememberUsers) {
        try {
            const state = await adapter.getStateAsync('communicate.users');
            if (state && state.val) {
                try {
                    users = JSON.parse(state.val);

                    // convert old format to new format
                    Object.keys(users).forEach(id => {
                        if (typeof users[id] !== 'object') {
                            if (adapter.config.useUsername) {
                                users[id] = {userName: users[id], firstName: users[id], sysMessages: users[id].sysMessages !== false};
                            } else {
                                users[id] = {firstName: users[id], userName: '', sysMessages: users[id].sysMessages !== false};
                            }
                        }
                    });
                } catch (err) {
                    err && adapter.log.error(err);
                    adapter.log.error('Cannot parse stored user IDs!');
                }
            }
        } catch (err) {
            adapter.log.error(err);
        }
    }
}

// Read all Object names sequentially, that do not have aliases
async function readAllNames(ids) {
    for (let i = 0; i < ids.length; i++) {
        try {
            const obj = await adapter.getForeignObjectAsync(ids[i]);
            if (obj) {
                commands[ids[i]].alias  = getName(obj);
                commands[ids[i]].type   = obj.common && obj.common.type;
                commands[ids[i]].states = obj.common && parseStates(obj.common.states || undefined);
                commands[ids[i]].unit   = obj.common && obj.common.unit;
                commands[ids[i]].min    = obj.common && obj.common.min;
                commands[ids[i]].max    = obj.common && obj.common.max;
                // read actual state to detect changes
                if (commands[ids[i]].reportChanges) {
                    const state = await adapter.getForeignStateAsync(ids[i]);
                    commands[ids[i]].lastState = state ? state.val : undefined;
                }
                await adapter.subscribeForeignStatesAsync(ids[i]);
            }
        } catch (err) {
            adapter.log.error(`Cannot process object "${ids[i]}": ${err}`);
        }
    }
}

async function readStatesCommands() {
    const doc = await adapter.getObjectViewAsync('system', 'custom', {});
    const readNames = [];
    if (doc && doc.rows) {
        for (let i = 0, l = doc.rows.length; i < l; i++) {
            if (doc.rows[i].value) {
                let id = doc.rows[i].id;
                let obj = doc.rows[i].value;
                if (obj[adapter.namespace] && obj[adapter.namespace].enabled) {
                    commands[id] = obj[adapter.namespace];
                    readNames.push(id)
                }
            }
        }
    }

    await readAllNames(readNames);
}

async function readEnums(name) {
    name = name || 'rooms';
    enums[name] = {};
    try {
        const doc = await adapter.getObjectViewAsync('system', 'enum', {startkey: `enum.${name}.`, endkey: `enum.${name}.\u9999`});
        if (doc && doc.rows) {
            for (let i = 0, l = doc.rows.length; i < l; i++) {
                if (doc.rows[i].value) {
                    let id = doc.rows[i].id;
                    let obj = doc.rows[i].value;
                    if (obj && obj.common && obj.common.members && obj.common.members.length) {
                        enums[name][id] = obj.common;
                    }
                }
            }
        }
    } catch (err) {
        adapter.log.error(`Cannot read enum ${name}: ${err}`);
    }

    return enums;
}

async function main() {
    if (!adapter.config.token) {
        return adapter.log.error('Token is not set!');
    }

    await adapter.setStateAsync('info.connection', false, true);

    await adapter.subscribeStatesAsync('communicate.request');
    await adapter.subscribeStatesAsync('communicate.response');
    await adapter.subscribeStatesAsync('communicate.responseSilent');
    await adapter.subscribeStatesAsync('communicate.responseJson');
    await adapter.subscribeStatesAsync('communicate.responseSilentJson');

    // clear states
    await adapter.setStateAsync('communicate.request',  '', true);
    await adapter.setStateAsync('communicate.response', '', true);
    await adapter.setStateAsync('communicate.responseSilent', '', true);
    await adapter.setStateAsync('communicate.responseJson', '', true);
    await adapter.setStateAsync('communicate.responseSilentJson', '', true);
    await adapter.setStateAsync('communicate.pathFile', '', true);

    adapter.config.password = adapter.config.password || '';
    adapter.config.keyboard = adapter.config.keyboard || '/cmds';

    await updateUsers();
    if (adapter.config.allowStates !== undefined) {
        adapter.config.allowStates = true;
    }
    adapter.config.answerTimeoutSec = parseInt(adapter.config.answerTimeoutSec, 10) || 60;
    adapter.config.answerTimeoutSec *= 1000;
    adapter.config.rememberUsers = adapter.config.rememberUsers === 'true' || adapter.config.rememberUsers === true;

    try {
        const obj = await adapter.getForeignObjectAsync('system.config');

        if (obj) {
            systemLang = obj.common.language || 'en';
        }

        await readStatesCommands()
        if (adapter.config.rooms) {
            await readEnums();
        }
        // init polling every hour
        reconnectTimer = setInterval(connect, 3600000);

        connect();

        // detect changes of objects
        await adapter.subscribeForeignObjectsAsync('*');
    } catch (err) {
        adapter.log.error(err);
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
