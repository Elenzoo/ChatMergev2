const puppeteer = require("puppeteer-core");
const fs = require("fs");

const CHANNEL_URL = "https://www.youtube.com/@noobsapiens/live";

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

async function startYouTubeChat(io) {
  const exePath = findExecutablePath();
  if (!exePath) return;

  const browser = await puppeteer.launch({
    executablePath: exePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
    timeout: 30000
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);

  console.log("🔗 [SCRAPER] Otwieram URL:", CHANNEL_URL);
  await page.goto(CHANNEL_URL, { waitUntil: "domcontentloaded" });

  const redirectedUrl = page.url();
  console.log("🔁 [SCRAPER] Przekierowano na:", redirectedUrl);

  for (let i = 1; i <= 3; i++) {
    if (redirectedUrl.includes("consent.youtube.com")) {
      console.warn(`⚠️ [SCRAPER] Próba ${i}: ekran zgody – klikam...`);
      try {
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")].find(el =>
            el.textContent.includes("Accept all")
          );
          if (btn) btn.click();
        });
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 });
        console.log("✅ [SCRAPER] Zgoda zaakceptowana");
        break;
      } catch (e) {
        console.error(`❌ [SCRAPER] Błąd akceptacji (próba ${i}):`, e.message);
        if (i === 3) {
          await browser.close();
          return;
        }
      }
    }
  }

  console.log("🍪 [SCRAPER] Zapisano cookies.");
  const cookies = await page.cookies();
  fs.writeFileSync("./cookies.json", JSON.stringify(cookies, null, 2));

  // Retry na powrót do livestreama
  let finalLoaded = false;
  for (let i = 1; i <= 3; i++) {
    console.log(`🔁 [SCRAPER] Powrót na stronę live... (próba ${i})`);
    try {
      await page.goto(CHANNEL_URL, {
        waitUntil: ["networkidle2", "domcontentloaded"],
        timeout: 60000
      });
      finalLoaded = true;
      break;
    } catch (e) {
      console.error(`❌ [SCRAPER] Błąd ładowania live (próba ${i}):`, e.message);
      if (i === 3) {
        await browser.close();
        return;
      }
    }
  }

  if (!finalLoaded) return;
  console.log("🎯 [SCRAPER] Finalny URL:", page.url());

  try {
    console.log("🤖 [BOT] Czekam na iframe czatu...");
    await page.waitForSelector("iframe#chatframe", { timeout: 15000 });
  } catch (e) {
    console.error("❌ [BOT] Błąd ładowania iframe:", e.message);
    await browser.close();
    return;
  }

  const chatFrame = page.frames().find(f => f.url().includes("live_chat"));
  if (!chatFrame) {
    console.error("❌ [BOT] Nie znaleziono iframe czatu.");
    await browser.close();
    return;
  }

  console.log("✅ [BOT] Połączono z iframe czatu. Start nasłuchu...");

  const knownMessages = new Set();

  try {
    await chatFrame.exposeFunction("emitChat", (text) => {
      console.log("💬 [YouTube Chat]", text);
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
        console.error("❌ [CHAT] Nie znaleziono kontenera wiadomości.");
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
      console.log("✅ [CHAT] Nasłuchuję wiadomości z czatu.");
    });
  } catch (err) {
    console.error("❌ [LOOP] Błąd inicjalizacji nasłuchu:", err.message);
    await browser.close();
  }
}

module.exports = { startYouTubeChat };
