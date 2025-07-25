const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { getLiveVideoId, startYouTubeChat } = require("./ytChatReader");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public")); // frontend np. index.html w folderze public

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, async () => {
  console.log(`🚀 Serwer nasłuchuje na http://localhost:${PORT}`);

  const videoId = await getLiveVideoId();
  if (videoId) {
    await startYouTubeChat(videoId, io); // teraz przekazujemy io
  } else {
    console.log("📭 Nie znaleziono aktywnego streama.");
  }
});
