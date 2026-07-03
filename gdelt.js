/* ============================================================
   APEX WATCH — GDELT 世界メディア監視モジュール v1
   ① GEO 2.0 API  — 紛争関連報道の地理分布 → 脅威マップにレイヤー表示
   ② DOC 2.0 API  — 最新の紛争関連ヘッドライン → 監視パネル
   ③ TimelineTone — 論調(トーン)7日推移 → メディア緊張度スコア
                    → DOOMSDAY INDEX に反映 (重み10%)
   GDELTは15分毎更新・無認証・CORS対応。
   ============================================================ */

/* GEO 2.0 APIは廃止(404)されたため、DOC APIの記事を発信国別に集計して
   マップレイヤーを描画する方式に変更。maxrecordsを75に増やし集計精度を確保
   (APIリクエスト数は変わらず1本)。パネル表示は先頭14件のみ。 */
const GDELT_DOC_URL  = 'https://api.gdeltproject.org/api/v2/doc/doc?query=theme%3AARMEDCONFLICT&mode=ArtList&maxrecords=75&sort=datedesc&format=json&timespan=1d';
const GDELT_TONE_URL = 'https://api.gdeltproject.org/api/v2/doc/doc?query=theme%3AARMEDCONFLICT&mode=timelinetone&format=json&timespan=7d';
const GDELT_REFRESH_MS = 15 * 60 * 1000; // GDELTの更新周期に合わせ15分
/* GDELT sourcecountry名 → 地図座標 [経度, 緯度](主要約90カ国) */
const GDELT_COUNTRY_COORDS = {
  'United States': [-98, 39], 'United Kingdom': [-2, 53], 'Canada': [-102, 57],
  'Australia': [134, -25], 'New Zealand': [172, -42], 'Ireland': [-8, 53],
  'India': [79, 22], 'Pakistan': [69, 30], 'Bangladesh': [90, 24],
  'Sri Lanka': [81, 8], 'Nepal': [84, 28], 'Afghanistan': [66, 34],
  'China': [104, 35], 'Japan': [138, 37], 'South Korea': [128, 36],
  'North Korea': [127, 40], 'Taiwan': [121, 24], 'Hong Kong': [114, 22],
  'Philippines': [122, 12], 'Indonesia': [117, -2], 'Malaysia': [102, 4],
  'Singapore': [104, 1], 'Thailand': [101, 15], 'Vietnam': [106, 16],
  'Myanmar': [96, 21], 'Cambodia': [105, 12], 'Laos': [103, 18],
  'Russia': [95, 61], 'Ukraine': [31, 49], 'Belarus': [28, 53],
  'Poland': [19, 52], 'Germany': [10, 51], 'France': [2, 47],
  'Spain': [-4, 40], 'Portugal': [-8, 39], 'Italy': [12, 43],
  'Netherlands': [5, 52], 'Belgium': [4, 51], 'Switzerland': [8, 47],
  'Austria': [14, 47], 'Czech Republic': [15, 50], 'Slovakia': [19, 48],
  'Hungary': [19, 47], 'Romania': [25, 46], 'Bulgaria': [25, 43],
  'Greece': [22, 39], 'Serbia': [21, 44], 'Croatia': [16, 45],
  'Slovenia': [15, 46], 'Sweden': [15, 62], 'Norway': [9, 61],
  'Denmark': [10, 56], 'Finland': [26, 64], 'Estonia': [26, 59],
  'Latvia': [25, 57], 'Lithuania': [24, 55], 'Iceland': [-18, 65],
  'Moldova': [29, 47], 'Georgia': [43, 42], 'Armenia': [45, 40],
  'Azerbaijan': [48, 40], 'Kazakhstan': [67, 48], 'Uzbekistan': [64, 41],
  'Turkey': [35, 39], 'Israel': [35, 31], 'Palestine': [35, 32],
  'Lebanon': [36, 34], 'Syria': [38, 35], 'Jordan': [37, 31],
  'Iraq': [44, 33], 'Iran': [54, 32], 'Saudi Arabia': [45, 24],
  'Yemen': [48, 15], 'Qatar': [51, 25], 'United Arab Emirates': [54, 24],
  'Kuwait': [48, 29], 'Egypt': [30, 27], 'Libya': [17, 27],
  'Algeria': [3, 28], 'Morocco': [-6, 32], 'Tunisia': [9, 34],
  'Sudan': [30, 15], 'Ethiopia': [39, 9], 'Somalia': [46, 6],
  'Kenya': [38, 0], 'Uganda': [32, 1], 'Tanzania': [35, -6],
  'Rwanda': [30, -2], 'Nigeria': [8, 9], 'Ghana': [-1, 8],
  'Ivory Coast': [-5, 8], 'Senegal': [-14, 14], 'Cameroon': [12, 5],
  'Democratic Republic of the Congo': [23, -3], 'South Africa': [25, -29],
  'Zimbabwe': [30, -19], 'Zambia': [28, -14], 'Mozambique': [35, -18],
  'Mali': [-4, 17], 'Niger': [9, 17], 'Chad': [19, 15],
  'Mexico': [-102, 24], 'Brazil': [-53, -11], 'Argentina': [-64, -35],
  'Colombia': [-73, 4], 'Venezuela': [-66, 7], 'Chile': [-71, -33],
  'Peru': [-76, -10], 'Ecuador': [-78, -1], 'Bolivia': [-64, -17],
  'Cuba': [-79, 22], 'Haiti': [-72, 19],
};

const gdeltState = {
  map: null,          // { svg, projection, W, H }
  layerG: null,       // d3 selection of #gdelt-layer
  countryAgg: [],   // [{name, count, coords:[lon,lat]}]
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
    // レート制限(5秒に1回)の応答はプレーンテキスト
    if (text.includes('Please limit requests')) {
      const err = new Error('rate-limited');
      err.rateLimited = true;
      throw err;
    }
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

  const items = gdeltState.countryAgg;
  if (!items.length) return;

  const maxCount = Math.max(1, ...items.map(d => d.count));
  const r = c => 3 + Math.sqrt(c / maxCount) * 9;

  const sel = g.selectAll('circle.gdelt-point')
    .data(items, d => d.name);

  sel.exit().remove();

  const entered = sel.enter()
    .append('circle')
    .attr('class', 'gdelt-point');
  entered.append('title'); // ツールチップは生成時に1つだけ

  const all = entered.merge(sel);
  all
    .attr('cx', d => {
      const p = projection(d.coords);
      return p ? p[0] : -100;
    })
    .attr('cy', d => {
      const p = projection(d.coords);
      return p ? p[1] : -100;
    })
    .attr('r', d => r(d.count));
  all.select('title')
    .text(d => `${d.name} — 紛争関連報道 ${d.count}件 / 発信国別・直近24h`);

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

  grid.innerHTML = gdeltState.articles.slice(0, 14).map(a => `
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
  el.style.color = gdeltState.score >= 80 ? 'var(--lvl-critical)'
                 : gdeltState.score >= 60 ? 'var(--lvl-danger)'
                 : gdeltState.score >= 40 ? 'var(--lvl-warn)' : 'var(--lvl-ok)';
  if (detail && gdeltState.toneRecent != null) {
    const delta = gdeltState.toneBaseline - gdeltState.toneRecent;
    detail.textContent = `直近トーン ${gdeltState.toneRecent.toFixed(2)} / 7日平均比 ${delta >= 0 ? '悪化' : '改善'} ${Math.abs(delta).toFixed(2)}`;
  }
}

/* ============================================================
   メインループ
   ============================================================ */
/* GDELTはIPあたり5秒に1回のレート制限があるため、3本のAPIを
   6.5秒間隔で直列実行する。制限検知時は60秒後に自動再試行。 */
const GDELT_GAP_MS = 6500;
const gdeltSleep = ms => new Promise(r => setTimeout(r, ms));
let gdeltRetryScheduled = false;
let gdeltRunning = false;

async function gdeltTryFetch(url, timeoutMs) {
  try {
    return { ok: true, data: await gdeltFetchJson(url, timeoutMs) };
  } catch (e) {
    console.warn('[GDELT]', e.message, url.slice(0, 80));
    return { ok: false, rateLimited: !!e.rateLimited };
  }
}

async function gdeltRefresh() {
  if (gdeltRunning) return; // 多重実行防止
  gdeltRunning = true;
  const status = document.getElementById('gdeltStatus');
  let anyOk = false, anyRateLimited = false;

  try {
    // ① ヘッドライン(最も目に付くので先行)
    if (status) status.textContent = '取得中...';
    const doc = await gdeltTryFetch(GDELT_DOC_URL);
    if (doc.ok && Array.isArray(doc.data?.articles) && doc.data.articles.length) {
      gdeltState.articles = doc.data.articles;
      gdeltState.lastFetch = new Date();
      gdeltRenderPanel();

      // 発信国別に集計してマップレイヤー用データを構築
      const agg = {};
      const unknown = new Set();
      doc.data.articles.forEach(a => {
        const c = a.sourcecountry;
        if (!c) return;
        if (GDELT_COUNTRY_COORDS[c]) agg[c] = (agg[c] || 0) + 1;
        else unknown.add(c);
      });
      gdeltState.countryAgg = Object.entries(agg)
        .map(([name, count]) => ({ name, count, coords: GDELT_COUNTRY_COORDS[name] }));
      if (unknown.size) console.info('[GDELT] 座標テーブル未登録の発信国:', [...unknown].join(', '));
      gdeltRenderMapLayer();
      anyOk = true;
    }
    anyRateLimited = anyRateLimited || doc.rateLimited;

    // ② トーン → 緊張度スコア
    await gdeltSleep(GDELT_GAP_MS);
    const tone = await gdeltTryFetch(GDELT_TONE_URL);
    if (tone.ok) {
      const s = gdeltComputeScore(tone.data);
      if (s != null) {
        gdeltState.score = s;
        if (typeof window.setGdeltScore === 'function') window.setGdeltScore(s);
        gdeltRenderScore();
        anyOk = true;
      }
    }
    anyRateLimited = anyRateLimited || tone.rateLimited;

    // ③ 地図レイヤーは①の記事データから国別集計で生成(追加リクエスト不要)
  } finally {
    gdeltRunning = false;
  }

  if (anyOk) {
    gdeltState.lastFetch = new Date();
    gdeltRenderPanel();
  } else if (status) {
    status.textContent = anyRateLimited ? 'レート制限中(60秒後に再試行)' : 'オフライン(再試行待ち)';
  }

  // レート制限を検知したら一度だけ60秒後に再実行
  if (anyRateLimited && !gdeltRetryScheduled) {
    gdeltRetryScheduled = true;
    setTimeout(() => { gdeltRetryScheduled = false; gdeltRefresh(); }, 60000);
  }
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
  if (gdeltState.countryAgg.length) gdeltRenderMapLayer();
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
