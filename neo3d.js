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

  // ── Earth canvas texture (cyberpunk grid) ─────────────────
  function makeEarthTex() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#05111f'; x.fillRect(0, 0, 512, 256);
    // latitude lines
    x.strokeStyle = 'rgba(30,120,255,0.20)'; x.lineWidth = 0.8;
    for (let y = 0; y <= 256; y += 21) { x.beginPath(); x.moveTo(0, y); x.lineTo(512, y); x.stroke(); }
    // longitude lines
    for (let v = 0; v <= 512; v += 43) { x.beginPath(); x.moveTo(v, 0); x.lineTo(v, 256); x.stroke(); }
    // equator + prime meridian highlight
    x.strokeStyle = 'rgba(0,160,255,0.55)'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(0, 128);   x.lineTo(512, 128); x.stroke();
    x.beginPath(); x.moveTo(256, 0);   x.lineTo(256, 256); x.stroke();
    // bright glow spots (fake continent outlines)
    const spots = [[60,80],[200,110],[360,95],[430,140],[150,160],[300,165],[490,80]];
    spots.forEach(([sx, sy]) => {
      const g = x.createRadialGradient(sx, sy, 0, sx, sy, 30);
      g.addColorStop(0, 'rgba(0,180,255,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(sx - 35, sy - 35, 70, 70);
    });
    return new THREE.CanvasTexture(c);
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

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0x223366, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(40, 25, 50);
    scene.add(sun);
    // Rim light for Earth glow
    const rim = new THREE.PointLight(0x0044aa, 0.8, 80);
    rim.position.set(-20, 10, -15);
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

    // ── Earth ──
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 48),
      new THREE.MeshPhongMaterial({
        map: makeEarthTex(),
        color: 0x1a5276, emissive: 0x041522,
        specular: 0x224488, shininess: 40,
      })
    );
    scene.add(earthMesh);

    // Earth outer atmosphere glow (rendered from inside)
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x1155cc, transparent: true, opacity: 0.07, side: THREE.BackSide })
    ));
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x0033aa, transparent: true, opacity: 0.03, side: THREE.BackSide })
    ));

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
  // Wait for neo.js to dispatch neoDataReady
  document.addEventListener('neoDataReady', ({ detail: { neos } }) => {
    wire3DToggle();
    // Defer to next frame so the container is laid out
    requestAnimationFrame(() => requestAnimationFrame(() => initScene(neos)));
  });

  // Fallback: if Three.js didn't load
  window.addEventListener('load', () => {
    if (typeof THREE === 'undefined') {
      const c = document.getElementById('neo3d-container');
      if (c) c.innerHTML = '<div style="padding:20px;text-align:center;font-family:monospace;font-size:11px;color:#3a4a6a">Three.js の読み込みに失敗しました</div>';
    }
  });
})();
