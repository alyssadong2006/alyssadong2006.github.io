// Muted rose/lavender pixel wipes for same-tab site navigation only.
const root = document.documentElement;
const RECEIPT_KEY = 'portfolio:pt-arrival';
const COVER_MS = 140, REVEAL_MS = 220, NAV_COVER_MS = 90, NAV_REVEAL_MS = 180, MAX_TILES = 600, ARRIVAL_MAX_MS = 650;
const reduceMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;

let canvas = null, ctx = null, tiles = [], cols = 0, rows = 0, size = 0;
let level = 0, target = 0, dur = COVER_MS, raf = 0, last = 0, onDone = null;
let action = null, disposed = false, seq = 0, arrivalTimer = 0;
let region = null; // null = full viewport, else {left,top,width,height}

const noMotion = () =>
  !!(reduceMQ && reduceMQ.matches) || !!(document.body && document.body.classList.contains('motion-paused'));
const setState = s => {
  const previous = root.dataset.pixelTransition;
  root.dataset.pixelTransition = s;
  if (s === 'idle' && previous && previous !== 'idle') window.dispatchEvent(new Event('portfolio:transition-idle'));
  else if (s !== 'idle' && (!previous || previous === 'idle')) window.dispatchEvent(new Event('portfolio:transition-start'));
};
setState('idle');

function buildGrid() {
  const w = region ? region.width : root.clientWidth || innerWidth;
  const h = region ? region.height : root.clientHeight || innerHeight;
  size = Math.max(16, Math.ceil(Math.sqrt((w * h) / 500)));
  cols = Math.ceil(w / size); rows = Math.ceil(h / size);
  while (cols * rows > MAX_TILES) { size++; cols = Math.ceil(w / size); rows = Math.ceil(h / size); }
  canvas.width = w; canvas.height = h;
  const s = canvas.style;
  s.left = (region ? region.left : 0) + 'px'; s.top = (region ? region.top : 0) + 'px';
  s.width = w + 'px'; s.height = h + 'px';
  const base = [68, 52, 72], rose = [220, 188, 207], lav = [205, 192, 223];
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  tiles = [];
  for (let i = 0; i < cols * rows; i++) {
    const tint = Math.random() < 0.5 ? rose : lav, r = Math.random();
    tiles.push({
      t: Math.random() * 0.92,
      c: mix(base, tint, 0.2 + 0.16 * r * r),
      e: mix(base, tint, 0.38 + 0.1 * Math.random()), // soft dusty highlight, not a bright flash
    });
  }
}

function draw() {
  if (!ctx) return;
  ctx.fillStyle = '#6b566e';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (level >= 1) { ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
  for (let i = 0; i < tiles.length; i++) {
    const k = tiles[i];
    if (k.t >= level) continue;
    ctx.fillStyle = level - k.t < 0.14 ? k.e : k.c;
    ctx.fillRect((i % cols) * size, Math.floor(i / cols) * size, size, size);
  }
}

function ensureCanvas(r) {
  if (canvas) return;
  region = r || null;
  canvas = document.createElement('canvas');
  canvas.className = 'pixel-transition';
  canvas.setAttribute('aria-hidden', 'true');
  (document.body || root).appendChild(canvas);
  ctx = canvas.getContext('2d');
  if (!ctx) { removeCanvas(); return; }
  buildGrid();
}

function removeCanvas() {
  cancelAnimationFrame(raf); raf = 0; onDone = null;
  if (canvas) canvas.remove();
  canvas = ctx = null; level = 0; target = 0; region = null;
  setState('idle');
}

function animate(to, ms, done) {
  cancelAnimationFrame(raf);
  canvas?.classList.remove('is-arriving');
  target = to; dur = ms; onDone = done; last = performance.now();
  const from = level;
  setState(to === 1 ? 'covering' : 'revealing');
  const step = now => {
    if (!canvas) return;
    const progress = Math.min(1, (now - last) / dur);
    level = from + (target - from) * progress;
    if (progress === 1) level = target;
    draw();
    if (level === target) {
      raf = 0; const cb = onDone; onDone = null;
      if (target === 0) removeCanvas();
      if (cb) cb();
    } else raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

function reveal(id, ms = REVEAL_MS) {
  if (id !== seq || !canvas) return;
  animate(0, ms);
}

// ---- actions -------------------------------------------------------------
function commitAction(a) {
  if (!a || a.committed) return;
  a.committed = true;
  a.commit();
}

function finishAbort(allowNav) {
  seq++;
  const a = action; action = null;
  clearTimeout(arrivalTimer);
  removeCanvas();
  if (a && !a.committed) {
    if (disposed || (a.kind === 'nav' && !allowNav)) return;
    commitAction(a);
  }
}

function start(a, rect) {
  if (disposed) return;
  const prev = action;
  if (prev && !prev.committed) prev.committed = true; // drop superseded intent; last click wins
  action = a;
  const id = ++seq;
  if (canvas && (rect ? !region : !!region)) { removeCanvas(); } // different footprint
  ensureCanvas(rect);
  if (!canvas) { action = null; commitAction(a); return; }
  animate(1, (a.kind === 'nav' ? NAV_COVER_MS : COVER_MS) * (1 - level) + 1, () => {
    if (id !== seq || disposed) return;
    commitAction(a);
    if (a.kind === 'nav') {
      // Keep fully covered until the next page loads; failsafe if navigation never happens.
      setTimeout(() => { if (id === seq && !disposed) { action = null; reveal(id); } }, ARRIVAL_MAX_MS);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => { if (id === seq) { action = null; reveal(id); } }));
    }
  });
}

// Observatory buttons keep their original native smooth-mode handler.

// ---- links ---------------------------------------------------------------
function focusTarget(el) {
  if (!el) return;
  if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName)) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
  }
  try { el.focus({ preventScroll: true }); } catch { /* ignore */ }
}

function hashTarget(hash) {
  if (!hash || hash === '#') return null;
  try {
    const id = decodeURIComponent(hash.slice(1));
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  } catch { return null; }
}

function jumpHash(url, push) {
  const el = hashTarget(url.hash);
  if (push) history.pushState(history.state, '', url.href);
  if (el) { el.scrollIntoView({ behavior: 'instant', block: 'start' }); focusTarget(el); }
  else scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

function navigate(url) {
  try {
    sessionStorage.setItem(RECEIPT_KEY, JSON.stringify({ p: url.pathname, s: url.search, h: url.hash, t: Date.now() }));
  } catch { /* blocked storage: still navigate */ }
  location.assign(url.href);
}

document.addEventListener('click', e => {
  if (e.defaultPrevented || disposed || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!a || !a.matches('.site-header a, .archive-back, .button-primary, .workflow-callout, .workflow-return')) return;
  if (a.closest('.skip-link') || a.matches('.skip-link, [class*="skip"]')) return;
  if (a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
  let url;
  try { url = new URL(a.href, location.href); } catch { return; }
  if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) return;
  if (noMotion()) return;
  const sameDoc = url.pathname === location.pathname && url.search === location.search;
  if (sameDoc) {
    if (!url.hash || (url.hash !== '#' && !hashTarget(url.hash))) return;
    if (url.hash === location.hash) return;
    e.preventDefault();
    start({ kind: 'hash', committed: false, commit: () => jumpHash(url, true) });
  } else {
    e.preventDefault();
    start({ kind: 'nav', committed: false, commit: () => { if (!disposed) navigate(url); } });
  }
});

// Warm the next HTML document on intent; do not fetch PDFs/external destinations.
const prefetched = new Set();
function prefetchLink(event) {
  if (navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || '')) return;
  const link = event.target instanceof Element ? event.target.closest('.site-header a, .archive-back, .workflow-callout, .workflow-return') : null;
  if (!link) return;
  let url; try { url = new URL(link.href); } catch { return; }
  if (url.origin !== location.origin || !/\/(?:index|projects|resume|ai-workflow)\.html$/.test(url.pathname)) return;
  if (url.pathname === location.pathname && url.search === location.search) return;
  url.hash = '';
  if (prefetched.has(url.href)) return;
  prefetched.add(url.href);
  const hint = document.createElement('link'); hint.rel = 'prefetch'; hint.as = 'document'; hint.href = url.href;
  document.head.appendChild(hint);
}
document.addEventListener('pointerover', prefetchLink, { passive: true });
document.addEventListener('focusin', prefetchLink);

// ---- arrival reveal ------------------------------------------------------
function arrival() {
  let raw = null;
  try { raw = sessionStorage.getItem(RECEIPT_KEY); sessionStorage.removeItem(RECEIPT_KEY); } catch { return; }
  if (!raw || noMotion()) return;
  let r; try { r = JSON.parse(raw); } catch { return; }
  if (!r || typeof r.t !== 'number' || Date.now() - r.t > 5000 || Date.now() < r.t) return;
  if (r.p !== location.pathname || r.s !== location.search || r.h !== location.hash) return;
  // Land on the requested section under the mosaic, not in a second smooth scroll.
  if (r.h) jumpHash(new URL(location.href), false);
  ensureCanvas(null); if (!canvas) return;
  // Rasterize the mosaic once. Animate opacity on the compositor instead of
  // redrawing a full-screen canvas every frame while a new document lays out.
  level = .88; draw(); setState('revealing');
  const id = ++seq;
  const finish = () => { if (id !== seq) return; clearTimeout(arrivalTimer); removeCanvas(); };
  canvas.addEventListener('animationend', event => { if (event.animationName === 'pixel-arrival') finish(); }, { once: true });
  canvas.classList.add('is-arriving');
  arrivalTimer = setTimeout(finish, NAV_REVEAL_MS + 80);
}
try { arrival(); } catch { removeCanvas(); }

// ---- cancellation --------------------------------------------------------
const abortNow = () => { if (canvas || action) finishAbort(true); };
reduceMQ && (reduceMQ.addEventListener ? reduceMQ.addEventListener('change', abortNow) : reduceMQ.addListener(abortNow));
window.addEventListener('portfolio:motion', () => { if (noMotion()) abortNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) abortNow(); });
window.addEventListener('pagehide', () => { disposed = true; finishAbort(false); });
window.addEventListener('pageshow', e => {
  if (e.persisted) { disposed = false; seq++; action = null; removeCanvas(); }
});
window.addEventListener('resize', () => { if (canvas) { buildGrid(); draw(); } });
const observeMotion = () => {
  if (document.body) new MutationObserver(() => { if (noMotion()) abortNow(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeMotion, { once: true });
else observeMotion();
