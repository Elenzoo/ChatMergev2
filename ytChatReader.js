const axios = require("axios");

const API_KEY = "TWÓJ_KLUCZ_API"; // <-- Zamień na własny klucz API
const CHANNEL_USERNAME = "kajma";

let liveChatId = null;
let nextPageToken = null;

async function getLiveVideoId() {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&eventType=live&channelId=${await getChannelId()}&key=${API_KEY}`;
  const res = await axios.get(url);
  if (res.data.items.length === 0) {
    console.warn("❌ Brak aktywnego streama.");
    return null;
  }
  return res.data.items[0].id.videoId;
}

async function getChannelId() {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${CHANNEL_USERNAME}&key=${API_KEY}`;
  const res = await axios.get(url);
  return res.data.items[0]?.id;
}

async function getLiveChatId(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${API_KEY}`;
  const res = await axios.get(url);
  return res.data.items[0]?.liveStreamingDetails?.activeLiveChatId;
}

async function startYouTubeChat(io) {
  const videoId = await getLiveVideoId();
  if (!videoId) return;

  liveChatId = await getLiveChatId(videoId);
  if (!liveChatId) return console.warn("❌ Brak liveChatId.");

  console.log("🎯 Rozpoczynam nasłuch czatu YouTube (kanał: kajma)");

  setInterval(async () => {
    try {
      const url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${liveChatId}&part=snippet,authorDetails&key=${API_KEY}&${nextPageToken ? `pageToken=${nextPageToken}` : ""}`;
      const res = await axios.get(url);
      nextPageToken = res.data.nextPageToken;

      res.data.items.forEach(msg => {
        const user = msg.authorDetails.displayName;
        const text = msg.snippet.displayMessage;
        const fullMessage = `${user}: ${text}`;
        console.log("💬 [YT Chat]", fullMessage);
        if (io) {
          io.emit("chatMessage", {
            source: "YouTube",
            text: fullMessage,
            timestamp: Date.now()
          });
        }
      });
    } catch (err) {
      console.error("❌ Błąd przy pobieraniu wiadomości:", err.message);
    }
  }, 3000); // Co 3 sekundy
}

module.exports = { startYouTubeChat };
