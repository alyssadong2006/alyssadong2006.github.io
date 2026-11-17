/* Report panel decoration + short pixel-dissolve on entry. Enhancement only; no RAF idle loops. */
(() => {
  'use strict';
  const panels = Array.from(document.querySelectorAll('.report-panel'));
  if (!panels.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const LABELS = { projects: 'Research Archive', experience: 'Field Operations', about: 'Crew Profile', hobbies: 'Off-duty Observations', contact: 'Comms Channel' };
  const DUR = 900, COOLDOWN = 4000;
  let paused = document.body.classList.contains('motion-paused');
  const state = new Map();
  const off = () => paused || mq.matches || document.hidden;

  function schematic() {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 200 120');
    s.setAttribute('class', 'rp-schematic');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<g class="draw" pathLength="1"><circle cx="100" cy="60" r="18" pathLength="1"/><ellipse class="orb" cx="100" cy="60" rx="80" ry="30" pathLength="1" transform="rotate(-18 100 60)"/></g>' +
      '<g class="draw"><circle class="orb" cx="100" cy="60" r="46" pathLength="1"/><path d="M8 108H192M8 104V112M60 105V111M112 105V111M164 105V111M192 104V112" pathLength="1"/></g>' +
      '<circle class="dot" cx="100" cy="60" r="3"/><circle class="dot" cx="172" cy="38" r="3"/>';
    s.querySelectorAll('[pathLength]').forEach(p => p.setAttribute('class', (p.getAttribute('class') || '') + ' draw'));
    return s;
  }

  function decorate(p, idx) {
    const d = document.createElement('div');
    d.className = 'rp-deco';
    d.setAttribute('aria-hidden', 'true');
    const grid = document.createElement('div'); grid.className = 'rp-grid';
    const rail = document.createElement('div'); rail.className = 'rp-rail';
    const b = document.createElement('b');
    b.textContent = 'Report ' + String(idx + 1).padStart(2, '0') + ' // ' + (LABELS[p.id] || 'Data');
    const line = document.createElement('i');
    rail.append(b, line);
    const tr = document.createElement('span'); tr.className = 'rp-reg tr';
    const bl = document.createElement('span'); bl.className = 'rp-reg bl';
    const sweep = document.createElement('div'); sweep.className = 'rp-sweep';
    d.append(grid, rail, tr, bl, schematic(), sweep);
    p.insertBefore(d, p.firstChild);
    return d;
  }

  function rgb(p) {
    const v = getComputedStyle(p).getPropertyValue('--rp-a').trim().split(',').map(Number);
    return v.length === 3 && v.every(n => !isNaN(n)) ? v : [239, 184, 204];
  }

  function clearOverlay(p) {
    const st = state.get(p);
    if (!st) return;
    if (st.raf) cancelAnimationFrame(st.raf);
    if (st.timer) clearTimeout(st.timer);
    st.raf = st.timer = 0;
    if (st.canvas) { st.canvas.remove(); st.canvas = null; }
    p.classList.remove('rp-enter');
  }

  function play(p) {
    const st = state.get(p);
    if (off() || !st) return;
    p.classList.remove('rp-leave');
    const now = performance.now();
    if (now - st.last < COOLDOWN) return;
    st.last = now;
    clearOverlay(p);
    p.classList.remove('rp-leave');
    void p.offsetWidth;
    p.classList.add('rp-enter');
    const w = p.clientWidth, h = p.clientHeight;
    const tile = Math.max(18, Math.ceil(Math.max(w, h) / 48));
    const cols = Math.ceil(w / tile), rows = Math.ceil(h / tile);
    const cv = document.createElement('canvas');
    cv.className = 'rp-canvas';
    cv.setAttribute('aria-hidden', 'true');
    cv.width = cols; cv.height = rows; // one pixel per tile, scaled up crisp
    cv.style.imageRendering = 'pixelated';
    const ctx = cv.getContext('2d');
    if (!ctx) { p.classList.remove('rp-enter'); return; }
    st.deco.appendChild(cv);
    st.canvas = cv;
    const [r, g, b] = rgb(p);
    const thr = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      // left-to-right sweep with column-structured jitter
      thr[y * cols + x] = (x / cols) * 0.7 + Math.random() * 0.3;
    }
    const t0 = performance.now();
    const step = t => {
      if (off() || !st.canvas) { clearOverlay(p); return; }
      const k = Math.min(1, (t - t0) / DUR);
      ctx.clearRect(0, 0, cols, rows);
      // frontier band: tiles whose threshold is near k are lit, then resolve
      for (let i = 0; i < thr.length; i++) {
        const dlt = k * 1.25 - thr[i];
        if (dlt > 0 && dlt < 0.22) {
          ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.28 * (1 - dlt / 0.22)).toFixed(3) + ')';
          ctx.fillRect(i % cols, (i / cols) | 0, 1, 1);
        }
      }
      if (k < 1) st.raf = requestAnimationFrame(step); else clearOverlay(p);
    };
    st.raf = requestAnimationFrame(step);
    st.timer = setTimeout(() => clearOverlay(p), DUR + 300);
  }

  function stopAll() { panels.forEach(clearOverlay); }

  panels.forEach((p, i) => state.set(p, { deco: decorate(p, i), last: -1e9, raf: 0, timer: 0, canvas: null }));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) play(e.target);
        else if (!off()) { e.target.classList.add('rp-leave'); }
      });
    }, { threshold: 0.12 });
    panels.forEach(p => io.observe(p));
  }

  window.addEventListener('portfolio:motion', e => {
    paused = !!(e.detail && e.detail.paused);
    if (paused) stopAll();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
  const onMq = () => { if (mq.matches) stopAll(); };
  if (mq.addEventListener) mq.addEventListener('change', onMq);
  else if (mq.addListener) mq.addListener(onMq);
  if (off()) stopAll();
})();
