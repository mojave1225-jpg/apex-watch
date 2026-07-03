/* ============================================================
   APEX WATCH — GDELT 世界メディア監視モジュール v1
   ① GEO 2.0 API  — 紛争関連報道の地理分布 → 脅威マップにレイヤー表示
   ② DOC 2.0 API  — 最新の紛争関連ヘッドライン → 監視パネル
   ③ TimelineTone — 論調(トーン)7日推移 → メディア緊張度スコア
                    → DOOMSDAY INDEX に反映 (重み10%)
   GDELTは15分毎更新・無認証・CORS対応。
   ============================================================ */

const GDELT_GEO_URL  = 'https://api.gdeltproject.org/api/v2/geo/geo?query=theme%3AARMEDCONFLICT&format=geojson&timespan=24H';
const GDELT_DOC_URL  = 'https://api.gdeltproject.org/api/v2/doc/doc?query=theme%3AARMEDCONFLICT&mode=ArtList&maxrecords=14&sort=DateDesc&format=json&timespan=12H';
const GDELT_TONE_URL = 'https://api.gdeltproject.org/api/v2/doc/doc?query=theme%3AARMEDCONFLICT&mode=TimelineTone&format=json&timespan=7D';
const GDELT_REFRESH_MS = 15 * 60 * 1000; // GDELTの更新周期に合わせ15分

const gdeltState = {
  map: null,          // { svg, projection, W, H }
  layerG: null,       // d3 selection of #gdelt-layer
  geoFeatures: [],
  articles: [],
  score: null,
  toneRecent: null,
  toneBaseline: null,
  lastFetch: null,
};

/* ── 共通fetch(直接 → 自前プロキシの順) ── */
async function gdeltFetchJson(url, timeoutMs = 12000) {
  async function once(u) {
    const res = await fetch(u, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    // GDELTはクエリ異常時にHTMLを返すことがあるためガード
    const start = text.indexOf('{');
    if (start === -1) throw new Error('non-JSON response');
    return JSON.parse(text.slice(start));
  }
  try {
    return await once(url);
  } catch (e) {
    const pu = (typeof apexProxyUrl === 'function') ? apexProxyUrl(url) : null;
    if (!pu) throw e;
    return await once(pu);
  }
}

/* ============================================================
   ① マップレイヤー
   ============================================================ */
function gdeltEnsureLayer() {
  if (gdeltState.layerG || !gdeltState.map) return;
  const { svg } = gdeltState.map;
  // cyber-layerの直後(=スキャンライン等オーバーレイの下)に挿入
  const cyber = svg.select('#cyber-layer');
  gdeltState.layerG = cyber.empty()
    ? svg.append('g').attr('id', 'gdelt-layer')
    : d3.select(cyber.node().parentNode.insertBefore(
        document.createElementNS('http://www.w3.org/2000/svg', 'g'),
        cyber.node().nextSibling));
  gdeltState.layerG.attr('id', 'gdelt-layer');
}

function gdeltRenderMapLayer() {
  if (!gdeltState.map) return;
  gdeltEnsureLayer();
  const { projection } = gdeltState.map;
  const g = gdeltState.layerG;
  if (!g) return;

  // 表示負荷を抑えるため報道量上位120地点に制限
  const feats = gdeltState.geoFeatures
    .filter(f => f && f.geometry && Array.isArray(f.geometry.coordinates))
    .sort((a, b) => (b.properties?.count || 0) - (a.properties?.count || 0))
    .slice(0, 120);

  const maxCount = Math.max(1, ...feats.map(f => f.properties?.count || 1));
  const r = c => 1.5 + Math.sqrt((c || 1) / maxCount) * 6.5;

  const sel = g.selectAll('circle.gdelt-point')
    .data(feats, f => (f.properties?.name || '') + f.geometry.coordinates.join(','));

  sel.exit().remove();

  const entered = sel.enter()
    .append('circle')
    .attr('class', 'gdelt-point');
  entered.append('title'); // ツールチップは生成時に1つだけ

  const all = entered.merge(sel);
  all
    .attr('cx', f => {
      const p = projection(f.geometry.coordinates);
      return p ? p[0] : -100;
    })
    .attr('cy', f => {
      const p = projection(f.geometry.coordinates);
      return p ? p[1] : -100;
    })
    .attr('r', f => r(f.properties?.count));
  all.select('title')
    .text(f => `${f.properties?.name || '不明'} — 報道 ${f.properties?.count || '?'} 件 (24h)`);

  // トグルの現在状態を反映
  const chk = document.querySelector('.map-layer-chip[data-layer="gdelt-layer"]');
  if (chk && !chk.classList.contains('chip-on')) g.style('display', 'none');
}

/* ============================================================
   ② ヘッドラインパネル
   ============================================================ */
function gdeltFmtTime(seendate) {
  // "20260703T081500Z" → "07/03 17:15" (JST)
  if (!seendate || seendate.length < 13) return '--:--';
  const iso = `${seendate.slice(0,4)}-${seendate.slice(4,6)}-${seendate.slice(6,8)}T${seendate.slice(9,11)}:${seendate.slice(11,13)}:00Z`;
  const d = new Date(iso);
  if (isNaN(d)) return '--:--';
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
}

function gdeltRenderPanel() {
  const grid = document.getElementById('gdeltGrid');
  const status = document.getElementById('gdeltStatus');
  if (!grid) return;

  if (!gdeltState.articles.length) {
    grid.innerHTML = '<div class="news-placeholder">GDELTデータ取得中...</div>';
    return;
  }

  grid.innerHTML = gdeltState.articles.map(a => `
    <a class="gdelt-item" href="${a.url}" target="_blank" rel="noopener">
      <span class="gdelt-time">${gdeltFmtTime(a.seendate)}</span>
      <span class="gdelt-src">${(a.domain || '').replace(/^www\./,'')}${a.sourcecountry ? ' · ' + a.sourcecountry : ''}</span>
      <span class="gdelt-title">${(a.title || '(no title)').slice(0, 120)}</span>
    </a>`).join('');

  if (status) {
    status.textContent = gdeltState.lastFetch
      ? '最終更新 ' + gdeltState.lastFetch.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      : '';
  }
}

/* ============================================================
   ③ メディア緊張度スコア → DOOMSDAY INDEX
   スコア = 25 + (−直近トーン)×6 + (基準トーン − 直近トーン)×10
   ・トーンは負値ほどネガティブ報道(紛争時 -4〜-8 程度)
   ・第2項: 報道の絶対的ネガティブさ
   ・第3項: 7日平均からの悪化幅(急変検知)
   ============================================================ */
function gdeltComputeScore(timeline) {
  const series = timeline?.timeline?.[0]?.data;
  if (!Array.isArray(series) || series.length < 4) return null;
  const values = series.map(p => Number(p.value)).filter(v => !isNaN(v));
  if (values.length < 4) return null;

  const recentN = Math.max(2, Math.ceil(values.length / 7)); // 直近≒1日分
  const recent = values.slice(-recentN).reduce((a, b) => a + b, 0) / recentN;
  const baseline = values.reduce((a, b) => a + b, 0) / values.length;

  gdeltState.toneRecent = recent;
  gdeltState.toneBaseline = baseline;

  const score = Math.round(25 + (-recent) * 6 + (baseline - recent) * 10);
  return Math.max(0, Math.min(100, score));
}

function gdeltRenderScore() {
  const el = document.getElementById('gdeltScore');
  const detail = document.getElementById('gdeltScoreDetail');
  if (!el) return;
  if (gdeltState.score == null) { el.textContent = '--'; return; }
  el.textContent = gdeltState.score;
  el.style.color = gdeltState.score >= 80 ? 'var(--accent-red)'
                 : gdeltState.score >= 60 ? 'var(--accent-orange)'
                 : gdeltState.score >= 40 ? 'var(--accent-yellow)' : 'var(--accent-green)';
  if (detail && gdeltState.toneRecent != null) {
    const delta = gdeltState.toneBaseline - gdeltState.toneRecent;
    detail.textContent = `直近トーン ${gdeltState.toneRecent.toFixed(2)} / 7日平均比 ${delta >= 0 ? '悪化' : '改善'} ${Math.abs(delta).toFixed(2)}`;
  }
}

/* ============================================================
   メインループ
   ============================================================ */
async function gdeltRefresh() {
  const results = await Promise.allSettled([
    gdeltFetchJson(GDELT_GEO_URL, 15000),
    gdeltFetchJson(GDELT_DOC_URL),
    gdeltFetchJson(GDELT_TONE_URL),
  ]);

  const [geo, doc, tone] = results;

  if (geo.status === 'fulfilled' && Array.isArray(geo.value?.features)) {
    gdeltState.geoFeatures = geo.value.features;
    gdeltRenderMapLayer();
  }
  if (doc.status === 'fulfilled' && Array.isArray(doc.value?.articles)) {
    gdeltState.articles = doc.value.articles;
  }
  if (tone.status === 'fulfilled') {
    const s = gdeltComputeScore(tone.value);
    if (s != null) {
      gdeltState.score = s;
      // DOOMSDAY INDEXへ反映 (app.js側のフックを使用)
      if (typeof window.setGdeltScore === 'function') window.setGdeltScore(s);
    }
  }

  gdeltState.lastFetch = new Date();
  gdeltRenderPanel();
  gdeltRenderScore();

  const status = document.getElementById('gdeltStatus');
  const failed = results.filter(r => r.status === 'rejected').length;
  if (status && failed === results.length) status.textContent = 'オフライン(再試行待ち)';
}

/* ── マップレイヤートグル配線 ── */
function gdeltWireLayerToggles() {
  document.querySelectorAll('.map-layer-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const on = chip.classList.toggle('chip-on');
      const sel = chip.dataset.layer;
      const node = document.getElementById(sel) || document.querySelector('.' + sel);
      if (node) node.style.display = on ? '' : 'none';
    });
  });
}

/* ── 起動 ── */
document.addEventListener('apexMapReady', (e) => {
  gdeltState.map = e.detail;
  gdeltEnsureLayer();
  if (gdeltState.geoFeatures.length) gdeltRenderMapLayer();
});

document.addEventListener('DOMContentLoaded', () => {
  // マップ初期化がこのスクリプトより先に完了していた場合に対応
  if (!gdeltState.map && window.__APEX_MAP) {
    gdeltState.map = window.__APEX_MAP;
    gdeltEnsureLayer();
  }
  gdeltWireLayerToggles();
  gdeltRefresh();
  setInterval(gdeltRefresh, GDELT_REFRESH_MS);
});
