const fs = require("fs");
const axios = require("axios");
const puppeteer = require("puppeteer-core");

const CHANNEL_URL = "https://www.youtube.com/@zeprezz/live";

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
  console.log("🔍 [SCRAPER] Rozpoczynam pobieranie HTML z kanału:", CHANNEL_URL);
  try {
    const html = await axios.get(CHANNEL_URL).then(res => res.data);

    // Szukamy unikalnego videoId
    const matches = [...html.matchAll(/"videoId":"(.*?)"/g)];
    const allIds = matches.map(m => m[1]);
    const unique = [...new Set(allIds)];

    console.log("🧾 [SCRAPER] Wszystkie znalezione ID:", unique);

    if (unique.length === 0) {
      console.warn("📭 [SCRAPER] Nie znaleziono żadnych videoId.");
      return null;
    }

    // Zakładamy, że pierwsze wystąpienie to stream live
    const videoId = unique[0];
    console.log("🎯 [SCRAPER] Używam videoId:", videoId);
    return videoId;

  } catch (err) {
    console.error("❌ [SCRAPER] Błąd pobierania strony kanału:", err.message);
    return null;
  }
}

async function startYouTubeChat(videoId) {
  const exePath = findExecutablePath();
  if (!exePath) return;

  const browser = await puppeteer.launch({
    executablePath: exePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process"
    ],
    headless: "new"
  });

  const page = await browser.newPage();
  const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;

  console.log("🌐 [BOT] Otwieram stronę streama:", streamUrl);
  await page.goto(streamUrl, { waitUntil: "domcontentloaded" });

  try {
    console.log("🕒 [BOT] Czekam na załadowanie iframe z czatem...");
    await page.waitForSelector("iframe#chatframe", { timeout: 15000 });

    const chatFrame = await page
      .frames()
      .find(f => f.url().includes("live_chat"));

    if (!chatFrame) {
      console.warn("❌ [BOT] Nie znaleziono iframe z czatem.");
      return;
    }

    console.log("✅ [BOT] Zlokalizowano chatframe, rozpoczynam nasłuch wiadomości.");

    await chatFrame.exposeFunction("emitChat", (text) => {
      console.log("▶️ [YT]", text);
    });

    await chatFrame.evaluate(() => {
      const log = console.log;
      const chatContainer = document.querySelector("#item-offset");

      if (!chatContainer) {
        log("❌ [CHAT] Nie znaleziono kontenera #item-offset.");
        return;
      }

      log("📡 [CHAT] Rozpoczynam nasłuch nowych wiadomości...");

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

  } catch (e) {
    console.error("❌ [BOT] Błąd ładowania czatu:", e.message);
  }
}

module.exports = {
  getLiveVideoId,
  startYouTubeChat
};
