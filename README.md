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

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information on how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### 6.0.1 (2026-09-12)
- (@GermanBluefox) Updated packages and improved the rules block
- (@patricknitsch) Retried getUpdates 409 conflicts quickly before falling back to a slow restartart

### 6.0.0 (2026-09-02)
- (@GermanBluefox) Adapter requires Node.js >= 22.19 now (required by undici 8)
- (@GermanBluefox) The connection to the telegram servers can be routed through an HTTP(S) or SOCKS5 proxy (new "Use proxy" settings; the old proxy fields had been without function for years)
- (@GermanBluefox) Migrated to `node-telegram-bot-api` v2. Updates are now received via long polling, so the "Polling interval" setting became obsolete and was removed from the configuration dialog. Errors thrown while processing an update are logged by the adapter instead of ending up on the console
- (@GermanBluefox) An empty "API URL" field no longer breaks every API call with "EFATAL: Failed to parse URL" - the default `https://api.telegram.org` is used again (#1371)
- (@GermanBluefox) A `text2command`/`assistant` instance stored in the long form (`system.adapter.text2command.0`, written by the config UI before v1.12.6) is migrated to the short form on startup, so the config dialog shows the selected instance again (#1365)
- (@GermanBluefox) Added the states `communicate.requestLocationLive` (live location is still being shared), `communicate.requestLocationHeading` and `communicate.requestLocationAccuracy` for received (live) locations

### 5.0.4 (2026-09-01)
- (@GermanBluefox) Blockly migrated to TypeScript
- (@bjoernjaeschke87-beep) Live location updates (delivered by Telegram as `edited_message`) now update `communicate.requestLocation` while the location is being shared

### 5.0.3 (2026-08-10)
- (@GermanBluefox) Fixed: the configured `text2command`/`assistant` instance may now also be stored in the long form (`system.adapter.text2command.0`) - the alive check no longer fails with "instance is not running"

### 5.0.2 (2026-08-03)
- (copilot) Adapter requires node.js >= 22 now
- (copilot) Adapter requires admin >= 8.0.0 now
- (@klein0r) admin 8.0.0 and js-controller 6.0.11 (or later) are required
- (@klein0r) Updated dependencies

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
