// ytChatReader.js
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
    args: ["--no-sandbox","--disable-setuid-sandbox"],
    headless: true,
    timeout: 60000
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  console.log("🔗 [SCRAPER] Otwieram URL:", CHANNEL_URL);
  await page.goto(CHANNEL_URL, { waitUntil: "domcontentloaded" });
  console.log("🔁 [SCRAPER] Redirect URL:", page.url());

  // Retry akceptacji cookies
  for (let i = 1; i <= 3; i++) {
    if (page.url().includes("consent.youtube.com")) {
      console.warn(`⚠️ [SCRAPER] Próba ${i}: ekran cookies`);
      try {
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(el =>
            /accept/i.test(el.textContent)
          );
          if (btn) btn.click();
        });
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 });
        console.log("✅ [SCRAPER] Cookies zaakceptowane");
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

  const cookies = await page.cookies();
  fs.writeFileSync("./cookies.json", JSON.stringify(cookies, null, 2));
  console.log("🍪 [SCRAPER] Zapisano cookies.");

  await page.goto(CHANNEL_URL, { waitUntil: "domcontentloaded" });
  console.log("🎯 [SCRAPER] Finalny URL:", page.url());

  // Retry na iframe czatu
  let iframeLoaded = false;
  for (let i = 1; i <= 3; i++) {
    try {
      console.log(`🤖 [BOT] Próba ${i}: czekam na iframe czatu`);
      await page.waitForSelector("iframe#chatframe", { timeout: 20000 });
      iframeLoaded = true;
      break;
    } catch (e) {
      console.error(`❌ [BOT] Iframe chatframe nie załadował się (próba ${i}):`, e.message);
      if (i === 3) {
        await browser.close();
        return;
      }
    }
  }
  if (!iframeLoaded) return;

  const chatFrame = page.frames().find(f => f.url().includes("live_chat"));
  if (!chatFrame) {
    console.error("❌ [BOT] Nie znaleziono live_chat frame");
    await browser.close();
    return;
  }
  console.log("✅ [BOT] Połączono z iframe czatu. Start nasłuchiwania.");

  const known = new Set();
  setInterval(async () => {
    try {
      const messages = await chatFrame.evaluate(() => {
        const nodes = document.querySelectorAll("yt-live-chat-text-message-renderer");
        return Array.from(nodes).map(n => {
          const author = n.querySelector("#author-name")?.innerText || "";
          const text = n.querySelector("#message")?.innerText || "";
          const id = n.getAttribute("id") || author + "-" + text;
          return { id, author, text };
        });
      });
      messages.forEach(m => {
        if (!known.has(m.id)) {
          known.add(m.id);
          const formatted = `${m.author}: ${m.text}`;
          console.log("💬 [YT Chat]", formatted);
          io.emit("chatMessage", { source: "YouTube", text: formatted, timestamp: Date.now() });
        }
      });
    } catch (err) {
      console.error("❌ [LOOP] Błąd odczytu czatu:", err.message);
    }
  }, 2000);
}

module.exports = { startYouTubeChat };
