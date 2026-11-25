/* Service worker Riamo GPS World : fonctionnement hors-ligne de base.
   Changez VERSION à chaque mise à jour du site pour renouveler le cache. */
const VERSION = 'riamo-v1';
const CORE = [
  './', 'index.html', 'styles.css', 'app.js', 'config.js', 'favicon.svg',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];
const TILES = 'riamo-tiles';
const MAX_TILES = 400;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.allSettled(CORE.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isTile = /tile\.openstreetmap\.org|basemaps\.cartocdn\.com/.test(url.hostname);

  if (isTile) {
    // Tuiles de carte : cache d'abord, puis réseau (et mémorisation)
    e.respondWith(
      caches.open(TILES).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          c.put(req, res.clone()).then(trimTiles);
          return res;
        } catch (err) {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // Fichiers du site : réseau d'abord (toujours à jour), cache en secours hors-ligne
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && (url.origin === location.origin || url.hostname === 'unpkg.com')) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});
