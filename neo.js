/* ============================================================
   APEX WATCH — Near-Earth Object (NEO) Alert System
   Data: JPL SSD Close Approach Data API (ssd-api.jpl.nasa.gov)
         Key-free, CORS-enabled, no rate limit for public use.
   Update interval: 60 minutes
   ============================================================ */

const NEO_CAD_API    = 'https://ssd-api.jpl.nasa.gov/cad.api';
const NEO_REFRESH_MS  = 60 * 60 * 1000;
const NEO_WINDOW_DAYS = 7;

// Threat levels by miss distance in Lunar Distances (LD)
// 1 LD = 384,400 km (Moon's average orbital distance)
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

// Month abbreviation → zero-padded number (for YYYY-MM-DD sorting)
const _NEO_MO = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                 Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};

// ── Fetch + normalise ──────────────────────────────────────
async function fetchNeos() {
  const fmt    = d => d.toISOString().slice(0, 10);
  const today  = fmt(new Date());
  const endDay = fmt(new Date(Date.now() + NEO_WINDOW_DAYS * 86400000));
  const url    = `${NEO_CAD_API}?date-min=${today}&date-max=${endDay}&dist-max=0.2&sort=dist&limit=60`;

  const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  if (!Array.isArray(json.fields) || !Array.isArray(json.data)) {
    throw new Error('Invalid JPL response');
  }

  // Field index map: "des"→0, "cd"→3, "dist"→4, "v_rel"→7, "h"→10 etc.
  const fi = {};
  json.fields.forEach((f, i) => fi[f] = i);

  const AU_TO_LD = 1 / 0.00256955529;   // 1 AU ÷ LD_AU = LD count
  const AU_TO_KM = 149597870.7;

  const neos = json.data.map(row => {
    const des    = (row[fi['des']] || '').trim();
    const cd     = (row[fi['cd']]  || '');       // "2026-Jun-21 11:07"
    const distAU = parseFloat(row[fi['dist']]);
    const vRel   = parseFloat(row[fi['v_rel']]);
    const h      = parseFloat(row[fi['h']]);

    if (isNaN(distAU) || isNaN(vRel)) return null;

    const ld = distAU * AU_TO_LD;
    const km = distAU * AU_TO_KM;

    // Estimate diameter from H magnitude (albedo 0.15): D(m) ≈ 1329000/√0.15 × 10^(-H/5)
    const dM   = isNaN(h) ? 0 : (1329000 / Math.sqrt(0.15)) * Math.pow(10, -h / 5);
    const dMin = Math.round(dM * 0.7);
    const dMax = Math.round(dM * 1.3);

    // Convert "2026-Jun-21 11:07" → "2026-06-21" for sorting
    const cdParts = cd.slice(0, 11).split('-');
    const mm      = _NEO_MO[cdParts[1]] || '00';
    const dateStr = `${cdParts[0]}-${mm}-${(cdParts[2] || '').padStart(2, '0')}`;

    // PHA: H < 22 (diameter ≥ ~140 m) AND approach within 0.05 AU (~19.5 LD)
    const pha = !isNaN(h) && h < 22.0 && distAU < 0.05;

    return {
      id:       des,
      name:     des,
      dateStr,
      dateTime: cd,
      ld, km,
      vel: vRel,
      dMin, dMax,
      mag: h,
      pha,
      jplUrl: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(des)}`,
    };
  }).filter(Boolean);

  // Sort: soonest first, then closest
  neos.sort((a, b) => {
    if (a.dateStr !== b.dateStr) return a.dateStr < b.dateStr ? -1 : 1;
    return a.ld - b.ld;
  });

  return neos;
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
    const lv  = neoLevel(n.ld);
    const ldStr = n.ld < 10 ? n.ld.toFixed(2) : n.ld.toFixed(1);

    // Parse date string from API: "2026-Jun-20 14:32" → two parts
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
function updateStats(neos) {
  const phas    = neos.filter(n => n.pha);
  const closest = neos.length ? neos.reduce((a, b) => a.ld < b.ld ? a : b) : null;
  const fastest = neos.length ? neos.reduce((a, b) => a.vel > b.vel ? a : b) : null;

  const $  = id => document.getElementById(id);
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };

  // Section summary row
  set('neo-stat-total',    neos.length + ' 件');
  set('neo-stat-pha',      phas.length + ' 件');
  set('neo-stat-closest-ld', closest ? closest.ld.toFixed(2) + ' LD' : '--');
  set('neo-stat-closest-name', closest ? closest.name : '--');
  set('neo-stat-fastest', fastest ? fastest.vel.toFixed(1) + ' km/s' : '--');

  // PHA closest LD stat highlighting
  const phaEl = $('neo-stat-pha');
  if (phaEl) phaEl.style.color = phas.length > 0 ? 'var(--accent-orange)' : 'var(--accent-green)';

  const closestLdEl = $('neo-stat-closest-ld');
  if (closestLdEl && closest) {
    closestLdEl.style.color = neoLevel(closest.ld).color;
  }

  // Dashboard panel indicators
  set('neo-p-total',   neos.length);
  set('neo-p-pha',     phas.length);
  set('neo-p-closest', closest ? closest.ld.toFixed(2) : '--');
  set('neo-p-name',    closest ? closest.name : '--');
  set('neo-p-speed',   fastest ? fastest.vel.toFixed(1) : '--');

  // Panel score
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
  if (barEl)   barEl.style.width = score + '%';
  if (statusEl) {
    statusEl.textContent = neos.length + '件';
    statusEl.style.color = phas.length > 0 ? 'var(--accent-orange)' : 'var(--accent-green)';
  }

  // Panel note
  const noteEl = $('note-neo');
  if (noteEl) {
    if (phas.length > 0) {
      const cp = phas.reduce((a, b) => a.ld < b.ld ? a : b);
      noteEl.textContent = `⚠ PHA検出: ${cp.name} — ${cp.ld.toFixed(2)} LD (${cp.dateStr})`;
      noteEl.style.color = 'var(--accent-orange)';
    } else {
      noteEl.textContent = 'JPL SSD CAD API / CNEOS';
      noteEl.style.color = '';
    }
  }

  // Alert banner for very close approaches (< 5 LD)
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
    const neos = await fetchNeos();
    updateStats(neos);
    renderList(neos);

    // Share data with 3D visualization
    document.dispatchEvent(new CustomEvent('neoDataReady', { detail: { neos } }));

    if (statusEl) { statusEl.textContent = 'LIVE'; statusEl.style.color = 'var(--accent-green)'; }

    const updEl = document.getElementById('neo-last-update');
    if (updEl) {
      const t = new Date();
      updEl.textContent = `更新: ${t.getUTCHours().toString().padStart(2,'0')}:${t.getUTCMinutes().toString().padStart(2,'0')} UTC`;
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
