// GENERATED FILE - do not edit.
// Source: src-blockly/blockly.ts - rebuild with `npm run build:blockly`.
"use strict";
(() => {
  // src-blockly/helpers.ts
  var Blockly = window.Blockly;
  function instanceOptions() {
    const options = [[Blockly.Translate("telegram_anyInstance"), ""]];
    const instances = window.main?.instances;
    if (instances) {
      for (let i = 0; i < instances.length; i++) {
        const m = instances[i].match(/^system\.adapter\.telegram\.(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          options.push([`telegram.${n}`, `.${n}`]);
        }
      }
    }
    if (options.length === 1) {
      for (let n = 0; n <= 4; n++) {
        options.push([`telegram.${n}`, `.${n}`]);
      }
    }
    return options;
  }
  function logLevelOptions() {
    return [
      [Blockly.Translate("telegram_log_none"), ""],
      [Blockly.Translate("telegram_log_debug"), "debug"],
      [Blockly.Translate("telegram_log_info"), "log"],
      [Blockly.Translate("telegram_log_warn"), "warn"],
      [Blockly.Translate("telegram_log_error"), "error"]
    ];
  }
  function parseModeOptions() {
    return [
      [Blockly.Translate("telegram_parsemode_default"), "default"],
      ["HTML", "HTML"],
      ["MarkdownV2", "MarkdownV2"]
    ];
  }
  function logLine(logLevel, prefix, username, text) {
    if (!logLevel) {
      return "";
    }
    const withUser = username ? `[' + ${username} + ']` : "";
    return `console.${logLevel}('${prefix}${withUser}: '${text ? ` + ${text}` : ""});
`;
  }
  function reconnectChild(connectionChild, block, inputName) {
    if (!connectionChild?.getSourceBlock().workspace) {
      return false;
    }
    const connectionParent = block.getInput(inputName)?.connection;
    if (!connectionParent) {
      return false;
    }
    const currentParent = connectionChild.targetBlock();
    if ((!currentParent || currentParent === block) && connectionParent.targetConnection !== connectionChild) {
      if (connectionParent.isConnected()) {
        connectionParent.disconnect();
      }
      connectionParent.connect(connectionChild);
      return true;
    }
    return false;
  }
  function registerGenerator(type, generator) {
    if (Blockly.JavaScript.forBlock) {
      Blockly.JavaScript.forBlock[type] = generator;
    } else {
      Blockly.JavaScript[type] = generator;
    }
  }

  // src-blockly/blocks/telegram.ts
  var Blockly2 = window.Blockly;
  var ESCAPE_SUFFIX = ".replace(/([-_*\\[\\]()~`>#+=|{}.!])/g, '\\\\$1')";
  function installTelegram() {
    Blockly2.Sendto.blocks.telegram = `<block type="telegram">
  <field name="INSTANCE"></field>
  <field name="LOG"></field>
  <field name="SILENT">FALSE</field>
  <field name="PARSEMODE">default</field>
  <field name="ESCAPING">FALSE</field>
  <field name="DISABLE_WEB_PAGE_PREVIEW">FALSE</field>
  <value name="MESSAGE">
    <shadow type="text">
      <field name="TEXT">text</field>
    </shadow>
  </value>
</block>`;
    Blockly2.Blocks.telegram = {
      init: function() {
        this.appendDummyInput("INSTANCE").appendField(Blockly2.Translate("telegram")).appendField(new Blockly2.FieldDropdown(instanceOptions()), "INSTANCE");
        this.appendValueInput("MESSAGE").appendField(Blockly2.Translate("telegram_message"));
        for (const [name, word] of [
          ["USERNAME", "telegram_username"],
          ["CHATID", "telegram_chatid"]
        ]) {
          const input = this.appendValueInput(name).setCheck("String").appendField(Blockly2.Translate(word));
          if (input.connection) {
            input.connection._optional = true;
          }
        }
        this.appendDummyInput("LOG").appendField(Blockly2.Translate("telegram_log")).appendField(new Blockly2.FieldDropdown(logLevelOptions()), "LOG");
        this.appendDummyInput("SILENT").appendField(Blockly2.Translate("telegram_silent")).appendField(new Blockly2.FieldCheckbox("FALSE"), "SILENT");
        this.appendDummyInput("PARSEMODE").appendField("Parsemode").appendField(new Blockly2.FieldDropdown(parseModeOptions()), "PARSEMODE");
        this.appendDummyInput("ESCAPING").appendField(Blockly2.Translate("telegram_escaping")).appendField(new Blockly2.FieldCheckbox("FALSE"), "ESCAPING");
        this.appendDummyInput("DISABLE_WEB_PAGE_PREVIEW").appendField(Blockly2.Translate("telegram_disable_web_preview")).appendField(new Blockly2.FieldCheckbox("FALSE"), "DISABLE_WEB_PAGE_PREVIEW");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(Blockly2.Sendto.HUE);
        this.setTooltip(Blockly2.Translate("telegram_tooltip"));
        this.setHelpUrl(Blockly2.Translate("telegram_help"));
      }
    };
    registerGenerator("telegram", (block) => {
      const instance = block.getFieldValue("INSTANCE");
      const logLevel = block.getFieldValue("LOG");
      const username = Blockly2.JavaScript.valueToCode(block, "USERNAME", Blockly2.JavaScript.ORDER_ATOMIC);
      const chatId = Blockly2.JavaScript.valueToCode(block, "CHATID", Blockly2.JavaScript.ORDER_ATOMIC);
      const silent = block.getFieldValue("SILENT");
      const escaping = block.getFieldValue("ESCAPING");
      const disableWebPagePreview = block.getFieldValue("DISABLE_WEB_PAGE_PREVIEW");
      const parseMode = block.getFieldValue("PARSEMODE");
      let text = Blockly2.JavaScript.valueToCode(block, "MESSAGE", Blockly2.JavaScript.ORDER_ATOMIC);
      const logText = logLine(logLevel, "telegram", username, text);
      if (text && escaping === "TRUE") {
        text += ESCAPE_SUFFIX;
      }
      const lines = [`sendTo('telegram${instance}', 'send', {
`];
      if (text) {
        lines.push(`  text: ${text},
`);
      }
      if (username) {
        lines.push(`  user: ${username},
`);
      }
      if (chatId) {
        lines.push(`  chatId: ${chatId},
`);
      }
      if (silent === "TRUE") {
        lines.push("  disable_notification: true,\n");
      }
      if (disableWebPagePreview === "TRUE") {
        lines.push("  disable_web_page_preview: true,\n");
      }
      if (parseMode !== "default") {
        lines.push(`  parse_mode: '${parseMode}',
`);
      }
      lines.push(`});
${logText}`);
      return lines.join("");
    });
  }

  // src-blockly/blocks/telegramAsk.ts
  var Blockly3 = window.Blockly;
  var ALIGN_RIGHT = Blockly3.inputs?.Align.RIGHT ?? 1;
  function installTelegramAsk() {
    Blockly3.Sendto.blocks.telegram_ask = `<sep gap="5"></sep>
<block type="telegram_ask">
  <mutation>
    <answer id="ANSWER_0" name="yes"></answer>
  </mutation>
  <field name="INSTANCE"></field>
  <field name="LOG"></field>
  <field name="PARSEMODE">default</field>
  <value name="QUESTION">
    <shadow type="text">
      <field name="TEXT">text</field>
    </shadow>
  </value>
  <value name="ANSWER_0">
    <shadow type="text">
      <field name="TEXT">Yes, please</field>
    </shadow>
  </value>
</block>`;
    Blockly3.Blocks.telegram_ask_container = {
      init: function() {
        this.setColour(Blockly3.Object.HUE);
        this.appendDummyInput().appendField(Blockly3.Translate("telegram_ask_answers"));
        this.appendStatementInput("STACK");
        this.setTooltip(Blockly3.Translate("object_new_tooltip"));
        this.contextMenu = false;
      }
    };
    Blockly3.Blocks.telegram_ask_mutator = {
      init: function() {
        this.setColour(Blockly3.Sendto.HUE);
        this.appendDummyInput("ANSWER").appendField(Blockly3.Translate("telegram_ask_answer")).appendField(new Blockly3.FieldTextInput("okay"), "ANSWER");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip(Blockly3.Translate("telegram_ask_tooltip"));
        this.contextMenu = false;
      }
    };
    Blockly3.Blocks.telegram_ask = {
      init: function() {
        this.answers_ = [];
        this.itemCount_ = 0;
        const self = this;
        if (Blockly3.icons) {
          this.setMutator(new Blockly3.icons.MutatorIcon(["telegram_ask_mutator"], self));
        } else if (Blockly3.Mutator) {
          this.setMutator(new Blockly3.Mutator(["telegram_ask_mutator"], self));
        }
        this.appendDummyInput("INSTANCE").appendField(Blockly3.Translate("telegram_ask")).appendField(new Blockly3.FieldDropdown(instanceOptions()), "INSTANCE");
        this.appendValueInput("QUESTION").appendField(Blockly3.Translate("telegram_ask_question"));
        for (const [name, word] of [
          ["USERNAME", "telegram_username"],
          ["CHATID", "telegram_chatid"]
        ]) {
          const input = this.appendValueInput(name).setCheck("String").appendField(Blockly3.Translate(word));
          if (input.connection) {
            input.connection._optional = true;
          }
        }
        this.appendDummyInput("LOG").appendField(Blockly3.Translate("telegram_log")).appendField(new Blockly3.FieldDropdown(logLevelOptions()), "LOG");
        this.appendDummyInput("PARSEMODE").appendField("Parsemode").appendField(new Blockly3.FieldDropdown(parseModeOptions()), "PARSEMODE");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(Blockly3.Sendto.HUE);
        this.setTooltip(Blockly3.Translate("telegram_tooltip"));
        this.setHelpUrl(Blockly3.Translate("telegram_help"));
      },
      /** Stores the answers in the workspace XML */
      mutationToDom: function() {
        const container = document.createElement("mutation");
        for (let i = 0; i < this.answers_.length; i++) {
          const parameter = document.createElement("answer");
          parameter.setAttribute("id", `ANSWER_${i}`);
          parameter.setAttribute("name", this.answers_[i]);
          container.appendChild(parameter);
        }
        return container;
      },
      /**
       * Restores the answers from the workspace XML
       *
       * @param xmlElement
       */
      domToMutation: function(xmlElement) {
        this.answers_ = [];
        for (let i = 0, childNode; childNode = xmlElement.childNodes[i]; i++) {
          if (childNode.nodeName.toLowerCase() === "answer") {
            this.answers_.push(childNode.getAttribute("name") || "");
          }
        }
        this.itemCount_ = this.answers_.length;
        this.updateShape_();
      },
      /**
       * Builds the stack shown in the mutator dialog
       *
       * @param workspace
       */
      decompose: function(workspace) {
        const containerBlock = workspace.newBlock("telegram_ask_container");
        containerBlock.initSvg();
        let connection = containerBlock.getInput("STACK").connection;
        for (let i = 0; i < this.itemCount_; i++) {
          const itemBlock = workspace.newBlock("telegram_ask_mutator");
          itemBlock.setFieldValue(this.answers_[i], "ANSWER");
          itemBlock.initSvg();
          connection.connect(itemBlock.previousConnection);
          connection = itemBlock.nextConnection;
        }
        return containerBlock;
      },
      /**
       * Applies what the mutator dialog was left in
       *
       * @param containerBlock
       */
      compose: function(containerBlock) {
        this.answers_ = [];
        let itemBlock = containerBlock.getInputTargetBlock("STACK");
        const connections = [];
        while (itemBlock) {
          this.answers_.push(itemBlock.getFieldValue("ANSWER"));
          connections.push(itemBlock.valueConnection_);
          itemBlock = itemBlock.nextConnection?.targetBlock() || null;
        }
        for (let k = 0; k < this.itemCount_; k++) {
          const connection = this.getInput(`ANSWER_${k}`)?.connection?.targetConnection;
          if (connection && !connections.includes(connection)) {
            connection.disconnect();
          }
        }
        this.itemCount_ = connections.length;
        this.updateShape_();
        for (let i = 0; i < this.itemCount_; i++) {
          reconnectChild(connections[i] ?? null, this, `ANSWER_${i}`);
        }
      },
      /**
       * Remembers what hangs on each answer input before the dialog rearranges things
       *
       * @param containerBlock
       */
      saveConnections: function(containerBlock) {
        let itemBlock = containerBlock.getInputTargetBlock("STACK");
        let i = 0;
        while (itemBlock) {
          const input = this.getInput(`ANSWER_${i}`);
          itemBlock.valueConnection_ = input?.connection?.targetConnection;
          i++;
          itemBlock = itemBlock.nextConnection?.targetBlock() || null;
        }
      },
      /** Adds and removes the answer inputs so the block matches `itemCount_` */
      updateShape_: function() {
        const workspace = this.workspace;
        for (let i = 0; i < this.itemCount_; i++) {
          let input = this.getInput(`ANSWER_${i}`);
          if (!input) {
            input = this.appendValueInput(`ANSWER_${i}`).setAlign(ALIGN_RIGHT);
            input.appendField(this.answers_[i]);
          } else {
            input.fieldRow[0].setValue(this.answers_[i]);
          }
          if (!this.getInput(`STATEMENT_${i}`)) {
            this.appendStatementInput(`STATEMENT_${i}`);
          }
          setTimeout(
            (__input) => {
              if (!__input.connection?.isConnected()) {
                const shadow = workspace.newBlock("text");
                shadow.setShadow(true);
                shadow.setFieldValue("text", "TEXT");
                shadow.initSvg();
                shadow.render();
                shadow.outputConnection.connect(__input.connection);
              }
            },
            100,
            input
          );
        }
        for (let i = this.itemCount_; this.getInput(`ANSWER_${i}`); i++) {
          this.removeInput(`ANSWER_${i}`);
          this.removeInput(`STATEMENT_${i}`);
        }
      }
    };
    registerGenerator("telegram_ask", (block) => {
      const askBlock = block;
      const answers = [];
      for (let id = 0; id < askBlock.itemCount_; id++) {
        const answer = Blockly3.JavaScript.valueToCode(block, `ANSWER_${id}`, Blockly3.JavaScript.ORDER_ATOMIC);
        const statement = Blockly3.JavaScript.statementToCode(block, `STATEMENT_${id}`);
        if (answer && statement) {
          answers.push({ id, answer, statement });
        }
      }
      const instance = block.getFieldValue("INSTANCE");
      const logLevel = block.getFieldValue("LOG");
      const parseMode = block.getFieldValue("PARSEMODE");
      const question = Blockly3.JavaScript.valueToCode(block, "QUESTION", Blockly3.JavaScript.ORDER_ATOMIC);
      const username = Blockly3.JavaScript.valueToCode(block, "USERNAME", Blockly3.JavaScript.ORDER_ATOMIC);
      const chatId = Blockly3.JavaScript.valueToCode(block, "CHATID", Blockly3.JavaScript.ORDER_ATOMIC);
      const logAnswer = logLevel ? `  console.${logLevel}('telegramAsk answer: ' + (msg?.data ?? '[no answer]'));
` : "";
      const keyboard = answers.map((a) => `      [ { text: ${a.answer}, callback_data: '${a.id}' } ],`).join("\n");
      const branches = answers.map(
        (a) => `  if (msg?.data && msg.data == '${a.id}') {
${Blockly3.JavaScript.prefixLines(a.statement, Blockly3.JavaScript.INDENT)}  }`
      ).join("\n");
      const lines = [`sendTo('telegram${instance}', 'ask', {
`];
      if (question) {
        lines.push(`  text: ${question},
`);
      }
      if (username) {
        lines.push(`  user: ${username},
`);
      }
      if (chatId) {
        lines.push(`  chatId: ${chatId},
`);
      }
      if (parseMode !== "default") {
        lines.push(`  parse_mode: '${parseMode}',
`);
      }
      lines.push("  reply_markup: {\n");
      lines.push("    inline_keyboard: [\n");
      lines.push(`${keyboard}
`);
      lines.push("    ],\n");
      lines.push("  }\n");
      lines.push(`}, async (msg) => {
${logAnswer}`);
      lines.push(branches);
      lines.push(`
});
${logLine(logLevel, "telegramAsk", username, question)}`);
      return lines.join("");
    });
  }

  // src-blockly/voices.ts
  var CALL_VOICES = [
    ["German (Germany) (Female)", "de-DE-Standard-A"],
    ["German (Germany) (Male)", "de-DE-Standard-B"],
    ["English (US) (Male)", "en-US-Standard-B"],
    ["English (US) (Female)", "en-US-Standard-C"],
    ["English (US) (Male 2)", "en-US-Standard-D"],
    ["English (US) (Female 2)", "en-US-Standard-E"],
    ["Russian (Russia) (Female)", "ru-RU-Standard-A"],
    ["Russian (Russia) (Male)", "ru-RU-Standard-B"],
    ["Russian (Russia) (Female 2)", "ru-RU-Standard-C"],
    ["Russian (Russia) (Male 2)", "ru-RU-Standard-D"],
    ["Arabic (Female)", "ar-XA-Standard-A"],
    ["Arabic (Male)", "ar-XA-Standard-B"],
    ["Arabic (Male 2)", "ar-XA-Standard-C"],
    ["Czech (Czech Republic) (Female)", "cs-CZ-Standard-A"],
    ["Danish (Denmark) (Female)", "da-DK-Standard-A"],
    ["Dutch (Netherlands) (Female)", "nl-NL-Standard-A"],
    ["Dutch (Netherlands) (Male)", "nl-NL-Standard-B"],
    ["Dutch (Netherlands) (Male 2)", "nl-NL-Standard-C"],
    ["Dutch (Netherlands) (Female 2)", "nl-NL-Standard-D"],
    ["Dutch (Netherlands) (Female 3)", "nl-NL-Standard-E"],
    ["English (Australia) (Female)", "en-AU-Standard-A"],
    ["English (Australia) (Male)", "en-AU-Standard-B"],
    ["English (Australia) (Female 2)", "en-AU-Standard-C"],
    ["English (Australia) (Male 2)", "en-AU-Standard-D"],
    ["English (India) (Female)", "en-IN-Standard-A"],
    ["English (India) (Male)", "en-IN-Standard-B"],
    ["English (India) (Male 2)", "en-IN-Standard-C"],
    ["English (UK) (Female)", "en-GB-Standard-A"],
    ["English (UK) (Male)", "en-GB-Standard-B"],
    ["English (UK) (Female 2)", "en-GB-Standard-C"],
    ["English (UK) (Male 2)", "en-GB-Standard-D"],
    ["Filipino (Philippines) (Female)", "fil-PH-Standard-A"],
    ["Finnish (Finland) (Female)", "fi-FI-Standard-A"],
    ["French (Canada) (Female)", "fr-CA-Standard-A"],
    ["French (Canada) (Male)", "fr-CA-Standard-B"],
    ["French (Canada) (Female 2)", "fr-CA-Standard-C"],
    ["French (Canada) (Male 2)", "fr-CA-Standard-D"],
    ["French (France) (Female)", "fr-FR-Standard-A"],
    ["French (France) (Male)", "fr-FR-Standard-B"],
    ["French (France) (Female 2)", "fr-FR-Standard-C"],
    ["French (France) (Male 2)", "fr-FR-Standard-D"],
    ["Greek (Greece) (Female)", "el-GR-Standard-A"],
    ["Hindi (India) (Female)", "hi-IN-Standard-A"],
    ["Hindi (India) (Male)", "hi-IN-Standard-B"],
    ["Hindi (India) (Male 2)", "hi-IN-Standard-C"],
    ["Hungarian (Hungary) (Female)", "hu-HU-Standard-A"],
    ["Indonesian (Indonesia) (Female)", "id-ID-Standard-A"],
    ["Indonesian (Indonesia) (Male)", "id-ID-Standard-B"],
    ["Indonesian (Indonesia) (Male 2)", "id-ID-Standard-C"],
    ["Italian (Italy) (Female)", "it-IT-Standard-A"],
    ["Italian (Italy) (Female 2)", "it-IT-Standard-B"],
    ["Italian (Italy) (Male)", "it-IT-Standard-C"],
    ["Italian (Italy) (Male 2)", "it-IT-Standard-D"],
    ["Japanese (Japan) (Female)", "ja-JP-Standard-A"],
    ["Japanese (Japan) (Female 2)", "ja-JP-Standard-B"],
    ["Japanese (Japan) (Male)", "ja-JP-Standard-C"],
    ["Japanese (Japan) (Male 2)", "ja-JP-Standard-D"],
    ["Korean (South Korea) (Female)", "ko-KR-Standard-A"],
    ["Korean (South Korea) (Female 2)", "ko-KR-Standard-B"],
    ["Korean (South Korea) (Male)", "ko-KR-Standard-C"],
    ["Korean (South Korea) (Male 2)", "ko-KR-Standard-D"],
    ["Mandarin Chinese (Female)", "cmn-CN-Standard-A"],
    ["Mandarin Chinese (Male)", "cmn-CN-Standard-B"],
    ["Mandarin Chinese (Male 2)", "cmn-CN-Standard-C"],
    ["Norwegian (Norway) (Female)", "nb-NO-Standard-A"],
    ["Norwegian (Norway) (Male)", "nb-NO-Standard-B"],
    ["Norwegian (Norway) (Female 2)", "nb-NO-Standard-C"],
    ["Norwegian (Norway) (Male 2)", "nb-NO-Standard-D"],
    ["Norwegian (Norway) (Female 3)", "nb-no-Standard-E"],
    ["Polish (Poland) (Female)", "pl-PL-Standard-A"],
    ["Polish (Poland) (Male)", "pl-PL-Standard-B"],
    ["Polish (Poland) (Male 2)", "pl-PL-Standard-C"],
    ["Polish (Poland) (Female 2)", "pl-PL-Standard-D"],
    ["Polish (Poland) (Female 3)", "pl-PL-Standard-E"],
    ["Portuguese (Brazil) (Female)", "pt-BR-Standard-A"],
    ["Portuguese (Portugal) (Female)", "pt-PT-Standard-A"],
    ["Portuguese (Portugal) (Male)", "pt-PT-Standard-B"],
    ["Portuguese (Portugal) (Male 2)", "pt-PT-Standard-C"],
    ["Portuguese (Portugal) (Female 2)", "pt-PT-Standard-D"],
    ["Slovak (Slovakia) (Female)", "sk-SK-Standard-A"],
    ["Spanish (Spain) (Female)", "es-ES-Standard-A"],
    ["Swedish (Sweden) (Female)", "sv-SE-Standard-A"],
    ["Turkish (Turkey) (Female)", "tr-TR-Standard-A"],
    ["Turkish (Turkey) (Male)", "tr-TR-Standard-B"],
    ["Turkish (Turkey) (Female 2)", "tr-TR-Standard-C"],
    ["Turkish (Turkey) (Female 3)", "tr-TR-Standard-D"],
    ["Turkish (Turkey) (Male)", "tr-TR-Standard-E"],
    ["Ukrainian (Ukraine) (Female)", "uk-UA-Standard-A"],
    ["Vietnamese (Vietnam) (Female)", "vi-VN-Standard-A"],
    ["Vietnamese (Vietnam) (Male)", "vi-VN-Standard-B"],
    ["Vietnamese (Vietnam) (Female 2)", "vi-VN-Standard-C"],
    ["Vietnamese (Vietnam) (Male 2)", "vi-VN-Standard-D"]
  ];

  // src-blockly/blocks/telegramCall.ts
  var Blockly4 = window.Blockly;
  function installTelegramCall() {
    Blockly4.Sendto.blocks.telegram_call = `<sep gap="5"></sep>
<block type="telegram_call">
  <field name="INSTANCE"></field>
  <field name="LANGUAGE"></field>
  <field name="REPEATS">1</field>
  <field name="LOG"></field>
  <value name="MESSAGE">
    <shadow type="text">
      <field name="TEXT">text</field>
    </shadow>
  </value>
  <value name="USERNAME">
    <shadow type="text">
      <field name="TEXT"></field>
    </shadow>
  </value>
</block>`;
    Blockly4.Blocks.telegram_call = {
      init: function() {
        this.appendDummyInput("INSTANCE").appendField(Blockly4.Translate("telegram_call")).appendField(new Blockly4.FieldDropdown(instanceOptions()), "INSTANCE");
        this.appendValueInput("MESSAGE").appendField(Blockly4.Translate("telegram_message"));
        const input = this.appendValueInput("USERNAME").setCheck("String").appendField(Blockly4.Translate("telegram_username"));
        if (input.connection) {
          input.connection._optional = true;
        }
        this.appendDummyInput("LANGUAGE").appendField(Blockly4.Translate("telegram")).appendField(
          new Blockly4.FieldDropdown([[Blockly4.Translate("telegram_call_system"), ""], ...CALL_VOICES]),
          "LANGUAGE"
        );
        this.appendDummyInput("REPEATS").appendField(Blockly4.Translate("telegram_call_repeats")).appendField(
          new Blockly4.FieldDropdown([
            ["1", "1"],
            ["2", "2"],
            ["3", "3"],
            ["4", "4"],
            ["5", "5"]
          ]),
          "REPEATS"
        );
        this.appendDummyInput("LOG").appendField(Blockly4.Translate("telegram_log")).appendField(new Blockly4.FieldDropdown(logLevelOptions()), "LOG");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(Blockly4.Sendto.HUE);
        this.setTooltip(Blockly4.Translate("telegram_call_tooltip"));
        this.setHelpUrl(Blockly4.Translate("telegram_call_help"));
      }
    };
    registerGenerator("telegram_call", (block) => {
      const instance = block.getFieldValue("INSTANCE");
      const language = block.getFieldValue("LANGUAGE");
      const repeats = block.getFieldValue("REPEATS");
      const logLevel = block.getFieldValue("LOG");
      const text = Blockly4.JavaScript.valueToCode(block, "MESSAGE", Blockly4.JavaScript.ORDER_ATOMIC);
      const username = Blockly4.JavaScript.valueToCode(block, "USERNAME", Blockly4.JavaScript.ORDER_ATOMIC);
      const lines = [`sendTo('telegram${instance}', 'call', {
`];
      if (text) {
        lines.push(`  text: ${text},
`);
      }
      if (username) {
        lines.push(`  user: ${username},
`);
      }
      lines.push(`  lang: '${language}',
`);
      lines.push(`  repeats: ${parseInt(repeats, 10) || 1},
`);
      lines.push(`});
${logLine(logLevel, "telegramCall", username, text)}`);
      return lines.join("");
    });
  }

  // src-blockly/i18n/de.json
  var de_default = {
    telegram: "telegram",
    telegram_anyInstance: "Alle Instanzen",
    telegram_ask: "fragen per Telegram",
    telegram_ask_answer: "Antwort",
    telegram_ask_answers: "Antworten",
    telegram_ask_question: "Frage",
    telegram_call: "per Telegram anrufen",
    telegram_call_repeats: "Wiederholungen",
    telegram_call_system: "Systemsprache",
    telegram_call_tooltip: "per Telegram anrufen und einen Text sagen",
    telegram_chatid: "Empfänger (Chat-ID, optional)",
    telegram_disable_web_preview: "Webvorschau deaktivieren",
    telegram_escaping: "Escapezeichen verwenden",
    telegram_log: "Loglevel",
    telegram_log_debug: "debug",
    telegram_log_error: "error",
    telegram_log_info: "info",
    telegram_log_none: "keins",
    telegram_log_warn: "warning",
    telegram_message: "Meldung",
    telegram_parsemode_default: "Standard",
    telegram_silent: "ohne Benachrichtigung",
    telegram_tooltip: "Sende eine Meldung über Telegram",
    telegram_username: "Empfänger (Benutzername, optional)"
  };

  // src-blockly/i18n/en.json
  var en_default = {
    telegram: "telegram",
    telegram_anyInstance: "all instances",
    telegram_ask: "ask via Telegram",
    telegram_ask_answer: "Answer",
    telegram_ask_answers: "Answers",
    telegram_ask_question: "Question",
    telegram_call: "call via Telegram",
    telegram_call_repeats: "Repeats",
    telegram_call_system: "System language",
    telegram_call_tooltip: "Call via Telegram and say some text",
    telegram_chatid: "Recipient (Chat-ID, optional)",
    telegram_disable_web_preview: "disable web preview",
    telegram_escaping: "Escape chars",
    telegram_log: "log level",
    telegram_log_debug: "debug",
    telegram_log_error: "error",
    telegram_log_info: "info",
    telegram_log_none: "none",
    telegram_log_warn: "warning",
    telegram_message: "message",
    telegram_parsemode_default: "default",
    telegram_silent: "without notification",
    telegram_tooltip: "Send message to telegram",
    telegram_username: "Recipient (Username, optional)"
  };

  // src-blockly/i18n/es.json
  var es_default = {
    telegram: "telegram",
    telegram_anyInstance: "todas las instancias",
    telegram_ask: "pregunte por Telegram",
    telegram_ask_answer: "Respuesta",
    telegram_ask_answers: "Respuestas",
    telegram_ask_question: "Pregunta",
    telegram_call: "llamar por Telegram",
    telegram_call_repeats: "Repite",
    telegram_call_system: "Lenguaje del sistema",
    telegram_call_tooltip: "Llama por Telegram y di algo de texto",
    telegram_chatid: "Destinatario (Chat-ID, opcional)",
    telegram_disable_web_preview: "deshabilitar la vista previa web",
    telegram_escaping: "escape chars",
    telegram_log: "nivel de registro",
    telegram_log_debug: "depurar",
    telegram_log_error: "error",
    telegram_log_info: "información",
    telegram_log_none: "ninguna",
    telegram_log_warn: "advertencia",
    telegram_message: "mensaje",
    telegram_parsemode_default: "predeterminado",
    telegram_silent: "sin notificación",
    telegram_tooltip: "Enviar mensaje al telegrama",
    telegram_username: "Destinatario (nombre de usuario, opcional)"
  };

  // src-blockly/i18n/fr.json
  var fr_default = {
    telegram: "telegram",
    telegram_anyInstance: "toutes les instances",
    telegram_ask: "demander via Telegram",
    telegram_ask_answer: "Réponse",
    telegram_ask_answers: "Réponses",
    telegram_ask_question: "Question",
    telegram_call: "appeler par Telegram",
    telegram_call_repeats: "Répète",
    telegram_call_system: "Langue du système",
    telegram_call_tooltip: "Appelez par Telegram et dites du texte",
    telegram_chatid: "Destinataire (Chat-ID, facultatif)",
    telegram_disable_web_preview: "désactiver l'aperçu Web",
    telegram_escaping: "escape chars",
    telegram_log: "niveau de journalisation",
    telegram_log_debug: "déboguer",
    telegram_log_error: "Erreur",
    telegram_log_info: "Info",
    telegram_log_none: "aucun",
    telegram_log_warn: "Attention",
    telegram_message: "message",
    telegram_parsemode_default: "par défaut",
    telegram_silent: "sans notification",
    telegram_tooltip: "Envoyer un message au télégramme",
    telegram_username: "Destinataire (nom d'utilisateur, facultatif)"
  };

  // src-blockly/i18n/it.json
  var it_default = {
    telegram: "telegram",
    telegram_anyInstance: "tutte le istanze",
    telegram_ask: "chiedere via Telegram",
    telegram_ask_answer: "Risposta",
    telegram_ask_answers: "Risposte",
    telegram_ask_question: "Domanda",
    telegram_call: "chiama via Telegram",
    telegram_call_repeats: "Si ripete",
    telegram_call_system: "Linguaggio di sistema",
    telegram_call_tooltip: "Chiama via Telegram e pronuncia un messaggio",
    telegram_chatid: "Destinatario (ID chat, facoltativo)",
    telegram_disable_web_preview: "disabilitare l'anteprima web",
    telegram_escaping: "escape chars",
    telegram_log: "livello log",
    telegram_log_debug: "Debug",
    telegram_log_error: "errore",
    telegram_log_info: "Informazioni",
    telegram_log_none: "nessuna",
    telegram_log_warn: "avvertimento",
    telegram_message: "Messaggio",
    telegram_parsemode_default: "predefinito",
    telegram_silent: "senza notifica",
    telegram_tooltip: "Invia messaggio al telegramma",
    telegram_username: "Destinatario (Nome utente, facoltativo)"
  };

  // src-blockly/i18n/nl.json
  var nl_default = {
    telegram: "telegram",
    telegram_anyInstance: "alle instanties",
    telegram_ask: "vragen via Telegram",
    telegram_ask_answer: "Antwoord",
    telegram_ask_answers: "Antwoorden",
    telegram_ask_question: "Vraag",
    telegram_call: "bellen via Telegram",
    telegram_call_repeats: "Herhaalt",
    telegram_call_system: "Systeem taal",
    telegram_call_tooltip: "Bel via Telegram en zeg wat tekst",
    telegram_chatid: "Ontvanger (Chat-ID, optioneel)",
    telegram_disable_web_preview: "webvoorbeeld uitschakelen",
    telegram_escaping: "escape chars",
    telegram_log: "Log niveau",
    telegram_log_debug: "Debug",
    telegram_log_error: "fout",
    telegram_log_info: "Info",
    telegram_log_none: "geen",
    telegram_log_warn: "waarschuwing",
    telegram_message: "bericht",
    telegram_parsemode_default: "standaard",
    telegram_silent: "zonder kennisgeving",
    telegram_tooltip: "Stuur bericht naar telegram",
    telegram_username: "Ontvanger (gebruikersnaam, optioneel)"
  };

  // src-blockly/i18n/pl.json
  var pl_default = {
    telegram: "telegram",
    telegram_anyInstance: "wszystkie przypadki",
    telegram_ask: "pytaj przez Telegram",
    telegram_ask_answer: "Odpowiedź",
    telegram_ask_answers: "Odpowiedzi",
    telegram_ask_question: "Pytanie",
    telegram_call: "połączenie za Telegram",
    telegram_call_repeats: "Powtarza się",
    telegram_call_system: "Język systemowy",
    telegram_call_tooltip: "Zadzwoń za pośrednictwem Telegram i powiedz tekst",
    telegram_chatid: "Odbiorca (identyfikator czatu, opcjonalnie)",
    telegram_disable_web_preview: "wyłącz podgląd internetowy",
    telegram_escaping: "escape chars",
    telegram_log: "poziom dziennika",
    telegram_log_debug: "odpluskwić",
    telegram_log_error: "błąd",
    telegram_log_info: "informacje",
    telegram_log_none: "Żaden",
    telegram_log_warn: "ostrzeżenie",
    telegram_message: "wiadomość",
    telegram_parsemode_default: "domyślny",
    telegram_silent: "bez powiadomienia",
    telegram_tooltip: "Wyślij wiadomość do telegramu",
    telegram_username: "Odbiorca (nazwa użytkownika, opcjonalnie)"
  };

  // src-blockly/i18n/pt.json
  var pt_default = {
    telegram: "telegram",
    telegram_anyInstance: "todas as instâncias",
    telegram_ask: "perguntar via Telegram",
    telegram_ask_answer: "Resposta",
    telegram_ask_answers: "Respostas",
    telegram_ask_question: "Pergunta",
    telegram_call: "chamada via Telegram",
    telegram_call_repeats: "Repete",
    telegram_call_system: "Idioma do sistema",
    telegram_call_tooltip: "Ligue por Telegram e diga algum texto",
    telegram_chatid: "Destinatário (Chat-ID, opcional)",
    telegram_disable_web_preview: "desativar a visualização da web",
    telegram_escaping: "escape chars",
    telegram_log: "nível de log",
    telegram_log_debug: "depurar",
    telegram_log_error: "erro",
    telegram_log_info: "info",
    telegram_log_none: "Nenhum",
    telegram_log_warn: "Atenção",
    telegram_message: "mensagem",
    telegram_parsemode_default: "padrão",
    telegram_silent: "sem notificação",
    telegram_tooltip: "Enviar mensagem para telegrama",
    telegram_username: "Destinatário (nome de usuário, opcional)"
  };

  // src-blockly/i18n/ru.json
  var ru_default = {
    telegram: "telegram",
    telegram_anyInstance: "На все драйвера",
    telegram_ask: "спрос через Telegram",
    telegram_ask_answer: "Ответ",
    telegram_ask_answers: "Ответы",
    telegram_ask_question: "Вопрос",
    telegram_call: "звонок через Telegram",
    telegram_call_repeats: "Повторить",
    telegram_call_system: "Системный язык",
    telegram_call_tooltip: "Звоните через Telegram и скажите какой-нибудь текст",
    telegram_chatid: "Получатель (Chat-ID, необязательно)",
    telegram_disable_web_preview: "отключить предварительный просмотр в Интернете",
    telegram_escaping: "Escape",
    telegram_log: "Протокол",
    telegram_log_debug: "debug",
    telegram_log_error: "ошибка",
    telegram_log_info: "инфо",
    telegram_log_none: "нет",
    telegram_log_warn: "warning",
    telegram_message: "сообщение",
    telegram_parsemode_default: "по умолчанию",
    telegram_silent: "без уведомления",
    telegram_tooltip: "Послать сообщение через Telegram",
    telegram_username: "Получатель (имя пользователя, необязательно)"
  };

  // src-blockly/i18n/uk.json
  var uk_default = {
    telegram_ask: "подати заявку",
    telegram_ask_answer: "Відправити",
    telegram_ask_answers: "Відповідей",
    telegram_ask_question: "Питання",
    telegram_parsemode_default: "за замовчуванням"
  };

  // src-blockly/i18n/zh-cn.json
  var zh_cn_default = {
    telegram_ask: "通过Telegram 查询",
    telegram_ask_answer: "答复",
    telegram_ask_answers: "答复",
    telegram_ask_question: "问题",
    telegram_call: "通过电报电话",
    telegram_call_repeats: "重复",
    telegram_call_system: "系统语言",
    telegram_call_tooltip: "通过电报呼叫并说一些文字",
    telegram_chatid: "收件人（聊天 ID，可选）",
    telegram_disable_web_preview: "禁用网页预览",
    telegram_escaping: "escape chars",
    telegram_parsemode_default: "默认",
    telegram_username: "收件人（用户名，可选）"
  };

  // src-blockly/words.ts
  var Blockly5 = window.Blockly;
  var LANGUAGES = {
    de: de_default,
    en: en_default,
    es: es_default,
    fr: fr_default,
    it: it_default,
    nl: nl_default,
    pl: pl_default,
    pt: pt_default,
    ru: ru_default,
    uk: uk_default,
    "zh-cn": zh_cn_default
  };
  var README = "https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md";
  function installWords() {
    Blockly5.Translate || (Blockly5.Translate = function(word, lang) {
      lang || (lang = window.systemLang);
      const entry = Blockly5.Words?.[word];
      return entry ? entry[lang || "en"] || entry.en : word;
    });
    const words = {};
    for (const [lang, texts] of Object.entries(LANGUAGES)) {
      for (const [word, text] of Object.entries(texts)) {
        if (text) {
          (words[word] || (words[word] = {}))[lang] = text;
        }
      }
    }
    Object.assign(Blockly5.Words, words);
    Blockly5.Words.telegram_help = { en: README };
    Blockly5.Words.telegram_call_help = { en: `${README}#calls-via-telegram` };
  }

  // src-blockly/blockly.ts
  installWords();
  installTelegram();
  installTelegramCall();
  installTelegramAsk();
})();
