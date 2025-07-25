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
  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log("✅ [BROWSER] Wykryto przeglądarkę:", p);
      return p;
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
  console.log("🔗 [SCRAPER] Otwieram URL:", CHANNEL_URL);
  await page.goto(CHANNEL_URL, { waitUntil: "networkidle2", timeout: 60000 });

  const redirectedUrl = page.url();
  console.log("🔁 [SCRAPER] Przekierowano na:", redirectedUrl);

  if (redirectedUrl.includes("consent.youtube.com")) {
    console.warn("⚠️ [SCRAPER] Wykryto ekran zgody na cookies – próbuję zaakceptować.");

    try {
      await page.waitForSelector('button', { timeout: 8000 });
      const allButtons = await page.$$('button');
      let clicked = false;

      for (const btn of allButtons) {
        const txt = (await btn.evaluate(n => n.innerText)).trim();
        if (txt.match(/Accept all|Zgadzam się|Allow all/i)) {
          console.log(`🖱️ [SCRAPER] Klikam przycisk: "${txt}"`);
          await Promise.all([
            btn.click(),
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
          ]);
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        console.warn("⚠️ [SCRAPER] Nie znaleziono przycisku akceptacji.");
      }
    } catch (err) {
      console.error("❌ [SCRAPER] Błąd przy klikaniu ekran zgody:", err.message);
      await browser.close();
      return null;
    }
  }

  const finalUrl = page.url();
  console.log("🎯 [SCRAPER] Finalny URL:", finalUrl);

  const m = finalUrl.match(/v=([\w-]{11})/);
  if (m && m[1]) {
    console.log("🏆 [SCRAPER] Wykryto aktywny stream ID:", m[1]);
    await browser.close();
    return m[1];
  }

  console.warn("⚠️ [SCRAPER] Nie znaleziono videoId.");
  await browser.close();
  return null;
}

async function startYouTubeChat(videoId, io) {
  const exePath = findExecutablePath();
  if (!exePath) return;

  const browser = await puppeteer.launch({
    executablePath: exePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: "new"
  });
  const page = await browser.newPage();
  const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log("🌐 [BOT] Otwieram stronę:", streamUrl);
  await page.goto(streamUrl, { waitUntil: "networkidle2", timeout: 60000 });

  try {
    console.log("⌛ [BOT] Czekam na iframe czatu...");
    await page.waitForSelector("iframe#chatframe", { timeout: 20000 });
  } catch (e) {
    console.error("❌ [BOT] iframe z czatem nie załadowany:", e.message);
    await browser.close();
    return;
  }

  const chatFrame = page.frames().find(f => f.url().includes("live_chat"));
  if (!chatFrame) {
    console.error("❌ [BOT] Nie znaleziono ramki czatu.");
    await browser.close();
    return;
  }

  await chatFrame.exposeFunction("emitChat", text => {
    console.log("▶️ [YouTube Chat]", text);
    if (io) io.emit("chatMessage", { source: "YouTube", text, timestamp: Date.now() });
  });

  await chatFrame.evaluate(() => {
    const container = document.querySelector("#item-offset");
    if (!container) {
      console.error("❌ [CHAT] Kontener czatu nie znaleziony.");
      return;
    }
    const obs = new MutationObserver(() => {
      const msgs = document.querySelectorAll("yt-live-chat-text-message-renderer");
      msgs.forEach(msg => {
        const author = msg.querySelector("#author-name")?.innerText;
        const message = msg.querySelector("#message")?.innerText;
        if (author && message) window.emitChat(`${author}: ${message}`);
      });
    });
    obs.observe(container, { childList: true, subtree: true });
    console.log("✅ [CHAT] Nasłuch czatu uruchomiony.");
  });
}

module.exports = { getLiveVideoId, startYouTubeChat };
