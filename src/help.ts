/**
 * The answer of `help`: what the instance answers, written for an AI agent (e.g. ioBroker.pi-agent, or the MCP
 * server with `send_to`) and for script authors. Keep it in sync with `onMessage` / `processMessage` in main.ts.
 */

/**
 * Every command `onMessage` answers; `write: true` = it has an effect (sends, calls, changes the user list);
 * `standard` = it follows the shared catalog of commands for adapter families (message.*)
 */
export const COMMANDS: { command: string; write: boolean; standard?: string }[] = [
    { command: 'help', write: false },
    { command: 'send', write: true },
    { command: 'ask', write: true },
    { command: 'call', write: true },
    { command: 'getRecipients', write: false, standard: 'message.getRecipients' },
    { command: 'edit', write: true, standard: 'message.edit' },
    { command: 'delete', write: true, standard: 'message.delete' },
    { command: 'message.send', write: true, standard: 'message.send' },
    { command: 'message.ask', write: true, standard: 'message.ask' },
    { command: 'sendNotification', write: true },
    { command: 'adminuser', write: false },
    { command: 'delUser', write: true },
    { command: 'systemMessages', write: true },
    { command: 'delAllUser', write: true },
];

export const HELP = `ioBroker.telegram: a Telegram bot. It sends messages, pictures, files and locations to the users of the bot and
to chats and groups, asks questions with buttons and returns the reply, and receives messages (they go to the state
communicate.request, to text2command or to an assistant instance). It can also call a user via CallMeBot.
Recipients: the users who authenticated with the bot (stored in communicate.users) and the chats and groups the bot
has seen (communicate.chats). Telegram lets a bot write only into chats that wrote to it before.
getRecipients, edit, delete, message.send and message.ask follow the shared catalog of message commands
(message.getRecipients, message.edit, message.delete, message.send, message.ask). send and ask keep their own answers
(a number, the raw Telegram message), so the catalog versions of them have the full names message.send and
message.ask.

Commands (sendTo telegram.0):
- send {text, user?, chatId?, ...options} or just a text: sends a message; answer: the number of addressed
  recipients (0 = no name matched), or with returnMessageIds: true {<chatId>: messageId, error?: {<chatId>: reason}}.
  Recipients: chatId (number or string, a private chat or a group such as "-1001234567890") wins over user.
  user: a name (the telegram username, or the first name if the settings use first names or the user has no
  username) or a user id; several separated by "," ";" or space, or an array. Without chatId and user: every
  stored user; a text that starts with "@name" then goes only to the user whose name matches.
  recipient: an id or name of getRecipients (a user by first name or username, a group by its title, without case);
  used only when neither chatId nor user is given.
  text: the message (string or number); <HTML>...</HTML>, <Markdown>...</Markdown> or <MarkdownV2>...</MarkdownV2>
  around it sets parse_mode. A local file path, an http(s) URL of a picture, a URI iobfile://<adapter.0>/<path>,
  iobstate://<state id> or iobobject://<object id>/<path>, or a Buffer is sent as a file: the kind follows the
  extension (jpg, png, gif, bmp: photo; mp4: video; mp3, ogg, wav: audio; webp: sticker; txt, pdf, csv, doc, docx,
  xls, xlsx: document) or the option type. The texts typing, upload_photo, upload_video, record_video, record_audio,
  upload_document, find_location show that action in the chat.
  Options: type (photo, video, audio, document, sticker, animation, mediagroup), fileName (name for a Buffer or
  URI), caption, parse_mode (HTML, Markdown, MarkdownV2), disable_notification (true = silent), message_thread_id
  (topic of a forum group), reply_markup ({keyboard: [["A", "B"]], resize_keyboard?, one_time_keyboard?} or
  {inline_keyboard: [[{text, callback_data}]]}), media (with type mediagroup: array of local photo paths), and any
  other parameter of the Bot API method (e.g. disable_web_page_preview, protect_content), passed on unchanged.
  latitude, longitude: sends a location; with title and address too a venue.
  Change a sent message (chat_id, message_id from returnMessageIds): editMessageText {options: {chat_id,
  message_id, ...}} with text = the new text; editMessageCaption {options: {chat_id, message_id}} with text = the
  new caption; editMessageMedia {options: {chat_id, message_id, caption?, parse_mode?, reply_markup?}} with text =
  the new file; editMessageReplyMarkup {reply_markup, options: {chat_id, message_id}}; deleteMessage {options:
  {chat_id, message_id}}. answerCallbackQuery {text?, showAlert?} with chatId or user of the person who pressed
  an inline button: confirms the press (text as a notice, showAlert true = as a dialog).
- ask {text, user?, chatId?, reply_markup?, ...options of send} or just a text: sends a question and answers with
  the reply within the answer timeout of the settings (default 60 s): the Telegram message ({text, chat, from,
  ...}) or for an inline button the callback query ({data: the callback_data of the button, from, message});
  "__timeout__" if nobody replied. The sendTo of the caller must wait longer than that timeout.
- call {text, user?, users?, lang?, file?, repeats?} or just a text: a voice call in the Telegram app via CallMeBot
  that reads the text. users: array of telegram usernames (@name) or phone numbers (+49...); user: one of them;
  neither: every stored user with a username (all of them, like send without user). lang: a voice such as
  de-DE-Standard-A (default: by the system language). file: URL of an mp3 to play instead of the text. repeats:
  number of repeats. The calls are made one after the other; answer when all are done: {called: number of
  successful calls, error?: the reasons of the failed ones, or that no user with a username is stored}.
- getRecipients {}: the users and chats the bot knows, from communicate.users and communicate.chats (nothing is
  sent); answer {recipients: [{id, name, kind: user, group or chat, default?: true, userName?}]}. default: send
  without a recipient goes to every stored user.
- edit {id, text, recipient?}: changes the text of a message the bot sent; delete {id, recipient?}: deletes a
  message (the bot's own, or in a group where it may delete). id: the message id (from send with
  returnMessageIds: true, {<chatId>: messageId}); recipient: the chat of the message, an id or name of
  getRecipients; default the only stored user (with several users it is needed). Answer {ok: true} or {error,
  reason?: BAD_REQUEST, NOT_FOUND (with candidates), NOT_CONNECTED}.
- message.send {text, recipient?, title?, file?, files?, priority?}: sends a message as the shared catalog says.
  recipient: an id or name of getRecipients, or several (array or "," between them); default every stored user,
  like send. chatId and user (names) of send work too. title: the first line of the text. file, files: pictures or files - {data, contentType} (base64 or a data
  URL, as cameras and charts answer), a data URL, base64 with the parameter contentType, iobfile://<adapter.0>/
  <path>, an http(s) URL; the kind (photo, video, audio, document) follows the content type or the extension. The
  text goes as the caption of the first file (if it has at most 1024 characters), every file is a message of its
  own. priority: low or a negative number = without notification sound. Other options of send (parse_mode,
  reply_markup, message_thread_id, ...) are passed on. Answer {ok: true, sent: number of chats that got it, id?:
  the message id (with one chat; for edit and delete), failed?: {<chatId>: reason}} or {error, reason?: BAD_REQUEST,
  NOT_FOUND (with candidates), NOT_CONNECTED}.
- message.ask {text, answers?, recipient?, timeoutSec?}: sends a question and answers with the reply: {answer: the
  text of the pressed button or the typed reply, index?: the button (0-based; also for a typed reply equal to a
  button), from?: the name of the person} or {timeout: true}. answers: texts for inline buttons (array, or a text
  with "," between them); without them the reply is free text. recipient as in message.send (without it every
  stored user gets the question, the first reply counts). timeoutSec: default the answer timeout of the settings
  (60 s); the sendTo of the caller must wait longer. A reply counts only in the chats of the question, a button only
  on the question; it is not processed further (not forwarded to text2command or an assistant). At once {error,
  reason?} (as message.send) if the question could not be sent.
- sendNotification: for the notification-manager (sends the notification to the users that receive system
  messages); answer {sent}.
- help: this text and the list of commands {help, commands: [{command, write, standard?}]}.
- adminuser, delUser, systemMessages, delAllUser: for the settings, not for agents.
Other commands are answered with {error, reason: "NOT_SUPPORTED"}.

States (telegram.0.communicate.*): users (JSON: user id -> {firstName, userName, sysMessages}), chats (JSON: chat
id -> {title, type: private, group, supergroup or channel}), request (the last received message as "[name]text"),
requestChatId, requestUserId, requestMessageId of it. Writing with ack false sends: response (a text to every
user, or "@name text"), responseSilent (the same without notification), responseJson and responseSilentJson (JSON
like the message of send), requestResponse (a text into the chat of the last received message).

How to talk to the user:
- Ask for the recipient (user, chat or group) when it is not clear; take the names from getRecipients (or
  communicate.users and communicate.chats), never guess a chat id. Without user and chatId send goes to every
  stored user, and call without user and users calls every stored user: fine if only the user is stored, else ask.
- Sending to other people than the user, into groups or to all users, and calls only on the user's explicit request.
  Edit or delete a message only on the user's explicit request.
- Name users and chats by their names, not by ids; times in local time.
- Tell the user to whom the message went; an answer 0 means the name is unknown to the bot.
- message.send and message.ask reach other people: only on the user's explicit request, like send and ask.`;
