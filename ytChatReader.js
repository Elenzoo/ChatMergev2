const puppeteer = require("puppeteer-core");
const fs = require("fs");

const CHANNEL_HANDLE = "@zeprezz";
const CHANNEL_URL = `https://www.youtube.com/${CHANNEL_HANDLE}/live`;

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
  const exePath = findExecutablePath();
  if (!exePath) return null;

  const browser = await puppeteer.launch({
    executablePath: exePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    timeout: 30000
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);
  console.log("🔗 [SCRAPER] Otwieram URL:", CHANNEL_URL);
  await page.goto(CHANNEL_URL, { waitUntil: "domcontentloaded" });

  const redirectedUrl = page.url();
  console.log("🔁 [SCRAPER] Przekierowano na:", redirectedUrl);

  // Obsługa ekranu zgody (consent.youtube.com)
  for (let i = 1; i <= 3; i++) {
    if (redirectedUrl.includes("consent.youtube.com")) {
      console.warn(`⚠️ [SCRAPER] Próba ${i}: wykryto ekran zgody na cookies – próbuję kliknąć...`);
      try {
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")].find(el => el.textContent.includes("Accept all"));
          if (btn) btn.click();
        });
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 });
        break;
      } catch (e) {
        console.error(`❌ [SCRAPER] Błąd przy klikaniu ekran zgody (próba ${i}): ${e.message}`);
        if (i === 3) {
          await browser.close();
          return null;
        }
      }
    }
  }

  const finalUrl = page.url();
  console.log("🎯 [SCRAPER] Finalny URL po przekierowaniach:", finalUrl);

  const match = finalUrl.match(/v=([\w-]{11})/);
  if (match && match[1]) {
    const videoId = match[1];
    console.log("🏆 [SCRAPER] Wykryto aktywny stream z ID:", videoId);
    await browser.close();
    return videoId;
  }

  console.warn("⚠️ [SCRAPER] Nie znaleziono videoId w przekierowanym URL.");
  await browser.close();
  return null;
}

async function startYouTubeChat(videoId, io) {
  const exePath = findExecutablePath();
  if (!exePath) return;

  const browser = await puppeteer.launch({
    executablePath: exePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    timeout: 30000
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);
  const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log("🌐 [BOT] Otwieram stronę streama:", streamUrl);
  await page.goto(streamUrl, { waitUntil: "domcontentloaded" });

  try {
    console.log("⌛ [BOT] Czekam na załadowanie iframe z czatem...");
    await page.waitForSelector("iframe#chatframe", { timeout: 15000 });
  } catch (e) {
    console.error("❌ [BOT] Błąd ładowania czatu:", e.message);
    await browser.close();
    return;
  }

  const chatFrame = page.frames().find(f => f.url().includes("live_chat"));
  if (!chatFrame) {
    console.error("❌ [BOT] Nie znaleziono iframe z czatem.");
    await browser.close();
    return;
  }

  await chatFrame.exposeFunction("emitChat", (text) => {
    console.log("▶️ [YouTube Chat]", text);
    if (io) {
      io.emit("chatMessage", {
        source: "YouTube",
        text,
        timestamp: Date.now()
      });
    }
  });

  await chatFrame.evaluate(() => {
    const container = document.querySelector("#item-offset");
    if (!container) {
      console.log("❌ [CHAT] Nie znaleziono kontenera czatu.");
      return;
    }

    const observer = new MutationObserver(() => {
      const messages = document.querySelectorAll("yt-live-chat-text-message-renderer");
      messages.forEach(msg => {
        const author = msg.querySelector("#author-name")?.innerText;
        const message = msg.querySelector("#message")?.innerText;
        if (author && message) {
          window.emitChat(`${author}: ${message}`);
        }
      });
    });

    observer.observe(container, { childList: true, subtree: true });
    console.log("✅ [CHAT] Rozpoczęto nasłuch wiadomości z czatu YouTube.");
  });
}

module.exports = {
  getLiveVideoId,
  startYouTubeChat
};
``` [❶](code://python)
