/* ============================================================
   APEX WATCH — NEO 3D Orbital Visualization
   Three.js scene: Earth + distance rings + asteroid positions
   Data driven by the neoDataReady custom event from neo.js
   ============================================================ */

(function () {
  'use strict';

  // Scale: 1 Lunar Distance → LD_SCALE scene units
  const LD_SCALE = 3.2;

  // Threat level colour map
  const LV_COLOR = {
    critical: 0xff1133,
    warning:  0xff5500,
    caution:  0xffaa00,
    monitor:  0x0088ff,
    nominal:  0x1e3a5f,
  };
  function ldLevel(ld) {
    if (ld <  1) return 'critical';
    if (ld <  5) return 'warning';
    if (ld < 10) return 'caution';
    if (ld < 20) return 'monitor';
    return 'nominal';
  }

  // ── Earth: real textures from Three.js CDN ─────────────────
  // Uses the same jsDelivr CDN already serving three.min.js,
  // so no new CDN dependency is introduced.
  // Textures: day (atmos), normal map, specular (ocean shine),
  // and city-lights emissive for the dark side.
  // Falls back to a canvas-drawn Earth if any load fails.

  // npmパッケージにはテクスチャが同梱されないため、GitHubリポジトリ直接配信を使用
const TEX_BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r155/examples/textures/planets/';

  function makeFallbackTex() {
    const W = 1024, H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    // Ocean background — deep blue gradient
    const seaGrad = ctx.createLinearGradient(0, 0, 0, H);
    seaGrad.addColorStop(0,    '#06203d');
    seaGrad.addColorStop(0.45, '#0b2f55');
    seaGrad.addColorStop(1,    '#071a30');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, W, H);

    // Helper: lon/lat → pixel (equirectangular)
    const px = (lon, lat) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H];

    // Draw a land polygon from [lon,lat] pairs
    function land(pts, fill) {
      ctx.beginPath();
      pts.forEach(([lon, lat], i) => {
        const [x, y] = px(lon, lat);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    }

    const LAND  = '#2a5c2a';
    const LAND2 = '#244e20';
    const LAND3 = '#3a6830';

    // ─ North America ─
    land([[-168,60],[-165,54],[-130,54],[-124,49],[-124,40],[-117,32],[-105,20],[-88,15],[-82,9],[-77,8],[-77,9],[-80,14],[-80,24],[-72,41],[-66,44],[-55,47],[-55,52],[-59,60],[-65,65],[-70,68],[-83,74],[-100,75],[-120,72],[-141,70],[-155,68],[-168,65]], LAND);
    // Alaska bump
    land([[-168,60],[-165,54],[-163,58],[-152,59],[-150,61],[-145,62],[-141,60],[-141,70],[-155,68],[-163,65],[-168,66]], LAND2);
    // Greenland
    land([[-73,83],[-25,83],[-17,70],[-24,60],[-42,58],[-54,61],[-58,69],[-68,76],[-73,83]], '#3a6a50');

    // ─ South America ─
    land([[-80,12],[-75,12],[-62,11],[-52,5],[-35,5],[-34,-5],[-36,-10],[-35,-20],[-40,-22],[-43,-23],[-44,-30],[-52,-32],[-52,-33],[-58,-34],[-62,-38],[-65,-42],[-65,-52],[-68,-54],[-72,-50],[-75,-40],[-77,-22],[-81,-2],[-80,0],[-78,2],[-80,8],[-77,8],[-80,12]], LAND);

    // ─ Europe ─
    land([[-10,36],[-5,36],[0,38],[3,43],[7,44],[12,44],[15,38],[20,38],[26,37],[30,40],[30,46],[24,48],[22,54],[18,55],[12,56],[8,58],[5,58],[0,61],[-3,58],[-5,56],[-5,48],[-8,44],[-10,36]], LAND2);
    // Iberia
    land([[-9,37],[-9,44],[-1,43],[3,43],[0,38],[-6,36],[-9,37]], LAND3);
    // UK
    land([[-5,50],[0,51],[2,53],[0,58],[-3,57],[-5,58],[-5,50]], LAND2);
    // Scandinavia
    land([[4,57],[5,58],[6,62],[14,67],[19,70],[28,71],[31,70],[28,62],[22,55],[14,55],[8,58],[4,57]], LAND2);

    // ─ Africa ─
    land([[-17,15],[-15,10],[-10,5],[-3,5],[2,5],[10,5],[14,4],[18,1],[20,-5],[22,-15],[26,-20],[32,-26],[30,-30],[26,-34],[20,-35],[17,-30],[14,-18],[10,-10],[8,4],[4,6],[0,6],[-2,5],[-5,5],[-8,6],[-15,12],[-17,15]], LAND);
    // Horn of Africa
    land([[38,12],[44,12],[50,12],[44,9],[40,4],[38,3],[35,2],[38,9],[38,12]], LAND2);
    // Madagascar
    land([[44,-13],[50,-13],[50,-25],[44,-25],[44,-13]], LAND2);

    // ─ Middle East / Arabian Peninsula ─
    land([[26,37],[36,37],[42,37],[44,38],[48,30],[56,24],[58,22],[55,18],[44,12],[38,12],[34,18],[34,26],[28,31],[26,37]], LAND2);

    // ─ Asia (main) ─
    land([[26,37],[44,38],[48,30],[50,22],[56,24],[60,22],[62,23],[70,22],[80,18],[80,12],[80,8],[78,10],[74,18],[70,24],[66,28],[60,28],[54,32],[48,38],[44,38],[42,37],[36,37],[30,40],[30,46],[36,48],[42,50],[48,46],[52,48],[56,52],[54,58],[58,60],[60,62],[65,66],[72,68],[80,72],[90,72],[100,70],[110,68],[120,72],[140,72],[140,58],[138,46],[138,36],[135,34],[120,28],[110,20],[105,12],[100,4],[104,1],[106,-4],[110,-8],[114,-6],[115,2],[120,6],[125,12],[120,20],[115,24],[110,18],[104,1],[100,4],[95,5],[90,22],[84,28],[80,30],[76,22],[72,22],[70,26],[66,28],[60,28],[54,32],[48,46],[42,50],[36,48],[30,46],[26,46],[22,54],[30,60],[36,62],[40,62],[44,60],[48,60],[54,58],[58,60],[60,62],[65,66],[72,68],[80,72],[90,72],[100,70],[110,68],[120,72],[140,72]], LAND);

    // ─ Southeast Asia islands ─
    land([[95,22],[100,24],[100,18],[96,15],[100,8],[104,2],[110,-2],[114,-4],[118,-2],[120,2],[124,4],[122,10],[118,16],[112,22],[108,20],[104,12],[102,4],[100,1],[96,5],[92,20],[95,22]], LAND2);
    land([[100,0],[104,-4],[108,-6],[112,-7],[115,-5],[118,-6],[120,-8],[114,-8],[110,-8],[106,-6],[104,-4],[100,0]], LAND3);

    // ─ Japan ─
    land([[129,31],[130,33],[131,34],[133,34],[135,35],[137,37],[138,38],[136,36],[133,32],[130,31],[129,31]], LAND2);
    land([[139,36],[140,38],[141,40],[142,42],[141,44],[140,44],[140,40],[139,36]], LAND2);
    land([[141,42],[141,44],[143,44],[145,43],[144,42],[143,42],[141,42]], LAND2);

    // ─ Australia ─
    land([[114,-22],[116,-20],[120,-18],[124,-16],[130,-12],[136,-12],[140,-14],[148,-18],[152,-24],[154,-28],[152,-32],[148,-38],[144,-38],[140,-35],[136,-34],[132,-32],[128,-32],[122,-34],[116,-32],[114,-28],[114,-22]], LAND);
    // Tasmania
    land([[144,-40],[148,-40],[148,-44],[144,-44],[144,-40]], LAND2);
    // New Zealand (N island)
    land([[172,-36],[176,-36],[178,-38],[176,-40],[172,-40],[172,-36]], LAND2);
    // New Zealand (S island)
    land([[168,-44],[174,-44],[172,-46],[168,-46],[168,-44]], LAND2);

    // ─ Polar ice caps ─
    const iceGrad = ctx.createLinearGradient(0, 0, 0, H);
    iceGrad.addColorStop(0,   'rgba(220,235,255,0.95)');
    iceGrad.addColorStop(0.08,'rgba(200,220,255,0.7)');
    iceGrad.addColorStop(0.12,'rgba(180,210,255,0)');
    ctx.fillStyle = iceGrad;
    ctx.fillRect(0, 0, W, H * 0.12);

    const iceGrad2 = ctx.createLinearGradient(0, H * 0.88, 0, H);
    iceGrad2.addColorStop(0,   'rgba(180,210,255,0)');
    iceGrad2.addColorStop(0.06,'rgba(210,228,255,0.7)');
    iceGrad2.addColorStop(1,   'rgba(230,240,255,0.95)');
    ctx.fillStyle = iceGrad2;
    ctx.fillRect(0, H * 0.88, W, H * 0.12);

    // Ocean subtle speculars (white scatter lines)
    ctx.strokeStyle = 'rgba(120,170,220,0.06)';
    ctx.lineWidth = 1;
    for (let gy = H * 0.15; gy < H * 0.85; gy += 28) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    return new THREE.CanvasTexture(c);
  }

  function buildEarth(scene) {
    const mat = new THREE.MeshPhongMaterial({
      map:       makeFallbackTex(),   // immediately visible while CDN loads
      color:     0xffffff,
      specular:  new THREE.Color(0x3366aa),
      shininess: 40,
    });

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      mat
    );
    scene.add(earthMesh);

    // Async-load real textures; each updates the material independently
    const L = new THREE.TextureLoader();
    L.load(TEX_BASE + 'earth_atmos_2048.jpg',
      tex => { mat.map = tex; mat.needsUpdate = true; });
    L.load(TEX_BASE + 'earth_normal_2048.jpg',
      tex => { mat.normalMap = tex; mat.normalScale = new THREE.Vector2(1.8, 1.8); mat.needsUpdate = true; });
    L.load(TEX_BASE + 'earth_specular_2048.jpg',
      tex => { mat.specularMap = tex; mat.needsUpdate = true; });
    // City lights visible on the dark (night) side
    L.load(TEX_BASE + 'earth_lights_2048.png',
      tex => {
        mat.emissiveMap       = tex;
        mat.emissive          = new THREE.Color(0xffaa44);
        mat.emissiveIntensity = 0.85;
        mat.needsUpdate = true;
      });

    // Thin surface atmosphere haze (front face, very subtle)
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.015, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x88bbff, transparent: true, opacity: 0.04, side: THREE.FrontSide })
    ));
    // Limb glow — inner
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x1166ee, transparent: true, opacity: 0.13, side: THREE.BackSide })
    ));
    // Limb glow — outer halo
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.48, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x0033aa, transparent: true, opacity: 0.05, side: THREE.BackSide })
    ));

    return earthMesh;
  }

  // ── Main scene init ───────────────────────────────────────
  function initScene(neos) {
    const container = document.getElementById('neo3d-container');
    if (!container || typeof THREE === 'undefined') return;

    // Remove loading placeholder
    container.innerHTML = '';
    container.style.position = 'relative';

    const W = container.clientWidth  || 800;
    const H = container.clientHeight || 440;

    // Three.js renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 2-D label canvas (overlaid)
    const lc = document.createElement('canvas');
    lc.width = W; lc.height = H;
    lc.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    container.appendChild(lc);
    const lx = lc.getContext('2d');

    // Scene + camera
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 600);
    let camTheta = 0.5, camPhi = 1.05, camR = 30;

    function syncCamera() {
      camera.position.set(
        camR * Math.sin(camPhi) * Math.cos(camTheta),
        camR * Math.cos(camPhi),
        camR * Math.sin(camPhi) * Math.sin(camTheta)
      );
      camera.lookAt(0, 0, 0);
    }
    syncCamera();

    // ── Lighting (tuned for realistic Earth) ──
    // Low ambient so the night side stays dark enough for city-light emissive
    scene.add(new THREE.AmbientLight(0x0d1a33, 0.9));
    // Warm directional sun
    const sun = new THREE.DirectionalLight(0xfff6e0, 2.2);
    sun.position.set(50, 28, 35);
    scene.add(sun);
    // Cool atmospheric back-scatter (blue rim)
    const rim = new THREE.PointLight(0x1144cc, 1.0, 90);
    rim.position.set(-28, 8, -20);
    scene.add(rim);

    // ── Star field ──
    const starPos = [];
    for (let i = 0; i < 2400; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const th  = Math.random() * Math.PI * 2;
      const r   = 220 + Math.random() * 60;
      starPos.push(r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo,
      new THREE.PointsMaterial({ color: 0x99aacc, size: 0.25, sizeAttenuation: true, transparent: true, opacity: 0.85 })));

    // ── Equatorial grid ──
    const grid = new THREE.GridHelper(90, 45, 0x0d1a33, 0x0d1a33);
    grid.material.transparent = true; grid.material.opacity = 0.55;
    scene.add(grid);

    // ── Earth (realistic textures + atmosphere) ──
    const earthMesh = buildEarth(scene);

    // ── Orbital distance rings ──
    const RINGS = [
      { ld: 1,  hex: 0x334466, lw: 0.05, op: 0.70, label: '1 LD 月軌道' },
      { ld: 5,  hex: 0xff5500, lw: 0.06, op: 0.45, label: '5 LD' },
      { ld: 10, hex: 0xffaa00, lw: 0.06, op: 0.32, label: '10 LD' },
      { ld: 20, hex: 0x0088ff, lw: 0.06, op: 0.22, label: '20 LD' },
    ];
    RINGS.forEach(({ ld, hex, lw, op }) => {
      const r = ld * LD_SCALE;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - lw, r + lw, 128),
        new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, transparent: true, opacity: op })
      );
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
    });

    // ── Asteroids ──
    const astObjects = [];  // { mesh, pos3, neo, hex }
    const cap = Math.min(neos.length, 30);

    for (let i = 0; i < cap; i++) {
      const neo  = neos[i];
      const ld   = Math.min(neo.ld, 26);
      const r3   = ld * LD_SCALE;
      const lv   = ldLevel(neo.ld);
      const hex  = LV_COLOR[lv];

      // Spread evenly in 3D hemisphere (above equatorial plane)
      const theta = (i / cap) * Math.PI * 2 + 0.3;
      const phi   = Math.PI * (0.22 + (i % 7) * 0.055);
      const x = r3 * Math.sin(phi) * Math.cos(theta);
      const y = r3 * Math.cos(phi) * 0.45;   // flatten for readability
      const z = r3 * Math.sin(phi) * Math.sin(theta);
      const pos3 = new THREE.Vector3(x, y, z);

      // Asteroid size proportional to estimated diameter (log scale)
      const sz = Math.max(0.10, Math.min(0.38, Math.log10(Math.max(neo.dMax, 10)) * 0.12));

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(sz, 10, 10),
        new THREE.MeshPhongMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.55 })
      );
      mesh.position.copy(pos3);
      scene.add(mesh);

      // Halo glow for close approaches
      if (neo.ld < 5) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(sz * 3.0, 10, 10),
          new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.10, side: THREE.BackSide })
        );
        halo.position.copy(pos3);
        scene.add(halo);
      }

      // Approach trail: line from 2.5× distance toward Earth
      const farPt  = pos3.clone().multiplyScalar(2.5);
      const trailGeo = new THREE.BufferGeometry().setFromPoints([farPt, pos3]);
      scene.add(new THREE.Line(trailGeo,
        new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.22 })));

      // Dashed line from asteroid to equatorial plane (depth cue)
      const dropGeo = new THREE.BufferGeometry().setFromPoints([pos3, new THREE.Vector3(x, 0, z)]);
      scene.add(new THREE.Line(dropGeo,
        new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.12 })));

      astObjects.push({ mesh, pos3, neo, hex });
    }

    // ── Camera controls (mouse + touch) ──
    let dragging = false, autoSpin = true;
    let lastX = 0, lastY = 0;

    renderer.domElement.addEventListener('mousedown', e => {
      dragging = true; autoSpin = false;
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      camTheta -= (e.clientX - lastX) * 0.006;
      camPhi    = Math.max(0.12, Math.min(Math.PI * 0.58, camPhi + (e.clientY - lastY) * 0.006));
      lastX = e.clientX; lastY = e.clientY;
      syncCamera();
    });
    renderer.domElement.addEventListener('wheel', e => {
      camR = Math.max(7, Math.min(75, camR + e.deltaY * 0.06));
      syncCamera();
    }, { passive: true });
    // Touch
    let t0 = null;
    renderer.domElement.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY }; autoSpin = false; }
    }, { passive: true });
    renderer.domElement.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && t0) {
        camTheta -= (e.touches[0].clientX - t0.x) * 0.007;
        camPhi    = Math.max(0.12, Math.min(Math.PI * 0.58, camPhi + (e.touches[0].clientY - t0.y) * 0.007));
        t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        syncCamera();
      }
    }, { passive: true });

    // Double-click resets view
    renderer.domElement.addEventListener('dblclick', () => {
      camTheta = 0.5; camPhi = 1.05; camR = 30; autoSpin = true; syncCamera();
    });

    // ── Resize ──
    const ro = new ResizeObserver(() => {
      const w2 = container.clientWidth, h2 = container.clientHeight || 440;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
      lc.width = w2; lc.height = h2;
    });
    ro.observe(container);

    // ── Animation loop ──
    let tick = 0;
    let paused = false;
    const visObs = new IntersectionObserver(es => { paused = !es[0].isIntersecting; }, { threshold: 0.05 });
    visObs.observe(container);

    const tmp = new THREE.Vector3();

    function drawLabels() {
      lx.clearRect(0, 0, lc.width, lc.height);
      lx.font = '9px "Share Tech Mono", monospace';

      astObjects.forEach(({ mesh, neo, hex }) => {
        // Project 3D pos to 2D screen
        tmp.copy(mesh.position);
        tmp.project(camera);
        if (tmp.z >= 1) return; // behind camera

        const sx = (tmp.x + 1) / 2 * lc.width;
        const sy = -(tmp.y - 1) / 2 * lc.height;

        const col = '#' + hex.toString(16).padStart(6, '0');
        const ldStr = neo.ld < 10 ? neo.ld.toFixed(2) : neo.ld.toFixed(1);

        // Dot marker
        lx.beginPath();
        lx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        lx.fillStyle = col;
        lx.fill();

        // Show label only for closer/notable objects (declutter)
        if (neo.ld < 15 || neo.pha) {
          lx.fillStyle = col;
          lx.globalAlpha = 0.9;
          lx.fillText(neo.name.length > 22 ? neo.name.slice(0, 22) + '…' : neo.name, sx + 5, sy - 3);
          lx.fillStyle = 'rgba(180,200,230,0.7)';
          lx.font = '8px "Share Tech Mono", monospace';
          lx.fillText(ldStr + ' LD', sx + 5, sy + 7);
          lx.font = '9px "Share Tech Mono", monospace';
          lx.globalAlpha = 1;
        }
      });

      // Ring labels (at right side of each ring)
      const ringLabels = [
        { ld: 1,  text: '← 月軌道 1 LD',  col: 'rgba(80,100,160,0.8)'  },
        { ld: 5,  text: '← 5 LD',           col: 'rgba(200,80,0,0.75)'   },
        { ld: 10, text: '← 10 LD',          col: 'rgba(200,140,0,0.65)'  },
        { ld: 20, text: '← 20 LD',          col: 'rgba(0,100,200,0.55)'  },
      ];
      ringLabels.forEach(({ ld, text, col }) => {
        const r3 = ld * LD_SCALE;
        tmp.set(r3, 0, 0).project(camera);
        if (tmp.z >= 1) return;
        const sx = (tmp.x + 1) / 2 * lc.width;
        const sy = -(tmp.y - 1) / 2 * lc.height;
        lx.fillStyle = col;
        lx.font = '8px "Share Tech Mono", monospace';
        lx.fillText(text, sx + 3, sy + 3);
      });
      lx.font = '9px "Share Tech Mono", monospace';
    }

    function frame() {
      requestAnimationFrame(frame);
      if (paused) return;
      tick++;
      if (autoSpin) { camTheta += 0.003; syncCamera(); }
      earthMesh.rotation.y += 0.004;

      // Subtle pulsing for dangerous objects
      astObjects.forEach(({ mesh, neo }, i) => {
        if (neo.ld < 5) {
          const p = 1 + Math.sin(tick * 0.05 + i * 1.3) * 0.12;
          mesh.scale.setScalar(p);
        }
      });

      renderer.render(scene, camera);
      drawLabels();
    }
    frame();
  }

  // ── 3D panel toggle ──────────────────────────────────────
  function wire3DToggle() {
    const btn  = document.getElementById('neo3dToggleBtn');
    const wrap = document.getElementById('neo3dWrap');
    if (!btn || !wrap) return;
    btn.addEventListener('click', () => {
      const hidden = wrap.classList.toggle('neo3d-hidden');
      btn.textContent = hidden ? '▶ 3D図 表示' : '▼ 3D図 非表示';
    });
  }

  // ── Entry point ──────────────────────────────────────────
  let _sceneReady = false;

  function bootScene(neos) {
    if (_sceneReady) return;
    _sceneReady = true;
    try {
      wire3DToggle();
      requestAnimationFrame(() => requestAnimationFrame(() => initScene(neos)));
    } catch (e) {
      console.warn('neo3d init failed:', e);
      const c = document.getElementById('neo3d-container');
      if (c) c.innerHTML = '<div style="padding:20px;text-align:center;font-family:monospace;font-size:11px;color:#3a4a6a">3D 表示の初期化に失敗しました</div>';
    }
  }

  document.addEventListener('neoDataReady', ({ detail: { neos } }) => bootScene(neos));

  // Lazy-load support: NEO data may already be ready before this script loads
  if (Array.isArray(window.__NEO_DATA)) {
    bootScene(window.__NEO_DATA);
  }

  // Fallback: show Earth globe without asteroid data if NEO fetch fails
  setTimeout(() => {
    if (_sceneReady) return;
    if (typeof THREE === 'undefined') {
      const c = document.getElementById('neo3d-container');
      if (c) c.innerHTML = '<div style="padding:20px;text-align:center;font-family:monospace;font-size:11px;color:#3a4a6a">Three.js の読み込みに失敗しました</div>';
      return;
    }
    bootScene([]);
  }, 15000);
})();
