![Logo](admin/telegram.png)

# ioBroker.telegram

[![GitHub license](https://img.shields.io/github/license/iobroker-community-adapters/ioBroker.telegram)](https://github.com/iobroker-community-adapters/ioBroker.telegram/blob/master/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/iobroker.telegram.svg)](https://www.npmjs.com/package/iobroker.telegram)
![GitHub repo size](https://img.shields.io/github/repo-size/iobroker-community-adapters/ioBroker.telegram)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/telegram/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)</br>
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/iobroker-community-adapters/ioBroker.telegram)
![GitHub commits since latest release (by date)](https://img.shields.io/github/commits-since/iobroker-community-adapters/ioBroker.telegram/latest)
![GitHub last commit](https://img.shields.io/github/last-commit/iobroker-community-adapters/ioBroker.telegram)
![GitHub issues](https://img.shields.io/github/issues/iobroker-community-adapters/ioBroker.telegram)
</br>
**Version:** </br>
[![NPM version](http://img.shields.io/npm/v/iobroker.telegram.svg)](https://www.npmjs.com/package/iobroker.telegram)
![Current version in stable repository](https://iobroker.live/badges/telegram-stable.svg)
![Number of Installations](https://iobroker.live/badges/telegram-installed.svg)
</br>
**Tests:** </br>
[![Test and Release](https://github.com/iobroker-community-adapters/ioBroker.telegram/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/iobroker-community-adapters/ioBroker.telegram/actions/workflows/test-and-release.yml)
[![CodeQL](https://github.com/iobroker-community-adapters/ioBroker.telegram/actions/workflows/codeql.yml/badge.svg)](https://github.com/iobroker-community-adapters/ioBroker.telegram/actions/workflows/codeql.yml)

## ioBroker telegram adapter

Use telegram service to communicate with ioBroker

## Documentation

[Documentation](./docs/en/README.md)

## Sentry

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### 5.0.2 (2026-08-03)
- (copilot) Adapter requires node.js >= 22 now
- (copilot) Adapter requires admin >= 7.7.22 now
- (@klein0r) admin 8.0.0 and js-controller 6.0.11 (or later) are required
- (@klein0r) Updated dependencies

### 5.0.0-alpha.0 (2026-07-10)
- (@GermanBluefox) Channel posts (from a channel where the bot is an admin) are now received and written to `communicate.request`/`communicate.requestChatId` (previously ignored)
- (@GermanBluefox) Robustness: all `setState` calls now catch their errors (via a `setStateSafe` helper), so a failing state write can no longer cause an unhandled promise rejection
- (@GermanBluefox) Added the state `communicate.chats`: every chat/group the bot receives a message from is remembered as JSON (`id => {title, type}`), so other adapters can offer a chat/group picker
- (@GermanBluefox) Outgoing messages that fail because telegram is unreachable are now queued in memory and resent automatically once the connection is back (bounded queue, permanent errors like "chat not found" are not retried)
- (@GermanBluefox) Documented that an unanswered `ask` returns the string `'__timeout__'`, and that the calling adapter's own `sendTo` timeout (JavaScript adapter defaults to ~20 s) must be larger than the configured answer timeout - otherwise the callback fires early (looks like a "No" answer)
- (@GermanBluefox) A received location or venue is now written to the new state `communicate.requestLocation` as `latitude;longitude` (role `value.gps`), so it can be shown e.g. on a map
- (@GermanBluefox) Fixed: recipients can now be mixed by username and first name in one list - a recipient without a public telegram username is matched by first name even when "store username" is active
- (@GermanBluefox) Added the missing translations for the configuration labels (API URL, port, certificates, media quality, ...) in all languages
- (@GermanBluefox) Robustness: all telegram API calls now catch their errors, so a failing call can no longer terminate the adapter with an unhandled promise rejection
- (@GermanBluefox) The inline keyboard of a broadcast `ask` question is now removed for the user who answered (taken from the pressed callback message)
- (@GermanBluefox) Fixed: the adapter no longer crashes (unhandled promise rejection) when the inline keyboard of an answered/timed-out `ask` question cannot be removed (e.g. "message to edit not found")
- (@GermanBluefox) Fixed: `deleteMessage`/`editMessage*` without an explicit `user`/`chatId` is now executed once for the chat given in its options instead of being broadcast to every user (which made the other users fail)
- (@GermanBluefox) The caption of a received photo/video/document is now written to `communicate.request` (like a normal text message), so image captions are no longer lost
- (@GermanBluefox) Added a "Parsemode" option to the "ask via Telegram" Blockly block, so questions can be formatted with HTML/MarkdownV2
- (@GermanBluefox) Added support for sending files directly from the ioBroker file storage via `iobfile://`, `iobobject://` and `iobstate://` URIs (works with Redis/jsonl where the file is not on the local filesystem)
- (@GermanBluefox) The `/password` message is now deleted from the chat after a successful authentication
- (@GermanBluefox) Fixed: `requestChatId`/`requestMessageId`/`requestUserId` are now set when receiving a photo, document or other media
- (@GermanBluefox) Fixed: sending to a recipient by numeric user id (`{ user: "12345" }`) now works
- (@GermanBluefox) Fixed: no longer crashes when a system notification contains an empty messages list
- (@GermanBluefox) Added an optional `ioBroker.assistant` instance: messages that no internal rule/command matched are forwarded to it and its answer is sent back to the chat
- (@GermanBluefox) Migrated the adapter backend to TypeScript; texts are now provided as `i18n` JSON files loaded via `I18n`
- (@GermanBluefox) The target instance is now checked to be alive before a message is forwarded (text2command/assistant)
- (@GermanBluefox) States without a value are now reported as "uncertain" instead of showing an unset boolean as "ON"
- (@GermanBluefox) Timers are now managed by the adapter and cleared on unload (including pending question timeouts)
- (@GermanBluefox) Fixed: the "allow states" option could not be disabled
- (@GermanBluefox) Fixed: a question timeout could drop other pending questions
- (@GermanBluefox) Fixed: `communicate.responseSilentJson` acknowledged the wrong state
- (@GermanBluefox) Fixed: removed a stray empty entry from the generated command keyboard

### 4.1.0 (2025-03-19)
* (bluefox) Admin component was migrated to TypeScript
* (bluefox) Node.js >= 20.x and js-controller >= 6 and admin >= 7 are required now.

### 4.0.0 (2025-01-13)
* NodeJS >= 20.x and js-controller >= 6 are required
* (simatec) Responsive Design added
* (klein0r) Allow async function calls in ask callback function

### 3.9.0 (2024-07-22)
* (klein0r) Added option to send venue (with title and address)

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License

The MIT License (MIT)

Copyright (c) 2024-2026 iobroker-community-adapters <iobroker-community-adapters@gmx.de>  
Copyright (c) 2016-2023, bluefox <dogafox@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
