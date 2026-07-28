/* ─────────────────────────────────────────────
   THREE.JS SCENES
   (a) Hero point cloud   — animated "scan" of a procedural object
   (b) Skill sphere       — CSS3D tag cloud on a Fibonacci sphere
   (c) Anomaly demo       — scan-vs-CAD deviation heat map

   Everything here is progressive enhancement. If the CDN is blocked or
   WebGL is unavailable, each scene bails silently and the page keeps
   working exactly as it does without this file.
───────────────────────────────────────────── */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

/**
 * Drives a render loop that only runs while `el` is on screen and the tab is
 * visible — no point burning GPU on a hero the visitor scrolled past.
 */
function createLoop(el, tick) {
  const clock = new THREE.Clock();
  let raf = null;
  // Assume visible until the observer says otherwise. Its first callback can be
  // several frames out, and waiting for it would leave a blank canvas until then.
  let onScreen = true;

  function frame() {
    raf = requestAnimationFrame(frame);
    tick(clock.getDelta(), clock.elapsedTime);
  }
  function start() {
    if (raf !== null) return;
    clock.getDelta();          // drop the gap accumulated while paused
    frame();
  }
  function stop() {
    if (raf === null) return;
    cancelAnimationFrame(raf);
    raf = null;
  }
  function sync() {
    if (onScreen && !document.hidden) start();
    else stop();
  }

  new IntersectionObserver(entries => {
    // Several records can be coalesced into one callback; the last one is the
    // current state. Reading entries[0] would latch a stale "off screen" and
    // leave the loop stopped after a fast scroll away and back.
    onScreen = entries[entries.length - 1].isIntersecting;
    sync();
  }, { threshold: 0 }).observe(el);

  document.addEventListener('visibilitychange', sync);

  return { start, stop, sync, renderOnce: () => tick(0, 0) };
}

/* Deterministic RNG so the "scan" looks the same on every visit. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─────────────────────────────────────────────
   (a) HERO POINT CLOUD
───────────────────────────────────────────── */
function initHero() {
  const canvas = document.getElementById('hero-3d');
  const hero = document.getElementById('hero');
  if (!canvas || !hero) return false;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  // Sample a torus knot's surface — dense enough to read as a scanned object.
  const src = new THREE.TorusKnotGeometry(1.05, 0.34, 320, 32);
  const count = src.attributes.position.count;
  const rand = mulberry32(20260728);

  const jitter = new Float32Array(count);
  const positions = src.attributes.position.array.slice();
  for (let i = 0; i < count; i++) {
    jitter[i] = rand();
    // A touch of scanner noise along the surface normal.
    const n = i * 3;
    const d = (rand() - 0.5) * 0.035;
    positions[n]     += src.attributes.normal.array[n]     * d;
    positions[n + 1] += src.attributes.normal.array[n + 1] * d;
    positions[n + 2] += src.attributes.normal.array[n + 2] * d;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(src.attributes.normal.array.slice(), 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(jitter, 1));
  src.dispose();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 0.024 },
      uScale: { value: 400 },
      uColorA: { value: new THREE.Color(0x7c3aed) },
      uColorB: { value: new THREE.Color(0x00d4ff) },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uSize;
      uniform float uScale;
      attribute float aRand;
      varying float vGlow;
      varying float vRand;
      void main() {
        vec3 p = position + normal * sin(uTime * 0.9 + aRand * 6.2831) * 0.018;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // A band sweeping along local Y, like a line scanner passing over the part.
        float sweep = sin(uTime * 0.32) * 1.5;
        vGlow = 1.0 - smoothstep(0.0, 0.34, abs(position.y - sweep));
        vRand = aRand;
        gl_PointSize = uSize * (1.0 + vGlow * 1.6) * (uScale / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying float vGlow;
      varying float vRand;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = 1.0 - smoothstep(0.08, 0.5, d);
        vec3 col = mix(uColorA, uColorB, clamp(vRand * 0.5 + vGlow, 0.0, 1.0));
        gl_FragColor = vec4(col, a * (0.30 + vGlow * 0.65));
      }
    `,
  });

  const cloud = new THREE.Points(geo, material);
  const group = new THREE.Group();
  group.add(cloud);
  group.rotation.set(0.35, 0, 0.1);
  scene.add(group);

  function resize() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    // Match three's own point-size convention: world-space size × half the
    // drawing buffer height, so points stay consistent across DPRs.
    material.uniforms.uScale.value = renderer.domElement.height * 0.5;
  }
  resize();
  window.addEventListener('resize', resize);

  const pointer = { x: 0, y: 0 };
  let tiltX = 0.35;
  let tiltY = 0;
  if (!REDUCED_MOTION) {
    window.addEventListener('pointermove', e => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const loop = createLoop(hero, (dt, t) => {
    material.uniforms.uTime.value = t;
    group.rotation.y += dt * 0.18;
    tiltX += ((0.35 - pointer.y * 0.32) - tiltX) * 0.05;
    tiltY += ((pointer.x * 0.35) - tiltY) * 0.05;
    group.rotation.x = tiltX;
    group.rotation.z = 0.1 + tiltY * 0.25;
    renderer.render(scene, camera);
  });

  if (REDUCED_MOTION) {
    // One static frame — the composition without the motion.
    renderer.render(scene, camera);
  } else {
    loop.sync();
  }
  return true;
}

/* ─────────────────────────────────────────────
   (b) SKILL SPHERE (CSS3D — tags stay real DOM)
───────────────────────────────────────────── */
function initSkillSphere() {
  const stage = document.getElementById('skill-sphere');
  const grid = document.getElementById('skillGrid');
  const toggle = document.getElementById('skillViewToggle');
  if (!stage || !grid || !toggle) return;
  if (REDUCED_MOTION || window.innerWidth < 720) return;

  const tags = Array.from(grid.querySelectorAll('.skill-tag'));
  if (!tags.length) return;

  const renderer = new CSS3DRenderer();
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const CAM_Z = 900;
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 6000);
  camera.position.z = CAM_Z;

  const RADIUS = 250;
  // CSS3D perspective shrinks far tags to the point of illegibility. Scaling
  // each tag by a fraction of its own distance cancels most of that out, so
  // every tag stays readable and opacity alone carries the depth cue.
  const PERSPECTIVE_COMP = 0.7;
  const objects = [];
  const n = tags.length;

  tags.forEach((tag, i) => {
    const el = document.createElement('div');
    el.className = tag.className + ' sphere-tag';
    el.textContent = tag.textContent;

    const obj = new CSS3DObject(el);
    // Fibonacci sphere — even spacing without clumping at the poles.
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    obj.userData.base = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(RADIUS);
    scene.add(obj);
    objects.push(obj);
  });

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // Drag to spin. Objects keep an identity rotation so they always face the
  // camera — we rotate their positions rather than the group.
  let rotX = 0, rotY = 0;
  let velX = 0, velY = 0.0016;
  let dragging = false;
  let last = { x: 0, y: 0 };

  stage.addEventListener('pointerdown', e => {
    dragging = true;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
    last = { x: e.clientX, y: e.clientY };
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging) return;
    velY = (e.clientX - last.x) * 0.00035;
    velX = (e.clientY - last.y) * 0.00035;
    last = { x: e.clientX, y: e.clientY };
  });
  const endDrag = () => {
    dragging = false;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('pointerleave', endDrag);

  const rotation = new THREE.Matrix4();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();

  const loop = createLoop(stage, () => {
    if (!dragging) {
      velY += (0.0016 - velY) * 0.02;   // drift back to a slow idle spin
      velX *= 0.94;
    }
    rotY += velY;
    rotX = THREE.MathUtils.clamp(rotX + velX, -0.9, 0.9);

    euler.set(rotX, rotY, 0);
    rotation.makeRotationFromEuler(euler);

    for (const obj of objects) {
      v.copy(obj.userData.base).applyMatrix4(rotation);
      obj.position.copy(v);
      // Depth cue: tags at the back recede.
      const depth = (v.z + RADIUS) / (RADIUS * 2);   // 0 (back) → 1 (front)
      obj.element.style.opacity = (0.38 + depth * 0.62).toFixed(3);
      obj.scale.setScalar(
        (1 - PERSPECTIVE_COMP) + PERSPECTIVE_COMP * ((CAM_Z - v.z) / CAM_Z)
      );
    }
    renderer.render(scene, camera);
  });

  // Wire up the Grid ⇄ Sphere toggle now that we know the sphere can run.
  toggle.hidden = false;
  toggle.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sphere = btn.dataset.view === 'sphere';
      toggle.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
      stage.hidden = !sphere;
      grid.hidden = sphere;
      if (sphere) {
        resize();
        loop.renderOnce();   // populate the CSS3D layer before the first frame
        loop.start();
      } else {
        loop.stop();
      }
    });
  });

  window.addEventListener('resize', () => {
    // Below 720px the sphere is hidden by CSS — fall back to the grid so the
    // skills don't vanish when someone narrows the window mid-spin.
    if (window.innerWidth < 720 && !stage.hidden) {
      toggle.querySelector('.view-btn[data-view="grid"]').click();
      return;
    }
    if (!stage.hidden) resize();
  });
}

/* ─────────────────────────────────────────────
   (c) ANOMALY DETECTION DEMO
───────────────────────────────────────────── */

/** 1 world unit ≈ 40 mm, so deviations land in a plausible millimetre range. */
const MM_PER_UNIT = 40;

/** Silhouette of a machined part, closed at both ends so it reads as a solid. */
function radiusAt(y) {
  const env = Math.pow(Math.max(0, 1 - y * y), 0.32);
  const flange = 0.20 * Math.exp(-Math.pow((y - 0.10) / 0.10, 2));
  const groove = -0.09 * Math.exp(-Math.pow((y + 0.40) / 0.08, 2));
  return (0.55 + flange + groove) * env;
}

function latheProfile(steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = -1 + (2 * i) / steps;
    pts.push(new THREE.Vector2(Math.max(radiusAt(y), 0.0005), y));
  }
  return pts;
}

/** The defects baked into the "scanned" part. Ground truth for the heat map. */
const DEFECTS = [
  { y: -0.15, theta: 0.80, amp: -0.058, sigma: 0.17 },   // impact dent
  { y:  0.42, theta: 3.60, amp:  0.040, sigma: 0.12 },   // weld spatter / burr
  { y:  0.60, theta: 5.20, amp: -0.024, sigma: 0.07 },   // scratch
  { y:  0.70, theta: 5.28, amp: -0.022, sigma: 0.07 },
  { y:  0.80, theta: 5.34, amp: -0.018, sigma: 0.07 },
];

const RAMP = [
  [0.13, 0.24, 0.55],   // in tolerance — kept light enough to read the shape
  [0.00, 0.55, 0.86],
  [0.10, 0.73, 0.46],
  [0.96, 0.72, 0.11],
  [0.92, 0.20, 0.18],
];
const NEUTRAL = [0.42, 0.48, 0.58];

function heatColor(t, out) {
  const c = THREE.MathUtils.clamp(t, 0, 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(c), RAMP.length - 2);
  const f = c - i;
  out[0] = RAMP[i][0] + (RAMP[i + 1][0] - RAMP[i][0]) * f;
  out[1] = RAMP[i][1] + (RAMP[i + 1][1] - RAMP[i][1]) * f;
  out[2] = RAMP[i][2] + (RAMP[i + 1][2] - RAMP[i][2]) * f;
  return out;
}

function initDemo() {
  const stage = document.getElementById('demo-stage');
  if (!stage) return;

  const fallback = document.getElementById('demo-fallback');
  const hint = document.getElementById('demo-hint');
  const status = document.getElementById('demo-status');
  const legendMax = document.getElementById('demo-legend-max');
  const viewBar = document.getElementById('demo-views');
  const runBtn = document.getElementById('demo-run');
  const resetBtn = document.getElementById('demo-reset');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = 'demo-canvas';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(2.2, 1.3, 2.6);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0x9fdcff, 1.5);
  key.position.set(3, 4, 2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb794f6, 0.9);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  // ── Reference (CAD) geometry, and the deformed "scan" derived from it ──
  const reference = new THREE.LatheGeometry(latheProfile(90), 170);
  reference.computeVertexNormals();

  const scan = reference.clone();
  const pos = scan.attributes.position;
  const nrm = reference.attributes.normal;
  const vCount = pos.count;
  const deviation = new Float32Array(vCount);

  const centers = DEFECTS.map(d => {
    const r = radiusAt(d.y);
    return { c: new THREE.Vector3(r * Math.cos(d.theta), d.y, r * Math.sin(d.theta)), ...d };
  });

  const p = new THREE.Vector3();
  let maxDev = 0;
  for (let i = 0; i < vCount; i++) {
    p.fromBufferAttribute(pos, i);
    let disp = 0;
    for (const d of centers) {
      const dist2 = p.distanceToSquared(d.c);
      disp += d.amp * Math.exp(-dist2 / (2 * d.sigma * d.sigma));
    }
    pos.setXYZ(
      i,
      p.x + nrm.getX(i) * disp,
      p.y + nrm.getY(i) * disp,
      p.z + nrm.getZ(i) * disp
    );
    deviation[i] = Math.abs(disp) * MM_PER_UNIT;
    if (deviation[i] > maxDev) maxDev = deviation[i];
  }
  pos.needsUpdate = true;
  scan.computeVertexNormals();

  const colors = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i++) {
    colors[i * 3] = NEUTRAL[0];
    colors[i * 3 + 1] = NEUTRAL[1];
    colors[i * 3 + 2] = NEUTRAL[2];
  }
  scan.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // ── The three render modes ──
  const meshView = new THREE.Mesh(scan, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0.45, flatShading: false,
  }));

  const pointsView = new THREE.Points(scan, new THREE.PointsMaterial({
    vertexColors: true, size: 0.016, sizeAttenuation: true,
  }));

  // A deliberately coarse lathe — reads as a CAD wireframe rather than a mess.
  const cadGeo = new THREE.LatheGeometry(latheProfile(28), 44);
  const cadView = new THREE.Mesh(cadGeo, new THREE.MeshBasicMaterial({
    color: 0x00d4ff, wireframe: true, transparent: true, opacity: 0.5,
  }));

  const part = new THREE.Group();
  part.add(pointsView, meshView, cadView);
  meshView.visible = false;
  cadView.visible = false;
  scene.add(part);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.8;
  controls.maxDistance = 7;
  controls.enablePan = false;
  controls.autoRotate = !REDUCED_MOTION;
  controls.autoRotateSpeed = 1.1;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    if (hint) hint.classList.add('gone');
  });

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);

  // ── Detection: animate neutral → heat over ~0.9s ──
  let progress = 0;        // 0 = neutral, 1 = fully coloured
  let target = 0;
  const tmp = [0, 0, 0];

  function paint() {
    const attr = scan.attributes.color;
    for (let i = 0; i < vCount; i++) {
      // Gamma < 1 widens the coloured halo around each defect so the hotspots
      // read at a glance instead of being a couple of stray pixels.
      heatColor(Math.pow(deviation[i] / maxDev, 0.65), tmp);
      attr.setXYZ(
        i,
        NEUTRAL[0] + (tmp[0] - NEUTRAL[0]) * progress,
        NEUTRAL[1] + (tmp[1] - NEUTRAL[1]) * progress,
        NEUTRAL[2] + (tmp[2] - NEUTRAL[2]) * progress
      );
    }
    attr.needsUpdate = true;
  }

  const loop = createLoop(stage, dt => {
    controls.update();
    if (progress !== target) {
      const step = Math.max(dt, 0.001) / 0.9;
      progress = target > progress
        ? Math.min(target, progress + step)
        : Math.max(target, progress - step);
      paint();
    }
    renderer.render(scene, camera);
  });

  // ── Controls ──
  viewBar.querySelectorAll('.demo-btn').forEach(btn => {
    btn.disabled = false;
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      viewBar.querySelectorAll('.demo-btn').forEach(b => b.classList.toggle('active', b === btn));
      pointsView.visible = mode === 'points';
      meshView.visible = mode === 'mesh';
      cadView.visible = mode === 'cad';
      if (mode === 'cad') {
        status.textContent = 'Nominal CAD reference — the surface the scan is measured against.';
      }
    });
  });

  runBtn.disabled = false;
  runBtn.addEventListener('click', () => {
    target = 1;
    if (cadView.visible) {
      cadView.visible = false;
      pointsView.visible = true;
      viewBar.querySelectorAll('.demo-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'points'));
    }
    legendMax.textContent = maxDev.toFixed(1) + ' mm';
    status.textContent = `3 anomalous regions found — peak deviation ${maxDev.toFixed(1)} mm from nominal.`;
  });

  resetBtn.disabled = false;
  resetBtn.addEventListener('click', () => {
    target = 0;
    legendMax.textContent = '—';
    status.textContent = 'Scan loaded. Run detection to compare against the CAD reference.';
  });

  if (fallback) fallback.remove();
  if (hint) hint.hidden = false;
  if (legendMax) legendMax.textContent = '—';
  loop.sync();
  loop.renderOnce();
}

/* ─────────────────────────────────────────────
   BOOT
───────────────────────────────────────────── */
if (supportsWebGL()) {
  try {
    if (initHero() && typeof window.__stop2DParticles === 'function') {
      window.__stop2DParticles();
    }
  } catch (e) {
    console.warn('hero 3D unavailable:', e);
  }

  try { initSkillSphere(); } catch (e) { console.warn('skill sphere unavailable:', e); }
  try { initDemo(); } catch (e) { console.warn('anomaly demo unavailable:', e); }
}
