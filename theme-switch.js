const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const frameButton = document.getElementById('diorama-switch');
const themeControl = document.createElement('button');
themeControl.type = 'button';
themeControl.className = 'theme-control';
document.body.append(themeControl);
const announcement = document.createElement('p');
announcement.className = 'visually-hidden';
announcement.setAttribute('aria-live', 'polite');
document.body.append(announcement);
let changing = false;

function applyTheme(daylight, announce = true) {
  document.body.classList.toggle('daylight-theme', daylight);
  themeControl.hidden = false;
  themeControl.textContent = daylight ? '✦ Back to pixel' : '☀ Back to 3D';
  themeControl.setAttribute('aria-label', daylight ? 'Switch to the pixel beach theme' : 'Switch to the 3D beach theme');
  themeControl.setAttribute('aria-pressed', String(daylight));
  const hint = document.getElementById('diorama-hint');
  if (hint) hint.textContent = daylight ? '↖ Click for pixel world' : '↖ Click to switch to 3D';
  if (frameButton) {
    frameButton.setAttribute('aria-pressed', String(daylight));
    frameButton.setAttribute('aria-label', daylight ? 'Switch to the pixel beach theme' : 'Switch to the 3D beach theme');
  }
  try { sessionStorage.setItem('portfolio-theme', daylight ? 'daylight' : 'pixel'); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new CustomEvent('portfolio-theme-change', { detail: { daylight } }));
  if (announce) announcement.textContent = daylight ? '3D beach theme on, including the picture and garden frame.' : 'Pixel beach theme on, including the picture and garden frame.';
}
let initialDaylight = false;
try { initialDaylight = sessionStorage.getItem('portfolio-theme') === 'daylight'; } catch { /* Use the default theme. */ }
applyTheme(initialDaylight, false);

function ripple(x, y, radius, daylight) {
  const rings = [];
  for (let i = 0; i < 2; i++) {
    const ring = document.createElement('span');
    ring.className = 'theme-ripple';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.width = ring.style.height = `${radius * 2}px`;
    ring.style.borderColor = daylight ? 'rgba(95, 194, 189, .7)' : 'rgba(170, 141, 213, .7)';
    document.body.append(ring);
    const animation = ring.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0.9 },
      { opacity: 0.6, offset: 0.55 },
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
    ], { duration: 1250, delay: i * 150, easing: 'linear' });
    rings.push(animation.finished.catch(() => {}).finally(() => ring.remove()));
  }
  return Promise.all(rings);
}

// A live radial displacement map bends both page snapshots at the travelling
// wavefront. Unlike a coloured overlay, this actually warps text and controls.
function distortDimension(x, y, radius, snapshots) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'fixed';
  svg.style.pointerEvents = 'none';
  const filter = document.createElementNS(ns, 'filter');
  filter.id = 'dimension-ripple-filter';
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('x', '-5%');
  filter.setAttribute('y', '-5%');
  filter.setAttribute('width', '110%');
  filter.setAttribute('height', '110%');
  const image = document.createElementNS(ns, 'feImage');
  image.setAttribute('result', 'wave-map');
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('x', '0'); image.setAttribute('y', '0');
  image.setAttribute('width', String(innerWidth));
  image.setAttribute('height', String(innerHeight));
  const displacement = document.createElementNS(ns, 'feDisplacementMap');
  displacement.setAttribute('in', 'SourceGraphic');
  displacement.setAttribute('in2', 'wave-map');
  displacement.setAttribute('scale', '78');
  displacement.setAttribute('xChannelSelector', 'R');
  displacement.setAttribute('yChannelSelector', 'G');
  filter.append(image, displacement);
  svg.append(filter);
  document.body.append(svg);
  const style = document.createElement('style');
  style.textContent = snapshots
    ? '::view-transition-old(root), ::view-transition-new(root) { filter: url("#dimension-ripple-filter"); }'
    : 'html { filter: url("#dimension-ripple-filter"); }';
  document.head.append(style);
  const map = document.createElement('canvas');
  const scale = 256 / Math.max(innerWidth, innerHeight);
  map.width = Math.max(1, Math.round(innerWidth * scale));
  map.height = Math.max(1, Math.round(innerHeight * scale));
  const ctx = map.getContext('2d');
  const pixels = ctx.createImageData(map.width, map.height);
  const start = performance.now();
  const duration = 1250;
  const distances = new Float32Array(map.width * map.height);
  const directionsX = new Float32Array(distances.length);
  const directionsY = new Float32Array(distances.length);
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const index = row * map.width + col;
      const dx = col / scale - x;
      const dy = row / scale - y;
      const distance = Math.hypot(dx, dy);
      distances[index] = distance;
      directionsX[index] = distance ? dx / distance : 0;
      directionsY[index] = distance ? dy / distance : 0;
    }
  }
  return new Promise((resolve) => {
    let lastDraw = -Infinity;
    function draw(now) {
      const p = Math.min(1, (now - start) / duration);
      if (p >= 1 || document.hidden || motionPreference.matches) {
        style.remove(); svg.remove(); resolve(); return;
      }
      // 30 Hz displacement maps are enough for a smooth wave, without flooding
      // the browser with full-resolution image uploads on every animation frame.
      if (now - lastDraw >= 30) {
        lastDraw = now;
        const front = radius * p;
        const fade = Math.min(1, p * 10, (1 - p) * 8);
        for (let i = 0; i < distances.length; i++) {
          const offset = distances[i] - front;
          const envelope = Math.exp(-(offset * offset) / 11500);
          const wave = Math.sin(offset / 22) * envelope * fade;
          const n = i * 4;
          pixels.data[n] = 128 + directionsX[i] * wave * 120;
          pixels.data[n + 1] = 128 + directionsY[i] * wave * 120;
          pixels.data[n + 2] = 128;
          pixels.data[n + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
        image.setAttribute('href', map.toDataURL());
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  });
}

async function switchTheme(event) {
  if (changing) return;
  changing = true;
  document.documentElement.classList.add('dimension-changing');
  frameButton?.setAttribute('aria-busy', 'true');
  themeControl.setAttribute('aria-busy', 'true');
  const daylight = !document.body.classList.contains('daylight-theme');
  const rect = event.currentTarget.getBoundingClientRect();
  // Keyboard activation has no pointer coordinates; ripple from the button centre.
  const x = event.detail ? event.clientX : rect.left + rect.width / 2;
  const y = event.detail ? event.clientY : rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  try {
    if (motionPreference.matches) {
      applyTheme(daylight);
    } else if (document.startViewTransition) {
      const transition = document.startViewTransition(() => applyTheme(daylight));
      // Keep rejected transition promises handled (e.g. if a tab becomes hidden).
      const completed = transition.finished.catch(() => {});
      try {
        await transition.ready;
        const reveal = document.documentElement.animate([
          { clipPath: `circle(0px at ${x}px ${y}px)` },
          { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
        ], { duration: 1250, easing: 'linear', pseudoElement: '::view-transition-new(root)' });
        await Promise.all([reveal.finished.catch(() => {}), distortDimension(x, y, radius, true), ripple(x, y, radius, daylight)]);
      } catch {
        // The theme is still functional if the browser skips its visual transition.
      }
      await completed;
    } else {
      applyTheme(daylight);
      await Promise.all([distortDimension(x, y, radius, false), ripple(x, y, radius, daylight)]);
    }
  } finally {
    changing = false;
    document.documentElement.classList.remove('dimension-changing');
    frameButton?.setAttribute('aria-busy', 'false');
    themeControl.setAttribute('aria-busy', 'false');
  }
}
frameButton?.addEventListener('click', switchTheme);
themeControl.addEventListener('click', switchTheme);
