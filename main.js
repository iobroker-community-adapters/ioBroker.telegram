/**
 *
 *      ioBroker telegram Adapter
 *
 *      (c) 2016 bluefox <dogafox@gmail.com>
 *
 *      MIT License
 *
 */
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var utils       = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter     = utils.adapter('telegram');
var _           = require(__dirname + '/lib/words.js');
var TelegramBot = require('node-telegram-bot-api');
var fs          = require('fs');

var bot;
var users      = {};
var systemLang = 'en';
var reconnectTimer = null;

adapter.on('message', function (obj) {
    if (obj) processMessage(obj);
    processMessages();
});

adapter.on('ready',   function () {
    main();
});

adapter.on('unload',  function () {
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
    }
    if (adapter && adapter.setState) adapter.setState('info.connection', false, true);
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (state && !state.ack && id.indexOf('communicate.response') !== -1) {
        // Send to someone this message
        sendMessage(state.val);
    }
});

var actions = [
    'typing', 'upload_photo', 'upload_video', 'record_video', 'record_audio', 'upload_document', 'find_location'
];

function _sendMessageHelper(dest, name, text, options) {
    if (options && options.latitude !== undefined) {
        adapter.log.debug('Send location to "' + name + '": ' + text);
        if (bot) bot.sendLocation(dest, parseFloat(options.longitude), parseFloat(options.latitude), options).then(function () {
            adapter.log.debug('Location sent');
        }, function (error) {
            adapter.log.error('Cannot send location: ' + error);
        });
    } else if (actions.indexOf(text) !== -1) {
        adapter.log.debug('Send action to "' + name + '": ' + text);
        if (bot) bot.sendChatAction(dest, text).then(function () {
            adapter.log.debug('Action sent');
        }, function (error) {
            adapter.log.error('Cannot send action: ' + error);
        });
    } else if (text.match(/\.webp$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send video to "' + name + '": ' + text);
        if (bot) bot.sendSticker(dest, text, options).then(function () {
            adapter.log.debug('Sticker sent');
        }, function (error) {
            adapter.log.error('Cannot send sticker: ' + error);
        });
    } else if (text.match(/\.mp4$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send video to "' + name + '": ' + text);
        if (bot) bot.sendVideo(dest, text, options).then(function () {
            adapter.log.debug('Video sent');
        }, function (error) {
            adapter.log.error('Cannot send video: ' + error);
        });
    } else if (text.match(/\.(txt|doc|docx|csv)$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send document to "' + name + '": ' + text);
        if (bot) bot.sendDocument(dest, text, options).then(function () {
            adapter.log.debug('Document sent');
        }, function (error) {
            adapter.log.error('Cannot send document: ' + error);
        });
    } else if (text.match(/\.(wav|mp3|ogg)$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send audio to "' + name + '": ' + text);
        if (bot) bot.sendAudio(dest, text, options).then(function () {
            adapter.log.debug('Audio sent');
        }, function (error) {
            adapter.log.error('Cannot send audio: ' + error);
        });
    } else if (text.match(/\.(jpg|png|jpeg|bmp)$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send photo to "' + name + '": ' + text);
        if (bot) bot.sendPhoto(dest, text, options).then(function () {
            adapter.log.debug('Photo sent');
        }, function (error) {
            adapter.log.error('Cannot send photo: ' + error);
        });
    } else {
        adapter.log.debug('Send message to "' + name + '": ' + text);
        if (bot) bot.sendMessage(dest, text, options).then(function () {
            adapter.log.debug('Message sent');
        }, function (error) {
            adapter.log.error('Cannot send message: ' + error);
        });
    }
}

function sendMessage(text, user, chatId, options) {
    if (!text && text !== 0 && (!options || !options.latitude)) {
        adapter.log.warn('Invalid text: null');
        return;
    }

    if (options) {
        if (options.chatId !== undefined) delete options.chatId;
        if (options.text   !== undefined) delete options.text;
        if (options.user   !== undefined) delete options.user;
    }

    // convert
    if (text !== undefined && text !== null) text = text.toString();

    if (chatId) {
        _sendMessageHelper(chatId, 'chat', text, options);
        return 1;
    }

    var count = 0;
    var u;

    if (user) {
        for (u in users) {
            if (users[u] === user) {
                count++;
                _sendMessageHelper(u, user, text, options);
                break;
            }
        }
        return count;
    }

    var m = text.match(/^@(.+?)\b/);
    if (m) {
        text = text.replace('@' + m[1], '').trim().replace(/\s\s/g, ' ');
        for (u in users) {
            var re = new RegExp(m[1],'i');
            if (users[u].match(re)) {
                count++;
                _sendMessageHelper(u, m[1], text, options);
                break;
            }
        }
    } else {
        // Send to all users
        for (u in users) {
            count++;
            _sendMessageHelper(u, users[u], text, options);
        }
    }
    return count;
}

function processMessage(obj) {
    if (!obj || !obj.command) return;
    // Ignore own answers
    if (obj.message && obj.message.response) {
        return;
    }

    switch (obj.command) {
        case 'send': {
            if (obj.message) {
                var count;
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
    adapter.getMessage(function (err, obj) {
        if (obj) {
            processMessage(obj.command, obj.message);
            processMessages();
        }
    });
}

function decrypt(key, value) {
    var result = '';
    for (var i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function storeUser(id, name) {
    if (users[id] !== name) {
        for (var u in users) {
            if (users[u] == name) {
                delete users[u];
            }
        }
        users[id] = name;

        if (adapter.config.rememberUsers) {
            adapter.setState('communicate.users', JSON.stringify(users));
        }
    }
}

function connect() {
    if (bot) {
        try {
            bot.initPolling();
        } catch (e) {
            
        }
        // Check connection
        bot.getMe().then(function (data) {
            adapter.log.info('getMe (reconnect): ' + JSON.stringify(data));
            adapter.setState('info.connection', true, true);
        });
    } else {
        // Setup polling way
        bot = new TelegramBot(adapter.config.token, {polling: true});

        // Check connection
        bot.getMe().then(function (data) {
            adapter.log.info('getMe: ' + JSON.stringify(data));
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
        bot.onText(/(.+)/, function (msg) {
            var now = new Date().getTime();

            // ignore all messages older than 30 seconds
            if (now - msg.date * 1000 > 30000) {
                adapter.log.warn('Message from ' + msg.from.name + ' ignored, becasue too old: ' + msg.text);
                bot.sendMessage(msg.from.id, _('Message ignored: ', systemLang) + msg.text);
                return;
            }

            // sometimes telegram sends messages like "message@user_name"
            var pos = msg.text.lastIndexOf('@');
            if (pos !== -1) msg.text = msg.text.substring(0, pos);

            if (msg.text === '/password') {
                bot.sendMessage(msg.from.id, _('Please enter password in form "/password phrase"', systemLang));
                return;
            }

            if (adapter.config.password) {
                // if user sent password
                var m = msg.text.match(/^\/password (.+)$/);
                if (!m) m = msg.text.match(/^\/p (.+)$/);

                if (m) {
                    if (adapter.config.password === m[1]) {
                        storeUser(msg.from.id, msg.from.first_name);
                        bot.sendMessage(msg.from.id, _('Welcome ', systemLang) + msg.from.first_name);
                        return;
                    } else {
                        adapter.log.warn('Got invalid password from ' + msg.from.first_name + ': ' + m[1]);
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

            storeUser(msg.from.id, msg.from.first_name);

            // Check set state
            m = msg.text.match(/^\/state (.+) (.+)$/);
            if (m) {
                var id1  = m[1];
                var val1 = m[2];
                // clear by timeout id
                var memoryLeak1 = setTimeout(function () {
                    msg         = null;
                    memoryLeak1 = null;
                    id1         = null;
                    val1        = null;
                }, 1000);

                adapter.getForeignState(id1, function (err, state) {
                    if (memoryLeak1) {
                        clearTimeout(memoryLeak1);
                        memoryLeak1 = null;
                        m = null;
                    }
                    if (msg) {
                        if (err) bot.sendMessage(msg.from.id, err);
                        if (state) {
                            adapter.setForeignState(id1, val1, function (err) {
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
            }

            // Check get state
            m = msg.text.match(/^\/state (.+)$/);
            if (m) {
                var id2 = m[1];
                // clear by timeout id
                var memoryLeak2 = setTimeout(function () {
                    id2         = null;
                    msg         = null;
                    memoryLeak2 = null;
                }, 1000);
                adapter.getForeignState(id2, function (err, state) {
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
                            bot.sendMessage(msg.from.id, _('ID "%s" not found.', systemLang).replace('%s', id1));
                        }
                    }
                });
                return;
            }

            adapter.log.debug('Got message from ' + msg.from.first_name + ': ' + msg.text);

            // Send to text2command
            if (adapter.config.text2command) {
                adapter.sendTo(adapter.config.text2command, 'send', {text: msg.text.replace(/\//g, '#').replace(/_/g, ' '), id: msg.chat.id, user: msg.from.first_name}, function (response) {
                    if (response && response.response) {
                        adapter.log.debug('Send response: ' + response.response);
                        bot.sendMessage(response.id, response.response);
                    }
                });
            }
            adapter.setState('communicate.requestChatId', msg.chat.id, function (err) {
                if (err) adapter.log.error(err);
            });
            adapter.setState('communicate.requestUserId', msg.user ? msg.user.id : '', function (err) {
                if (err) adapter.log.error(err);
            });
            adapter.setState('communicate.request', '[' + msg.from.first_name + ']' + msg.text, function (err) {
                if (err) adapter.log.error(err);
            });
        });
    }
}

function main() {

    if (!adapter.config.token) {
        adapter.log.error('Token is not set!');
        return;
    }

    adapter.subscribeStates('communicate.request');
    adapter.subscribeStates('communicate.response');

    // clear states
    adapter.setState('communicate.request',  '', true);
    adapter.setState('communicate.response', '', true);

    adapter.config.password = decrypt('Zgfr56gFe87jJON', adapter.config.password || '');

    if (adapter.config.rememberUsers) {
        adapter.getState('communicate.users', function (err, state) {
            if (err) adapter.log.error(err);
            if (state && state.val) {
                try {
                    users = JSON.parse(state.val);
                } catch (err) {
                    if (err) adapter.log.error(err);
                    adapter.log.error('Cannot parse stored user IDs!');
                }
            }
        });
    }

    adapter.config.users = adapter.config.users || '';
    adapter.config.users = adapter.config.users.split(',');
    adapter.config.rememberUsers = adapter.config.rememberUsers === 'true' || adapter.config.rememberUsers === true;

    for (var u = adapter.config.users.length - 1; u >= 0; u--) {
        adapter.config.users[u] = adapter.config.users[u].trim().toLowerCase();
        if (!adapter.config.users[u]) adapter.config.users.splice(u, 1);
    }

    adapter.getForeignObject('system.config', function (err, obj) {
        if (err) adapter.log.error(err);
        if (obj) {
            systemLang = obj.common.language || 'en';
        }
    });

    // init polling every hour
    reconnectTimer = setInterval(connect, 3600000);
    connect();
}

