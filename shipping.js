/* ============================================================
   SHIPPING INDEX MONITOR
   Baltic Dry Index (BDI)  — Yahoo Finance (無料・キー不要)
   Freightos Baltic Index (FBX) — Freightos公開API
   更新間隔: 30分（指数は1日1回更新のため）
   ============================================================ */

// ── BDI取得 (Yahoo Finance) ──
async function fetchBDI() {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EBDI?interval=1d&range=40d';
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error('BDI fetch failed');
  const data = await res.json();
  const result = data.chart.result[0];
  const meta   = result.meta;
  const closes = result.indicators.quote[0].close.filter(v => v != null);

  const current   = Math.round(meta.regularMarketPrice);
  const prevClose = Math.round(meta.previousClose);
  const monthAgo  = Math.round(closes[0]);

  const dayChange   = ((current - prevClose) / prevClose) * 100;
  const monthChange = ((current - monthAgo)  / monthAgo)  * 100;

  return { current, prevClose, monthAgo, dayChange, monthChange };
}

// ── FBX取得 (Freightos公開API) ──
async function fetchFBX() {
  try {
    const url = 'https://fbx.freightos.com/api/widgets/fbxTable';
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('FBX fetch failed');
    const data = await res.json();
    // Freightos returns array of route objects; FBX Global (route id=0 or "Global") is total index
    const global = Array.isArray(data)
      ? data.find(r => r.route === 'Global' || r.routeId === 0 || r.name?.includes('Global'))
      : null;
    if (global) {
      const current = Math.round(global.currentRate ?? global.price ?? global.rate);
      const prev    = Math.round(global.previousRate ?? global.prevPrice ?? global.prevRate ?? current);
      return { current, change: ((current - prev) / prev) * 100, source: 'LIVE' };
    }
    throw new Error('Global route not found');
  } catch (e) {
    // FBXが取得できない場合は直近の参考値を返す
    return { current: 2180, change: 0, source: '参考値' };
  }
}

// ── スコア計算 ──
function calcShippingScore(bdi, fbx) {
  let score = 50;

  // BDIレベル判定
  if      (bdi.current < 500)  score = 92;
  else if (bdi.current < 800)  score = 82;
  else if (bdi.current < 1200) score = 68;
  else if (bdi.current < 2000) score = 45;
  else if (bdi.current < 3500) score = 50;
  else if (bdi.current < 5000) score = 62;
  else                          score = 72;

  // 月次トレンド修正
  if      (bdi.monthChange < -50) score = Math.min(97, score + 30);
  else if (bdi.monthChange < -30) score = Math.min(92, score + 20);
  else if (bdi.monthChange < -15) score = Math.min(85, score + 10);
  else if (bdi.monthChange >  60) score = Math.min(80, score + 12);
  else if (bdi.monthChange >  30) score = Math.min(72, score + 6);

  // FBX高騰修正（コンテナ運賃急上昇はサプライチェーン崩壊シグナル）
  if      (fbx.current > 8000) score = Math.min(95, score + 15);
  else if (fbx.current > 5000) score = Math.min(88, score + 8);
  else if (fbx.current > 3000) score = Math.min(75, score + 4);

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ── アラート判定 ──
function shippingAlert(bdi, fbx, score) {
  const alerts = [];

  if (bdi.current < 600)
    alerts.push('🚨 BDI危機域: 世界貿易崩壊シグナル検出');
  else if (bdi.current < 1000)
    alerts.push('⚡ BDI低危険域: 世界需要急減速を示唆');

  if (bdi.monthChange < -30)
    alerts.push(`⚡ BDI月次急落: ${bdi.monthChange.toFixed(1)}% — 景気後退加速の可能性`);

  if (fbx.current > 5000)
    alerts.push('🚨 FBX急騰: コンテナ運賃が危機水準 — サプライチェーン崩壊リスク');
  else if (fbx.current > 3000)
    alerts.push('▲ FBX上昇: 海上輸送コスト高騰中');

  return alerts;
}

// ── UI更新 ──
function updateShippingPanel(bdi, fbx, score) {
  // スコアバー・ステータス
  const statusText = score >= 80 ? '危険' : score >= 60 ? '警戒' : '監視中';
  if (typeof updatePanel === 'function') {
    updatePanel('shipping', score, statusText);
  }

  // BDI値
  const bdiEl = document.getElementById('bdi-value');
  if (bdiEl) {
    bdiEl.textContent = bdi.current.toLocaleString();
    bdiEl.style.color = bdi.current < 800
      ? 'var(--accent-red)'
      : bdi.current < 1200
      ? 'var(--accent-orange)'
      : 'var(--accent-green)';
  }

  const bdiChangeEl = document.getElementById('bdi-change');
  if (bdiChangeEl) {
    const sign = bdi.monthChange >= 0 ? '+' : '';
    bdiChangeEl.textContent = `${sign}${bdi.monthChange.toFixed(1)}% (月次)`;
    bdiChangeEl.style.color = bdi.monthChange < -15
      ? 'var(--accent-red)'
      : bdi.monthChange < 0
      ? 'var(--accent-orange)'
      : 'var(--accent-green)';
  }

  // BDI日次矢印
  if (typeof setArrow === 'function') {
    setArrow('bdi-arrow', bdi.dayChange);
  }

  // FBX値
  const fbxEl = document.getElementById('fbx-value');
  if (fbxEl) {
    fbxEl.textContent = '$' + fbx.current.toLocaleString();
    fbxEl.style.color = fbx.current > 5000
      ? 'var(--accent-red)'
      : fbx.current > 3000
      ? 'var(--accent-orange)'
      : 'var(--text-primary)';
  }

  const fbxSrcEl = document.getElementById('fbx-source');
  if (fbxSrcEl) fbxSrcEl.textContent = fbx.source;

  // アラートバナー追記
  const alerts = shippingAlert(bdi, fbx, score);
  if (alerts.length > 0) {
    const noteEl = document.getElementById('note-shipping');
    if (noteEl) noteEl.textContent = alerts[0];
  }

  // グローバルステートに反映 → メインスコア再計算
  if (typeof state !== 'undefined') {
    state.scores.shipping = score;
    if (typeof recalcMain === 'function') recalcMain();
  }
}

// ── メイン処理 ──
async function fetchShipping() {
  try {
    const [bdi, fbx] = await Promise.allSettled([fetchBDI(), fetchFBX()]);

    const bdiData = bdi.status === 'fulfilled'
      ? bdi.value
      : { current: 1350, prevClose: 1350, monthAgo: 1350, dayChange: 0, monthChange: 0 };

    const fbxData = fbx.status === 'fulfilled'
      ? fbx.value
      : { current: 2180, change: 0, source: 'オフライン' };

    const score = calcShippingScore(bdiData, fbxData);
    updateShippingPanel(bdiData, fbxData, score);

    const noteEl = document.getElementById('note-shipping');
    if (noteEl && bdi.status === 'fulfilled') {
      noteEl.textContent = `データ: Baltic Exchange / Yahoo Finance | BDI前日比: ${bdiData.dayChange >= 0 ? '+' : ''}${bdiData.dayChange.toFixed(1)}%`;
    }
  } catch (e) {
    console.warn('Shipping fetch error:', e);
    if (typeof updatePanel === 'function') {
      updatePanel('shipping', 50, 'オフライン');
    }
  }
}

// ── 初期化・定期更新（30分ごと）──
document.addEventListener('DOMContentLoaded', () => {
  fetchShipping();
  setInterval(fetchShipping, 30 * 60 * 1000);
});
