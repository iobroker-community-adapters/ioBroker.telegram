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
'use strict';

var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = utils.Adapter('telegram');
var _ = require(__dirname + '/lib/words.js');
var TelegramBot = require('node-telegram-bot-api');
var fs = require('fs');
var LE = require(utils.controllerDir + '/lib/letsencrypt.js');

var bot;
var users = {};
var systemLang = 'en';
var reconnectTimer = null;
var lastMessageTime = 0;
var lastMessageText = '';
var callbackQueryId = 0;

var server = {
    app: null,
    server: null,
    settings: adapter.config
};

adapter.on('message', function (obj) {
    if (obj) processMessage(obj);
    processMessages();
});

adapter.on('ready', function () {
    adapter.config.server = adapter.config.server === 'true';

    if (adapter.config.server) {
        adapter.config.port = parseInt(adapter.config.port, 10);

        // Load certificates
        adapter.getCertificates(function (err, certificates, leConfig) {
            adapter.config.certificates = certificates;
            adapter.config.leConfig = leConfig;
            adapter.config.secure = true;

            server.server = LE.createServer(handleWebHook, adapter.config, adapter.config.certificates, adapter.config.leConfig, adapter.log);
            if (server.server) {
                server.server.__server = server;
                adapter.getPort(adapter.config.port, function (port) {
                    if (parseInt(port, 10) !== adapter.config.port && !adapter.config.findNextPort) {
                        adapter.log.error('port ' + adapter.config.port + ' already in use');
                        process.exit(1);
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

adapter.on('unload', function () {
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
adapter.on('stateChange', function (id, state) {
    if (state && !state.ack && id.indexOf('communicate.response') !== -1) {
        // Send to someone this message
        sendMessage(state.val);
    }
});

var actions = [
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
        var body = '';
        req.on('data', function (data) {
            body += data;
            if (body.length > 100000) {
                res.writeHead(413, 'Request Entity Too Large', {'Content-Type': 'text/html'});
                res.end('<!doctype html><html><head><title>413</title></head><body>413: Request Entity Too Large</body></html>');
            }
        });
        req.on('end', function () {
            try {
                var msg = JSON.parse(body);
            } catch (e) {
                adapter.log.error('Cannot parse webhook response!: ' + e);
                return;
            }
            res.end('OK');
            bot.processUpdate(msg);
        });
    } else {
        res.writeHead(404, 'Resource Not Found', {'Content-Type': 'text/html'});
        res.end('<!doctype html><html><head><title>404</title></head><body>404: Resource Not Found</body></html>');
    }
}

function _sendMessageHelper(dest, name, text, options) {
    var count = 0;
    if (options && options.latitude !== undefined) {
        adapter.log.debug('Send location to "' + name + '": ' + text);
        if (bot) {
            bot.sendLocation(dest, parseFloat(options.latitude), parseFloat(options.longitude), options).then(function () {
                adapter.log.debug('Location sent');
                options = null;
                count++;
            }, function (error) {
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
        if (bot) bot.sendChatAction(dest, text).then(function () {
            adapter.log.debug('Action sent');
            options = null;
            count++;
        }, function (error) {
            if (options.chatId) {
                adapter.log.error('Cannot send action [chatId - ' + options.chatId + ']: ' + error);
            } else {
                adapter.log.error('Cannot send action [user - ' + options.user + ']: ' + error);
            }
            options = null;
        });
    } else if (text && text.match(/\.webp$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send video to "' + name + '": ' + text);
        if (bot) {
            bot.sendSticker(dest, text, options).then(function () {
                options = null;
                adapter.log.debug('Sticker sent');
                count++;
            }, function (error) {
                if (options.chatId) {
                    adapter.log.error('Cannot send sticker [chatId - ' + options.chatId + ']: ' + error);
                } else {
                    adapter.log.error('Cannot send sticker [user - ' + options.user + ']: ' + error);
                }
                options = null;
            });
        }
    } else if (text && text.match(/\.(mp4|gif)$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send video to "' + name + '": ' + text);
        if (bot) {
            bot.sendVideo(dest, text, options).then(function () {
                adapter.log.debug('Video sent');
                options = null;
                count++;
            }, function (error) {
                if (options.chatId) {
                    adapter.log.error('Cannot send video [chatId - ' + options.chatId + ']: ' + error);
                } else {
                    adapter.log.error('Cannot send video [user - ' + options.user + ']: ' + error);
                }
                options = null;
            });
        }
    } else if (text && text.match(/\.(txt|doc|docx|csv)$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send document to "' + name + '": ' + text);
        if (bot) {
            bot.sendDocument(dest, text, options).then(function () {
                adapter.log.debug('Document sent');
                options = null;
                count++;
            }, function (error) {
                if (options.chatId) {
                    adapter.log.error('Cannot send document [chatId - ' + options.chatId + ']: ' + error);
                } else {
                    adapter.log.error('Cannot send document [user - ' + options.user + ']: ' + error);
                }
                options = null;
            });
        }
    } else if (text && text.match(/\.(wav|mp3|ogg)$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send audio to "' + name + '": ' + text);
        if (bot) {
            bot.sendAudio(dest, text, options).then(function () {
                adapter.log.debug('Audio sent');
                options = null;
                count++;
            }, function (error) {
                if (options.chatId) {
                    adapter.log.error('Cannot send audio [chatId - ' + options.chatId + ']: ' + error);
                } else {
                    adapter.log.error('Cannot send audio [user - ' + options.user + ']: ' + error);
                }
                options = null;
            });
        }
    } else if (text && text.match(/\.(jpg|png|jpeg|bmp)$/i) && fs.existsSync(text)) {
        adapter.log.debug('Send photo to "' + name + '": ' + text);
        if (bot) {
            bot.sendPhoto(dest, text, options).then(function () {
                adapter.log.debug('Photo sent');
                options = null;
                count++;
            }, function (error) {
                if (options.chatId) {
                    adapter.log.error('Cannot send photo [chatId - ' + options.chatId + ']: ' + error);
                } else {
                    adapter.log.error('Cannot send photo [user - ' + options.user + ']: ' + error);
                }
                options = null;
            });
        }
    } else if (options && options.answerCallbackQuery !== undefined) {
        adapter.log.debug('Send answerCallbackQuery to "' + name +'"');
        if (options.answerCallbackQuery.showAlert === undefined) {
            options.answerCallbackQuery.showAlert = false;
        }
        if (bot) {
            bot.answerCallbackQuery(callbackQueryId,options.answerCallbackQuery.text,options.answerCallbackQuery.showAlert).then(function () {
                options = null;
                count++;
            }, function (error) {
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
            bot.editMessageReplyMarkup(options.editMessageReplyMarkup.reply_markup, options.editMessageReplyMarkup.options).then(function () {
                options = null;
                count++;
            }, function (error) {
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
            bot.editMessageText(text, options.editMessageText.options).then(function () {
                options = null;
                count++;
            }, function (error) {
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
            bot.deleteMessage(options.deleteMessage.options.chat_id, options.deleteMessage.options.message_id).then(function () {
                options = null;
                count++;
            }, function (error) {
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
            bot.sendMessage(dest, text || '', options).then(function () {
                adapter.log.debug('Message sent');
                options = null;
                count++;
            }, function (error) {
                if (options.chatId) {
                    adapter.log.error('Cannot send message [chatId - ' + options.chatId + ']: ' + error);
                } else {
                    adapter.log.error('Cannot send message [user - ' + options.user + ']: ' + error);
                }
                options = null;
            });
        }
    }

    return count;
}

function sendMessage(text, user, chatId, options) {
    if (!text && (typeof options !== 'object'))  {
        if (!text && text !== 0 && (!options || !options.latitude)) {
            adapter.log.warn('Invalid text: null');
            return;
        }
    }

    if (options) {
        if (options.chatId !== undefined) delete options.chatId;
        if (options.text !== undefined)   delete options.text;
        if (options.user !== undefined)   delete options.user;
    }

    // convert
    if (text !== undefined && text !== null) {
        text = text.toString();
    }

    if (chatId) {
        return _sendMessageHelper(chatId, 'chat', text, options);
    }

    var count = 0;
    var u;

    if (user) {
        for (u in users) {
            if (users[u] === user) {
                count +=_sendMessageHelper(u, user, text, options);
                break;
            }
        }
        return count;
    }

    var m = typeof text === 'string' ? text.match(/^@(.+?)\b/) : null;
    if (m) {
        text = text.replace('@' + m[1], '').trim().replace(/\s\s/g, ' ');
        for (u in users) {
            var re = new RegExp(m[1], 'i');
            if (users[u].match(re)) {
                count +=_sendMessageHelper(u, m[1], text, options);
                break;
            }
        }
    } else {
        // Send to all users
        for (u in users) {
            count += _sendMessageHelper(u, users[u], text, options);
        }
    }
    return count;
}

function processMessage(obj) {
    if (!obj || !obj.command) return;
    // Ignore own answers
    if (obj.message && obj.message.response) return;

    // filter out double messages
    var json = JSON.stringify(obj);
    if (lastMessageTime && lastMessageText === JSON.stringify(obj) && new Date().getTime() - lastMessageTime < 1200) {
        adapter.log.debug('Filter out double message [first was for ' + (new Date().getTime() - lastMessageTime) + 'ms]: ' + json);
        return;
    }

    lastMessageTime = new Date().getTime();
    lastMessageText = json;

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
            if (users[u] === name) {
                delete users[u];
            }
        }
        users[id] = name;

        if (adapter.config.rememberUsers) {
            adapter.setState('communicate.users', JSON.stringify(users));
        }
    }
}

function processTelegramText(msg) {
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
        var id1 = m[1];
        var val1 = m[2];
        // clear by timeout id
        var memoryLeak1 = setTimeout(function () {
            msg = null;
            memoryLeak1 = null;
            id1 = null;
            val1 = null;
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
            id2 = null;
            msg = null;
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
        adapter.sendTo(adapter.config.text2command, 'send', {
            text: msg.text.replace(/\//g, '#').replace(/_/g, ' '),
            id: msg.chat.id,
            user: msg.from.first_name
        }, function (response) {
            if (response && response.response) {
                adapter.log.debug('Send response: ' + response.response);
                bot.sendMessage(response.id, response.response);
            }
        });
    }
    adapter.setState('communicate.requestChatId', msg.chat.id, function (err) {
        if (err) adapter.log.error(err);
    });
    adapter.setState('communicate.requestMessageId', msg.message_id, function (err) {
        if (err) adapter.log.error(err);
    });
    adapter.setState('communicate.requestUserId', msg.user ? msg.user.id : '', function (err) {
        if (err) adapter.log.error(err);
    });
    adapter.setState('communicate.request', '[' + msg.from.first_name + ']' + msg.text, function (err) {
        if (err) adapter.log.error(err);
    });
}

function connect() {
    if (bot) {
        if (!adapter.config.server) {
            try {
                if (bot.isPolling())
                    adapter.log.debug('bot polling OK');
                else {
                    adapter.log.debug('bot restarting...');
                    bot.stopPolling().then(
                        function (response) {
                            adapter.log.debug('Start Polling');
                            bot.startPolling();
                        },
                        function (error) {
                            adapter.log.error('Error stop polling: ' + error);
                        }
                    );
                }
            } catch (e) {

            }
        }
        // Check connection
        bot.getMe().then(function (data) {
            adapter.log.info('getMe (reconnect): ' + JSON.stringify(data));
            adapter.setState('info.connection', true, true);
        });
    } else {
        if (adapter.config.server) {
            // Setup server way
            bot = new TelegramBot(adapter.config.token, {polling: false, filepath: true});
            if (adapter.config.url[adapter.config.url.length - 1] === '/') {
                adapter.config.url = adapter.config.url.substring(0, adapter.config.url.length - 1);
            }
            bot.setWebHook(adapter.config.url + '/' + adapter.config.token);
        } else {
            // Setup polling way
            bot = new TelegramBot(adapter.config.token, {polling: true, filepath: true});
            bot.setWebHook('');
        }

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
        bot.onText(/(.+)/, processTelegramText);
        bot.on('message', function (msg) {
          adapter.log.debug('Received message: ' + JSON.stringify(msg));
        });
        // callback InlineKeyboardButton
        bot.on('callback_query', function (msg) {
        // write received answer into variable
            adapter.log.debug('callback_query: ' + JSON.stringify(msg));
            callbackQueryId = msg.id;
            adapter.setState('communicate.requestMessageId', msg.message.message_id, function (err) {
                if (err) adapter.log.error(err);
            });
            adapter.setState('communicate.request', '[' + msg.from.first_name + ']' + msg.data, function (err) {
                if (err) adapter.log.error(err);
            });    
        });
        bot.on('polling_error', function (error) {
          adapter.log.error('polling_error:' + error.code + ', ' + error);  // => 'EFATAL'
        });
        bot.on('webhook_error', function (error) {
          adapter.log.error('webhook_error:' + error.code + ', ' + error);  // => 'EPARSE'
          adapter.log.debug('bot restarting...');
          bot.stopPolling().then(
              function (response) {
                  adapter.log.debug('Start Polling');
                  bot.startPolling();
              },
              function (error) {
                  adapter.log.error('Error stop polling: ' + error);
              }
          );
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
    adapter.setState('communicate.request', '', true);
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

