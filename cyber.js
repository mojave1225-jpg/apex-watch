/* ============================================================
   APEX WATCH — Cyber Threat Arc Visualization
   Animated attack arcs layered on the D3 world map
   ============================================================ */

const ATTACK_TYPES = [
  { name: 'DDoS',       color: '#ff0044', glow: '#ff004477', w: 1.6, weight: 28 },
  { name: 'Malware',    color: '#ff8800', glow: '#ff880077', w: 1.3, weight: 24 },
  { name: 'Phishing',   color: '#ffdd00', glow: '#ffdd0077', w: 1.1, weight: 20 },
  { name: 'Ransomware', color: '#cc00ff', glow: '#cc00ff77', w: 1.5, weight: 16 },
  { name: 'Exploit',    color: '#00ccff', glow: '#00ccff77', w: 1.1, weight: 12 },
];

// Country centroids [lon, lat]
const NODES = {
  CN: { name: '中国',          c: [104.2,  35.9] },
  RU: { name: 'ロシア',        c: [105.3,  61.5] },
  US: { name: '米国',          c: [-95.7,  37.1] },
  KP: { name: '北朝鮮',        c: [127.5,  40.3] },
  IR: { name: 'イラン',        c: [ 53.7,  32.4] },
  BR: { name: 'ブラジル',      c: [-51.9, -14.2] },
  UA: { name: 'ウクライナ',    c: [ 31.2,  48.4] },
  IN: { name: 'インド',        c: [ 79.0,  20.6] },
  DE: { name: 'ドイツ',        c: [ 10.5,  51.2] },
  GB: { name: '英国',          c: [ -3.4,  55.4] },
  JP: { name: '日本',          c: [138.3,  36.2] },
  KR: { name: '韓国',          c: [127.8,  35.9] },
  NL: { name: 'オランダ',      c: [  5.3,  52.1] },
  FR: { name: 'フランス',      c: [  2.2,  46.2] },
  AU: { name: '豪州',          c: [133.8, -25.3] },
  TW: { name: '台湾',          c: [121.0,  23.7] },
  IL: { name: 'イスラエル',    c: [ 34.9,  31.1] },
  SA: { name: 'サウジアラビア',c: [ 45.1,  23.9] },
  PL: { name: 'ポーランド',    c: [ 19.1,  51.9] },
  CA: { name: 'カナダ',        c: [-96.8,  56.1] },
  SG: { name: 'シンガポール',  c: [103.8,   1.4] },
  TR: { name: 'トルコ',        c: [ 35.2,  38.9] },
  SE: { name: 'スウェーデン',  c: [ 18.6,  60.1] },
  CH: { name: 'スイス',        c: [  8.2,  46.8] },
};

// Weighted attack sources (based on global threat reports)
const SOURCES = [
  { k: 'CN', w: 32 }, { k: 'RU', w: 26 }, { k: 'KP', w: 12 },
  { k: 'IR', w: 10 }, { k: 'US', w: 6  }, { k: 'BR', w: 4  },
  { k: 'IN', w: 4  }, { k: 'NL', w: 3  }, { k: 'UA', w: 3  },
];

const TARGETS = ['US','DE','GB','JP','KR','FR','AU','TW','IL','SA','PL','CA','UA','IN','SG','SE','CH','TR'];

// ── Utility ──
function wRand(items) {
  let r = Math.random() * items.reduce((s, i) => s + i.w, 0);
  for (const i of items) { r -= i.w; if (r <= 0) return i.k; }
  return items[items.length - 1].k;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickType() {
  let r = Math.random() * ATTACK_TYPES.reduce((s, t) => s + t.weight, 0);
  for (const t of ATTACK_TYPES) { r -= t.weight; if (r <= 0) return t; }
  return ATTACK_TYPES[0];
}

// ── State ──
let _layer   = null;  // <g id="cyber-layer">
let _pathGen = null;
let _proj    = null;
let totalHits = 0;
let activeArcs = 0;
const MAX_ARCS = 16;

// ── Draw one attack arc ──
function drawAttack(srcKey, tgtKey, type) {
  if (!_layer || activeArcs >= MAX_ARCS) return;

  const src = NODES[srcKey];
  const tgt = NODES[tgtKey];
  if (!src || !tgt) return;

  const feature = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [src.c, tgt.c] },
  };

  const pathData = _pathGen(feature);
  if (!pathData || pathData.length < 8) return;

  const srcPx = _proj(src.c);
  const tgtPx = _proj(tgt.c);
  if (!srcPx || !tgtPx) return;

  activeArcs++;
  const TRAVEL_MS = 800 + Math.random() * 700;

  const g = _layer.append('g').attr('class', 'ca');

  // Wide glow halo
  g.append('path').attr('d', pathData)
    .attr('fill', 'none').attr('stroke', type.color)
    .attr('stroke-width', type.w * 3).attr('opacity', 0.15);

  // Core arc (animated draw)
  const arc = g.append('path').attr('d', pathData)
    .attr('fill', 'none').attr('stroke', type.color)
    .attr('stroke-width', type.w).attr('opacity', 0.9)
    .attr('stroke-linecap', 'round');

  const len = arc.node().getTotalLength();
  if (!len || len < 3) { g.remove(); activeArcs--; return; }

  arc.attr('stroke-dasharray', `${len} ${len}`)
     .attr('stroke-dashoffset', len)
     .transition().duration(TRAVEL_MS).ease(d3.easeLinear)
     .attr('stroke-dashoffset', 0);

  // Origin pulse dot
  const originDot = g.append('circle')
    .attr('cx', srcPx[0]).attr('cy', srcPx[1])
    .attr('r', 0).attr('fill', 'none')
    .attr('stroke', type.color).attr('stroke-width', 1).attr('opacity', 0.8);
  originDot.transition().duration(400)
    .attr('r', 5).attr('opacity', 0);

  // Solid origin dot
  g.append('circle').attr('cx', srcPx[0]).attr('cy', srcPx[1])
    .attr('r', 2.5).attr('fill', type.color).attr('opacity', 0.8);

  // Traveling head dot (requestAnimationFrame for smooth motion)
  const head = g.append('circle').attr('r', 2.2)
    .attr('fill', '#fff').attr('opacity', 0.95);
  const headGlow = g.append('circle').attr('r', 4.5)
    .attr('fill', type.color).attr('opacity', 0.35);

  const arcNode = arc.node();
  const t0 = performance.now();

  (function tick(now) {
    const pct = Math.min((now - t0) / TRAVEL_MS, 1);
    const pt  = arcNode.getPointAtLength(pct * len);
    head.attr('cx', pt.x).attr('cy', pt.y);
    headGlow.attr('cx', pt.x).attr('cy', pt.y);
    if (pct < 1) {
      requestAnimationFrame(tick);
    } else {
      onImpact();
    }
  })(t0);

  // ── Impact sequence ──
  function onImpact() {
    // Ring expansion
    const ring = g.append('circle')
      .attr('cx', tgtPx[0]).attr('cy', tgtPx[1])
      .attr('r', 3).attr('fill', 'none')
      .attr('stroke', type.color).attr('stroke-width', 2)
      .attr('opacity', 1);
    ring.transition().duration(420)
      .attr('r', 12).attr('opacity', 0);

    // Second smaller ring
    const ring2 = g.append('circle')
      .attr('cx', tgtPx[0]).attr('cy', tgtPx[1])
      .attr('r', 2).attr('fill', 'none')
      .attr('stroke', '#fff').attr('stroke-width', 1)
      .attr('opacity', 0.8);
    ring2.transition().duration(280)
      .attr('r', 7).attr('opacity', 0);

    // Fade out arc group
    g.transition().delay(300).duration(700).attr('opacity', 0)
      .on('end', () => { g.remove(); activeArcs--; });

    // Update HUD
    totalHits++;
    const cEl = document.getElementById('cyber-count');
    if (cEl) cEl.textContent = totalHits.toLocaleString();

    const lEl = document.getElementById('cyber-last');
    if (lEl) {
      lEl.textContent = `${src.name} → ${tgt.name}`;
      lEl.style.color  = type.color;
    }
    const tEl = document.getElementById('cyber-type');
    if (tEl) {
      tEl.textContent   = type.name;
      tEl.style.color   = type.color;
      tEl.style.borderColor = type.color + '66';
    }
  }
}

// ── Scheduler ──
function spawnRandom() {
  const src = wRand(SOURCES);
  let tgt = pick(TARGETS);
  let guard = 0;
  while (tgt === src && ++guard < 8) tgt = pick(TARGETS);
  drawAttack(src, tgt, pickType());
}

function scheduleNext() {
  const ms = activeArcs >= MAX_ARCS
    ? 900
    : 350 + Math.random() * 1100;
  setTimeout(() => { spawnRandom(); scheduleNext(); }, ms);
}

// ── Init (called when map SVG is ready) ──
function initCyberViz({ svg, projection, W, H }) {
  _proj    = projection;
  _pathGen = d3.geoPath().projection(projection);
  _layer   = svg.select('#cyber-layer');
  if (_layer.empty()) _layer = svg.append('g').attr('id', 'cyber-layer');

  // Initial burst
  for (let i = 0; i < 5; i++) setTimeout(spawnRandom, i * 220);
  scheduleNext();
}

document.addEventListener('apexMapReady', ({ detail }) => initCyberViz(detail));
