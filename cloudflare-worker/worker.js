/* ============================================================
   APEX WATCH — 自前CORSプロキシ (Cloudflare Worker)
   allorigins.win / r.jina.ai の代替。
   - 許可リスト方式(登録した上流ホストのみ中継)
   - GETのみ、エッジキャッシュ5分で上流負荷と応答時間を削減
   - CORSはapex-watch.jpのみに許可
   デプロイ: Cloudflareダッシュボード → Workers & Pages →
   Create Worker → このコードを貼り付け → Deploy
   ============================================================ */

const ALLOWED_HOSTS = new Set([
  'feodotracker.abuse.ch',   // cyber.js — Feodo Tracker C2ブロックリスト
  'volcano.si.edu',          // earth.js — Smithsonian GVP 火山RSS
  'api.open-meteo.com',      // southwest-taiwan.js — 気象フォールバック
  'earthquake.usgs.gov',     // southwest-taiwan.js — 地震フォールバック
  'api.gdeltproject.org',       // gdelt.js — 世界メディア監視
]);

const ALLOWED_ORIGINS = new Set([
  'https://apex-watch.jp',
  'https://www.apex-watch.jp',
  'http://localhost:8000',       // ローカル開発用(不要なら削除)
  'http://127.0.0.1:8000',
]);

const CACHE_TTL_SECONDS = 300; // 5分(既定)
// GDELTは15分毎更新かつレート制限が厳しいため、長めにキャッシュ
const HOST_TTL_OVERRIDES = { 'api.gdeltproject.org': 900 };

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://apex-watch.jp';
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const reqUrl = new URL(request.url);

    // ── /ytlive?channel=UCxxx : アップロードプレイリスト方式でライブ動画ID解決 ──
    if (reqUrl.pathname === '/ytlive') {
      const channel = reqUrl.searchParams.get('channel') || '';
      if (!/^UC[\w-]{22}$/.test(channel)) {
        return new Response(JSON.stringify({ error: 'invalid channel' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!env.YT_API_KEY) {
        return new Response(JSON.stringify({ error: 'YT_API_KEY not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const playlistId = 'UU' + channel.slice(2);
      const cache = caches.default;
      const cacheKey = new Request('https://ytlive.cache/' + channel, { method: 'GET' });
      let cached = await cache.match(cacheKey);
      if (cached) {
        cached = new Response(cached.body, cached);
        for (const [k, v] of Object.entries(corsHeaders)) cached.headers.set(k, v);
        return cached;
      }

      let videoId = null;
      try {
        // ① playlistItems で最大15件の videoId を収集
        const playlistUrl = 'https://www.googleapis.com/youtube/v3/playlistItems'
          + '?part=contentDetails&maxResults=15&playlistId=' + playlistId + '&key=' + env.YT_API_KEY;
        const playlistRes = await fetch(playlistUrl, { signal: AbortSignal.timeout(8000) });
        if (!playlistRes.ok) throw new Error('playlist API failed: ' + playlistRes.status);

        const playlistData = await playlistRes.json();
        const videoIds = (playlistData.items || [])
          .map(item => item.contentDetails?.videoId)
          .filter(Boolean);

        if (videoIds.length === 0) throw new Error('no videos in playlist');

        // ② videos で liveBroadcastContent === 'live' を検索
        const videosUrl = 'https://www.googleapis.com/youtube/v3/videos'
          + '?part=snippet&id=' + videoIds.join(',') + '&key=' + env.YT_API_KEY;
        const videosRes = await fetch(videosUrl, { signal: AbortSignal.timeout(8000) });
        if (!videosRes.ok) throw new Error('videos API failed: ' + videosRes.status);

        const videosData = await videosRes.json();
        const liveVideo = (videosData.items || [])
          .find(item => item.snippet?.liveBroadcastContent === 'live');

        if (liveVideo) {
          videoId = liveVideo.id;
        }
      } catch (e) {
        console.warn('[ytlive]', e.message);
      }

      // ③ キャッシュTTL: videoId取得できたら600秒、なければ120秒
      const ttl = videoId ? 600 : 120;
      const body = JSON.stringify({ videoId });
      const res = new Response(body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttl}`,
        },
      });
      if (videoId) ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }

    const target = reqUrl.searchParams.get('url');
    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders });
    }

    let upstream;
    try {
      upstream = new URL(target);
    } catch {
      return new Response('Invalid url', { status: 400, headers: corsHeaders });
    }
    if (upstream.protocol !== 'https:') {
      return new Response('HTTPS only', { status: 400, headers: corsHeaders });
    }
    if (!ALLOWED_HOSTS.has(upstream.hostname)) {
      return new Response('Host not in allowlist: ' + upstream.hostname, {
        status: 403, headers: corsHeaders,
      });
    }

    // ── エッジキャッシュ ──
    const ttl = HOST_TTL_OVERRIDES[upstream.hostname] || CACHE_TTL_SECONDS;
    const cache = caches.default;
    const cacheKey = new Request(upstream.toString(), { method: 'GET' });
    let res = await cache.match(cacheKey);

    if (!res) {
      let originRes;
      try {
        originRes = await fetch(upstream.toString(), {
          headers: {
            'User-Agent': 'apex-watch-proxy/1.0 (+https://apex-watch.jp)',
            'Accept': '*/*',
          },
          signal: AbortSignal.timeout(15000),
        });
      } catch (e) {
        return new Response('Upstream fetch failed: ' + e.message, {
          status: 502, headers: corsHeaders,
        });
      }
      res = new Response(originRes.body, originRes);
      res.headers.set('Cache-Control', `public, max-age=${ttl}`);
      // 上流のSet-Cookie等は落とす
      res.headers.delete('Set-Cookie');
      if (originRes.ok) {
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }
    }

    res = new Response(res.body, res);
    for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
    res.headers.set('X-Apex-Proxy', 'cf-worker');
    return res;
  },
};
