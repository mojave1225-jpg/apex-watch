/* ============================================================
   APEX WATCH — 南西諸島・台湾海峡 GDELT地域メディア監視 v1
   本体のgdelt.jsと同じ設計(直列実行・レート制限検知・Worker
   フォールバック)で、対象を台湾海峡・南西諸島関連の報道に限定。
   ============================================================ */

const GDELT_REGION_QUERY = encodeURIComponent(
  '(taiwan OR "taiwan strait" OR senkaku OR okinawa OR "south china sea")'
);
const GR_DOC_URL  = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + GDELT_REGION_QUERY
  + '&mode=ArtList&maxrecords=20&sort=datedesc&format=json&timespan=1d';
const GR_TONE_URL = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + GDELT_REGION_QUERY
  + '&mode=timelinetone&format=json&timespan=7d';
const GR_REFRESH_MS = 15 * 60 * 1000;
const GR_GAP_MS = 6500; // GDELTレート制限(5秒/回)対策の直列間隔

const grState = {
  articles: [],
  score: null,
  toneRecent: null,
  toneBaseline: null,
  lastFetch: null,
};

async function grFetchJson(url, timeoutMs = 12000) {
  async function once(u) {
    const res = await fetch(u, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    // レート制限: GDELT直接は200+テキスト、Worker経由は429で返る
    if (res.status === 429 || text.includes('Please limit requests')) {
      const err = new Error('rate-limited');
      err.rateLimited = true;
      throw err;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    // GDELTはクエリ異常時にHTMLを返すことがあるためガード
    const start = text.indexOf('{');
    if (start === -1) throw new Error('non-JSON response');
    return JSON.parse(text.slice(start));
  }
  /* Worker(エッジキャッシュ15分)を最優先。全訪問者・全タブが同じ
     キャッシュを共有するため、GDELTへの実アクセスが世界全体で
     15分に1回まで削減され、IPレート制限が構造的に発生しなくなる。
     Worker障害時のみ直接アクセスにフォールバック。 */
  const pu = (typeof apexProxyUrl === 'function') ? apexProxyUrl(url) : null;
  if (pu) {
    try {
      return await once(pu);
    } catch (e) {
      if (e.rateLimited) throw e; // 上流制限中は直接も無駄撃ちしない
    }
  }
  return await once(url);
}

function grFmtTime(seendate) {
  if (!seendate || seendate.length < 13) return '--:--';
  const iso = `${seendate.slice(0,4)}-${seendate.slice(4,6)}-${seendate.slice(6,8)}T${seendate.slice(9,11)}:${seendate.slice(11,13)}:00Z`;
  const d = new Date(iso);
  if (isNaN(d)) return '--:--';
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
}

function grRenderPanel() {
  const grid = document.getElementById('gdeltRegionGrid');
  if (!grid) return;
  if (!grState.articles.length) {
    grid.innerHTML = '<div class="gr-placeholder">GDELT地域データ取得中...</div>';
    return;
  }
  grid.innerHTML = grState.articles.slice(0, 12).map(a => `
    <a class="gr-item" href="${a.url}" target="_blank" rel="noopener">
      <span class="gr-time">${grFmtTime(a.seendate)}</span>
      <span class="gr-src">${(a.domain || '').replace(/^www\./,'')}${a.sourcecountry ? ' · ' + a.sourcecountry : ''}</span>
      <span class="gr-title">${(a.title || '(no title)').slice(0, 110)}</span>
    </a>`).join('');
  const status = document.getElementById('gdeltRegionStatus');
  if (status && grState.lastFetch) {
    status.textContent = '最終更新 ' + grState.lastFetch.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }
}

/* 本体と同一式: 25 + (−直近トーン)×6 + (7日平均からの悪化幅)×10 */
function grComputeScore(timeline) {
  const series = timeline?.timeline?.[0]?.data;
  if (!Array.isArray(series) || series.length < 4) return null;
  const values = series.map(p => Number(p.value)).filter(v => !isNaN(v));
  if (values.length < 4) return null;
  const recentN = Math.max(2, Math.ceil(values.length / 7));
  const recent = values.slice(-recentN).reduce((a, b) => a + b, 0) / recentN;
  const baseline = values.reduce((a, b) => a + b, 0) / values.length;
  grState.toneRecent = recent;
  grState.toneBaseline = baseline;
  return Math.max(0, Math.min(100, Math.round(25 + (-recent) * 6 + (baseline - recent) * 10)));
}

function grRenderScore() {
  const el = document.getElementById('gdeltRegionScore');
  const detail = document.getElementById('gdeltRegionDetail');
  if (!el) return;
  if (grState.score == null) { el.textContent = '--'; return; }
  el.textContent = grState.score;
  el.style.color = grState.score >= 80 ? 'var(--lvl-critical, #ff4d7a)'
                 : grState.score >= 60 ? 'var(--lvl-danger, #ff8a3d)'
                 : grState.score >= 40 ? 'var(--lvl-warn, #ffcf4d)' : 'var(--lvl-ok, #35d0e0)';
  if (detail && grState.toneRecent != null) {
    const delta = grState.toneBaseline - grState.toneRecent;
    detail.textContent = `直近トーン ${grState.toneRecent.toFixed(2)} / 7日平均比 ${delta >= 0 ? '悪化' : '改善'} ${Math.abs(delta).toFixed(2)}`;
  }
}

const grSleep = ms => new Promise(r => setTimeout(r, ms));
let grRetryScheduled = false;
let grRunning = false;

async function grTryFetch(url) {
  try {
    return { ok: true, data: await grFetchJson(url) };
  } catch (e) {
    console.warn('[GDELT-R]', e.message, url.slice(0, 80));
    return { ok: false, rateLimited: !!e.rateLimited };
  }
}

async function grRefresh() {
  if (grRunning) return;
  grRunning = true;
  const status = document.getElementById('gdeltRegionStatus');
  let anyOk = false, anyRateLimited = false;

  try {
    if (status) status.textContent = '取得中...';
    const doc = await grTryFetch(GR_DOC_URL);
    if (doc.ok && Array.isArray(doc.data?.articles) && doc.data.articles.length) {
      grState.articles = doc.data.articles;
      grState.lastFetch = new Date();
      grRenderPanel();
      anyOk = true;
    }
    anyRateLimited = anyRateLimited || doc.rateLimited;

    await grSleep(GR_GAP_MS);
    const tone = await grTryFetch(GR_TONE_URL);
    if (tone.ok) {
      const s = grComputeScore(tone.data);
      if (s != null) { grState.score = s; grRenderScore(); anyOk = true; }
    }
    anyRateLimited = anyRateLimited || tone.rateLimited;
  } finally {
    grRunning = false;
  }

  if (!anyOk && status) {
    status.textContent = anyRateLimited ? 'レート制限中(60秒後に再試行)' : 'オフライン(再試行待ち)';
  }
  if (anyRateLimited && !grRetryScheduled) {
    grRetryScheduled = true;
    setTimeout(() => { grRetryScheduled = false; grRefresh(); }, 60000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  /* 本体ページのgdelt.jsと同時に開かれた場合のIP共有レート制限を避けるため
     初回は3秒ずらして開始 */
  setTimeout(grRefresh, 3000);
  setInterval(grRefresh, GR_REFRESH_MS);
});
