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
      console.log("✅ [BOT] Wykryto przeglądarkę:", path);
      return path;
    }
  }
  console.error("❌ [BOT] Nie znaleziono przeglądarki w systemie.");
  return null;
}

async function getLiveVideoId() {
  console.log("🔍 [SCRAPER] Szukam aktywnego streama...");

  try {
    const html = await axios.get(CHANNEL_URL).then(res => res.data);
    const match = html.match(/"videoId":"(.*?)"/);
    if (match) {
      const videoId = match[1];
      console.log("🎯 [SCRAPER] Znalaziono videoId:", videoId);
      return videoId;
    }
    console.warn("⚠️ [SCRAPER] Brak aktywnego ID streama.");
  } catch (err) {
    console.error("❌ [SCRAPER] Błąd scrapera:", err.message);
  }

  return null;
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
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
      "--disable-extensions"
    ],
    headless: "new"
  });

  const page = await browser.newPage();
  const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}&is_popout=1`;

  console.log("🤖 [BOT] Przechodzę do czatu:", chatUrl);
  await page.goto(chatUrl, { waitUntil: "domcontentloaded" });

  await page.screenshot({ path: "chat_screenshot.png" });
  console.log("📷 [BOT] Zrzut ekranu strony czatu zapisany.");

  await page.exposeFunction("emitChat", (text) => {
    console.log("▶️", text);
  });

  await page.evaluate(() => {
    const container = document.querySelector("yt-live-chat-renderer #item-offset");
    if (!container) {
      console.warn("⚠️ Nie znaleziono #item-offset – czat może być wyłączony.");
      return;
    }

    console.log("✅ Rozpoczynam obserwację wiadomości...");

    const observer = new MutationObserver(() => {
      const messages = container.querySelectorAll("yt-live-chat-text-message-renderer");
      messages.forEach(msg => {
        const name = msg.querySelector("#author-name")?.innerText;
        const content = msg.querySelector("#message")?.innerText;
        if (name && content) {
          window.emitChat(`${name}: ${content}`);
        }
      });
    });

    observer.observe(container, { childList: true, subtree: true });
  });
}

module.exports = {
  getLiveVideoId,
  startYouTubeChat
};
