const axios = require("axios");

const API_KEY = "AIzaSyCOR5QRFiHR-hZln9Zb2pHfOnyCANK0Yaw"; // Twój klucz API
const CHANNEL_USERNAME = "noobsapiens";
let nextPageToken = null;

async function getLiveVideoId() {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCg_3jZh2zMIcBzU0oN83V0w&type=video&eventType=live&key=${API_KEY}`;
    const res = await axios.get(url);
    const video = res.data.items[0];
    return video ? video.id.videoId : null;
  } catch (err) {
    console.error("❌ [API] Błąd pobierania videoId:", err.message);
    return null;
  }
}

async function getLiveChatId(videoId) {
  try {
    const res = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${API_KEY}`);
    return res.data.items[0]?.liveStreamingDetails?.activeLiveChatId || null;
  } catch (err) {
    console.error("❌ [API] Błąd pobierania liveChatId:", err.message);
    return null;
  }
}

async function pollChat(chatId, io) {
  try {
    const res = await axios.get("https://www.googleapis.com/youtube/v3/liveChat/messages", {
      params: {
        liveChatId: chatId,
        part: "snippet,authorDetails",
        key: API_KEY,
        pageToken: nextPageToken
      }
    });

    nextPageToken = res.data.nextPageToken;

    res.data.items.forEach(msg => {
      const author = msg.authorDetails.displayName;
      const text = msg.snippet.displayMessage;
      const formatted = `${author}: ${text}`;
      console.log("💬 [YT Chat]", formatted);
      io.emit("chatMessage", {
        source: "YouTube",
        text: formatted,
        timestamp: Date.now()
      });
    });

    const delay = res.data.pollingIntervalMillis || 5000;
    setTimeout(() => pollChat(chatId, io), delay);

  } catch (err) {
    console.error("❌ [API] Błąd odczytu wiadomości:", err.message);
    setTimeout(() => pollChat(chatId, io), 10000);
  }
}

async function startYouTubeChat(io) {
  const videoId = await getLiveVideoId();
  if (!videoId) return console.error("❌ Brak aktywnego streama.");

  const chatId = await getLiveChatId(videoId);
  if (!chatId) return console.error("❌ Brak aktywnego liveChatId.");

  console.log("✅ [BOT] Rozpoczynam nasłuch czatu...");
  pollChat(chatId, io);
}

module.exports = { startYouTubeChat };
