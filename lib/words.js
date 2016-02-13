var systemDictionary = {
    "Message ignored: ":  {"en": "Message ignored: ",  "de": "Meldung wurde ignoriert: ",  "ru": "Сообщение проигнорировано: "},
    "Welcome ":  {"en": "Welcome ",  "de": "Hallo ",  "ru": "Добро пожаловать "},
    "Please enter password in form \"/password phrase\"": {
        "en": "Please enter password in form \"/password phrase\"",
        "de": "Bitte geben Sie das Kennwort ein: \"/password phrase\"",
        "ru": "Пожалуйста введите пароль: \"/password phrase\""
    },
    "Invalid password":  {"en": "Invalid password!",  "de": "Falsches Kennwort!",  "ru": "Неправильный пароль!"},
    "Restarting... Reauthenticate!":  {
        "en": "Restarting... Reauthenticate!",
        "de": "Bot reboot. Password muss neu eingegeben werden!",
        "ru": "Перезапуск бота. Нужно ввести пароль!"
    }
};

module.exports = function (text, lang) {
    if (systemDictionary[text]) {
        return systemDictionary[text][lang] || systemDictionary[text].en || text;
    } else {
        return text;
    }
};