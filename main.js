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

adapter.on('message', function (obj) {
    if (obj) processMessage(obj);
    processMessages();
});

adapter.on('ready',   function () {
    main();
});

adapter.on('unload',  function () {
    if (adapter.config.rememberUsers) {
        sendMessage(_('Restarting...'));
    } else {
        sendMessage(_('Restarting... Reauthenticate!'));
    }
    adapter.setState('info.connection', false, true);
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (state && !state.ack && id.indexOf('communicate.response') !== -1) {
        // Send to someone this message
        sendMessage(state.val);
    }
});

function sendMessage(text, user) {
    if (!text && text !== 0) {
        adapter.log.warn('Invalid text: null');
        return;
    }
    // convert
    text = text.toString();

    var count = 0;
    var u;
    if (user) {
        for (u in users) {
            if (users[u] == user) {
                count++;
                if (text.match(/\.(jpg|png|jpeg|bmp)$/i) && fs.existsSync(text)) {
                    adapter.log.debug('Send photo to "' + user + '": ' + text);
                    bot.sendPhoto(u, text);
                } else {
                    adapter.log.debug('Send message to "' + user + '": ' + text);
                    bot.sendMessage(u, text);
                }
                break;
            }
        }
        return count;
    }

    var m = text.match(/\b@(.+)\b/);
    if (m) {
        text = text.replace('@' + m[1], '').trim().replace(/\s\s/g, ' ');
        for (u in users) {
            if (users[u] == m[1]) {
                count++;
                if (text.match(/\.(jpg|png|jpeg|bmp)$/i) && fs.existsSync(text)) {
                    adapter.log.debug('Send photo to "' + m[1] + '": ' + text);
                    bot.sendPhoto(u, text);
                } else {
                    adapter.log.debug('Send message to "' + m[1] + '": ' + text);
                    bot.sendMessage(u, text);
                }
                break;
            }
        }
    } else {
        // Send to all users
        for (u in users) {
            count++;
            if (text.match(/\.(jpg|png|jpeg|bmp)$/i) && fs.existsSync(text)) {
                adapter.log.debug('Send photo to "' + users[u] + '": ' + text);
                bot.sendPhoto(u, text);
            } else {
                adapter.log.debug('Send message to "' + users[u] + '": ' + text);
                bot.sendMessage(u, text);
            }
            //break;
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
                    count = sendMessage(obj.message.text, obj.message.user);
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

    // Setup polling way
    bot = new TelegramBot(adapter.config.token, {polling: true});

    // Check connection
    bot.getMe().then(function (data) {
        adapter.log.info('getMe: ' + JSON.stringify(data));
        adapter.setState('info.connection', true, true);
        sendMessage(_('Started!'));
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

        if (msg.text == '/password') {
            bot.sendMessage(msg.from.id, _('Please enter password in form "/password phrase"', systemLang));
            return;
        }


        if (adapter.config.password) {
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


        // todo support commands: state, instances, running, restart
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
            adapter.sendTo(adapter.config.text2command, 'send', {text: msg.text, id: msg.from.id, user: msg.from.first_name}, function (response) {
                if (response && response.response) {
                    adapter.log.debug('Send response: ' + response.response);
                    bot.sendMessage(response.id, response.response);
                }
            });
        }

        adapter.setState('communicate.request', '[' + msg.from.first_name + ']' + msg.text, function (err) {
            if (err) adapter.log.error(err);
        });
    });

    // Any kind of message
    /*bot.on('message', function (msg) {
        var now = new Date().getTime();
        // ignore all messages older than 30 seconds
        if (now - msg.date * 1000 > 30000) {
            bot.sendMessage(msg.from.id, 'Message ignored: ' + msg.text);
        }

        //var chatId = msg.chat.id;
        // photo can be: a file path, a stream or a Telegram file_id
        //var photo = 'cats.png';
        //bot.sendPhoto(chatId, photo, {caption: 'Lovely kittens'});
        bot.sendMessage(msg.from.id, 'Got it!' + msg.text);
    });*/
}

