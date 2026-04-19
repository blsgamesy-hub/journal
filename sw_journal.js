// Service Worker - stale-while-revalidate 전략
// 버전 수동 관리 불필요: 파일을 바꿔서 배포만 하면 다음 방문 시 자동 반영됨

const CACHE = 'journal-swr';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // 이전 버전 캐시(journal-v1 등)가 남아있다면 청소
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // GET 요청만 캐시 (POST/PUT 등은 그냥 통과)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. journal.html (네비게이션) → network-first
  //    최신 HTML을 항상 시도, 오프라인이면 캐시된 것 반환
  if (req.mode === 'navigate'
      || url.pathname.endsWith('.html')
      || url.pathname.endsWith('/')
      || url.pathname.endsWith('/journal')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          // 성공 시 캐시에 저장 (다음 오프라인 대비)
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2. 나머지 (아이콘, 매니페스트, 동일 출처 리소스) → stale-while-revalidate
  //    캐시에 있으면 즉시 반환 (빠름), 동시에 백그라운드에서 새 버전 받아두기
  //    다음 방문 시 자동으로 최신
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(req).then(cachedRes => {
          const fetchPromise = fetch(req).then(networkRes => {
            // 200 OK 응답만 캐시
            if (networkRes && networkRes.status === 200) {
              cache.put(req, networkRes.clone());
            }
            return networkRes;
          }).catch(() => cachedRes);  // 네트워크 실패 시 캐시로 fallback

          // 캐시가 있으면 즉시 반환, 없으면 네트워크 기다림
          return cachedRes || fetchPromise;
        })
      )
    );
    return;
  }

  // 3. 외부 리소스 (구글폰트, Firebase CDN 등) → 브라우저 기본 캐시에 맡김
  //    SW가 개입하지 않음
});
