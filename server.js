const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { getLiveVideoId, startYouTubeChat } = require("./ytChatReader");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log(`🚀 Serwer nasłuchuje na http://localhost:${PORT}`);

  const videoId = await getLiveVideoId();
  if (videoId) {
    console.log("▶️ [SERVER] Uruchamiam pobieranie czatu z videoId:", videoId);
    await startYouTubeChat(videoId, io);
  } else {
    console.log("📭 [SERVER] Nie znaleziono aktywnego streama.");
  }
});
