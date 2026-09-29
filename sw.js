/**
 * Service worker:
 * - File aplikasi: stale-while-revalidate (tampil instan dari cache, diperbarui di belakang).
 * - Library CDN dan font: cache-first. URL library memakai versi tetap, jadi aman disimpan lama.
 */
const APP_CACHE = 'ht-app-v1';
const LIB_CACHE = 'ht-lib-v1';
const LIB_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== LIB_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return; // data live selalu dari server

  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(LIB_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(APP_CACHE).then(async (cache) => {
        const hit = await cache.match(req, { ignoreSearch: true });
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        if (hit) {
          e.waitUntil(network);
          return hit;
        }
        return network;
      })
    );
  }
});
