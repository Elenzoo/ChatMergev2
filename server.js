//const express = require("express");
const http = require("http");
//const { Server } = require("socket.io");
//const { startYouTubeChat } = require("./ytChatReader");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ YouTube Chat API działa.");
});

server.listen(PORT, () => {
  console.log(`🚀 Serwer działa na http://localhost:${PORT}`);
  startYouTubeChat(io);
});
