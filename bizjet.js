/* ============================================================
   APEX WATCH — Business Jet Escape Monitor
   Data: OpenSky Network REST API (free, anonymous)
   Purpose: Detect unusual HNWI private jet activity spikes
            at billionaire airports and safe-haven destinations
   ============================================================ */

// ── MONITORED AIRPORTS ──
const BIZJET_AIRPORTS = [
  // DEPARTURE HUBS (富裕層集積地)
  {
    id: 'kteb', name: 'テターボロ (NY)', code: 'KTEB', flag: 'US',
    bounds: { lamin: 40.75, lomin: -74.15, lamax: 41.00, lomax: -73.85 },
    role: 'hub', baseline: 35,
    note: 'NY富裕層・ウォール街CEOの主要ジェット空港',
  },
  {
    id: 'kvny', name: 'ヴァン・ナイズ (CA)', code: 'KVNY', flag: 'US',
    bounds: { lamin: 34.10, lomin: -118.55, lamax: 34.30, lomax: -118.30 },
    role: 'hub', baseline: 28,
    note: 'ハリウッド・シリコンバレー富豪の拠点',
  },
  {
    id: 'eglf', name: 'ファーンボロ (UK)', code: 'EGLF', flag: 'GB',
    bounds: { lamin: 51.15, lomin: -0.95, lamax: 51.45, lomax: -0.60 },
    role: 'hub', baseline: 22,
    note: '欧州富裕層・ロンドンHNWI拠点空港',
  },
  {
    id: 'lszh', name: 'チューリッヒ (CH)', code: 'LSZH', flag: 'CH',
    bounds: { lamin: 47.35, lomin: 8.45, lamax: 47.55, lomax: 8.70 },
    role: 'hub', baseline: 30,
    note: 'スイス金融界・プライベートバンキング拠点',
  },
  // SAFE HAVENS (逃避先)
  {
    id: 'lsgg', name: 'ジュネーブ (CH)', code: 'LSGG', flag: 'CH',
    bounds: { lamin: 46.10, lomin: 5.95, lamax: 46.35, lomax: 6.25 },
    role: 'haven', baseline: 20,
    note: 'オフショア資産・永住権取得者の最終降下地',
  },
  {
    id: 'omdb', name: 'ドバイ (UAE)', code: 'OMDB', flag: 'AE',
    bounds: { lamin: 25.10, lomin: 55.20, lamax: 25.45, lomax: 55.55 },
    role: 'haven', baseline: 45,
    note: 'UAE黄金ビザ移住者の到着拠点・無税避難地',
  },
  {
    id: 'wsss', name: 'シンガポール (SG)', code: 'WSSS', flag: 'SG',
    bounds: { lamin: 1.20, lomin: 103.70, lamax: 1.45, lomax: 104.05 },
    role: 'haven', baseline: 38,
    note: 'アジア富裕層のファミリーオフィス集積地',
  },
  {
    id: 'nzaa', name: 'オークランド (NZ)', code: 'NZAA', flag: 'NZ',
    bounds: { lamin: -37.10, lomin: 174.60, lamax: -36.75, lomax: 175.05 },
    role: 'haven', baseline: 8,
    note: 'テック億万長者のバンカー・農場 最終目的地',
  },
];

// ── CHARTER/OPERATOR CALLSIGN PREFIXES ──
const BIZJET_OPS = [
  { prefix: 'EJA',  name: 'NetJets',        tier: 'UHNWI' },
  { prefix: 'LXJ',  name: 'Flexjet',        tier: 'UHNWI' },
  { prefix: 'VJT',  name: 'VistaJet',       tier: 'UHNWI' },
  { prefix: 'WSJ',  name: 'Wheels Up',      tier: 'HNWI'  },
  { prefix: 'JNS',  name: 'JetSuite',       tier: 'HNWI'  },
  { prefix: 'TVJ',  name: 'TAG Aviation',   tier: 'UHNWI' },
  { prefix: 'SVR',  name: 'PrivateAir (CH)',tier: 'UHNWI' },
  { prefix: 'NCB',  name: 'NetJets Europe', tier: 'UHNWI' },
  { prefix: 'ACK',  name: 'Air Charter',    tier: 'HNWI'  },
  { prefix: 'XOJ',  name: 'XO (JetSmarter)',tier: 'HNWI'  },
  { prefix: 'GAX',  name: 'Global Exec',    tier: 'HNWI'  },
  { prefix: 'FPY',  name: 'Fly Private',    tier: 'HNWI'  },
  { prefix: 'JCI',  name: 'Jet It',         tier: 'HNWI'  },
  { prefix: 'ABY',  name: 'Air Arabia Biz', tier: 'HNWI'  },
  { prefix: 'SXD',  name: 'Sentient Jet',   tier: 'UHNWI' },
];

const BIZJET_PREFIXES = BIZJET_OPS.map(o => o.prefix);

// Spike thresholds (ratio vs baseline)
const SPIKE = { yellow: 1.4, orange: 1.8, red: 2.5 };

// ── STATE ──
const bjState = {
  airports: {},        // keyed by airport.id
  history: {},         // rolling counts for baseline
  detectedOps: [],     // operator callsigns seen this cycle
  hubTotal: 0,
  havenTotal: 0,
  spikeLevel: 0,
  hubSpike: false,
  havenSpike: false,
  lastFetch: null,
};

// ── LOAD / SAVE HISTORY ──
function loadHistory() {
  try {
    const raw = sessionStorage.getItem('bj_history');
    if (raw) bjState.history = JSON.parse(raw);
  } catch (_) {}
}
function saveHistory() {
  try { sessionStorage.setItem('bj_history', JSON.stringify(bjState.history)); } catch (_) {}
}

// ── OPENSKY FETCH ──
async function fetchAirportTraffic(ap) {
  const { lamin, lomin, lamax, lomax } = ap.bounds;
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  const data = await res.json();
  return data.states || [];
}

// ── BIZJET CALLSIGN FILTER ──
function isBizjetCallsign(callsign) {
  const cs = (callsign || '').trim().toUpperCase();
  return BIZJET_PREFIXES.some(p => cs.startsWith(p));
}

function detectOperator(callsign) {
  const cs = (callsign || '').trim().toUpperCase();
  return BIZJET_OPS.find(o => cs.startsWith(o.prefix)) || null;
}

// ── SPIKE DETECTION ──
function calcSpike(apId, current, baselineStatic) {
  if (!bjState.history[apId]) bjState.history[apId] = [];
  const hist = bjState.history[apId];

  // Use rolling average from history, fallback to static baseline
  const rollingBase = hist.length >= 3
    ? hist.slice(-6).reduce((a, b) => a + b, 0) / Math.min(hist.length, 6)
    : baselineStatic;

  // Push current (keep last 12 measurements)
  hist.push(current);
  if (hist.length > 12) hist.shift();

  const ratio = rollingBase > 0 ? current / rollingBase : 1;
  let level = 0;
  if (ratio >= SPIKE.red)    level = 3;
  else if (ratio >= SPIKE.orange) level = 2;
  else if (ratio >= SPIKE.yellow) level = 1;

  return { ratio: Math.round(ratio * 10) / 10, level, rollingBase: Math.round(rollingBase) };
}

// ── MAIN FETCH ──
async function fetchBizjetData() {
  const opsFound = {};
  let hubTotal = 0, havenTotal = 0;
  let globalSpikeLevel = 0;

  // Stagger requests 300ms apart to respect rate limits
  for (let i = 0; i < BIZJET_AIRPORTS.length; i++) {
    const ap = BIZJET_AIRPORTS[i];
    if (i > 0) await new Promise(r => setTimeout(r, 350));

    try {
      const states = await fetchAirportTraffic(ap);
      const total  = states.length;
      const bizjets = states.filter(s => isBizjetCallsign(s[1]));
      const airborne = states.filter(s => !s[8]);  // on_ground = false

      // Operator detection
      bizjets.forEach(s => {
        const op = detectOperator(s[1]);
        if (op) opsFound[op.prefix] = (opsFound[op.prefix] || 0) + 1;
      });

      const spike = calcSpike(ap.id, total, ap.baseline);
      if (spike.level > globalSpikeLevel) globalSpikeLevel = spike.level;

      bjState.airports[ap.id] = {
        total, bizjets: bizjets.length, airborne: airborne.length,
        spike, ok: true,
        aircraft: bizjets.slice(0, 6).map(s => ({
          callsign: (s[1] || '').trim() || 'N/A',
          country:  s[2] || '?',
          alt:      s[7] ? Math.round(s[7] / 30.48) + 'ft' : 'GND',
          onGround: !!s[8],
        })),
      };

      if (ap.role === 'hub')   hubTotal   += total;
      if (ap.role === 'haven') havenTotal += total;

    } catch (e) {
      bjState.airports[ap.id] = { total: 0, bizjets: 0, airborne: 0,
        spike: { ratio: 1, level: 0, rollingBase: ap.baseline }, ok: false, aircraft: [] };
    }
  }

  // Escape ratio: (haven traffic / hub traffic) spike = evacuation signal
  const escapeRatio = hubTotal > 0 ? havenTotal / hubTotal : 0;
  const havenSpikeBase = 111 / 133; // expected safe_haven baseline sum / hub baseline sum
  if (escapeRatio > havenSpikeBase * SPIKE.orange) globalSpikeLevel = Math.max(globalSpikeLevel, 2);

  bjState.hubTotal    = hubTotal;
  bjState.havenTotal  = havenTotal;
  bjState.spikeLevel  = globalSpikeLevel;
  bjState.hubSpike    = globalSpikeLevel >= 2;
  bjState.havenSpike  = escapeRatio > havenSpikeBase * SPIKE.yellow;
  bjState.detectedOps = Object.entries(opsFound)
    .sort((a, b) => b[1] - a[1])
    .map(([prefix, count]) => ({ ...BIZJET_OPS.find(o => o.prefix === prefix), count }));
  bjState.lastFetch   = new Date();
  bjState.escapeRatio = Math.round(escapeRatio * 100);

  saveHistory();
  updateBizjetUI();
}

// ── ALERT LABELS ──
const BJ_LEVEL_LABEL = ['通常', '警戒', '危険', '緊急'];
const BJ_LEVEL_COLOR = ['var(--accent-green)', 'var(--accent-yellow)', 'var(--accent-orange)', 'var(--accent-red)'];
const BJ_LEVEL_CLASS = ['ok', 'yellow', 'orange', 'red'];

// ── UI UPDATE ──
function updateBizjetUI() {
  const level = bjState.spikeLevel;
  const score = Math.min(100, Math.round(
    35 +
    (bjState.hubTotal   > 0 ? Math.min(30, bjState.hubTotal / 5)   : 0) +
    (bjState.havenTotal > 0 ? Math.min(25, bjState.havenTotal / 4) : 0) +
    level * 12
  ));

  // Panel
  const scoreEl  = document.getElementById('score-bizjet');
  const barEl    = document.getElementById('bar-bizjet');
  const statusEl = document.getElementById('status-bizjet');
  if (scoreEl)  { scoreEl.textContent = score; scoreEl.style.color = BJ_LEVEL_COLOR[level]; }
  if (barEl)    barEl.style.width = score + '%';
  if (statusEl) { statusEl.textContent = BJ_LEVEL_LABEL[level]; statusEl.className = 'panel-status ' + BJ_LEVEL_CLASS[level]; }

  // Panel indicators
  setText('bj-hub-count',   bjState.hubTotal   || '--');
  setText('bj-haven-count', bjState.havenTotal || '--');
  setText('bj-escape-ratio', bjState.escapeRatio + '%');
  setText('bj-ops-count',   bjState.detectedOps.length + '社');
  setText('bj-last-update', bjState.lastFetch ? bjState.lastFetch.toLocaleTimeString('ja-JP') : '--');

  setArrowColor('bj-hub-arrow',   bjState.hubSpike);
  setArrowColor('bj-haven-arrow', bjState.havenSpike);

  // Airport table rows
  BIZJET_AIRPORTS.forEach(ap => {
    const d = bjState.airports[ap.id];
    if (!d) return;
    const lv = d.spike.level;

    setText(`bj-total-${ap.id}`,    d.ok ? d.total : '--');
    setText(`bj-bizjet-${ap.id}`,   d.ok ? d.bizjets : '--');
    setText(`bj-spike-${ap.id}`,    d.ok ? `×${d.spike.ratio}` : '--');
    setText(`bj-slevel-${ap.id}`,   BJ_LEVEL_LABEL[lv]);

    const spikeEl = document.getElementById(`bj-spike-${ap.id}`);
    if (spikeEl) spikeEl.style.color = BJ_LEVEL_COLOR[lv];

    const rowEl = document.getElementById(`bj-row-${ap.id}`);
    if (rowEl) rowEl.dataset.level = lv;
  });

  // Detected operators
  const opsEl = document.getElementById('bj-ops-list');
  if (opsEl) {
    opsEl.innerHTML = bjState.detectedOps.length > 0
      ? bjState.detectedOps.map(op => `
          <div class="bj-op-row">
            <span class="bj-op-prefix">${op.prefix}</span>
            <span class="bj-op-name">${op.name || '?'}</span>
            <span class="bj-op-tier ${op.tier === 'UHNWI' ? 'red' : 'orange'}">${op.tier}</span>
            <span class="bj-op-count">${op.count}機</span>
          </div>`).join('')
      : '<div class="bj-no-data">オペレーター未検出 (データ取得中)</div>';
  }

  // Alert banner
  if (level >= 2) {
    const msg = level >= 3
      ? `🚨 BIZJET CRITICAL — プライベートジェット緊急急増！ハブ空港 ${bjState.hubTotal}機・セーフヘイブン ${bjState.havenTotal}機。大規模逃避フェーズ突入の可能性`
      : `⚠ BIZJET ALERT — プライベートジェット活動スパイク検出。逃避比率 ${bjState.escapeRatio}%。富裕層の移動パターン異常`;
    const bannerEl = document.getElementById('alertText');
    if (bannerEl) bannerEl.textContent = msg;
  }

  // Panel glow
  const panelEl = document.getElementById('panel-bizjet');
  if (panelEl && level >= 2) {
    panelEl.style.boxShadow = level >= 3
      ? '0 0 30px rgba(255,136,0,0.5), inset 0 0 20px rgba(255,136,0,0.08)'
      : '0 0 15px rgba(255,221,0,0.3)';
  }

  // Flow visual
  setText('bj-flow-hub-val',   bjState.hubTotal   || '--');
  setText('bj-flow-haven-val', bjState.havenTotal || '--');
  const fillPct = bjState.hubTotal > 0
    ? Math.min(90, Math.round((bjState.havenTotal / bjState.hubTotal) * 100))
    : 50;
  const fillEl = document.getElementById('bj-flow-fill');
  if (fillEl) fillEl.style.width = fillPct + '%';
  const planeEl = document.getElementById('bj-flow-plane');
  if (planeEl) planeEl.style.color = BJ_LEVEL_COLOR[level];

  // Integrate score into Doomsday Index
  if (typeof state !== 'undefined') {
    state.scores.bizjet = score;
    if (typeof recalcMain === 'function') recalcMain();
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setArrowColor(id, isHigh) {
  const el = document.getElementById(id);
  if (!el) return;
  if (isHigh) { el.textContent = '↑↑'; el.className = 'ind-arrow up'; }
  else { el.textContent = '→'; el.className = 'ind-arrow'; }
}

// ── RENDER STATIC TABLE ──
function renderBizjetSection() {
  const tableEl = document.getElementById('bjAirportTable');
  if (!tableEl) return;

  tableEl.innerHTML = BIZJET_AIRPORTS.map(ap => `
    <div class="bj-airport-row" id="bj-row-${ap.id}" data-level="0">
      <div class="bj-ap-header">
        <span class="bj-ap-flag">${ap.flag}</span>
        <span class="bj-ap-name">${ap.name}</span>
        <span class="bj-ap-code">${ap.code}</span>
        <span class="bj-ap-role ${ap.role}">${ap.role === 'hub' ? '出発拠点' : 'セーフヘイブン'}</span>
      </div>
      <div class="bj-ap-stats">
        <div class="bj-stat">
          <span class="bj-stat-label">総機数</span>
          <span class="bj-stat-val" id="bj-total-${ap.id}">--</span>
        </div>
        <div class="bj-stat">
          <span class="bj-stat-label">HNWI機</span>
          <span class="bj-stat-val" id="bj-bizjet-${ap.id}">--</span>
        </div>
        <div class="bj-stat">
          <span class="bj-stat-label">対基準比</span>
          <span class="bj-stat-val" id="bj-spike-${ap.id}">--</span>
        </div>
        <div class="bj-stat">
          <span class="bj-stat-label">状態</span>
          <span class="bj-stat-val" id="bj-slevel-${ap.id}">--</span>
        </div>
      </div>
      <div class="bj-ap-note">${ap.note}</div>
    </div>
  `).join('');
}

// ── INIT ──
async function initBizjetMonitor() {
  loadHistory();
  renderBizjetSection();
  await fetchBizjetData();
  // 8分ごとに更新（OpenSky 8空港×8分 = ~60回/日、余裕を持って400制限内）
  setInterval(fetchBizjetData, 8 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', initBizjetMonitor);
