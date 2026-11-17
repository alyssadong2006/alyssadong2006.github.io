import * as THREE from './vendor/three.module.js';

// Core blast: fullscreen-escape scale. Parent keeps this group anchored on the
// physical orb; everything allocated once, no RAF/renderer/events here.
const DURATION = 4.0;
const SHOCK_TIME = 2.2;
const MAX_R = 18;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const smooth = (a, b, v) => { const x = clamp01((v - a) / (b - a)); return x * x * (3 - 2 * x); };

function glowTexture(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCoreExplosion(parent, { mobile = false } = {}) {
  const rand = rng(1650);
  const group = new THREE.Group();
  group.name = 'core-explosion';
  group.visible = false;
  parent.add(group);

  const palette = ['#ffd9c9', '#ffb3c7', '#f08bb4', '#d8b4f8', '#c4a8ff', '#ffe6f0'].map((c) => new THREE.Color(c));
  const unit = () => {
    const z = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    return [r * Math.cos(a), z, r * Math.sin(a)];
  };

  // Textures (generated; no external assets)
  const sparkTex = glowTexture([[0, 'rgba(255,240,248,1)'], [0.2, 'rgba(255,190,220,0.85)'], [0.5, 'rgba(220,160,255,0.25)'], [1, 'rgba(200,150,255,0)']]);
  const plumeTex = glowTexture([[0, 'rgba(255,200,225,0.55)'], [0.35, 'rgba(240,150,200,0.3)'], [0.7, 'rgba(190,150,240,0.1)'], [1, 'rgba(180,140,240,0)']], 128);
  const coreTex = glowTexture([[0, 'rgba(255,225,238,0.95)'], [0.18, 'rgba(255,170,205,0.65)'], [0.5, 'rgba(210,140,240,0.2)'], [1, 'rgba(200,140,255,0)']], 256);

  // Hot core glow (local, additive, fades fast)
  const coreMat = new THREE.SpriteMaterial({ map: coreTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const core = new THREE.Sprite(coreMat);
  core.renderOrder = 5;
  group.add(core);

  // Volumetric plume: two Points layers (big and medium puffs), normal blending, low opacity
  function makePlume(count, size) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const dir = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = unit();
      dir.set(u, i * 3);
      spd[i] = 0.25 + Math.pow(rand(), 0.8) * 0.75;
      const c = palette[1 + Math.floor(rand() * 4)];
      const k = 0.75 + rand() * 0.25;
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    const geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    geo.setAttribute('position', attr);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      map: plumeTex, size, vertexColors: true, transparent: true, opacity: 0,
      depthWrite: false, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    group.add(pts);
    return { count, attr, dir, spd, mat, size };
  }
  const plumeBig = makePlume(mobile ? 36 : 80, 4.2);
  const plumeMid = makePlume(mobile ? 70 : 180, 2.2);

  // Shards: instanced emissive metal
  const shardCount = mobile ? 180 : 400;
  const shardMat = new THREE.MeshStandardMaterial({
    color: 0xe7b8d8, metalness: 0.9, roughness: 0.25,
    emissive: 0xd78ad0, emissiveIntensity: 0.9,
    transparent: true, opacity: 1, flatShading: true, depthWrite: false,
  });
  const shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), shardMat, shardCount);
  shards.frustumCulled = false;
  const sh = {
    dir: new Float32Array(shardCount * 3), v: new Float32Array(shardCount),
    drag: new Float32Array(shardCount), axis: [], spin: new Float32Array(shardCount),
    size: new Float32Array(shardCount),
  };
  for (let i = 0; i < shardCount; i++) {
    sh.dir.set(unit(), i * 3);
    sh.v[i] = 3 + Math.pow(rand(), 0.7) * 11;
    sh.drag[i] = 0.55 + rand() * 0.6;
    sh.axis.push(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
    sh.spin[i] = 1 + rand() * 6;
    sh.size[i] = 0.05 + Math.pow(rand(), 2.2) * 0.22;
    shards.setColorAt(i, palette[Math.floor(rand() * palette.length)]);
  }
  shards.instanceColor.needsUpdate = true;
  group.add(shards);

  // Glowing spark particles (additive, round sprite texture)
  const sparkCount = mobile ? 2500 : 8500;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkCol = new Float32Array(sparkCount * 3);
  const sp = {
    dir: new Float32Array(sparkCount * 3), v: new Float32Array(sparkCount),
    drag: new Float32Array(sparkCount), life: new Float32Array(sparkCount),
    base: new Float32Array(sparkCount * 3),
  };
  for (let i = 0; i < sparkCount; i++) {
    sp.dir.set(unit(), i * 3);
    sp.v[i] = 2 + Math.pow(rand(), 0.6) * 13;
    sp.drag[i] = 0.5 + rand() * 0.7;
    sp.life[i] = 0.55 + rand() * 0.45;
    const c = palette[Math.floor(rand() * palette.length)];
    const k = 0.5 + rand() * 0.5;
    sp.base[i * 3] = c.r * k; sp.base[i * 3 + 1] = c.g * k; sp.base[i * 3 + 2] = c.b * k;
  }
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPosAttr = new THREE.BufferAttribute(sparkPos, 3);
  const sparkColAttr = new THREE.BufferAttribute(sparkCol, 3);
  sparkGeo.setAttribute('position', sparkPosAttr);
  sparkGeo.setAttribute('color', sparkColAttr);
  const sparkMat = new THREE.PointsMaterial({
    map: sparkTex, size: mobile ? 0.2 : 0.15, vertexColors: true, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  sparks.renderOrder = 4;
  group.add(sparks);

  // Two shockwave rings + faint shell
  const ringGeo = new THREE.RingGeometry(0.93, 1, mobile ? 96 : 160);
  function makeRing(color, tiltX, tiltZ) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.rotation.set(tiltX, 0, tiltZ);
    mesh.renderOrder = 2;
    group.add(mesh);
    return mesh;
  }
  const ringA = makeRing(0xffb3d1, Math.PI / 2.6, 0);
  const ringB = makeRing(0xc4a8ff, Math.PI / 1.7, 0.6);
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0xd8b4f8, transparent: true, opacity: 0, side: THREE.BackSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, mobile ? 20 : 32, mobile ? 14 : 20), shellMat);
  shell.renderOrder = 1;
  group.add(shell);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const G = 0.9; // subtle gravity (downward)

  let t = 0, active = false, progress = 0;

  function updatePlume(L, tt, f, openness) {
    const grow = easeOut(clamp01(tt / (DURATION * 0.9)));
    const a = L.attr.array;
    for (let i = 0; i < L.count; i++) {
      const d = 0.2 + L.spd[i] * 9.5 * grow;
      a[i * 3] = L.dir[i * 3] * d;
      a[i * 3 + 1] = L.dir[i * 3 + 1] * d + 0.35 * tt * L.spd[i]; // gentle buoyant lift
      a[i * 3 + 2] = L.dir[i * 3 + 2] * d;
    }
    L.attr.needsUpdate = true;
    L.mat.size = L.size * (0.5 + 1.6 * grow);
    L.mat.opacity = openness * f;
  }

  function render() {
    progress = clamp01(t / DURATION);
    // fade wide particles before the last 30%; parent regrows planet at 0.66
    const f = 1 - smooth(0.45, 0.7, progress);

    // Hot core: local, bright only briefly
    const cg = easeOut(clamp01(t / 0.35));
    const cf = 1 - smooth(0.12, 0.45, t);
    coreMat.opacity = 0.85 * cf * (0.4 + 0.6 * cg);
    core.scale.setScalar(0.8 + 4.5 * cg + 1.5 * clamp01(t));
    core.visible = cf > 0.001;

    // Plume: slow low-opacity pink range
    const rise = smooth(0, 0.5, t);
    updatePlume(plumeBig, t, f, 0.16 * rise);
    updatePlume(plumeMid, t, f, 0.22 * rise);

    // Shards
    for (let i = 0; i < shardCount; i++) {
      const k = sh.drag[i];
      const dist = sh.v[i] * (1 - Math.exp(-k * t)) / k + 0.1;
      const j = i * 3;
      p.set(sh.dir[j] * dist, sh.dir[j + 1] * dist - 0.5 * G * t * t, sh.dir[j + 2] * dist);
      if (p.length() > MAX_R) p.setLength(MAX_R);
      q.setFromAxisAngle(sh.axis[i], sh.spin[i] * t);
      const sc = sh.size[i] * (0.35 + 0.65 * easeOut(clamp01(t / 0.4))) * (0.2 + 0.8 * f);
      s.set(sc, sc * 1.5, sc);
      m.compose(p, q, s);
      shards.setMatrixAt(i, m);
    }
    shards.instanceMatrix.needsUpdate = true;
    shardMat.opacity = f;
    shardMat.emissiveIntensity = 0.5 + 0.9 * (1 - clamp01(t / 2.5));

    // Sparks
    const pa = sparkPosAttr.array, ca = sparkColAttr.array;
    const sizeBoost = 1 - clamp01(t / DURATION) * 0.4;
    for (let i = 0; i < sparkCount; i++) {
      const k = sp.drag[i];
      const dist = sp.v[i] * (1 - Math.exp(-k * t)) / k + 0.1;
      const j = i * 3;
      let x = sp.dir[j] * dist, y = sp.dir[j + 1] * dist - 0.5 * G * t * t, z = sp.dir[j + 2] * dist;
      const len = Math.sqrt(x * x + y * y + z * z);
      if (len > MAX_R) { const r = MAX_R / len; x *= r; y *= r; z *= r; }
      pa[j] = x; pa[j + 1] = y; pa[j + 2] = z;
      const age = clamp01(t / (DURATION * sp.life[i]));
      const b = (1 - age) * (1 - age) * f * 0.9;
      ca[j] = sp.base[j] * b; ca[j + 1] = sp.base[j + 1] * b; ca[j + 2] = sp.base[j + 2] * b;
    }
    sparkPosAttr.needsUpdate = true;
    sparkColAttr.needsUpdate = true;
    sparkMat.size = (mobile ? 0.2 : 0.15) * sizeBoost;

    // Shockwaves
    const w1 = clamp01(t / SHOCK_TIME);
    const w2 = clamp01((t - 0.25) / SHOCK_TIME);
    const r1 = 0.2 + (MAX_R - 0.2) * easeOut(w1);
    const r2 = 0.2 + (MAX_R * 0.85) * easeOut(w2);
    ringA.scale.setScalar(r1);
    ringB.scale.setScalar(r2);
    ringA.material.opacity = w1 >= 1 ? 0 : 0.4 * Math.pow(1 - w1, 1.6) * smooth(0, 0.05, w1);
    ringB.material.opacity = w2 <= 0 || w2 >= 1 ? 0 : 0.28 * Math.pow(1 - w2, 1.6) * smooth(0, 0.05, w2);
    ringA.visible = w1 < 1;
    ringB.visible = w2 > 0 && w2 < 1;
    shell.scale.setScalar(Math.max(0.1, r1 * 0.97));
    shellMat.opacity = w1 >= 1 ? 0 : 0.05 * Math.pow(1 - w1, 1.5);
    shell.visible = w1 < 1;
  }

  function reset() {
    t = 0; active = false; progress = 0;
    group.visible = false;
  }

  function trigger() {
    t = 0; active = true; progress = 0;
    group.visible = true;
    render();
    progress = 0;
  }

  function update(dt) {
    if (!active) return;
    t += Math.max(0, dt || 0);
    if (t >= DURATION) {
      t = DURATION;
      render();
      progress = 1;
      active = false;
      group.visible = false;
      return;
    }
    render();
  }

  return {
    trigger, update, reset,
    get active() { return active; },
    get progress() { return progress; },
  };
}
