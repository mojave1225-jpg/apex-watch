/* ============================================================
   APEX WATCH — 地球科学・宇宙天気監視モジュール v2.0
   ① Space Weather  — NOAA SWPC (xray-flares-latest / Kp)
   ② Seismic        — USGS GeoJSON Feed (M4.5+ 過去7日間)
   ③ Volcanic       — Smithsonian GVP RSS (CORS proxy経由)
   ============================================================ */
'use strict';

/* ── API エンドポイント ───────────────────────────────────── */
const SW_FLARE_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json';
const SW_KP_URL    = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const SW_ALERT_URL = 'https://services.swpc.noaa.gov/products/alerts.json';
const EQ_URL       = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
const VOL_RSS      = 'https://volcano.si.edu/news/rss/volcano.rss';
const ES_PROXY     = 'https://api.allorigins.win/raw?url=';

const ES_REFRESH_SW  = 10 * 60 * 1000;
const ES_REFRESH_EQ  = 20 * 60 * 1000;
const ES_REFRESH_VOL = 60 * 60 * 1000;

/* ── フレアクラス文字列 "B5.5" → 情報オブジェクト ──────────── */
function flareInfo(cls) {
  if (!cls) return { cls:'A', sub:'0.0', color:'#00ff88', score:2, label:'静穏', jp:'A級' };
  const letter = cls[0].toUpperCase();
  const sub    = parseFloat(cls.slice(1)||'0').toFixed(1);
  const map = {
    X:{ color:'#ff0044', score:92, label:'X級 — 大規模フレア',  jp:'X級' },
    M:{ color:'#ff6600', score:62, label:'M級 — 中規模フレア',  jp:'M級' },
    C:{ color:'#ffdd00', score:28, label:'C級 — 小規模フレア',  jp:'C級' },
    B:{ color:'#00ccff', score: 8, label:'B級 — 微小活動',     jp:'B級' },
    A:{ color:'#00ff88', score: 2, label:'静穏 (A級)',          jp:'A級' },
  };
  return { cls:letter, sub, ...(map[letter]||map.A) };
}

/* ── Kp → 磁気嵐レベル ─────────────────────────────────────── */
function kpLevel(kp) {
  const k = +kp;
  if (k >= 8) return { label:'G4-G5 超磁気嵐', color:'#ff0044', score:90, g:'G4+' };
  if (k >= 7) return { label:'G3 強磁気嵐',    color:'#ff5500', score:70, g:'G3'  };
  if (k >= 6) return { label:'G2 中磁気嵐',    color:'#ff8800', score:50, g:'G2'  };
  if (k >= 5) return { label:'G1 軽磁気嵐',    color:'#ffdd00', score:28, g:'G1'  };
  if (k >= 4) return { label:'活発',            color:'#00ccff', score:12, g:'Kp4' };
  return              { label:'静穏',            color:'#00ff88', score: 3, g:'静穏' };
}

/* ── Magnitude → 色 ────────────────────────────────────────── */
function magColor(m) {
  if (m >= 8.0) return '#ff0044';
  if (m >= 7.0) return '#ff5500';
  if (m >= 6.0) return '#ff8800';
  if (m >= 5.0) return '#ffdd00';
  return '#00ccff';
}

/* ── 経過時間ラベル ─────────────────────────────────────────── */
function timeAgo(ms) {
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 24) return Math.floor(h/24) + '日前';
  if (h >= 1)  return h + '時間前';
  if (m >= 1)  return m + '分前';
  return '直前';
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
   xray-flares-latest: current_class フィールドを使用
   kp-index: オブジェクト形式 {time_tag, Kp, ...}
   ════════════════════════════════════════════════════════════ */
let _sw = null;

async function loadSpaceWeather() {
  try {
    const [xrRes, kpRes, alRes] = await Promise.all([
      esFetch(SW_FLARE_URL),
      esFetch(SW_KP_URL),
      esFetch(SW_ALERT_URL),
    ]);
    const xrData = await xrRes.json();
    const kpData = await kpRes.json();
    const alData = await alRes.json();

    // xray-flares-latest: 最新フレアイベントの current_class を使用
    const latest   = Array.isArray(xrData) ? xrData[0] : {};
    const curClass = latest.current_class || latest.max_class || 'A0.0';
    const flare    = flareInfo(curClass);
    const maxFlare = flareInfo(latest.max_class || curClass);

    // kp-index: オブジェクト配列 [{time_tag, Kp}, ...]
    const kpRows = Array.isArray(kpData) ? kpData.filter(r => r && r.Kp != null) : [];
    const kpVal  = kpRows.length ? +(kpRows[kpRows.length-1].Kp) : 0;
    const kp     = kpLevel(kpVal);

    // アラート: 最新5件
    const alerts = (Array.isArray(alData) ? alData : []).slice(0, 5);

    _sw = { flare, maxFlare, kpVal, kp, alerts };
    renderSpaceWeather();
  } catch(e) {
    console.warn('[SW]', e.message);
    esSet('status-spaceweather', 'エラー');
    esSet('sw-bar-flare',     'N/A');
    esSet('sw-bar-flare-lbl', 'NOAA 接続失敗');
    esSet('sw-bar-kp',        '--');
    esSet('sw-bar-kp-lbl',    'データなし');
    esHtml('sw-alert-list', '<div class="es-no-data">NOAA SWPC に接続できません</div>');
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
  esSet('sw-bar-flare',     flare.cls + flare.sub);
  esCss('sw-bar-flare',     'color', flare.color);
  esSet('sw-bar-flare-lbl', flare.label);
  esSet('sw-bar-kp',        'Kp ' + kpVal.toFixed(1));
  esCss('sw-bar-kp',        'color', kp.color);
  esSet('sw-bar-kp-lbl',    kp.g);

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
    const m5 = all.filter(q=>(q.properties.mag||0)>=5).length;
    const m6 = all.filter(q=>(q.properties.mag||0)>=6).length;
    const m7 = all.filter(q=>(q.properties.mag||0)>=7).length;
    const m8 = all.filter(q=>(q.properties.mag||0)>=8).length;
    _eq = { all, m5, m6, m7, m8, top:all[0] };
    renderEarthquakes();
  } catch(e) {
    console.warn('[EQ]', e.message);
    esSet('status-seismic','エラー');
  }
}

function renderEarthquakes() {
  if (!_eq) return;
  const { all, m5, m6, m7, m8, top } = _eq;
  const topMag = top ? (top.properties.mag||0) : 0;
  const score  = m8>0?92 : m7>0?72 : m6>5?52 : m6>0?32 : m5>10?18 : 8;

  esSet('score-seismic', score);
  esCss('bar-seismic','width',      score+'%');
  esCss('bar-seismic','background', magColor(topMag));
  esSet('status-seismic','LIVE');
  esSet('eq-total',  all.length+'件');
  esSet('eq-m6plus', m6+'件');  esCss('eq-m6plus','color', m6>0?'#ff8800':'#00ff88');
  esSet('eq-m7plus', m7+'件');  esCss('eq-m7plus','color', m7>0?'#ff0044':'#00ff88');
  esSet('sum-eq-total', all.length+'件');
  esSet('sum-eq-m6', m6+'件');  esCss('sum-eq-m6','color', m6>0?'#ff8800':'#00ff88');
  esSet('sum-eq-m7', m7+'件');  esCss('sum-eq-m7','color', m7>0?'#ff0044':'#00ff88');

  if (top) {
    esSet('eq-top-mag',   'M'+(top.properties.mag||0).toFixed(1));
    esCss('eq-top-mag',   'color', magColor(top.properties.mag));
    esSet('eq-top-place', (top.properties.place||'不明').slice(0,28));
  }

  /* 地震活動レベルメーター */
  const meterPct = Math.min(score, 100);
  const meterColor = magColor(topMag);
  esCss('eq-meter-fill', 'width', meterPct + '%');
  esCss('eq-meter-fill', 'background', meterColor);
  const lvLabel = m8>0?'CRITICAL — M8以上':m7>0?'WARNING — M7以上':m6>0?'ELEVATED — M6以上':'NORMAL';
  const lvColor = m8>0?'#ff0044':m7>0?'#ff5500':m6>0?'#ff8800':'#00ff88';
  esSet('eq-meter-label', lvLabel);
  esCss('eq-meter-label','color', lvColor);

  /* カードリスト */
  esHtml('eq-list-body', all.slice(0,12).map(q => {
    const p      = q.properties;
    const mag    = (p.mag||0).toFixed(1);
    const col    = magColor(p.mag);
    const dep    = q.geometry?.coordinates?.[2]?.toFixed(0)||'--';
    const ago    = p.time ? timeAgo(p.time) : '--';
    const place  = (p.place||'不明').slice(0,42);
    const isNew  = p.time && (Date.now()-p.time) < 3600000;
    const barW   = Math.max(8, Math.min(100, ((p.mag||0)-4.5)/4.5*100)).toFixed(0);
    return `<div class="es-eq-card${isNew?' es-eq-new':''}">
      <div class="es-eq-badge" style="background:${col}22;border-color:${col};box-shadow:0 0 8px ${col}44">
        <span class="es-eq-badge-m" style="color:${col}">M</span>
        <span class="es-eq-badge-v" style="color:${col}">${mag}</span>
      </div>
      <div class="es-eq-info">
        <div class="es-eq-place">${place}</div>
        <div class="es-eq-meta">
          <span class="es-eq-depth">▼ ${dep}km</span>
          <span class="es-eq-ago">${ago}</span>
          ${isNew?'<span class="es-eq-new-badge">NEW</span>':''}
        </div>
        <div class="es-eq-bar-wrap">
          <div class="es-eq-bar" style="width:${barW}%;background:${col}77"></div>
        </div>
      </div>
    </div>`;
  }).join('')||'<div class="es-no-data">データなし</div>');
}

/* ════════════════════════════════════════════════════════════
   3. 火山活動 — Smithsonian GVP RSS
   ════════════════════════════════════════════════════════════ */
let _vol = null;

const VOL_KNOWN = [
  { name:'桜島 (Sakurajima)',        loc:'鹿児島, 日本',         lv:'WARNING', col:'#ff5500', bg:'rgba(255,85,0,0.08)',   icon:'🌋', desc:'連続噴火・火砕流発生' },
  { name:'キラウエア (Kīlauea)',      loc:'ハワイ, 米国',          lv:'WATCH',   col:'#ff8800', bg:'rgba(255,136,0,0.06)', icon:'🌋', desc:'熔岩流出継続中' },
  { name:'エトナ (Etna)',             loc:'シチリア, イタリア',     lv:'WARNING', col:'#ff5500', bg:'rgba(255,85,0,0.08)',  icon:'🌋', desc:'パロキシズム活動' },
  { name:'ストロンボリ',               loc:'リパリ諸島, イタリア',   lv:'WARNING', col:'#ff5500', bg:'rgba(255,85,0,0.08)',  icon:'🌋', desc:'周期的爆発噴火' },
  { name:'ポポカテペトル',             loc:'プエブラ州, メキシコ',   lv:'WATCH',   col:'#ff8800', bg:'rgba(255,136,0,0.06)', icon:'🌋', desc:'噴煙・火山灰放出' },
  { name:'マラピ (Marapi)',           loc:'西スマトラ, インドネシア',lv:'WATCH',   col:'#ff8800', bg:'rgba(255,136,0,0.06)', icon:'🌋', desc:'爆発的噴火活動' },
  { name:'スメル (Semeru)',           loc:'東ジャワ, インドネシア',  lv:'WATCH',   col:'#ff8800', bg:'rgba(255,136,0,0.06)', icon:'🌋', desc:'溶岩ドーム成長' },
  { name:'ニラゴンゴ (Nyiragongo)',   loc:'北キブ, コンゴ民主共和国',lv:'ADVISORY',col:'#ffdd00', bg:'rgba(255,221,0,0.05)', icon:'🌋', desc:'溶岩湖活動継続' },
];

const LV_CONFIG = {
  WARNING:  { color:'#ff5500', bg:'rgba(255,85,0,0.10)',   border:'rgba(255,85,0,0.5)',   label:'WARNING',  jp:'噴火中' },
  WATCH:    { color:'#ff8800', bg:'rgba(255,136,0,0.07)',  border:'rgba(255,136,0,0.4)',  label:'WATCH',    jp:'活発化' },
  ADVISORY: { color:'#ffdd00', bg:'rgba(255,221,0,0.05)', border:'rgba(255,221,0,0.35)', label:'ADVISORY', jp:'上昇傾向' },
  NORMAL:   { color:'#00ff88', bg:'rgba(0,255,136,0.04)', border:'rgba(0,255,136,0.25)', label:'NORMAL',   jp:'通常' },
};

async function loadVolcanoes() {
  try {
    const url  = ES_PROXY + encodeURIComponent(VOL_RSS);
    const res  = await esFetch(url, 8000);
    const text = await res.text();
    if (!text.includes('<item') || text.startsWith('error') || text.includes('error code:')) {
      throw new Error('proxy error: ' + text.slice(0,40));
    }
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
  const warnCount = fallback ? VOL_KNOWN.filter(v=>v.lv==='WARNING').length : Math.ceil(count*0.4);
  const score = count>=15?65 : count>=8?45 : count>=3?30 : 15;

  esSet('score-volcanic', score);
  esCss('bar-volcanic','width',      score+'%');
  esCss('bar-volcanic','background', warnCount>3?'#ff5500':'#ff8800');
  esSet('vol-count',      count+'件');
  esSet('sum-vol-count',  count+'件');
  esSet('vol-warn-count', warnCount+'');
  esSet('status-volcanic', fallback?'参照データ':'LIVE');
  esSet('vol-latest', fallback ? VOL_KNOWN[0].name :
    (items[0]?.querySelector('title')?.textContent||'').slice(0,30));

  const listEl = document.getElementById('vol-list-body');
  if (!listEl) return;

  if (fallback) {
    listEl.innerHTML =
      `<div class="es-vol-notice">GVP週次レポート取得中 — 既知の常時活動火山を表示中</div>` +
      VOL_KNOWN.map(v => {
        const lc = LV_CONFIG[v.lv] || LV_CONFIG.NORMAL;
        return `<div class="es-vol-card" style="background:${lc.bg};border-left-color:${lc.color};border-left-width:4px">
          <div class="es-vol-card-left">
            <span class="es-vol-alert-lv" style="background:${lc.color}22;color:${lc.color};border-color:${lc.border}">${lc.label}</span>
            <span class="es-vol-jp" style="color:${lc.color}">${lc.jp}</span>
          </div>
          <div class="es-vol-card-body">
            <div class="es-vol-card-name">${v.icon} ${v.name}</div>
            <div class="es-vol-card-loc">📍 ${v.loc}</div>
            <div class="es-vol-card-desc">${v.desc}</div>
          </div>
        </div>`;
      }).join('');
  } else {
    listEl.innerHTML = items.slice(0,10).map((item,i) => {
      const title   = item.querySelector('title')?.textContent||'不明';
      const link    = item.querySelector('link')?.textContent||'#';
      const desc    = (item.querySelector('description')?.textContent||'')
                        .replace(/<[^>]*>/g,'').trim().slice(0,60);
      const pubDate = (item.querySelector('pubDate')?.textContent||'').slice(5,16);
      const lc = i===0 ? LV_CONFIG.WARNING : i<3 ? LV_CONFIG.WATCH : LV_CONFIG.ADVISORY;
      return `<div class="es-vol-card" style="background:${lc.bg};border-left-color:${lc.color};border-left-width:4px">
        <div class="es-vol-card-left">
          <span class="es-vol-alert-lv" style="background:${lc.color}22;color:${lc.color};border-color:${lc.border}">${lc.label}</span>
          <span class="es-vol-date">${pubDate}</span>
        </div>
        <div class="es-vol-card-body">
          <div class="es-vol-card-name">🌋 <a href="${link}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${title}</a></div>
          ${desc?`<div class="es-vol-card-desc">${desc}</div>`:''}
        </div>
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
