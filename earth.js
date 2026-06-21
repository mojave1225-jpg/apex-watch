/* ============================================================
   APEX WATCH — 地球科学・宇宙天気監視モジュール v1.0
   ① Space Weather  — NOAA SWPC (GOES衛星 X線フラックス / Kp指数)
   ② Seismic        — USGS GeoJSON Feed (M4.5+ 過去7日間)
   ③ Volcanic       — Smithsonian GVP RSS (CORS proxy経由)
   ============================================================ */
'use strict';

/* ── API エンドポイント ───────────────────────────────────── */
const SW_XRAY_URL  = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-minute.json';
const SW_KP_URL    = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const SW_ALERT_URL = 'https://services.swpc.noaa.gov/products/alerts.json';
const EQ_URL       = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
const VOL_RSS      = 'https://volcano.si.edu/news/rss/volcano.rss';
const ES_PROXY     = 'https://api.allorigins.win/raw?url=';

const ES_REFRESH_SW  = 10 * 60 * 1000;   // 10分
const ES_REFRESH_EQ  = 20 * 60 * 1000;   // 20分
const ES_REFRESH_VOL = 60 * 60 * 1000;   // 60分 (GVP週次更新)

/* ── X線フラックス → フレアクラス ──────────────────────────── */
function fluxToFlare(flux) {
  const f = +flux || 0;
  if (f >= 1e-4) return { cls:'X', sub:(f/1e-4).toFixed(1), color:'#ff0044', score:90, label:'X級 — 大規模フレア' };
  if (f >= 1e-5) return { cls:'M', sub:(f/1e-5).toFixed(1), color:'#ff6600', score:60, label:'M級 — 中規模フレア' };
  if (f >= 1e-6) return { cls:'C', sub:(f/1e-6).toFixed(1), color:'#ffdd00', score:28, label:'C級 — 小規模フレア' };
  if (f >= 1e-7) return { cls:'B', sub:(f/1e-7).toFixed(1), color:'#00ccff', score: 8, label:'B級 — 微小活動' };
  return               { cls:'A', sub:(f/1e-8).toFixed(1), color:'#00ff88', score: 2, label:'静穏 (A級)' };
}

/* ── Kp指数 → 磁気嵐レベル ─────────────────────────────────── */
function kpToLevel(kp) {
  const k = +kp;
  if (k >= 8) return { label:'G4-G5 超磁気嵐', color:'#ff0044', score:90, g:'G4+' };
  if (k >= 7) return { label:'G3 強磁気嵐',    color:'#ff5500', score:70, g:'G3'  };
  if (k >= 6) return { label:'G2 中磁気嵐',    color:'#ff8800', score:50, g:'G2'  };
  if (k >= 5) return { label:'G1 軽磁気嵐',    color:'#ffdd00', score:28, g:'G1'  };
  if (k >= 4) return { label:'活発',            color:'#00ccff', score:12, g:'Kp4' };
  return              { label:'静穏',            color:'#00ff88', score: 3, g:'静穏' };
}

/* ── マグニチュード → 色 ───────────────────────────────────── */
function magColor(m) {
  if (m >= 8.0) return '#ff0044';
  if (m >= 7.0) return '#ff5500';
  if (m >= 6.0) return '#ff8800';
  if (m >= 5.0) return '#ffdd00';
  return '#00ccff';
}

/* ── DOM ヘルパー ───────────────────────────────────────────── */
function esSet(id, v)    { const e=document.getElementById(id); if(e) e.textContent=v; }
function esCss(id, p, v) { const e=document.getElementById(id); if(e) e.style[p]=v;   }
function esHtml(id, h)   { const e=document.getElementById(id); if(e) e.innerHTML=h;  }

/* ── fetch with timeout ─────────────────────────────────────── */
function esFetch(url, ms=8000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
}

/* ════════════════════════════════════════════════════════════
   1. 宇宙天気 — NOAA SWPC
   ════════════════════════════════════════════════════════════ */
let _sw = null;

async function loadSpaceWeather() {
  try {
    const [xrRes, kpRes, alRes] = await Promise.all([
      esFetch(SW_XRAY_URL),
      esFetch(SW_KP_URL),
      esFetch(SW_ALERT_URL),
    ]);
    const xrData = await xrRes.json();
    const kpData = await kpRes.json();
    const alData = await alRes.json();

    // 長波長帯 (0.1-0.8nm = 1-8Å) = 標準フレア分類
    const longWave = xrData.filter(d => (d.energy||'') === '0.1-0.8nm');
    const latest   = (longWave.length ? longWave : xrData)[xrData.length - 1] || {};
    const flux     = +(latest.observed_flux ?? latest.flux ?? 0);
    const flare    = fluxToFlare(flux);

    // Kp: ヘッダー行を除外してパース
    const kpRows = (Array.isArray(kpData) ? kpData : [])
      .filter(r => Array.isArray(r) && !isNaN(+(r[1])));
    const latestKp = kpRows[kpRows.length - 1];
    const kpVal    = latestKp ? +(latestKp[1]) : 0;
    const kp       = kpToLevel(kpVal);

    // アラート: 最新5件
    const alerts = (Array.isArray(alData) ? alData : []).slice(0, 5);

    _sw = { flare, kpVal, kp, alerts, flux };
    renderSpaceWeather();
  } catch(e) {
    console.warn('[SW]', e.message);
    esSet('status-spaceweather', 'エラー');
  }
}

function renderSpaceWeather() {
  if (!_sw) return;
  const { flare, kpVal, kp, alerts } = _sw;

  /* パネル */
  esSet('sw-flare-cls', flare.cls + flare.sub);
  esCss('sw-flare-cls', 'color', flare.color);
  esSet('sw-flare-lbl', flare.label);
  esSet('sw-kp-val',    kpVal.toFixed(1));
  esCss('sw-kp-val',    'color', kp.color);
  esSet('sw-kp-lbl',    kp.label);

  const score = Math.round(flare.score * 0.55 + kp.score * 0.45);
  esSet('score-spaceweather', score);
  esCss('bar-spaceweather', 'width',      score + '%');
  esCss('bar-spaceweather', 'background', flare.color);
  esSet('status-spaceweather', 'LIVE');

  /* NEOセクション内 宇宙天気バー */
  esSet('sw-bar-flare',  flare.cls + flare.sub);
  esCss('sw-bar-flare',  'color', flare.color);
  esSet('sw-bar-flare-lbl', flare.label);
  esSet('sw-bar-kp',     'Kp ' + kpVal.toFixed(1));
  esCss('sw-bar-kp',     'color', kp.color);
  esSet('sw-bar-kp-lbl', kp.g);

  /* NEOセクション内 アラートリスト */
  const rows = alerts.length
    ? alerts.map(a => {
        const line = (a.message||'').split('\n').find(l=>l.trim())||'';
        const t    = (a.issue_datetime||'').slice(0,16);
        return `<div class="sw-alert-row">
          <span class="sw-atime">${t}</span>
          <span class="sw-amsg">${line.slice(0,90)}</span>
        </div>`;
      }).join('')
    : '<div class="es-no-data">アクティブなアラートなし — 宇宙天気は静穏</div>';
  esHtml('sw-alert-list', rows);
}

/* ════════════════════════════════════════════════════════════
   2. 地震活動 — USGS GeoJSON
   ════════════════════════════════════════════════════════════ */
let _eq = null;

async function loadEarthquakes() {
  try {
    const res  = await esFetch(EQ_URL);
    const json = await res.json();
    const all  = (json.features||[]).sort((a,b)=>(b.properties.mag||0)-(a.properties.mag||0));
    const m6 = all.filter(q=>(q.properties.mag||0)>=6).length;
    const m7 = all.filter(q=>(q.properties.mag||0)>=7).length;
    const m8 = all.filter(q=>(q.properties.mag||0)>=8).length;
    _eq = { all, m6, m7, m8, top:all[0] };
    renderEarthquakes();
  } catch(e) {
    console.warn('[EQ]', e.message);
    esSet('status-seismic','エラー');
  }
}

function renderEarthquakes() {
  if (!_eq) return;
  const { all, m6, m7, m8, top } = _eq;
  const topMag = top ? (top.properties.mag||0) : 0;
  const score  = m8>0?90 : m7>0?70 : m6>5?50 : m6>0?30 : 10;

  esSet('score-seismic', score);
  esCss('bar-seismic','width',      score+'%');
  esCss('bar-seismic','background', magColor(topMag));
  esSet('status-seismic','LIVE');

  esSet('eq-total',  all.length+'件');
  esSet('eq-m6plus', m6+'件');  esCss('eq-m6plus','color', m6>0?'#ff8800':'#00ff88');
  esSet('eq-m7plus', m7+'件');  esCss('eq-m7plus','color', m7>0?'#ff0044':'#00ff88');

  if (top) {
    esSet('eq-top-mag',   'M'+(top.properties.mag||0).toFixed(1));
    esCss('eq-top-mag',   'color', magColor(top.properties.mag));
    esSet('eq-top-place', (top.properties.place||'不明').slice(0,28));
  }

  esHtml('eq-list-body', all.slice(0,15).map(q => {
    const p   = q.properties;
    const mag = (p.mag||0).toFixed(1);
    const col = magColor(p.mag);
    const dep = q.geometry?.coordinates?.[2]?.toFixed(0)||'--';
    const t   = p.time ? new Date(p.time).toISOString().slice(0,16).replace('T',' ') : '--';
    const pl  = (p.place||'不明').slice(0,38);
    return `<div class="es-eq-row">
      <span class="es-eq-mag" style="color:${col}">M${mag}</span>
      <span class="es-eq-place">${pl}</span>
      <span class="es-eq-depth">${dep}km</span>
      <span class="es-eq-time">${t} UTC</span>
    </div>`;
  }).join('')||'<div class="es-no-data">データなし</div>');
}

/* ════════════════════════════════════════════════════════════
   3. 火山活動 — Smithsonian GVP RSS
   ════════════════════════════════════════════════════════════ */
let _vol = null;

const VOL_KNOWN = [
  { name:'キラウエア (Kīlauea)',     loc:'ハワイ, 米国',      lv:'WATCH',   col:'#ff8800' },
  { name:'エトナ (Etna)',            loc:'シチリア, イタリア', lv:'WARNING', col:'#ff5500' },
  { name:'ストロンボリ',              loc:'イタリア',          lv:'WARNING', col:'#ff5500' },
  { name:'桜島 (Sakurajima)',        loc:'鹿児島, 日本',       lv:'WARNING', col:'#ff5500' },
  { name:'ポポカテペトル',            loc:'メキシコ',           lv:'WATCH',   col:'#ff8800' },
  { name:'マラピ (Marapi)',          loc:'インドネシア',        lv:'WARNING', col:'#ff5500' },
  { name:'スルツェイ (Semeru)',       loc:'東ジャワ, インドネシア',lv:'WATCH', col:'#ff8800' },
  { name:'ニラゴンゴ (Nyiragongo)',  loc:'コンゴ民主共和国',   lv:'WATCH',   col:'#ff8800' },
];

async function loadVolcanoes() {
  try {
    const url  = ES_PROXY + encodeURIComponent(VOL_RSS);
    const res  = await esFetch(url, 12000);
    const text = await res.text();
    const doc  = new DOMParser().parseFromString(text, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item'));
    if (items.length === 0) throw new Error('empty RSS');
    _vol = { items, fallback:false };
  } catch(e) {
    console.warn('[VOL]', e.message);
    _vol = { items:[], fallback:true };
  }
  renderVolcanoes();
}

function renderVolcanoes() {
  if (!_vol) return;
  const { items, fallback } = _vol;
  const count = fallback ? VOL_KNOWN.length : items.length;
  const score = count>=15?65 : count>=8?45 : count>=3?30 : 15;

  esSet('score-volcanic', score);
  esCss('bar-volcanic','width',      score+'%');
  esCss('bar-volcanic','background', count>=10?'#ff8800':'#ffdd00');
  esSet('vol-count',   count+'件');
  esSet('status-volcanic', fallback?'参照データ':'LIVE');
  esSet('vol-latest', fallback ? VOL_KNOWN[0].name :
    (items[0]?.querySelector('title')?.textContent||'').slice(0,30));

  const listEl = document.getElementById('vol-list-body');
  if (!listEl) return;

  if (fallback) {
    listEl.innerHTML =
      '<div class="es-vol-notice">GVP週次レポート取得中 — 常時活動中の既知火山を表示</div>' +
      VOL_KNOWN.map(v=>`<div class="es-vol-row">
        <span class="es-vol-lv" style="color:${v.col}">${v.lv}</span>
        <span class="es-vol-name">${v.name}</span>
        <span class="es-vol-loc">${v.loc}</span>
      </div>`).join('');
  } else {
    listEl.innerHTML = items.slice(0,12).map(item => {
      const title   = item.querySelector('title')?.textContent||'不明';
      const link    = item.querySelector('link')?.textContent||'#';
      const desc    = (item.querySelector('description')?.textContent||'')
                        .replace(/<[^>]*>/g,'').slice(0,70);
      const pubDate = (item.querySelector('pubDate')?.textContent||'').slice(5,16);
      return `<div class="es-vol-row">
        <span class="es-vol-lv" style="color:#ff8800">ACTIVE</span>
        <a class="es-vol-name" href="${link}" target="_blank" rel="noopener">${title}</a>
        <span class="es-vol-desc">${desc}</span>
        <span class="es-vol-loc">${pubDate}</span>
      </div>`;
    }).join('')||'<div class="es-no-data">データなし</div>';
  }
}

/* ════════════════════════════════════════════════════════════
   初期化
   ════════════════════════════════════════════════════════════ */
async function initEarthScience() {
  await Promise.all([loadSpaceWeather(), loadEarthquakes(), loadVolcanoes()]);
  setInterval(loadSpaceWeather, ES_REFRESH_SW);
  setInterval(loadEarthquakes,  ES_REFRESH_EQ);
  setInterval(loadVolcanoes,    ES_REFRESH_VOL);
}

document.addEventListener('DOMContentLoaded', initEarthScience);
