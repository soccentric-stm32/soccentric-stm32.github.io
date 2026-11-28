// Hero animation: one mathematical system per platform, picked by <canvas data-anim>.
// Every scene is driven by an algorithm (attractors, DFT, cellular automata, wave sums),
// not by hand-keyed motion. Falls back silently (the CSS disc returns) without WebGL or on data-saver.
// Three.js (~700 KB) is fetched only once the page has loaded and the browser is idle,
// so it never competes with the text, fonts and CSS for the first paint.
const canvas = document.querySelector("canvas.hero3d");

async function start(canvas) {
  const [THREE, { Line2 }, { LineGeometry }, { LineMaterial }] = await Promise.all([
    import("three"), import("three/addons/lines/Line2.js"),
    import("three/addons/lines/LineGeometry.js"), import("three/addons/lines/LineMaterial.js")]);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const small = matchMedia("(max-width: 720px)").matches;
  const dpr = devicePixelRatio || 1;
  let ratio = small ? Math.min(dpr, 2) : Math.min(dpr * 2, 4);     // supersampled on desktop
  renderer.setPixelRatio(ratio);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 12.5);   // canvas is ~1.4x the visual size: scenes keep their size but never touch the edge

  // Colours follow the page tokens, so light and dark mode both match.
  const mats = [];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#c0390f";
  const paint = () => mats.forEach((m) => m.color.set(css(m.userData.token)));
  const mat = (Kind, token, opts = {}) => { const m = new Kind(opts); m.userData.token = token; mats.push(m); return m; };
  const kit = {
    THREE,
    A: (o) => mat(THREE.MeshStandardMaterial, "--accent", { roughness: 0.9, metalness: 0, ...o }),
    B: (o) => mat(THREE.MeshStandardMaterial, "--accent-2", { roughness: 0.9, metalness: 0, ...o }),
    L: (token, o) => mat(THREE.LineBasicMaterial, token, { transparent: true, opacity: 0.85, ...o }),
    P: (token, o) => mat(THREE.PointsMaterial, token, { size: 0.05, transparent: true, opacity: 0.9, ...o }),
  };
  const fats = [];
  kit.fat = (src, token, width = 2, opacity = 1) => {
    const m = mat(LineMaterial, token, { linewidth: width, transparent: opacity < 1, opacity, worldUnits: false });
    const line = new Line2(new LineGeometry(), m); line.frustumCulled = false;
    line.userData = { src, ver: -1 }; fats.push(line); return line;
  };
  const syncFats = () => fats.forEach((l) => {
    const a = l.userData.src.attributes.position;
    if (a.version !== l.userData.ver) { l.geometry.setPositions(a.array); l.userData.ver = a.version; }
  });
  kit.trail = (n, token, map) => trail(kit, n, token, map);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 6, 8); scene.add(key);

  const root = new THREE.Group(); scene.add(root);
  const def = SCENES[canvas.dataset.anim] || SCENES.hub;
  const update = def.build(root, kit);
  paint();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint);
  addEventListener("themechange", paint);

  const cap = document.createElement("div");
  cap.className = "hero-math"; cap.innerHTML = `<b>${def.name}</b>` + [].concat(def.eq).map((l) => `<span>${l}</span>`).join("");
  canvas.after(cap);

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    mats.forEach((m) => m.isLineMaterial && m.resolution.set(width, height));
    camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas); resize();

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = true, last = performance.now(), t = 0;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  let probe = 0, probeT = 0;
  const frame = (now) => {
    const raw = (now - last) / 1000, dt = Math.min(raw, 0.05); last = now;
    if (visible && !document.hidden) {
      t += dt; update(t, dt); syncFats(); renderer.render(scene, camera);
      if (raw < 0.25 && ++probe <= 90) {                   // average the first 90 frames
        probeT += raw;
        if (probe === 90 && probeT / 90 > 1 / 40 && ratio > 1) {
          ratio = Math.max(1, ratio / 2); renderer.setPixelRatio(ratio); resize(); probe = probeT = 0;
        }
      }
    }
    if (!still) requestAnimationFrame(frame);
  };
  if (still) { update(3, 1 / 60); syncFats(); renderer.render(scene, camera); } else requestAnimationFrame(frame);
  canvas.classList.add("on");
  canvas.closest(".hero")?.classList.add("has3d");
}

// A fixed-length polyline + dots that follows a moving point (ring buffer).
function trail({ THREE, fat }, n, token, map) {
  const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const line = fat(g, token, 1.8, 0.95);
  let filled = false;
  return {
    objects: [line],
    push(x, y, z) {
      const [X, Y, Z] = map(x, y, z);
      if (!filled) { for (let i = 0; i < n; i++) pos.set([X, Y, Z], i * 3); filled = true; }
      pos.copyWithin(0, 3); pos[n * 3 - 3] = X; pos[n * 3 - 2] = Y; pos[n * 3 - 1] = Z;
      g.attributes.position.needsUpdate = true;
      return [X, Y, Z];
    },
  };
}

// Classical 4th-order Runge-Kutta step for dx/dt = f(x).
function rk4(f, s, h) {
  const k1 = f(s), a = s.map((v, i) => v + (h / 2) * k1[i]);
  const k2 = f(a), b = s.map((v, i) => v + (h / 2) * k2[i]);
  const k3 = f(b), c = s.map((v, i) => v + h * k3[i]);
  const k4 = f(c);
  return s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// A strange attractor: integrate with RK4, draw the last n states as a trail.
function attractor({ f, s0, h, perSec, n, map, warm = 3000, spin = 0.12, tilt = [0, 0] }) {
  return (root, kit) => {
    const tr = kit.trail(n, "--accent", map); tr.objects.forEach((o) => root.add(o));
    const head = new kit.THREE.Mesh(new kit.THREE.SphereGeometry(0.1, 32, 24), kit.B()); root.add(head);
    let s = s0.slice(), acc = 0;
    for (let i = 0; i < warm; i++) s = rk4(f, s, h);           // settle onto the attractor
    for (let i = 0; i < n; i++) { s = rk4(f, s, h); tr.push(...s); }
    root.rotation.set(tilt[0], 0, tilt[1]);
    return (t, dt) => {
      acc += dt * perSec;
      for (; acc >= 1; acc--) { s = rk4(f, s, h); head.position.set(...tr.push(...s)); }
      root.rotation.y = t * spin;
    };
  };
}

const SCENES = {
  // Hub: points on a Fibonacci sphere (golden-angle spiral), a wave running pole to pole.
  hub: {
    name: "Fibonacci sphere", eq: "θₙ = n·137.5°, yₙ = 1 − 2(n+½)/N",
    build(root, { THREE, P, B }) {
      const N = 900, ga = Math.PI * (3 - Math.sqrt(5)), base = [], pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), th = i * ga;
        base.push([Math.cos(th) * r, y, Math.sin(th) * r]);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      root.add(new THREE.Points(g, P("--accent", { size: 0.13, opacity: 1 })));
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), B({ flatShading: true })); root.add(core);
      root.rotation.x = 0.35;
      return (t) => {
        base.forEach(([x, y, z], i) => {
          const k = 2.3 * (1 + 0.09 * Math.sin(6 * Math.acos(y) - t * 2.2));
          pos[i * 3] = x * k; pos[i * 3 + 1] = y * k; pos[i * 3 + 2] = z * k;
        });
        g.attributes.position.needsUpdate = true;
        root.rotation.y = t * 0.25; core.rotation.set(t * 0.5, t * 0.7, 0);
      };
    },
  },

  // Acadia: the Lorenz system, the original chaotic attractor.
  acadia: {
    name: "Lorenz attractor", eq: ["ẋ = σ(y − x)", "ẏ = x(ρ − z) − y", "ż = xy − βz", "σ = 10, ρ = 28, β = 8⁄3"],
    build: attractor({
      f: ([x, y, z]) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z],
      s0: [0.1, 0, 0], h: 0.0025, perSec: 840, n: 6000,
      map: (x, y, z) => [x * 0.1, (z - 25) * 0.1, y * 0.1], tilt: [0.15, 0],
    }),
  },

  // Arches: interference of two coherent point sources, sampled on a grid of cores.
  arches: {
    name: "Two-source interference", eq: "h = sin(kr₁ − ωt) + sin(kr₂ − ωt)",
    build(root, { THREE, A, B }) {
      const n = 32, sp = 0.14, g = new THREE.BoxGeometry(0.105, 0.105, 0.105);
      const lo = new THREE.InstancedMesh(g, A(), n * n), hi = new THREE.InstancedMesh(g, B(), n * n);
      root.add(lo, hi); root.rotation.set(-1.05, 0, 0.5);
      const d = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
      return (t) => {
        const s1 = [Math.cos(t * 0.4) * 0.9, Math.sin(t * 0.4) * 0.9], s2 = [-s1[0], -s1[1]];
        let i = 0;
        for (let x = 0; x < n; x++) for (let y = 0; y < n; y++, i++) {
          const px = (x - n / 2 + 0.5) * sp, py = (y - n / 2 + 0.5) * sp;
          const h = (Math.sin(5 * Math.hypot(px - s1[0], py - s1[1]) - 3 * t) + Math.sin(5 * Math.hypot(px - s2[0], py - s2[1]) - 3 * t)) / 2;
          d.position.set(px, py, h * 0.45); d.scale.set(1, 1, 1 + Math.abs(h) * 2.5); d.updateMatrix();
          lo.setMatrixAt(i, h > 0.7 ? zero : d.matrix); hi.setMatrixAt(i, h > 0.7 ? d.matrix : zero);
        }
        lo.instanceMatrix.needsUpdate = hi.instanceMatrix.needsUpdate = true;
        root.rotation.z = 0.5 + t * 0.08;
      };
    },
  },

  // Joshua: a torus knot T(p,q) whose winding numbers glide between knot types.
  joshua: {
    name: "Torus knot T(p, q)", eq: ["r = 2 + cos qφ", "(x, y, z) = (r cos pφ, r sin pφ, sin qφ)"],
    build(root, { THREE, fat, B }) {
      const N = 3200, pos = new Float32Array(N * 3), g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      root.add(fat(g, "--accent", 2.6));
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), B()); root.add(bead);
      const knots = [[2, 3], [3, 5], [2, 5], [3, 7], [5, 8]];
      const at = (p, q, phi, o = [0, 0, 0]) => { const r = 2 + Math.cos(q * phi); o[0] = r * Math.cos(p * phi) * 0.85; o[1] = r * Math.sin(p * phi) * 0.85; o[2] = Math.sin(q * phi) * 0.85; return o; };
      const v = [0, 0, 0];
      return (t) => {
        const u = t / 6, k = Math.floor(u) % knots.length, f = u - Math.floor(u);
        const e = f < 0.75 ? 0 : (1 - Math.cos(((f - 0.75) / 0.25) * Math.PI)) / 2;   // hold, then ease
        const [p0, q0] = knots[k], [p1, q1] = knots[(k + 1) % knots.length];
        const p = p0 + (p1 - p0) * e, q = q0 + (q1 - q0) * e;
        for (let i = 0; i < N; i++) { at(p, q, (i / (N - 1)) * Math.PI * 2, v); pos.set(v, i * 3); }
        g.attributes.position.needsUpdate = true;
        bead.position.set(...at(p, q, t * 0.6));
        root.rotation.set(0.9 + Math.sin(t * 0.3) * 0.3, t * 0.2, 0);
      };
    },
  },

  // Pinnacle: a 3-D Lissajous figure, frequency ratio 3:4:5 with a drifting phase.
  pinnacle: {
    name: "Lissajous curve", eq: "x = sin(3t + δ), y = sin 4t, z = sin 5t",
    build(root, { THREE, fat, B }) {
      const N = 4000, pos = new Float32Array(N * 3), g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      root.add(fat(g, "--accent", 2.2));
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 24), B()); root.add(bead);
      const R = 2.2;
      return (time) => {
        const d = time * 0.35;
        for (let i = 0; i < N; i++) {
          const s = (i / (N - 1)) * Math.PI * 2;
          pos[i * 3] = R * Math.sin(3 * s + d); pos[i * 3 + 1] = R * Math.sin(4 * s); pos[i * 3 + 2] = R * Math.sin(5 * s + d / 2);
        }
        g.attributes.position.needsUpdate = true;
        const s = time * 0.5; bead.position.set(R * Math.sin(3 * s + d), R * Math.sin(4 * s), R * Math.sin(5 * s + d / 2));
        root.rotation.set(0.4, time * 0.18, 0);
      };
    },
  },

  // Sequoia: the Rössler system, a single folded band of chaos.
  sequoia: {
    name: "Rössler attractor", eq: ["ẋ = −y − z", "ẏ = x + ay", "ż = b + z(x − c)", "a = 0.2, b = 0.2, c = 5.7"],
    build: attractor({
      f: ([x, y, z]) => [-y - z, x + 0.2 * y, 0.2 + z * (x - 5.7)],
      s0: [1, 1, 0], h: 0.006, perSec: 600, n: 5000,
      map: (x, y, z) => [x * 0.2, (z - 4) * 0.13, y * 0.2], tilt: [0.35, 0.1], spin: 0.15,
    }),
  },

  // Zion: Conway's Game of Life on a torus, a fabric of reconfigurable cells.
  zion: {
    name: "Conway's Game of Life", eq: ["born with 3 neighbours, survives with 2 or 3", "rule B3/S23 on a 32 × 32 torus"],
    build(root, { THREE, A, B }) {
      const n = 32, sp = 0.145, g = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const cells = new THREE.InstancedMesh(g, A(), n * n), born = new THREE.InstancedMesh(g, B(), n * n);
      root.add(cells, born); root.rotation.set(-0.9, 0, 0.55);
      let grid = new Uint8Array(n * n), age = new Uint8Array(n * n), h = new Float32Array(n * n), gen = 0, acc = 0;
      const seed = () => { for (let i = 0; i < n * n; i++) { grid[i] = Math.random() < 0.32 ? 1 : 0; age[i] = 0; } gen = 0; };
      const step = () => {
        const nx = new Uint8Array(n * n);
        let alive = 0, changed = 0;
        for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
          let c = 0;
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
            if (dx || dy) c += grid[((x + dx + n) % n) * n + ((y + dy + n) % n)];
          const i = x * n + y, live = grid[i] ? (c === 2 || c === 3) : c === 3;
          nx[i] = live ? 1 : 0; age[i] = live ? Math.min(age[i] + 1, 9) : 0; alive += nx[i]; changed += nx[i] !== grid[i];
        }
        grid = nx; gen++;
        if (alive < 45 || changed < 6 || gen > 260) seed();
      };
      seed();
      const d = new THREE.Object3D(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
      return (t, dt) => {
        acc += dt; if (acc > 0.16) { acc = 0; step(); }
        for (let i = 0; i < n * n; i++) {
          h[i] += ((grid[i] ? 1 : 0) - h[i]) * Math.min(1, dt * 10);
          const x = Math.floor(i / n), y = i % n;
          if (h[i] < 0.02) { cells.setMatrixAt(i, zero); born.setMatrixAt(i, zero); continue; }
          d.position.set((x - n / 2 + 0.5) * sp, (y - n / 2 + 0.5) * sp, h[i] * 0.12);
          d.scale.set(h[i], h[i], h[i] * (1 + age[i] * 0.35)); d.updateMatrix();
          const young = age[i] <= 1;
          cells.setMatrixAt(i, young ? zero : d.matrix); born.setMatrixAt(i, young ? d.matrix : zero);
        }
        cells.instanceMatrix.needsUpdate = born.instanceMatrix.needsUpdate = true;
        root.rotation.z = 0.55 + t * 0.06;
      };
    },
  },

  // Orion: a chain of Fourier epicycles (DFT of a closed curve) redrawing it.
  orion: {
    name: "Fourier epicycles", eq: ["z(t) = Σ cₖ eⁱᵏᵗ", "48 largest DFT terms of a star curve"],
    build(root, { THREE, L, B, fat }) {
      const M = 512, pts = [];
      for (let i = 0; i < M; i++) {                       // target: a 5-point star rounded by a cosine term
        const a = (i / M) * Math.PI * 2, r = 1 + 0.42 * Math.cos(5 * a) + 0.08 * Math.cos(10 * a);
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      const terms = [];
      for (let k = -M / 2; k < M / 2; k++) {
        let re = 0, im = 0;
        pts.forEach(([x, y], n) => { const p = (-2 * Math.PI * k * n) / M; re += x * Math.cos(p) - y * Math.sin(p); im += x * Math.sin(p) + y * Math.cos(p); });
        terms.push({ k, a: Math.hypot(re, im) / M, ph: Math.atan2(im, re) });
      }
      terms.sort((u, v) => v.a - u.a); const T = terms.slice(0, 48), S = 1.75;
      const unit = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, i) => new THREE.Vector3(Math.cos((i / 160) * 6.2832), Math.sin((i / 160) * 6.2832), 0)));
      const rings = T.map(() => { const c = new THREE.LineLoop(unit, L("--accent-2", { opacity: 0.45 })); root.add(c); return c; });
      const armPos = new Float32Array((T.length + 1) * 3), arm = new THREE.BufferGeometry();
      arm.setAttribute("position", new THREE.BufferAttribute(armPos, 3)); root.add(fat(arm, "--accent-2", 1.4, 0.85));
      const tr = { n: 1400 }; const tp = new Float32Array(tr.n * 3), tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.BufferAttribute(tp, 3)); root.add(fat(tg, "--accent", 2.6));
      const pen = new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 24), B()); root.add(pen);
      root.rotation.set(-0.35, 0.3, 0);
      return (t) => {
        const w = t * 0.55; let x = 0, y = 0;
        T.forEach((c, i) => {
          rings[i].position.set(x * S, y * S, 0); rings[i].scale.setScalar(Math.max(c.a * S, 1e-4));
          armPos.set([x * S, y * S, 0], i * 3);
          x += c.a * Math.cos(c.k * w + c.ph); y += c.a * Math.sin(c.k * w + c.ph);
        });
        armPos.set([x * S, y * S, 0], T.length * 3); arm.attributes.position.needsUpdate = true;
        pen.position.set(x * S, y * S, 0);
        for (let j = 0; j < tr.n; j++) {                  // the last 85% of one period, straight from the series
          const wj = w - (1 - j / (tr.n - 1)) * Math.PI * 2 * 0.85; let X = 0, Y = 0;
          for (const c of T) { X += c.a * Math.cos(c.k * wj + c.ph); Y += c.a * Math.sin(c.k * wj + c.ph); }
          tp[j * 3] = X * S; tp[j * 3 + 1] = Y * S; tp[j * 3 + 2] = 0;
        }
        tg.attributes.position.needsUpdate = true;
        root.rotation.y = 0.3 + Math.sin(t * 0.25) * 0.35;
      };
    },
  },

  // Polaris: Vogel's model of phyllotaxis, seeds placed at the golden angle.
  polaris: {
    name: "Phyllotaxis (Vogel)", eq: "rₙ = c√n, θₙ = n · 137.508°",
    build(root, { THREE, P, B }) {
      const N = 2400, pos = new Float32Array(N * 3), g = new THREE.BufferGeometry(), ga = 137.508 * (Math.PI / 180);
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setDrawRange(0, 0);
      root.add(new THREE.Points(g, P("--accent", { size: 0.11, opacity: 1 })));
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), B({ flatShading: true })); root.add(star);
      const c = 2.6 / Math.sqrt(N);
      root.rotation.x = 0.6;
      return (t) => {
        const shown = Math.min(N, Math.floor((t * 260 + N * 0.7) % (N * 1.35)));   // starts mostly grown, regrows on a loop
        for (let n = 0; n < shown; n++) {
          const r = c * Math.sqrt(n), th = n * ga + t * 0.15;
          pos[n * 3] = r * Math.cos(th); pos[n * 3 + 1] = Math.sin(r * 2.2 - t * 1.5) * 0.12; pos[n * 3 + 2] = r * Math.sin(th);
        }
        g.attributes.position.needsUpdate = true; g.setDrawRange(0, shown);
        star.rotation.y = t; root.rotation.y = -t * 0.08;
      };
    },
  },

  // Vela: Gerstner (trochoidal) ocean waves, three components summed.
  vela: {
    name: "Gerstner waves", eq: ["x = x₀ + Σ Qᵢ Aᵢ dᵢ cos(kᵢ·x₀ − ωᵢt)", "z = Σ Aᵢ sin(kᵢ·x₀ − ωᵢt)"],
    build(root, { THREE, A, L }) {
      const S = 80, g = new THREE.PlaneGeometry(4, 4, S, S), base = g.attributes.position.array.slice();
      const surf = new THREE.Mesh(g, A({ side: THREE.DoubleSide, flatShading: true }));
      const wire = new THREE.LineSegments(new THREE.WireframeGeometry(g), L("--accent-2", { opacity: 0.14 }));
      root.add(surf, wire); root.rotation.set(-1.05, 0, 0.45);
      const W = [[1, 0.25, 0.22, 2.2], [0.6, 0.8, 0.12, 3.1], [-0.4, 0.9, 0.07, 4.6]].map(([dx, dy, a, k]) => {
        const l = Math.hypot(dx, dy); return { dx: dx / l, dy: dy / l, a, k, w: Math.sqrt(9.8 * k) * 0.45, q: 0.7 };
      });
      return (t) => {
        const p = g.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
          const x0 = base[i], y0 = base[i + 1]; let x = x0, y = y0, z = 0;
          for (const w of W) {
            const ph = w.k * (w.dx * x0 + w.dy * y0) - w.w * t, c = Math.cos(ph);
            x += w.q * w.a * w.dx * c; y += w.q * w.a * w.dy * c; z += w.a * Math.sin(ph);
          }
          p[i] = x; p[i + 1] = y; p[i + 2] = z;
        }
        g.attributes.position.needsUpdate = true; g.computeVertexNormals();
        wire.geometry.dispose(); wire.geometry = new THREE.WireframeGeometry(g);
        root.rotation.z = 0.45 + t * 0.05;
      };
    },
  },

  // Lyra: the Aizawa attractor, a sphere-like chaotic flow with an axial tube.
  lyra: {
    name: "Aizawa attractor", eq: ["ẋ = (z − b)x − dy", "ẏ = dx + (z − b)y", "ż = c + az − z³⁄3 − (x² + y²)(1 + ez) + fzx³", "a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1"],
    build: attractor({
      f: ([x, y, z]) => [
        (z - 0.7) * x - 3.5 * y,
        3.5 * x + (z - 0.7) * y,
        0.6 + 0.95 * z - (z ** 3) / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x ** 3,
      ],
      s0: [0.1, 0, 0], h: 0.004, perSec: 720, n: 6000,
      map: (x, y, z) => [x * 1.55, (z - 0.6) * 1.55, y * 1.55], tilt: [0.25, 0], spin: 0.18,
    }),
  },
};

const lite = navigator.connection?.saveData;           // honour data-saver: keep the static disc
const go = () => start(canvas).catch((e) => { console.warn("hero3d:", e); canvas.remove(); });
const idle = (cb) => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 200));
if (canvas && lite) canvas.remove();
else if (canvas) document.readyState === "complete" ? idle(go) : addEventListener("load", () => idle(go), { once: true });
