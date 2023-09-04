import fetch from 'node-fetch';

export async function exchangeChannelId(channelId) {
    try {
      console.log(`fetching ongoing livestream for ${channelId}`);
      const {
        channelProfile: {
          liveStreaming: {
            ongoingLiveStream: {
              id: streamId,
            } = {},
          } = {}
        } = {}
      } = await fetch(`https://vstream.com/c/@${channelId}?_data=`).then((r) => r.json());
      
      if (!streamId) {
        console.log(`no ongoing livestream for ${channelId} found`);
        return false;
      }
  
      const {
        liveStream: {
            chatRoomWSURL,
        }
      } = await fetch(`https://vstream.com/v/${streamId}/chat-popout?_data=routes/v_.$liveStreamID.chat-popout`).then((r) => r.json());
      
      if (!chatRoomWSURL) {
        return false;
      }
      console.log(chatRoomWSURL);
      return chatRoomWSURL;
    } catch (err) {
      console.log(`no ongoing livestream for ${channelId} found: ${err.message}`);
      return false;
    }
  }