/* ============================================================
   DEFCON & FPCON Status Panel
   DEFCON : 民間監視サイト推定値 (DefconWarningSystem / DefconLevel)
   FPCON  : 在日米軍 USFJ 公開情報に基づく推定
   ============================================================ */

const DEFCON_CFG = {
  5: { label: 'FADE OUT',      desc: '平常態勢 / 核脅威なし',           color: '#00ff88' },
  4: { label: 'DOUBLE TAKE',   desc: '低警戒 / 通常情報収集強化',        color: '#00ccff' },
  3: { label: 'ROUNDHOUSE',    desc: '通常警戒 / 全軍準戦闘待機中',      color: '#ffdd00' },
  2: { label: 'FAST PACE',     desc: '高度警戒 / 核攻撃即応態勢',        color: '#ff8800' },
  1: { label: 'COCKED PISTOL', desc: '核攻撃差し迫り / 最大緊急',        color: '#ff0044' },
};

const FPCON_CFG = {
  NORMAL:  { idx: 0, desc: '通常態勢 / 脅威情報なし',            color: '#00ff88' },
  ALPHA:   { idx: 1, desc: '一般的脅威あり / 警戒強化',          color: '#00ccff' },
  BRAVO:   { idx: 2, desc: '特定脅威 / 検問・警備増強',          color: '#ffdd00' },
  CHARLIE: { idx: 3, desc: '攻撃の具体的兆候 / 施設封鎖',        color: '#ff8800' },
  DELTA:   { idx: 4, desc: '攻撃発生または差し迫り / 最大防護',  color: '#ff0044' },
};

// 現在の推定値
// DEFCON 3: 冷戦後の標準値。ウクライナ戦争・北朝鮮核開発継続により据え置き
// FPCON BRAVO: 北朝鮮のICBM・核開発継続、中国・台湾情勢を受け在日米軍は警戒強化中
let defconLevel  = 3;
let fpconLevel   = 'BRAVO';
let defconSource = '推定 · DefconWarningSystem.com';
let fpconSource  = 'USFJ 公開情報 · 北朝鮮脅威継続中';

// ── AUTOMATIC CALCULATION STATE ──
let naoAlertLevel = 0;  // NATO Alert Level (0-3)
let naoSource = '監視中...';
let autoDefconUpdatedAt = null;

// ── RENDER ──
function renderDefcon() {
  const cfg = DEFCON_CFG[defconLevel];

  const row = document.getElementById('defcon-indicators');
  if (row) {
    row.innerHTML = [5, 4, 3, 2, 1].map(lv => {
      const active = lv === defconLevel;
      const c = DEFCON_CFG[lv].color;
      return `<div class="ts-box${active ? ' ts-active' : ''}" title="DEFCON ${lv}: ${DEFCON_CFG[lv].label}" style="${
        active
          ? `background:${c};color:#020810;border-color:${c};box-shadow:0 0 10px ${c}99`
          : `border-color:${c}30;color:${c}50`
      }">${lv}</div>`;
    }).join('');
  }

  const lvEl = document.getElementById('defcon-level');
  if (lvEl) {
    lvEl.textContent = `LV.${defconLevel} ${cfg.label}`;
    lvEl.style.color = cfg.color;
    lvEl.style.textShadow = `0 0 10px ${cfg.color}77`;
  }
  const dEl = document.getElementById('defcon-desc');
  if (dEl) dEl.textContent = cfg.desc;
  const sEl = document.getElementById('defcon-src');
  if (sEl) sEl.textContent = defconSource;
}

function renderFpcon() {
  const keys = ['NORMAL', 'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];
  const cfg  = FPCON_CFG[fpconLevel];

  const row = document.getElementById('fpcon-indicators');
  if (row) {
    row.innerHTML = keys.map(k => {
      const active = k === fpconLevel;
      const c = FPCON_CFG[k].color;
      return `<div class="ts-box${active ? ' ts-active' : ''}" title="FPCON ${k}: ${FPCON_CFG[k].desc}" style="${
        active
          ? `background:${c};color:#020810;border-color:${c};box-shadow:0 0 10px ${c}99`
          : `border-color:${c}30;color:${c}50`
      }">${k[0]}</div>`;
    }).join('');
  }

  const lvEl = document.getElementById('fpcon-level');
  if (lvEl) {
    lvEl.textContent = fpconLevel;
    lvEl.style.color = cfg.color;
    lvEl.style.textShadow = `0 0 10px ${cfg.color}77`;
  }
  const dEl = document.getElementById('fpcon-desc');
  if (dEl) dEl.textContent = cfg.desc;
  const sEl = document.getElementById('fpcon-src');
  if (sEl) sEl.textContent = fpconSource;
}

// ── LIVE FETCH ATTEMPTS ──
// CORS制約のため多くは失敗するが、成功した場合は表示を更新する

async function tryFetchDefcon() {
  // Attempt: DefconWarningSystem RSS feed
  try {
    const res = await fetch('https://www.defconwarningsystem.com/feed/', {
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const txt = await res.text();
      const m = txt.match(/DEFCON\s*([1-5])/i);
      if (m) {
        defconLevel  = parseInt(m[1]);
        defconSource = `DefconWarningSystem.com · ${new Date().toLocaleDateString('ja-JP')}`;
        return;
      }
    }
  } catch (_) {}

  // Attempt: defconlevel.com (likely CORS-blocked)
  try {
    const res = await fetch('https://www.defconlevel.com/', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const txt = await res.text();
      const m = txt.match(/DEFCON[^\d]*([1-5])/i);
      if (m) {
        defconLevel  = parseInt(m[1]);
        defconSource = `DefconLevel.com · ${new Date().toLocaleDateString('ja-JP')}`;
        return;
      }
    }
  } catch (_) {}

  // Static fallback
  defconSource = `推定 · 民間監視 · ${new Date().toLocaleDateString('ja-JP')}`;
}

async function tryFetchFpcon() {
  // USFJ公式サイトのニュースページでFPCON変更通知を確認
  try {
    const res = await fetch('https://www.usfj.mil/News/', {
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const txt = await res.text();
      const levels = ['DELTA', 'CHARLIE', 'BRAVO', 'ALPHA', 'NORMAL'];
      for (const k of levels) {
        if (
          txt.toUpperCase().includes(`FPCON ${k}`) ||
          txt.toUpperCase().includes(`FORCE PROTECTION CONDITION ${k}`)
        ) {
          fpconLevel  = k;
          fpconSource = `USFJ.mil · ${new Date().toLocaleDateString('ja-JP')}`;
          return;
        }
      }
    }
  } catch (_) {}

  fpconSource = `USFJ 公開情報基準 · ${new Date().toLocaleDateString('ja-JP')}`;
}

// ── AUTO-CALCULATE DEFCON FROM REAL-TIME INDICATORS ──
/**
 * Calculate DEFCON level automatically based on military/geopolitical indicators
 * Input: scores from state (military, bizjet, shipping) + NATO alert level
 * Output: Recommended DEFCON level (1-5) + update rationale
 */
function calculateDefconFromIndicators() {
  const s = state.scores || {};
  
  // Factors:
  // - military (0-100): Direct NATO/geopolitical indicator
  // - bizjet (0-100): Asset flight indicator (elite escape)
  // - shipping (0-100): Baltic Dry Index / commerce disruption
  // - naoAlertLevel (0-3): NATO alert escalation
  
  const militaryScore = s.military || 40;
  const bizjetScore = s.bizjet || 40;
  const shippingScore = s.shipping || 50;
  
  // Weighted calc: 50% military, 20% bizjet, 15% shipping, 15% NATO alert
  const indicatorScore = Math.round(
    militaryScore * 0.50 +
    bizjetScore * 0.20 +
    shippingScore * 0.15 +
    (naoAlertLevel * 25) * 0.15  // naoAlertLevel: 0-3 → 0-75 range
  );
  
  // DEFCON mapping: indicatorScore → DEFCON level
  let newDefconLevel;
  if (indicatorScore >= 85) {
    newDefconLevel = 1;  // COCKED PISTOL
  } else if (indicatorScore >= 75) {
    newDefconLevel = 2;  // FAST PACE
  } else if (indicatorScore >= 60) {
    newDefconLevel = 3;  // ROUNDHOUSE
  } else if (indicatorScore >= 45) {
    newDefconLevel = 4;  // DOUBLE TAKE
  } else {
    newDefconLevel = 5;  // FADE OUT
  }
  
  // Update if changed
  if (newDefconLevel !== defconLevel) {
    const oldLevel = defconLevel;
    defconLevel = newDefconLevel;
    defconSource = `自動判定 · 軍事${militaryScore} + BizJet${bizjetScore} + 海運${shippingScore} · ${new Date().toLocaleTimeString('ja-JP')}`;
    
    console.log(`[DEFCON UPDATE] ${oldLevel}→${newDefconLevel} (score:${indicatorScore})`);
    renderDefcon();
  }
  
  autoDefconUpdatedAt = new Date();
}

// ── FETCH NATO ALERT STATUS ──
async function fetchNATOAlertStatus() {
  try {
    // NATO/OSCEの公式フィードは公開APIが無いため、軍事活動スコアに基づく
    // ヒューリスティック推定を使用(旧実装の未使用fetch 2本は404を出す
    // だけだったため削除 — 2026-07-04)
    const now = new Date();
    
    // If recent high military activity detected, increase NATO alert
    if (state.scores.military > 70) {
      naoAlertLevel = Math.min(3, Math.floor(state.scores.military / 30));
      naoSource = `NATO即応 · 地域紛争監視中 · ${now.toLocaleDateString('ja-JP')}`;
    } else if (state.scores.military > 50) {
      naoAlertLevel = Math.max(1, Math.floor(state.scores.military / 40));
      naoSource = `NATO警戒 · 標準監視 · ${now.toLocaleDateString('ja-JP')}`;
    } else {
      naoAlertLevel = 0;
      naoSource = `NATO通常 · ${now.toLocaleDateString('ja-JP')}`;
    }
    
    // Recalculate DEFCON based on new NATO alert
    calculateDefconFromIndicators();
    
  } catch (e) {
    console.warn('NATO alert fetch failed:', e.message);
  }
}

// ── AUTO-UPDATE LOOP ──
function startAutoDefconUpdate() {
  // Initial calculation
  calculateDefconFromIndicators();
  fetchNATOAlertStatus();
  
  // Re-check every 2 minutes or when indicators change significantly
  setInterval(() => {
    fetchNATOAlertStatus();
  }, 120000);
}

// ── INIT ──
async function initThreatStatus() {
  renderDefcon();
  renderFpcon();

  await Promise.allSettled([tryFetchDefcon(), tryFetchFpcon()]);

  renderDefcon();
  renderFpcon();
  
  // Start auto-DEFCON update engine
  startAutoDefconUpdate();
}

document.addEventListener('DOMContentLoaded', initThreatStatus);
