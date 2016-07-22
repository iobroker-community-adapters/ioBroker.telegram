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

To add nice avatar picture enter ```/setuserpic``` and upload him desired picture (512x512 pixels), like this one [logo](img/logo.png).

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

To send photo, just send a path to file instead of text: ```sendTo('telegram', 'absolute/path/file.png')```.

Example how to send screenshot from webcam to telegram:

```
var request = require('request');
var fs      = require('fs');

function sendImage() {
    request.get({url: 'http://login:pass@ipaddress/web/tmpfs/snap.jpg', encoding: 'binary'}, function (err, response, body) {
        fs.writeFile("/tmp/snap.jpg", body, 'binary', function(err) {
        
        if (err) {
            console.error(err);
        } else {
            console.log('Snapshot sent');
            sendTo('telegram.0', '/tmp/snap.jpg');
            //sendTo('telegram.0', {text: '/tmp/snap.jpg', caption: 'Snapshot'});
        }
      }); 
    });
}
on("someState", function (obj) {
    if (obj.state.val) {
        // send 4 images: immediately, in 5, 15 and 30 seconds
        sendImage();
        setTimeout(sendImage, 5000);
        setTimeout(sendImage, 15000);
        setTimeout(sendImage, 30000);
    }
});

```

Following messages are reserved for actions:

- *typing* - for text messages,
- *upload_photo* - for photos,
- *upload_video* - for videos,
- *record_video* - for videos,
- *record_audio* - for audio,
- *upload_audio* - for audio,
- *upload_document* - for documents,
- *find_location* - for location data

In this case the action command will be sent.

The description for telegram API can be found [here](https://core.telegram.org/bots/api) and you can use all options defined in this api, just by including that into send object. E.g.:

```
sendTo('telegram.0', {
    text:                   '/tmp/snap.jpg',
    caption:                'Snapshot',
    disable_notification:   true
});
```

**Possible options**:
- *disable_notification*: Sends the message silently. iOS users will not receive a notification, Android users will receive a notification with no sound. (all types)
- *parse_mode*: Send Markdown or HTML, if you want Telegram apps to show bold, italic, fixed-width text or inline URLs in your bot's message. (message)
- *disable_web_page_preview*: Disables link previews for links in this message (message)
- *caption*: Caption for the document, photo or video, 0-200 characters (video, audio, photo, document)
- *duration*: Duration of sent video or audio in seconds (audio, video)
- *performer*: Performer of the audio file (audio)
- *title*: Track name of the audio file (audio)
- *width*: Video width (video)
- *height*: Video height (video)

Adapter tries to detect the type of message (photo, video, audio, document, sticker, action, location) depends on text in the message if the text is path to existing file, it will be sent as according type.

Location will be detected on attribute latitude:
```
sendTo('telegram.0', {
    latitude:               52.522430,
    longitude:              13.372234,
    disable_notification:   true
});
```

## Chat ID
From version 0.4.0 you can use chat ID to send messages to chat.

```sendTo('telegram.0', {text: 'Message to chat', chatId: 'SOME-CHAT-ID-123');```

TODO:
- web hook support
- venue
- dialogs

## Changelog
### 0.4.0 (2016-07-21)
* (bluefox) allow send messages to chats via chat-ID
* (bluefox) support of video(mp4), audio, document, location, sticker, action

### 0.3.0 (2016-05-31)
* (bluefox) restart connection every hour

### 0.2.4 (2016-05-08)
* (bluefox) replace "_" with " " when sending to text2command

### 0.2.3 (2016-05-04)
* (bluefox) replace "/" with "#" when sending to text2command

### 0.2.2 (2016-04-14)
* (Jonas) fix unload

### 0.2.1 (2016-04-13)
* (Jonas) fix configuration and send to more than one user

### 0.2.0 (2016-04-12)
* (bluefox) add send photo possibility

### 0.1.0 (2016-02-20)
* (bluefox) fix double responses.
* (bluefox) inform about new start

### 0.0.2 (2016-02-15)
* (bluefox) fix error with sendTo

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
