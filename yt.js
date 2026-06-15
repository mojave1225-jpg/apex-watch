/* ============================================================
   APEX WATCH — YouTube Live Stream Loader
   YouTube live_stream?channel= embed is deprecated.
   This fetches current video IDs dynamically via CORS proxy.
   ============================================================ */

const YT_CHANNELS = [
  {
    iframeId: 'yt-iframe-fox',
    wrapperId: 'yt-wrap-fox',
    handle: '@livenowfox',
    label: '▶ LiveNOW from FOX',
  },
  {
    iframeId: 'yt-iframe-cbs',
    wrapperId: 'yt-wrap-cbs',
    handle: '@CBSNews',
    label: '▶ CBS News 24/7',
  },
];

// CORS proxies (tried in order)
const PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithProxy(targetUrl) {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(targetUrl), {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return await res.text();
    } catch (_) {}
  }
  return null;
}

function extractVideoId(html) {
  if (!html) return null;

  // Most reliable: OG image tag contains video ID
  // <meta property="og:image" content="https://i.ytimg.com/vi/VIDEO_ID/...">
  const ogImg = html.match(/ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\//);
  if (ogImg) return ogImg[1];

  // Fallback: canonical URL
  const canonical = html.match(/\"canonicalBaseUrl\":\"\/watch\?v=([a-zA-Z0-9_-]{11})\"/);
  if (canonical) return canonical[1];

  // Fallback: videoId in JSON
  const videoId = html.match(/\"videoId\":\"([a-zA-Z0-9_-]{11})\"/);
  if (videoId) return videoId[1];

  // Fallback: watch?v= in any href
  const watchV = html.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (watchV) return watchV[1];

  return null;
}

function setIframeSrc(iframeId, videoId) {
  const iframe = document.getElementById(iframeId);
  if (!iframe) return;
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=1&rel=0&modestbranding=1`;
}

function showError(ch, message) {
  const wrapper = document.getElementById(ch.wrapperId);
  if (!wrapper) return;
  wrapper.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <div class="yt-error">
      <div class="yt-error-icon">▶</div>
      <div class="yt-error-msg">${message}</div>
      <a href="https://www.youtube.com/${ch.handle}/live" target="_blank" class="yt-error-link">
        YouTubeで視聴する →
      </a>
    </div>
  `;
}

function showLoading(ch) {
  const wrapper = document.getElementById(ch.wrapperId);
  if (!wrapper) return;
  wrapper.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <div class="yt-loading">
      <span class="yt-loading-dot"></span>ライブ映像読み込み中...
    </div>
    <iframe
      id="${ch.iframeId}"
      frameborder="0"
      allow="autoplay; encrypted-media"
      allowfullscreen
      class="yt-iframe"
      style="display:none"
      title="${ch.label}">
    </iframe>
  `;
}

async function loadChannel(ch) {
  showLoading(ch);

  const targetUrl = `https://www.youtube.com/${ch.handle}/live`;
  const html = await fetchWithProxy(targetUrl);
  const videoId = extractVideoId(html);

  if (videoId) {
    // Show iframe, hide loading
    const wrapper = document.getElementById(ch.wrapperId);
    if (wrapper) {
      const loadingEl = wrapper.querySelector('.yt-loading');
      const iframeEl  = wrapper.querySelector('.yt-iframe');
      if (loadingEl) loadingEl.style.display = 'none';
      if (iframeEl)  {
        iframeEl.style.display = 'block';
        iframeEl.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&mute=1&rel=0&modestbranding=1`;
      }
    }
  } else {
    showError(ch, 'ライブ映像を取得できませんでした');
  }
}

async function initYoutubeLive() {
  // Stagger loads slightly
  for (let i = 0; i < YT_CHANNELS.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 800));
    loadChannel(YT_CHANNELS[i]);  // intentionally not awaited so they load in parallel
  }
}

document.addEventListener('DOMContentLoaded', initYoutubeLive);
