const fs = require("fs");
const axios = require("axios");
const puppeteer = require("puppeteer-core");

const CHANNEL_ID = "UC6QZt1RiJvCyZkJX7wB5uTQ"; // @zeprezz
const CHANNEL_EMBED_URL = `https://www.youtube.com/embed/live_stream?channel=${CHANNEL_ID}`;

function findExecutablePath() {
  const paths = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      console.log("✅ [BROWSER] Wykryto przeglądarkę:", path);
      return path;
    }
  }
  console.error("❌ [BROWSER] Nie znaleziono przeglądarki w systemie.");
  return null;
}

async function getLiveVideoId() {
  console.log("📡 [SCRAPER] Rozpoczynam scrapowanie EMBED URL:", CHANNEL_EMBED_URL);

  try {
    const html = await axios.get(CHANNEL_EMBED_URL).then(res => res.data);
    console.log("📜 [SCRAPER] Pobrany HTML (pierwsze 2000 znaków):", html.slice(0, 2000));

    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match) {
      const videoId = match[1];
      console.log("🎯 [SCRAPER] Znalazłem videoId:", videoId);
      return videoId;
    } else {
      console.warn("⚠️ [SCRAPER] Brak dopasowania regexu do videoId");
    }
  } catch (err) {
    console.error("❌ [SCRAPER] Błąd pobierania strony:", err.message);
  }

  return null;
}

async function startYouTubeChat(videoId, io) {
  const exePath = findExecutablePath();
  if (!exePath) return;

  const browser = await puppeteer.launch({
    executablePath: exePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
      "--disable-extensions"
    ],
    headless: "new"
  });

  const page = await browser.newPage();
  const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log("🌐 [BOT] Otwieram stronę streama:", streamUrl);

  await page.goto(streamUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  try {
    console.log("⌛ [BOT] Czekam na załadowanie iframe z czatem...");
    await page.waitForSelector("iframe#chatframe", { timeout: 15000 });
  } catch (e) {
    console.error("❌ [BOT] Błąd ładowania czatu: ", e.message);
    await browser.close();
    return;
  }

  const frame = page.frames().find(f => f.url().includes("live_chat"));
  if (!frame) {
    console.warn("⚠️ [BOT] Nie znaleziono ramki z czatem.");
    await browser.close();
    return;
  }

  await frame.exposeFunction("emitChat", (text) => {
    console.log("▶️ [YT]", text);
    if (io) {
      io.emit("chatMessage", {
        source: "YouTube",
        text,
        timestamp: Date.now()
      });
    }
  });

  await frame.evaluate(() => {
    const chatContainer = document.querySelector("#item-offset");
    if (!chatContainer) {
      console.log("❌ [YT] Nie znaleziono kontenera #item-offset");
      return;
    }

    console.log("✅ [YT] Rozpoczynam nasłuch czatu (live)...");

    const observer = new MutationObserver(() => {
      const messages = document.querySelectorAll("yt-live-chat-text-message-renderer");
      messages.forEach(msg => {
        const name = msg.querySelector("#author-name")?.innerText;
        const content = msg.querySelector("#message")?.innerText;
        if (name && content) {
          window.emitChat(`${name}: ${content}`);
        }
      });
    });

    observer.observe(chatContainer, { childList: true, subtree: true });
  });
}

module.exports = {
  getLiveVideoId,
  startYouTubeChat
};
