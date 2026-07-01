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
  },
];

function setEmbed(ch) {
  const w = document.getElementById(ch.wrapperId);
  if (!w) return;
  const src = [
    `https://www.youtube-nocookie.com/embed/live_stream?channel=${ch.channelId}`,
    '?autoplay=1&mute=1&rel=0&modestbranding=1',
    '&playsinline=1',
    '&cc_load_policy=1',          // 字幕を有効にする
    '&hl=ja',                     // インターフェース言語を日本語に
  ].join('');

  w.innerHTML = `
    <div class="yt-embed-label">${ch.label} <span style="font-size:10px;color:#88aa88">[字幕: 自動ON]</span></div>
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
