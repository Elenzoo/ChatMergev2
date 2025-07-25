// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { startYouTubeChat } = require("./ytChatReader");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => {
  res.send("✅ ChatMerge Puppeteer działa – nasłuch czatu YouTube w konsoli.");
});

server.listen(PORT, async () => {
  console.log(`🚀 Serwer nasłuchuje na http://localhost:${PORT}`);
  try {
    await startYouTubeChat(io);
  } catch (err) {
    console.error("❌ Błąd podczas uruchamiania scraper'a:", err);
  }
});
