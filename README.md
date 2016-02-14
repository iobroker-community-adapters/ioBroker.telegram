![Logo](admin/telegram.png)
ioBroker telegram Adapter
==============

[![NPM version](http://img.shields.io/npm/v/iobroker.telegram.svg)](https://www.npmjs.com/package/iobroker.telegram)
[![Downloads](https://img.shields.io/npm/dm/iobroker.telegram.svg)](https://www.npmjs.com/package/iobroker.telegram)
[![Tests](https://travis-ci.org/ioBroker/ioBroker.telegram.svg?branch=master)](https://travis-ci.org/ioBroker/ioBroker.telegram)

[![NPM](https://nodei.co/npm/iobroker.telegram.png?downloads=true)](https://nodei.co/npm/iobroker.telegram/)

Ask [@BotFather](https://telegram.me/botfather) to create new bot ```/newbot```. 

You will be asked to enter name of the bot and then the username.
After that you will get the Token.

![Screenshot](img/chat.png)

You should set password for communication in configuration dialog.

To authenticate user by Bot write "/password phrase", where **phrase** is your configured password.

**Note:** you can use short form "/p phrase".
 
You can send message to all authenticated users over messageBox ```sendTo('telegram', 'Test message')``` 
or to specific user ```sendTo('telegram', '@userName Test message')```.
User must be authenticated before.
You can specifiy user in that way too:

```
sendTo('telegram', {user: 'UserName', text: 'Test message'}, function (res) {
    console.log('Sent to ' + res + ' users');
});
```

You can send message over state too, just set state *"telegram.INSTANCE.communicate.response"* with value *"@userName Test message"*.

## Usage
You can use telegram with [text2command](https://github.com/ioBroker/ioBroker.text2command) adapter. There are predefined communication schema and you can command to you home in text form.

## Changelog
### 0.0.1 (2016-02-13)
* (bluefox) intial commit

## License

The MIT License (MIT)

Copyright (c) 2016, bluefox<dogafox@gmail.com>

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
