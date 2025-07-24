const puppeteer = require("puppeteer");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const YOUTUBE_URL = "https://www.youtube.com/@kajma/live";

app.get("/", async (req, res) => {
  try {
    console.log("🚀 Uruchamiam Puppeteera...");

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(YOUTUBE_URL, { waitUntil: "domcontentloaded" });

    // 🔍 Szukamy czatu osadzonego
    const frame = page
      .frames()
      .find(f => f.url().includes("youtube.com/live_chat"));

    if (!frame) {
      await browser.close();
      return res.send("❌ Nie znaleziono iframe czatu.");
    }

    console.log("✅ Wykryto ramkę czatu.");

    const messages = await frame.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("#items yt-live-chat-text-message-renderer"));
      return nodes.map(el => {
        const name = el.querySelector("#author-name")?.innerText || "???";
        const msg = el.querySelector("#message")?.innerText || "";
        return `${name}: ${msg}`;
      });
    });

    await browser.close();

    console.log("💬 Wiadomości:", messages.length);
    res.send(`<pre>${messages.join("\n") || "Brak wiadomości."}</pre>`);

  } catch (err) {
    console.error("❌ Błąd Puppeteera:", err.message);
    res.status(500).send("❌ Błąd Puppeteera: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serwer testowy Puppeteer działa na http://localhost:${PORT}`);
});
