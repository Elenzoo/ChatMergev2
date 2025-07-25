const axios = require("axios");

const API_KEY = "AIzaSyCOR5QRFiHR-hZln9Zb2pHfOnyCANK0Yaw";
const CHANNEL_USERNAME = "noobsapiens";
let nextPageToken = null;

function logError(context, err) {
  console.error(`❌ [${context}]`, err.message);
  if (err.response?.data) {
    console.error("📦 [API RESPONSE]", JSON.stringify(err.response.data, null, 2));
  }
  if (err.stack) {
    console.error("🪵 [STACK]", err.stack);
  }
}

async function getChannelIdByUsername(username) {
  try {
    const res = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
      params: {
        part: "snippet",
        q: `@${username}`,
        type: "channel",
        maxResults: 1,
        key: API_KEY
      }
    });

    const channel = res.data.items[0];
    if (!channel) throw new Error("Nie znaleziono kanału po nazwie użytkownika.");
    return channel.snippet.channelId;

  } catch (err) {
    logError("getChannelIdByUsername", err);
    return null;
  }
}

async function getLiveVideoId(channelId) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${API_KEY}`;
    const res = await axios.get(url);
    const video = res.data.items[0];
    return video ? video.id.videoId : null;
  } catch (err) {
    logError("getLiveVideoId", err);
    return null;
  }
}

async function getLiveChatId(videoId) {
  try {
    const res = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${API_KEY}`);
    return res.data.items[0]?.liveStreamingDetails?.activeLiveChatId || null;
  } catch (err) {
    logError("getLiveChatId", err);
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
      if (io) {
        io.emit("chatMessage", {
          source: "YouTube",
          text: formatted,
          timestamp: Date.now()
        });
      }
    });

    const delay = res.data.pollingIntervalMillis || 5000;
    setTimeout(() => pollChat(chatId, io), delay);

  } catch (err) {
    logError("pollChat", err);
    setTimeout(() => pollChat(chatId, io), 10000);
  }
}

async function startYouTubeChat(io) {
  console.log("🔍 [BOT] Szukam kanału dla użytkownika @" + CHANNEL_USERNAME);
  const channelId = await getChannelIdByUsername(CHANNEL_USERNAME);
  if (!channelId) return console.error("❌ Brak channelId.");

  console.log("🔍 [BOT] Szukam aktywnego streama...");
  const videoId = await getLiveVideoId(channelId);
  if (!videoId) return console.error("❌ Brak aktywnego streama.");

  console.log("🔍 [BOT] Szukam liveChatId...");
  const chatId = await getLiveChatId(videoId);
  if (!chatId) return console.error("❌ Brak aktywnego czatu (liveChatId).");

  console.log("✅ [BOT] Rozpoczynam nasłuch czatu na kanale @" + CHANNEL_USERNAME);
  pollChat(chatId, io);
}

module.exports = { startYouTubeChat };
