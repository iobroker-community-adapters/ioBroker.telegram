'use strict';

goog.provide('Blockly.JavaScript.Sendto');

goog.require('Blockly.JavaScript');

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
    + '</block>';

Blockly.Blocks['telegram'] = {
    init: function() {
        var options = [[Blockly.Words['telegram_anyInstance'][systemLang], '']];
        if (typeof main !== 'undefined' && main.instances) {
            for (var i = 0; i < main.instances.length; i++) {
                var m = main.instances[i].match(/^system.adapter.telegram.(\d+)$/);
                if (m) {
                    var k = parseInt(m[1], 10);
                    options.push(['telegram.' + k, '.' + k]);
                }
            }
        } else {
            for (var n = 0; n <= 4; n++) {
                options.push(['telegram.' + n, '.' + n]);
            }
        }

        this.appendDummyInput('INSTANCE')
            .appendField(Blockly.Words['telegram'][systemLang])
            .appendField(new Blockly.FieldDropdown(options), 'INSTANCE');

        this.appendValueInput('MESSAGE')
            .appendField(Blockly.Words['telegram_message'][systemLang]);

        var input = this.appendValueInput('USERNAME')
            .setCheck('String')
            .appendField(Blockly.Words['telegram_username'][systemLang]);

        this.appendDummyInput('LOG')
            .appendField(Blockly.Words['telegram_log'][systemLang])
            .appendField(new Blockly.FieldDropdown([
                [Blockly.Words['telegram_log_none'][systemLang],  ''],
                [Blockly.Words['telegram_log_info'][systemLang],  'log'],
                [Blockly.Words['telegram_log_debug'][systemLang], 'debug'],
                [Blockly.Words['telegram_log_warn'][systemLang],  'warn'],
                [Blockly.Words['telegram_log_error'][systemLang], 'error']
            ]), 'LOG');

        if (input.connection) input.connection._optional = true;

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Words['telegram_tooltip'][systemLang]);
        this.setHelpUrl(Blockly.Words['telegram_help'][systemLang]);
    }
};

Blockly.JavaScript['telegram'] = function(block) {
    var dropdown_instance = block.getFieldValue('INSTANCE');
    var logLevel = block.getFieldValue('LOG');
    var value_message = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC);
    var value_username = Blockly.JavaScript.valueToCode(block, 'USERNAME', Blockly.JavaScript.ORDER_ATOMIC);

    var logText;
    if (logLevel) {
        logText = 'console.' + logLevel + '("telegram' + (value_username ? '[' + value_username + ']' : '') + ': " + ' + value_message + ');\n'
    } else {
        logText = '';
    }

    return 'sendTo("telegram' + dropdown_instance + '", "send", {\n    text: ' +
        value_message + (value_username ? ', \n    user: ' + value_username : '') + '\n});\n' +
        logText;
};
