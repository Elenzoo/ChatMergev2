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
  await page.goto(CHANNEL_URL, { waitUntil: "networkidle2" });

  // akceptacja cookies jeśli pojawi się ekran zgody
  for (let i = 1; i <= 3; i++) {
    if (page.url().includes("consent.youtube.com")) {
      console.warn(`⚠️ Próba ${i}: ekran cookies…`);
      try {
        await page.click('button[aria-label="Accept all"]');
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 });
        console.log("✅ Zgoda zaakceptowana");
        break;
      } catch (e) {
        console.error(`❌ Błąd akceptacji (próba ${i}):`, e.message);
        if (i === 3) { await browser.close(); return; }
      }
    }
  }

  console.log("🍪 Zapisuję cookies");
  const cookies = await page.cookies();
  fs.writeFileSync("./cookies.json", JSON.stringify(cookies, null, 2));

  console.log("🔁 Powrót na live strony...");
  await page.goto(CHANNEL_URL, { waitUntil: "networkidle2" });
  console.log("🎯 Finalny URL:", page.url());

  console.log("🤖 Czekam na iframe czatu...");
  await page.waitForSelector("iframe#chatframe, iframe[src*='live_chat']", { timeout: 20000 });

  const chatFrame = page
    .frames()
    .find(f => f.url().includes("live_chat?v=") || f.url().includes("live_chat"));

  if (!chatFrame) {
    console.error("❌ Nie znaleziono iframe czatu.");
    await browser.close();
    return;
  }
  console.log("✅ Połączono z iframe czatu.");

  // teraz nasłuchujemy wiadomości
  const known = new Set();
  setInterval(async () => {
    try {
      const messages = await chatFrame.evaluate(() => {
        const items = document.querySelectorAll("yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer");
        return Array.from(items).map(el => {
          const author = el.querySelector("#author-name")?.innerText ?? "";
          const text = el.querySelector("#message")?.innerText ?? "";
          const id = el.getAttribute("id") || author + text;
          return { id, author, text };
        });
      });
      messages.forEach(m => {
        if (!known.has(m.id)) {
          known.add(m.id);
          const txt = `${m.author}: ${m.text}`;
          console.log("💬", txt);
          io?.emit("chatMessage", { source:"YouTube", text: txt, timestamp: Date.now() });
        }
      });
    } catch(e){
      console.error("❌ Loop error:", e.message);
    }
  }, 2000);

  // nie zamykamy browsera, loop trwa
}

module.exports = { startYouTubeChat };
