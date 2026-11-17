import * as THREE from './vendor/three.module.js';

// Daylight-only immersive 3D seaside. Fully procedural: no models, textures, or network requests.
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const body = document.body;
const isDaylight = () => body.classList.contains('daylight-theme');

let host = null;
let world = null;       // { start, stop, render, resize, dispose }
let failed = false;
let running = false;
let rafId = 0;
let initTried = false;

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Shoreline curve and sand height shared by sand mesh, props and wave ribbons.
const shoreZ = (x) => 1.25 + 0.38 * Math.sin(x * 0.33 + 0.6) + 0.18 * Math.sin(x * 0.86 + 1.7);
function sandHeight(x, z) {
  const s = z - shoreZ(x);
  const dunes = 0.05 * Math.sin(x * 0.7 + z * 0.9) * Math.max(0, Math.min(1, s / 2));
  return (s > 0 ? s * 0.085 - 0.03 : s * 0.3 - 0.03) + dunes;
}

function build(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.append(renderer.domElement);

  const horizonColor = new THREE.Color(0xf2e1dc);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(horizonColor, 28, 120);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  camera.position.set(0, 1.6, 6);

  // ---- Lighting (sun low over the water, so the sea glitters)
  const sunPos = new THREE.Vector3(35, 20, -85);
  scene.add(new THREE.HemisphereLight(0xf4eafb, 0xf1d9b9, 1.5));
  const sunLight = new THREE.DirectionalLight(0xfff0cf, 2.6);
  sunLight.position.copy(sunPos).normalize().multiplyScalar(30);
  scene.add(sunLight);
  // Camera-side sky fill so clouds, sand and props are lit from the front, not just backlit by the sun.
  const fill = new THREE.DirectionalLight(0xffffff, 0.75);
  fill.position.set(-8, 30, 40);
  scene.add(fill);

  // ---- Sky dome gradient
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0xa7c5dc) },
        mid: { value: new THREE.Color(0xc3dce7) },
        low: { value: horizonColor },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP;' +
        'void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(low, mid, smoothstep(0.0,0.18,h)); c = mix(c, top, smoothstep(0.12,0.65,h));' +
        'gl_FragColor = vec4(c,1.);\n#include <colorspace_fragment>\n }',
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // ---- Sun with soft glow
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const g = glowCanvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,250,220,1)');
  grad.addColorStop(0.25, 'rgba(255,238,170,.55)');
  grad.addColorStop(1, 'rgba(255,238,170,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false }));
  glow.position.copy(sunPos); glow.scale.setScalar(70); glow.renderOrder = 5;
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3b8, fog: false }));
  sun.position.copy(sunPos); sun.renderOrder = 5;
  scene.add(glow, sun);

  // ---- Round puffy clouds: shaded standard spheres, bright tops over cool, darker undersides
  const topMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.38, fog: false });
  const midMat = new THREE.MeshStandardMaterial({ color: 0xfff1ed, roughness: 1, emissive: 0xf3e8f2, emissiveIntensity: 0.3, fog: false });
  const underMat = new THREE.MeshStandardMaterial({ color: 0xc8bedb, roughness: 1, emissive: 0xa797be, emissiveIntensity: 0.32, fog: false });
  const cloudGeo = new THREE.SphereGeometry(1, 20, 14);
  const clouds = [];
  const rand = seeded(7);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const puffs = 5 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const u = (p / (puffs - 1)) * 2 - 1;             // -1..1 across the cloud
      const r = 3.6 + (1 - Math.abs(u)) * 3.4 + rand() * 1.4;
      const px = u * puffs * 2.1 + (rand() - 0.5);
      // flattened, darker base puff
      const base = new THREE.Mesh(cloudGeo, underMat);
      base.scale.set(r * 1.15, r * 0.5, r * 0.85);
      base.position.set(px, -r * 0.35, rand() * 1.2);
      // body puff
      const body = new THREE.Mesh(cloudGeo, midMat);
      body.scale.set(r, r * 0.8, r * 0.85);
      body.position.set(px, r * 0.15, rand() * 1.5);
      // bright crown, shifted toward the sun side
      const top = new THREE.Mesh(cloudGeo, topMat);
      top.scale.set(r * 0.72, r * 0.62, r * 0.7);
      top.position.set(px + r * 0.15, r * 0.62, 0.8 + rand());
      c.add(base, body, top);
    }
    let x = -110 + i * 28 + rand() * 10, y = 14 + rand() * 30;
    const z = -140 - rand() * 30;
    // keep the sun disc clear
    const sx = sunPos.x * (-z / 85), sy = sunPos.y * (-z / 85);
    if (Math.abs(x - sx) < 40 && Math.abs(y - sy) < 22) x += x < sx ? -55 : 55;
    c.position.set(x, y, z);
    c.scale.setScalar(1.4);
    c.userData.speed = 0.3 + rand() * 0.3;
    scene.add(c); clouds.push(c);
  }

  // ---- Distant headlands for a real coastline feel
  const hillMat = new THREE.MeshLambertMaterial({ color: 0xb2abc6 });
  [[-60, -2, -150, 38, 9], [70, -2, -170, 50, 12], [8, -2, -190, 40, 6]].forEach(([x, y, z, w, h]) => {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    hill.scale.set(w, h, 12); hill.position.set(x, y, z); scene.add(hill);
  });

  // ---- Ocean: CPU vertex waves on a perspective-weighted grid (100 x 64 segments)
  const NX = 100, NZ = 64;
  const waterGeo = new THREE.PlaneGeometry(1, 1, NX, NZ);
  const wp = waterGeo.attributes.position;
  const baseX = new Float32Array(wp.count), baseZ = new Float32Array(wp.count);
  const colors = new Float32Array(wp.count * 3);
  const deep = new THREE.Color(0x6da7b9), mid = new THREE.Color(0x91c9cd), shallow = new THREE.Color(0xbfe4dc), c = new THREE.Color();
  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i <= NX; i++) {
      const k = j * (NX + 1) + i;
      const u = (i / NX) * 2 - 1, t = j / NZ;
      baseX[k] = Math.sign(u) * Math.pow(Math.abs(u), 1.7) * 160;
      baseZ[k] = 3 - 190 * Math.pow(t, 2.1);
      const d = Math.min(1, Math.max(0, (2.5 - baseZ[k]) / 40));
      c.copy(shallow).lerp(mid, Math.min(1, d * 3)).lerp(deep, Math.max(0, d * 1.6 - 0.35));
      colors.set([c.r, c.g, c.b], k * 3);
    }
  }
  // Plane +Y maps to world +Z here, which flips winding; reverse it so the top faces up.
  { const wi = waterGeo.index.array;
    for (let i = 0; i < wi.length; i += 3) { const t = wi[i + 1]; wi[i + 1] = wi[i + 2]; wi[i + 2] = t; }
    waterGeo.index.needsUpdate = true; }
  waterGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.3, metalness: 0.08, flatShading: false,
    transparent: true, opacity: 0.94, emissive: 0x618c99, emissiveIntensity: 0.12,
  }));
  scene.add(water);

  function waveHeight(x, z, t) {
    const dist = Math.max(0, 2 - z);
    const shore = Math.min(1, Math.max(0.12, (shoreZ(x) + 1.2 - z) / 5)); // calmer by the beach
    const amp = (0.2 + Math.min(dist, 120) * 0.012) * shore;
    return amp * (
      Math.sin(x * 0.22 + z * 0.12 + t * 0.9) * 0.9 +
      Math.sin(x * -0.13 + z * 0.33 + t * 1.25 + 1.3) * 0.6 +
      Math.sin(x * 0.5 + z * 0.21 - t * 1.7 + 2.1) * 0.25);
  }
  function updateWater(t) {
    for (let k = 0; k < wp.count; k++) wp.setXYZ(k, baseX[k], waveHeight(baseX[k], baseZ[k], t), baseZ[k]);
    wp.needsUpdate = true;
    waterGeo.computeVertexNormals();
  }

  // ---- Sandy foreground with wet-sand tint
  const SX = 90, SZ = 30;
  const sandGeo = new THREE.PlaneGeometry(70, 10, SX, SZ);
  const sp = sandGeo.attributes.position;
  const sandColors = new Float32Array(sp.count * 3);
  const cream = new THREE.Color(0xffe6b8), wet = new THREE.Color(0xd2aa78), dry = new THREE.Color(0xfff1d0);
  for (let k = 0; k < sp.count; k++) {
    const x = sp.getX(k), z = 4 - sp.getY(k); // plane Y -> world Z, spanning -1..9
    sp.setXYZ(k, x, sandHeight(x, z), z);
    const s = z - shoreZ(x);
    c.copy(wet).lerp(cream, Math.min(1, Math.max(0, s / 0.9))).lerp(dry, Math.min(1, Math.max(0, (s - 1.5) / 3)));
    sandColors.set([c.r, c.g, c.b], k * 3);
  }
  sandGeo.setAttribute('color', new THREE.BufferAttribute(sandColors, 3));
  sandGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));

  // ---- Translucent wave-crest ribbons rolling toward shore
  const RS = 70, ribbons = [];
  for (let r = 0; r < 4; r++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RS + 1) * 2 * 3), 3));
    const index = [];
    for (let i = 0; i < RS; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(index);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 2;
    scene.add(mesh); ribbons.push({ geo, mat });
  }
  function updateRibbons(t) {
    ribbons.forEach((rb, r) => {
      const p = (t * 0.09 + r / ribbons.length) % 1;
      const travel = 3.4 * Math.pow(1 - p, 1.4);
      const width = 0.12 + 0.3 * Math.sin(Math.PI * Math.min(1, p * 1.2));
      const pos = rb.geo.attributes.position;
      for (let i = 0; i <= RS; i++) {
        const x = -40 + (i / RS) * 80;
        const wob = Math.sin(x * 0.8 + t * 1.5 + r * 2) * 0.12;
        const z = shoreZ(x) - 0.1 - travel + wob;
        const y = Math.max(waveHeight(x, z, t), sandHeight(x, z)) + 0.05;
        pos.setXYZ(i * 2, x, y, z - width);
        pos.setXYZ(i * 2 + 1, x, y, z + width);
      }
      pos.needsUpdate = true;
      rb.mat.opacity = 0.55 * Math.sin(Math.PI * p) * (p > 0.85 ? (1 - p) / 0.15 : 1);
    });
  }

  // ---- Shoreline props: starfish, shells, sea glass
  const props = new THREE.Group();
  scene.add(props);
  const placed = [];
  function place(obj, x, z, lift = 0) {
    obj.userData.x = x;
    obj.userData.z = z;
    obj.userData.lift = lift;
    placed.push(obj); props.add(obj);
  }
  const R = seeded(21);

  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? 0.1 : 0.27;
    starShape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  starGeo.rotateX(-Math.PI / 2);
  [[0xff7a59, -2.6, 2.7, 0.9], [0xffa94d, 2.8, 3.3, 1.2], [0xf4607a, 0.3, 3.8, 1.0]].forEach(([col, x, z, s]) => {
    const m = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
    m.scale.setScalar(s); m.rotation.y = R() * 6; m.rotation.z = 0.08;
    place(m, x, z, 0.03);
  });

  const scallopGeo = new THREE.SphereGeometry(0.22, 28, 10, 0, Math.PI, 0, Math.PI / 2);
  { const p = scallopGeo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const a = Math.atan2(p.getZ(k), p.getX(k));
      const f = 1 + 0.07 * Math.cos(a * 12);
      p.setXYZ(k, p.getX(k) * f, p.getY(k) * 0.45 * f, p.getZ(k) * f);
    }
    scallopGeo.rotateY(-Math.PI / 2); scallopGeo.computeVertexNormals(); }
  [[0xffd0c2, -1.2, 3.2], [0xfff0e1, 1.5, 2.5], [0xf6b8c8, 4.0, 3.0], [0xffe3c9, -4.2, 3.5]].forEach(([col, x, z]) => {
    const m = new THREE.Mesh(scallopGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, side: THREE.DoubleSide }));
    m.rotation.y = R() * 6; m.rotation.x = -0.15;
    place(m, x, z, 0.02);
  });

  const conchGeo = new THREE.ConeGeometry(0.13, 0.38, 20, 14);
  { const p = conchGeo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), zz = p.getZ(k);
      const a = Math.atan2(zz, x), f = 1 + 0.16 * Math.sin(y * 34 - a * 1.5);
      p.setXYZ(k, x * f, y, zz * f);
    }
    conchGeo.rotateZ(Math.PI / 2 - 0.2); conchGeo.computeVertexNormals(); }
  [[0xf7d7b5, -3.4, 2.2], [0xe9b995, 3.6, 2.0]].forEach(([col, x, z]) => {
    const m = new THREE.Mesh(conchGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }));
    m.rotation.y = R() * 6;
    place(m, x, z, 0.1);
  });

  const glassColors = [0x58e0c8, 0x4aa8f0, 0xa8f0d8, 0xffc863, 0x7fd0ff];
  const glassGeo = new THREE.IcosahedronGeometry(0.09, 3); // smooth intact stone; normals stay spherical
  for (let i = 0; i < 16; i++) {
    const col = glassColors[i % glassColors.length];
    const m = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({
      color: col, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.82,
      clearcoat: 1, clearcoatRoughness: 0.1, emissive: col, emissiveIntensity: 0.12,
    }));
    const k = 0.6 + R() * 0.9;
    m.scale.set(k * (1 + R() * 0.35), k * 0.5, k * (0.85 + R() * 0.3)); // uniform per-stone axis scale
    m.rotation.y = R() * 6;
    place(m, (R() - 0.5) * 11, 1.9 + R() * 2.1, 0.03);
  }

  // ---- Layout: horizon ~40% from top, beach in the lower quarter
  let xScale = 1;
  function resize() {
    const w = Math.max(1, container.clientWidth || window.innerWidth);
    const h = Math.max(1, container.clientHeight || window.innerHeight);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 66 : aspect < 1.3 ? 58 : 50;
    const pitch = Math.atan(0.2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.rotation.set(-pitch, 0, 0);
    camera.updateProjectionMatrix();
    xScale = Math.min(1, Math.max(0.35, aspect / 1.6));
    placed.forEach((o) => {
      const x = o.userData.x * xScale, z = o.userData.z;
      o.position.set(x, sandHeight(x, z) + o.userData.lift, z);
    });
  }

  const clock = new THREE.Clock();
  let time = 0;
  function render(animate) {
    if (animate) {
      const dt = Math.min(clock.getDelta(), 0.1);
      time += dt;
      clouds.forEach((cl) => { cl.position.x += cl.userData.speed * dt; if (cl.position.x > 190) cl.position.x = -190; });
    } else {
      time = 3.2; clock.getDelta();
    }
    updateWater(time);
    updateRibbons(time);
    camera.position.y = 1.6 + (animate ? Math.sin(time * 0.35) * 0.03 : 0);
    renderer.render(scene, camera);
  }

  resize();
  return {
    render,
    resize,
    resetClock: () => clock.getDelta(),
    canvas: renderer.domElement,
    dispose() {
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => { m.map?.dispose?.(); m.dispose(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'ocean-world';
  host.setAttribute('aria-hidden', 'true');
  body.prepend(host);
  return host;
}

function frame() {
  rafId = 0;
  if (!running || !world) return;
  try { world.render(true); } catch { fail(); return; }
  rafId = requestAnimationFrame(frame);
}
function fail() {
  failed = true;
  stopLoop();
  if (host) host.hidden = true;
}
function stopLoop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

function sync() {
  const active = isDaylight();
  if (host) host.hidden = !active || failed;
  if (!active || failed) { stopLoop(); return; }
  ensureHost();
  if (!world && !initTried) {
    initTried = true;
    try {
      world = build(host);
      world.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(); });
    } catch {
      world = null; fail(); // No WebGL: page stays usable without the scene.
      return;
    }
  }
  if (!world) return;
  world.resize();
  // Always draw a synchronous static frame first so view-transition snapshots capture the scene.
  if (!running || motionQuery.matches) {
    try { world.render(false); } catch { fail(); return; }
  }
  if (motionQuery.matches || document.hidden) { stopLoop(); return; }
  if (!running) {
    running = true;
    world.resetClock();
    rafId = requestAnimationFrame(frame);
  }
}

window.addEventListener('portfolio-theme-change', sync);
new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('visibilitychange', sync);
window.addEventListener('resize', () => {
  if (!world || !isDaylight()) return;
  world.resize();
  if (!running && !failed && !document.hidden) { try { world.render(false); } catch { fail(); } }
});
motionQuery.addEventListener?.('change', sync);
sync();
