# Older changes
## 3.5.0 (2024-06-12)
* (klein0r) Added option to save media files into ioBroker file system (files tab)

## 3.4.1 (2024-06-09)
* (klein0r) Blockly 9 compatibility for new ask block

## 3.4.0 (2024-06-08)
* (klein0r) Updated Blockly definitions
* (klein0r) Added Blockly block to ask questions
* (klein0r) Remove keyboard on answer (or timeout)

## 3.3.2 (2024-05-26)
* (foxriver76) fixed problem with webserver handling

## 3.3.1 (2024-05-25)
* (mcm1957) Dependencies have been updated - especially 'node-telegram-bot-api'
* (mcm1957) see https://github.com/yagop/node-telegram-bot-api/blob/master/CHANGELOG.md

## 3.3.0 (2024-05-25)
* (foxriver76) Adapter has been migrated to `@iobroker/webserver`
* (foxriver76) Adapter supports js-controller 6 now
* (mcm1957) Dependencies have been updated

## 3.2.1 (2024-04-03)
* (PeterVoronov) An error at providing error information has been fixed.

## 3.2.0 (2024-04-02)
* (mcm1957) Adapter requires node.js 18 and js-controller >= 5 now
* (PeterVoronov) The current error is added as a separate property error to the response object (messageId) now.
* (theknut) Added units to responses
* (mcm1957) Dependencies have been updated

## 3.1.0 (2024-02-17)
* (theknut) Option to send state updates without notification sound has been added. [#793]
* (mcm1957) Dependencies have been updated.

## 3.0.1 (2023-12-08)
* (foxriver76) send the actual message too via notification-manager

## 3.0.0 (2023-11-06)
* (boergegrunicke) BREAKING CHANGE: Socks5 support has been removed.
* (PeterVoronov ) Extended and improved the returned list of processed messages.

## 2.0.2 (2023-11-06)
* (mcm1957) Dependencies have been updated.

## 2.0.1 (2023-10-10)
* (boergegrunicke) Incorrect trailing zero in callback of sendTo() has been fixed. [#680]
* (mcm1957) Dependencies have been updated.

## 2.0.0 (2023-10-09)
* (bluefox) Packets were updated.
* (bluefox) BREAKING CHANGE: The minimal node.js version is 16
* (boergegrunicke) BREAKING CHANGE: Return an object with chatId and messageId instead of the message count

## 1.16.0 (2023-06-16)
* (foxriver76) We have added support for the `notification-manager` adapter

## 1.15.6 (2023-02-17)
* (bluefox) Implemented the optional escaping of characters in blockly
* (bluefox) Added the possibility to send updates of states only by changes
* (bluefox) Added option to select the quality of stored images

## 1.15.5 (2023-02-16)
* (bluefox) Added possibility to set `parse_mode` in the text message

## 1.15.2 (2022-11-04)
* (Steff42) Make sure the userid is a string to show warnings in the log
* (bluefox) Added ukrainian language

## 1.15.0 (2022-09-28)
* (klein0r) Fixed custom component (username was missing)
* (klein0r) Translated all objects
* (bluefox) Updated GUI packages and corrected build process

## 1.14.1 (2022-07-04)
* (bluefox) Fixed warnings for `botSendChatId`

## 1.14.0 (2022-07-02)
* (bluefox) Ported config Gui to Admin 6

## 1.13.0 (2022-06-01)
* (klein0r) Added Admin 5 UI config
* (bluefox) Added rule block for javascript as plugin

## 1.12.6 (2022-04-23)
* (Apollon77) Fixed crash cases reported by Sentry

## 1.12.5 (2022-04-19)
* (Apollon77) Fix crash cases reported by Sentry

## 1.12.4 (2022-04-19)
* (Apollon77) Fix crash cases reported by Sentry

## 1.12.3 (2022-04-19)
* (Apollon77) Make sure also not set states can be queried - will return "State not set" in this case!

## 1.12.2 (2022-04-01)
* (Apollon77) Fix crash cases reported by Sentry

## 1.12.0 (2022-03-21)
* (Apollon77) Add new JSON states communication.responseJson and communication.responseSilentJson to also accept json structures (stringified!) to send messages
* (Apollon77) Try to prevent adapter crashes when internet is not available 
* (Apollon77) Add Sentry for crash reporting

## 1.11.1 (2022-01-27)
* (bluefox) fixed the receiving files

## 1.11.0 (2022-01-26)
* (bluefox) Added bruteforce protection
* (bluefox) Extended blockly with `disable_web_preview` option
* (bluefox) added `communicate.responseSilent` state to answer silently

## 1.10.1 (2022-01-26)
* (bluefox) Updated telegram library

## 1.10.0 (2021-07-30)
* (PeterVoronov) Add botSendRaw state to allow processing of the RAW data send by bot
* (Apollon77) Add tier for js-controller 3.3
* (bluefox) Fixed the control of the states

## 1.9.0 (2021-06-26)
* (bluefox) Added the option to not authenticate the new users
* (bluefox) Added the option to disable system messages for specific users

## 1.8.3 (2021-06-26)
* (Nahasapeemapetilon) corrected bug with many simultaneous requests 
* (bluefox) formatting
* (bluefox) implemented editMessageMedia and editMessageCaption
* (bluefox) Encrypt token 
* (bluefox) Corrected error with password
* (bluefox) Corrected error with boolean easy controls

## 1.8.2 (2021-05-28)
* (Diginix) fixed data types

## 1.8.1 (2021-04-20)
* (bluefox) added the admin5 support

## 1.8.0 (2021-02-22)
* (Apollon77/Nahasapeemapetilon) catch several API error cases to hopefully get around  adapter crashes on network errors
* (Nahasapeemapetilon) add support for media groups and multiple image qualities

## 1.7.0 (2021-01-08)
* (bluefox) Support of new Let's Encrypt (only with js-controller 3.2.x)

## 1.6.2 (2020-12-27)
* (fincha) Fixing error with keyboard

## 1.6.1 (2020-12-01)
* (ChristianB86) Added option to set the amount of repeats for telegram call.

## 1.6.0 (2020-11-09)
* (MarkRohrbacher) Allow overriding chatId / user when writing JSON objects to telegram.INSTANCE.communicate.response
* (blazeis) Fix Send message via Response field with Username
* (Garfonso) fill requestRaw also for callbackQuery

## 1.5.9 (2020-05-04)
* (Apollon77) potential error fixed when sending messages
* (Apollon77) webserver initialization optimized again to prevent errors with invalid certificates

## 1.5.8 (2020-04-30)
* (Apollon77) errors on webserver initialization are handled properly

## 1.5.6 (2020-04-04)
* (bluefox) Fixed missing languages for blockly
* (bluefox) Added description of easy-keyboard

## 1.5.5 (2020-04-04)
* (alutov) Fixed bug for telegram users with an empty username
* (Mark Rohrbacher) Allowed JSON objects in telegram.*.communicate.response

## 1.5.4 (2020-03-11)
* (bluefox) Improvement of `callmebot`

## 1.5.3 (2020-02-23)
* (foxriver76) removed usage of adapter.objects
* (Haba) Fix of the response for the "callback_query" event

## 1.5.1 (2020-02-09)
* (bluefox) Invalid parameters were checked

## 1.5.0 (2020-02-03)
* (bluefox) Added voice calls

## 1.4.7 (2019-12-27)
* (Apollon77) Make compatible with js-controller 2.3

## 1.4.6 (2019-12-09)
* (bluefox) Allowed writeOnly states in telegram

## 1.4.4 (2019-11-27)
* (bluefox) New sendTo message "ask" was added (see [Question](#question) )

## 1.4.3 (2019-02-21)
* (BuZZy1337) Bugfix for not yet completely implemented feature

## 1.4.2 (2019-02-18)
* (BuZZy1337) fix for recipients containing spaces
* (BuZZy1337) change loglevel of "getMe" info-messages to debug
* (bluefox) fix scroll in firefox

## 1.4.1 (2019-01-12)
* (simatec) Support for Compact mode

## 1.4.0 (2019-01-06)
* (bluefox) Custom settings for states were added

## 1.3.6 (2018-12-01)
* (Apollon77) fix #78

## 1.3.5 (2018-11-04)
* (BuZZy1337) Fix a small error caused by previous commit

## 1.3.4 (2018-11-04)
* (BuZZy1337) Ask if saved users should be wiped when password is changed.

## 1.3.3 (2018-11-03)
* (BuZZy1337) Show warning if no password is set.

## 1.3.2 (2018-10-28)
* (BuZZy1337) Just minor cosmetic fixes/changes

## 1.3.1 (2018-10-08)
* (bluefox) The ability of enable/disable of states controlling was added

## 1.3.0 (2018-09-19)
* (BuZZy1337) Added possibility to delete authenticated users in the Adapter-Config screen (via Messages tab)
* (BuZZy1337) fixed a problem "building" the Blockly `sendto` block when no adapter instance exists.

## 1.2.7 (2018-08-29)
* (BuZZy1337) Added "disable notification" checkbox to blockly block.
* (BuZZy1337) Added "parse_mode" selector to blockly block.

## 1.2.6 (2018-07-30)
* (BuZZy1337) Added support for sending Messages to Group-Chats via Blockly.

## 1.2.5 (2018-07-11)
* (BuZZy1337) Added possibility to specify more than one recipient. (separated by comma)

## 1.2.4 (2018-06-02)
* (BuZZy1337) remove HTML Tags from Logerror-Messages
* (Apollon77) fix misleading error when setting a value for a state

## 1.2.3 (2018-04-26)
* (Osrx) Added Socks5 settings to config dialog on machines running admin 2.

## 1.2.2 (2018-04-25)
* (kirovilya) Changed library for Proxy Socks5

## 1.2.1 (2018-04-17)
* (Haba) Added support for Proxy Socks5.

## 1.2.0 (2018-03-21)
* (AlGu) Possibility to define polling interval in configuration wizard. Default is 300ms.

## 1.1.4 (2018-03-20)
* (BasGo) Added checks before accessing non-existing options

## 1.1.3 (2018-03-19)
* (BasGo) Fixed issue preventing adapter to terminate correctly
* (BasGo) Fixed issue with wrong callback query id

## 1.1.2 (2018-03-16)
* (BasGo) Reworked configuration and translation

## 1.1.1 (2018-01-26)
* (Haba) New objects: botSendChatId, botSendMessageId

## 1.1.0 (2018-01-24)
* (bluefox) Possibility to send photo, video, document, audio as buffer.

## 1.0.11 (2018-01-23)
* (Haba) Sending an image without intermediate caching

## 1.0.10 (2018-01-18)
* (Haba) Updating for Admin3

## 1.0.9 (2017-11-27)
* (kirovilya) Allow the sending of GIF via sendDocument

## 1.0.8 (2017-10-03)
* (Haba1234) initPolling() this is deprecated. -> startPolling()
* (Haba1234) Add log polling_error and webhook_error.

## 1.0.7 (2017-09-27)
* (Haba) New function: deleteMessage. Update version lib node-telegram-bot-api

## 1.0.6 (2017-07-19)
* (Haba) Fix an incorrect order of writing variables

## 1.0.5 (2017-07-18)
* (Haba) inline keyboard and new functions: answerCallbackQuery, editMessageText, editMessageReplyMarkup

## 1.0.4 (2017-06-22)
* (dwm) Fix longitude and latitude

## 1.0.3 (2017-05-24)
* (bluefox) Fix position message

## 1.0.2 (2017-01-13)
* (bluefox) show only installed instances in blockly

## 1.0.1 (2016-11-04)
* (bluefox) Show user name in error message

## 1.0.0 (2016-10-31)
* (bluefox) server mode with web hooks

## 0.4.4 (2016-10-12)
* (bluefox) support of blockly

## 0.4.3 (2016-08-28)
* (bluefox) filter out double messages

## 0.4.2 (2016-08-22)
* (bluefox) translations
* (bluefox) configurable restarting/started texts

## 0.4.1 (2016-07-29)
* (bluefox) response to chatId and not to userId
* (bluefox) cut messages with @
* (bluefox) add new states: requestChatId and requestUserId

## 0.4.0 (2016-07-21)
* (bluefox) allow sending of messages to chats via chat-ID
* (bluefox) support of video(mp4), audio, document, location, sticker, action

## 0.3.0 (2016-05-31)
* (bluefox) restart connection every hour

## 0.2.4 (2016-05-08)
* (bluefox) replace "_" with " " when sending to text2command

## 0.2.3 (2016-05-04)
* (bluefox) replace "/" with "#" when sending to text2command

## 0.2.2 (2016-04-14)
* (Jonas) fix unload

## 0.2.1 (2016-04-13)
* (Jonas) fix configuration and send to more than one user

## 0.2.0 (2016-04-12)
* (bluefox) add send photo possibility

## 0.1.0 (2016-02-20)
* (bluefox) fix double responses.
* (bluefox) inform about new start

## 0.0.2 (2016-02-15)
* (bluefox) fix error with sendTo

## 0.0.1 (2016-02-13)
* (bluefox) initial commit
