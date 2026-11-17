import * as THREE from './vendor/three.module.js';
import { createCatConstellation } from './cat-constellation.js';

async function initBackgroundMap() {
  const root = document.documentElement, body = document.body;
  const canvas = document.createElement('canvas');
  canvas.className = 'constellation-background';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.backgroundMap = 'cat';
  body.appendChild(canvas);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = body.classList.contains('motion-paused'), hidden = document.hidden, exploding = false;
  let renderer, scene, camera, group, raf = 0, last = 0, dirty = true, lost = false, warming = true, backgroundMarker = null;
  const cur = { yaw: 0, pitch: 0, zoom: 0 }, tgt = { yaw: 0, pitch: 0, zoom: 0 };
  let zoom0 = parseFloat(root.dataset.zoom) || 1, baseDist = 10, aspect = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fail = () => {
    cancelAnimationFrame(raf); raf = 0;
    canvas.dataset.unavailable = 'true'; delete canvas.dataset.ready;
    root.dataset.backgroundMap = 'unavailable';
    if (backgroundMarker) backgroundMarker.hidden = true;
    try { renderer && renderer.dispose(); } catch (e) {}
    setTimeout(() => canvas.remove(), 1000);
  };

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) { fail(); return; }
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xefdcff, 0.65));
  const keyLight = new THREE.DirectionalLight(0xffeff8, 1.35);
  keyLight.position.set(-4, 6, 10); scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xa8baff, 0.45);
  rimLight.position.set(6, -2, -4); scene.add(rimLight);
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  group = new THREE.Group();
  scene.add(group);

  // Four curated, cached procedural surfaces (generated once). Sampled in 3D so they are seamless and pole-safe.
  const hash3 = (x, y, z, k) => {
    // Integer lattice hash avoids millions of expensive trig calls during warmup.
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041) ^ Math.imul(k, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const vnoise = (x, y, z, k) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const L = (a, b, t) => a + (b - a) * t, H = (i, j, l) => hash3(xi + i, yi + j, zi + l, k);
    return L(L(L(H(0, 0, 0), H(1, 0, 0), u), L(H(0, 1, 0), H(1, 1, 0), u), v), L(L(H(0, 0, 1), H(1, 0, 1), u), L(H(0, 1, 1), H(1, 1, 1), u), v), w);
  };
  const fbm = (x, y, z, k, oct = 4) => { let a = .5, t = 0, n = 0; for (let o = 0; o < oct; o++) { t += a * vnoise(x, y, z, k + o); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= .5; } return t / n; };
  const craters = (x, y, z, k, sc) => {
    x *= sc; y *= sc; z *= sc; let d = 0;
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) {
      const px = cx + i + hash3(cx + i, cy + j, cz + l, k), py = cy + j + hash3(cx + i, cy + j, cz + l, k + 1), pz = cz + l + hash3(cx + i, cy + j, cz + l, k + 2);
      const r = .16 + .2 * hash3(cx + i, cy + j, cz + l, k + 3), q = Math.hypot(x - px, y - py, z - pz) / r;
      if (hash3(cx + i, cy + j, cz + l, k + 4) > .55 && q < 1.3) d += q < 1 ? -(1 - q * q) * .8 : Math.exp(-(q - 1) * 9) * .5;
    }
    return d;
  };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const surfaceColors = new Map();
  const hexc = h => {
    if (!surfaceColors.has(h)) surfaceColors.set(h, [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    return surfaceColors.get(h);
  };
  // Each returns {c:[r,g,b], h:height 0..1} for unit-sphere point (x,y,z), latitude-ish y.
  const surfaces = [
    (x, y, z) => { // pearlescent clouded rose
      const wx = fbm(x * 2 + 5, y * 2, z * 2, 1, 3) * 1.4, c = fbm(x * 2.4 + wx, y * 4 + wx * .8, z * 2.4 - wx, 7, 5);
      const cl = clamp((c - .38) * 2.2, 0, 1), pearl = Math.pow(fbm(x * 5, y * 5, z * 5, 21, 3), 3) * 1.4;
      let col = mixc(mixc(hexc('#b86aa8'), hexc('#f08fc4'), clamp(c * 1.5, 0, 1)), hexc('#fff0f8'), cl * .75);
      col = mixc(col, [215, 235, 255], clamp(pearl * (.3 + cl * .5), 0, .4));
      return { c: col, h: .2 + cl * .7 };
    },
    (x, y, z) => { // violet banded giant with storm
      const t = fbm(x * 3, y * 1.5, z * 3, 3, 4) - .5, lat = y * 9 + t * 2.2 + Math.sin(y * 23 + t * 6) * .25;
      const band = Math.sin(lat) * .5 + .5, fine = fbm(x * 9, y * 26, z * 9, 11, 3);
      let col = mixc(mixc(hexc('#6e57b8'), hexc('#c4aaf5'), band), hexc('#ede4ff'), clamp(fine * .5 + band * .15 - .15, 0, .45));
      const dx = x - .55, dy = (y + .28) * 2.2, dz = z - .3, s = Math.exp(-(dx * dx * 6 + dy * dy * 9 + dz * dz * 6) * 4) * (dz > -.3 ? 1 : 0);
      col = mixc(col, hexc('#ff9fd0'), clamp(s, 0, .7));
      return { c: col, h: .3 + band * .4 + fine * .25 };
    },
    (x, y, z) => { // icy terrain, craters, cracks
      const n = fbm(x * 3, y * 3, z * 3, 5, 5), cr = craters(x, y, z, 31, 4.5);
      const crack = Math.pow(1 - Math.abs(fbm(x * 4 + 9, y * 4, z * 4, 41, 3) * 2 - 1), 14) * .55;
      let col = mixc(mixc(hexc('#6aa0c8'), hexc('#b9e2f6'), n), hexc('#f4fcff'), clamp(.3 + cr * .5 + crack, 0, .8) * (cr > 0 ? .5 : 1));
      if (cr < 0) col = mixc(col, hexc('#6a9bc2'), clamp(-cr * .5, 0, .5));
      return { c: col, h: clamp(.5 + n * .3 + cr * .3 - crack * .3, 0, 1) };
    },
    (x, y, z) => { // cream/pink land-like with veins
      const land = fbm(x * 2.2, y * 2.2, z * 2.2, 9, 5), vein = Math.pow(1 - Math.abs(fbm(x * 5 + 3, y * 5, z * 5, 51, 4) * 2 - 1), 8);
      const hi = clamp((land - .45) * 3, 0, 1);
      let col = mixc(mixc(hexc('#e8b6dc'), hexc('#fff0d8'), hi), hexc('#c0709f'), vein * .55);
      col = mixc(col, hexc('#ffd6ec'), clamp(fbm(x * 12, y * 12, z * 12, 61, 2) - .45, 0, .3));
      return { c: col, h: clamp(.25 + hi * .5 + vein * .2, 0, 1) };
    }
  ];
  const bumpMaps = [];
  const texLow = matchMedia('(max-width: 760px)').matches;
  // Baked copies of these exact procedural surfaces decode off the main thread
  // and reuse the browser image cache across page navigation.
  const loader = new THREE.TextureLoader();
  const baked = await Promise.all(['rose', 'violet', 'ice', 'cream'].map(async name => {
    try {
      const [color, bump] = await Promise.all([
        loader.loadAsync(new URL(`media/planet-surfaces/${name}.png`, import.meta.url).href),
        loader.loadAsync(new URL(`media/planet-surfaces/${name}-height.png`, import.meta.url).href)
      ]);
      return { color, bump };
    } catch { return null; } // Preserve the procedural fallback if an asset is unavailable.
  }));
  paused = body.classList.contains('motion-paused'); hidden = document.hidden;
  root.dataset.backgroundTextures = baked.every(Boolean) ? 'cached-images' : 'procedural-fallback';
  const textures = surfaces.map((fn, index) => {
    if (baked[index]) {
      const { color, bump } = baked[index];
      color.colorSpace = THREE.SRGBColorSpace; color.wrapS = THREE.RepeatWrapping; color.anisotropy = 4;
      bump.wrapS = THREE.RepeatWrapping; bumpMaps.push(bump);
      return color;
    }
    const tw = texLow ? 256 : 384, th = tw / 2, cv = document.createElement('canvas'), relief = document.createElement('canvas');
    cv.width = relief.width = tw; cv.height = relief.height = th;
    const ctx = cv.getContext('2d'), bx = relief.getContext('2d');
    const image = ctx.createImageData(tw, th), height = bx.createImageData(tw, th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const lon = (x + .5) / tw * Math.PI * 2, lat = (y + .5) / th * Math.PI, sl = Math.sin(lat);
      const r = fn(Math.cos(lon) * sl, Math.cos(lat), Math.sin(lon) * sl), o = (y * tw + x) * 4;
      for (let c = 0; c < 3; c++) { image.data[o + c] = clamp(r.c[c], 0, 255); height.data[o + c] = clamp(r.h, 0, 1) * 255; }
      image.data[o + 3] = height.data[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0); bx.putImageData(height, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
    const bump = new THREE.CanvasTexture(relief); bump.wrapS = THREE.RepeatWrapping; bumpMaps.push(bump);
    return t;
  });
  const glowTex = (() => {
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,170,220,.95)'); r.addColorStop(.35, 'rgba(255,150,210,.35)'); r.addColorStop(1, 'rgba(255,150,210,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s); return new THREE.CanvasTexture(cv);
  })();

  const cat = createCatConstellation();
  const alIndex = cat.alIndex ?? cat.links[0][0];
  const pts = cat.stars.map((s, i) => {
    const h = Math.sin(i * 12.9898) * 43758.5453, r = h - Math.floor(h);
    const z = Math.sin(i * 0.9) * 0.9 + (r - 0.5) * 1.2;
    return new THREE.Vector3(s[0], s[1], i === alIndex ? 0.9 : z);
  });
  // Interior-to-contour spatial centering.
  const bb = new THREE.Box3().setFromPoints(pts), ctr = bb.getCenter(new THREE.Vector3());
  pts.forEach(v => v.sub(ctr));
  const size = bb.getSize(new THREE.Vector3());

  const segs = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; segs.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  cat.links.forEach(([a, b]) => { const A = pts[a], B = pts[b]; segs.push(A.x, A.y, A.z, B.x, B.y, B.z); });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xe6b8ff, transparent: true, opacity: .34, depthWrite: false })));

  const smallScreen = matchMedia('(max-width: 760px)').matches;
  const sphere = new THREE.SphereGeometry(1, smallScreen ? 32 : 48, smallScreen ? 24 : 32);
  const ring = new THREE.RingGeometry(1.5, 1.68, 80);
  const mats = textures.map((t, i) => new THREE.MeshPhongMaterial({ map: t, bumpMap: bumpMaps[i], bumpScale: .03, color: 0xd8cfe0, emissive: 0x181020, shininess: 55 }));
  const alMaterial = new THREE.MeshPhongMaterial({ map: textures[0], bumpMap: bumpMaps[0], bumpScale: .03, color: 0xffbddc, emissive: 0x632741, emissiveIntensity: 0.4, shininess: 65 });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c8ee, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false });
  const atmosphereMat = new THREE.MeshBasicMaterial({ color: 0xe6bdff, transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false });
  pts.forEach((v, i) => {
    const isAL = i === alIndex, big = cat.bright.has(i);
    const rad = isAL ? 0.2 : big ? 0.15 : 0.065 + ((i * 37) % 7) * 0.01;
    const m = new THREE.Mesh(sphere, isAL ? alMaterial : mats[i % mats.length]);
    m.position.copy(v); m.scale.setScalar(rad); group.add(m);
    if (isAL || big) {
      const atmosphere = new THREE.Mesh(sphere, atmosphereMat);
      atmosphere.position.copy(v); atmosphere.scale.setScalar(rad * 1.07); group.add(atmosphere);
    }
    if (isAL || i % 5 === 2) {
      const rg = new THREE.Mesh(ring, ringMat);
      rg.position.copy(v); rg.scale.setScalar(rad); rg.rotation.set(1.1 + (i % 3) * .2, .3, i * .5); group.add(rg);
    }
    if (isAL) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.copy(v); sp.scale.setScalar(1.1); group.add(sp);
    }
  });

  // Small white 3D stars clustered around each planet; children of `group`, so they rotate with the map.
  const starTex = (() => {
    const s = 32, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const starPos = [];
  pts.forEach((v, i) => {
    const isAL = i === alIndex, big = cat.bright.has(i), rad = isAL ? 0.2 : big ? 0.15 : 0.065 + ((i * 37) % 7) * 0.01;
    const n = (smallScreen ? 5 : 8) + (i % (smallScreen ? 3 : 5));
    for (let k = 0; k < n; k++) {
      const h = (a) => { const q = Math.sin((i * 31 + k * 17 + a * 7.3) * 12.9898) * 43758.5453; return q - Math.floor(q); };
      const th = h(1) * Math.PI * 2, ph = Math.acos(h(2) * 2 - 1), d = rad * 2.2 + h(3) * (.35 + rad * 3);
      starPos.push(v.x + Math.sin(ph) * Math.cos(th) * d, v.y + Math.sin(ph) * Math.sin(th) * d * .85, v.z + Math.cos(ph) * d * 1.3);
    }
  });
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ map: starTex, color: 0xffffff, size: smallScreen ? 1.7 : 2.1, sizeAttenuation: false, transparent: true, opacity: .85, alphaTest: .02, depthWrite: false }));
  stars.name = 'nearby-white-stars'; stars.frustumCulled = false;
  group.add(stars);
  root.dataset.backgroundStars = String(starPos.length / 3);

  backgroundMarker = document.createElement('div');
  backgroundMarker.className = 'background-al-marker';
  backgroundMarker.hidden = true;
  backgroundMarker.setAttribute('aria-hidden', 'true');
  backgroundMarker.innerHTML = '<i></i><span><b>AL-0527</b></span>';
  body.appendChild(backgroundMarker);
  const markerPoint = new THREE.Vector3();
  function labelAL() {
    group.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    markerPoint.copy(pts[alIndex]); group.localToWorld(markerPoint); markerPoint.project(camera);
    const x = (markerPoint.x + 1) * window.innerWidth / 2;
    const y = (1 - markerPoint.y) * window.innerHeight / 2;
    backgroundMarker.hidden = markerPoint.z < -1 || markerPoint.z > 1 || x < 12 || x > innerWidth - 12 || y < 12 || y > innerHeight - 12;
    if (backgroundMarker.hidden) return;
    backgroundMarker.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    backgroundMarker.dataset.side = x + 111 > innerWidth ? 'left' : 'right';
    backgroundMarker.dataset.vertical = y < 60 ? 'below' : 'above';
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, matchMedia('(max-width: 760px)').matches ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    aspect = w / h; camera.aspect = aspect;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Fit the whole cat frontally (with margin for depth/rotation); wide pages fill height.
    baseDist = Math.max((size.y * 0.62) / t, (size.x * 0.56) / (t * aspect)) + 1.5;
    place(); dirty = true; schedule();
  }
  function place() {
    camera.position.set(0, 0, baseDist * (1 - clamp(cur.zoom, -1, 1) * 0.08));
    camera.updateProjectionMatrix(); camera.lookAt(0, 0, 0);
    group.rotation.set(cur.pitch, cur.yaw, 0);
    root.dataset.backgroundYaw = cur.yaw.toFixed(3); root.dataset.backgroundPitch = cur.pitch.toFixed(3);
  }
  function draw() {
    if (warming) return;
    place(); renderer.render(scene, camera); labelAL(); dirty = false;
    root.dataset.backgroundMap = 'ready'; canvas.dataset.ready = 'true';
  }

  const settled = () => Math.abs(cur.yaw - tgt.yaw) < 5e-4 && Math.abs(cur.pitch - tgt.pitch) < 5e-4 && Math.abs(cur.zoom - tgt.zoom) < 5e-4;
  const noEase = () => paused || reduced.matches;
  function canRun() { return !['covering', 'revealing'].includes(root.dataset.pixelTransition) && !warming && !hidden && !lost && !exploding; }
  function schedule() { if (!raf && canRun() && (dirty || !settled())) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (!canRun()) return;
    if (now - last < 33) { raf = requestAnimationFrame(tick); return; }
    const dt = Math.min((now - last) / 1000, .1); last = now;
    if (noEase()) { Object.assign(cur, tgt); } else {
      const k = 1 - Math.exp(-dt * 5);
      for (const key of ['yaw', 'pitch', 'zoom']) { cur[key] += (tgt[key] - cur[key]) * k; if (Math.abs(tgt[key] - cur[key]) < 5e-4) cur[key] = tgt[key]; }
    }
    draw();
    if (!settled()) raf = requestAnimationFrame(tick);
  }

  window.addEventListener('portfolio:pose', e => {
    const d = e.detail || {};
    if (Number.isFinite(d.yaw)) tgt.yaw = d.yaw * 0.6;
    if (Number.isFinite(d.pitch)) tgt.pitch = clamp(d.pitch * 0.6, -1.2, 1.2);
    if (Number.isFinite(d.zoom)) { if (zoom0 === null) zoom0 = d.zoom; tgt.zoom = clamp((d.zoom - zoom0) * 0.25, -1, 1); }
    schedule();
  });
  window.addEventListener('portfolio:motion', e => { paused = !!(e.detail && e.detail.paused); schedule(); });
  window.addEventListener('portfolio:explode', () => { exploding = true; cancelAnimationFrame(raf); raf = 0; });
  window.addEventListener('portfolio:reformed', () => { exploding = false; dirty = true; schedule(); });
  window.addEventListener('portfolio:transition-start', () => { cancelAnimationFrame(raf); raf = 0; });
  window.addEventListener('portfolio:transition-idle', () => { if (dirty || !settled()) schedule(); });
  reduced.addEventListener && reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (!hidden) { dirty = true; schedule(); } else { cancelAnimationFrame(raf); raf = 0; } });
  window.addEventListener('resize', resize);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; cancelAnimationFrame(raf); raf = 0; fail(); });

  // Initial pose from dataset (foreground debug/initial values).
  const iy = parseFloat(root.dataset.poseYaw), ip = parseFloat(root.dataset.posePitch);
  if (Number.isFinite(iy)) cur.yaw = tgt.yaw = iy * 0.6;
  if (Number.isFinite(ip)) cur.pitch = tgt.pitch = clamp(ip * 0.6, -1.2, 1.2);

  root.dataset.backgroundMap = 'loading';
  resize();
  const prepared = renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve();
  prepared.then(() => { if (lost) return; warming = false; dirty = true; schedule(); }).catch(fail);
}
function queueBackgroundMap() {
  const start = () => initBackgroundMap().catch(() => { document.documentElement.dataset.backgroundMap = 'unavailable'; });
  requestAnimationFrame(() => {
    if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 80 }); else setTimeout(start, 0);
  });
}
if (['covering', 'revealing'].includes(document.documentElement.dataset.pixelTransition)) {
  window.addEventListener('portfolio:transition-idle', queueBackgroundMap, { once: true });
} else { queueBackgroundMap(); }
