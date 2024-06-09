'use strict';

if (typeof goog !== 'undefined') {
    goog.provide('Blockly.JavaScript.Sendto');
    goog.require('Blockly.JavaScript');
}

// --- SendTo telegram --------------------------------------------------
Blockly.Words['telegram']               = {'en': 'telegram',                        'pt': 'telegram',                       'pl': 'telegram',                           'nl': 'telegram',                       'it': 'telegram',                       'es': 'telegram',                       'fr': 'telegram',                           'de': 'telegram',                           'ru': 'telegram'};
Blockly.Words['telegram_message']       = {'en': 'message',                         'pt': 'mensagem',                       'pl': 'wiadomość',                          'nl': 'bericht',                        'it': 'Messaggio',                      'es': 'mensaje',                        'fr': 'message',                            'de': 'Meldung',                            'ru': 'сообщение'};
Blockly.Words['telegram_username']      = {'en': 'Recipient (Username, optional)',  'pt': 'Destinatário (nome de usuário, opcional)', 'de': 'Empfänger (Benutzername, optional)',    'ru': 'Получатель (имя пользователя, необязательно)',       'nl': 'Ontvanger (gebruikersnaam, optioneel)',    'fr': 'Destinataire (nom d\'utilisateur, facultatif)',    'it': 'Destinatario (Nome utente, facoltativo)',    'es': 'Destinatario (nombre de usuario, opcional)',    'pl': 'Odbiorca (nazwa użytkownika, opcjonalnie)',    'zh-cn': '收件人（用户名，可选）'  };
Blockly.Words['telegram_chatid']        = {'en': 'Recipient (Chat-ID, optional)',   'de': 'Empfänger (Chat-ID, optional)',    'ru': 'Получатель (Chat-ID, необязательно)',    'pt': 'Destinatário (Chat-ID, opcional)',    'nl': 'Ontvanger (Chat-ID, optioneel)',    'fr': 'Destinataire (Chat-ID, facultatif)',    'it': 'Destinatario (ID chat, facoltativo)',    'es': 'Destinatario (Chat-ID, opcional)',    'pl': 'Odbiorca (identyfikator czatu, opcjonalnie)',    'zh-cn': '收件人（聊天 ID，可选）'  };
Blockly.Words['telegram_anyInstance']   = {'en': 'all instances',                   'pt': 'todas as instâncias',            'pl': 'wszystkie przypadki',                'nl': 'alle instanties',                'it': 'tutte le istanze',               'es': 'todas las instancias',           'fr': 'toutes les instances',               'de': 'Alle Instanzen',                     'ru': 'На все драйвера'};
Blockly.Words['telegram_tooltip']       = {'en': 'Send message to telegram',        'pt': 'Enviar mensagem para telegrama', 'pl': 'Wyślij wiadomość do telegramu',      'nl': 'Stuur bericht naar telegram',    'it': 'Invia messaggio al telegramma',  'es': 'Enviar mensaje al telegrama',    'fr': 'Envoyer un message au télégramme',   'de': 'Sende eine Meldung über Telegram',   'ru': 'Послать сообщение через Telegram'};
Blockly.Words['telegram_log']           = {'en': 'log level',                       'pt': 'nível de log',                   'pl': 'poziom dziennika',                   'nl': 'Log niveau',                     'it': 'livello log',                    'es': 'nivel de registro',              'fr': 'niveau de journalisation',           'de': 'Loglevel',                           'ru': 'Протокол'};
Blockly.Words['telegram_log_none']      = {'en': 'none',                            'pt': 'Nenhum',                         'pl': 'Żaden',                              'nl': 'geen',                           'it': 'nessuna',                        'es': 'ninguna',                        'fr': 'aucun',                              'de': 'keins',                              'ru': 'нет'};
Blockly.Words['telegram_log_info']      = {'en': 'info',                            'pt': 'info',                           'pl': 'informacje',                         'nl': 'Info',                           'it': 'Informazioni',                   'es': 'información',                    'fr': 'Info',                               'de': 'info',                               'ru': 'инфо'};
Blockly.Words['telegram_log_debug']     = {'en': 'debug',                           'pt': 'depurar',                        'pl': 'odpluskwić',                         'nl': 'Debug',                          'it': 'Debug',                          'es': 'depurar',                        'fr': 'déboguer',                           'de': 'debug',                              'ru': 'debug'};
Blockly.Words['telegram_log_warn']      = {'en': 'warning',                         'pt': 'Atenção',                        'pl': 'ostrzeżenie',                        'nl': 'waarschuwing',                   'it': 'avvertimento',                   'es': 'advertencia',                    'fr': 'Attention',                          'de': 'warning',                            'ru': 'warning'};
Blockly.Words['telegram_log_error']     = {'en': 'error',                           'pt': 'erro',                           'pl': 'błąd',                               'nl': 'fout',                           'it': 'errore',                         'es': 'error',                          'fr': 'Erreur',                             'de': 'error',                              'ru': 'ошибка'};
Blockly.Words['telegram_help']          = {'en': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'pt': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'pl': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'nl': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'it': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'es': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'fr': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'de': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'ru': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md'};
Blockly.Words['telegram_silent']        = {'en': 'without notification',        'de': 'ohne Benachrichtigung',          'ru': 'без уведомления',                    'pt': 'sem notificação',                'nl': 'zonder kennisgeving',            'fr': 'sans notification',              'it': 'senza notifica',                     'es': 'sin notificación',                   'pl': 'bez powiadomienia'};
Blockly.Words['telegram_escaping']      = {'en': 'Escape chars',                'de': 'Escapezeichen verwenden',                   'ru': 'Escape',                       'pt': 'escape chars',                   'nl': 'escape chars',                    'fr': 'escape chars',                  'it': 'escape chars',                        'es': 'escape chars',                      'pl': 'escape chars', 'zh-cn': 'escape chars'};
Blockly.Words['telegram_disable_web_preview'] = {'en': 'disable web preview',   'de': 'Webvorschau deaktivieren', 'ru': 'отключить предварительный просмотр в Интернете', 'pt': 'desativar a visualização da web', 'nl': 'webvoorbeeld uitschakelen', 'fr': 'désactiver l\'aperçu Web','it': 'disabilitare l\'anteprima web', 'es': 'deshabilitar la vista previa web', 'pl': 'wyłącz podgląd internetowy', 'zh-cn': '禁用网页预览'};

Blockly.Sendto.blocks['telegram'] =
    '<block type="telegram">' +
    '  <field name="INSTANCE"></field>' +
    '  <field name="LOG"></field>' +
    '  <field name="SILENT">FALSE</field>' +
    '  <field name="PARSEMODE">default</field>' +
    '  <field name="ESCAPING">FALSE</field>' +
    '  <field name="DISABLE_WEB_PAGE_PREVIEW">FALSE</field>' +
    '  <value name="MESSAGE">' +
    '    <shadow type="text">' +
    '      <field name="TEXT">text</field>' +
    '    </shadow>' +
    '  </value>' +
    '</block>';

Blockly.Blocks['telegram'] = {
    init: function () {
        const options = [[Blockly.Translate('telegram_anyInstance'), '']];
        if (typeof main !== 'undefined' && main.instances) {
            for (let i = 0; i < main.instances.length; i++) {
                const m = main.instances[i].match(/^system.adapter.telegram.(\d+)$/);
                if (m) {
                    const k = parseInt(m[1], 10);
                    options.push(['telegram.' + k, '.' + k]);
                }
            }
            if (options.length === 0) {
                for (let u = 0; u <= 4; u++) {
                    options.push(['telegram.' + u, '.' + u]);
                }
            }
        } else {
            for (let n = 0; n <= 4; n++) {
                options.push(['telegram.' + n, '.' + n]);
            }
        }

        this.appendDummyInput('INSTANCE')
            .appendField(Blockly.Translate('telegram'))
            .appendField(new Blockly.FieldDropdown(options), 'INSTANCE');

        this.appendValueInput('MESSAGE')
            .appendField(Blockly.Translate('telegram_message'));

        const inputUser = this.appendValueInput('USERNAME')
            .setCheck('String')
            .appendField(Blockly.Translate('telegram_username'));
        if (inputUser.connection) {
            inputUser.connection._optional = true;
        }

        const inputChat = this.appendValueInput('CHATID')
            .setCheck('String')
            .appendField(Blockly.Translate('telegram_chatid'));
        if (inputChat.connection) {
            inputChat.connection._optional = true;
        }

        this.appendDummyInput('LOG')
            .appendField(Blockly.Translate('telegram_log'))
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Translate('telegram_log_none'),  ''],
                [Blockly.Translate('telegram_log_debug'), 'debug'],
                [Blockly.Translate('telegram_log_info'),  'log'],
                [Blockly.Translate('telegram_log_warn'),  'warn'],
                [Blockly.Translate('telegram_log_error'), 'error'],
            ]), 'LOG');

        this.appendDummyInput('SILENT')
            .appendField(Blockly.Translate('telegram_silent'))
            .appendField(new Blockly.FieldCheckbox('FALSE'), 'SILENT');

        this.appendDummyInput('PARSEMODE')
            .appendField('Parsemode')
            .appendField(new Blockly.FieldDropdown([['default', 'default'], ['HTML', 'HTML'], ['MarkdownV2', 'MarkdownV2']]), 'PARSEMODE');

        this.appendDummyInput('ESCAPING')
            .appendField(Blockly.Translate('telegram_escaping'))
            .appendField(new Blockly.FieldCheckbox('FALSE'), 'ESCAPING');

        this.appendDummyInput('DISABLE_WEB_PAGE_PREVIEW')
            .appendField(Blockly.Translate('telegram_disable_web_preview'))
            .appendField(new Blockly.FieldCheckbox('FALSE'), 'DISABLE_WEB_PAGE_PREVIEW');

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Translate('telegram_tooltip'));
        this.setHelpUrl(Blockly.Translate('telegram_help'));
    },
};

Blockly.JavaScript['telegram'] = function (block) {
    const dropdown_instance = block.getFieldValue('INSTANCE');
    const logLevel = block.getFieldValue('LOG');
    let value_message = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC);
    const value_username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);
    const value_chatid = Blockly.JavaScript.valueToCode(block, 'CHATID', Blockly.JavaScript.ORDER_ATOMIC);
    const silent = block.getFieldValue('SILENT');
    const escaping = block.getFieldValue('ESCAPING');
    const disable_web_page_preview = block.getFieldValue('DISABLE_WEB_PAGE_PREVIEW');
    const parsemode = block.getFieldValue('PARSEMODE');

    let logText = '';
    if (logLevel) {
        const logUsername = value_username ? `[' + ${value_username} + ']` : '';
        logText = `console.${logLevel}('telegram${logUsername}: ' + ${value_message});\n`;
    }

    if (escaping === 'TRUE') {
        // escape following characters: "_*[]()~`>#+-=|{}.!"
        value_message += ".replace(/([-_*\\[\\]()~`>#+=|{}.!])/g, '\\\\$1')";
    }

    return `sendTo('telegram${dropdown_instance}', 'send', {\n` +
        `  text: ${value_message},\n` +
        (value_username ? `  user: ${value_username},\n` : '') +
        (value_chatid ? `  chatId: ${value_chatid},\n` : '') +
        (silent === 'TRUE' ? '  disable_notification: true,\n' : '') +
        (disable_web_page_preview === 'TRUE' ? '  disable_web_page_preview: true,\n' : '') +
        (parsemode !== 'default' ? `  parse_mode: '${parsemode}',\n` : '') +
        `});\n${logText}`;
};

// --- SendTo call telegram --------------------------------------------------
Blockly.Words['telegram_call']          = {'en': 'call via Telegram', 'de': 'per Telegramm anrufen', 'ru': 'звонок через Telegram', 'pt': 'chamada via Telegram', 'nl': 'bellen via Telegram', 'fr': 'appeler par Telegram', 'it': 'chiama via Telegram',    'es': 'llamar por Telegram', 'pl': 'połączenie za Telegram', 'zh-cn': '通过电报电话'};
Blockly.Words['telegram_call_system']   = {'en': 'System language', 'de': 'Systemsprache', 'ru': 'Системный язык', 'pt': 'Idioma do sistema', 'nl': 'Systeem taal', 'fr': 'Langue du système', 'it': 'Linguaggio di sistema', 'es': 'Lenguaje del sistema', 'pl': 'Język systemowy', 'zh-cn': '系统语言'};
Blockly.Words['telegram_call_tooltip']  = {'en': 'Call via Telegram and say some text', 'de': 'per Telegram anrufen und einen Text sagen','ru': 'Звоните через Telegram и скажите какой-нибудь текст',    'pt': 'Ligue por Telegram e diga algum texto',    'nl': 'Bel via Telegram en zeg wat tekst',    'fr': 'Appelez par Telegram et dites du texte',    'it': 'Chiama via Telegram e pronuncia un messaggio',    'es': 'Llama por Telegram y di algo de texto',    'pl': 'Zadzwoń za pośrednictwem Telegram i powiedz tekst',    'zh-cn': '通过电报呼叫并说一些文字'};
Blockly.Words['telegram_call_help']     = {'en': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'pt': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'pl': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'nl': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'it': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'es': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'fr': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'de': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram', 'ru': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md#calls-via-telegram'};
Blockly.Words['telegram_call_repeats']  = {'en': 'Repeats', 'de': 'Wiederholungen', 'ru': 'Повторить', 'pt': 'Repete', 'nl': 'Herhaalt', 'fr': 'Répète', 'it': 'Si ripete', 'es': 'Repite', 'pl': 'Powtarza się', 'zh-cn': '重复'};

Blockly.Sendto.blocks['telegram_call'] =
    '<block type="telegram_call">' +
    '  <field name="INSTANCE"></field>' +
    '  <field name="LANGUAGE"></field>' +
    '  <field name="REPEATS">1</field>' +
    '  <field name="LOG"></field>' +
    '  <value name="MESSAGE">' +
    '    <shadow type="text">' +
    '      <field name="TEXT">text</field>' +
    '    </shadow>' +
    '  </value>' +
    '  <value name="USERNAME">' +
    '    <shadow type="text">' +
    '      <field name="TEXT"></field>' +
    '    </shadow>' +
    '  </value>' +
    '</block>';

Blockly.Blocks['telegram_call'] = {
    init: function () {
        const options = [[Blockly.Translate('telegram_anyInstance'), '']];
        if (typeof main !== 'undefined' && main.instances) {
            for (let i = 0; i < main.instances.length; i++) {
                const m = main.instances[i].match(/^system.adapter.telegram.(\d+)$/);
                if (m) {
                    const k = parseInt(m[1], 10);
                    options.push(['telegram.' + k, '.' + k]);
                }
            }
            if (options.length === 0) {
                for (let u = 0; u <= 4; u++) {
                    options.push(['telegram.' + u, '.' + u]);
                }
            }
        } else {
            for (let n = 0; n <= 4; n++) {
                options.push(['telegram.' + n, '.' + n]);
            }
        }

        this.appendDummyInput('INSTANCE')
            .appendField(Blockly.Translate('telegram_call'))
            .appendField(new Blockly.FieldDropdown(options), 'INSTANCE');

        this.appendValueInput('MESSAGE')
            .appendField(Blockly.Translate('telegram_message'));

        const inputUsername = this.appendValueInput('USERNAME')
            .setCheck('String')
            .appendField(Blockly.Translate('telegram_username'));
        if (inputUsername.connection) {
            inputUsername.connection._optional = true;
        }

        const languages = [
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

        this.appendDummyInput('REPEATS')
            .appendField(Blockly.Translate('telegram_call_repeats'))
            .appendField(new Blockly.FieldDropdown([
                ['1', '1'],
                ['2', '2'],
                ['3', '3'],
                ['4', '4'],
                ['5', '5'],
            ]), 'REPEATS');

        this.appendDummyInput('LOG')
            .appendField(Blockly.Translate('telegram_log'))
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Translate('telegram_log_none'),  ''],
                [Blockly.Translate('telegram_log_debug'), 'debug'],
                [Blockly.Translate('telegram_log_info'),  'log'],
                [Blockly.Translate('telegram_log_warn'),  'warn'],
                [Blockly.Translate('telegram_log_error'), 'error'],
            ]), 'LOG');

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Translate('telegram_call_tooltip'));
        this.setHelpUrl(Blockly.Translate('telegram_call_help'));
    },
};

Blockly.JavaScript['telegram_call'] = function (block) {
    const dropdown_instance = block.getFieldValue('INSTANCE');
    const dropdown_language = block.getFieldValue('LANGUAGE');
    const repeats = block.getFieldValue('REPEATS');
    const logLevel = block.getFieldValue('LOG');
    const value_message = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC);
    const value_username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);

    let logText = '';
    if (logLevel) {
        const logUsername = value_username ? `[' + ${value_username} + ']` : '';
        logText = `console.${logLevel}('telegramCall${logUsername}: ' + ${value_message});\n`;
    }

    return `sendTo('telegram${dropdown_instance}', 'call', {\n` +
        `  text: ${value_message},\n` +
        (value_username ? `  user: ${value_username},\n` : '') +
        `  lang: '${dropdown_language}',\n` +
        `  repeats: ${parseInt(repeats, 10) || 1},\n` +
        `});\n${logText}`;
};

// --- SendTo ask telegram --------------------------------------------------
Blockly.Words['telegram_ask']          = { 'en': 'ask via Telegram', 'de': 'fragen per Telegramm', 'ru': 'спрос через Telegram', 'pt': 'perguntar via Telegram', 'nl': 'vragen via Telegram', 'fr': 'demander via Telegram', 'it': 'chiedere via Telegram', 'es': 'pregunte por Telegram', 'pl': 'pytaj przez Telegram', 'uk': 'подати заявку', 'zh-cn': '通过Telegram 查询' };
Blockly.Words['telegram_ask_question'] = { 'en': 'Question', 'de': 'Frage', 'ru': 'Вопрос', 'pt': 'Pergunta', 'nl': 'Vraag', 'fr': 'Question', 'it': 'Domanda', 'es': 'Pregunta', 'pl': 'Pytanie', 'uk': 'Питання', 'zh-cn': '问题' };
Blockly.Words['telegram_ask_answers']  = { 'en': 'Answers', 'de': 'Antworten', 'ru': 'Ответы', 'pt': 'Respostas', 'nl': 'Antwoorden', 'fr': 'Réponses', 'it': 'Risposte', 'es': 'Respuestas', 'pl': 'Odpowiedzi', 'uk': 'Відповідей', 'zh-cn': '答复' };
Blockly.Words['telegram_ask_answer']   = { 'en': 'Answer', 'de': 'Antwort', 'ru': 'Ответ', 'pt': 'Resposta', 'nl': 'Antwoord', 'fr': 'Réponse', 'it': 'Risposta', 'es': 'Respuesta', 'pl': 'Odpowiedź', 'uk': 'Відправити', 'zh-cn': '答复' };

Blockly.Sendto.blocks['telegram_ask'] =
    '<block type="telegram_ask">' +
    '  <mutation>' +
    '    <answer id="ANSWER_0" name="yes"></answer>' +
    '  </mutation>' +
    '  <field name="INSTANCE"></field>' +
    '  <field name="LOG"></field>' +
    '  <value name="QUESTION">' +
    '    <shadow type="text">' +
    '      <field name="TEXT">text</field>' +
    '    </shadow>' +
    '  </value>' +
    '  <value name="USERNAME">' +
    '    <shadow type="text">' +
    '      <field name="TEXT"></field>' +
    '    </shadow>' +
    '  </value>' +
    '  <value name="ANSWER_0">' +
    '    <shadow type="text">' +
    '      <field name="TEXT">Yes, please</field>' +
    '    </shadow>' +
    '  </value>' +
    '</block>';

Blockly.Blocks['telegram_ask_container'] = {
    /**
     * Mutator block for container.
     * @this Blockly.Block
     */
    init: function () {
        this.setColour(Blockly.Object.HUE);

        this.appendDummyInput()
            .appendField(Blockly.Translate('telegram_ask_answers'));

        this.appendStatementInput('STACK');
        this.setTooltip(Blockly.Translate('object_new_tooltip'));

        this.contextMenu = false;
    },
};

Blockly.Blocks['telegram_ask_mutator'] = {
    /**
     * Mutator block for add items.
     * @this Blockly.Block
     */
    init: function () {
        this.setColour(Blockly.Sendto.HUE);

        this.appendDummyInput('ANSWER')
            .appendField(Blockly.Translate('telegram_ask_answer'))
            .appendField(new Blockly.FieldTextInput('okay'), 'ANSWER');

        this.setPreviousStatement(true);
        this.setNextStatement(true);

        this.setTooltip(Blockly.Translate('telegram_ask_tooltip'));

        this.contextMenu = false;
    },
};

Blockly.Blocks['telegram_ask'] = {
    init: function () {
        this.answers_ = [];
        this.itemCount_ = 0;
        if (typeof Blockly.icons === 'object') {
            this.setMutator(new Blockly.icons.MutatorIcon(['telegram_ask_mutator'], this));
        } else {
            // Blockly 9.x
            this.setMutator(new Blockly.Mutator(['telegram_ask_mutator'], this));
        }

        const options = [[Blockly.Translate('telegram_anyInstance'), '']];
        if (typeof main !== 'undefined' && main.instances) {
            for (let i = 0; i < main.instances.length; i++) {
                const m = main.instances[i].match(/^system.adapter.telegram.(\d+)$/);
                if (m) {
                    const k = parseInt(m[1], 10);
                    options.push(['telegram.' + k, '.' + k]);
                }
            }
            if (options.length === 0) {
                for (let u = 0; u <= 4; u++) {
                    options.push(['telegram.' + u, '.' + u]);
                }
            }
        } else {
            for (let n = 0; n <= 4; n++) {
                options.push(['telegram.' + n, '.' + n]);
            }
        }

        this.appendDummyInput('INSTANCE')
            .appendField(Blockly.Translate('telegram_ask'))
            .appendField(new Blockly.FieldDropdown(options), 'INSTANCE');

        this.appendValueInput('QUESTION')
            .appendField(Blockly.Translate('telegram_ask_question'));

        const inputUser = this.appendValueInput('USERNAME')
            .setCheck('String')
            .appendField(Blockly.Translate('telegram_username'));
        if (inputUser.connection) {
            inputUser.connection._optional = true;
        }

        const inputChat = this.appendValueInput('CHATID')
            .setCheck('String')
            .appendField(Blockly.Translate('telegram_chatid'));
        if (inputChat.connection) {
            inputChat.connection._optional = true;
        }

        this.appendDummyInput('LOG')
            .appendField(Blockly.Translate('telegram_log'))
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Translate('telegram_log_none'),  ''],
                [Blockly.Translate('telegram_log_debug'), 'debug'],
                [Blockly.Translate('telegram_log_info'),  'log'],
                [Blockly.Translate('telegram_log_warn'),  'warn'],
                [Blockly.Translate('telegram_log_error'), 'error'],
            ]), 'LOG');

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Translate('telegram_tooltip'));
        this.setHelpUrl(Blockly.Translate('telegram_help'));
    },
    /**
     * Create XML to represent number of text inputs.
     * @return {!Element} XML storage element.
     * @this Blockly.Block
     */
    mutationToDom: function () {
        const container = document.createElement('mutation');

        for (let i = 0; i < this.answers_.length; i++) {
            const parameter = document.createElement('answer');
            parameter.setAttribute('id', 'ANSWER_' + i);
            parameter.setAttribute('name', this.answers_[i]);
            container.appendChild(parameter);
        }

        return container;
    },
    /**
     * Parse XML to restore the text inputs.
     * @param {!Element} xmlElement XML storage element.
     * @this Blockly.Block
     */
    domToMutation: function (xmlElement) {
        this.answers_ = [];

        for (let i = 0, childNode; (childNode = xmlElement.childNodes[i]); i++) {
            if (childNode.nodeName.toLowerCase() === 'answer') {
                this.answers_.push(childNode.getAttribute('name'));
            }
        }

        this.itemCount_ = this.answers_.length;
        this.updateShape_();
    },
    /**
     * Populate the mutator's dialog with this block's components.
     * @param {!Blockly.Workspace} workspace Mutator's workspace.
     * @return {!Blockly.Block} Root block in mutator.
     * @this Blockly.Block
     */
    decompose: function (workspace) {
        const containerBlock = workspace.newBlock('telegram_ask_container');
        containerBlock.initSvg();

        let connection = containerBlock.getInput('STACK').connection;
        for (let i = 0; i < this.itemCount_; i++) {
            const itemBlock = workspace.newBlock('telegram_ask_mutator');
            itemBlock.setFieldValue(this.answers_[i], 'ANSWER');
            itemBlock.initSvg();
            connection.connect(itemBlock.previousConnection);
            connection = itemBlock.nextConnection;
        }

        return containerBlock;
    },
    /**
     * Reconfigure this block based on the mutator dialog's components.
     * @param {!Blockly.Block} containerBlock Root block in mutator.
     * @this Blockly.Block
     */
    compose: function (containerBlock) {
        this.answers_ = [];

        let itemBlock = containerBlock.getInputTargetBlock('STACK');
        // Count number of inputs.
        const connections = [];
        while (itemBlock) {
            const attrName = itemBlock.getFieldValue('ANSWER');
            this.answers_.push(attrName);

            connections.push(itemBlock.valueConnection_);
            itemBlock = itemBlock.nextConnection &&
                itemBlock.nextConnection.targetBlock();
        }

        // Disconnect any children that don't belong.
        for (let k = 0; k < this.itemCount_; k++) {
            const connection = this.getInput('ANSWER_' + k).connection.targetConnection;
            if (connection && !connections.includes(connection)) {
                connection.disconnect();
            }
        }

        this.itemCount_ = connections.length;
        if (this.itemCount_ < 0) {
            this.itemCount_ = 0;
        }
        this.updateShape_();

        // Reconnect any child blocks.
        for (let i = 0; i < this.itemCount_; i++) {
            Blockly.icons.MutatorIcon.reconnect(connections[i], this, 'ANSWER_' + i);
        }
    },
    /**
     * Store pointers to any connected child blocks.
     * @param {!Blockly.Block} containerBlock Root block in mutator.
     * @this Blockly.Block
     */
    saveConnections: function (containerBlock) {
        let itemBlock = containerBlock.getInputTargetBlock('STACK');
        let i = 0;

        while (itemBlock) {
            const input = this.getInput('ANSWER_' + i);
            itemBlock.valueConnection_ = input && input.connection.targetConnection;
            i++;
            itemBlock = itemBlock.nextConnection &&
                itemBlock.nextConnection.targetBlock();
        }
    },
    /**
     * Modify this block to have the correct number of inputs.
     * @private
     * @this Blockly.Block
     */
    updateShape_: function () {
        const workspace = this.workspace;

        // Add new inputs.
        for (let i = 0; i < this.itemCount_; i++) {
            let input = this.getInput('ANSWER_' + i);

            if (!input) {
                input = this.appendValueInput('ANSWER_' + i).setAlign(Blockly.ALIGN_RIGHT);
                input.appendField(this.answers_[i]);
            } else {
                input.fieldRow[0].setValue(this.answers_[i]);
            }

            let statement = this.getInput('STATEMENT_' + i);
            if (!statement) {
                statement = this.appendStatementInput('STATEMENT_' + i);
            }

            setTimeout(__input => {
                if (!__input.connection.isConnected()) {
                    const _shadow = workspace.newBlock('text');
                    _shadow.setShadow(true);
                    _shadow.setFieldValue('text', 'TEXT');
                    _shadow.initSvg();
                    _shadow.render();
                    _shadow.outputConnection.connect(__input.connection);
                }
            }, 100, input);
        }

        // Remove deleted inputs.
        for (let i = this.itemCount_; this.getInput('ANSWER_' + i); i++) {
            this.removeInput('ANSWER_' + i);
            this.removeInput('STATEMENT_' + i);
        }
    },
};

Blockly.JavaScript['telegram_ask'] = function(block) {
    const answers = [];
    for (let id = 0; id < block.itemCount_; id++) {
        const answer = Blockly.JavaScript.valueToCode(block, 'ANSWER_' + id, Blockly.JavaScript.ORDER_ATOMIC);
        const statement = Blockly.JavaScript.statementToCode(block, 'STATEMENT_' + id);
        if (answer && statement) {
            answers.push({ id, answer, statement });
        }
    }

    const dropdown_instance = block.getFieldValue('INSTANCE');
    const logLevel = block.getFieldValue('LOG');
    const value_question = Blockly.JavaScript.valueToCode(block, 'QUESTION', Blockly.JavaScript.ORDER_ATOMIC);
    const value_username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);
    const value_chatid = Blockly.JavaScript.valueToCode(block, 'CHATID', Blockly.JavaScript.ORDER_ATOMIC);

    let logText = '';
    if (logLevel) {
        const logUsername = value_username ? `[' + ${value_username} + ']` : '';
        logText = `console.${logLevel}('telegramAsk${logUsername}: ' + ${value_question});\n`;
    }

    let logAnswer = '';
    if (logLevel) {
        logAnswer = `  console.${logLevel}('telegramAsk answer: ' + (msg?.data ?? '[no answer]'));\n`;
    }

    return `sendTo('telegram${dropdown_instance}', 'ask', {\n` +
        `  text: ${value_question},\n` +
        (value_username ? `  user: ${value_username},\n` : '') +
        (value_chatid ? `  chatId: ${value_chatid},\n` : '') +
        `  reply_markup: {\n` +
        `    inline_keyboard: [\n` +
        answers.map(a => `      [ { text: ${a.answer}, callback_data: '${a.id}' } ],`).join('\n') +
        `    ],\n` +
        `  }\n` +
        `}, msg => {\n${logAnswer}` +
        answers.map(a => `  if (msg?.data && msg.data == '${a.id}') {\n${Blockly.JavaScript.prefixLines(a.statement, Blockly.JavaScript.INDENT)}  }`).join('\n') +
        `\n});\n${logText}`;
};
