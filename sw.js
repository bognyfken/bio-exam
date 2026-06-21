// sw.js — service worker: офлайн-кэш (precache + stale-while-revalidate).
// Версию бампать при изменении ассетов/контента, чтобы клиенты обновились.
const VERSION = 'bio-v4';
const CACHE = `bio-cache-${VERSION}`;

const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'vendor/marked.min.js',
  'js/app.js',
  'js/parser.js',
  'js/store.js',
  'js/util.js',
  'js/version.js',
  'js/reading.js',
  'js/cards.js',
  'js/quiz.js',
  'js/search.js',
  'js/glossary.js',
  'js/home.js',
  'content/konspekt.md',
  'content/konspekt-ext.md',
  'content/quiz.json',
  'content/glossary.md',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {}) // не валим установку, если один файл не доступен
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Навигации → отдаём index.html (SPA), с сетевым обновлением
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        caches.open(CACHE).then((c) => c.put('index.html', res.clone()));
        return res;
      }).catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Остальное — stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
