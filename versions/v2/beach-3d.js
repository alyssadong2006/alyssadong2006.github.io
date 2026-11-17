import * as THREE from './vendor/three.module.js';

// Original procedural geometry: no external models or textures required.
const viewport = document.getElementById('beach-viewport');
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function buildBeach() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const perspectiveCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  const pixelCamera = new THREE.OrthographicCamera(-4, 4, 3.4, -3.4, 0.1, 60);
  let pixelMode = !document.body.classList.contains('daylight-theme');
  let aspect = 1;
  let camera = pixelMode ? pixelCamera : perspectiveCamera;
  const target = new THREE.Vector3(0, 0.65, 0);
  scene.add(new THREE.HemisphereLight(0xfff5e6, 0x6cabb3, 1.9));
  const sunlight = new THREE.DirectionalLight(0xffe5c1, 3.2);
  sunlight.position.set(-3, 8, 5);
  scene.add(sunlight);

  const materials = new Map();
  function material(color, extra = {}) {
    const key = `${color}:${JSON.stringify(extra)}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
    return materials.get(key);
  }
  function mesh(geometry, color, position, parent = scene, extra) {
    const object = new THREE.Mesh(geometry, material(color, extra));
    object.position.set(...position);
    parent.add(object);
    return object;
  }
  function box(size, color, position, parent) {
    return mesh(new THREE.BoxGeometry(...size), color, position, parent);
  }
  function sphere(radius, color, position, parent) {
    return mesh(new THREE.SphereGeometry(radius, 16, 10), color, position, parent);
  }
  function rod(start, end, radius, color, parent = scene) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const object = mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), color, a.clone().add(b).multiplyScalar(0.5).toArray(), parent);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return object;
  }

  // Layered shallow water, a sandy shelf, and a softly rounded island.
  const water = mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.12, 80), 0x8bd9d9, [0, -0.22, 0]);
  water.scale.z = 0.82;
  const shallows = mesh(new THREE.CylinderGeometry(2.63, 2.75, 0.10, 72), 0xb6e8de, [0, -0.12, 0]);
  shallows.scale.z = 0.8;
  const sandBase = mesh(new THREE.CylinderGeometry(2.25, 2.38, 0.24, 64), 0xe2bc89, [0, 0.02, 0]);
  sandBase.scale.z = 0.76;
  const sand = sphere(1, 0xffe3af, [0, 0.12, 0]);
  sand.scale.set(2.3, 0.29, 1.76);

  // Hand-painted contact shadows give the objects weight without a shadow pass.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(85, 101, 102, 0.28)');
  gradient.addColorStop(0.5, 'rgba(85, 101, 102, 0.12)');
  gradient.addColorStop(1, 'rgba(85, 101, 102, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false });
  function contactShadow(x, z, width, depth, height = 0.415) {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, height, z);
    scene.add(shadow);
  }
  contactShadow(0.65, -0.3, 1.7, 1.3);
  contactShadow(0.7, 0.5, 0.85, 1.1);
  contactShadow(-1.15, -0.5, 0.65, 0.55, 0.37);
  contactShadow(-1.75, 0.1, 0.4, 0.4, 0.32);
  contactShadow(1.4, 0.55, 0.5, 0.4, 0.36);

  // Broken foam rings feel like waves without expensive water shaders.
  const waves = [];
  for (let i = 0; i < 4; i++) {
    const wave = mesh(new THREE.TorusGeometry(2.43 + i * 0.17, 0.012, 4, 80, Math.PI * 1.35), 0xf0ffef, [0, -0.035, 0], scene, { transparent: true, opacity: 0.6 });
    wave.material = wave.material.clone();
    wave.rotation.set(-Math.PI / 2, 0, i * 1.8);
    wave.scale.y = 0.8;
    waves.push(wave);
  }

  function palm(x, z, height, lean) {
    const group = new THREE.Group();
    group.position.set(x, 0.25, z);
    scene.add(group);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-lean * 0.1, height * 0.35, 0),
      new THREE.Vector3(lean * 0.4, height * 0.75, 0),
      new THREE.Vector3(lean, height, 0),
    ]);
    mesh(new THREE.TubeGeometry(curve, 16, 0.09, 8, false), 0xb88c64, [0, 0, 0], group);
    for (let i = 1; i < 9; i++) {
      const p = curve.getPoint(i / 10);
      const ring = mesh(new THREE.TorusGeometry(0.092, 0.009, 4, 8), 0x916e53, p.toArray(), group);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(i / 10));
    }
    const crown = new THREE.Group();
    crown.position.set(lean, height, 0);
    group.add(crown);
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9;
      const length = i % 2 ? 1.1 : 1.35;
      const vertices = [];
      const indices = [];
      for (let step = 0; step <= 10; step++) {
        const t = step / 10;
        const width = Math.sin(Math.PI * t) * 0.17;
        const y = Math.sin(t * Math.PI) * 0.25 - t * t * 0.38;
        vertices.push(t * length, y, -width, t * length, y + 0.055 * Math.sin(Math.PI * t), 0, t * length, y, width);
        if (step < 10) {
          const n = step * 3;
          indices.push(n, n + 3, n + 1, n + 1, n + 3, n + 4, n + 1, n + 4, n + 2, n + 2, n + 4, n + 5);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const leaf = mesh(geometry, i % 2 ? 0x75b990 : 0x54a582, [0, 0, 0], crown, { side: THREE.DoubleSide });
      leaf.rotation.y = angle;
    }
    sphere(0.12, 0x9a7359, [0.05, -0.12, 0.08], crown);
    sphere(0.11, 0xb28a61, [-0.13, -0.1, 0.02], crown);
    return crown;
  }
  const crowns = [palm(-1.15, -0.5, 2.1, 0.32), palm(-1.75, 0.1, 1.6, -0.15)];

  // Eight individually coloured panels form the scalloped parasol.
  const umbrella = new THREE.Group();
  umbrella.position.set(0.65, 0.28, -0.4);
  scene.add(umbrella);
  rod([0, 0, 0], [0, 1.55, 0], 0.025, 0xfaf0d8, umbrella);
  for (let i = 0; i < 8; i++) {
    const vertices = [];
    for (let j = 0; j < 8; j++) {
      const a = (i + j / 8) * Math.PI / 4;
      const b = (i + (j + 1) / 8) * Math.PI / 4;
      // Radial rings create a domed, scalloped fabric canopy, not a flat cone.
      const point = (angle, radius, scallop) => [Math.cos(angle) * radius * 0.8, 1.66 - 0.41 * radius * radius - Math.sin(scallop * Math.PI) * 0.055 * radius, Math.sin(angle) * radius * 0.8];
      for (let ring = 0; ring < 5; ring++) {
        const inner = ring / 5;
        const outer = (ring + 1) / 5;
        const p = point(a, inner, j / 8);
        const q = point(a, outer, j / 8);
        const r = point(b, outer, (j + 1) / 8);
        const s = point(b, inner, (j + 1) / 8);
        vertices.push(...p, ...q, ...r, ...p, ...r, ...s);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    mesh(geometry, i % 2 ? 0xfff3dc : 0xeaa3ad, [0, 0, 0], umbrella, { side: THREE.DoubleSide });
    const a = i * Math.PI / 4;
    rod([0, 1.65, 0], [Math.cos(a) * 0.79, 1.25, Math.sin(a) * 0.79], 0.008, 0xe9d6b8, umbrella);
  }
  sphere(0.05, 0xfff3dc, [0, 1.69, 0], umbrella);

  const chair = new THREE.Group();
  chair.position.set(0.68, 0.33, 0.55);
  chair.rotation.y = -0.25;
  scene.add(chair);
  for (const x of [-0.25, 0.25]) {
    rod([x, 0, -0.3], [x, 0.38, 0.4], 0.024, 0xf6ebd4, chair);
    rod([x, 0, 0.4], [x, 0.85, -0.38], 0.024, 0xf6ebd4, chair);
  }
  box([0.48, 0.04, 0.48], 0xfff5de, [0, 0.29, 0.18], chair);
  const back = box([0.48, 0.66, 0.035], 0xfff5de, [0, 0.57, -0.16], chair);
  back.rotation.x = -0.35;
  for (const x of [-0.16, 0, 0.16]) {
    box([0.07, 0.045, 0.47], 0x99c9c7, [x, 0.315, 0.18], chair);
    const stripe = box([0.07, 0.66, 0.038], 0x99c9c7, [x, 0.57, -0.14], chair);
    stripe.rotation.x = -0.35;
  }
  const towel = box([0.5, 0.018, 0.8], 0xc6b6e2, [-0.1, 0.4, 0.65]);
  towel.rotation.y = 0.2;
  for (const z of [0.32, 0.95]) box([0.45, 0.019, 0.035], 0xfff5e4, [-0.1, 0.413, z]);

  const ball = mesh(new THREE.SphereGeometry(0.19, 24, 12), 0xfff5dd, [1.4, 0.44, 0.55]);
  for (let i = 0; i < 6; i++) {
    const panel = mesh(new THREE.SphereGeometry(0.192, 6, 12, i * Math.PI / 3, Math.PI / 3), [0xe9a0ae, 0xfff4dd, 0x8acccf][i % 3], [0, 0, 0], ball);
    panel.rotation.z = 0.4;
  }
  for (let i = 0; i < 12; i++) {
    // Deterministic scatter, so the island looks the same on every visit.
    const a = i * 2.399;
    const pebble = sphere(0.045 + (i % 3) * 0.012, i % 2 ? 0xf8c5b1 : 0xfff3d5, [Math.cos(a) * 1.88, 0.3, Math.sin(a) * 1.25]);
    pebble.scale.set(1, 0.4, 0.7);
  }
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5;
    const r = i % 2 ? 0.07 : 0.18;
    if (!i) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  star.closePath();
  const starfish = mesh(new THREE.ExtrudeGeometry(star, { depth: 0.025, bevelEnabled: false }), 0xe9a58e, [-1, 0.39, 1.05]);
  starfish.rotation.x = -Math.PI / 2;

  // A little dive kit: paired fins, glass mask, snorkel, and a banded air tank.
  const gear = new THREE.Group();
  gear.position.set(-0.55, 0.42, 0.3);
  gear.rotation.y = -0.4;
  scene.add(gear);
  for (const x of [-0.13, 0.13]) {
    const finShape = new THREE.Shape();
    finShape.moveTo(-0.055, -0.14);
    finShape.lineTo(0.055, -0.14);
    finShape.lineTo(0.12, 0.34);
    finShape.quadraticCurveTo(0, 0.4, -0.12, 0.34);
    finShape.closePath();
    const fin = mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.025, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.008, bevelSegments: 2, steps: 1 }), 0x547f91, [x, 0, 0], gear);
    fin.rotation.x = -Math.PI / 2;
    const pocket = sphere(0.06, 0x365464, [x, 0.045, 0.07], gear);
    pocket.scale.set(0.7, 0.5, 1.5);
    for (const offset of [-0.04, 0.04]) rod([x + offset, 0.035, -0.12], [x + offset * 1.7, 0.035, -0.32], 0.008, 0x8eb6ba, gear);
  }
  const mask = mesh(new THREE.TorusGeometry(0.09, 0.022, 8, 24), 0xe6a498, [0.02, 0.045, -0.27], gear);
  mask.rotation.x = -Math.PI / 2;
  mask.scale.x = 1.6;
  const glass = mesh(new THREE.CircleGeometry(0.087, 24), 0x8dc6d1, [0.02, 0.045, -0.27], gear, { metalness: 0.3, roughness: 0.18, side: THREE.DoubleSide });
  glass.rotation.x = -Math.PI / 2;
  glass.scale.x = 1.6;
  rod([0.2, 0.04, -0.16], [0.2, 0.04, -0.46], 0.02, 0xe6a498, gear);
  rod([0.2, 0.04, -0.46], [0.15, 0.04, -0.48], 0.02, 0x547f91, gear);
  const tank = mesh(new THREE.CapsuleGeometry(0.105, 0.32, 6, 12), 0xb2c8cc, [-0.35, 0.12, -0.16], gear, { metalness: 0.35, roughness: 0.4 });
  tank.rotation.x = Math.PI / 2;
  for (const z of [-0.27, -0.06]) {
    const band = mesh(new THREE.TorusGeometry(0.108, 0.019, 6, 16), 0x54717b, [-0.35, 0.12, z], gear);
    band.rotation.z = Math.PI / 2;
  }
  box([0.07, 0.07, 0.08], 0x5f7582, [-0.35, 0.12, -0.45], gear);

  // Side table, iced drink, and a book for a post-dive afternoon.
  mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.045, 24), 0xe1b98e, [1.28, 0.66, -0.15]);
  rod([1.28, 0.32, -0.15], [1.28, 0.65, -0.15], 0.045, 0xd5ad83);
  mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.14, 12), 0xeeb584, [1.31, 0.75, -0.16], scene, { roughness: 0.35 });
  rod([1.31, 0.8, -0.16], [1.35, 0.92, -0.16], 0.008, 0xfff9df);
  box([0.17, 0.022, 0.13], 0xc1a7d1, [1.18, 0.7, -0.1]);

  // Ridged fan shells, tide-polished stones, and a trail of footprints.
  for (const [x, z, color] of [[-1.3, 0.75, 0xf0b9ad], [1.6, -0.65, 0xffeed4], [0.3, 1.25, 0xe5b7ce]]) {
    const shell = new THREE.Group();
    shell.position.set(x, 0.34, z);
    scene.add(shell);
    const body = sphere(0.12, color, [0, 0, 0], shell);
    body.scale.set(1, 0.3, 0.8);
    for (let i = 0; i < 7; i++) {
      const a = i / 6 * Math.PI;
      rod([0, 0.025, -0.07], [Math.cos(a) * 0.1, 0.035, Math.sin(a) * 0.075], 0.007, 0xfff2dc, shell);
    }
  }
  for (let i = 0; i < 8; i++) {
    const x = 0.15 + i * 0.14;
    const z = 1.08 + (i % 2 ? 0.08 : -0.08);
    const y = 0.12 + 0.29 * Math.sqrt(Math.max(0, 1 - (x / 2.3) ** 2 - (z / 1.76) ** 2));
    const footprint = sphere(0.038, 0xd6b787, [x, y + 0.006, z]);
    footprint.scale.set(0.65, 0.1, 1.5);
    footprint.rotation.y = -0.6;
  }

  // Tiny highlights dance on the water; low-poly birds circle overhead.
  const glints = [];
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399;
    const r = 2.6 + (i % 4) * 0.12;
    const glint = box([0.08 + (i % 3) * 0.035, 0.005, 0.015], 0xe5fffa, [Math.cos(a) * r, -0.145, Math.sin(a) * r * 0.82]);
    glints.push(glint);
  }
  const birds = [];
  for (let i = 0; i < 3; i++) {
    const bird = new THREE.Group();
    bird.scale.setScalar(1.45);
    const body = sphere(0.075, 0xfff8ed, [0, 0, 0], bird);
    body.scale.set(0.9, 0.85, 1.65);
    const back = sphere(0.062, 0xc4d2d8, [0, 0.028, -0.025], bird);
    back.scale.set(1, 0.55, 1.45);
    const head = sphere(0.063, 0xfffcf2, [0, 0.065, 0.105], bird);
    head.scale.set(0.95, 1.05, 1);
    const beak = mesh(new THREE.ConeGeometry(0.024, 0.082, 8), 0xefb358, [0, 0.052, 0.19], bird);
    beak.rotation.x = Math.PI / 2;
    for (const sign of [-1, 1]) {
      sphere(0.012, 0x334656, [sign * 0.052, 0.077, 0.13], bird);
      sphere(0.0038, 0xffffff, [sign * 0.062, 0.081, 0.135], bird);
      const cheek = sphere(0.018, 0xf0c6ba, [sign * 0.049, 0.052, 0.14], bird);
      cheek.scale.set(0.3, 0.6, 1);
      rod([sign * 0.027, -0.045, -0.02], [sign * 0.027, -0.08, -0.055], 0.008, 0xefb358, bird);
      rod([sign * 0.027, -0.08, -0.055], [sign * 0.027, -0.082, -0.085], 0.009, 0xefb358, bird);
    }
    for (let j = -1; j <= 1; j++) {
      const tail = sphere(0.03, j ? 0xd2dde0 : 0xfff8ed, [j * 0.026, 0.012, -0.135], bird);
      tail.scale.set(0.6, 0.22, 1.8);
      tail.rotation.y = -j * 0.2;
    }
    const wings = [];
    for (const sign of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(sign * 0.048, 0.022, 0);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.07);
      shape.quadraticCurveTo(sign * 0.14, 0.12, sign * 0.31, -0.035);
      shape.quadraticCurveTo(sign * 0.29, -0.065, sign * 0.25, -0.05);
      shape.lineTo(sign * 0.245, -0.09);
      shape.quadraticCurveTo(sign * 0.215, -0.1, sign * 0.2, -0.075);
      shape.lineTo(sign * 0.185, -0.115);
      shape.quadraticCurveTo(sign * 0.1, -0.1, 0, -0.055);
      shape.closePath();
      const feather = mesh(new THREE.ShapeGeometry(shape, 12), 0xd4dfe0, [0, 0, 0], wing, { side: THREE.DoubleSide });
      feather.rotation.x = -Math.PI / 2;
      for (let j = 0; j < 3; j++) {
        const tip = sphere(0.026, 0x718590, [sign * (0.235 - j * 0.027), 0.004, 0.044 + j * 0.022], wing);
        tip.scale.set(1.6, 0.15, 0.45);
        tip.rotation.y = sign * 0.5;
      }
      bird.add(wing);
      wings.push(wing);
    }
    scene.add(bird);
    birds.push({ bird, wings, phase: i * 1.4 });
  }

  viewport.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  let visible = true;
  let frame = 0;
  const pointer = new THREE.Vector2();
  const view = new THREE.Vector2();
  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    if (!width || !height) return;
    aspect = width / height;
    camera = pixelMode ? pixelCamera : perspectiveCamera;
    renderer.setPixelRatio(pixelMode ? 1 : Math.min(devicePixelRatio, 1.5));
    // The exact same model becomes a flat, low-resolution isometric illustration.
    renderer.setSize(pixelMode ? Math.round(width / 3) : width, pixelMode ? Math.round(height / 3) : height, false);
    perspectiveCamera.aspect = aspect;
    perspectiveCamera.updateProjectionMatrix();
    const halfHeight = Math.max(3.05, 3.2 / aspect);
    pixelCamera.left = -halfHeight * aspect;
    pixelCamera.right = halfHeight * aspect;
    pixelCamera.top = halfHeight;
    pixelCamera.bottom = -halfHeight;
    pixelCamera.updateProjectionMatrix();
    render(performance.now());
  }
  function render(now) {
    const t = motion.matches ? 0 : now * 0.001;
    if (motion.matches) view.set(0, 0);
    else view.lerp(pointer, 0.075);
    if (pixelMode) {
      // Snap the eased cursor position into small steps for a retro orbit,
      // while retaining the flat orthographic camera and low-resolution art.
      const stepX = Math.round(view.x * 8) / 8;
      const stepY = Math.round(view.y * 8) / 8;
      const yaw = 0.31 + stepX * 0.28;
      const pitch = 0.43 - stepY * 0.13;
      const radius = 12.3;
      camera.position.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * radius,
        target.y + Math.sin(pitch) * radius,
        target.z + Math.cos(yaw) * Math.cos(pitch) * radius,
      );
    } else {
      // Orbit the island instead of merely nudging the camera sideways.
      // Responsive distance keeps the closer view within the frame on mobile.
      const radius = Math.max(9.8, 3.2 / (Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov / 2)) * aspect));
      const yaw = 0.32 + view.x * 0.45;
      const pitch = 0.47 - view.y * 0.20;
      camera.position.set(
        target.x + Math.sin(yaw) * Math.cos(pitch) * radius,
        target.y + Math.sin(pitch) * radius,
        target.z + Math.cos(yaw) * Math.cos(pitch) * radius,
      );
    }
    camera.lookAt(target);
    if (!pixelMode && !motion.matches) camera.rotateZ(-view.x * 0.018);
    waves.forEach((wave, i) => {
      const pulse = Math.sin(t * 0.8 + i * 1.4);
      wave.scale.set(1 + pulse * 0.045, 0.8 + pulse * 0.036, 1);
      wave.rotation.z = i * 1.8 + Math.sin(t * 0.18 + i) * 0.12;
      wave.material.opacity = 0.45 + pulse * 0.15;
    });
    crowns.forEach((crown, i) => {
      crown.rotation.z = Math.sin(t * 0.9 + i) * 0.055;
      crown.rotation.x = Math.cos(t * 0.65 + i) * 0.035;
      crown.children.forEach((leaf, j) => {
        if (leaf.geometry?.type === 'BufferGeometry') leaf.rotation.z = Math.sin(t * 1.3 + j * 0.8 + i) * 0.035;
      });
    });
    umbrella.rotation.z = Math.sin(t * 0.8) * 0.018;
    ball.position.x = 1.4 + Math.sin(t * 0.7) * 0.045;
    ball.rotation.z = Math.sin(t * 0.7) * 0.18;
    glints.forEach((glint, i) => {
      glint.scale.x = 0.3 + (Math.sin(t * 1.4 + i * 1.7) + 1) * 0.45;
      glint.position.y = -0.14 + Math.sin(t * 1.1 + i) * 0.008;
    });
    birds.forEach(({ bird, wings, phase }, i) => {
      const a = t * 0.22 + i * 2.1;
      const flap = Math.sin(t * 3.2 + phase);
      bird.position.set(Math.cos(a) * 1.7, 2.85 + i * 0.18 + Math.sin(t * 0.6 + i) * 0.08 + flap * 0.018, Math.sin(a) * 1.1 - 0.5);
      bird.rotation.set(Math.sin(t * 0.6 + phase) * 0.045, -a, Math.sin(t * 0.45 + phase) * 0.08);
      wings.forEach((wing, j) => {
        wing.rotation.z = (0.12 + flap * 0.48) * (j ? 1 : -1);
        wing.rotation.y = Math.cos(t * 3.2 + phase) * 0.08 * (j ? 1 : -1);
      });
    });
    renderer.render(scene, camera);
  }
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || motion.matches) return;
    render(now);
    frame = requestAnimationFrame(tick);
  }
  function updateAnimation() {
    document.getElementById('diorama-hint').textContent = pixelMode ? '↖ Click to switch to 3D' : '↖ Click for pixel world';
    cancelAnimationFrame(frame);
    frame = 0;
    if (visible && !document.hidden) {
      render(performance.now());
      if (!motion.matches) frame = requestAnimationFrame(tick);
    }
  }
  const frameElement = viewport.closest('.beach-diorama');
  frameElement.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || motion.matches) return;
    const rect = viewport.getBoundingClientRect();
    pointer.set(
      THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1),
      THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1),
    );
  });
  frameElement.addEventListener('pointerleave', () => pointer.set(0, 0));
  window.addEventListener('portfolio-theme-change', (event) => {
    pixelMode = !event.detail.daylight;
    pointer.set(0, 0);
    view.set(0, 0);
    resize();
    updateAnimation();
  });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateAnimation();
  });
  observer.observe(viewport);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  document.addEventListener('visibilitychange', updateAnimation);
  motion.addEventListener('change', updateAnimation);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    visible = false;
    cancelAnimationFrame(frame);
    viewport.classList.remove('is-ready');
    document.getElementById('diorama-hint').textContent = pixelMode ? '↖ Click to switch to 3D' : '↖ Click for pixel world';
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    visible = viewport.getBoundingClientRect().bottom > 0;
    resize();
    viewport.classList.add('is-ready');
    updateAnimation();
  });
  resize();
  viewport.classList.add('is-ready');
  updateAnimation();
}

try {
  buildBeach();
} catch (error) {
  // The decorative scene must never prevent the portfolio from working.
  viewport.classList.remove('is-ready');
  viewport.querySelector('canvas')?.remove();
  console.warn('The beach scene is unavailable; showing the static fallback.', error);
}
