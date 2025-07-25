const fs = require("fs");
const axios = require("axios");
const puppeteer = require("puppeteer-core");

const CHANNEL_URL = "https://www.youtube.com/@zeprezz/live";

// 🔍 Szuka ścieżki do przeglądarki Chromium/Chrome
function findExecutablePath() {
  const paths = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];
  for (const path of paths) {
    if (fs.existsSync(path)) {
      console.log("✅ Wykryto przeglądarkę:", path);
      return path;
    }
  }
  console.error("❌ Nie znaleziono przeglądarki w systemie.");
  return null;
}

// 📥 Pobiera aktywne ID transmisji na podstawie strony /live
async function getLiveVideoId() {
  console.log("📡 [SCRAPER] Rozpoczynam pobieranie HTML z kanału:", CHANNEL_URL);

  try {
    const html = await axios.get(CHANNEL_URL).then(res => res.data);
    const allMatches = [...html.matchAll(/"videoId":"(.*?)"/g)].map(m => m[1]);

    console.log("🧩 [SCRAPER] Wszystkie znalezione ID:", allMatches);

    const unique = [...new Set(allMatches)];
    if (unique.length === 0) {
      console.warn("⚠️ [SCRAPER] Nie znaleziono żadnych videoId");
      return null;
    }

    const selected = unique[0];
    console.log("🎯 [SCRAPER] Używam videoId:", selected);
    return selected;

  } catch (err) {
    console.error("❌ [SCRAPER] Błąd scrapera:", err.message);
    return null;
  }
}

// 🧠 Uruchamia Puppeteera i odpala nasłuch czatu w iframe
async function startYouTubeChat(videoId) {
  const exePath = findExecutablePath();
  if (!exePath) return;

  const browser = await puppeteer.launch({
    executablePath: exePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
      '--disable-extensions'
    ],
    headless: "new"
  });

  const page = await browser.newPage();
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log("🌐 [BOT] Otwieram stronę streama:", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  try {
    console.log("⌛ [BOT] Czekam na załadowanie iframe z czatem...");
    await page.waitForSelector("iframe#chatframe", { timeout: 15000 });

    const frame = await page
      .frames()
      .find(f => f.url().includes("live_chat"));

    if (!frame) {
      console.error("❌ [BOT] Nie znaleziono iframe z czatem.");
      await browser.close();
      return;
    }

    // Emit do konsoli (lub io.emit jak będzie socket)
    await frame.exposeFunction("emitChat", (text) => {
      console.log("💬 [YT]", text);
    });

    await frame.evaluate(() => {
      const chatContainer = document.querySelector("#item-offset");
      if (!chatContainer) {
        console.log("❌ [CHAT] Nie znaleziono kontenera #item-offset");
        return;
      }

      console.log("✅ [CHAT] Rozpoczęto nasłuch wiadomości czatu YouTube");

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
