import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

const app = express();
app.use(cors());

let cachedCookies = null;
let cookieExpiry = 0;

async function getVintedCookies() {
  if (cachedCookies && Date.now() < cookieExpiry) return cachedCookies;
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.goto("https://www.vinted.fr", { waitUntil: "networkidle2", timeout: 30000 });
  cachedCookies = await page.cookies();
  cookieExpiry = Date.now() + 30 * 60 * 1000;
  await browser.close();
  return cachedCookies;
}

app.get("/search", async (req, res) => {
  try {
    const cookies = await getVintedCookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
    const params = new URLSearchParams(req.query);
    const url = `https://www.vinted.fr/api/v2/catalog/items?${params}`;
    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "fr-FR,fr;q=0.9",
        Cookie: cookieStr,
      },
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(process.env.PORT || 3000, () => console.log("Proxy running"));
