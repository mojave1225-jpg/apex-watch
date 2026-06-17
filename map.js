/* ============================================================
   APEX WATCH — D3.js World Map Engine
   Projection: Natural Earth 1
   Data: world-atlas@2 via jsDelivr (110m resolution)
   ============================================================ */

const MAP_HOTSPOTS = [
  {
    coords: [55.27, 25.20],  // Dubai, UAE
    label: 'UAE / ドバイ',
    level: 'red',
    icon: '⬡',
    metrics: [
      { k: '黄金ビザ申請増加', v: '+127% (2025)' },
      { k: 'HNWI流入数', v: '6,700人/年' },
      { k: '不動産投資', v: '$48B 記録的水準' },
    ],
    note: 'ドバイは脱税・資産保護目的の超富裕層移住先No.1',
    r: 9,
  },
  {
    coords: [174.76, -36.85],  // Auckland, New Zealand
    label: 'ニュージーランド',
    level: 'red',
    icon: '◈',
    metrics: [
      { k: 'バンカー付き農場購入', v: '+240% (2024)' },
      { k: '超富裕層移住申請', v: '+180%' },
      { k: '地下シェルター建設', v: '推計1,200件+' },
    ],
    note: 'テック億万長者が最優先避難地として選択。ピーター・ティールらが取得済み',
    r: 8,
  },
  {
    coords: [8.54, 47.37],  // Zurich, Switzerland
    label: 'スイス / チューリッヒ',
    level: 'orange',
    icon: '◈',
    metrics: [
      { k: 'オフショア管理資産', v: '$2.4T (世界首位)' },
      { k: '永住権申請増加', v: '+89%' },
      { k: 'プライベートバンク口座', v: '140,000+新規' },
    ],
    note: '政治的安定・中立性から超富裕層の資産ハブとして機能',
    r: 7,
  },
  {
    coords: [-122.08, 37.39],  // Silicon Valley
    label: 'シリコンバレー / CA',
    level: 'orange',
    icon: '▲',
    metrics: [
      { k: 'テック富豪の州外転出', v: '-34% 純減' },
      { k: 'プライベートジェット増加', v: '+42% (SJC)' },
      { k: '邸宅セキュリティ支出', v: '+$2.3M 平均' },
    ],
    note: 'カリフォルニア州からテキサス・フロリダ・NZへの逃避が加速',
    r: 8,
  },
  {
    coords: [103.82, 1.35],  // Singapore
    label: 'シンガポール',
    level: 'yellow',
    icon: '⊛',
    metrics: [
      { k: 'ファミリーオフィス設立', v: '+320% (3年)' },
      { k: '富裕層移住申請', v: '4,000件/年' },
      { k: '管理資産 AUM', v: '$5.4T' },
    ],
    note: 'アジア版スイスとして機能。中国系超富裕層の主要逃避先',
    r: 7,
  },
  {
    coords: [-110.0, 46.87],  // Montana, USA
    label: 'モンタナ州 / MT',
    level: 'orange',
    icon: '◈',
    metrics: [
      { k: '地下バンカー建設', v: '+310%' },
      { k: '遠隔地農場・牧場購入', v: '+89%' },
      { k: '武装警備付き不動産', v: '急増' },
    ],
    note: '人口密度低・山岳地形・連邦政府遠隔地として超富裕層が選択',
    r: 7,
  },
  {
    coords: [-81.38, 19.33],  // Cayman Islands
    label: 'ケイマン諸島',
    level: 'yellow',
    icon: '◈',
    metrics: [
      { k: '登録ファンド数', v: '13,000+' },
      { k: '法人登録増加', v: '+67% (2025)' },
      { k: '管理資産', v: '$7.8T' },
    ],
    note: '無税・秘密保護の超富裕層オフショア資産保護の定番地',
    r: 6,
  },
  {
    coords: [-0.12, 51.51],  // London
    label: 'ロンドン / UK',
    level: 'yellow',
    icon: '⬡',
    metrics: [
      { k: 'UHNWI居住者', v: '5,200人 (欧州最多)' },
      { k: '超高額物件成約', v: '+23%' },
      { k: 'プライベートバンク', v: '320機関' },
    ],
    note: 'ブレグジット後も欧州富裕層の金融・法務ハブとして維持',
    r: 7,
  },
  {
    coords: [7.42, 43.73],  // Monaco
    label: 'モナコ',
    level: 'yellow',
    icon: '◈',
    metrics: [
      { k: '億万長者密度', v: '世界最高 (1/3世帯)' },
      { k: '無税ステータス', v: 'キャピタルゲイン非課税' },
      { k: 'ヨット港係留待ち', v: '3年+' },
    ],
    note: 'ヨーロッパ超富裕層の最終リゾート兼税務逃避地',
    r: 5,
  },
  {
    coords: [114.16, 22.32],  // Hong Kong
    label: '香港',
    level: 'orange',
    icon: '⊛',
    metrics: [
      { k: '資産移動 (シンガポールへ)', v: '$650B+' },
      { k: 'HNWI流出数', v: '-18,000人 (2024)' },
      { k: '残留資産管理', v: '$4.2T' },
    ],
    note: '中国統制強化により超富裕層資産がSG・スイスへ急速移動中',
    r: 7,
  },
  {
    coords: [-64.78, 32.31],  // Bermuda
    label: 'バミューダ',
    level: 'yellow',
    icon: '◈',
    metrics: [
      { k: '保険・再保険資産', v: '$1.4T' },
      { k: '法人税率', v: '0%' },
      { k: 'ヘッジファンド登録', v: '1,400+' },
    ],
    note: '富裕層向け保険・税務構造の中心地として機能',
    r: 5,
  },
  {
    coords: [151.21, -33.87],  // Sydney, Australia
    label: 'オーストラリア / シドニー',
    level: 'yellow',
    icon: '▲',
    metrics: [
      { k: 'HNWI移住数', v: '+34% (2025)' },
      { k: '農場バンカー建設', v: '+145%' },
      { k: '超高額物件', v: '+28%' },
    ],
    note: 'NZと並ぶ南半球の富裕層逃避先。地政学的リスクが低い',
    r: 7,
  },
];

// Color config per level
const HS_COLOR = {
  red:    '#ff0044',
  orange: '#ff8800',
  yellow: '#ffdd00',
};

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
  4: { fill: 'rgba(255,0,68,0.60)',   fillHover: 'rgba(255,0,68,0.88)',   stroke: '#ff0044', label: '重大紛争 / Critical War' },
  3: { fill: 'rgba(255,80,0,0.52)',   fillHover: 'rgba(255,80,0,0.80)',   stroke: '#ff5000', label: '高強度紛争 / High Conflict' },
  2: { fill: 'rgba(255,200,0,0.42)',  fillHover: 'rgba(255,200,0,0.70)',  stroke: '#ffc800', label: '中強度紛争 / Active Conflict' },
  1: { fill: 'rgba(0,170,255,0.28)',  fillHover: 'rgba(0,170,255,0.55)',  stroke: '#00aaff', label: '緊張・不安定 / Tension' },
};

async function initWorldMap() {
  const container = document.getElementById('mapContainer');
  if (!container) return;

  const W = container.clientWidth || 960;
  const H = Math.round(W * 0.52);

  // Create SVG
  const svg = d3.select('#mapContainer')
    .append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', 'auto');

  // Projection: Natural Earth 1 for aesthetic look
  const projection = d3.geoNaturalEarth1()
    .scale(W / 6.4)
    .translate([W / 2, H / 2 + H * 0.05]);

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

  // Draw countries (紛争地域を色分け)
  svg.selectAll('.country')
    .data(countries.features)
    .join('path')
    .attr('class', 'country')
    .attr('d', pathGen)
    .each(function(d) {
      const c = CONFLICT_ZONES[d.id];
      if (!c) return;
      const cfg = CONFLICT_CFG[c.level];
      d3.select(this)
        .attr('fill', cfg.fill)
        .attr('stroke', cfg.stroke)
        .attr('stroke-width', c.level === 4 ? 1.4 : 0.8)
        .style('cursor', 'pointer');
    })
    .on('mouseenter', function(event, d) {
      const c = CONFLICT_ZONES[d.id];
      if (!c) return;
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
    })
    .on('mousemove', function(event, d) {
      if (!CONFLICT_ZONES[d.id]) return;
      positionTooltip(event);
    })
    .on('mouseleave', function(event, d) {
      const c = CONFLICT_ZONES[d.id];
      if (!c) return;
      d3.select(this).attr('fill', CONFLICT_CFG[c.level].fill);
      tooltip.classList.remove('visible');
    });

  // Country borders
  svg.append('path')
    .datum(borders)
    .attr('class', 'country-border')
    .attr('d', pathGen);

  document.getElementById('mapLoading').textContent = '◈ LIVE';
  document.getElementById('mapLoading').style.color = 'var(--accent-green)';

  // ── 紛争地帯 凡例 ──
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

  // ── HOTSPOT LAYER ──
  const tooltip = document.getElementById('mapTooltip');

  MAP_HOTSPOTS.forEach((hs, i) => {
    const [px, py] = projection(hs.coords);
    if (px == null || py == null) return;

    const color = HS_COLOR[hs.level];
    const g = svg.append('g')
      .attr('class', 'hs-group')
      .attr('transform', `translate(${px},${py})`)
      .style('cursor', 'pointer');

    // Pulse rings (staggered via CSS animation-delay override)
    const ring1 = g.append('circle')
      .attr('class', 'hs-ring hs-ring-1')
      .attr('r', 0)
      .attr('cx', 0).attr('cy', 0)
      .attr('stroke', color);
    ring1.style('animation-delay', `${i * 0.18}s`);

    const ring2 = g.append('circle')
      .attr('class', 'hs-ring hs-ring-2')
      .attr('r', 0)
      .attr('cx', 0).attr('cy', 0)
      .attr('stroke', color);
    ring2.style('animation-delay', `${i * 0.18 + 0.8}s`);

    // Core dot
    g.append('circle')
      .attr('class', 'hs-core')
      .attr('r', hs.r * 0.55)
      .attr('cx', 0).attr('cy', 0)
      .attr('fill', color)
      .attr('opacity', 0.85);

    // Outer ring (static)
    g.append('circle')
      .attr('r', hs.r)
      .attr('cx', 0).attr('cy', 0)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.2)
      .attr('opacity', 0.5);

    // Label (abbreviated, shown if space permits)
    const shortLabel = hs.label.split(' / ')[0];
    const labelG = g.append('g').attr('class', 'hs-label');

    // Position label: prefer right side, push left if near right edge
    const labelX = px > W - 120 ? -(shortLabel.length * 5 + 6) : hs.r + 4;

    labelG.append('text')
      .attr('x', labelX)
      .attr('y', 4)
      .attr('fill', color)
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('opacity', 0.9)
      .text(shortLabel);

    // Hover interaction
    g.on('mouseenter', function(event) {
      d3.select(this).select('.hs-core').attr('r', hs.r * 0.8);

      const html = `
        <div class="tt-title ${hs.level}">${hs.icon} ${hs.label}</div>
        ${hs.metrics.map(m => `
          <div class="tt-row"><span>${m.k}</span><span class="tt-val">${m.v}</span></div>
        `).join('')}
        <div class="tt-footer">${hs.note}</div>
      `;
      tooltip.innerHTML = html;
      tooltip.classList.add('visible');
      positionTooltip(event);
    });

    g.on('mousemove', positionTooltip);

    g.on('mouseleave', function() {
      d3.select(this).select('.hs-core').attr('r', hs.r * 0.55);
      tooltip.classList.remove('visible');
    });
  });

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
