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
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    timeout: 30000
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);

  console.log("🔗 [SCRAPER] Otwieram URL:", CHANNEL_URL);
  await page.goto(CHANNEL_URL, { waitUntil: "domcontentloaded" });

  let redirectedUrl = page.url();
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

  console.log("🔁 [SCRAPER] Powrót na stronę live... (próba 1)");
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

  console.log("✅ [BOT] Połączono z iframe czatu. Start nasłuchu...");

  const knownMessages = new Set();

  let kontenerZnaleziony = false;
  let observerAttached = false;

  const interval = setInterval(async () => {
    try {
      const success = await chatFrame.evaluate(() => {
        const container = document.querySelector("yt-live-chat-app");
        if (!container) return false;

        if (!window.__chatObserverAttached__) {
          const observer = new MutationObserver(() => {
            const messages = document.querySelectorAll("yt-live-chat-text-message-renderer");
            messages.forEach(msg => {
              const author = msg.querySelector("#author-name")?.innerText || "";
              const text = msg.querySelector("#message")?.innerText || "";
              const id = msg.getAttribute("id") || Math.random().toString(36).substring(7);
              if (author && text) {
                window.dispatchEvent(new CustomEvent("chat-message", {
                  detail: { id, author, text }
                }));
              }
            });
          });

          observer.observe(container, { childList: true, subtree: true });
          window.__chatObserverAttached__ = true;
          console.log("✅ [CHAT] Observer został podpięty.");
        }

        return true;
      });

      if (success && !kontenerZnaleziony) {
        kontenerZnaleziony = true;
        console.log("✅ [CHAT] Kontener czatu wykryty i observer podpięty.");
      }

    } catch (err) {
      console.error("❌ [LOOP] Błąd czytania wiadomości:", err.message);
    }
  }, 3000); // co 3 sekundy

  await chatFrame.exposeFunction("emitChat", (payload) => {
    const { id, author, text } = payload;
    if (!knownMessages.has(id)) {
      knownMessages.add(id);
      const formatted = `${author}: ${text}`;
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

  await chatFrame.evaluate(() => {
    window.addEventListener("chat-message", e => {
      const payload = e.detail;
      if (payload) window.emitChat(payload);
    });
  });
}

module.exports = { startYouTubeChat };
