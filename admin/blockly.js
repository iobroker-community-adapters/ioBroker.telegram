'use strict';

goog.provide('Blockly.JavaScript.Sendto');

goog.require('Blockly.JavaScript');

// --- SendTo telegram --------------------------------------------------
Blockly.Words['telegram']               = {'en': 'telegram',                    'de': 'telegram',                           'ru': 'telegram'};
Blockly.Words['telegram_message']       = {'en': 'message',                     'de': 'Meldung',                            'ru': 'сообщение'};
Blockly.Words['telegram_username']      = {'en': 'User name (optional)',        'de': 'Username (optional)',                'ru': 'имя пользователя (не обяз.)'};
Blockly.Words['telegram_anyInstance']   = {'en': 'all instances',               'de': 'Alle Instanzen',                     'ru': 'На все драйвера'};
Blockly.Words['telegram_tooltip']       = {'en': 'Send message to telegram',    'de': 'Sende eine Meldung über Telegram',   'ru': 'Послать сообщение через Telegram'};
Blockly.Words['telegram_help']          = {'en': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'de': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md', 'ru': 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md'};
Blockly.Words['telegram_log']           = {'en': 'log level',                   'de': 'Loglevel',                           'ru': 'Протокол'};
Blockly.Words['telegram_log_none']      = {'en': 'none',                        'de': 'keins',                              'ru': 'нет'};
Blockly.Words['telegram_log_info']      = {'en': 'info',                        'de': 'info',                               'ru': 'инфо'};
Blockly.Words['telegram_log_debug']     = {'en': 'debug',                       'de': 'debug',                              'ru': 'debug'};
Blockly.Words['telegram_log_warn']      = {'en': 'warning',                     'de': 'warning',                            'ru': 'warning'};
Blockly.Words['telegram_log_error']     = {'en': 'error',                       'de': 'error',                              'ru': 'ошибка'};

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
        this.appendDummyInput('INSTANCE')
            .appendField(Blockly.Words['telegram'][systemLang])
            .appendField(new Blockly.FieldDropdown([[Blockly.Words['telegram_anyInstance'][systemLang], ''], ['telegram.0', '.0'], ['telegram.1', '.1'], ['telegram.2', '.2'], ['telegram.3', '.3'], ['telegram.4', '.4']]), 'INSTANCE');

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
