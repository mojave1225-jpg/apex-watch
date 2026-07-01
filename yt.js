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
    '?autoplay=1&mute=1&rel=0&modestbranding=1',
    '&playsinline=1',
    '&cc_load_policy=1',
    '&hl=ja',
  ].join('');
}

function setEmbed(ch) {
  const w = document.getElementById(ch.wrapperId);
  if (!w) return;

  const srcNoCookie = buildEmbedSrc(ch, true);
  const srcYoutube = buildEmbedSrc(ch, false);

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
    <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;padding:6px 8px;background:rgba(255,255,255,0.02)">
      <button type="button" class="yt-retry-btn" data-yt-action="retry" style="padding:3px 10px">再試行</button>
      <button type="button" class="yt-retry-btn" data-yt-action="switch" style="padding:3px 10px">埋め込み切替</button>
      <a href="${ch.youtubeUrl}" target="_blank" rel="noopener" class="yt-error-link" style="padding:3px 8px;font-size:9px">
        ▶ YouTubeで視聴
      </a>
      <a href="${ch.officialUrl}" target="_blank" rel="noopener" class="yt-error-link" style="padding:3px 8px;font-size:9px">
        ▶ CBS公式で視聴
      </a>
    </div>
    <div style="padding:4px 10px;font-size:9px;color:#7e90a6;line-height:1.4;border-top:1px solid rgba(26,42,74,0.7)">
      埋め込み再生不可の環境では、上の「YouTubeで視聴」または「CBS公式で視聴」をご利用ください。
    </div>`;

  const iframe = w.querySelector('iframe');
  const retryBtn = w.querySelector('[data-yt-action="retry"]');
  const switchBtn = w.querySelector('[data-yt-action="switch"]');
  let useNoCookie = true;

  retryBtn?.addEventListener('click', () => {
    const current = useNoCookie ? srcNoCookie : srcYoutube;
    iframe.src = current;
  });

  switchBtn?.addEventListener('click', () => {
    useNoCookie = !useNoCookie;
    iframe.src = useNoCookie ? srcNoCookie : srcYoutube;
    switchBtn.textContent = useNoCookie ? '埋め込み切替' : '埋め込み切替(通常)';
  });
}

function initYoutubeLive() {
  YT_CHANNELS.forEach((ch, i) => {
    setTimeout(() => setEmbed(ch), i * 400);
  });
}

document.addEventListener('DOMContentLoaded', initYoutubeLive);
