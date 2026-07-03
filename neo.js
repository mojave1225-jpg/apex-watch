/* ============================================================
   APEX WATCH — Near-Earth Object (NEO) Alert System
   Data: NASA NeoWs API (api.nasa.gov) — DEMO_KEY
         CORS-enabled. localStorage cache (55 min) prevents
         hitting the 30 req/hr per-IP rate limit.
   Update interval: 60 minutes
   ============================================================ */

const NEO_API_KEY     = 'DEMO_KEY';
const NEO_REFRESH_MS  = 60 * 60 * 1000;
const NEO_WINDOW_DAYS = 7;
const NEO_CACHE_KEY   = 'apex_neo_v1';
const NEO_CACHE_TTL   = 55 * 60 * 1000;   // 55 min — just under DEMO_KEY hour window

// Threat levels by miss distance in Lunar Distances (LD)
const NEO_LEVELS = [
  { max:  1.0, label: 'CRITICAL', ja: '緊急',  cls: 'neo-lv-critical', score: 85, color: '#ff0022' },
  { max:  5.0, label: 'WARNING',  ja: '警告',  cls: 'neo-lv-warning',  score: 60, color: '#ff5500' },
  { max: 10.0, label: 'CAUTION',  ja: '注意',  cls: 'neo-lv-caution',  score: 38, color: '#ffaa00' },
  { max: 20.0, label: 'MONITOR',  ja: '監視',  cls: 'neo-lv-monitor',  score: 22, color: '#0088ff' },
  { max: Infinity, label: 'NOMINAL', ja: '通常', cls: 'neo-lv-nominal', score: 8,  color: '#2a4060' },
];

function neoLevel(ld) {
  return NEO_LEVELS.find(l => ld < l.max) || NEO_LEVELS.at(-1);
}

// ── localStorage cache helpers ─────────────────────────────
function neoReadCache() {
  try {
    const raw = localStorage.getItem(NEO_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return (c && c.neos && c.ts) ? c : null;
  } catch (_) { return null; }
}

function neoWriteCache(neos) {
  try { localStorage.setItem(NEO_CACHE_KEY, JSON.stringify({ ts: Date.now(), neos })); }
  catch (_) {}
}

// ── Fetch + normalise ──────────────────────────────────────
async function fetchNeos() {
  // Serve from cache if fresh (avoids hitting API rate limit on page reload)
  const cached = neoReadCache();
  if (cached && Date.now() - cached.ts < NEO_CACHE_TTL) {
    return { neos: cached.neos, fromCache: true };
  }

  const fmt   = d => d.toISOString().slice(0, 10);
  const start = fmt(new Date());
  const end   = fmt(new Date(Date.now() + NEO_WINDOW_DAYS * 86400000));
  const url   = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${NEO_API_KEY}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });

  // Rate limited — serve stale cache rather than erroring
  if (res.status === 429) {
    if (cached) return { neos: cached.neos, fromCache: true, stale: true };
    throw new Error('レート制限 (429) — 1時間後に再試行');
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const neos = [];
  for (const list of Object.values(json.near_earth_objects || {})) {
    for (const n of list) {
      const ca   = n.close_approach_data?.[0];
      if (!ca) continue;
      const ld   = parseFloat(ca.miss_distance.lunar);
      const km   = parseFloat(ca.miss_distance.kilometers);
      const vel  = parseFloat(ca.relative_velocity.kilometers_per_second);
      const dMin = Math.round(n.estimated_diameter.meters.estimated_diameter_min);
      const dMax = Math.round(n.estimated_diameter.meters.estimated_diameter_max);

      neos.push({
        id:       n.id,
        name:     n.name.replace(/[()]/g, '').trim(),
        dateStr:  ca.close_approach_date,
        dateTime: ca.close_approach_date_full,
        ld, km, vel, dMin, dMax,
        mag: n.absolute_magnitude_h,
        pha: n.is_potentially_hazardous_asteroid,
        jplUrl: n.nasa_jpl_url,
      });
    }
  }

  neos.sort((a, b) => {
    if (a.dateStr !== b.dateStr) return a.dateStr < b.dateStr ? -1 : 1;
    return a.ld - b.ld;
  });

  neoWriteCache(neos);
  return { neos, fromCache: false };
}

// ── Render list ────────────────────────────────────────────
function renderList(neos) {
  const body = document.getElementById('neoListBody');
  if (!body) return;

  if (!neos.length) {
    body.innerHTML = '<div class="neo-empty">この期間の接近天体データなし</div>';
    return;
  }

  body.innerHTML = neos.map(n => {
    const lv    = neoLevel(n.ld);
    const ldStr = n.ld < 10 ? n.ld.toFixed(2) : n.ld.toFixed(1);
    const [datePart, timePart] = n.dateTime.split(' ');
    const dateHtml = timePart
      ? `${datePart}<br><span class="neo-time">${timePart} UTC</span>`
      : datePart;
    const phaHtml = n.pha
      ? '<span class="neo-pha-badge">⚠ PHA</span>'
      : '<span class="neo-pha-none">—</span>';

    return `
<div class="neo-row ${lv.cls}${n.pha ? ' neo-row-pha' : ''}">
  <div class="neo-col neo-col-name">
    <a href="${n.jplUrl}" target="_blank" rel="noopener" class="neo-name-link">${n.name}</a>
  </div>
  <div class="neo-col neo-col-date">${dateHtml}</div>
  <div class="neo-col neo-col-ld">
    <span class="neo-ld-num" style="color:${lv.color}">${ldStr}</span>
    <span class="neo-unit">LD</span>
  </div>
  <div class="neo-col neo-col-km">${neoFmtKm(n.km)}</div>
  <div class="neo-col neo-col-diam">${n.dMin}–${n.dMax} m</div>
  <div class="neo-col neo-col-vel">${n.vel.toFixed(2)} km/s</div>
  <div class="neo-col neo-col-pha">${phaHtml}</div>
  <div class="neo-col neo-col-lv">
    <span class="neo-lv-badge ${lv.cls}">${lv.label}<br><span class="neo-lv-ja">${lv.ja}</span></span>
  </div>
</div>`;
  }).join('');
}

function neoFmtKm(km) {
  if (km >= 1e6) return (km / 1e6).toFixed(2) + ' 百万km';
  if (km >= 1e4) return Math.round(km / 1000) + ',000 km';
  return Math.round(km).toLocaleString() + ' km';
}

// ── Update stats + panel card ──────────────────────────────
function updateStats(neos, { fromCache, stale } = {}) {
  const phas    = neos.filter(n => n.pha);
  const closest = neos.length ? neos.reduce((a, b) => a.ld < b.ld ? a : b) : null;
  const fastest = neos.length ? neos.reduce((a, b) => a.vel > b.vel ? a : b) : null;

  const $   = id => document.getElementById(id);
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

  set('neo-stat-total',        neos.length + ' 件');
  set('neo-stat-pha',          phas.length + ' 件');
  set('neo-stat-closest-ld',   closest ? closest.ld.toFixed(2) + ' LD' : '--');
  set('neo-stat-closest-name', closest ? closest.name : '--');
  set('neo-stat-fastest',      fastest ? fastest.vel.toFixed(1) + ' km/s' : '--');

  const phaEl = $('neo-stat-pha');
  if (phaEl) phaEl.style.color = phas.length > 0 ? 'var(--accent-orange)' : 'var(--accent-green)';

  const closestLdEl = $('neo-stat-closest-ld');
  if (closestLdEl && closest) closestLdEl.style.color = neoLevel(closest.ld).color;

  set('neo-p-total',   neos.length);
  set('neo-p-pha',     phas.length);
  set('neo-p-closest', closest ? closest.ld.toFixed(2) : '--');
  set('neo-p-name',    closest ? closest.name : '--');
  set('neo-p-speed',   fastest ? fastest.vel.toFixed(1) : '--');

  let score = 8;
  if (closest) score = Math.max(score, neoLevel(closest.ld).score);
  if (phas.length > 0) score = Math.min(score + 12, 100);
  score = Math.min(score, 100);

  const scoreEl  = $('score-neo');
  const barEl    = $('bar-neo');
  const statusEl = $('status-neo');
  if (scoreEl) {
    scoreEl.textContent = score;
    scoreEl.style.color = score >= 60 ? 'var(--accent-red)'
                        : score >= 38 ? 'var(--accent-orange)'
                        : score >= 22 ? 'var(--accent-yellow)'
                        : 'var(--accent-green)';
  }
  if (barEl) barEl.style.width = score + '%';
  if (statusEl) {
    statusEl.textContent = stale ? 'キャッシュ' : neos.length + '件';
    statusEl.style.color = stale ? 'var(--accent-yellow)'
                         : phas.length > 0 ? 'var(--accent-orange)'
                         : 'var(--accent-green)';
  }

  const noteEl = $('note-neo');
  if (noteEl) {
    if (phas.length > 0) {
      const cp = phas.reduce((a, b) => a.ld < b.ld ? a : b);
      noteEl.textContent = `⚠ PHA検出: ${cp.name} — ${cp.ld.toFixed(2)} LD (${cp.dateStr})`;
      noteEl.style.color = 'var(--accent-orange)';
    } else {
      noteEl.textContent = fromCache ? 'NASA NeoWs (キャッシュ)' : 'NASA NeoWs API / JPL CNEOS';
      noteEl.style.color = '';
    }
  }

  if (closest && closest.ld < 5.0) {
    const lv      = neoLevel(closest.ld);
    const alertEl = $('alertText');
    if (alertEl && !alertEl.textContent.includes('NEO')) {
      alertEl.textContent = `☄ NEO ${lv.label}: ${closest.name} — ${closest.ld.toFixed(2)} LD に地球接近 (${closest.dateStr}) 速度 ${closest.vel.toFixed(1)} km/s`;
    }
  }
}

// ── Main init + refresh loop ───────────────────────────────
async function initNeoMonitor() {
  const body     = document.getElementById('neoListBody');
  const statusEl = document.getElementById('status-neo');

  if (statusEl) { statusEl.textContent = '取得中'; statusEl.style.color = 'var(--accent-yellow)'; }

  try {
    const { neos, fromCache, stale } = await fetchNeos();
    updateStats(neos, { fromCache, stale });
    renderList(neos);

    window.__NEO_DATA = neos;
    document.dispatchEvent(new CustomEvent('neoDataReady', { detail: { neos } }));

    if (statusEl && !stale) {
      statusEl.textContent = neos.length + '件';
      statusEl.style.color = 'var(--accent-green)';
    }

    const updEl = document.getElementById('neo-last-update');
    if (updEl) {
      const t = new Date();
      const label = fromCache ? 'キャッシュ' : '更新';
      updEl.textContent = `${label}: ${t.getUTCHours().toString().padStart(2,'0')}:${t.getUTCMinutes().toString().padStart(2,'0')} UTC`;
    }

  } catch (err) {
    console.warn('[NEO]', err.message);
    if (body) {
      body.innerHTML = `<div class="neo-empty">
        データ取得失敗 (${err.message}) —
        <a href="https://cneos.jpl.nasa.gov/ca/" target="_blank" class="neo-fallback-link">
          JPL CNEOS で確認
        </a>
      </div>`;
    }
    if (statusEl) { statusEl.textContent = 'エラー'; statusEl.style.color = 'var(--accent-red)'; }
    setTimeout(initNeoMonitor, 5 * 60 * 1000);
    return;
  }

  setTimeout(initNeoMonitor, NEO_REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', initNeoMonitor);
