const puppeteer = require("puppeteer-core");
const fs = require("fs");

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

  for (let i = 1; i <= 3; i++) {
    if (redirectedUrl.includes("consent.youtube.com")) {
      console.warn(`⚠️ [SCRAPER] Próba ${i}: ekran zgody – klikam...`);
      try {
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")].find(el => el.textContent.includes("Accept all"));
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

  console.log("🔁 [SCRAPER] Powrót na stronę live...");
  await page.goto(CHANNEL_URL, { waitUntil: "domcontentloaded" });
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

  console.log("✅ [BOT] Połączono z iframe czatu. Start loopa...");

  const knownMessages = new Set();

  setInterval(async () => {
    try {
      const messages = await chatFrame.evaluate(() => {
        const rendered = document.querySelectorAll("yt-live-chat-text-message-renderer");
        return Array.from(rendered).map(msg => {
          const author = msg.querySelector("#author-name")?.innerText || "";
          const text = msg.querySelector("#message")?.innerText || "";
          const id = msg.getAttribute("id") || Math.random().toString(36).substring(7);
          return { id, author, text };
        });
      });

      messages.forEach(msg => {
        if (!knownMessages.has(msg.id)) {
          knownMessages.add(msg.id);
          const formatted = `${msg.author}: ${msg.text}`;
          console.log("💬 [YT Chat]", formatted);
          if (io) {
            io.emit("chatMessage", {
              source: "YouTube",
              text: formatted,
              timestamp: Date.now()
            });
          }
        }
      });

    } catch (err) {
      console.error("❌ [LOOP] Błąd czytania wiadomości:", err.message);
    }
  }, 2000); // co 2 sekundy

}

module.exports = { startYouTubeChat };
