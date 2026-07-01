/* ============================================================
   APEX WATCH — D3.js World Map Engine
   Projection: Natural Earth 1
   Data: world-atlas@2 via jsDelivr (110m resolution)
   ============================================================ */


// ── 紛争地帯データ (ISO 3166-1 数値コード) ──
// 重篤度: 4=重大紛争 / 3=高強度 / 2=中強度 / 1=緊張・不安定
const CONFLICT_ZONES = {
  // ── 重大紛争 (Level 4 — 赤) ──
  804: { level: 4, name: 'ウクライナ',           eng: 'Ukraine',          desc: 'ロシア・ウクライナ全面戦争 (2022-)。民間人死者10万超、欧州最大の地上戦。' },
  275: { level: 4, name: 'パレスチナ / ガザ',    eng: 'Palestine/Gaza',   desc: 'イスラエル・ハマス戦争 (2023-)。ガザ地区への大規模軍事作戦継続中。' },
  729: { level: 4, name: 'スーダン',             eng: 'Sudan',            desc: '国軍 vs. RSF準軍事組織の内戦 (2023-)。人道危機・難民数百万人規模。' },
  104: { level: 4, name: 'ミャンマー',           eng: 'Myanmar',          desc: '軍事クーデター後の全土内戦 (2021-)。複数武装勢力が国土の半分以上を支配。' },
  // ── 高強度紛争 (Level 3 — オレンジ) ──
  887: { level: 3, name: 'イエメン',             eng: 'Yemen',            desc: '内戦 (2015-) + フーシ派による紅海商船攻撃が世界物流を直撃中。' },
  180: { level: 3, name: 'コンゴ民主共和国',     eng: 'DR Congo',         desc: 'M23武装勢力が東部を支配。ルワンダ軍介入疑惑で地域紛争化。' },
  706: { level: 3, name: 'ソマリア',             eng: 'Somalia',          desc: 'アル・シャバブによる継続的テロ攻撃。首都含む広域で戦闘継続。' },
  231: { level: 3, name: 'エチオピア',           eng: 'Ethiopia',         desc: 'ティグライ和平後もアムハラ・オロモ地域での武力衝突継続。' },
  728: { level: 3, name: '南スーダン',           eng: 'South Sudan',      desc: 'スーダン内戦波及・国内対立再燃。人道状況極度に悪化。' },
  332: { level: 3, name: 'ハイチ',               eng: 'Haiti',            desc: '武装ギャングが首都の90%近くを支配。国家機能崩壊状態。' },
  760: { level: 3, name: 'シリア',               eng: 'Syria',            desc: '内戦継続 (2011-)。アサド政権崩壊後、武装勢力による分断支配。' },
  4:   { level: 3, name: 'アフガニスタン',       eng: 'Afghanistan',      desc: 'タリバン支配下でISIS-Kによるテロ攻撃継続。人道危機深刻化。' },
  // ── 中強度紛争 (Level 2 — 黄) ──
  466: { level: 2, name: 'マリ',                 eng: 'Mali',             desc: 'クーデター後のサヘル地域。ジハード主義勢力とロシア傭兵部隊が暗躍。' },
  562: { level: 2, name: 'ニジェール',           eng: 'Niger',            desc: 'クーデター (2023)。NATO・フランス軍撤退後、治安急速悪化。' },
  854: { level: 2, name: 'ブルキナファソ',       eng: 'Burkina Faso',     desc: 'クーデター後、ジハード主義勢力が国土の半分超を実効支配。' },
  140: { level: 2, name: '中央アフリカ共和国',   eng: 'CAR',              desc: 'ロシア民間軍事会社が介入。複数武装勢力との内戦継続。' },
  434: { level: 2, name: 'リビア',               eng: 'Libya',            desc: '東西分断政府間の対立継続。外国勢力が介入する代理戦争状態。' },
  566: { level: 2, name: 'ナイジェリア',         eng: 'Nigeria',          desc: 'ボコハラム + フラニ民兵の多発テロ。北部・デルタ地帯で継続。' },
  508: { level: 2, name: 'モザンビーク',         eng: 'Mozambique',       desc: '北部カーボデルガードでのイスラム武装勢力活動。資源開発地帯に隣接。' },
  148: { level: 2, name: 'チャド',               eng: 'Chad',             desc: '周辺国の不安定化波及。武装勢力の侵入と国内政治不安が継続。' },
  368: { level: 2, name: 'イラク',               eng: 'Iraq',             desc: 'ISIS残党 + イラン系民兵が活動。親イラン勢力による米軍基地攻撃継続。' },
  // ── 緊張・不安定 (Level 1 — 青) ──
  364: { level: 1, name: 'イラン',               eng: 'Iran',             desc: 'ヘズボラ・フーシ派支援。イスラエルとの直接交戦リスク継続。核開発問題。' },
  408: { level: 1, name: '北朝鮮',               eng: 'North Korea',      desc: '核・ICBM実験継続。ロシアへの弾薬・兵士供与。朝鮮半島緊張高。' },
  586: { level: 1, name: 'パキスタン',           eng: 'Pakistan',         desc: 'TTP武装勢力の活発化。アフガン国境緊張。核保有国の不安定化懸念。' },
  862: { level: 1, name: 'ベネズエラ',           eng: 'Venezuela',        desc: '政治危機継続。ガイアナとの領土紛争。周辺国への難民流出。' },
  384: { level: 1, name: 'コートジボワール',     eng: 'Côte d\'Ivoire',   desc: 'サヘル不安定化の波及。北部国境地帯での武装勢力侵入リスク。' },
};

const CONFLICT_CFG = {
  4: { fill: '#cc0033',  fillHover: '#ff1a55',  stroke: '#ff4466', label: '重大紛争 / Critical War' },
  3: { fill: '#cc5500',  fillHover: '#ff7722',  stroke: '#ff8833', label: '高強度紛争 / High Conflict' },
  2: { fill: '#aa8800',  fillHover: '#ffcc00',  stroke: '#ffdd00', label: '中強度紛争 / Active Conflict' },
  1: { fill: '#005599',  fillHover: '#0088cc',  stroke: '#00aaff', label: '緊張・不安定 / Tension' },
};

const STRATEGIC_CORRIDORS = [
  {
    name: 'EASTERN FRONT',
    level: 'critical',
    from: [30.5, 50.4],
    to: [36.8, 46.7],
  },
  {
    name: 'RED SEA LANE',
    level: 'high',
    from: [12.6, 43.2],
    to: [30.2, 32.5],
  },
  {
    name: 'INDO-PAC ARC',
    level: 'monitor',
    from: [35.2, 127.2],
    to: [13.4, 121.5],
  },
];

function collectRegionCounts() {
  const byRegion = {
    '中東 / ME': 0,
    'アフリカ / AF': 0,
    '欧州東部 / EU': 0,
    'アジア / AS': 0,
    '米州 / AM': 0,
  };

  Object.entries(CONFLICT_ZONES).forEach(([iso]) => {
    const id = Number(iso);
    if ([275, 364, 368, 760, 887].includes(id)) byRegion['中東 / ME'] += 1;
    else if ([729, 728, 706, 231, 466, 562, 854, 140, 434, 566, 508, 148].includes(id)) byRegion['アフリカ / AF'] += 1;
    else if ([804].includes(id)) byRegion['欧州東部 / EU'] += 1;
    else if ([104, 4, 408, 586].includes(id)) byRegion['アジア / AS'] += 1;
    else byRegion['米州 / AM'] += 1;
  });

  return byRegion;
}

function renderRegionBars(byRegion) {
  const wrap = document.getElementById('map-hud-bars');
  if (!wrap) return;
  const entries = Object.entries(byRegion).sort((a, b) => b[1] - a[1]);
  const maxVal = Math.max(...entries.map(([, n]) => n), 1);
  wrap.innerHTML = entries.map(([name, val]) => {
    const w = Math.max(8, Math.round((val / maxVal) * 100));
    return `
      <div class="map-hud-bar-row">
        <span class="map-hud-bar-name">${name}</span>
        <span class="map-hud-bar-track"><span class="map-hud-bar-fill" style="width:${w}%"></span></span>
        <span class="map-hud-bar-val">${val}</span>
      </div>
    `;
  }).join('');
}

function updateHudDelta(total) {
  const el = document.getElementById('map-delta');
  if (!el) return;

  const key = 'apex_map_total_snapshot_v1';
  const now = Date.now();
  let snapshot = null;
  try {
    snapshot = JSON.parse(localStorage.getItem(key) || 'null');
  } catch (_) {
    snapshot = null;
  }

  if (!snapshot || !Number.isFinite(snapshot.total) || !Number.isFinite(snapshot.ts)) {
    el.textContent = '24h差分: N/A (初回計測)';
    el.classList.remove('up', 'down', 'flat');
    localStorage.setItem(key, JSON.stringify({ total, ts: now }));
    return;
  }

  const age = now - snapshot.ts;
  if (age >= 24 * 60 * 60 * 1000) {
    const delta = total - snapshot.total;
    const sign = delta > 0 ? '+' : '';
    el.textContent = `24h差分: ${sign}${delta}`;
    el.classList.remove('up', 'down', 'flat');
    if (delta > 0) el.classList.add('up');
    else if (delta < 0) el.classList.add('down');
    else el.classList.add('flat');
    localStorage.setItem(key, JSON.stringify({ total, ts: now }));
    return;
  }

  const remainH = Math.max(0, Math.ceil((24 * 60 * 60 * 1000 - age) / (60 * 60 * 1000)));
  el.textContent = `24h差分: 計測中 (${remainH}h)`;
  el.classList.remove('up', 'down', 'flat');
}

function getDayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function updateLevelHistory(counts) {
  const key = 'apex_map_level_history_v1';
  const today = getDayKey();
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (_) {
    history = [];
  }

  if (!Array.isArray(history)) history = [];

  const entry = {
    d: today,
    l4: Number(counts[4] || 0),
    l3: Number(counts[3] || 0),
    l2: Number(counts[2] || 0),
    l1: Number(counts[1] || 0),
  };

  const idx = history.findIndex((h) => h && h.d === today);
  if (idx >= 0) history[idx] = entry;
  else history.push(entry);

  history = history
    .filter((h) => h && typeof h.d === 'string')
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(-7);

  localStorage.setItem(key, JSON.stringify(history));
  return history;
}

function buildSparkPath(values, w = 82, h = 26, pad = 2) {
  const nums = values.map((v) => Number(v || 0));
  const maxV = Math.max(...nums, 1);
  const step = nums.length > 1 ? (w - pad * 2) / (nums.length - 1) : 0;
  const points = nums.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / maxV) * (h - pad * 2);
    return [x, y];
  });

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const last = points[points.length - 1] || [w - pad, h - pad];
  return { d, lastX: last[0], lastY: last[1] };
}

function renderLevelSparks(history, counts) {
  const wrap = document.getElementById('map-spark-grid');
  if (!wrap) return;

  const series = [
    { key: 'l4', label: 'L4', color: CONFLICT_CFG[4].stroke },
    { key: 'l3', label: 'L3', color: CONFLICT_CFG[3].stroke },
    { key: 'l2', label: 'L2', color: CONFLICT_CFG[2].stroke },
    { key: 'l1', label: 'L1', color: CONFLICT_CFG[1].stroke },
  ];

  wrap.innerHTML = series.map((s) => {
    const vals = history.map((h) => Number(h[s.key] || 0));
    const spark = buildSparkPath(vals);
    const current = counts[Number(s.label.slice(1))] || 0;
    return `
      <div class="map-spark-card">
        <div class="map-spark-row">
          <span class="map-spark-label" style="color:${s.color}">${s.label}</span>
          <span class="map-spark-val" style="color:${s.color}">${current}</span>
        </div>
        <svg class="map-spark-svg" viewBox="0 0 82 26" preserveAspectRatio="none" role="img" aria-label="${s.label} 7-day trend">
          <path class="map-spark-path" d="${spark.d}" stroke="${s.color}"></path>
          <circle class="map-spark-dot" cx="${spark.lastX.toFixed(2)}" cy="${spark.lastY.toFixed(2)}" fill="${s.color}"></circle>
        </svg>
      </div>
    `;
  }).join('');
}

function updateMapHud() {
  const levels = [4, 3, 2, 1];
  const counts = { 4: 0, 3: 0, 2: 0, 1: 0 };

  Object.values(CONFLICT_ZONES).forEach((c) => {
    if (levels.includes(c.level)) counts[c.level] += 1;
  });

  const total = counts[4] + counts[3] + counts[2] + counts[1];

  const byRegion = collectRegionCounts();

  const topRegion = Object.entries(byRegion).sort((a, b) => b[1] - a[1])[0];

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  set('map-total', total);
  set('map-lv4', counts[4]);
  set('map-lv3', counts[3]);
  set('map-lv2', counts[2]);
  set('map-lv1', counts[1]);
  updateHudDelta(total);
  const history = updateLevelHistory(counts);
  renderLevelSparks(history, counts);
  renderRegionBars(byRegion);

  const hotspot = document.getElementById('map-hotspot');
  if (hotspot && topRegion) {
    hotspot.textContent = `主要ホットスポット: ${topRegion[0]} (${topRegion[1]}件)`;
  }
}

async function initWorldMap() {
  const container = document.getElementById('mapContainer');
  if (!container) return;

  const W = container.clientWidth || 960;
  const H = container.clientHeight || Math.round(W * 0.52);

  // Create SVG
  const svg = d3.select('#mapContainer')
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%');

  // Projection: Natural Earth 1 for aesthetic look
  // fitExtentで球体全体が常に表示領域内へ収まるようにする
  const projection = d3.geoNaturalEarth1()
    .fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' });

  const pathGen = d3.geoPath().projection(projection);

  // Ocean sphere
  svg.append('path')
    .datum({ type: 'Sphere' })
    .attr('class', 'sphere')
    .attr('d', pathGen);

  // Graticule
  svg.append('path')
    .datum(d3.geoGraticule()())
    .attr('class', 'graticule')
    .attr('d', pathGen);

  // Load world atlas TopoJSON
  let world;
  try {
    world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  } catch (e) {
    document.getElementById('mapLoading').textContent = 'データ取得失敗 — ネットワーク確認';
    return;
  }

  const countries = topojson.feature(world, world.objects.countries);
  const borders   = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);

  const tooltip = document.getElementById('mapTooltip');

  // デバッグ: 実際のIDフォーマットを確認
  if (countries.features.length > 0) {
    const sample = countries.features.slice(0, 5).map(f => `${f.id}(${typeof f.id})`);
    console.log('[APEX MAP] country id samples:', sample.join(', '));
  }

  // IDを文字列・数値どちらでも照合できるルックアップ
  function getConflict(d) {
    return CONFLICT_ZONES[+d.id]          // 数値キー照合
        || CONFLICT_ZONES[d.id]           // そのまま照合
        || CONFLICT_ZONES[String(d.id).replace(/^0+/, '')] // 先頭ゼロ除去
        || null;
  }

  // Draw countries
  // NOTE: All fill logic is done via .attr() here — never rely on CSS class fill
  // because CSS class rules override SVG presentation attributes, which would
  // break conflict-zone coloring.
  svg.selectAll('.country')
    .data(countries.features)
    .join('path')
    .attr('class', 'country')
    .attr('d', pathGen)
    .attr('fill', d => {
      const c = getConflict(d);
      return c ? CONFLICT_CFG[c.level].fill : '#0c1428';
    })
    .attr('stroke', d => {
      const c = getConflict(d);
      return c ? CONFLICT_CFG[c.level].stroke : '#1e3a6a';
    })
    .attr('stroke-width', d => {
      const c = getConflict(d);
      if (!c) return '0.5';
      return c.level === 4 ? '2' : c.level === 3 ? '1.4' : '1';
    })
    .style('cursor', d => getConflict(d) ? 'pointer' : null)
    .on('mouseenter', function(event, d) {
      const c = getConflict(d);
      if (c) {
        d3.select(this).attr('fill', CONFLICT_CFG[c.level].fillHover);
        const cfg = CONFLICT_CFG[c.level];
        tooltip.innerHTML = `
          <div class="tt-title" style="color:${cfg.stroke}">
            ⚔ ${c.name} <span style="font-size:9px;opacity:0.7">${c.eng}</span>
          </div>
          <div class="tt-row">
            <span>重篤度</span>
            <span class="tt-val" style="color:${cfg.stroke}">${cfg.label}</span>
          </div>
          <div class="tt-footer">${c.desc}</div>
        `;
        tooltip.classList.add('visible');
        positionTooltip(event);
      } else {
        d3.select(this).attr('fill', '#162040');
      }
    })
    .on('mousemove', function(event, d) {
      if (getConflict(d)) positionTooltip(event);
    })
    .on('mouseleave', function(event, d) {
      const c = getConflict(d);
      if (c) {
        d3.select(this).attr('fill', CONFLICT_CFG[c.level].fill);
        tooltip.classList.remove('visible');
      } else {
        d3.select(this).attr('fill', '#0c1428');
      }
    });

  // Conflict hotspot pulse layer (country centroids)
  const hotspotLayer = svg.append('g').attr('class', 'hotspot-layer');
  const hotspotPoints = countries.features
    .map((f) => {
      const c = getConflict(f);
      if (!c) return null;
      const centroid = pathGen.centroid(f);
      if (!centroid || !Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) return null;
      return {
        x: centroid[0],
        y: centroid[1],
        level: c.level,
      };
    })
    .filter(Boolean);

  const hotspotG = hotspotLayer.selectAll('.hotspot')
    .data(hotspotPoints)
    .join('g')
    .attr('class', 'hotspot');

  hotspotG.append('circle')
    .attr('class', 'hs-ring hs-ring-1')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('stroke', d => CONFLICT_CFG[d.level].stroke)
    .attr('opacity', 0.7);

  hotspotG.append('circle')
    .attr('class', 'hs-ring hs-ring-2')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('stroke', d => CONFLICT_CFG[d.level].stroke)
    .attr('opacity', 0.55);

  hotspotG.append('circle')
    .attr('class', 'hs-core')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', d => d.level >= 3 ? 2.6 : 2.1)
    .attr('fill', d => CONFLICT_CFG[d.level].fillHover)
    .attr('stroke', d => CONFLICT_CFG[d.level].stroke)
    .attr('stroke-width', 0.8);

  // Strategic corridor layer
  const corridorLayer = svg.append('g').attr('class', 'strategic-layer');
  const lineGen = d3.line();

  STRATEGIC_CORRIDORS.forEach((corridor) => {
    const interp = d3.geoInterpolate(corridor.from, corridor.to);
    const route = d3.range(0, 1.001, 0.05)
      .map(t => projection(interp(t)))
      .filter(Boolean);
    if (route.length < 2) return;

    corridorLayer.append('path')
      .attr('class', `strategic-line ${corridor.level}`)
      .attr('d', lineGen(route))
      .attr('stroke-width', corridor.level === 'critical' ? 1.7 : corridor.level === 'high' ? 1.35 : 1.1)
      .attr('stroke-dasharray', corridor.level === 'critical' ? '5 4' : '4 5');

    const mid = route[Math.floor(route.length / 2)];
    if (mid) {
      corridorLayer.append('text')
        .attr('class', 'strategic-label')
        .attr('x', mid[0] + 3)
        .attr('y', mid[1] - 4)
        .text(corridor.name);
    }
  });

  // Country borders
  svg.append('path')
    .datum(borders)
    .attr('class', 'country-border')
    .attr('d', pathGen);

  document.getElementById('mapLoading').textContent = '◈ LIVE';
  document.getElementById('mapLoading').style.color = 'var(--accent-green)';
  updateMapHud();

  // ── 凡例 ──
  const legendData = [4, 3, 2, 1];
  const legendG = svg.append('g')
    .attr('transform', `translate(10, ${H - 10 - legendData.length * 16 - 4})`);

  legendG.append('rect')
    .attr('x', -2).attr('y', -2)
    .attr('width', 178).attr('height', legendData.length * 16 + 8)
    .attr('fill', 'rgba(2,8,16,0.75)')
    .attr('rx', 2);

  legendData.forEach((lv, i) => {
    const cfg = CONFLICT_CFG[lv];
    const y = i * 16 + 8;
    legendG.append('rect')
      .attr('x', 4).attr('y', y - 6)
      .attr('width', 10).attr('height', 10)
      .attr('fill', cfg.fill)
      .attr('stroke', cfg.stroke)
      .attr('stroke-width', 0.8)
      .attr('rx', 1);
    legendG.append('text')
      .attr('x', 18).attr('y', y + 2)
      .attr('fill', cfg.stroke)
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .text(cfg.label);
  });


  // Cyber threat arc layer — inserted before scanlines so arcs sit under the overlay
  svg.append('g').attr('id', 'cyber-layer');

  // Notify cyber.js that the map is ready
  document.dispatchEvent(new CustomEvent('apexMapReady', {
    detail: { svg, projection, W, H }
  }));

  // Scan-line overlay for atmosphere
  const defs = svg.append('defs');
  const pattern = defs.append('pattern')
    .attr('id', 'scanlines')
    .attr('width', 1).attr('height', 4)
    .attr('patternUnits', 'userSpaceOnUse');
  pattern.append('rect')
    .attr('width', 1).attr('height', 2)
    .attr('fill', 'rgba(0,0,0,0.15)');

  svg.append('rect')
    .attr('width', W).attr('height', H)
    .attr('fill', 'url(#scanlines)')
    .attr('pointer-events', 'none');
}

function positionTooltip(event) {
  const tooltip = document.getElementById('mapTooltip');
  const pad = 14;
  let x = event.clientX + pad;
  let y = event.clientY - pad;
  const w = tooltip.offsetWidth || 240;
  const h = tooltip.offsetHeight || 120;
  if (x + w > window.innerWidth - 10) x = event.clientX - w - pad;
  if (y + h > window.innerHeight - 10) y = event.clientY - h - pad;
  tooltip.style.left = x + 'px';
  tooltip.style.top  = y + 'px';
}

document.addEventListener('DOMContentLoaded', initWorldMap);
