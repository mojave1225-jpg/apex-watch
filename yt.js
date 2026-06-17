/* ============================================================
   YouTube Live Stream Loader v4
   - 10+ Invidious instances
   - 3 API strategies per channel
   - Auto-retry every 3 minutes
   - Manual retry button on error
   ============================================================ */

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.private.coffee',
  'https://invidious.nerdvpn.de',
  'https://invidious.perennialte.ch',
  'https://invidious.privacydev.net',
  'https://invidious.flokinet.to',
  'https://invidious.tiekoetter.com',
  'https://yt.oelrichsgarcia.de',
  'https://invidious.io.lol',
  'https://y.com.sb',
  'https://invidious.lunar.icu',
  'https://iv.datura.network',
];

const YT_CHANNELS = [
  {
    wrapperId:  'yt-wrap-fox',
    handle:     'livenowfox',
    searchQuery:'LiveNOW from FOX',
    label:      '▶ LiveNOW from FOX',
    youtubeUrl: 'https://www.youtube.com/@livenowfox/live',
  },
  {
    wrapperId:  'yt-wrap-cbs',
    handle:     'CBSNews',
    searchQuery:'CBS News 24/7',
    label:      '▶ CBS News 24/7',
    youtubeUrl: 'https://www.youtube.com/@CBSNews/live',
  },
];

// ── FETCH ONE INVIDIOUS ENDPOINT (race first responder) ──
async function invGet(path) {
  // Shuffle instances so load is distributed
  const shuffled = [...INVIDIOUS_INSTANCES].sort(() => Math.random() - 0.5);
  for (const base of shuffled) {
    try {
      const res = await fetch(`${base}/api/v1${path}`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        return { data, base };
      }
    } catch (_) { /* try next instance */ }
  }
  return null;
}

// ── STRATEGY 1: channel latestVideos ──
async function strategyChannel(handle) {
  const result = await invGet(`/channels/@${handle}`);
  if (!result?.data?.latestVideos) return null;
  const vids = result.data.latestVideos;
  // For 24/7 channels: liveNow → lengthSeconds=0 → first video (always live)
  const live = vids.find(v => v.liveNow === true)
            || vids.find(v => v.lengthSeconds === 0 && !v.isUpcoming)
            || vids[0]; // 24/7 channels: top video is always the live stream
  return live?.videoId || null;
}

// ── STRATEGY 2: channel /streams endpoint ──
async function strategyStreams(handle) {
  const ch = await invGet(`/channels/@${handle}`);
  if (!ch?.data?.authorId) return null;
  const ucid = ch.data.authorId;

  const result = await invGet(`/channels/${ucid}/streams`);
  if (!result?.data?.videos) return null;
  const live = result.data.videos.find(v => v.liveNow === true)
             || result.data.videos.find(v => v.lengthSeconds === 0 && !v.isUpcoming)
             || result.data.videos[0];
  return live?.videoId || null;
}

// ── STRATEGY 3: search API with live filter ──
async function strategySearch(searchQuery) {
  const q = encodeURIComponent(searchQuery);
  const result = await invGet(`/search?q=${q}&type=video&features=live`);
  if (!Array.isArray(result?.data)) return null;
  const live = result.data.find(v => v.liveNow === true)
             || result.data[0];
  return live?.videoId || null;
}

// ── FIND LIVE VIDEO ID (tries all 3 strategies) ──
async function findLiveVideoId(ch) {
  // Run strategy 1 and 3 in parallel first (fastest)
  const [s1, s3] = await Promise.all([
    strategyChannel(ch.handle).catch(() => null),
    strategySearch(ch.searchQuery).catch(() => null),
  ]);
  if (s1) return s1;
  if (s3) return s3;

  // Strategy 2 as last resort (two-step, slower)
  const s2 = await strategyStreams(ch.handle).catch(() => null);
  return s2 || null;
}

// ── DOM HELPERS ──
function getWrap(ch) { return document.getElementById(ch.wrapperId); }

function setLoading(ch) {
  const w = getWrap(ch);
  if (!w) return;
  w.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <div class="yt-loading">
      <span class="yt-loading-dot"></span> ライブ映像読み込み中...
    </div>`;
}

function setEmbed(ch, videoId) {
  const w = getWrap(ch);
  if (!w) return;
  ch._videoId = videoId;
  w.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <iframe
      src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1"
      frameborder="0"
      allow="autoplay; autoplay; encrypted-media; picture-in-picture"
      allowfullscreen
      class="yt-iframe"
      title="${ch.label}">
    </iframe>`;
}

function setError(ch, reason) {
  const w = getWrap(ch);
  if (!w) return;
  const btnId = `retry-${ch.wrapperId}`;
  w.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <div class="yt-error">
      <div class="yt-error-icon">▶</div>
      <div class="yt-error-msg">${reason}</div>
      <button id="${btnId}" class="yt-retry-btn">再試行</button>
      <a href="${ch.youtubeUrl}" target="_blank" rel="noopener" class="yt-error-link">
        YouTube で視聴する →
      </a>
    </div>`;
  document.getElementById(btnId)?.addEventListener('click', () => loadChannel(ch));
}

// ── LOAD ONE CHANNEL ──
async function loadChannel(ch) {
  setLoading(ch);
  try {
    const videoId = await findLiveVideoId(ch);
    if (videoId) {
      setEmbed(ch, videoId);
    } else {
      setError(ch, 'ライブ配信が見つかりませんでした（3分後に自動再試行）');
    }
  } catch (e) {
    setError(ch, 'データ取得エラー（3分後に自動再試行）');
  }
}

// ── AUTO-REFRESH (every 3 min for failed channels) ──
function startAutoRefresh() {
  setInterval(() => {
    YT_CHANNELS.forEach(ch => {
      // Only retry if NOT currently showing an iframe (i.e., error state)
      const w = getWrap(ch);
      if (w && !w.querySelector('iframe')) {
        loadChannel(ch);
      }
    });
  }, 3 * 60 * 1000);
}

// ── INIT ──
function initYoutubeLive() {
  YT_CHANNELS.forEach((ch, i) => {
    setTimeout(() => loadChannel(ch), i * 800);
  });
  startAutoRefresh();
}

document.addEventListener('DOMContentLoaded', initYoutubeLive);
