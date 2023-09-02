import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/vstream/wss/:channelId', async (req, res) => {
  const {
    params: {
      channelId,
    },
  } = req;

  const {
    channelProfile: {
      liveStreaming: {
        ongoingLiveStream: {
          id: streamId,
        },
      }
    }
  } = await fetch(`https://vstream.com/c/@${channelId}?_data=`).then((r) => r.json());
  console.log(streamId);

  const {
    liveStream: {
        chatRoomWSURL,
    }
  } = await fetch(`https://vstream.com/v/${streamId}/chat-popout?_data=routes/v_.$liveStreamID.chat-popout`).then((r) => r.json());
  console.log(chatRoomWSURL);

  if (!chatRoomWSURL) {
    res.code(404).send();
  } else {
    res.send(chatRoomWSURL);
  }
});

app.listen(8888, () => {
  console.log('server is listening on 8888');
});
