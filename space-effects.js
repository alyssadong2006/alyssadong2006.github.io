// Meteors + comet-like pointer trail on one bounded, decorative canvas.
(() => {
  'use strict';
  const MAX_METEORS = 12, MAX_PARTICLES = 60, MAX_SPARKLES = 48, MAX_POINTS = 35, TRAIL_MS = 650, DPR_CAP = 1.5;
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fineMq = window.matchMedia('(pointer: fine)');
  const mobileMq = window.matchMedia('(max-width: 720px)');
  let canvas, ctx, w = 0, h = 0, dpr = 1;
  let paused = false, enabled = false, raf = 0, timer = 0, last = 0;
  const meteors = [], particles = [], sparkles = [];
  let points = [], sparkleDistance = 0, lastSparkle = 0;
  const SPARKLE_COLORS = ['255,241,247', '240,191,213', '213,195,235'];
  const COLORS = ['255,255,255', '255,214,196', '255,170,205', '255,196,224'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];

  function shouldRun() { return !paused && !reduceMq.matches && !document.hidden; }
  function shouldBeEnabled() { return !paused && !reduceMq.matches; }

  function ensureCanvas() {
    if (canvas) return !!ctx;
    if (!document.body) return false;
    canvas = document.createElement('canvas');
    canvas.id = 'space-effects';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:110;background:transparent;display:none';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    return !!ctx;
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    clearTrail();
  }
  function clearCanvas() { if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); } }
  function scrollFactor() {
    const y = window.pageYOffset || document.documentElement.scrollTop || 0;
    return Math.max(0.25, 1 - (y / Math.max(1, h)) * 0.75);
  }

  function spawnMeteor(delay) {
    if (meteors.length >= MAX_METEORS) return;
    const ang = rnd(Math.PI * 0.62, Math.PI * 0.78); // down-left
    const speed = rnd(550, 900) * (mobileMq.matches ? 0.7 : 1);
    meteors.push({
      x: rnd(w * 0.2, w * 1.1), y: rnd(-60, h * 0.35),
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      len: rnd(90, 190), width: rnd(0.8, 1.6), color: pick(COLORS),
      age: -(delay || 0), life: rnd(0.9, 1.5)
    });
    kick();
  }
  function shower() {
    const n = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) spawnMeteor(i * rnd(0.12, 0.35));
  }
  function addParticle(x, y, vx, vy, life, size) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ x, y, vx, vy, age: 0, life, size, color: pick(COLORS) });
  }

  function addSparkle(x, y) {
    if (sparkles.length >= MAX_SPARKLES) sparkles.shift();
    sparkles.push({
      x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-6, 6), vy: rnd(-14, 6),
      age: 0, life: rnd(0.55, 0.95), size: rnd(2, 4.6), angle: rnd(0, Math.PI),
      color: pick(SPARKLE_COLORS), star: Math.random() < 0.75,
    });
  }

  function schedule() {
    clearTimeout(timer); timer = 0;
    if (!enabled || !shouldRun()) return;
    const base = mobileMq.matches ? 6000 : 3000;
    timer = setTimeout(() => {
      timer = 0;
      if (!enabled || !shouldRun()) return;
      if (Math.random() < 0.15) shower(); else spawnMeteor(0);
      schedule();
    }, base * rnd(0.7, 1.4));
  }
  function kick() { if (!raf && enabled && shouldRun()) { last = 0; raf = requestAnimationFrame(frame); } }

  function frame(now) {
    raf = 0;
    if (!enabled || !shouldRun()) return;
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0.016;
    last = now;
    const t = performance.now();
    // update
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]; m.age += dt;
      if (m.age > 0) { m.x += m.vx * dt; m.y += m.vy * dt; }
      if (m.age > m.life || m.x < -300 || m.y > h + 300) meteors.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.97; p.vy *= 0.97;
      if (p.age > p.life) particles.splice(i, 1);
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i]; s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.age >= s.life) sparkles.splice(i, 1);
    }
    while (points.length && t - points[0].t > TRAIL_MS) points.shift();
    // draw
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    const sf = scrollFactor();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of meteors) {
      if (m.age <= 0) continue;
      const k = m.age / m.life, a = Math.sin(Math.PI * Math.min(1, k)) * sf;
      const sp = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / sp) * m.len, ty = m.y - (m.vy / sp) * m.len;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`);
      g.addColorStop(0.25, `rgba(${m.color},${0.5 * a})`);
      g.addColorStop(1, `rgba(255,150,200,0)`);
      ctx.strokeStyle = g; ctx.lineWidth = m.width;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.width * 0.9, 0, 6.2832); ctx.fill();
    }
    // pointer trail: tapered, smoothed with midpoints
    const n = points.length;
    if (n > 1) {
      for (let i = 1; i < n; i++) {
        const p0 = points[i - 1], p1 = points[i];
        const f = Math.max(0, 1 - (t - p1.t) / TRAIL_MS), u = i / n;
        const mx0 = i > 1 ? (points[i - 2].x + p0.x) / 2 : p0.x, my0 = i > 1 ? (points[i - 2].y + p0.y) / 2 : p0.y;
        const mx1 = (p0.x + p1.x) / 2, my1 = (p0.y + p1.y) / 2;
        ctx.strokeStyle = `rgba(${u > 0.7 ? '255,240,236' : '255,185,210'},${0.65 * f * u * sf})`;
        ctx.lineWidth = 0.4 + 2.2 * u * f;
        ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.quadraticCurveTo(p0.x, p0.y, mx1, my1); ctx.stroke();
      }
    }
    for (const p of particles) {
      const a = (1 - p.age / p.life) * sf;
      ctx.fillStyle = `rgba(${p.color},${0.7 * a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, 6.2832); ctx.fill();
    }
    // One soft twinkle per sparkle, with no sharp flashes or extra animation loop.
    for (const s of sparkles) {
      const progress = s.age / s.life;
      const a = Math.sin(Math.PI * progress) * (1 - progress * 0.25);
      const r = s.size * (0.7 + 0.3 * a);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle + s.age * 0.3);
      ctx.fillStyle = `rgba(${s.color},${0.85 * a})`;
      ctx.beginPath();
      if (s.star) {
        ctx.moveTo(0, -r); ctx.lineTo(r * 0.22, -r * 0.22);
        ctx.lineTo(r, 0); ctx.lineTo(r * 0.22, r * 0.22);
        ctx.lineTo(0, r); ctx.lineTo(-r * 0.22, r * 0.22);
        ctx.lineTo(-r, 0); ctx.lineTo(-r * 0.22, -r * 0.22); ctx.closePath();
      } else ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,249,253,${0.9 * a})`;
      ctx.beginPath(); ctx.arc(0, 0, 0.65, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (meteors.length || particles.length || sparkles.length || points.length) raf = requestAnimationFrame(frame);
    else { clearCanvas(); last = 0; }
  }

  function clearTrail() { points.length = 0; sparkles.length = 0; sparkleDistance = 0; lastSparkle = 0; }

  function onMove(e) {
    if (!enabled || !shouldRun() || e.pointerType === 'touch' || !fineMq.matches) return;
    const t = performance.now(), prev = points[points.length - 1];
    if (prev && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 3) return;
    points.push({ x: e.clientX, y: e.clientY, t });
    if (points.length > MAX_POINTS) points.shift();
    if (prev) sparkleDistance += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    if (prev && sparkleDistance >= 12 && t - lastSparkle >= 24) {
      const count = Math.min(3, Math.floor(sparkleDistance / 12));
      for (let i = 0; i < count; i++) {
        const along = (i + 0.5) / count;
        addSparkle(prev.x + (e.clientX - prev.x) * along, prev.y + (e.clientY - prev.y) * along);
      }
      sparkleDistance = 0; lastSparkle = t;
    }
    kick();
  }
  function onDown(e) {
    if (!enabled || !shouldRun() || e.pointerType === 'touch' || !fineMq.matches || e.button > 0) return;
    const el = e.target;
    if (el && el.closest && el.closest('a,button,summary,details,input,select,textarea,label,[role="button"],[tabindex]')) return;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.2832 + rnd(-0.2, 0.2), s = rnd(40, 110);
      addParticle(e.clientX, e.clientY, Math.cos(a) * s, Math.sin(a) * s, rnd(0.4, 0.7), rnd(0.8, 1.4));
    }
    kick();
  }

  function applyState() {
    const want = shouldBeEnabled();
    if (want && !enabled) {
      if (!ensureCanvas()) return;
      enabled = true; resize(); canvas.style.display = '';
    } else if (!want && enabled) {
      enabled = false;
    }
    if (!enabled) {
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(timer); timer = 0;
      meteors.length = 0; particles.length = 0; clearTrail();
      if (canvas) { clearCanvas(); canvas.style.display = 'none'; }
      return;
    }
    if (document.hidden) { // suspended: stop loop/timer, drop transient state
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(timer); timer = 0;
      meteors.length = 0; particles.length = 0; clearTrail(); clearCanvas();
      return;
    }
    schedule();
    if (meteors.length || particles.length || sparkles.length || points.length) kick();
  }

  function init() {
    paused = document.body.classList.contains('motion-paused');
    window.addEventListener('portfolio:motion', e => { paused = !!(e.detail && e.detail.paused); applyState(); });
    window.addEventListener('portfolio:shower', () => { if (enabled && shouldRun()) shower(); });
    window.addEventListener('portfolio:pulse', () => {
      if (!enabled || !shouldRun()) return;
      spawnMeteor(0); spawnMeteor(0.2);
    });
    const onReduce = () => applyState();
    reduceMq.addEventListener ? reduceMq.addEventListener('change', onReduce) : reduceMq.addListener(onReduce);
    document.addEventListener('visibilitychange', applyState);
    window.addEventListener('resize', () => { if (enabled) { resize(); clearTrail(); } }, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerleave', clearTrail);
    document.addEventListener('pointerleave', clearTrail);
    document.documentElement.addEventListener('mouseleave', clearTrail);
    window.addEventListener('blur', clearTrail);
    applyState();
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
