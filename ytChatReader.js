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
    headless: "new",
    timeout: 30000
  });

  const page = await browser.newPage();
  await page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1280, height: 720 });

  console.log("🔗 [SCRAPER] Otwieram URL:", CHANNEL_URL);
  await page.goto(CHANNEL_URL, { waitUntil: "domcontentloaded" });

  let redirectedUrl = page.url();
  console.log("🔁 [SCRAPER] Przekierowano na:", redirectedUrl);

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (redirectedUrl.includes("consent.youtube.com")) {
      console.warn(`⚠️ [SCRAPER] Próba ${attempt}: wykryto ekran zgody na cookies – próbuję kliknąć...`);
      try {
        await Promise.race([
          page.waitForSelector('form[action*="consent"] button[type="submit"]', { timeout: 10000 }),
          page.waitForSelector('button[aria-label="Accept all"]', { timeout: 10000 }),
          page.waitForSelector('button:has-text("Accept all")', { timeout: 10000 })
        ]);

        const button = await page.$('form[action*="consent"] button[type="submit"], button[aria-label="Accept all"], button:has-text("Accept all")');
        if (button) {
          console.log("🖱️ [SCRAPER] Klikam przycisk: 'Accept all'...");
          await button.click();
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 });
          redirectedUrl = page.url();
          console.log("🔁 [SCRAPER] Nowy URL po akceptacji cookies:", redirectedUrl);
          break;
        } else {
          console.warn("⚠️ [SCRAPER] Nie znaleziono żadnego przycisku zgody.");
        }
      } catch (e) {
        console.error(`❌ [SCRAPER] Błąd przy klikaniu ekran zgody (próba ${attempt}):`, e.message);
        if (attempt === 3) {
          await browser.close();
          return null;
        }
      }
    } else {
      break;
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

module.exports = {
  getLiveVideoId
};
