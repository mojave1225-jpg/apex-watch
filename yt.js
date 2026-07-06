/* ============================================================
   YouTube Live Stream Loader v9 — マルチチャンネル対応(タブ切替・プレイヤー1枠共有) — YouTube Data API(Worker経由)でライブID解決 — channel直接埋め込み方式(HTML解析による誤ID採用の問題を廃止)
   ライブ動画IDを実行時に解決する方式:
   自前Workerプロキシ経由で /live ページを取得し、canonical の
   watch?v=ID から現在のライブ配信IDを抽出して直接埋め込む。
   (live_stream?channel= 方式はYouTube側で不安定化しているため
    フォールバックに降格)
   ============================================================ */

const YT_CHANNELS = [
  {
    wrapperId:  'yt-wrap-main',
    channelId:  'UCBi2mrWuNuyYy4gbM6fU18Q',  // ABC News
    liveVideoId: null,
    label:      '▶ ABC News Live',
    youtubeUrl: 'https://www.youtube.com/@ABCNews/live',
    officialUrl:'https://abcnews.go.com/Live',
  },
  {
    wrapperId:  'yt-wrap-main',              // プレイヤーは1枠を共有
    channelId:  'UCNye-wNBqNL5ZzHSJj3l8Bg',  // Al Jazeera English
    liveVideoId: null,
    label:      '▶ Al Jazeera English Live',
    youtubeUrl: 'https://www.youtube.com/@AlJazeeraEnglish/live',
    officialUrl:'https://www.aljazeera.com/live/',
  },
  {
    wrapperId:  'yt-wrap-main',
    channelId:  'UCoMdktPbSTixAyNGwb-UYkQ',  // Sky News
    liveVideoId: null,
    label:      '▶ Sky News Live',
    youtubeUrl: 'https://www.youtube.com/@SkyNews/live',
    officialUrl:'https://news.sky.com/watch-live',
  },
];

function buildEmbedSrc(ch, useNoCookie, mode = 'channel') {
  const host = useNoCookie
    ? 'https://www.youtube-nocookie.com'
    : 'https://www.youtube.com';

  const base = mode === 'video' && ch.liveVideoId
    ? `${host}/embed/${ch.liveVideoId}`
    : `${host}/embed/live_stream?channel=${ch.channelId}`;

  const originParam =
    typeof window !== 'undefined' && window.location && window.location.origin
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';

  const params = [
    'autoplay=1&mute=1&rel=0&modestbranding=1',
    'playsinline=1',
    'cc_load_policy=1',
    'hl=ja',
    'enablejsapi=1',
  ].join('&') + originParam;

  // baseに既にクエリがあれば'&'、なければ'?'で連結(従来は常に'&'でURL不正だった)
  return base + (base.includes('?') ? '&' : '?') + params;
}

function buildSourceList(ch, liveId) {
  if (liveId) {
    // YouTube Data APIで解決した現行ライブIDを最優先で直接埋め込み
    const live = { ...ch, liveVideoId: liveId };
    return [
      buildEmbedSrc(live, false, 'video'),
      buildEmbedSrc(live, true,  'video'),
      buildEmbedSrc(ch,   false, 'channel'),
      buildEmbedSrc(ch,   false, 'video'),
    ];
  }
  // ID未解決時: channel埋め込み → VODフォールバック
  return [
    buildEmbedSrc(ch, false, 'channel'),
    buildEmbedSrc(ch, true,  'channel'),
    buildEmbedSrc(ch, false, 'video'),
    buildEmbedSrc(ch, true,  'video'),
  ];
}

/* Workerの/ytliveルート経由でYouTube Data APIから現行ライブIDを取得 */
async function fetchLiveVideoId(ch) {
  if (typeof APEX_PROXY_BASE !== 'string' || !APEX_PROXY_BASE) return null;
  try {
    const origin = new URL(APEX_PROXY_BASE).origin;
    const res = await fetch(origin + '/ytlive?channel=' + ch.channelId,
      { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.videoId) console.info('[YT] Data API live resolved:', data.videoId);
    else console.info('[YT] Data API: no live stream found (or key not set)');
    return data.videoId || null;
  } catch (_) {
    return null;
  }
}

function kickYouTubePlayer(iframe) {
  if (!iframe || !iframe.contentWindow) return;

  let tries = 0;
  const maxTries = 10;
  const timer = setInterval(() => {
    tries += 1;
    if (!iframe.contentWindow) {
      clearInterval(timer);
      return;
    }

    try {
      iframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'mute',
        args: [],
      }), '*');

      iframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'playVideo',
        args: [],
      }), '*');
    } catch (e) {
      clearInterval(timer);
    }

    if (tries >= maxTries) clearInterval(timer);
  }, 1200);
}

function attachControls(w, ch, iframe, sourceList) {
  // チャンネル切替時は旧コントロールを除去して作り直す
  w.querySelectorAll('.yt-ctrl-row, .yt-ctrl-note').forEach(el => el.remove());

  const controls = document.createElement('div');
  controls.className = 'yt-ctrl-row';
  controls.style.display = 'flex';
  controls.style.flexWrap = 'wrap';
  controls.style.gap = '6px';
  controls.style.justifyContent = 'flex-end';
  controls.style.padding = '6px 8px';
  controls.style.background = 'rgba(255,255,255,0.02)';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'yt-retry-btn';
  retryBtn.textContent = '再試行';
  retryBtn.style.padding = '3px 10px';

  const switchBtn = document.createElement('button');
  switchBtn.type = 'button';
  switchBtn.className = 'yt-retry-btn';
  switchBtn.textContent = 'ソース切替';
  switchBtn.style.padding = '3px 10px';

  const ytLink = document.createElement('a');
  ytLink.href = ch.youtubeUrl;
  ytLink.target = '_blank';
  ytLink.rel = 'noopener';
  ytLink.className = 'yt-error-link';
  ytLink.textContent = '▶ YouTubeで視聴';
  ytLink.style.padding = '3px 8px';
  ytLink.style.fontSize = '9px';

  const officialLink = document.createElement('a');
  officialLink.href = ch.officialUrl;
  officialLink.target = '_blank';
  officialLink.rel = 'noopener';
  officialLink.className = 'yt-error-link';
  officialLink.textContent = '▶ 公式サイトで視聴';
  officialLink.style.padding = '3px 8px';
  officialLink.style.fontSize = '9px';

  controls.append(retryBtn, switchBtn, ytLink, officialLink);

  const note = document.createElement('div');
  note.style.padding = '4px 10px';
  note.style.fontSize = '9px';
  note.style.color = '#7e90a6';
  note.style.lineHeight = '1.4';
  note.style.borderTop = '1px solid rgba(26,42,74,0.7)';
  note.className = 'yt-ctrl-note';
  note.textContent = '埋め込み再生不可の環境では、上の「YouTubeで視聴」または「公式サイトで視聴」をご利用ください。';

  w.appendChild(controls);
  w.appendChild(note);

  let sourceIndex = 0;
  const currentSrc = iframe.getAttribute('src') || iframe.src || '';
  const matchedIndex = sourceList.findIndex(src => currentSrc.startsWith(src.split('&')[0]));
  if (matchedIndex >= 0) sourceIndex = matchedIndex;

  function setSource(index) {
    sourceIndex = (index + sourceList.length) % sourceList.length;
    iframe.src = sourceList[sourceIndex];
  }

  iframe.addEventListener('load', () => {
    kickYouTubePlayer(iframe);
  });

  // Initial kick for already loaded states.
  kickYouTubePlayer(iframe);

  retryBtn.addEventListener('click', () => {
    setSource(sourceIndex + 1);
  });

  switchBtn.addEventListener('click', () => {
    setSource(sourceIndex + 1);
  });

  w.dataset.ytControlsAttached = '1';
}

async function setEmbed(ch) {
  const w = document.getElementById(ch.wrapperId);
  if (!w) return;

  const liveId = await fetchLiveVideoId(ch);
  const sourceList = buildSourceList(ch, liveId);
  const srcPrimary = sourceList[0];

  const existingFrame = w.querySelector('iframe');
  if (existingFrame) {
    const currentSrc = existingFrame.getAttribute('src') || '';
    if (currentSrc !== srcPrimary) {
      existingFrame.src = srcPrimary;
    }
    const lbl = w.querySelector('.yt-embed-label');
    if (lbl) lbl.innerHTML = `${ch.label} <span style="font-size:10px;color:#88aa88">[字幕: 自動ON]</span>`;

    attachControls(w, ch, existingFrame, sourceList);
    return;
  }

  w.innerHTML = `
    <div class="yt-embed-label">${ch.label} <span style="font-size:10px;color:#88aa88">[字幕: 自動ON]</span></div>
    <iframe
      src="${srcPrimary}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      class="yt-iframe"
      referrerpolicy="strict-origin-when-cross-origin"
      title="${ch.label}">
    </iframe>
    <div style="text-align:right;padding:2px 6px">
      <a href="${ch.youtubeUrl}" target="_blank" rel="noopener"
         style="font-size:9px;color:#3a5a8a;text-decoration:none">
        ▶ YouTubeで視聴
      </a>
    </div>`;

  const iframe = w.querySelector('iframe.yt-iframe');
  if (iframe) {
    attachControls(w, ch, iframe, sourceList);
  }
}

function wireChannelTabs() {
  document.querySelectorAll('.yt-ch-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.ch, 10);
      if (isNaN(idx) || !YT_CHANNELS[idx]) return;
      document.querySelectorAll('.yt-ch-tab').forEach(b => b.classList.toggle('on', b === btn));
      setEmbed(YT_CHANNELS[idx]);
    });
  });
}

/* メインのタブ切替プレイヤー(ABC等)とは別に、
   Al Jazeera Englishを常設2枠目として独立に解決・埋め込みする */
const ALJAZEERA_FIXED = {
  wrapperId:  'yt-wrap-aljazeera',
  channelId:  'UCNye-wNBqNL5ZzHSJj3l8Bg',
  liveVideoId: null,
  label:      '▶ Al Jazeera English Live',
  youtubeUrl: 'https://www.youtube.com/@AlJazeeraEnglish/live',
  officialUrl:'https://www.aljazeera.com/live/',
};

function initYoutubeLive() {
  setEmbed(YT_CHANNELS[0]);
  setEmbed(ALJAZEERA_FIXED);
  wireChannelTabs();
}

document.addEventListener('DOMContentLoaded', initYoutubeLive);
