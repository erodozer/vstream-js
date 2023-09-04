import { Decoder } from 'cbor-x';
import WebSocket from 'ws';
import rxjs from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { exchangeChannelId } from './utils.js'

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

async function getSocketForChannel(channelId) {
  
    const wssUrl = await exchangeChannelId(channelId);
  
    if (!wssUrl) {
      return null;
    }
  
    console.log(`opening ws on channel: ${channelId}`);
    const subject = webSocket({
      url: wssUrl,
      deserializer: msg => decoder.decode(msg.data),
      WebSocketCtor: WebSocket,
    }).pipe(
      rxjs.tap(console.log),
      rxjs.map(JSON.stringify),
    );
    
    return subject;
}

/**
 * This provides a simple JSON readable version of the vstream event API
 *
 * Many languages and tooling support JSON out of the box unlike cbor,
 * allow for efficient and accessible handling of the data.
 *
 * It's recommended to consume from vstream's API directly using the
 * library if you are using JS, as the cbor decoding is included.  However,
 * for other tooling where it's more difficult to get cbor working, such
 * as in custom domain languages such as Godot's GDScript, JSON is a
 * the better option.
 */
export default async (ws, req) => {
    const {
      params: {
        channelId,
      },
    } = req;
  
    const subject = await getSocketForChannel(channelId);

    if (!subject) {
        console.log(`connection closed on channel: ${channelId}`);
        ws.send(`no channel found for ${channelId}`);
        ws.close();
        return;
    }

    console.log(`opening ws on channel: ${channelId}`);
    const subscription = subject.subscribe({
        next: (msg) => ws.send(msg),
        complete: () => ws.close(),
    })
  
    ws.on('close', () => {
      console.log(`closing listener on ${channelId}`);
      subscription.unsubscribe();
    });
}
