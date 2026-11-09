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

> [!IMPORTANT]
> This adapter cannot be installed from github

## ioBroker telegram adapter

Use telegram service to communicate with ioBroker

## Documentation

[Documentation](./docs/en/README.md)

## Sentry

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information on how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
- (@GermanBluefox) Voice messages can be converted to text by an `ai-parakeet` instance (new setting "Speech recognition instance"); the text is then processed like a typed message (`communicate.request`, commands, `text2command`, assistant) and also written to the new state `communicate.requestVoiceText`. "Show the recognised text in the chat" answers with what was understood (🎤 …)

### 6.3.0 (2026-11-07)
- (@GermanBluefox) Added "Delete received files after (days)": saved voice messages, photos, videos, audio files and documents older than that are deleted, in the file system or in the file storage, checked every hour. 0 (default) keeps them as before

### 6.2.1 (2026-11-07)
- (@GermanBluefox) Videos for the `assistant` instance are stored in the data directory of the instance (`iobroker-data/telegram_0/assistant`, the newest 20) and go along as `iobdisk://` URL, which the assistant reads from any host (js-controller 8.0+). With an older js-controller they still go to the file storage

### 6.2.0 (2026-11-04)
- (@GermanBluefox) Questions to the `assistant` instance (text and voice) wait at most 2 minutes for the answer; after that the user gets "The assistant did not answer in time." instead of no reply at all (e.g. when the assistant restarted meanwhile)
- (@GermanBluefox) Photos and videos are forwarded to the `assistant` instance too: photos (an album as one question, at most 4) with their caption as the question, videos are stored in the file storage of the instance (folder `assistant`, the newest 20) and only their place goes along. Can be switched off with "Photos and videos to the assistant"
- (@GermanBluefox) Added the state `communicate.pathFileUrl`: the `iobdisk://` URL of the last received file (e.g. `iobdisk://pi4/telegram.0/video/2026-11-04_10-00-00.mp4`), which instances on other hosts can read with `readDiskFile(url)` - the path in `communicate.pathFile` is only valid on the host of telegram. Needs js-controller 8.0 and `saveFilesTo: filesystem`, otherwise the state stays empty

### 6.1.0 (2026-11-04)
- (@GermanBluefox) Voice messages are forwarded to the configured `assistant` instance: it recognises the speech and the answer is sent back to the chat with the recognised text in front (🎤 …). The same user check as for text messages applies; a voice message with a caption is answered by its caption. Needs ioBroker.assistant with voice enabled, a speech recognition engine and ffmpeg on the host
- (@GermanBluefox) `send` can return the ids of the sent messages again (`returnMessageIds: true`), to edit or delete the message later; failed recipients come with the reason (#1389)
- (@GermanBluefox) The Blockly block "telegram" has an optional input for the topic (thread id) of a forum group (#952)
- (@GermanBluefox) Completed the Blockly translations for Ukrainian and Chinese

### 6.0.2 (2026-09-12)
- (@GermanBluefox) Updated packages and improved the rules block
- (@patricknitsch) Retried getUpdates 409 conflicts quickly before falling back to a slow restartart

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
