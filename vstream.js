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

function buildHtmlMessage(str, node) {
  switch (node.__typename) {
    case 'TextChatNode':
      return `${str}<span>${node.text}<span>`;
    case 'LinkChatNode':
      return `${str}<a class="vstream-link" href="${node.href}">${node.href}</a>${node.nodes.reduce(buildHtmlMessage, '')}`;
    case 'MentionChatNode':
      return `${str}<a class="vstream-mention">@${node.username}</a>`;
    case 'EmojiChatNode':
      return `${str}${
        node.emoji.size28Src
          ? `<img src="${node.emoji.size28Src}" class="vstream-emoji" />`
          : `<span>${node.emoji.altText}</span>`
      }`;
    case 'ParagraphChatNode':
      return `${str}<p>${node.nodes.reduce(buildHtmlMessage, '')}</p>`;
    default:
      return str;
  }
}

/**
 * Adapt Vstream messages into more friendly, generic types
 * already suited for HTML rendering
 */
const handlers = {
  ChatCreatedEvent(message) {
    return {
      type: 'chat-message',
      event: {
        profile: {
          id: message.chatter.userID,
          channelId: message.chatter.channelID,
          displayName: message.chatter.username,
          avatar: message.chatter.pfp.url,
          badges: message.chatterBadges,
          color: message.chatterColor,
        },
        text: message.nodes.reduce(buildHtmlMessage, ''),
      },
    };
  },
};

/**
 * Creates a new connection to VStream's WS API ("Suika")
 *
 * @param {string} channelId
 * @param {string} videoId
 * @returns
 */
function connect(channelId, videoId) {
  const publisher = mitt();
  const profiles = {};
  const chatHistory = {
    sizeLimit: 10,
    messages: [],
  };

  return new Promise((resolve, reject) => {
    const vstreamListener = new WebSocket(
      `wss://vstream.com/suika/api/room/${channelId}/${videoId}/websocket`,
    );

    vstreamListener.addEventListener('message', async (event) => {
      // errors from the API are not always Cbor
      //   ie. Zod errors come back as JSON
      // we only care about properly encoded messages
      if (!(event.data instanceof Blob)) {
        return;
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

    // populate the chat history
    mitt.on('chat-message', (msg) => {
      chatHistory.messages.unshift(msg);
      if (chatHistory.messages.length > chatHistory.sizeLimit) {
        chatHistory.messages.pop();
      }
    });

    // resolve the Promise once the socket is connected
    vstreamListener.addEventListener('open', () => resolve({
      connection: vstreamListener,
      channel: {
        channelId,
        videoId,
      },
      addEventListener(type, cb) { publisher.on(type, cb); },
      removeEventListener(type, cb) { publisher.off(type, cb); },
      chatHistory,
      profiles,
    }));

    vstreamListener.addEventListener('close', reject);
  });
}

export default connect;
