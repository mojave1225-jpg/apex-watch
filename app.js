/* ============================================================
   APEX WATCH — Data Engine
   Live APIs: CoinGecko, Alternative.me Fear & Greed
   Static curated: all other indicators
   ============================================================ */

// ── STATE ──
const state = {
  btc: null, eth: null, gold: null, fearGreed: null,
  scores: { assets: 0, residency: 72, medical: 78, comms: 81, mobility: 67, security: 85, military: 40, bizjet: 40, shipping: 50 },
  apiReady: false,
};

// ── CLOCK ──
function updateClock() {
  const now = new Date();
  const utc = now.toUTCString().replace('GMT', 'UTC').split(' ').slice(4).join(' ');
  document.getElementById('clock').textContent = utc;
}
setInterval(updateClock, 1000);
updateClock();

// ── COINGECKO: BTC & ETH ──
async function fetchCrypto() {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('CoinGecko error');
    const data = await res.json();

    state.btc = data.bitcoin;
    state.eth = data.ethereum;

    const btcPrice = data.bitcoin.usd;
    const btcChange = data.bitcoin.usd_24h_change;
    const ethPrice = data.ethereum.usd;
    const ethChange = data.ethereum.usd_24h_change;

    document.getElementById('btc-price').textContent = '$' + btcPrice.toLocaleString();
    document.getElementById('eth-price').textContent = '$' + ethPrice.toLocaleString();

    setArrow('btc-arrow', btcChange);
    setArrow('eth-arrow', ethChange);

    // BTC score contribution: high price + high positive = risk signal
    const btcScore = Math.min(100, Math.max(0,
      50 + (btcPrice > 80000 ? 20 : 0) + (btcPrice > 100000 ? 15 : 0) + (btcChange > 5 ? 10 : 0)
    ));

    state.scores.assets = Math.round((btcScore + (state.gold ? goldScore() : 70) + (state.fearGreed ? fgScore() : 60)) / 3);
    updatePanel('assets', state.scores.assets, 'LIVE');
    recalcMain();

    return true;
  } catch (e) {
    console.warn('CoinGecko fetch failed:', e.message);
    document.getElementById('btc-price').textContent = '取得失敗';
    document.getElementById('eth-price').textContent = '取得失敗';
    state.scores.assets = 68;
    updatePanel('assets', state.scores.assets, 'オフライン');
    recalcMain();
    return false;
  }
}

// ── ALTERNATIVE.ME: FEAR & GREED ──
async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('FG error');
    const data = await res.json();
    const value = parseInt(data.data[0].value);
    const label = data.data[0].value_classification;

    state.fearGreed = value;
    document.getElementById('fear-greed').textContent = value + ' / ' + label;
    setArrow('fg-arrow', value > 60 ? 10 : value < 30 ? -10 : 0);
    return true;
  } catch (e) {
    console.warn('FearGreed fetch failed:', e.message);
    document.getElementById('fear-greed').textContent = 'オフライン';
    return false;
  }
}

// ── GOLD: Metals-API alternative (frankfurter.app doesn't have gold; use approximation) ──
async function fetchGold() {
  // Use a proxy-free public API for gold spot price
  try {
    // Try open.er-api.com for USD/XAU
    const res = await fetch('https://open.er-api.com/v6/latest/XAU', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('Gold API error');
    const data = await res.json();
    if (data && data.rates && data.rates.USD) {
      const goldUSD = Math.round(data.rates.USD);
      state.gold = goldUSD;
      document.getElementById('gold-price').textContent = '$' + goldUSD.toLocaleString();
      setArrow('gold-arrow', goldUSD > 2500 ? 10 : 0);
      return true;
    }
    throw new Error('No XAU data');
  } catch (e) {
    // Fallback: show curated value
    state.gold = 3420;
    document.getElementById('gold-price').textContent = '~$3,420 (参考値)';
    setArrow('gold-arrow', 10);
    return false;
  }
}

// ── SCORE HELPERS ──
function goldScore() {
  if (!state.gold) return 70;
  return Math.min(100, Math.max(0, 40 + (state.gold > 2000 ? 20 : 0) + (state.gold > 3000 ? 20 : 0) + (state.gold > 3500 ? 15 : 0)));
}

function fgScore() {
  if (!state.fearGreed) return 60;
  // Extreme greed (>75) or extreme fear (<20) both = elevated risk signal
  const fg = state.fearGreed;
  if (fg > 80) return 80;
  if (fg < 20) return 85;
  if (fg > 65) return 70;
  return 55;
}

// ── PANEL UPDATER ──
function updatePanel(id, score, statusText) {
  document.getElementById('score-' + id).textContent = score;
  const bar = document.getElementById('bar-' + id);
  bar.style.width = score + '%';

  const statusEl = document.getElementById('status-' + id);
  statusEl.textContent = statusText || '完了';
  statusEl.className = 'panel-status ' + (score >= 80 ? 'danger' : score >= 60 ? 'warn' : 'ok');

  // Color the score number
  const scoreEl = document.getElementById('score-' + id);
  if (score >= 80) scoreEl.style.color = 'var(--accent-red)';
  else if (score >= 60) scoreEl.style.color = 'var(--accent-orange)';
  else scoreEl.style.color = 'var(--accent-yellow)';
}

// ── ARROW HELPER ──
function setArrow(id, change) {
  const el = document.getElementById(id);
  if (!el) return;
  if (change > 0) { el.textContent = '↑'; el.className = 'ind-arrow up'; }
  else if (change < 0) { el.textContent = '↓'; el.className = 'ind-arrow'; el.style.color = 'var(--accent-green)'; }
  else { el.textContent = '→'; el.className = 'ind-arrow'; }
}

// ── MAIN SCORE RECALC ──
function recalcMain() {
  const s = state.scores;
  const weights = { assets: 0.14, residency: 0.09, medical: 0.07, comms: 0.10, mobility: 0.09, security: 0.12, military: 0.14, bizjet: 0.15, shipping: 0.10 };
  const total = Math.round(
    s.assets    * weights.assets +
    s.residency * weights.residency +
    s.medical   * weights.medical +
    s.comms     * weights.comms +
    s.mobility  * weights.mobility +
    s.security  * weights.security +
    (s.military  || 40) * weights.military +
    (s.bizjet    || 40) * weights.bizjet +
    (s.shipping  || 50) * weights.shipping
  );

  document.getElementById('mainScore').textContent = total;

  let label, color;
  if (total >= 85) { label = '⚠ 緊急レベル: アポカリプス準備完了'; color = 'var(--accent-red)'; }
  else if (total >= 70) { label = '⚡ 危険レベル: 大規模逃避フェーズ'; color = 'var(--accent-orange)'; }
  else if (total >= 55) { label = '▲ 警戒レベル: 資産分散進行中'; color = 'var(--accent-yellow)'; }
  else { label = '◈ 監視レベル: 通常範囲内'; color = 'var(--accent-green)'; }

  const labelEl = document.getElementById('threatLabel');
  labelEl.textContent = label;
  labelEl.style.color = color;

  const scoreEl = document.getElementById('mainScore');
  scoreEl.style.color = color;
  scoreEl.style.textShadow = `0 0 20px ${color.replace(')', ', 0.6)')}, 0 0 40px ${color.replace(')', ', 0.3)')}`;

  // Arc animation: 0=full dashoffset(408), 100=0 dashoffset
  const dashOffset = Math.round(408 * (1 - total / 100));
  document.getElementById('activeArc').style.strokeDashoffset = dashOffset;

  // Needle: 0=-90deg, 100=+90deg
  const deg = -90 + (total / 100) * 180;
  document.getElementById('needle').style.transform = `rotate(${deg}deg)`;

  // Alert banner
  updateAlertBanner(total);
  
  // Auto-update DEFCON based on current scores (if function is available)
  if (typeof calculateDefconFromIndicators === 'function') {
    calculateDefconFromIndicators();
  }
}

// ── ALERT BANNER ──
function updateAlertBanner(score) {
  const messages = [
    score >= 85 ? '⚠⚠⚠ CRITICAL — エリート層の緊急避難行動が検出されました。複数の主要指標が過去最高を記録しています' : null,
    score >= 70 ? '⚡ ELEVATED — 資産逃避・移住・バンカー建設の同時加速を確認。システム経営陣クラスの動きが顕著' : null,
    score >= 55 ? '▲ WATCH — 通常を超えた資産分散・居住権取得パターンを検出中。引き続き監視' : null,
    '◈ MONITOR — 全6カテゴリを継続監視中。次回データ更新: 60秒後',
  ].find(Boolean);

  document.getElementById('alertText').textContent = messages;
}

// ── NEWS GRID RENDERER ──
function renderNews() {
  const grid = document.getElementById('newsGrid');
  grid.innerHTML = NEWS_ITEMS.map(item => `
    <div class="news-card">
      <div class="news-card-tag ${item.tagClass}">${item.tag}</div>
      <div class="news-card-title">${item.title}</div>
      <div class="news-card-meta">${item.meta}</div>
    </div>
  `).join('');
}

// ── TICKER RENDERER ──
function renderTicker() {
  const ticker = document.getElementById('newsTicker');
  ticker.innerHTML = TICKER_ITEMS.map(t =>
    `<span class="ticker-item ${t.cls}">${t.text}</span>`
  ).join('');
  document.getElementById('newsRefresh').textContent = '最終更新: ' + new Date().toLocaleTimeString('ja-JP');
}

// ── TIMELINE RENDERER ──
function renderTimeline() {
  const track = document.getElementById('timelineTrack');
  track.innerHTML = TIMELINE_EVENTS.map(ev => `
    <div class="timeline-event">
      <div class="timeline-date">${ev.date}</div>
      <div class="timeline-dot ${ev.level}"></div>
      <div class="timeline-text">${ev.text}</div>
    </div>
  `).join('');
}

function scoreFromDomOrState(domId, stateKey, fallback) {
  const el = document.getElementById(domId);
  if (el) {
    const parsed = parseInt(String(el.textContent).replace(/[^0-9-]/g, ''), 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const stateVal = state.scores[stateKey];
  return Number.isFinite(stateVal) ? stateVal : fallback;
}

function renderCommandDeck() {
  const globalRisk = parseInt(document.getElementById('mainScore')?.textContent || '0', 10) || 0;
  const military = scoreFromDomOrState('score-military', 'military', 40);
  const bizjet = scoreFromDomOrState('score-bizjet', 'bizjet', 40);
  const shipping = scoreFromDomOrState('score-shipping', 'shipping', 50);
  const security = scoreFromDomOrState('score-security', 'security', 75);

  const conflictClusters = Math.max(6, Math.round((globalRisk + military) / 14));
  const mobilityAlerts = Math.max(4, Math.round((bizjet + military) / 18));
  const infraStress = Math.max(10, Math.round((shipping + security + globalRisk) / 3));

  const globalRiskEl = document.getElementById('cmd-global-risk');
  if (globalRiskEl) globalRiskEl.textContent = globalRisk;

  const conflictEl = document.getElementById('cmd-conflict-clusters');
  if (conflictEl) conflictEl.textContent = conflictClusters;

  const mobilityEl = document.getElementById('cmd-mobility-alerts');
  if (mobilityEl) mobilityEl.textContent = mobilityAlerts;

  const infraEl = document.getElementById('cmd-infra-stress');
  if (infraEl) infraEl.textContent = `${infraStress}%`;

  const syncEl = document.getElementById('cmd-sync-status');
  if (syncEl) syncEl.textContent = state.apiReady ? 'synced' : 'syncing';

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const updatedEl = document.getElementById('cmd-last-update');
  if (updatedEl) updatedEl.textContent = `updated ${hh}:${mm}`;

  const defconLink = document.getElementById('cmd-defcon-link');
  if (defconLink) {
    defconLink.textContent = globalRisk >= 80 ? 'high lock' : globalRisk >= 60 ? 'elevated sync' : 'stable';
  }

  const maritimePressure = document.getElementById('cmd-maritime-pressure');
  if (maritimePressure) {
    maritimePressure.textContent = shipping >= 75 ? 'red lane stress' : shipping >= 55 ? 'watchlisted' : 'nominal';
  }

  const crossAnomaly = document.getElementById('cmd-cross-anomaly');
  if (crossAnomaly) {
    const anomaly = Math.round((military + bizjet + globalRisk) / 3);
    crossAnomaly.textContent = `${anomaly}/100`;
  }

  const theaters = [
    { name: 'Taiwan Strait / East China Sea', score: Math.round((military + globalRisk) / 2) },
    { name: 'Persian Gulf / Hormuz', score: Math.round((military * 0.85) + (shipping * 0.15)) },
    { name: 'Baltic / Eastern Europe', score: Math.round((military * 0.75) + (security * 0.25)) },
    { name: 'Pacific Logistics Corridor', score: Math.round((shipping * 0.7) + (bizjet * 0.3)) },
  ];

  const theaterGrid = document.getElementById('cmd-theater-grid');
  if (theaterGrid) {
    theaterGrid.innerHTML = theaters.map((t) => {
      const val = Math.max(0, Math.min(100, t.score));
      return `
        <div class="cmd-theater-row">
          <div class="cmd-theater-top">
            <span class="cmd-theater-name">${t.name}</span>
            <span class="cmd-theater-score">${val}</span>
          </div>
          <div class="cmd-theater-bar"><div class="cmd-theater-fill" style="width:${val}%"></div></div>
        </div>
      `;
    }).join('');
  }

  const feed = document.getElementById('cmd-incident-feed');
  if (feed) {
    const feedItems = NEWS_ITEMS.slice(0, 6).map((item, i) => {
      const severity = item.tagClass === 'red' ? 'critical' : item.tagClass === 'orange' ? 'warn' : 'info';
      const minuteAgo = (i * 7) + 2;
      return {
        severity,
        tag: item.tag,
        title: item.title,
        time: `${minuteAgo}m ago`,
      };
    });

    feed.innerHTML = feedItems.map((item) => `
      <article class="cmd-incident-item ${item.severity}">
        <div class="cmd-incident-top">
          <span class="cmd-incident-tag">${item.tag}</span>
          <span class="cmd-incident-time">${item.time}</span>
        </div>
        <div class="cmd-incident-title">${item.title}</div>
      </article>
    `).join('');
  }
}

// ── STATIC PANELS ──
function initStaticPanels() {
  updatePanel('residency', 72, '監視中');
  updatePanel('medical', 78, '監視中');
  updatePanel('comms', 81, '監視中');
  updatePanel('mobility', 67, '監視中');
  updatePanel('security', 85, '監視中');
}

// ── INIT ──
async function init() {
  renderCommandDeck();
  renderNews();
  renderTicker();
  renderTimeline();
  initStaticPanels();

  // Animate panels in sequence
  const panelIds = ['assets', 'residency', 'medical', 'comms', 'mobility', 'security'];
  panelIds.forEach((id, i) => {
    setTimeout(() => {
      const el = document.getElementById('panel-' + id);
      if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.5s'; el.style.opacity = '1'; }
    }, i * 150);
  });

  // Initial score estimate
  state.scores.assets = 71;
  recalcMain();

  // Fetch live data
  await Promise.allSettled([
    fetchCrypto(),
    fetchFearGreed(),
    fetchGold(),
  ]);

  // Recalc after all data
  state.scores.assets = Math.round(
    (state.btc ? Math.min(100, 50 + (state.btc.usd > 80000 ? 20 : 0) + (state.btc.usd > 100000 ? 15 : 0)) : 70) * 0.4 +
    goldScore() * 0.35 +
    fgScore() * 0.25
  );
  updatePanel('assets', state.scores.assets, 'LIVE');
  recalcMain();
  renderCommandDeck();
  state.apiReady = true;
}

// ── AUTO-REFRESH ──
async function refresh() {
  await Promise.allSettled([fetchCrypto(), fetchFearGreed(), fetchGold()]);
  renderTicker();
  recalcMain();
  renderCommandDeck();
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  setInterval(refresh, 60000); // Refresh every 60s
});
