# vstream-js

This is just supposed to be a simple client-side consumer library for [VStream](https://vstream.com/)'s Websocket API.
Ideally will hold anyone over until an official client exists for JS that can be used for overlays.

*NOTE* Not all possible API events are planned to be modeled or supported when developing this library.  Since the primary intention is to be used for overlays, the focus is solely on supporting Chat and User/Viewer events. Events relating to stream start/stop and user state (moderator Add/Remove), will not be included.

## Current Known Details

What's in here is what has been discovered by sifting through the Vstream website's frontend bundled code to understand the kinds of messages are received.

Some general findings

- Messages are encoded using CBOR with Key-Mapped fields.  This library is relying on [cbor-x](https://github.com/kriszyp/cbor-x) to efficiently parse those messages back into JS objects
- VStream uses [Zod](https://zod.dev/) for validation.  I've done what I can to adapt it to JSON schema to help with porting bindings to other languages

## Consuming Messages

Messages from the Websocket are exposed by this library after parsing and validation as simple JSON records.

The library uses [Mitt](https://github.com/developit/mitt) as a simple Event Publisher, but has been abstracted to the standard `add/removeEventListener` style interface.

### Emitted Messages

#### chat-message

Simplified chat message with text preformatted for HTML rendering.  Elements within the text include custom classes, which can be styled easily in your overlays.  Easiest way to use the generated text is to assign it to the innerHTML of a DOMElement.

#### raw-message

This is the raw, JSON representation of the message received from the websocket.
It's not guaranteed to have been validated as supported by the library.
Use this if you want to have absolute control over what's being handled.

### Helper Functions

As this library is mainly for overlay or simple JS bot development, there are some abstractions provided on top of simply parsing

### Profile Cache

TODO easily keep track of who's chatting.  Profile information usually comes down with a chat message or viewer joined event.  This helps you access that information in case you need it outside of the context of event handling.

### Chat History

Helper that collects chat messages, handling user bans and delete events for you so you don't have to worry about building it yourself.  Chatbox overlays implemented using reactive frameworks like Vue and React should be able to simply reference this.
