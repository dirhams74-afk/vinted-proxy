# Vinted Proxy

Serveur proxy Node.js pour l'API Vinted. Contourne le CORS pour les extensions et apps externes.

## Déploiement rapide

### Railway (recommandé — gratuit)
1. Va sur [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo" → sélectionne ce repo
3. Railway détecte automatiquement Node.js et démarre le serveur
4. Copie l'URL publique (ex: `https://vinted-proxy-xxx.railway.app`)

### Render (alternative gratuite)
1. Va sur [render.com](https://render.com)
2. "New Web Service" → connecte ce repo GitHub
3. Build Command: `npm install` / Start Command: `npm start`
4. Copie l'URL publique

## Variables d'environnement (optionnel)
| Variable | Description |
|---|---|
| `PORT` | Port (auto sur Railway/Render) |
| `PROXY_SECRET` | Clé secrète — ajoute `X-Secret: ta-cle` dans les headers |

## Endpoints
- `GET /` — Health check
- `GET /api/items?search_text=nike&per_page=48` — Recherche articles
- `GET /api/items/:id` — Détail article

## Utilisation dans l'extension
Remplace l'URL de fetch dans `content.js` et `background.js` :
```
https://MON-PROXY.railway.app/api/items?search_text=nike
```
