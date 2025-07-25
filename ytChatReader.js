const fs = require("fs");
const puppeteer = require("puppeteer-core");

const CHANNEL_HANDLE = "zeprezz"; // ← zmień na "kajma", "izaklive" itp. gdy potrzeba

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
  console.error("❌ [BROWSER] Nie znaleziono przeglądarki.");
  return null;
}

async function getLiveVideoId() {
  const exePath = findExecutablePath();
  if (!exePath) return null;

  const browser = await puppeteer.launch({
    executablePath: exePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: "new"
  });

  const page = await browser.newPage();
  const channelLiveUrl = `https://www.youtube.com/@${CHANNEL_HANDLE}/live`;

  console.log("🌐 [SCRAPER] Otwieram URL:", channelLiveUrl);
  await page.goto(channelLiveUrl, { waitUntil: "domcontentloaded" });

  const finalUrl = page.url();
  console.log("🔀 [SCRAPER] Przekierowano na:", finalUrl);

  const match = finalUrl.match(/v=([a-zA-Z0-9_-]{11})/);
  await browser.close();

  if (match) {
    const videoId = match[1];
    console.log("🎯 [SCRAPER] Wykryto VIDEO_ID:", videoId);
    return videoId;
  } else {
    console.warn("⚠️ [SCRAPER] Nie znaleziono videoId w przekierowanym URL.");
    return null;
  }
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
      '--disable-gpu'
    ],
    headless: "new"
  });

  const page = await browser.newPage();
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log("🌐 [BOT] Otwieram stronę streama:", url);

  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("⌛ [BOT] Czekam na załadowanie iframe z czatem...");
  await page.waitForSelector("iframe#chatframe", { timeout: 15000 });

  const frame = await page
    .frames()
    .find(f => f.url().includes("live_chat"));

  if (!frame) {
    console.warn("❌ [BOT] Nie znaleziono iframe z czatem.");
    await browser.close();
    return;
  }

  try {
    await frame.click("#menu #button[aria-label*='Live chat']");
    console.log("✅ [BOT] Przełączono na Live Chat");
  } catch (e) {
    console.log("⚠️ [BOT] Nie udało się przełączyć na Live Chat (może już aktywny).");
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
      console.log("❌ [BOT] Nie znaleziono kontenera #item-offset");
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
    console.log("✅ [BOT] Nasłuchiwanie wiadomości rozpoczęte.");
  });
}

module.exports = {
  getLiveVideoId,
  startYouTubeChat
};
