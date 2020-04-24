'use strict';

if (typeof goog !== 'undefined') {
    goog.provide('Blockly.JavaScript.Sendto');

    goog.require('Blockly.JavaScript');
}

// remove it somewhen, because it defined in javascript=>blocks_words.js from javascript>=4.6.0
Blockly.Translate = Blockly.Translate || function (word, lang) {
    lang = lang || systemLang;
    if (Blockly.Words && Blockly.Words[word]) {
        return Blockly.Words[word][lang] || Blockly.Words[word].en;
    } else {
        return word;
    }
};

// --- SendTo telegram --------------------------------------------------
Blockly.Words['telegram']               = {'en': 'telegram',                    'pt': 'telegram',                       'pl': 'telegram',                           'nl': 'telegram',                       'it': 'telegram',                       'es': 'telegram',                       'fr': 'telegram',                           'de': 'telegram',                           'ru': 'telegram'};
Blockly.Words['telegram_message']       = {'en': 'message',                     'pt': 'mensagem',                       'pl': 'wiadomość',                          'nl': 'bericht',                        'it': 'Messaggio',                      'es': 'mensaje',                        'fr': 'message',                            'de': 'Meldung',                            'ru': 'сообщение'};
Blockly.Words['telegram_username']      = {'en': 'Recipient (optional)',        'pt': 'Nome do usuário (opcional)',     'pl': 'Nazwa użytkownika (opcjonalnie)',    'nl': 'Gebruikersnaam (optioneel)',     'it': 'Nome utente (facoltativo)',      'es': 'Nombre de usuario (opcional)',   'fr': 'Nom d\'utilisateur (facultatif)',    'de': 'Empfänger (optional)',               'ru': 'имя пользователя (не обяз.)'};
Blockly.Words['telegram_anyInstance']   = {'en': 'all instances',               'pt': 'todas as instâncias',            'pl': 'wszystkie przypadki',                'nl': 'alle instanties',                'it': 'tutte le istanze',               'es': 'todas las instancias',           'fr': 'toutes les instances',               'de': 'Alle Instanzen',                     'ru': 'На все драйвера'};
Blockly.Words['telegram_tooltip']       = {'en': 'Send message to telegram',    'pt': 'Enviar mensagem para telegrama', 'pl': 'Wyślij wiadomość do telegramu',      'nl': 'Stuur bericht naar telegram',    'it': 'Invia messaggio al telegramma',  'es': 'Enviar mensaje al telegrama',    'fr': 'Envoyer un message au télégramme',   'de': 'Sende eine Meldung über Telegram',   'ru': 'Послать сообщение через Telegram'};
Blockly.Words['telegram_log']           = {'en': 'log level',                   'pt': 'nível de log',                   'pl': 'poziom dziennika',                   'nl': 'Log niveau',                     'it': 'livello log',                    'es': 'nivel de registro',              'fr': 'niveau de journalisation',           'de': 'Loglevel',                           'ru': 'Протокол'};
Blockly.Words['telegram_log_none']      = {'en': 'none',                        'pt': 'Nenhum',                         'pl': 'Żaden',                              'nl': 'geen',                           'it': 'nessuna',                        'es': 'ninguna',                        'fr': 'aucun',                              'de': 'keins',                              'ru': 'нет'};
Blockly.Words['telegram_log_info']      = {'en': 'info',                        'pt': 'info',                           'pl': 'informacje',                         'nl': 'Info',                           'it': 'Informazioni',                   'es': 'información',                    'fr': 'Info',                               'de': 'info',                               'ru': 'инфо'};
Blockly.Words['telegram_log_debug']     = {'en': 'debug',                       'pt': 'depurar',                        'pl': 'odpluskwić',                         'nl': 'Debug',                          'it': 'Debug',                          'es': 'depurar',                        'fr': 'déboguer',                           'de': 'debug',                              'ru': 'debug'};
Blockly.Words['telegram_log_warn']      = {'en': 'warning',                     'pt': 'Atenção',                        'pl': 'ostrzeżenie',                        'nl': 'waarschuwing',                   'it': 'avvertimento',                   'es': 'advertencia',                    'fr': 'Attention',                          'de': 'warning',                            'ru': 'warning'};
Blockly.Words['telegram_log_error']     = {'en': 'error',                       'pt': 'erro',                           'pl': 'błąd',                               'nl': 'fout',                           'it': 'errore',                         'es': 'error',                          'fr': 'Erreur',                             'de': 'error',                              'ru': 'ошибка'};
Blockly.Words['telegram_help']          = {'en': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'pt': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'pl': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'nl': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'it': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'es': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'fr': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'de': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'ru': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md'};
Blockly.Words['telegram_silent']        = {'en': 'without notification',        'de': 'ohne Benachrichtigung',          'ru': 'без уведомления',                    'pt': 'sem notificação',                'nl': 'zonder kennisgeving',            'fr': 'sans notification',              'it': 'senza notifica',                     'es': 'sin notificación',                   'pl': 'bez powiadomienia'};

Blockly.Sendto.blocks['telegram'] =
    '<block type="telegram">'
    + '     <value name="INSTANCE">'
    + '     </value>'
    + '     <value name="MESSAGE">'
    + '         <shadow type="text">'
    + '             <field name="TEXT">text</field>'
    + '         </shadow>'
    + '     </value>'
    + '     <value name="USERNAME">'
    + '     </value>'
    + '     <value name="LOG">'
    + '     </value>'
    + '     <value name="SILENT">'
    + '     </value>'
    + '     <value name="PARSEMODE">'
    + '     </value>'
    + '</block>';

Blockly.Blocks['telegram'] = {
    init: function() {
        var options = [[Blockly.Translate('telegram_anyInstance'), '']];
        if (typeof main !== 'undefined' && main.instances) {
            for (var i = 0; i < main.instances.length; i++) {
                var m = main.instances[i].match(/^system.adapter.telegram.(\d+)$/);
                if (m) {
                    var k = parseInt(m[1], 10);
                    options.push(['telegram.' + k, '.' + k]);
                }
            }
            if (options.length === 0) {
                for (var u = 0; u <= 4; u++) {
                    options.push(['telegram.' + u, '.' + u]);
                }
            }
        } else {
            for (var n = 0; n <= 4; n++) {
                options.push(['telegram.' + n, '.' + n]);
            }
        }

        this.appendDummyInput('INSTANCE')
            .appendField(Blockly.Translate('telegram'))
            .appendField(new Blockly.FieldDropdown(options), 'INSTANCE');

        this.appendValueInput('MESSAGE')
            .appendField(Blockly.Translate('telegram_message'));

        var input = this.appendValueInput('USERNAME')
            .setCheck('String')
            .appendField(Blockly.Translate('telegram_username'));

        this.appendDummyInput('LOG')
            .appendField(Blockly.Translate('telegram_log'))
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Translate('telegram_log_none'),  ''],
                [Blockly.Translate('telegram_log_info'),  'log'],
                [Blockly.Translate('telegram_log_debug'), 'debug'],
                [Blockly.Translate('telegram_log_warn'),  'warn'],
                [Blockly.Translate('telegram_log_error'), 'error']
            ]), 'LOG');

        this.appendDummyInput('SILENT')
            .appendField(Blockly.Translate('telegram_silent'))
            .appendField(new Blockly.FieldCheckbox("FALSE"), "SILENT");

        this.appendDummyInput('PARSEMODE')
            .appendField("Parsemode")
            .appendField(new Blockly.FieldDropdown([["default","default"], ["HTML","HTML"], ["Markdown","Markdown"]]), "PARSEMODE");

        if (input.connection) input.connection._optional = true;

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Translate('telegram_tooltip'));
        this.setHelpUrl(Blockly.Translate('telegram_help'));
    }
};

Blockly.JavaScript['telegram'] = function(block) {
    var dropdown_instance = block.getFieldValue('INSTANCE');
    var logLevel = block.getFieldValue('LOG');
    var value_message = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC);
    var value_username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);
    var silent = block.getFieldValue('SILENT');
    var parsemode = block.getFieldValue('PARSEMODE');

    var logText;
    if (logLevel) {
        logText = 'console.' + logLevel + '("telegram' + (value_username ? '[' + value_username + ']' : '') + ': " + ' + value_message + ');\n'
    } else {
        logText = '';
    }

    return 'sendTo("telegram' + dropdown_instance + '", "send", {\n    text: ' +
        value_message + (value_username ? ', \n    ' + (value_username.startsWith('-',1) ? 'chatId: ' : 'user: ') + value_username : '') +
        (silent === 'TRUE' ? ', \n    disable_notification: true' : '') +
        (parsemode !== 'default' ? ', \n    parse_mode: "' + parsemode + '"': '') +
        '\n});\n' +
        logText;
};

// --- SendTo call telegram --------------------------------------------------
Blockly.Words['telegram_call']          = {'en': 'call via Telegram', 'de': 'per Telegramm anrufen', 'ru': 'звонок через Telegram', 'pt': 'chamada via Telegram', 'nl': 'bellen via Telegram', 'fr': 'appeler par Telegram', 'it': 'chiama via Telegram',    'es': 'llamar por Telegram', 'pl': 'połączenie za Telegram', 'zh-cn': '通过电报电话'};
Blockly.Words['telegram_call_system']   = {'en': 'System language', 'de': 'Systemsprache', 'ru': 'Системный язык', 'pt': 'Idioma do sistema', 'nl': 'Systeem taal', 'fr': 'Langue du système', 'it': 'Linguaggio di sistema', 'es': 'Lenguaje del sistema', 'pl': 'Język systemowy', 'zh-cn': '系统语言'};
Blockly.Words['telegram_call_tooltip']  = {'en': 'Call via Telegram and say some text', 'de': 'Rufen Sie per Telegram an und sagen Sie etwas Text','ru': 'Звоните через Telegram и произносите текст',    'pt': 'Ligue por Telegram e diga algum texto',    'nl': 'Bel via Telegram en zeg wat tekst',    'fr': 'Appelez par Telegram et dites du texte',    'it': 'Chiama via Telegram e pronuncia un messaggio',    'es': 'Llama por Telegram y di algo de texto',    'pl': 'Zadzwoń za pośrednictwem Telegram i powiedz tekst',    'zh-cn': '通过电报呼叫并说一些文字'};
Blockly.Words['telegram_call_help']     = {'en': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'pt': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'pl': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'nl': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'it': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'es': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'fr': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'de': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'ru': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram'};

Blockly.Sendto.blocks['telegram_call'] =
    '<block type="telegram_call">'
    + '     <value name="INSTANCE">'
    + '     </value>'
    + '     <value name="MESSAGE">'
    + '         <shadow type="text">'
    + '             <field name="TEXT">text</field>'
    + '         </shadow>'
    + '     </value>'
    + '     <value name="USERNAME">'
    + '          <shadow type="text">'
    + '             <field name="TEXT"></field>'
    + '         </shadow>'
    + '     </value>'
    + '     <value name="LANGUAGE">'
    + '     </value>'
    + '     <value name="LOG">'
    + '     </value>'
    + '</block>';

Blockly.Blocks['telegram_call'] = {
    init: function() {
        var options = [[Blockly.Translate('telegram_anyInstance'), '']];
        if (typeof main !== 'undefined' && main.instances) {
            for (var i = 0; i < main.instances.length; i++) {
                var m = main.instances[i].match(/^system.adapter.telegram.(\d+)$/);
                if (m) {
                    var k = parseInt(m[1], 10);
                    options.push(['telegram.' + k, '.' + k]);
                }
            }
            if (options.length === 0) {
                for (var u = 0; u <= 4; u++) {
                    options.push(['telegram.' + u, '.' + u]);
                }
            }
        } else {
            for (var n = 0; n <= 4; n++) {
                options.push(['telegram.' + n, '.' + n]);
            }
        }

        this.appendDummyInput('INSTANCE')
            .appendField(Blockly.Translate('telegram_call'))
            .appendField(new Blockly.FieldDropdown(options), 'INSTANCE');

        this.appendValueInput('MESSAGE')
            .appendField(Blockly.Translate('telegram_message'));

        var input = this.appendValueInput('USERNAME')
            .setCheck('String')
            .appendField(Blockly.Translate('telegram_username'));

        var languages = [
            [Blockly.Translate('telegram_call_system'), ''],
            ['German (Germany) (Female)', 'de-DE-Standard-A'],
            ['German (Germany) (Male)', 'de-DE-Standard-B'],
            ['English (US) (Male)', 'en-US-Standard-B'],
            ['English (US) (Female)', 'en-US-Standard-C'],
            ['English (US) (Male 2)', 'en-US-Standard-D'],
            ['English (US) (Female 2)', 'en-US-Standard-E'],
            ['Russian (Russia) (Female)', 'ru-RU-Standard-A'],
            ['Russian (Russia) (Male)', 'ru-RU-Standard-B'],
            ['Russian (Russia) (Female 2)', 'ru-RU-Standard-C'],
            ['Russian (Russia) (Male 2)', 'ru-RU-Standard-D'],
            ['Arabic (Female)', 'ar-XA-Standard-A'],
            ['Arabic (Male)', 'ar-XA-Standard-B'],
            ['Arabic (Male 2)', 'ar-XA-Standard-C'],
            ['Czech (Czech Republic) (Female)', 'cs-CZ-Standard-A'],
            ['Danish (Denmark) (Female)', 'da-DK-Standard-A'],
            ['Dutch (Netherlands) (Female)', 'nl-NL-Standard-A'],
            ['Dutch (Netherlands) (Male)', 'nl-NL-Standard-B'],
            ['Dutch (Netherlands) (Male 2)', 'nl-NL-Standard-C'],
            ['Dutch (Netherlands) (Female 2)', 'nl-NL-Standard-D'],
            ['Dutch (Netherlands) (Female 3)', 'nl-NL-Standard-E'],
            ['English (Australia) (Female)', 'en-AU-Standard-A'],
            ['English (Australia) (Male)', 'en-AU-Standard-B'],
            ['English (Australia) (Female 2)', 'en-AU-Standard-C'],
            ['English (Australia) (Male 2)', 'en-AU-Standard-D'],
            ['English (India) (Female)', 'en-IN-Standard-A'],
            ['English (India) (Male)', 'en-IN-Standard-B'],
            ['English (India) (Male 2)', 'en-IN-Standard-C'],
            ['English (UK) (Female)', 'en-GB-Standard-A'],
            ['English (UK) (Male)', 'en-GB-Standard-B'],
            ['English (UK) (Female 2)', 'en-GB-Standard-C'],
            ['English (UK) (Male 2)', 'en-GB-Standard-D'],
            ['Filipino (Philippines) (Female)', 'fil-PH-Standard-A'],
            ['Finnish (Finland) (Female)', 'fi-FI-Standard-A'],
            ['French (Canada) (Female)', 'fr-CA-Standard-A'],
            ['French (Canada) (Male)', 'fr-CA-Standard-B'],
            ['French (Canada) (Female 2)', 'fr-CA-Standard-C'],
            ['French (Canada) (Male 2)', 'fr-CA-Standard-D'],
            ['French (France) (Female)', 'fr-FR-Standard-A'],
            ['French (France) (Male)', 'fr-FR-Standard-B'],
            ['French (France) (Female 2)', 'fr-FR-Standard-C'],
            ['French (France) (Male 2)', 'fr-FR-Standard-D'],
            ['Greek (Greece) (Female)', 'el-GR-Standard-A'],
            ['Hindi (India) (Female)', 'hi-IN-Standard-A'],
            ['Hindi (India) (Male)', 'hi-IN-Standard-B'],
            ['Hindi (India) (Male 2)', 'hi-IN-Standard-C'],
            ['Hungarian (Hungary) (Female)', 'hu-HU-Standard-A'],
            ['Indonesian (Indonesia) (Female)', 'id-ID-Standard-A'],
            ['Indonesian (Indonesia) (Male)', 'id-ID-Standard-B'],
            ['Indonesian (Indonesia) (Male 2)', 'id-ID-Standard-C'],
            ['Italian (Italy) (Female)', 'it-IT-Standard-A'],
            ['Italian (Italy) (Female 2)', 'it-IT-Standard-B'],
            ['Italian (Italy) (Male)', 'it-IT-Standard-C'],
            ['Italian (Italy) (Male 2)', 'it-IT-Standard-D'],
            ['Japanese (Japan) (Female)', 'ja-JP-Standard-A'],
            ['Japanese (Japan) (Female 2)', 'ja-JP-Standard-B'],
            ['Japanese (Japan) (Male)', 'ja-JP-Standard-C'],
            ['Japanese (Japan) (Male 2)', 'ja-JP-Standard-D'],
            ['Korean (South Korea) (Female)', 'ko-KR-Standard-A'],
            ['Korean (South Korea) (Female 2)', 'ko-KR-Standard-B'],
            ['Korean (South Korea) (Male)', 'ko-KR-Standard-C'],
            ['Korean (South Korea) (Male 2)', 'ko-KR-Standard-D'],
            ['Mandarin Chinese (Female)', 'cmn-CN-Standard-A'],
            ['Mandarin Chinese (Male)', 'cmn-CN-Standard-B'],
            ['Mandarin Chinese (Male 2)', 'cmn-CN-Standard-C'],
            ['Norwegian (Norway) (Female)', 'nb-NO-Standard-A'],
            ['Norwegian (Norway) (Male)', 'nb-NO-Standard-B'],
            ['Norwegian (Norway) (Female 2)', 'nb-NO-Standard-C'],
            ['Norwegian (Norway) (Male 2)', 'nb-NO-Standard-D'],
            ['Norwegian (Norway) (Female 3)', 'nb-no-Standard-E'],
            ['Polish (Poland) (Female)', 'pl-PL-Standard-A'],
            ['Polish (Poland) (Male)', 'pl-PL-Standard-B'],
            ['Polish (Poland) (Male 2)', 'pl-PL-Standard-C'],
            ['Polish (Poland) (Female 2)', 'pl-PL-Standard-D'],
            ['Polish (Poland) (Female 3)', 'pl-PL-Standard-E'],
            ['Portuguese (Brazil) (Female)', 'pt-BR-Standard-A'],
            ['Portuguese (Portugal) (Female)', 'pt-PT-Standard-A'],
            ['Portuguese (Portugal) (Male)', 'pt-PT-Standard-B'],
            ['Portuguese (Portugal) (Male 2)', 'pt-PT-Standard-C'],
            ['Portuguese (Portugal) (Female 2)', 'pt-PT-Standard-D'],
            ['Slovak (Slovakia) (Female)', 'sk-SK-Standard-A'],
            ['Spanish (Spain) (Female)', 'es-ES-Standard-A'],
            ['Swedish (Sweden) (Female)', 'sv-SE-Standard-A'],
            ['Turkish (Turkey) (Female)', 'tr-TR-Standard-A'],
            ['Turkish (Turkey) (Male)', 'tr-TR-Standard-B'],
            ['Turkish (Turkey) (Female 2)', 'tr-TR-Standard-C'],
            ['Turkish (Turkey) (Female 3)', 'tr-TR-Standard-D'],
            ['Turkish (Turkey) (Male)', 'tr-TR-Standard-E'],
            ['Ukrainian (Ukraine) (Female)', 'uk-UA-Standard-A'],
            ['Vietnamese (Vietnam) (Female)', 'vi-VN-Standard-A'],
            ['Vietnamese (Vietnam) (Male)', 'vi-VN-Standard-B'],
            ['Vietnamese (Vietnam) (Female 2)', 'vi-VN-Standard-C'],
            ['Vietnamese (Vietnam) (Male 2)', 'vi-VN-Standard-D']
        ];

        this.appendDummyInput('LANGUAGE')
            .appendField(Blockly.Translate('telegram'))
            .appendField(new Blockly.FieldDropdown(languages), 'LANGUAGE');

        this.appendDummyInput('LOG')
            .appendField(Blockly.Translate('telegram_log'))
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Translate('telegram_log_none'),  ''],
                [Blockly.Translate('telegram_log_info'),  'log'],
                [Blockly.Translate('telegram_log_debug'), 'debug'],
                [Blockly.Translate('telegram_log_warn'),  'warn'],
                [Blockly.Translate('telegram_log_error'), 'error']
            ]), 'LOG');

        if (input.connection) {
            input.connection._optional = true;
        }

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Translate('telegram_call_tooltip'));
        this.setHelpUrl(Blockly.Translate('telegram_call_help'));
    }
};

Blockly.JavaScript['telegram_call'] = function(block) {
    var dropdown_instance = block.getFieldValue('INSTANCE');
    var dropdown_language = block.getFieldValue('LANGUAGE');
    var logLevel = block.getFieldValue('LOG');
    var value_message = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC);
    var value_username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);

    var logText;
    if (logLevel) {
        logText = 'console.' + logLevel + '("telegramCall' + (value_username ? '[' + value_username + ']' : '') + ': " + ' + value_message + ');\n'
    } else {
        logText = '';
    }

    return 'sendTo("telegram' + dropdown_instance + '", "call", {' +
        '\n    text: ' + value_message +
        (value_username ? ',\n    ' + 'user: ' + value_username : '') +
        ',\n    lang: "' + dropdown_language + '"' +
        '\n});\n' +
        logText;
};

