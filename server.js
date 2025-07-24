const express = require("express");
const { getYouTubeChatMessages } = require("./ytChatReader");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", async (req, res) => {
  try {
    const messages = await getYouTubeChatMessages();
    res.send(`<pre>${messages.join("\n") || "Brak wiadomości."}</pre>`);
  } catch (err) {
    console.error("❌ Błąd:", err.message);
    res.status(500).send("❌ Błąd Puppeteera: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serwer działa na http://localhost:${PORT}`);
});
