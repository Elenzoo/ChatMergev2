const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { startYouTubeChat } = require("./ytChatReader");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ ChatMerge Puppeteer działa – nasłuch czatu YouTube i przesyłanie do frontendu działa.");
});

io.on("connection", (socket) => {
  console.log("🔌 Nowe połączenie Socket.IO z frontendem.");

  // (Opcjonalnie, jeśli kiedyś frontend wysyła też wiadomości)
  socket.on("chatMessage", (msg) => {
    console.log("📩 Odebrano wiadomość od klienta:", msg);
  });
});

server.listen(PORT, async () => {
  console.log(`🚀 Serwer nasłuchuje na http://localhost:${PORT}`);

  try {
    await startYouTubeChat(io);
  } catch (err) {
    console.error("❌ Błąd podczas uruchamiania scraper'a:", err);
  }
});
