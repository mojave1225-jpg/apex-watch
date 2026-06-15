/* ============================================================
   APEX WATCH — Military Movement Monitor
   Data: OpenSky Network REST API (free, anonymous, CORS-enabled)
   Supplement: Curated naval intelligence from public sources
   Note: Military aircraft operating without ADS-B are not captured.
         US transport/tanker callsigns and hex ranges are detectable.
   ============================================================ */

// ── STRATEGIC MONITORING ZONES ──
const MILITARY_ZONES = [
  {
    id: 'taiwan',
    name: '台湾海峡 / 南シナ海',
    nameEn: 'Taiwan Strait / SCS',
    bounds: { lamin: 18, lomin: 114, lamax: 28, lomax: 126 },
    color: '#ff0044',
    threshold: { yellow: 4, orange: 10, red: 22 },
    navyLevel: 2,
    navyNote: 'PLA海軍 空母山東・遼寧 + 米第7艦隊 展開中',
    icon: '⚡',
  },
  {
    id: 'persian',
    name: 'ペルシャ湾 / ホルムズ海峡',
    nameEn: 'Persian Gulf / Hormuz',
    bounds: { lamin: 22, lomin: 48, lamax: 30, lomax: 60 },
    color: '#ff8800',
    threshold: { yellow: 5, orange: 14, red: 28 },
    navyLevel: 2,
    navyNote: '米第5艦隊 + 強襲揚陸艦 BATAAN展開',
    icon: '⚡',
  },
  {
    id: 'korea',
    name: '朝鮮半島 / 日本海',
    nameEn: 'Korean Peninsula / Sea of Japan',
    bounds: { lamin: 33, lomin: 124, lamax: 42, lomax: 133 },
    color: '#ff8800',
    threshold: { yellow: 5, orange: 12, red: 24 },
    navyLevel: 1,
    navyNote: '米韓合同演習 / DPRK弾道ミサイル監視',
    icon: '▲',
  },
  {
    id: 'baltic',
    name: 'バルト海 / 東欧',
    nameEn: 'Baltic Sea / Eastern Europe',
    bounds: { lamin: 53, lomin: 14, lamax: 67, lomax: 30 },
    color: '#ff8800',
    threshold: { yellow: 8, orange: 20, red: 40 },
    navyLevel: 1,
    navyNote: 'NATO海上即応群 + ISR飛行増加',
    icon: '▲',
  },
  {
    id: 'med',
    name: '東地中海',
    nameEn: 'Eastern Mediterranean',
    bounds: { lamin: 30, lomin: 25, lamax: 42, lomax: 38 },
    color: '#ffdd00',
    threshold: { yellow: 6, orange: 15, red: 30 },
    navyLevel: 1,
    navyNote: '米空母打撃群 + ロシア黒海艦隊 動向監視',
    icon: '▲',
  },
  {
    id: 'scs',
    name: '西太平洋 / グアム周辺',
    nameEn: 'West Pacific / Guam',
    bounds: { lamin: 10, lomin: 138, lamax: 20, lomax: 150 },
    color: '#ffdd00',
    threshold: { yellow: 4, orange: 10, red: 20 },
    navyLevel: 1,
    navyNote: 'アンダーセン空軍基地 / B-52 ローテーション',
    icon: '▲',
  },
];

// US military ICAO hex range starts with 'ae'
// UK military: '43c', '43e', French: 'a0' range overlap — use callsign fallback
const MIL_HEX_PREFIXES = ['ae'];  // US DoD allocated range

// Military callsign pattern matchers
const MIL_CALLSIGN_PATTERNS = [
  /^RCH\d/,      // REACH — USAF Air Mobility Command
  /^REACH\d/,
  /^JAKE\d/,     // Various USAF
  /^DUKE\d/,
  /^VALOR\d/,
  /^PACK\d/,
  /^IRON\d/,
  /^STEEL\d/,
  /^KNIFE\d/,
  /^HOOK\d/,
  /^CHAOS\d/,
  /^HAVOC\d/,
  /^DARK\d/,
  /^SHADOW\d/,
  /^SAM\d/,      // Special Air Mission (VIP)
  /^VENUS\d*/,   // NATO AWACS
  /^NATR\d/,     // NATO training
  /^USAF\d/,
  /^NAVY\d/,
  /^SPAR\d/,     // USAF special
  /^COLT\d/,
  /^MOOSE\d/,
  /^ROCKY\d/,
  /^BISON\d/,
  /^RANGER\d/,
  /^VIPER\d/,
  /^EAGLE\d/,
  /^RAPTOR\d/,
];

// Known military high-value asset type codes (ICAO aircraft type)
const MIL_ASSET_KEYWORDS = ['B52', 'C17', 'C130', 'C5', 'KC135', 'KC46', 'E3', 'E8', 'P8', 'EP3', 'RC135'];

// ── STATE ──
const milState = {
  zones: {},         // zone results keyed by zone.id
  totalMilAircraft: 0,
  alertLevel: 0,     // 0-3
  lastFetch: null,
  fetchErrors: 0,
};

// ── OPENSKY FETCH ──
async function fetchZoneAircraft(zone) {
  const { lamin, lomin, lamax, lomax } = zone.bounds;
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.states || [];
}

// ── MILITARY AIRCRAFT FILTER ──
function filterMilitary(states) {
  return states.filter(s => {
    const icao24   = (s[0] || '').toLowerCase();
    const callsign = (s[1] || '').trim().toUpperCase();
    if (MIL_HEX_PREFIXES.some(p => icao24.startsWith(p))) return true;
    if (MIL_CALLSIGN_PATTERNS.some(p => p.test(callsign)))  return true;
    return false;
  });
}

function parseMilAircraft(states) {
  return states.map(s => ({
    icao24:    s[0] || '',
    callsign:  (s[1] || '').trim() || '(無識別)',
    country:   s[2] || '不明',
    lon:       s[5],
    lat:       s[6],
    altitude:  s[7] ? Math.round(s[7]) + ' m' : '--',
    velocity:  s[9] ? Math.round(s[9] * 3.6) + ' km/h' : '--',
    onGround:  s[8],
  }));
}

// ── ZONE ALERT LEVEL ──
function zoneAlertLevel(zone, milCount) {
  if (milCount >= zone.threshold.red)    return 3;
  if (milCount >= zone.threshold.orange) return 2;
  if (milCount >= zone.threshold.yellow) return 1;
  return 0;
}

const LEVEL_LABEL = ['通常', '警戒', '危険', '緊急'];
const LEVEL_COLOR = ['var(--accent-green)', 'var(--accent-yellow)', 'var(--accent-orange)', 'var(--accent-red)'];
const LEVEL_CLASS = ['ok', 'yellow', 'orange', 'red'];

// ── MAIN FETCH LOOP ──
async function fetchAllZones() {
  let globalMax = 0;
  let totalMil  = 0;
  const results = await Promise.allSettled(
    MILITARY_ZONES.map(zone => fetchZoneAircraft(zone))
  );

  results.forEach((res, i) => {
    const zone = MILITARY_ZONES[i];
    if (res.status === 'fulfilled') {
      const allStates  = res.value;
      const milStates  = filterMilitary(allStates);
      const milAircraft = parseMilAircraft(milStates);
      const level       = zoneAlertLevel(zone, milAircraft.length);
      milState.zones[zone.id] = {
        total:      allStates.length,
        milCount:   milAircraft.length,
        aircraft:   milAircraft,
        level,
        ok: true,
      };
      totalMil += milAircraft.length;
      if (level > globalMax) globalMax = level;
    } else {
      milState.zones[zone.id] = { total: 0, milCount: 0, aircraft: [], level: 0, ok: false };
    }
  });

  milState.totalMilAircraft = totalMil;
  milState.alertLevel = globalMax;
  milState.lastFetch  = new Date();
  milState.fetchErrors = results.filter(r => r.status === 'rejected').length;

  updateMilitaryUI();
}

// ── UI UPDATE ──
function updateMilitaryUI() {
  const total    = milState.totalMilAircraft;
  const level    = milState.alertLevel;
  const score    = Math.min(100, Math.round(20 + total * 4 + level * 15));

  // Panel score
  const scoreEl = document.getElementById('score-military');
  const barEl   = document.getElementById('bar-military');
  const statusEl = document.getElementById('status-military');
  if (scoreEl)  { scoreEl.textContent = score; scoreEl.style.color = LEVEL_COLOR[level]; }
  if (barEl)    barEl.style.width = score + '%';
  if (statusEl) {
    statusEl.textContent  = LEVEL_LABEL[level];
    statusEl.className    = 'panel-status ' + LEVEL_CLASS[level];
  }

  // Panel summary row
  const totalEl = document.getElementById('mil-total-aircraft');
  if (totalEl) totalEl.textContent = total > 0 ? total + ' 機' : milState.fetchErrors === MILITARY_ZONES.length ? 'API制限中' : '0 機';

  // Zone cards
  MILITARY_ZONES.forEach(zone => {
    const zd  = milState.zones[zone.id];
    if (!zd) return;
    const lvl = zd.level;

    const countEl  = document.getElementById(`mil-count-${zone.id}`);
    const levelEl  = document.getElementById(`mil-level-${zone.id}`);
    const listEl   = document.getElementById(`mil-list-${zone.id}`);

    if (countEl) {
      countEl.textContent  = zd.ok ? zd.milCount + '機' : '--';
      countEl.style.color  = LEVEL_COLOR[lvl];
    }
    if (levelEl) {
      levelEl.textContent  = LEVEL_LABEL[lvl];
      levelEl.className    = 'mil-zone-level lv' + lvl;
    }
    if (listEl && zd.aircraft.length > 0) {
      listEl.innerHTML = zd.aircraft.slice(0, 5).map(a =>
        `<div class="mil-aircraft-row">
          <span class="mil-cs">${a.callsign}</span>
          <span class="mil-country">${a.country}</span>
          <span class="mil-alt">${a.altitude}</span>
        </div>`
      ).join('') + (zd.aircraft.length > 5
        ? `<div class="mil-more">+ ${zd.aircraft.length - 5} 機...</div>` : '');
    } else if (listEl) {
      listEl.innerHTML = '<div class="mil-no-detect">軍用ADS-B未検出（ステルス運用中の可能性）</div>';
    }

    // Zone card border color
    const cardEl = document.getElementById(`mil-zone-${zone.id}`);
    if (cardEl) cardEl.dataset.level = lvl;
  });

  // Global military alert banner
  triggerMilitaryAlert(level, total);

  // Integrate into main Doomsday score
  if (typeof state !== 'undefined' && state.scores) {
    state.scores.military = score;
    if (typeof recalcMain === 'function') recalcMain();
  }

  // Update last-fetch time
  const timeEl = document.getElementById('mil-last-update');
  if (timeEl && milState.lastFetch) {
    timeEl.textContent = '最終更新: ' + milState.lastFetch.toLocaleTimeString('ja-JP');
  }
}

// ── ALERT TRIGGER ──
function triggerMilitaryAlert(level, milCount) {
  if (level < 1) return;

  const msgs = {
    1: `⚡ MILITARY WATCH — 戦略ゾーンで軍用機 ${milCount}機検出。通常より高い活動レベル`,
    2: `⚠ MILITARY ALERT — 複数ゾーンで軍事活動急増 (${milCount}機)。強襲揚陸艦・輸送機の集中を確認`,
    3: `🚨 MILITARY CRITICAL — 緊急アラート発令！軍用輸送機・艦艇の異常集中 (${milCount}機+)。大規模展開の可能性`,
  };

  const bannerEl = document.getElementById('alertText');
  if (bannerEl && level >= 2) bannerEl.textContent = msgs[level];

  // Flash the military panel
  const panelEl = document.getElementById('panel-military');
  if (panelEl && level >= 2) {
    panelEl.style.animation = 'none';
    panelEl.style.boxShadow = level >= 3
      ? '0 0 30px rgba(255,0,68,0.6), inset 0 0 20px rgba(255,0,68,0.1)'
      : '0 0 20px rgba(255,136,0,0.4), inset 0 0 15px rgba(255,136,0,0.08)';
  }
}

// ── INIT ──
async function initMilitaryMonitor() {
  renderMilitarySectionUI();
  await fetchAllZones();
  // Refresh every 5 minutes (OpenSky rate limit: ~400 calls/day anonymous)
  setInterval(fetchAllZones, 5 * 60 * 1000);
}

// ── RENDER STATIC HTML FOR MILITARY SECTION ──
function renderMilitarySectionUI() {
  const container = document.getElementById('militaryZoneGrid');
  if (!container) return;

  container.innerHTML = MILITARY_ZONES.map(zone => `
    <div class="mil-zone-card" id="mil-zone-${zone.id}" data-level="0">
      <div class="mil-zone-header">
        <span class="mil-zone-icon">${zone.icon}</span>
        <span class="mil-zone-name">${zone.name}</span>
        <span class="mil-zone-level lv0" id="mil-level-${zone.id}">取得中</span>
      </div>
      <div class="mil-zone-count-row">
        <span class="mil-zone-label">軍用機検出数</span>
        <span class="mil-zone-count" id="mil-count-${zone.id}" style="color:var(--text-secondary)">--</span>
      </div>
      <div class="mil-zone-navy">${zone.navyNote}</div>
      <div class="mil-aircraft-list" id="mil-list-${zone.id}">
        <div class="mil-no-detect">OpenSky接続中...</div>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', initMilitaryMonitor);
