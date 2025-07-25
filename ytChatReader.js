const fs = require("fs");
const axios = require("axios");
const puppeteer = require("puppeteer-core");

const CHANNEL_ID = "UC6QZtlRJvCyZkJX7WBs5QIQ"; // Twój testowy canal
const EMBED_URL = `https://www.youtube.com/embed/live_stream?channel=${CHANNEL_ID}`;

function findExecutablePath() {
  const paths = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/crhomium-browser"
  ];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      console.log("✅ Wykryto przeglądarkę:", path);
      return path;
    }
  }
  console.error("❌ Nie znaleziono przeglądarki");
  return null;
}

async function getLiveVideoId() {
  console.log("📡 [SCRAPER] Rozpoczynam scrapowanie EMBED URL:", EMBED_URL);
  try {
    const res = await axios.get(EMBED_URL);
    const html = res.data;
    console.log("📦 [SCRAPER] Pobrany HTML (pierwsze 2000 znaków):", html.slice(0,2000));
    const match = html.match(/'VIDEO_ID'\s*:\s*"(.*?)"/);
    if (match) {
      console.log("✅ [SCRAPER] Znalazłem videoId:", match[1]);
      return match[1];
    } else {
      console.warn("⚠️ [SCRAPER] Brak dopasowania regexu 'VIDEO_ID'");
    }
  } catch (err) {
    console.error("❌ [SCRAPER] Błąd pobierania EMBED_URL:", err.message);
  }
  return null;
}

async function startYouTubeChat(videoId) {
  const exePath = findExecutablePath();
  if (!exePath) return;
  console.log("🌐 [BOT] Łączę do czatu z videoId:", videoId);

  const browser = await puppeteer.launch({
    executablePath: exePath,
    headless: "new",
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}&is_popout=1`;
  console.log("🌐 [BOT] Otwieram bezpośredni chat-url:", chatUrl);
  await page.goto(chatUrl, { waitUntil: "domcontentloaded" });

  try {
    await page.waitForSelector("yt-live-chat-renderer", { timeout: 15000 });
    console.log("✅ [BOT] Znalazłem yt-live-chat-renderer");
  } catch (err) {
    console.error("❌ [BOT] Brak renderer czatu:", err.message);
  }

  await page.exposeFunction("emitChat", (txt) => console.log("▶️", txt));

  await page.evaluate(() => {
    const container = document.querySelector("yt-live-chat-renderer #item-offset");
    if (!container) {
      console.error("❌ Nie znaleziono container #item-offset w rendererze");
      return;
    }
    console.log("✅ Start nasłuchu wiadomości live");

    const obs = new MutationObserver(() => {
      document.querySelectorAll("yt-live-chat-text-message-renderer").forEach(msg => {
        const name = msg.querySelector("#author-name")?.innerText;
        const content = msg.querySelector("#message")?.innerText;
        if (name && content) window.emitChat(`${name}: ${content}`);
      });
    });
    obs.observe(container, { childList: true, subtree: true });
  });
}

module.exports = { getLiveVideoId, startYouTubeChat };
