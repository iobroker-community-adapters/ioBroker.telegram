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

[en Documentation](./docs/en/README.md)

<!-- [🇩🇪 Dokumentation](./docs/de/README.md) -->

## Sentry

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (klein0r) Blockly 9 compatibility for new ask block

### 3.4.0 (2024-06-08)
* (klein0r) Updated Blockly definitions
* (klein0r) Added Blockly block to ask questions
* (klein0r) Remove keyboard on answer (or timeout)

### 3.3.2 (2024-05-26)
* (foxriver76) fixed problem with webserver handling

### 3.3.1 (2024-05-25)
* (mcm1957) Dependencies have been updated - especially 'node-telegram-bot-api'
* (mcm1957) see https://github.com/yagop/node-telegram-bot-api/blob/master/CHANGELOG.md

### 3.3.0 (2024-05-25)
* (foxriver76) Adapter has been migrated to `@iobroker/webserver`
* (foxriver76) Adapter supports js-controller 6 now
* (mcm1957) Dependencies have been updated

### 3.2.1 (2024-04-03)
* (PeterVoronov) An error at providing error information has been fixed.

## License

The MIT License (MIT)

Copyright (c) 2024 iobroker-community-adapters <iobroker-community-adapters@gmx.de>  
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
