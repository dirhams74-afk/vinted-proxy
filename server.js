const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// ── Clé secrète optionnelle (protège ton proxy des abus) ────────────────────
const SECRET = process.env.PROXY_SECRET || null;

// ── Cookie Vinted — rafraîchi automatiquement ───────────────────────────────
let vintedCookie = '';
let cookieExpiry = 0;

async function refreshCookie() {
  try {
    const r = await fetch('https://www.vinted.fr/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      redirect: 'follow'
    });
    const setCookie = r.headers.raw()['set-cookie'] || [];
    const cookies = setCookie.map(c => c.split(';')[0]).join('; ');
    if (cookies) {
      vintedCookie = cookies;
      cookieExpiry = Date.now() + 25 * 60 * 1000; // 25 min
      console.log('[cookie] Refreshed OK');
    }
  } catch (e) {
    console.error('[cookie] Refresh failed:', e.message);
  }
}

async function getCookie() {
  if (!vintedCookie || Date.now() > cookieExpiry) await refreshCookie();
  return vintedCookie;
}

// Refresh au démarrage
refreshCookie();
// Refresh toutes les 20 min
setInterval(refreshCookie, 20 * 60 * 1000);

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Auth middleware ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!SECRET) return next();
  const provided = req.headers['x-secret'] || req.query._secret;
  if (provided !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'vinted-proxy', cookieReady: !!vintedCookie });
});

// ── Route principale : /api/items?search_text=nike&... ──────────────────────
app.get('/api/items', async (req, res) => {
  try {
    const cookie = await getCookie();

    // Recopie tous les query params vers l'API Vinted
    const params = new URLSearchParams();
    const allowed = ['search_text','catalog_ids','status_ids','price_from','price_to','order','page','per_page','brand_ids','size_ids','color_ids'];
    for (const key of allowed) {
      if (req.query[key]) params.set(key, req.query[key]);
    }
    if (!params.has('per_page')) params.set('per_page', '48');
    if (!params.has('order')) params.set('order', 'newest_first');

    const url = `https://www.vinted.fr/api/v2/catalog/items?${params}`;
    console.log('[proxy]', url);

    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
        'Referer': 'https://www.vinted.fr/',
        'Origin': 'https://www.vinted.fr',
      }
    });

    // Si cookie expiré, on rafraîchit et on réessaie une fois
    if (r.status === 401 || r.status === 403) {
      console.log('[proxy] Cookie expired, refreshing...');
      await refreshCookie();
      return res.status(502).json({ error: 'Cookie refreshed, retry' });
    }

    if (!r.ok) {
      return res.status(r.status).json({ error: `Vinted API error: ${r.status}` });
    }

    const data = await r.json();
    res.json(data);

  } catch (e) {
    console.error('[proxy] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Route détail article : /api/items/:id ────────────────────────────────────
app.get('/api/items/:id', async (req, res) => {
  try {
    const cookie = await getCookie();
    const r = await fetch(`https://www.vinted.fr/api/v2/items/${req.params.id}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
        'Referer': 'https://www.vinted.fr/',
      }
    });
    if (!r.ok) return res.status(r.status).json({ error: `Vinted API error: ${r.status}` });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Vinted Proxy running on port ${PORT}`);
});
