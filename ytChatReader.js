const puppeteer = require("puppeteer-core");
const fs = require("fs");
const glob = require("glob");

const YOUTUBE_URL = "https://www.youtube.com/@kajma/live";

function findExecutablePath() {
  const paths = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/render/.cache/puppeteer/chrome/linux-*/chrome"
  ];
  for (const path of paths) {
    const match = glob.sync(path)[0];
    if (match && fs.existsSync(match)) {
      console.log("✅ Wykryto przeglądarkę:", match);
      return match;
    }
  }
  console.warn("❌ Nie znaleziono przeglądarki");
  return null;
}

async function getYouTubeChatMessages() {
  const executablePath = findExecutablePath();
  if (!executablePath) throw new Error("Brak przeglądarki");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(YOUTUBE_URL, { waitUntil: "domcontentloaded" });

  const frame = page.frames().find(f => f.url().includes("youtube.com/live_chat"));

  if (!frame) {
    await browser.close();
    throw new Error("❌ Nie znaleziono iframe czatu.");
  }

  const messages = await frame.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("#items yt-live-chat-text-message-renderer"));
    return nodes.map(el => {
      const name = el.querySelector("#author-name")?.innerText || "???";
      const msg = el.querySelector("#message")?.innerText || "";
      return `${name}: ${msg}`;
    });
  });

  await browser.close();
  return messages;
}

module.exports = {
  getYouTubeChatMessages
};
