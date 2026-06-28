/* ============================================================
   YouTube Live Stream Loader v5
   Direct channel embed — no Invidious API dependency.
   YouTube resolves live_stream?channel= to the current live
   video internally, so no video ID lookup is needed.
   ============================================================ */

const YT_CHANNELS = [
  {
    wrapperId:  'yt-wrap-cbs',
    videoId:    'uv5-ars3sAs',               // CBS News 24/7 live stream
    label:      '▶ CBS News 24/7',
    youtubeUrl: 'https://www.youtube.com/@CBSNews/live',
  },
];

function setEmbed(ch) {
  const w = document.getElementById(ch.wrapperId);
  if (!w) return;
  const src = [
    `https://www.youtube.com/embed/${ch.videoId}`,
    '?autoplay=1&mute=1&rel=0&modestbranding=1',
    '&origin=https://apex-watch.jp',
  ].join('');

  w.innerHTML = `
    <div class="yt-embed-label">${ch.label}</div>
    <iframe
      src="${src}"
      frameborder="0"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen
      class="yt-iframe"
      title="${ch.label}">
    </iframe>
    <div style="text-align:right;padding:2px 6px">
      <a href="${ch.youtubeUrl}" target="_blank" rel="noopener"
         style="font-size:9px;color:#3a5a8a;text-decoration:none">
        ▶ YouTubeで視聴
      </a>
    </div>`;
}

function initYoutubeLive() {
  YT_CHANNELS.forEach((ch, i) => {
    setTimeout(() => setEmbed(ch), i * 400);
  });
}

document.addEventListener('DOMContentLoaded', initYoutubeLive);
