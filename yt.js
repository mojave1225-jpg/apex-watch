/* ============================================================
   YouTube Live Stream Loader v5
   Direct channel embed — no Invidious API dependency.
   YouTube resolves live_stream?channel= to the current live
   video internally, so no video ID lookup is needed.
   ============================================================ */

const YT_CHANNELS = [
  {
    wrapperId:  'yt-wrap-cbs',
    channelId:  'UC8p1vwvWtl6T73JiExfWs1g',  // CBS News official channel
    label:      '▶ CBS News 24/7',
    youtubeUrl: 'https://www.youtube.com/@CBSNews/live',
    officialUrl:'https://www.cbsnews.com/live/',
  },
];

function buildEmbedSrc(ch, useNoCookie) {
  const host = useNoCookie
    ? 'https://www.youtube-nocookie.com'
    : 'https://www.youtube.com';

  return [
    `${host}/embed/live_stream?channel=${ch.channelId}`,
    '&autoplay=1&mute=1&rel=0&modestbranding=1',
    '&playsinline=1',
    '&cc_load_policy=1',
    '&hl=ja',
  ].join('');
}

function attachControls(w, ch, iframe, srcNoCookie, srcYoutube) {
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
  switchBtn.textContent = '埋め込み切替';
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

  let useNoCookie = (iframe.src || '').includes('youtube-nocookie.com');

  retryBtn.addEventListener('click', () => {
    iframe.src = useNoCookie ? srcNoCookie : srcYoutube;
  });

  switchBtn.addEventListener('click', () => {
    useNoCookie = !useNoCookie;
    iframe.src = useNoCookie ? srcNoCookie : srcYoutube;
    switchBtn.textContent = useNoCookie ? '埋め込み切替' : '埋め込み切替(通常)';
  });

  w.dataset.ytControlsAttached = '1';
}

function setEmbed(ch) {
  const w = document.getElementById(ch.wrapperId);
  if (!w) return;

  const srcNoCookie = buildEmbedSrc(ch, true);
  const srcYoutube = buildEmbedSrc(ch, false);

  const existingFrame = w.querySelector('iframe');
  if (existingFrame) {
    attachControls(w, ch, existingFrame, srcNoCookie, srcYoutube);
    return;
  }

  w.innerHTML = `
    <div class="yt-embed-label">${ch.label} <span style="font-size:10px;color:#88aa88">[字幕: 自動ON]</span></div>
    <iframe
      src="${srcNoCookie}"
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
    attachControls(w, ch, iframe, srcNoCookie, srcYoutube);
  }
}

function initYoutubeLive() {
  YT_CHANNELS.forEach((ch, i) => {
    setTimeout(() => setEmbed(ch), i * 400);
  });
}

document.addEventListener('DOMContentLoaded', initYoutubeLive);
