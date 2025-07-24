const fs = require("fs");
const axios = require("axios");
const puppeteer = require("puppeteer-core");
const glob = require("glob");

const CHANNEL_URL = "https://www.youtube.com/@izaklive/live";

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
  } catch (err) {
    console.error("❌ Błąd scrapera:", err.message);
  }

  return null;
}

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
  await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
    waitUntil: "domcontentloaded"
  });

  await page.exposeFunction("emitChat", (text) => {
    console.log("▶️", text);
  });

  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const messages = document.querySelectorAll("#item-offset > yt-live-chat-text-message-renderer");
      messages.forEach(msg => {
        const name = msg.querySelector("#author-name")?.innerText;
        const content = msg.querySelector("#message")?.innerText;
        if (name && content) {
          window.emitChat(`${name}: ${content}`);
        }
      });
    });

    const container = document.querySelector("#item-offset");
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }
  });
}

module.exports = {
  getLiveVideoId,
  startYouTubeChat
};
