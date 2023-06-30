/* eslint-disable no-underscore-dangle */
import { Decoder } from 'https://cdn.jsdelivr.net/npm/cbor-x@1.5.3/+esm';
import mitt from 'https://cdn.jsdelivr.net/npm/mitt@3.0.0/+esm';
// import validate from './validate.mjs';

/**
 * VStream compresses their CBOR further by utilizing key maps
 * This mapping is lifted directly from the site src...
 */
const EnvelopeKeyMap = {
  __typename: -4,
  channelID: -3,
  chatID: -2,
  id: -1,
  isVTuber: 0,
  pfp: 1,
  timestamp: 2,
  url: 3,
  userID: 4,
  username: 5,
};

const decoder = new Decoder({
  keyMap: EnvelopeKeyMap,
  structuredClone: true,
});

/**
 * Adapt Vstream messages into more friendly, generic types
 * already suited for HTML rendering
 */
const handlers = {
  ChatCreatedEvent(message) {
    return {
      type: 'chat-message',
      event: {
        chatter: {

        },
      },
    };
  },
};

function connect(channelId, videoId) {
  const publisher = mitt();

  return new Promise((resolve) => {
    const vstreamListener = new WebSocket(
      `wss://vstream.com/suika/api/room/${channelId}/${videoId}/websocket`,
    );

    vstreamListener.addEventListener('message', async (event) => {
      // errors from the API are not always Cbor
      //   ie. Zod errors come back as JSON
      // we only care about properly encoded messages
      if (!(event.data instanceof Blob)) {
        return
      }
      
      const buffer = await event.data.arrayBuffer();
      const obj = decoder.decode(buffer);

      // if (validate(obj)) {
      if (obj.__typename in obj) {
        const env = handlers[obj.__typename](obj);
        mitt.emit(env.type, env.event);
      }

      // emit the message regardless in case the client
      // doesn't want to use our simplified types
      mitt.emit('raw-message', obj);
    });

    vstreamListener.addEventListener('open', () => resolve({
      connection: vstreamListener,
      addEventListener(type, cb) { publisher.on(type, cb); },
      removeEventListener(type, cb) { publisher.off(type, cb); },
    }));
  });
}

export default connect;
