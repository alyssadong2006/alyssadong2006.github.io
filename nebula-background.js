(() => {
  'use strict';
  const host = document.querySelector('.cosmic-fallback');
  if (!host || host.querySelector('.nebula-canvas')) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'nebula-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.insertBefore(canvas, host.firstChild);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = window.matchMedia('(pointer: fine)');
  const mqMobile = window.matchMedia('(max-width: 760px)');
  let reduced = mqReduce.matches;
  let paused = document.body.classList.contains('motion-paused');
  let mobile = mqMobile.matches;
  let w = 0, h = 0, dpr = 1, raf = 0, last = 0, time = 0;
  let tex = null, texB = null, stars = [];
  let mx = 0, my = 0, tx = 0, ty = 0, scrollY = window.scrollY || 0;

  // seeded RNG
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function makeNoise(seed, n) {
    const r = rng(seed), g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => { // tileable bilinear w/ smoothstep
      const xi = Math.floor(x), yi = Math.floor(y);
      let fx = x - xi, fy = y - yi;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1];
      return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
    };
  }

  function buildTexture(tw, th, seed) {
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    const cx = c.getContext('2d'), img = cx.createImageData(tw, th), d = img.data;
    const n1 = makeNoise(seed, 64), n2 = makeNoise(seed + 17, 64), n3 = makeNoise(seed + 41, 64);
    const fbm = (n, x, y, o) => { let v = 0, a = 0.5, f = 1, s = 0; for (let i = 0; i < o; i++) { v += a * n(x * f, y * f); s += a; a *= 0.5; f *= 2.03; } return v / s; };
    const sc = 5.5;
    for (let j = 0; j < th; j++) {
      const v = j / th;
      for (let i = 0; i < tw; i++) {
        const u = i / tw, x = u * sc * 1.6, y = v * sc;
        // domain warp
        const wx = fbm(n2, x * 0.7 + 3.1, y * 0.7 + 1.7, 3), wy = fbm(n3, x * 0.7 + 8.2, y * 0.7 + 5.4, 3);
        const px = x + (wx - 0.5) * 3.2, py = y + (wy - 0.5) * 3.2;
        let gas = fbm(n1, px, py, 5);
        gas = Math.max(0, (gas - 0.36) / 0.5); gas = Math.min(1, gas); gas = gas * gas * (3 - 2 * gas);
        // large scale mask keeps dark breathing room
        const mask = fbm(n2, u * 2.4 + 11, v * 2.4 + 4, 2);
        const m = Math.min(1, Math.max(0, (mask - 0.3) / 0.45));
        // luminous ribbons/filaments
        const rib = Math.sin((px * 1.9 + py * 1.3 + fbm(n3, px * 0.9, py * 0.9, 4) * 6.5) * 2.2);
        const fil = Math.pow(1 - Math.abs(rib), 9) * gas * (0.4 + 0.6 * fbm(n1, px * 2.4 + 20, py * 2.4, 3));
        const fil2 = Math.pow(1 - Math.abs(Math.sin(py * 3.1 - px * 0.8 + wx * 9)), 14) * gas * m;
        // lavender dust vs pink gas mix
        const mixc = Math.min(1, Math.max(0, fbm(n3, px * 0.6 + 30, py * 0.6, 3) * 1.5 - 0.15));
        const body = gas * (0.25 + 0.75 * m);
        const hl = Math.min(1, fil * 0.9 * (0.4 + m) + fil2 * 0.7);
        // pink (239,150,190) -> lavender (166,140,230), highlights to (255,215,232)
        let r = 235 + (166 - 235) * mixc, g = 120 + (130 - 120) * mixc, b = 172 + (232 - 172) * mixc;
        r += (255 - r) * hl * 0.7; g += (215 - g) * hl * 0.7; b += (232 - b) * hl * 0.7;
        // edge fade so tiles/draws have no hard borders
        const e = Math.min(1, Math.min(u, 1 - u, v, 1 - v) * 7);
        const a = Math.min(0.78, (body * 0.5 + hl * 0.5)) * e * e;
        const k = (j * tw + i) * 4;
        d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = a * 255;
      }
    }
    cx.putImageData(img, 0, 0);
    return c;
  }

  function buildStars() {
    const count = mobile ? 240 : 650, r = rng(90210);
    stars = [];
    for (let i = 0; i < count; i++) {
      const q = r(), layer = q < 0.6 ? 0 : q < 0.88 ? 1 : 2;
      const tint = r();
      stars.push({
        x: r(), y: r(), layer,
        s: [0.45, 0.8, 1.15][layer] * (0.7 + r() * 0.6),
        a: [0.35, 0.55, 0.75][layer] * (0.55 + r() * 0.45),
        ph: r() * 6.283, sp: 0.25 + r() * 0.6,
        c: tint < 0.6 ? '255,240,246' : tint < 0.82 ? '239,184,204' : '205,190,255',
        big: false
      });
    }
    // rare brightest stars with soft diffraction
    const bright = mobile ? 3 : 7;
    for (let i = 0; i < bright; i++) stars.push({ x: r(), y: r(), layer: 2, s: 1.7 + r() * 0.5, a: 0.85, ph: r() * 6.283, sp: 0.2 + r() * 0.2, c: '255,236,244', big: true });
  }

  const DEPTH = [0.012, 0.03, 0.06];
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!tex) return;
    const t = time; // Stop advancing while paused; preserve the current composition.
    const sy = Math.min(scrollY, 4000);
    ctx.globalCompositeOperation = 'screen';
    // two drifting nebula layers
    const layers = [
      { img: tex, s: 1.25, ox: 0, oy: 0, dx: 0.9, dy: 0.5, par: 14, sc: 0.012, al: 0.82, ph: 0 },
      { img: texB, s: 1.7, ox: 0.3, oy: 0.25, dx: -0.7, dy: 0.4, par: 26, sc: 0.02, al: 0.5, ph: 2 }
    ];
    const breathe = 1 + Math.sin(t * 0.15) * 0.04;
    for (const L of layers) {
      const asp = L.img.width / L.img.height;
      let dh = Math.max(h, w / asp) * L.s, dw = dh * asp;
      const cxp = (w - dw) / 2 + Math.sin(t * 0.021 * L.dx + L.ph) * w * 0.03 + t * 0.0 - mx * L.par;
      const cyp = (h - dh) / 2 + Math.cos(t * 0.017 * L.dy + L.ph) * h * 0.03 - my * L.par - sy * L.sc;
      ctx.globalAlpha = L.al * breathe;
      ctx.drawImage(L.img, cxp, cyp, dw, dh);
    }
    ctx.globalAlpha = 1;
    // stars
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      const dp = DEPTH[s.layer];
      let x = (s.x * w - mx * 40 * (s.layer + 1) * 0.35 + w * 4) % w;
      let y = ((s.y * h - sy * dp * 3 - my * 40 * (s.layer + 1) * 0.35) % h + h) % h;
      const tw = 0.82 + 0.18 * Math.sin(t * s.sp + s.ph);
      const a = s.a * tw;
      ctx.fillStyle = 'rgba(' + s.c + ',' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, s.s, 0, 6.2832); ctx.fill();
      if (s.big) {
        const R = 11 * s.s;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, 'rgba(255,225,238,' + (a * 0.35).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,225,238,0)');
        ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
        ctx.strokeStyle = 'rgba(255,225,238,' + (a * 0.22).toFixed(3) + ')'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x - R * 2.4, y); ctx.lineTo(x + R * 2.4, y); ctx.moveTo(x, y - R * 2.4); ctx.lineTo(x, y + R * 2.4); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function running() { return !['covering', 'revealing'].includes(document.documentElement.dataset.pixelTransition) && !['loading', 'revealing'].includes(document.documentElement.dataset.bootState) && !document.hidden && !paused && !reduced && !!tex; }
  function loop(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(loop);
    if (now - last < 41.6) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
    mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
    render();
  }
  function sync() {
    if (running()) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    else { if (raf) { cancelAnimationFrame(raf); raf = 0; } render(); }
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    render();
  }

  function init() {
    const tw = mobile ? 448 : 640, th = mobile ? 280 : 400;
    tex = buildTexture(tw, th, 1337);
    texB = buildTexture(Math.round(tw * 0.75), Math.round(th * 0.75), 7741);
    buildStars();
    resize();
    host.classList.add('nebula-ready');
    sync();
  }

  window.addEventListener('resize', () => { const m = mqMobile.matches; if (m !== mobile && tex) { mobile = m; buildStars(); } resize(); }, { passive: true });
  window.addEventListener('scroll', () => { scrollY = window.scrollY || 0; if (!running() && !document.hidden) render(); }, { passive: true });
  window.addEventListener('pointermove', e => {
    if (!mqFine.matches || reduced || paused || e.pointerType === 'touch') return;
    tx = e.clientX / Math.max(1, w) - 0.5; ty = e.clientY / Math.max(1, h) - 0.5;
  }, { passive: true });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('portfolio:booted', sync);
  window.addEventListener('portfolio:transition-start', () => { if (raf) cancelAnimationFrame(raf); raf = 0; });
  window.addEventListener('portfolio:transition-idle', sync);
  window.addEventListener('portfolio:motion', e => { paused = !!(e.detail && e.detail.paused); sync(); });
  const onReduce = e => { reduced = e.matches; if (reduced) { tx = ty = mx = my = 0; } sync(); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce); else if (mqReduce.addListener) mqReduce.addListener(onReduce);

  const queueTexture = () => { if (window.requestIdleCallback) window.requestIdleCallback(init, { timeout: 400 }); else setTimeout(init, 30); };
  const start = () => {
    if (['covering', 'revealing'].includes(document.documentElement.dataset.pixelTransition)) window.addEventListener('portfolio:transition-idle', queueTexture, { once: true });
    else queueTexture();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
