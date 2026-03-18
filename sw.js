/* ======================================
   ドーナツシューティング — Service Worker
   Offline-first caching
   ====================================== */

const CACHE_NAME = 'donut-shooting-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/game.js',
  '/leaderboard.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/donut.png',
  '/assets/player.png',
  '/assets/enemy_ant.png',
  '/assets/enemy_fly.png',
  '/assets/enemy_mouse.png',
  '/assets/enemy_wasp.png',
  '/favicon.ico'
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first strategy
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
