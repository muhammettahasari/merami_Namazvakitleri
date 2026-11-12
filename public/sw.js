// Service worker: uygulama dosyalarını önbelleğe alır, internetsiz açılır.
// Vakit verileri localStorage'da tutulur; API cevapları önbelleğe alınmaz (her zaman taze).
const VERSION = 'nv-1.10.0';
const SHELL = [
  '/', '/widget.html',
  '/css/app.css', '/css/widgets.css',
  '/js/core.js', '/js/widgets.js', '/js/fx.js', '/js/wmm.js', '/js/qibla.js', '/js/vird.js', '/js/zikir.js', '/js/app.js',
  '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
];

// Yönlendirilmiş (redirect) cevaplar önbelleğe temiz kopya olarak konur; bir dosya alınamazsa kurulum yine de tamamlanır.
const clean = async (r) => (r.redirected ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r);
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) =>
    fetch(u, { cache: 'reload' }).then(async (r) => { if (r.ok) await c.put(u, await clean(r)); }).catch(() => {})
  ))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return; // ağ
  // Sayfalar: önce ağ, olmazsa önbellek. Diğer dosyalar: önbellek, arkada güncelle.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok && !r.redirected) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('/'))));
    return;
  }
  // Dosyalar: önce ağ (güncel sürüm hemen gelsin), internet yoksa önbellek
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && !r.redirected) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
