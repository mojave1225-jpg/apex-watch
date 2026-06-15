/* ============================================================
   APEX WATCH — YouTube Live Stream Loader v3
   Strategy: Invidious API (open-source YouTube proxy, CORS-enabled)
   Falls back across multiple public Invidious instances.
   Final fallback: clickable link to YouTube live page.
   ============================================================ */

const YT_CHANNELS = [
  {
    wrapperId: 'yt-wrap-fox',
    handle: 'livenowfox',       // without @
    label: '▶ LiveNOW from FOX',
    youtubeUrl: 'https://www.youtube.com/@livenowfox/live',
  },
  {
    wrapperId: 'yt-wrap-cbs',
    handle: 'CBSNews',
    label: '▶ CBS News 24/7',
    youtubeUrl: 'https://www.youtube.com/@CBSNews/live',
  },
];

// Public Invidious instances that support CORS browser requests
// See: https://docs.invidious.io/api/
const INVIDIOUS_INSTANCES = [
  'https://invidious.private.coffee',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.oelrichsgarcia.de',
  'https://invidious.io.lol',
  'https://iv.datura.network',
];

// ── FETCH FROM INVIDIOUS (tries all instances) ──
async function invidiousFetch(path) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1${path}`, {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) return await res.json();
    } catch (_) { /* try next */ }
  }
  return null;
}

// ── FIND LIVE VIDEO ID FROM CHANNEL ──
async function findLiveVideoId(handle) {
  // Strategy 1: channel endpoint (resolves handle → channel data + latestVideos)
  const data = await invidiousFetch(`/channels/@${handle}`);
  if (data?.latestVideos?.length) {
    const live = data.latestVideos.find(v => v.liveNow === true);
    if (live) return live.videoId;
    // Some instances set lengthSeconds=0 for live streams
    const zeroLen = data.latestVideos.find(v => v.lengthSeconds === 0 && !v.isUpcoming);
    if (zeroLen) return zeroLen.videoId;
  }

  // Strategy 2: search API for live videos on this channel
  const searchPath = `/search?q=${encodeURIComponent(handle + ' live stream')}&type=video&features=live`;
  const results = await invidiousFetch(searchPath);
  if (Array.isArray(results) && results.length > 0) {
    // Filter to videos from this channel
    const match = results.find(v =>
      v.liveNow &&
      v.author?.toLowerCase().includes(handle.toLowerCase().replace('cbs', 'cbs'))
    );
    if (match) return match.videoId;
    if (results[0]?.liveNow) return results[0].videoId;
  }

  return null;
}

// ── RENDER STATES ──
function setLoading(ch) {
  const w = document.getElementById(ch.wrapperId);
  if (!w) return;
  w.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <div class="yt-loading">
      <span class="yt-loading-dot"></span> ライブ映像読み込み中...
    </div>`;
}

function setEmbed(ch, videoId) {
  const w = document.getElementById(ch.wrapperId);
  if (!w) return;
  w.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <iframe
      src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=1&rel=0&modestbranding=1"
      frameborder="0"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen
      class="yt-iframe"
      title="${ch.label}">
    </iframe>`;
}

function setError(ch, reason) {
  const w = document.getElementById(ch.wrapperId);
  if (!w) return;
  w.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <div class="yt-error">
      <div class="yt-error-icon">▶</div>
      <div class="yt-error-msg">${reason}</div>
      <a href="${ch.youtubeUrl}" target="_blank" rel="noopener" class="yt-error-link">
        YouTube で視聴する →
      </a>
    </div>`;
}

// ── LOAD ONE CHANNEL ──
async function loadChannel(ch) {
  setLoading(ch);
  try {
    const videoId = await findLiveVideoId(ch.handle);
    if (videoId) {
      setEmbed(ch, videoId);
    } else {
      setError(ch, 'ライブ配信が見つかりませんでした（放送外の可能性）');
    }
  } catch (e) {
    setError(ch, 'データ取得エラー');
  }
}

// ── INIT ──
async function initYoutubeLive() {
  // Load in parallel with slight stagger
  YT_CHANNELS.forEach((ch, i) => {
    setTimeout(() => loadChannel(ch), i * 600);
  });
}

document.addEventListener('DOMContentLoaded', initYoutubeLive);
