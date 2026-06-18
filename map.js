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
  // モバイルでは右シフトなし（DEFCONパネルが地図の下に移動するため不要）
  const shiftX = W >= 600 ? W * 0.10 : 0;
  const projection = d3.geoNaturalEarth1()
    .scale(W / 6.4)
    .translate([W / 2 + shiftX, H / 2 + H * 0.05]);

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

  // Country borders
  svg.append('path')
    .datum(borders)
    .attr('class', 'country-border')
    .attr('d', pathGen);

  document.getElementById('mapLoading').textContent = '◈ LIVE';
  document.getElementById('mapLoading').style.color = 'var(--accent-green)';

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
