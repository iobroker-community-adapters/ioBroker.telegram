/**
 *
 *      ioBroker telegram Adapter
 *
 *      Copyright (c) 2016-2019 bluefox <dogafox@gmail.com>
 *
 *      MIT License
 *
 */

/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
'use strict';

const TelegramBot = require('node-telegram-bot-api');
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const adapterName = require('./package.json').name.split('.').pop();
const _ = require(__dirname + '/lib/words.js');
const fs = require('fs');
const LE = require(utils.controllerDir + '/lib/letsencrypt.js');
const https = require('https');
const socks = require('socksv5');


let bot;
let users = {};
let systemLang = 'en';
let reconnectTimer = null;
let lastMessageTime = 0;
let lastMessageText = '';
const enums = {};

const commands = {};
const callbackQueryId = {};
const tools = require(utils.controllerDir + '/lib/tools');
const configFile = tools.getConfigFileName();
const tmp = configFile.split(/[\\\/]+/);
tmp.pop();
tmp.pop();
const tmpDir = tmp.join('/') + '/iobroker-data/tmp';
let tmpDirName;

const server = {
    app: null,
    server: null,
    settings: null
};

let adapter;

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {name: adapterName});

    adapter = new utils.Adapter(options);

    adapter.on('message', obj => {
        if (obj) {
            if (obj.command === 'adminuser') {
                let adminuserData;
                adapter.getState('communicate.users', (err, state) => {
                    err && adapter.log.error(err);
                    if (state && state.val) {
                        try {
                            adminuserData = JSON.parse(state.val);
                            adapter.sendTo(obj.from, obj.command, adminuserData, obj.callback);
                        } catch (err) {
                            err && adapter.log.error(err);
                            adapter.log.error('Cannot parse stored user IDs!');
                        }
                    }
                });
                return;
            } else if (obj.command.indexOf('delUser') !== -1) {
                const userID = obj.command.split(' ')[1];
                let userObj = {};
                adapter.getState('communicate.users', (err, state) => {
                    err && adapter.log.error(err);
                    if (state && state.val) {
                        try {
                            userObj = JSON.parse(state.val);
                            delete userObj[userID];
                            adapter.setState('communicate.users', JSON.stringify(userObj), err => {
                                if (!err) {
                                    adapter.sendTo(obj.from, obj.command, userID, obj.callback);
                                    updateUsers();
                                    adapter.log.warn('User ' + userID + ' has been deleted!!');
                                }
                            });
                        } catch (err) {
                            err && adapter.log.error(err);
                            adapter.log.error('Cannot delete user ' + userID + '!');
                        }
                    }
                });
                return;
            } else if (obj.command === 'delAllUser') {
                try {
                    adapter.setState('communicate.users', '', err => {
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
                return;
            } else {
                processMessage(obj);
            }
        }
        processMessages();
    });

    adapter.on('ready', () => {
        adapter.config.server = adapter.config.server === 'true';

        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

        if (adapter.config.server) {
            adapter.config.port = parseInt(adapter.config.port, 10);

            // Load certificates
            adapter.getCertificates((err, certificates, leConfig) => {
                adapter.config.certificates = certificates;
                adapter.config.leConfig = leConfig;
                adapter.config.secure = true;

                server.server = LE.createServer(handleWebHook, adapter.config, adapter.config.certificates, adapter.config.leConfig, adapter.log);
                if (server.server) {
                    server.server.__server = server;
                    adapter.getPort(adapter.config.port, port => {
                        if (parseInt(port, 10) !== adapter.config.port && !adapter.config.findNextPort) {
                            adapter.log.error('port ' + adapter.config.port + ' already in use');
                            adapter.terminate ? adapter.terminate() : process.exit(1);
                        }
                        server.server.listen(port, (!adapter.config.bind || adapter.config.bind === '0.0.0.0') ? undefined : adapter.config.bind || undefined);
                        adapter.log.info('https server listening on port ' + port);
                        main();
                    });
                }
            });
        } else {
            main();
        }
    });

    adapter.on('unload', () => {
        if (reconnectTimer) clearInterval(reconnectTimer);

        if (adapter && adapter.config) {
            if (adapter.config.restarting !== '') {
                // default text
                if (adapter.config.restarting === '_' || adapter.config.restarting === null || adapter.config.restarting === undefined) {
                    sendMessage(adapter.config.rememberUsers ? _('Restarting...') : _('Restarting... Reauthenticate!'));
                } else {
                    sendMessage(adapter.config.restarting);
                }
            }
            try {
                if (server.server) {
                    server.server.close();
                }
            } catch (e) {
                console.error('Cannot close server: ' + e);
            }
        }
        if (adapter && adapter.setState) adapter.setState('info.connection', false, true);
    });

    // is called if a subscribed state changes
    adapter.on('stateChange', (id, state) => {
        if (state && !state.ack && id.indexOf('communicate.response') !== -1) {
            // Send to someone this message
            sendMessage(state.val);
        }
        if (state && state.ack && commands[id] && commands[id].report) {
            sendMessage(getStatus(id, state));
        }
    });

    adapter.on('objectChange', (id, obj) => {
        if (obj && obj.common && obj.common.custom &&
            obj.common.custom[adapter.namespace] && obj.common.custom[adapter.namespace].enabled
        ) {
            const alias = getName(obj);
            if (!commands[id]) {
                adapter.log.info('enabled logging of ' + id + ', Alias=' + alias);
                setImmediate(() => adapter.subscribeForeignStates(id));
            }
            commands[id]        = obj.common.custom[adapter.namespace];
            commands[id].type   = obj.common.type;
            commands[id].states = parseStates(obj.common.states);
            commands[id].unit   = obj.common && obj.common.unit;
            commands[id].min    = obj.common && obj.common.min;
            commands[id].max    = obj.common && obj.common.max;
            commands[id].alias  = alias;
        } else if (commands[id]) {
            adapter.log.debug('Removed command: ' + id);
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

    tmpDirName = tmpDir + '/' + adapter.namespace.replace('.', '_');

    return adapter;
}

function getStatus(id, state) {
    if (commands[id].type === 'boolean') {
        return `${commands[id].alias} => ${state.val ? commands[id].onStatus || _('ON-Status') : commands[id].off || _('OFF-Status')}`;
    } else {
        if (commands[id].states && commands[id].states[state.val] !== undefined) {
            state.val = commands[id].states[state.val];
        }
        return `${commands[id].alias} => ${state.val}`;
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
    if (req.method === 'POST' && req.url === '/' + adapter.config.token) {
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
                adapter.log.error('Cannot parse webhook response!: ' + e);
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
    adapter.log.debug('Request: ' + JSON.stringify(msg));

    if (msg && msg.message_id) {
        adapter.setState('communicate.botSendMessageId', msg.message_id, err => {
            err && adapter.log.error(err);
        });
    }

    if (msg && msg.chat && msg.chat.id) {
        adapter.setState('communicate.botSendChatId', msg.chat.id, err => {
            err && adapter.log.error(err);
        });
    }
}

function _sendMessageHelper(dest, name, text, options) {
    let count = 0;

    if (options && options.chatId !== undefined && options.user === undefined) {
        options.user = users[options.chatId];
    }

    if (options && options.latitude !== undefined) {
        adapter.log.debug('Send location to "' + name + '": ' + text);
        if (bot) {
            bot.sendLocation(dest, parseFloat(options.latitude), parseFloat(options.longitude), options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Location sent');
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send location [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send location [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (actions.indexOf(text) !== -1) {
        adapter.log.debug('Send action to "' + name + '": ' + text);
        if (bot) {
            bot.sendChatAction(dest, text)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Action sent');
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send action [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send action [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (text && ((typeof text === 'string' && text.match(/\.webp$/i) && fs.existsSync(text)) || (options && options.type === 'sticker'))) {
        if (typeof text === 'string') {
            adapter.log.debug('Send sticker to "' + name + '": ' + text);
        } else {
            adapter.log.debug('Send sticker to "' + name + '": ' + text.length + ' bytes');
        }
        if (bot) {
            bot.sendSticker(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    options = null;
                    adapter.log.debug('Sticker sent');
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send sticker [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send sticker [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (text && ((typeof text === 'string' && text.match(/\.(mp4|gif)$/i) && fs.existsSync(text)) || (options && options.type === 'video'))) {
        if (typeof text === 'string') {
            adapter.log.debug('Send video to "' + name + '": ' + text);
        } else {
            adapter.log.debug('Send video to "' + name + '": ' + text.length + ' bytes');
        }
        if (bot) {
            bot.sendVideo(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Video sent');
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send video [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send video [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (text && ((typeof text === 'string' && text.match(/\.(txt|doc|docx|csv|pdf|xls|xlsx)$/i) && fs.existsSync(text)) || (options && options.type === 'document'))) {
        if (typeof text === 'string') {
            adapter.log.debug('Send document to "' + name + '": ' + text);
        } else {
            adapter.log.debug('Send document to "' + name + '": ' + text.length + ' bytes');
        }
        if (bot) {
            bot.sendDocument(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Document sent');
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send document [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send document [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (text && ((typeof text === 'string' && text.match(/\.(wav|mp3|ogg)$/i) && fs.existsSync(text)) || (options && options.type === 'audio'))) {
        if (typeof text === 'string') {
            adapter.log.debug('Send audio to "' + name + '": ' + text);
        } else {
            adapter.log.debug('Send audio to "' + name + '": ' + text.length + ' bytes');
        }
        if (bot) {
            bot.sendAudio(dest, text, options)
                .then(response => saveSendRequest(response))
                .then(() => {
                    adapter.log.debug('Audio sent');
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send audio [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send audio [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (text && ((typeof text === 'string' && text.match(/\.(jpg|png|jpeg|bmp|gif)$/i) && (fs.existsSync(text) || text.match(/^(https|http)/i))) || (options && options.type === 'photo'))) {
        if (typeof text === 'string') {
            adapter.log.debug('Send photo to "' + name + '": ' + text);
        } else {
            adapter.log.debug('Send photo to "' + name + '": ' + text.length + ' bytes');
        }
        if (bot) {
            bot.sendPhoto(dest, text, options)
                .then(response => {
                    saveSendRequest(response);
                })
                .then(() => {
                    adapter.log.debug('Photo sent');
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send photo [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send photo [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (options && options.answerCallbackQuery !== undefined) {
        adapter.log.debug('Send answerCallbackQuery to "' + name + '"');
        if (options.answerCallbackQuery.showAlert === undefined) {
            options.answerCallbackQuery.showAlert = false;
        }
        if (bot) {
            bot.answerCallbackQuery(callbackQueryId[options.chatId], options.answerCallbackQuery.text, options.answerCallbackQuery.showAlert)
                .then(() => {
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send answerCallbackQuery [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send answerCallbackQuery [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (options && options.editMessageReplyMarkup !== undefined) {
        adapter.log.debug('Send editMessageReplyMarkup to "' + name + '"');
        if (bot) {
            bot.editMessageReplyMarkup(options.editMessageReplyMarkup.reply_markup, options.editMessageReplyMarkup.options)
                .then(response => {
                    saveSendRequest(response);
                })
                .then(() => {
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send editMessageReplyMarkup [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send editMessageReplyMarkup [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (options && options.editMessageText !== undefined) {
        adapter.log.debug('Send editMessageText to "' + name + '"');
        if (bot) {
            bot.editMessageText(text, options.editMessageText.options)
                .then(response => {
                    saveSendRequest(response);
                })
                .then(() => {
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send editMessageText [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send editMessageText [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else if (options && options.deleteMessage !== undefined) {
        adapter.log.debug('Send deleteMessage to "' + name + '"');
        if (bot) {
            bot.deleteMessage(options.deleteMessage.options.chat_id, options.deleteMessage.options.message_id)
                .then(response => {
                    saveSendRequest(response);
                })
                .then(() => {
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options.chatId) {
                        adapter.log.error('Cannot send deleteMessage [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send deleteMessage [user - ' + options.user + ']: ' + error);
                    }
                    options = null;
                });
        }
    } else {
        adapter.log.debug('Send message to "' + name + '": ' + text);
        if (bot) {
            bot.sendMessage(dest, text || '', options)
                .then(response => {
                    saveSendRequest(response);
                })
                .then(() => {
                    adapter.log.debug('Message sent');
                    options = null;
                    count++;
                })
                .catch(error => {
                    if (options && options.chatId) {
                        adapter.log.error('Cannot send message [chatId - ' + options.chatId + ']: ' + error);
                    } else {
                        adapter.log.error('Cannot send message [user - ' + (options && options.user) + ']: ' + error);
                    }
                    options = null;
                });
        }
    }

    return count;
}

function sendMessage(text, user, chatId, options) {
    if (!text && (typeof options !== 'object')) {
        if (!text && text !== 0 && (!options || !options.latitude)) {
            adapter.log.warn('Invalid text: null');
            return;
        }
    }

    if (options) {
        if (options.chatId !== undefined) delete options.chatId;
        if (options.text !== undefined) delete options.text;
        if (options.user !== undefined) delete options.user;
    }

    // convert
    if (text !== undefined && text !== null && typeof text !== 'object') {
        text = text.toString();
    }

    if (chatId) {
        return _sendMessageHelper(chatId, 'chat', text, options);
    }

    let count = 0;

    if (user) {
        const userarray = user.split(',').map(build => build.trim());
        let matches = 0;
        userarray.forEach(value => {
            for (const u in users) {
                if (users.hasOwnProperty(u) && users[u] === value) {
                    if (options) {
                        options.chatId = u;
                    }
                    matches++;
                    count += _sendMessageHelper(u, value, text, options);
                    break;
                }
            }
        });
        if (userarray.length !== matches) {
            adapter.log.warn(userarray.length - matches + ' of ' + userarray.length + ' recipients are unknown!');
        }
        return count;
    }

    const m = typeof text === 'string' ? text.match(/^@(.+?)\b/) : null;
    if (m) {
        text = text.replace('@' + m[1], '').trim().replace(/\s\s/g, ' ');
        for (const u in users) {
            const re = new RegExp(m[1], 'i');
            if (users.hasOwnProperty(u) && users[u].match(re)) {
                if (options) {
                    options.chatId = u;
                }
                count += _sendMessageHelper(u, m[1], text, options);
                break;
            }
        }
    } else {
        // Send to all users
        for (const u in users) {
            if (!users.hasOwnProperty(u)) continue;
            if (options) {
                options.chatId = u;
            }
            count += _sendMessageHelper(u, users[u], text, options);
        }
    }
    return count;
}

function saveFile(file_id, fileName, callback) {
    bot.getFileLink(file_id).then(url => {
        adapter.log.debug('Received message: ' + url);
        https.get(url, res => {
            if (res.statusCode === 200) {
                const buf = [];
                res.on('data', data => buf.push(data));
                res.on('end', () => {
                    fs.writeFile(tmpDirName + fileName, Buffer.concat(buf), err => {
                        if (err) throw err;
                        callback({
                            info: 'It\'s saved! : ' + tmpDirName + fileName,
                            path: tmpDirName + fileName
                        })
                    });
                });
                res.on('error', err => {
                    callback({
                        error: 'Error : ' + err
                    })
                });
            } else {
                callback({
                    error: 'Error : statusCode !== 200'
                });
            }
        });
    }, err => {
        callback({
            error: 'Error bot.getFileLink : ' + err
        });
    });
}

function getMessage(msg) {
    const date = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    adapter.log.debug('Received message: ' + JSON.stringify(msg));

    if (!fs.existsSync(tmpDirName)) {
        fs.mkdirSync(tmpDirName);
    }
    if (msg.voice) {
        if (!fs.existsSync(tmpDirName + '/voice')) fs.mkdirSync(tmpDirName + '/voice');
        saveFile(msg.voice.file_id, adapter.config.saveFiles ? '/voice/' + date + '.ogg' : '/voice/temp.ogg', res => {
            if (!res.error) {
                adapter.log.info(res.info);
                adapter.setState('communicate.pathFile', res.path, err => err && adapter.log.error(err));
            } else {
                adapter.log.debug(res.error);
            }
        })
    } else if (adapter.config.saveFiles && msg.photo) {
        if (!fs.existsSync(tmpDirName + '/photo')) fs.mkdirSync(tmpDirName + '/photo');
        saveFile(msg.photo[3].file_id, '/photo/' + date + '.jpg', res => {
            if (!res.error) {
                adapter.log.info(res.info);
                adapter.setState('communicate.pathFile', res.path, err => err && adapter.log.error(err));
            } else {
                adapter.log.debug(res.error);
            }
        })

    } else if (adapter.config.saveFiles && msg.video) {
        if (!fs.existsSync(tmpDirName + '/video')) fs.mkdirSync(tmpDirName + '/video');
        saveFile(msg.video.file_id, '/video/' + date + '.mp4', res => {
            if (!res.error) {
                adapter.log.info(res.info);
                adapter.setState('communicate.pathFile', res.path, err => err && adapter.log.error(err));
            } else {
                adapter.log.debug(res.error);
            }
        })
    } else if (adapter.config.saveFiles && msg.audio) {
        if (!fs.existsSync(tmpDirName + '/audio')) fs.mkdirSync(tmpDirName + '/audio');
        saveFile(msg.audio.file_id, '/audio/' + date + '.mp3', res => {
            if (!res.error) {
                adapter.log.info(res.info);
                adapter.setState('communicate.pathFile', res.path, err => err && adapter.log.error(err));
            } else {
                adapter.log.debug(res.error);
            }
        })
    } else if (adapter.config.saveFiles && msg.document) {
        if (!fs.existsSync(tmpDirName + '/document')) fs.mkdirSync(tmpDirName + '/document');
        saveFile(msg.document.file_id, '/document/' + msg.document.file_name, res => {
            if (!res.error) {
                adapter.log.info(res.info);
                adapter.setState('communicate.pathFile', res.path, err => err && adapter.log.error(err));
            } else {
                adapter.log.debug(res.error);
            }
        })
    }
}

function processMessage(obj) {
    if (!obj || !obj.command) return;
    // Ignore own answers
    if (obj.message && obj.message.response) return;

    // filter out double messages
    const json = JSON.stringify(obj);
    if (lastMessageTime && lastMessageText === JSON.stringify(obj) && new Date().getTime() - lastMessageTime < 1200) {
        adapter.log.debug('Filter out double message [first was for ' + (new Date().getTime() - lastMessageTime) + 'ms]: ' + json);
        return;
    }

    lastMessageTime = new Date().getTime();
    lastMessageText = json;

    switch (obj.command) {
        case 'send':
            {
                if (obj.message) {
                    let count;
                    if (typeof obj.message === 'object') {
                        count = sendMessage(obj.message.text, obj.message.user, obj.message.chatId, obj.message);
                    } else {
                        count = sendMessage(obj.message);
                    }
                    if (obj.callback) adapter.sendTo(obj.from, obj.command, count, obj.callback);
                }
            }
    }
}

function processMessages() {
    adapter.getMessage((err, obj) => {
        if (obj) {
            processMessage(obj.command, obj.message);
            processMessages();
        }
    });
}

function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function storeUser(id, name) {
    if (users[id] !== name) {
        for (const u in users) {
            if (users.hasOwnProperty(u) && users[u] === name) {
                delete users[u];
            }
        }
        users[id] = name;

        if (adapter.config.rememberUsers) {
            adapter.setState('communicate.users', JSON.stringify(users));
        }
    }
}

function getListOfCommands() {
    const ids = Object.keys(commands).sort((a, b) => commands[b].alias - commands[a].alias);
    const lines = [];

    ids.forEach(id => {
        if (!commands[id].readOnly) {
            if (commands[id].type === 'boolean') {
                lines.push(`${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}|${commands[id].off || _('OFF-Command')}|?`);
            } else {
                lines.push(`${commands[id].alias} ${_('value as ' + commands[id].type)}|?`);
            }
        }
    });
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
                        keyboard.push([`${commands[id].alias} ?`]);
                    } else {
                        keyboard.push([
                            `${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}`,
                            `${commands[id].alias} ?`
                        ]);
                    }
                } else {
                    if (commands[id].buttons === 1) {
                        keyboard.push([
                            `${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}`,
                        ]);
                        keyboard.push([
                            `${commands[id].alias} ${commands[id].offCommand || _('OFF-Command')}`,
                        ]);
                        keyboard.push([
                            `${commands[id].alias} ?`
                        ]);
                    } else if (commands[id].buttons === 2) {
                        keyboard.push([
                            `${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}`,
                            `${commands[id].alias} ${commands[id].offCommand || _('OFF-Command')}`,
                        ]);
                        keyboard.push([`${commands[id].alias} ?`]);
                    } else {
                        keyboard.push([
                            `${commands[id].alias} ${commands[id].onCommand || _('ON-Command')}`,
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
                s.push(`${commands[id].alias} ?`);
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
                s.push(`${commands[id].alias} ?`);
                keyboard.push(s);
            }  else {
                keyboard.push([`${commands[id].alias} ?`]);
            }
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
            adapter.log.error(error);
        });
}

function processTelegramText(msg) {
    adapter.log.debug(JSON.stringify(msg));
    const now = new Date().getTime();
    let pollingInterval = 0;
    if (adapter.config && adapter.config.pollingInterval !== undefined) {
        pollingInterval = parseInt(adapter.config.pollingInterval, 10) || 0;
    }

    // ignore all messages older than 30 seconds + polling interval
    if (now - msg.date * 1000 > pollingInterval + 30000) {
        adapter.log.warn('Message from ' + msg.from.name + ' ignored, becasue too old: (' + (pollingInterval + 30000) + ') ' + msg.text);
        bot.sendMessage(msg.from.id, _('Message ignored: ', systemLang) + msg.text);
        return;
    }
    msg.text = (msg.text ||'').trim();
    // sometimes telegram sends messages like "message@user_name"
    const pos = msg.text.lastIndexOf('@');
    if (pos !== -1) {
        msg.text = msg.text.substring(0, pos);
    }

    if (msg.text === '/password') {
        bot.sendMessage(msg.from.id, _('Please enter password in form "/password phrase"', systemLang));
        return;
    }

    if (msg.text === '/help') {
        bot.sendMessage(msg.from.id, getListOfCommands());
        return;
    }

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
                    adapter.getForeignState(id, (err, state) => {
                        bot.sendMessage(msg.chat.id, getStatus(id, state));
                    });
                } else {
                    let value;
                    if (commands[id].states) {
                        const sState = Object.keys(commands[id].states).find(val => commands[id].states[val] === sValue);
                        if (sState !== null && sState !== undefined) {
                            sValue = sState;
                        }
                    }

                    if (commands[id].type === 'boolean') {
                        value = commands[id].onCommand ? sValue === commands[id].onCommand : sValue === _('ON') || sValue === 'true'  || sValue === '1';
                    } else if (commands[id].type === 'number') {
                        sValue = sValue.replace('%', '').trim();
                        value = parseFloat(sValue);
                        if (sValue !== value.toString()) {
                            bot.sendMessage(msg.chat.id, _('Invalid number %s', sValue));
                            continue;
                        }
                    } else {
                        value = sValue
                    }

                    adapter.setForeignState(id, value, err =>
                        bot.sendMessage(msg.chat.id, _('Done')));
                }
            }
        }
    }
    if (found) {
        return;
    }

    if (adapter.config.password) {
        // if user sent password
        let m = msg.text.match(/^\/password (.+)$/);
        m = m || msg.text.match(/^\/p (.+)$/);

        if (m) {
            if (adapter.config.password === m[1]) {
                storeUser(msg.from.id, (!adapter.config.useUsername ? msg.from.first_name : !msg.from.username ? msg.from.first_name : msg.from.username));
                if (adapter.config.useUsername && !msg.from.username) adapter.log.warn('User ' + msg.from.first_name + ' hast not set an username in the Telegram App!!');
                bot.sendMessage(msg.from.id, _('Welcome ', systemLang) + (!adapter.config.useUsername ? msg.from.first_name : !msg.from.username ? msg.from.first_name : msg.from.username));
                return;
            } else {
                adapter.log.warn('Got invalid password from ' + (!adapter.config.useUsername ? msg.from.first_name : !msg.from.username ? msg.from.first_name : msg.from.username) + ': ' + m[1]);
                bot.sendMessage(msg.from.id, _('Invalid password', systemLang));
                if (users[msg.from.id]) delete users[msg.from.id];
            }
        }
    }

    // todo support commands: instances, running, restart
    if (adapter.config.password && !users[msg.from.id]) {
        bot.sendMessage(msg.from.id, _('Please enter password in form "/password phrase"', systemLang));
        return;
    }

    storeUser(msg.from.id, (!adapter.config.useUsername ? msg.from.first_name : !msg.from.username ? msg.from.first_name : msg.from.username));
    if (adapter.config.useUsername && !msg.from.username) adapter.log.warn('User ' + msg.from.first_name + ' hast not set an username in the Telegram App!!');

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
                    if (err) bot.sendMessage(msg.from.id, err);
                    if (state) {
                        adapter.setForeignState(id1, val1, err => {
                            if (msg) {
                                if (err) {
                                    bot.sendMessage(msg.from.id, err);
                                } else {
                                    bot.sendMessage(msg.from.id, _('Done', systemLang));
                                }
                            }
                        });
                    } else {
                        bot.sendMessage(msg.from.id, _('ID "%s" not found.', systemLang).replace('%s', id1));
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
                    if (err) bot.sendMessage(msg.from.id, err);
                    if (state) {
                        bot.sendMessage(msg.from.id, state.val.toString());
                    } else {
                        bot.sendMessage(msg.from.id, _('ID "%s" not found.', systemLang).replace('%s', id2));
                    }
                }
            });
            return;
        }
    }

    adapter.log.debug('Got message from ' + (!adapter.config.useUsername ? msg.from.first_name : !msg.from.username ? msg.from.first_name : msg.from.username) + ': ' + msg.text);

    // Send to text2command
    if (adapter.config.text2command) {
        adapter.sendTo(adapter.config.text2command, 'send', {
            text: msg.text.replace(/\//g, '#').replace(/_/g, ' '),
            id: msg.chat.id,
            user: (!adapter.config.useUsername ? msg.from.first_name : !msg.from.username ? msg.from.first_name : msg.from.username)
        }, response => {
            if (response && response.response) {
                adapter.log.debug('Send response: ' + response.response);
                bot.sendMessage(response.id, response.response);
            }
        });
    }
    adapter.setState('communicate.requestChatId', msg.chat.id, err => err && adapter.log.error(err));
    adapter.setState('communicate.requestMessageId', msg.message_id, err => err && adapter.log.error(err));
    adapter.setState('communicate.requestUserId', msg.user ? msg.user.id : '', err => err && adapter.log.error(err));
    adapter.setState('communicate.request',
        '[' + (!adapter.config.useUsername ? msg.from.first_name : !msg.from.username ? msg.from.first_name : msg.from.username) + ']' + msg.text,
        err => err && adapter.log.error(err));
}

function connect() {
    let proxy = false;
    if (adapter.config && adapter.config.proxy !== undefined) {
        proxy = adapter.config.proxy;
    }

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
                            adapter.log.error('Error stop polling: ' + error);
                        }
                    );
                }
            } catch (e) {

            }
        }
        // Check connection
        bot.getMe().then(data => {
            adapter.log.debug('getMe (reconnect): ' + JSON.stringify(data));
            adapter.setState('info.connection', true, true);
        });
    } else {
        let agent;
        if (proxy === true) {
            adapter.log.debug('proxy enabled');
            let proxyHost = '';
            if (adapter.config && adapter.config.proxyHost !== undefined) {
                proxyHost = adapter.config.proxyHost;
                adapter.log.debug('proxyHost: ' + proxyHost);
            }
            let proxyPort = 1080;
            if (adapter.config && adapter.config.proxyPort !== undefined) {
                proxyPort = parseInt(adapter.config.proxyPort, 10) || 0;
                adapter.log.debug('proxyPort: ' + proxyPort);
            }
            let proxyLogin = '';
            if (adapter.config && adapter.config.proxyLogin !== undefined) {
                proxyLogin = adapter.config.proxyLogin;
                adapter.log.debug('proxyLogin: ' + proxyLogin);
            }
            let proxyPassword = '';
            if (adapter.config && adapter.config.proxyPassword !== undefined) {
                proxyPassword = adapter.config.proxyPassword;
                adapter.log.debug('proxyPassword: ' + proxyPassword);
            }
            const socksConfig = {
                proxyHost: proxyHost,
                proxyPort: proxyPort,
                auths: []
            };
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
            bot.setWebHook(adapter.config.url + '/' + adapter.config.token);
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
                pollingOptions.request = { agent: agent };
            }
            adapter.log.debug('Start polling with: ' + pollingOptions.polling.interval + '(' + typeof pollingOptions.polling.interval + ')' + ' ms interval');
            bot = new TelegramBot(adapter.config.token, pollingOptions);
            bot.setWebHook('');
        }

        // Check connection
        bot.getMe().then(data => {
            adapter.log.debug('getMe: ' + JSON.stringify(data));
            adapter.setState('info.connection', true, true);

            if (adapter.config.restarted !== '') {
                // default text
                if (adapter.config.restarted === '_' || adapter.config.restarted === null || adapter.config.restarted === undefined) {
                    sendMessage(_('Started!'));
                } else {
                    sendMessage(adapter.config.restarted);
                }
            }
        });

        // Matches /echo [whatever]
        bot.onText(/(.+)/, processTelegramText);
        bot.on('message', msg => {
            if (adapter.config.storeRawRequest) {
                adapter.setState('communicate.requestRaw', JSON.stringify(msg), err => {
                    err && adapter.log.error(err);
                });
            }
            getMessage(msg);
        });

        // callback InlineKeyboardButton
        bot.on('callback_query', msg => {
            // write received answer into constiable
            adapter.log.debug('callback_query: ' + JSON.stringify(msg));
            callbackQueryId[msg.from.id] = msg.id;
            adapter.setState('communicate.requestMessageId', msg.message.message_id, err => {
                err && adapter.log.error(err);
            });
            adapter.setState('communicate.request', '[' + (!adapter.config.useUsername ? msg.from.first_name : !msg.from.username ? msg.from.first_name : msg.from.username) + ']' + msg.data, err => {
                err && adapter.log.error(err);
            });
        });
        bot.on('polling_error', error => {
            adapter.log.error('polling_error:' + error.code + ', ' + error.message.replace(/<[^>]+>/g, '')); // => 'EFATAL'
        });
        bot.on('webhook_error', error => {
            adapter.log.error('webhook_error:' + error.code + ', ' + error.message.replace(/<[^>]+>/g, '')); // => 'EPARSE'
            adapter.log.debug('bot restarting...');
            bot.stopPolling().then(
                response => {
                    adapter.log.debug('Start Polling');
                    bot.startPolling();
                },
                error => {
                    adapter.log.error('Error stop polling: ' + error);
                }
            );
        });
    }
}

function updateUsers() {
    if (adapter.config.rememberUsers) {
        adapter.getState('communicate.users', (err, state) => {
            err && adapter.log.error(err);
            if (state && state.val) {
                try {
                    users = JSON.parse(state.val);
                } catch (err) {
                    err && adapter.log.error(err);
                    adapter.log.error('Cannot parse stored user IDs!');
                }
            }
        });
    }
}

// Read all Object names sequentially, that do not have aliases
function readAllNames(ids, cb) {
    if (!ids || !ids.length) {
        cb && cb();
    } else {
        const id = ids.shift();
        adapter.getForeignObject(id, (err, obj) => {
            if (obj) {
                commands[id].alias  = getName(obj);
                commands[id].type   = obj.common && obj.common.type;
                commands[id].states = obj.common && parseStates(obj.common.states || undefined);
                commands[id].unit   = obj.common && obj.common.unit;
                commands[id].min    = obj.common && obj.common.min;
                commands[id].max    = obj.common && obj.common.max;
                console.log('Subscribe ' + id);
                adapter.subscribeForeignStates(id, () =>
                    setImmediate(readAllNames, ids, cb));
            } else {
                setImmediate(readAllNames, ids, cb);
            }
        });
    }
}

function readStatesCommands() {
    return new Promise((resolve, reject) => {
        adapter.objects.getObjectView('custom', 'state', {}, (err, doc) => {
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

            readAllNames(JSON.parse(JSON.stringify(readNames)), () =>
                resolve());
        });
    });
}

function readEnums(name) {
    return new Promise((resolve, reject) => {
        name = name || 'rooms';
        enums[name] = {};
        adapter.objects.getObjectView('system', 'enum', {startkey: 'enum.' + name + '.', endkey: 'enum.' + name + '.\u9999'}, (err, doc) => {
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
            resolve(enums);
        });
    });
}

function main() {
    if (!adapter.config.token) {
        adapter.log.error('Token is not set!');
        return;
    }

    adapter.subscribeStates('communicate.request');
    adapter.subscribeStates('communicate.response');

    // clear states
    adapter.setState('communicate.request', '', true);
    adapter.setState('communicate.response', '', true);
    adapter.setState('communicate.pathFile', '', true);

    adapter.config.password = decrypt('Zgfr56gFe87jJON', adapter.config.password || '');
    adapter.config.keyboard = adapter.config.keyboard || '/cmds';

    updateUsers();

    if (adapter.config.allowStates !== undefined) {
        adapter.config.allowStates = true;
    }
    adapter.config.users = adapter.config.users || '';
    adapter.config.users = adapter.config.users.split(',');
    adapter.config.rememberUsers = adapter.config.rememberUsers === 'true' || adapter.config.rememberUsers === true;

    for (let u = adapter.config.users.length - 1; u >= 0; u--) {
        adapter.config.users[u] = adapter.config.users[u].trim().toLowerCase();
        if (!adapter.config.users[u]) {
            adapter.config.users.splice(u, 1);
        }
    }

    adapter.getForeignObject('system.config', (err, obj) => {
        err && adapter.log.error(err);
        if (obj) {
            systemLang = obj.common.language || 'en';
        }

        readStatesCommands()
            .then(() => {
                if (adapter.config.rooms) {
                    return readEnums();
                } else {
                    return Promise.resolve();
                }
            })
            .then(() => {
                // init polling every hour
                reconnectTimer = setInterval(connect, 3600000);
                connect();
                adapter.subscribeForeignObjects('*');
            });
    });
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
