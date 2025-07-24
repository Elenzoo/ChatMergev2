const express = require("express");
const fs = require("fs");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];
const TOKEN_PATH = "token.json";

// === AUTH FLOW ===
app.get("/auth", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent"
  });
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    res.send("✅ Token zapisany! Możesz zamknąć to okno.");
    startYouTubeChat(); // uruchom czat
  } catch (err) {
    console.error("❌ Błąd logowania:", err.message);
    res.send("❌ Błąd logowania.");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serwer działa na http://localhost:${PORT}`);
});

// === YOUTUBE CHAT ===
async function startYouTubeChat() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.log("⚠️ Token nie znaleziony — zaloguj się na /auth");
    return;
  }

  oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  const channelId = "UC3RKN-2QrfK4YsP5bCTtutA"; // ← KAJMA

  try {
    const search = await youtube.search.list({
      part: "snippet",
      channelId,
      eventType: "live",
      type: "video"
    });

    const videoId = search.data.items?.[0]?.id?.videoId;
    if (!videoId) return console.log("📭 Brak aktywnego streama");

    console.log("🔴 Wykryto Live ID:", videoId);

    const details = await youtube.videos.list({
      part: "liveStreamingDetails",
      id: videoId
    });

    const liveChatId = details.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
    if (!liveChatId) throw new Error("❌ Brak liveChatId");

    console.log("💬 liveChatId:", liveChatId);

    let nextPageToken = "";
    let pollingInterval = 5000;

    const poll = async () => {
      try {
        const res = await youtube.liveChatMessages.list({
          liveChatId,
          part: "snippet,authorDetails",
          pageToken: nextPageToken
        });

        const messages = res.data.items || [];
        nextPageToken = res.data.nextPageToken;
        pollingInterval = res.data.pollingIntervalMillis || 5000;

        messages.forEach(msg => {
          const text = `${msg.authorDetails.displayName}: ${msg.snippet.displayMessage}`;
          console.log("▶️", new Date(msg.snippet.publishedAt).toLocaleTimeString(), text);
        });
      } catch (err) {
        console.warn("❌ Błąd pobierania wiadomości:", err.message);
      }

      setTimeout(poll, pollingInterval);
    };

    poll();

  } catch (err) {
    console.error("❌ Błąd czatu:", err.message);
  }
}
