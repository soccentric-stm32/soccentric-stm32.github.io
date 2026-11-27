// Hero animation: one Three.js scene per platform, picked by <canvas data-anim>.
// Falls back silently (the CSS disc stays) if WebGL or the CDN is unavailable.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";

const canvas = document.querySelector("canvas.hero3d");

async function start(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // Colours follow the page tokens, so light and dark mode both match.
  const mats = [];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#c0390f";
  const paint = () => mats.forEach((m) => m.color.set(css(m.userData.token)));
  const mat = (Kind, token, opts = {}) => { const m = new Kind(opts); m.userData.token = token; mats.push(m); return m; };
  const A = (o) => mat(THREE.MeshStandardMaterial, "--accent", { roughness: 0.45, metalness: 0.1, ...o });
  const B = (o) => mat(THREE.MeshStandardMaterial, "--accent-2", { roughness: 0.45, metalness: 0.1, ...o });
  const L = (token, o) => mat(THREE.LineBasicMaterial, token, { transparent: true, opacity: 0.55, ...o });
  const P = (token, o) => mat(THREE.PointsMaterial, token, { size: 0.08, transparent: true, opacity: 0.9, ...o });

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(4, 6, 8); scene.add(key);

  const root = new THREE.Group(); scene.add(root);
  const update = (SCENES[canvas.dataset.anim] || SCENES.hub)(root, { A, B, L, P, THREE });
  paint();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint);

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas); resize();

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = true, t0 = performance.now();
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  const frame = (now) => {
    if (visible && !document.hidden) { update((now - t0) / 1000); renderer.render(scene, camera); }
    if (!still) requestAnimationFrame(frame);
  };
  if (still) { update(2.5); renderer.render(scene, camera); } else requestAnimationFrame(frame);
  canvas.classList.add("on");
}

const SCENES = {
  // Hub: ten platforms orbiting one shared core.
  hub(root, { A, B, L, THREE }) {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), A({ flatShading: true }));
    root.add(core);
    const ring = new THREE.Group(); root.add(ring);
    const nodes = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = 2.7;
      const m = new THREE.Mesh(new THREE.SphereGeometry(i === 9 ? 0.26 : 0.2, 20, 14), i === 9 ? B() : A());
      m.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.42, Math.sin(a) * r * 0.5);
      ring.add(m); nodes.push(m);
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), m.position.clone()]);
      ring.add(new THREE.Line(g, L("--accent", { opacity: 0.25 })));
    }
    ring.rotation.x = 0.35;
    return (t) => {
      ring.rotation.y = t * 0.25; core.rotation.set(t * 0.3, t * 0.4, 0);
      nodes.forEach((n, i) => n.scale.setScalar(1 + 0.18 * Math.sin(t * 2 + i)));
    };
  },

  // Acadia (Raspberry Pi): a breathing raspberry of drupelets.
  acadia(root, { A, B, THREE }) {
    const g = new THREE.SphereGeometry(0.34, 18, 12), berry = new THREE.Group(); root.add(berry);
    const drupes = [];
    for (let i = 0; i < 60; i++) {
      const y = 1 - (i / 59) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      const m = new THREE.Mesh(g, A());
      const v = new THREE.Vector3(Math.cos(a) * r, y * 1.15, Math.sin(a) * r).multiplyScalar(1.6);
      m.position.copy(v); m.userData.v = v; berry.add(m); drupes.push(m);
    }
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 4), B({ flatShading: true }));
      leaf.position.set(Math.cos(i * 2.1) * 0.4, 2.15, Math.sin(i * 2.1) * 0.4);
      leaf.rotation.set(Math.PI + Math.sin(i * 2.1) * 0.6, 0, Math.cos(i * 2.1) * 0.6);
      berry.add(leaf);
    }
    return (t) => {
      berry.rotation.y = t * 0.45; berry.rotation.z = Math.sin(t * 0.6) * 0.12;
      drupes.forEach((m, i) => m.position.copy(m.userData.v).multiplyScalar(1 + 0.04 * Math.sin(t * 2.4 + i * 0.7)));
    };
  },

  // Arches (Jetson): a field of GPU cores rippling in parallel.
  arches(root, { A, B, THREE }) {
    const n = 14, g = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const mesh = new THREE.InstancedMesh(g, A(), n * n), hot = new THREE.InstancedMesh(g, B(), n * n);
    root.add(mesh, hot); root.rotation.set(0.95, 0, 0.6);
    const d = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    return (t) => {
      let k = 0;
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++, k++) {
        const px = (x - n / 2 + 0.5) * 0.34, py = (y - n / 2 + 0.5) * 0.34, r = Math.hypot(px, py);
        const h = Math.sin(r * 2.2 - t * 2.4);
        d.position.set(px, py, h * 0.45); d.scale.set(1, 1, 1 + Math.max(h, 0) * 2.2); d.updateMatrix();
        const isHot = h > 0.82;
        mesh.setMatrixAt(k, isHot ? zero : d.matrix);
        hot.setMatrixAt(k, isHot ? d.matrix : zero);
      }
      mesh.instanceMatrix.needsUpdate = hot.instanceMatrix.needsUpdate = true;
      root.rotation.z = 0.6 + t * 0.12;
    };
  },

  // Joshua (TI Sitara): an industrial torus knot, wire over solid.
  joshua(root, { A, L, THREE }) {
    const g = new THREE.TorusKnotGeometry(1.45, 0.38, 180, 20, 2, 3);
    const solid = new THREE.Mesh(g, A({ roughness: 0.3, metalness: 0.35 }));
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusKnotGeometry(1.45, 0.52, 90, 8, 2, 3)), L("--accent-2", { opacity: 0.35 }));
    root.add(solid, wire);
    return (t) => { root.rotation.set(t * 0.35, t * 0.5, 0); wire.rotation.z = -t * 0.2; };
  },

  // Pinnacle (NXP i.MX): stacked layers rising to a peak.
  pinnacle(root, { A, B, THREE }) {
    const rings = [];
    for (let i = 0; i < 9; i++) {
      const r = 2.3 - i * 0.24;
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 10, 80), i % 3 === 2 ? B() : A());
      m.rotation.x = Math.PI / 2; root.add(m); rings.push(m);
    }
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), B({ flatShading: true })); root.add(tip);
    root.rotation.x = 0.5;
    return (t) => {
      rings.forEach((m, i) => { m.position.y = -1.7 + i * 0.36 + Math.sin(t * 1.6 - i * 0.5) * 0.12; m.rotation.z = t * (0.2 + i * 0.05); });
      tip.position.y = 1.8 + Math.sin(t * 1.6) * 0.15; tip.rotation.y = t * 1.2; root.rotation.y = t * 0.2;
    };
  },

  // Sequoia (Intel x86): a solid core inside a counter-rotating geodesic shell.
  sequoia(root, { A, B, L, THREE }) {
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05), A({ flatShading: true }));
    const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.15, 1)), L("--accent", { opacity: 0.6 }));
    const outer = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.7, 0)), L("--accent-2", { opacity: 0.35 }));
    const sats = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), B());
      s.position.set(Math.cos(i * Math.PI / 2) * 1.6, 0, Math.sin(i * Math.PI / 2) * 1.6); sats.add(s);
    }
    root.add(core, shell, outer, sats);
    return (t) => {
      core.rotation.set(t * 0.4, t * 0.6, 0); shell.rotation.set(-t * 0.2, -t * 0.3, 0); outer.rotation.y = t * 0.15;
      sats.rotation.set(0.4, t * 0.9, 0);
    };
  },

  // Zion (Xilinx Zynq): reconfigurable fabric, tiles flipping in waves.
  zion(root, { A, B, THREE }) {
    const n = 8, tiles = [], g = new THREE.BoxGeometry(0.42, 0.42, 0.08);
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      const front = new THREE.Mesh(g, (x + y) % 5 === 0 ? B() : A());
      front.position.set((x - n / 2 + 0.5) * 0.5, (y - n / 2 + 0.5) * 0.5, 0);
      front.userData.p = x * 0.35 + y * 0.55; root.add(front); tiles.push(front);
    }
    root.rotation.set(-0.45, 0.5, 0.1);
    return (t) => {
      tiles.forEach((m) => {
        const s = Math.sin(t * 1.4 - m.userData.p);
        m.rotation.y = s > 0.6 ? (s - 0.6) / 0.4 * Math.PI : 0; m.position.z = Math.max(s, 0) * 0.25;
      });
      root.rotation.y = 0.5 + Math.sin(t * 0.3) * 0.25;
    };
  },

  // Orion (STM32MP1): the Orion constellation, stars linked and twinkling.
  orion(root, { A, B, L, P, THREE }) {
    const pts = [[-1.3, 2.2], [1.4, 2], [-0.55, 0.1], [0, 0], [0.55, -0.1], [-1.5, -2.2], [1.6, -2], [0, 2.9], [-2.1, 1], [2.1, 1.3]];
    const V = pts.map(([x, y], i) => new THREE.Vector3(x, y, Math.sin(i * 1.7) * 0.6));
    const stars = V.map((v, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(i >= 2 && i <= 4 ? 0.27 : 0.21, 18, 14), i >= 2 && i <= 4 ? B() : A()); m.position.copy(v); root.add(m); return m; });
    const E = [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7], [0, 8], [1, 9]];
    E.forEach(([a, b]) => root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V[a], V[b]]), L("--accent", { opacity: 0.7 }))));
    const dust = new THREE.BufferGeometry(), arr = [];
    for (let i = 0; i < 160; i++) arr.push((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 3 - 1);
    dust.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    root.add(new THREE.Points(dust, P("--accent-2", { size: 0.07, opacity: 0.6 })));
    root.scale.setScalar(0.95);
    return (t) => {
      root.rotation.y = Math.sin(t * 0.35) * 0.6; root.rotation.x = Math.sin(t * 0.25) * 0.15;
      stars.forEach((s, i) => s.scale.setScalar(1 + 0.3 * Math.sin(t * 3 + i * 1.3)));
    };
  },

  // Polaris (Renesas RZ): the north star, a spiral galaxy turning around it.
  polaris(root, { A, B, P, THREE }) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), A({ flatShading: true }));
    const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), A({ transparent: true, opacity: 0.18 }));
    root.add(star, glow);
    const mk = (n, arm, token) => {
      const g = new THREE.BufferGeometry(), a = [];
      for (let i = 0; i < n; i++) {
        const r = 0.6 + Math.random() * 2.4, th = r * 1.6 + arm + (Math.random() - 0.5) * 0.5;
        a.push(Math.cos(th) * r, (Math.random() - 0.5) * 0.25, Math.sin(th) * r);
      }
      g.setAttribute("position", new THREE.Float32BufferAttribute(a, 3));
      return new THREE.Points(g, P(token, { size: 0.12 }));
    };
    const disc = new THREE.Group(); disc.add(mk(500, 0, "--accent"), mk(500, Math.PI, "--accent-2")); root.add(disc);
    disc.rotation.x = 0.55;
    return (t) => { disc.rotation.y = t * 0.3; star.rotation.y = -t * 0.8; glow.scale.setScalar(1 + 0.15 * Math.sin(t * 2.2)); };
  },

  // Vela (Snapdragon): a sail of signal, a mesh rolling like a wave.
  vela(root, { A, L, THREE }) {
    const g = new THREE.PlaneGeometry(3.6, 3.6, 36, 36), base = g.attributes.position.array.slice();
    const surf = new THREE.Mesh(g, A({ side: THREE.DoubleSide, flatShading: true, roughness: 0.6 }));
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(g), L("--accent-2", { opacity: 0.25 }));
    root.add(surf, wire); root.rotation.set(-1.0, 0, 0.5);
    return (t) => {
      const p = g.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        const x = base[i], y = base[i + 1];
        p[i + 2] = Math.sin(x * 1.8 + t * 1.8) * 0.3 + Math.cos(y * 1.5 + t * 1.3) * 0.25;
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
      wire.geometry.dispose(); wire.geometry = new THREE.WireframeGeometry(g);
      root.rotation.z = 0.5 + t * 0.1;
    };
  },

  // Lyra (STM32 MCU): a microcontroller with signals pulsing out of its pins.
  lyra(root, { A, B, L, THREE }) {
    const chip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 0.28), A({ roughness: 0.35 }));
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.3), B({ roughness: 0.3 }));
    die.position.z = 0.02; root.add(chip, die);
    const traces = [];
    for (let side = 0; side < 4; side++) for (let i = 0; i < 6; i++) {
      const off = (i - 2.5) * 0.26, pts = [];
      for (let k = 0; k <= 40; k++) pts.push(new THREE.Vector3(0.9 + k * 0.05, off, 0));
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(g, L(i % 2 ? "--accent-2" : "--accent", { opacity: 0.7 }));
      line.rotation.z = side * Math.PI / 2; line.userData = { off, ph: side * 1.3 + i * 0.7 }; root.add(line); traces.push(line);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.06), A());
      pin.position.set(0.92, off, 0); pin.rotation.z = 0; const pg = new THREE.Group(); pg.add(pin); pg.rotation.z = side * Math.PI / 2; root.add(pg);
    }
    root.rotation.set(-0.6, 0.35, 0.2);
    return (t) => {
      traces.forEach((ln) => {
        const p = ln.geometry.attributes.position.array, { off, ph } = ln.userData;
        for (let k = 0; k <= 40; k++) {
          const x = 0.9 + k * 0.05, env = Math.max(0, Math.sin((k / 40) * Math.PI * 2 - t * 3 + ph));
          p[k * 3 + 1] = off + Math.sin(k * 0.9 - t * 9) * 0.06 * env * (k / 40);
          p[k * 3 + 2] = env * 0.12 * (k / 40);
        }
        ln.geometry.attributes.position.needsUpdate = true;
      });
      root.rotation.z = 0.2 + t * 0.15; die.rotation.z = -t * 0.3;
    };
  },
};

if (canvas) start(canvas).catch((e) => { console.warn("hero3d:", e); canvas.remove(); });
