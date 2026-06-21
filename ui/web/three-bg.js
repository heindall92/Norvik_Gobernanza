/* Three.js particle background — accent-driven */

function hexToInt(hex) {
  return parseInt(String(hex).replace('#', ''), 16);
}

function buildScene(canvas, opts) {
  if (typeof THREE === 'undefined') return null;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  cam.position.z = opts.dist;

  const group = new THREE.Group();
  scene.add(group);

  const accent = opts.accentHex || '#ff6a4d';
  const palette = opts.palette || [
    hexToInt(accent),
    hexToInt(accent) ^ 0x222222,
    0x3b7bff,
    hexToInt(accent) | 0x001122,
    0xff6b80,
  ];

  const nodes = [];
  const N = opts.count;

  for (let i = 0; i < N; i++) {
    const r = opts.radius * (0.35 + Math.pow(Math.random(), 0.6) * 0.9);
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(p) * Math.cos(t);
    const y = r * Math.sin(p) * Math.sin(t);
    const z = r * Math.cos(p);
    const col = palette[(Math.random() * palette.length) | 0];
    const size = 0.05 + Math.random() * 0.14;
    const geo = new THREE.SphereGeometry(size, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.userData = { phase: Math.random() * Math.PI * 2 };
    group.add(m);
    nodes.push(m);
  }

  const linkGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = nodes[i].position.distanceTo(nodes[j].position);
      if (d < opts.radius * 0.42 && Math.random() < 0.18) {
        pts.push(
          nodes[i].position.x, nodes[i].position.y, nodes[i].position.z,
          nodes[j].position.x, nodes[j].position.y, nodes[j].position.z
        );
      }
    }
  }
  linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const linkMat = new THREE.LineBasicMaterial({
    color: hexToInt(accent),
    transparent: true,
    opacity: 0.1,
  });
  group.add(new THREE.LineSegments(linkGeo, linkMat));

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(opts.radius * 0.28, 24, 24),
    new THREE.MeshBasicMaterial({ color: hexToInt(accent), transparent: true, opacity: 0.08 })
  );
  group.add(core);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }

  const clock = new THREE.Clock();
  let rafId = null;

  function loop() {
    resize();
    const t = clock.getElapsedTime();
    group.rotation.y += 0.0014;
    group.rotation.x = Math.sin(t * 0.2) * 0.12;
    for (const m of nodes) {
      const s = 1 + Math.sin(t * 2 + m.userData.phase) * 0.3;
      m.scale.setScalar(s);
      m.material.opacity = 0.45 + 0.4 * Math.abs(Math.sin(t * 1.5 + m.userData.phase));
    }
    renderer.render(scene, cam);
    rafId = requestAnimationFrame(loop);
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) loop();

  return {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      renderer.dispose();
    },
  };
}

function initNorvikBackground(accentHex) {
  const canvas = document.getElementById('cellCanvas');
  if (!canvas) return null;
  const color = accentHex || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff6a4d';
  return buildScene(canvas, { dist: 9, radius: 4.2, count: 180, accentHex: color });
}

window.initNorvikBackground = initNorvikBackground;
