/* ============================================================
   YouTube Live Stream Loader v6.2
   ライブ動画IDを実行時に解決する方式:
   自前Workerプロキシ経由で /live ページを取得し、canonical の
   watch?v=ID から現在のライブ配信IDを抽出して直接埋め込む。
   (live_stream?channel= 方式はYouTube側で不安定化しているため
    フォールバックに降格)
   ============================================================ */

const YT_CHANNELS = [
  {
    wrapperId:  'yt-wrap-cbs',
    channelId:  'UC8p1vwvWtl6T73JiExfWs1g',  // CBS News official channel
    liveVideoId:'zvMSZFgWYBA',              // CBS 24/7 stream fallback
    label:      '▶ CBS News 24/7',
    youtubeUrl: 'https://www.youtube.com/@CBSNews/live',
    officialUrl:'https://www.cbsnews.com/live/',
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

function buildSourceList(ch, resolvedLive) {
  if (resolvedLive) {
    // 現在のライブIDを解決できた場合はそれを最優先
    const live = { ...ch, liveVideoId: resolvedLive };
    return [
      buildEmbedSrc(live, false, 'video'),
      buildEmbedSrc(live, true,  'video'),
      buildEmbedSrc(ch,   false, 'channel'),
      buildEmbedSrc(ch,   true,  'channel'),
    ];
  }
  // 解決失敗時: 従来どおり固定動画を優先(channel方式は不安定なため保険に降格)
  return [
    buildEmbedSrc(ch, false, 'video'),
    buildEmbedSrc(ch, false, 'channel'),
    buildEmbedSrc(ch, true,  'channel'),
    buildEmbedSrc(ch, true,  'video'),
  ];
}

/* /live ページから現在のライブ動画IDを解決(Workerプロキシ経由) */
async function resolveLiveVideoId(ch) {
  if (typeof apexProxyUrl !== 'function') return null;
  const pu = apexProxyUrl(ch.youtubeUrl);
  if (!pu) return null;
  try {
    const res = await fetch(pu, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const html = await res.text();

    // ライブ配信フラグ(どれか1つで可)
    const isLive =
      /"isLiveNow"\s*:\s*true/.test(html) ||
      /"isLiveContent"\s*:\s*true/.test(html) ||
      /"isLive"\s*:\s*true/.test(html);

    // 動画IDの抽出(確度の高い順に試行)
    const m =
      // ① canonical(パラメータ付き・引用符差異も許容)
      html.match(/rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/) ||
      // ② プレイヤーのvideoDetails
      html.match(/"videoDetails"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/) ||
      // ③ 最初のvideoId(最終手段)
      html.match(/"videoId"\s*:\s*"([\w-]{11})"/);

    if (!m) {
      console.info('[YT] resolve: no videoId in page (isLive flag:', isLive, ')');
      return null;
    }
    if (!isLive) {
      console.info('[YT] resolve: videoId found but no live flag, skipping:', m[1]);
      return null;
    }
    console.info('[YT] live video resolved:', m[1]);
    return m[1];
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
  if (w.dataset.ytControlsAttached === '1') return;

  const controls = document.createElement('div');
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
  officialLink.textContent = '▶ CBS公式で視聴';
  officialLink.style.padding = '3px 8px';
  officialLink.style.fontSize = '9px';

  controls.append(retryBtn, switchBtn, ytLink, officialLink);

  const note = document.createElement('div');
  note.style.padding = '4px 10px';
  note.style.fontSize = '9px';
  note.style.color = '#7e90a6';
  note.style.lineHeight = '1.4';
  note.style.borderTop = '1px solid rgba(26,42,74,0.7)';
  note.textContent = '埋め込み再生不可の環境では、上の「YouTubeで視聴」または「CBS公式で視聴」をご利用ください。';

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

  const resolvedLive = await resolveLiveVideoId(ch);
  const sourceList = buildSourceList(ch, resolvedLive);
  const srcPrimary = sourceList[0];

  const existingFrame = w.querySelector('iframe');
  if (existingFrame) {
    const currentSrc = existingFrame.getAttribute('src') || '';
    if (currentSrc !== srcPrimary) {
      existingFrame.src = srcPrimary;
    }

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

function initYoutubeLive() {
  YT_CHANNELS.forEach((ch, i) => {
    setTimeout(() => setEmbed(ch), i * 400);
  });
}

document.addEventListener('DOMContentLoaded', initYoutubeLive);
