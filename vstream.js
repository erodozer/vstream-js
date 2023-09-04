/* eslint-disable no-bitwise */
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

const ANONYMOUS = {
  id: null,
  displayName: 'Anonymous',
  avatar: {},
};

/**
 * Adapt Vstream messages into more friendly, generic types
 * already suited for HTML rendering
 */
const handlers = {
  ChatCreatedEvent(message) {
    return [
      {
        type: 'user-added',
        event: {
          update: false,
          profile: {
            id: message.chat.chatter.userID,
            channelId: message.chat.chatter.channelID,
            displayName: message.chat.chatter.username,
            avatar: {
              src: message.chat.chatter.pfp.url,
            },
            badges: message.chat.chatterBadges,
            color: message.chat.chatterColor,
          }
        }
      },
      {
        type: 'chat-message',
        event: {
          id: message.chat.id,
          profile: message.chat.chatter.userID,
          text: message.chat.nodes.reduce(buildHtmlMessage, ''),
        },
      }
    ];
  },
  UpliftingChatCreatedEvent(message) {
    const resp = [
      {
        type: 'chat-message',
        event: {
          id: message.id,
          profile: message.isAnonymous ? null : message.chat.chatter.userID,
          tip: {
            amount: message.tip.amount,
            currency: message.tip.currency,
            level: message.tip.level
          },
          text: message.chat.nodes.reduce(buildHtmlMessage, ''),
        }
      }
    ];

    if (!message.isAnonymous) {
      resp.push({
        type: 'user-added',
        event: {
          update: false,
          profile: {
            id: message.chat.chatter.userID,
            channelId: message.chat.chatter.channelID,
            displayName: message.chat.chatter.username,
            avatar: {
              src: message.viewer.pfp.src,
            },
            badges: message.chat.chatterBadges
          }
        }
      });
    }

    return resp;
  },
  ChatDeletedEvent(message) {
    return {
      type: 'chat-deleted',
      event: {
        id: message.chat.id,
      },
    };
  },
  UserChatsDeletedEvent(message) {
    return {
      type: 'chat-deleted',
      event: {
        userId: message.userID,
      },
    };
  },
  UserBannedEvent(message) {
    return [
      {
        type: 'user-removed',
        event: {
          userId: message.userID,
        },
      },
      {
        type: 'chat-deleted',
        event: {
          userId: message.userID,
        },
      }];
  },
  UserTimedOutEvent(message) {
    return [
      {
        type: 'user-removed',
        event: {
          userId: message.userID,
        },
      },
      {
        type: 'chat-deleted',
        event: {
          userId: message.userID,
        },
      }];
  },
  ViewerJoinedEvent(message) {
    const badges = [];
    if (message.viewer.isVTuber) {
      badges.push('streamer');
    }
    if (message.viewer.isModerator) {
      badges.push('moderator');
    }
    return {
      type: 'user-added',
      event: {
        update: true,
        profile: {
          id: message.viewer.userID,
          channelId: message.viewer.channelID,
          displayName: message.viewer.displayName,
          username: message.viewer.username,
          avatar: {
            src: message.viewer.pfp.src,
            srcset: message.viewer.pfp.srcset,
          },
          badges,
        }
      },
    };
  },
  MeteorShowerReceivedEvent(message) {
    return {
      type: 'raid',
      event: {
        id: message.meteorShowerID,
        toUser: {
          videoId: message.receiverVideoID,
        },
        fromUser: {
          channelId: message.senderChannelId,
          displayName: message.senderDisplayName,
          username: message.senderUsername,
        },
        viewerCount: message.audienceSize,
      }
    };
  }
};

/**
 * Creates a new connection to VStream's WS API ("Suika")
 *
 * @param {string} channelId
 * @param {string} videoId
 * @returns
 */
async function connect(roomId, videoId) {
  const store = {
    profiles: new Map(),
    chatHistory: {
      sizeLimit: 10,
      messages: [],
    }
  };
  const publisher = mitt();

  publisher.on('raw-message', (e) => console.log(JSON.stringify(e)));

  // populate the chat history
  publisher.on('chat-message', (msg) => {
    const chat = {
      ...msg,
      profile: msg.profile ? store.profiles[msg.profile] : ANONYMOUS
    };

    store.chatHistory.messages.unshift(chat);
    if (store.chatHistory.messages.length > store.chatHistory.sizeLimit) {
      store.chatHistory.messages.pop();
    }
  });

  publisher.on('chat-deleted', (msg) => {
    store.chatHistory.messages = store.chatHistory.messages.filter(
      (chat) => {
        const {
          id,
          profile: {
            id: userId,
          },
        } = chat;

        if ('id' in msg) {
          return id !== msg.id;
        }

        if ('userId' in msg) {
          return userId !== msg.id;
        }

        return true;
      },
    );
  });

  publisher.on('user-added', (msg) => {
    if (store.profiles.has(msg.profile.id) && (!msg.update)) {
      return;
    }

    store.profiles.set(msg.profile.id, msg.profile);
  });

  publisher.on('user-removed', ({ userId }) => {
    store.profiles.delete(userId);
  });

  let url = `wss://vstream.com/suika/api/room/${roomId}/${videoId}/websocket`;

  // utility API for fetching the WSS endpoint until the vstream API supports CORS
  if (roomId && !videoId) {
    url = (await fetch(`https://vstream.erodozer.moe/channel/${roomId}/websocket`).then((r) => r.text()));
  }

  const connection = await new Promise((resolve, reject) => {
    const vstreamListener = new WebSocket(url);

    vstreamListener.addEventListener('message', async (event) => {
      // errors from the API are not always Cbor
      //   ie. Zod errors come back as JSON
      // we only care about properly encoded messages
      if (!(event.data instanceof Blob)) {
        return;
      }

      const buffer = new Uint8Array(await event.data.arrayBuffer());
      const obj = decoder.decode(buffer);

      // emit the message regardless in case the client
      // doesn't want to use our simplified types
      publisher.emit('raw-message', obj);

      // if (validate(obj)) {
      if (obj.__typename in handlers) {
        let ev = handlers[obj.__typename](obj);
        if (!Array.isArray(ev)) {
          ev = [ev];
        }
        ev.forEach((msg) => {
          publisher.emit(msg.type, msg.event);
        });
      }
    });

    // resolve the Promise once the socket is connected
    vstreamListener.addEventListener('open', () => resolve({
      connection: vstreamListener,
      addEventListener(type, cb) { publisher.on(type, cb); },
      removeEventListener(type, cb) { publisher.off(type, cb); },
      store,
    }));

    vstreamListener.addEventListener('close', reject);
  });

  return connection;
}

export default connect;
