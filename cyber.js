/* ============================================================
   APEX WATCH — Cyber Threat Visualization v3 (Canvas / SVG foreignObject)
   Kaspersky-style: comet trail + impact ripples + 60 fps rAF loop
   Canvas is embedded in the SVG via <foreignObject> so coordinates
   always match the D3 projection exactly, regardless of CSS scaling.
   ============================================================ */

const CYBER_TYPES = [
  { name: 'DDoS',       color: '#ff1a4e', weight: 28 },
  { name: 'Malware',    color: '#ff8c00', weight: 24 },
  { name: 'Phishing',   color: '#ffe600', weight: 20 },
  { name: 'Ransomware', color: '#cc00ff', weight: 16 },
  { name: 'Exploit',    color: '#00d4ff', weight: 12 },
];

const CYBER_NODES = {
  CN: { name: '中国',            c: [104.2,  35.9] },
  RU: { name: 'ロシア',          c: [105.3,  61.5] },
  US: { name: '米国',            c: [-95.7,  37.1] },
  KP: { name: '北朝鮮',          c: [127.5,  40.3] },
  IR: { name: 'イラン',          c: [ 53.7,  32.4] },
  BR: { name: 'ブラジル',        c: [-51.9, -14.2] },
  UA: { name: 'ウクライナ',      c: [ 31.2,  48.4] },
  IN: { name: 'インド',          c: [ 79.0,  20.6] },
  DE: { name: 'ドイツ',          c: [ 10.5,  51.2] },
  GB: { name: '英国',            c: [ -3.4,  55.4] },
  JP: { name: '日本',            c: [138.3,  36.2] },
  KR: { name: '韓国',            c: [127.8,  35.9] },
  NL: { name: 'オランダ',        c: [  5.3,  52.1] },
  FR: { name: 'フランス',        c: [  2.2,  46.2] },
  AU: { name: '豪州',            c: [133.8, -25.3] },
  TW: { name: '台湾',            c: [121.0,  23.7] },
  IL: { name: 'イスラエル',      c: [ 34.9,  31.1] },
  SA: { name: 'サウジアラビア',  c: [ 45.1,  23.9] },
  PL: { name: 'ポーランド',      c: [ 19.1,  51.9] },
  CA: { name: 'カナダ',          c: [-96.8,  56.1] },
  SG: { name: 'シンガポール',    c: [103.8,   1.4] },
  TR: { name: 'トルコ',          c: [ 35.2,  38.9] },
  SE: { name: 'スウェーデン',    c: [ 18.6,  60.1] },
  CH: { name: 'スイス',          c: [  8.2,  46.8] },
  UA2:{ name: 'ウクライナ',      c: [ 31.2,  48.4] },
};

const CYBER_SOURCES = [
  { k: 'CN', w: 32 }, { k: 'RU', w: 26 }, { k: 'KP', w: 12 },
  { k: 'IR', w: 10 }, { k: 'US', w:  6 }, { k: 'BR', w:  4 },
  { k: 'IN', w:  4 }, { k: 'NL', w:  3 }, { k: 'UA', w:  3 },
];
const CYBER_TARGETS = [
  'US','DE','GB','JP','KR','FR','AU','TW',
  'IL','SA','PL','CA','IN','SG','TR','SE','CH',
];

// ── Utilities ──
function cyWrand(arr) {
  let r = Math.random() * arr.reduce((s, i) => s + i.w, 0);
  for (const i of arr) { r -= i.w; if (r <= 0) return i.k; }
  return arr[arr.length - 1].k;
}
function cyPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function cyPickType() {
  let r = Math.random() * CYBER_TYPES.reduce((s, t) => s + t.weight, 0);
  for (const t of CYBER_TYPES) { r -= t.weight; if (r <= 0) return t; }
  return CYBER_TYPES[0];
}

// ── Module state ──
let _cv = null, _cx = null, _proj = null;
let _attacks = [], _ripples = [];
let _totalHits = 0, _lastTs = 0;
const MAX_TRAVEL = 16;
const TAIL_FRAC  = 0.32;   // tail length as fraction of arc
const ARC_STEPS  = 80;     // interpolation points per arc

// ── Great-circle interpolation → pixel array ──
function buildArcPoints(srcGeo, tgtGeo) {
  const interp = d3.geoInterpolate(srcGeo, tgtGeo);
  const pts = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const p = _proj(interp(i / ARC_STEPS));
    if (p) pts.push(p);
  }
  return pts;
}

// ── Attack object factory ──
function makeAttack(sk, tk, type) {
  const src = CYBER_NODES[sk], tgt = CYBER_NODES[tk];
  if (!src || !tgt) return null;
  const pts = buildArcPoints(src.c, tgt.c);
  if (pts.length < 8) return null;
  const tp = _proj(tgt.c);
  if (!tp) return null;
  return {
    pts, tgtPx: tp,
    color: type.color, typeName: type.name,
    srcName: src.name, tgtName: tgt.name,
    progress: 0,
    speed: 0.22 + Math.random() * 0.20,   // arc-fraction per second
    phase: 'travel',   // 'travel' | 'linger' | 'fade'
    alpha: 1.0,
  };
}

// ── Canvas drawing ──
function polyline(pts, lw, alpha) {
  if (pts.length < 2) return;
  _cx.beginPath();
  _cx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) _cx.lineTo(pts[i][0], pts[i][1]);
  _cx.lineWidth   = lw;
  _cx.globalAlpha = alpha;
  _cx.stroke();
}

function updateAndDrawAttack(a, dt) {
  // Phase transitions
  if (a.phase === 'travel') {
    a.progress += a.speed * dt;
    if (a.progress >= 1.0) {
      a.progress = 1.0;
      a.phase = 'linger';
      a.lingerTimer = 0.30;   // seconds to linger
      onImpact(a);
    }
  } else if (a.phase === 'linger') {
    a.lingerTimer -= dt;
    if (a.lingerTimer <= 0) a.phase = 'fade';
  } else {
    a.alpha -= dt * 2.2;
    if (a.alpha <= 0) return false;
  }

  const n    = a.pts.length - 1;
  const hIdx = Math.min(Math.floor(a.progress * n), n);
  const tIdx = Math.max(0, Math.floor((a.progress - TAIL_FRAC) * n));
  if (hIdx <= tIdx + 1) return true;

  const tail = a.pts.slice(tIdx, hIdx + 1);
  const mid  = a.pts.slice(tIdx + Math.floor(tail.length * 0.45), hIdx + 1);
  const near = a.pts.slice(Math.max(tIdx, hIdx - Math.floor(n * 0.10)), hIdx + 1);
  const α    = a.alpha;

  _cx.save();
  _cx.lineCap  = 'round';
  _cx.lineJoin = 'round';
  _cx.strokeStyle = a.color;

  // Layer 1 — faint base tail
  polyline(tail, 0.6, 0.10 * α);

  // Layer 2 — mid glow
  _cx.shadowBlur  = 3;
  _cx.shadowColor = a.color;
  polyline(mid, 1.2, 0.35 * α);

  // Layer 3 — bright near-head
  _cx.shadowBlur  = 8;
  _cx.shadowColor = a.color;
  polyline(near, 2.0, 0.80 * α);

  // Layer 4 — wide soft halo around head area
  _cx.shadowBlur = 0;
  polyline(near, 7, 0.07 * α);

  // Head dot (only while traveling or lingering)
  if (a.phase !== 'fade') {
    const hp = a.pts[hIdx];
    if (hp) {
      // Outer glow ring
      _cx.shadowBlur  = 16;
      _cx.shadowColor = a.color;
      _cx.beginPath();
      _cx.arc(hp[0], hp[1], 4.5, 0, Math.PI * 2);
      _cx.fillStyle   = a.color;
      _cx.globalAlpha = 0.25 * α;
      _cx.fill();
      // White hot core
      _cx.shadowBlur  = 10;
      _cx.shadowColor = '#ffffff';
      _cx.beginPath();
      _cx.arc(hp[0], hp[1], 2.5, 0, Math.PI * 2);
      _cx.fillStyle   = '#ffffff';
      _cx.globalAlpha = 0.95 * α;
      _cx.fill();
    }
  }

  _cx.restore();
  return true;
}

// ── Impact ripples ──
function onImpact(a) {
  // Three concentric expanding rings
  [
    { maxR: 10, decay: 0.030, lw: 2.0 },
    { maxR: 18, decay: 0.022, lw: 1.3 },
    { maxR: 28, decay: 0.015, lw: 0.8 },
  ].forEach(cfg => {
    _ripples.push({
      x: a.tgtPx[0], y: a.tgtPx[1],
      r: 1.5, maxR: cfg.maxR,
      decay: cfg.decay, lw: cfg.lw,
      alpha: 0.95, color: a.color,
    });
  });
  // Flash dot
  _ripples.push({
    x: a.tgtPx[0], y: a.tgtPx[1],
    r: 3, maxR: 3,
    decay: 0.06, lw: 0, fillFlash: true,
    alpha: 1.0, color: '#ffffff',
  });
  updateHUD(a);
}

function drawRipple(r, dt) {
  r.r    += (r.maxR - r.r) * 0.13;
  r.alpha -= r.decay;
  if (r.alpha <= 0) return false;
  _cx.save();
  _cx.shadowBlur  = 5;
  _cx.shadowColor = r.color;
  if (r.fillFlash) {
    _cx.beginPath();
    _cx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    _cx.fillStyle   = r.color;
    _cx.globalAlpha = r.alpha;
    _cx.fill();
  } else {
    _cx.beginPath();
    _cx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    _cx.strokeStyle = r.color;
    _cx.lineWidth   = r.lw;
    _cx.globalAlpha = r.alpha;
    _cx.stroke();
  }
  _cx.restore();
  return true;
}

// ── HUD update ──
function updateHUD(a) {
  _totalHits++;
  const cEl = document.getElementById('cyber-count');
  if (cEl) cEl.textContent = _totalHits.toLocaleString();
  const lEl = document.getElementById('cyber-last');
  if (lEl) { lEl.textContent = `${a.srcName} → ${a.tgtName}`; lEl.style.color = a.color; }
  const tEl = document.getElementById('cyber-type');
  if (tEl) {
    tEl.textContent      = a.typeName;
    tEl.style.color      = a.color;
    tEl.style.borderColor = a.color + '66';
  }
}

// ── rAF main loop ──
function cyFrame(ts) {
  const dt = _lastTs > 0 ? Math.min((ts - _lastTs) / 1000, 0.1) : 0.016;
  _lastTs = ts;
  _cx.clearRect(0, 0, _cv.width, _cv.height);
  _attacks = _attacks.filter(a => updateAndDrawAttack(a, dt));
  _ripples = _ripples.filter(r => drawRipple(r, dt));
  requestAnimationFrame(cyFrame);
}

// ── Spawner ──
function cySpawnRandom() {
  const traveling = _attacks.filter(a => a.phase === 'travel').length;
  if (traveling >= MAX_TRAVEL) return;
  const sk = cyWrand(CYBER_SOURCES);
  let tk = cyPick(CYBER_TARGETS);
  let g  = 0;
  while (tk === sk && ++g < 8) tk = cyPick(CYBER_TARGETS);
  const a = makeAttack(sk, tk, cyPickType());
  if (a) _attacks.push(a);
}

function cySchedule() {
  const traveling = _attacks.filter(a => a.phase === 'travel').length;
  const ms = traveling >= MAX_TRAVEL ? 900 : 250 + Math.random() * 900;
  setTimeout(() => { cySpawnRandom(); cySchedule(); }, ms);
}

// ── Init ──
function initCyberViz({ svg, projection, W, H }) {
  _proj = projection;

  // Create canvas inside SVG via <foreignObject>
  // This guarantees pixel-perfect alignment with D3 projection coordinates
  // and auto-scales with the SVG on any screen size.
  const fo = svg.append('foreignObject')
    .attr('x', 0).attr('y', 0)
    .attr('width', W).attr('height', H)
    .style('pointer-events', 'none');

  _cv = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
  _cv.width  = W;
  _cv.height = H;
  _cv.style.cssText = 'display:block;pointer-events:none;';
  fo.node().appendChild(_cv);
  _cx = _cv.getContext('2d');

  // Initial burst of attacks
  for (let i = 0; i < 6; i++) setTimeout(cySpawnRandom, i * 160);
  cySchedule();
  requestAnimationFrame(cyFrame);
}

document.addEventListener('apexMapReady', ({ detail }) => initCyberViz(detail));
