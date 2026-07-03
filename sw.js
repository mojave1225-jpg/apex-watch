/* ============================================================
   APEX WATCH — Service Worker v1
   方針(保守的):
   - 静的アセット(CSS/JS/アイコン): stale-while-revalidate
     → 2回目以降の表示が高速化、裏で常に最新を取得
   - HTML: network-first(オフライン時のみキャッシュ)
     → 常に最新のマークアップを優先
   - クロスオリジン(API等): 一切キャッシュしない(素通し)
     → ライブデータの鮮度に影響を与えない
   ============================================================ */

const CACHE_VERSION = 'apex-v1';
const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image']);

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // クロスオリジンはキャッシュ対象外(API/CDNは素通し)
  if (url.origin !== self.location.origin) return;

  // HTML: network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, res.clone());
        return res;
      } catch (_) {
        const cached = await caches.match(req);
        return cached || new Response(
          '<!DOCTYPE html><meta charset="UTF-8"><body style="background:#03040d;color:#7090b0;font-family:monospace;display:grid;place-items:center;min-height:100vh;margin:0"><p>オフラインです — 接続回復後に再読み込みしてください</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
      }
    })());
    return;
  }

  // 静的アセット: stale-while-revalidate
  if (STATIC_DESTINATIONS.has(req.destination)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});
