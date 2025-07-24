const express = require("express");
const { getLiveVideoId, startYouTubeChat } = require("./ytChatReader");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("✅ ChatMerge Puppeteer działa!"));

app.listen(PORT, async () => {
  console.log(`🚀 Serwer nasłuchuje na http://localhost:${PORT}`);

  const videoId = await getLiveVideoId();
  if (videoId) {
    await startYouTubeChat(videoId);
  } else {
    console.log("📭 Nie znaleziono aktywnego streama.");
  }
});
