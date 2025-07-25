const fs = require("fs");
const axios = require("axios");
const puppeteer = require("puppeteer-core");

const CHANNEL_URL = "https://www.youtube.com/@zeprezz/live"; // Kanał testowy

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

async function getLiveVideoId() {
  try {
    const html = await axios.get(CHANNEL_URL).then(res => res.data);
    const match = html.match(/"videoId":"(.*?)"/);
    if (match) {
      const videoId = match[1];
      console.log("🎯 ID streama:", videoId);
      return videoId;
    }
    console.warn("⚠️ Nie znaleziono aktywnego ID streama na stronie.");
  } catch (err) {
    console.error("❌ Błąd scrapera:", err.message);
  }
  return null;
}

async function startYouTubeChat(videoId, io = null) {
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
  console.log("🌐 Otwieram stronę streama:", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await page.waitForSelector("iframe#chatframe", { timeout: 10000 });

  const frame = page.frames().find(f => f.url().includes("live_chat"));
  if (!frame) {
    console.warn("❌ Nie znaleziono iframe z czatem.");
    await browser.close();
    return;
  }

  try {
    await frame.click("#menu #button[aria-label*='Live chat']");
    console.log("✅ Przełączono na Live chat");
  } catch (e) {
    console.warn("⚠️ Nie udało się przełączyć na Live chat:", e.message);
  }

  await frame.exposeFunction("emitChat", (text) => {
    console.log("▶️", text);
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
      console.log("❌ Nie znaleziono kontenera #item-offset");
      return;
    }

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
    console.log("✅ Rozpoczęto nasłuch czatu YouTube (live chat)");
  });
}

module.exports = {
  getLiveVideoId,
  startYouTubeChat
};
