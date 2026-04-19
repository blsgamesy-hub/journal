const CACHE = 'journal-v3';
const FILES = [
  './journal_icon.png',
  './manifest_journal.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // journal.html → network-first (항상 최신 파일 받기)
  if (e.request.url.includes('journal.html') || e.request.url.endsWith('/journal/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // 나머지 → cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
