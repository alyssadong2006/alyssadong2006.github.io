const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionButtons = [...document.querySelectorAll('#motion-toggle, .motion-shortcut')];
const pulseButton = document.querySelector('#pulse-control');
const showerButton = document.querySelector('#shower-control');
const effectsStatus = document.querySelector('#effects-status');
let feedbackTimer = 0;
let pulseCount = 0, coreBusy = false, recoveryTimer = 0;
let manuallyPaused = false;
function updateMotion() {
  const paused = manuallyPaused || reducedMotion.matches;
  document.body.classList.toggle('motion-paused', paused);
  for (const button of motionButtons) {
    button.setAttribute('aria-pressed', String(paused));
    button.innerHTML = paused ? 'Motion off <span aria-hidden="true">▷</span>' : 'Pause motion <span aria-hidden="true">Ⅱ</span>';
    button.disabled = reducedMotion.matches;
    button.title = reducedMotion.matches ? 'Reduced motion is enabled in your device settings' : '';
  }
  for (const button of [pulseButton, showerButton]) if (button) {
    button.disabled = paused || (button === pulseButton && coreBusy);
    button.title = paused ? 'Motion is turned off' : coreBusy && button === pulseButton ? 'The planet is reforming' : '';
  }
  clearTimeout(feedbackTimer);
  if (effectsStatus) effectsStatus.textContent = paused ? 'MOTION OFF / STATIC OBSERVATION' : '';
  if (paused) document.querySelectorAll('.project-card').forEach(card => {
    card.style.removeProperty('--tilt-x');
    card.style.removeProperty('--tilt-y');
  });
  window.dispatchEvent(new CustomEvent('portfolio:motion', { detail: { paused } }));
}
motionButtons.forEach(button => button.addEventListener('click', () => { manuallyPaused = !manuallyPaused; updateMotion(); }));
reducedMotion.addEventListener('change', updateMotion);
updateMotion();

// The content is visible without JavaScript. Only opt into scroll choreography
// after the observer exists, so a missing API never hides the portfolio.
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.06 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  document.documentElement.classList.add('js-ready');
}

const cards = [...document.querySelectorAll('.project-card')];
const filters = [...document.querySelectorAll('[data-filter]')];
filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(filter => {
    const active = filter === button;
    filter.classList.toggle('is-active', active);
    filter.setAttribute('aria-pressed', String(active));
  });
  let count = 0;
  cards.forEach(card => {
    const visible = button.dataset.filter === 'all' || card.dataset.category.split(' ').includes(button.dataset.filter);
    card.hidden = !visible;
    if (visible) { count++; card.classList.add('is-visible'); }
  });
  const counter = document.querySelector('#project-count');
  if (counter) counter.textContent = `${count} PROJECT${count === 1 ? '' : 'S'}`;
  updateScroll();
}));

let scrollQueued = false;
function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  document.querySelector('.scroll-progress')?.style.setProperty('transform', `scaleX(${max > 0 ? scrollY / max : 0})`);
  // Let the artwork recede as the reading-focused sections enter.
  document.documentElement.style.setProperty('--scene-opacity', String(Math.max(0.2, 1 - scrollY / (innerHeight * 0.9))));
  scrollQueued = false;
}
window.addEventListener('scroll', () => {
  if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScroll); }
}, { passive: true });
window.addEventListener('resize', updateScroll);
updateScroll();

function sendEffect(event, message) {
  if (document.body.classList.contains('motion-paused')) return;
  window.dispatchEvent(new CustomEvent(event));
  if (effectsStatus) effectsStatus.textContent = message;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { if (effectsStatus) effectsStatus.textContent = ''; }, 2200);
}
function coreReformed() {
  clearTimeout(recoveryTimer);
  clearTimeout(feedbackTimer);
  coreBusy = false; pulseCount = 0;
  const paused = document.body.classList.contains('motion-paused');
  if (pulseButton) { pulseButton.disabled = paused; pulseButton.title = paused ? 'Motion is turned off' : ''; }
  if (!paused && effectsStatus) {
    effectsStatus.textContent = 'POLARIZZZZ REFORMED / CORE STABLE';
    feedbackTimer = setTimeout(() => { effectsStatus.textContent = ''; }, 2400);
  }
}
window.addEventListener('portfolio:reformed', coreReformed);
pulseButton?.addEventListener('click', () => {
  if (coreBusy || document.body.classList.contains('motion-paused')) return;
  if (document.documentElement.dataset.sceneMode === 'constellation') setSceneMode('planet');
  pulseCount++;
  if (pulseCount < 3) {
    sendEffect('portfolio:pulse', `CORE PRESSURE / ${pulseCount} OF 3 PULSES`);
    return;
  }
  coreBusy = true;
  pulseButton.disabled = true;
  pulseButton.title = 'The planet is reforming';
  clearTimeout(feedbackTimer);
  if (effectsStatus) effectsStatus.textContent = 'CONTAINMENT LOST / REFORMING CORE…';
  // A fallback still recovers the button if WebGL is unavailable.
  clearTimeout(recoveryTimer);
  recoveryTimer = setTimeout(coreReformed, 6000);
  window.dispatchEvent(new CustomEvent('portfolio:pulse'));
  window.dispatchEvent(new CustomEvent('portfolio:explode'));
});
showerButton?.addEventListener('click', () => sendEffect('portfolio:shower', 'METEOR ACTIVITY / LOOK UP'));

const modeButtons = [...document.querySelectorAll('button[data-scene-mode]')];
function setSceneMode(mode) {
  for (const button of modeButtons) {
    const active = button.dataset.sceneMode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  const caption = document.querySelector('#model-caption');
  if (caption) caption.textContent = mode === 'constellation' ? 'FELINE MAP / AL-0527 LOCATED' : 'POLARIZZZZ / LIVE ORBIT';
  window.dispatchEvent(new CustomEvent('portfolio:mode', { detail: { mode } }));
}
modeButtons.forEach(button => button.addEventListener('click', () => setSceneMode(button.dataset.sceneMode)));
const zoomButtons = [...document.querySelectorAll('button[data-zoom]')];
zoomButtons.forEach(button => button.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('portfolio:zoom', { detail: { direction: button.dataset.zoom } }));
}));
window.addEventListener('portfolio:zoomstate', event => {
  const d = event.detail, focused = document.activeElement;
  for (const button of zoomButtons) {
    const zin = button.dataset.zoom === 'in';
    const can = zin ? d.canZoomIn : d.canZoomOut;
    button.disabled = !can;
    button.title = !d.available ? '3D view unavailable' : d.locked ? 'Zoom resumes when the planet reforms'
      : !can ? (zin ? 'Maximum zoom' : 'Minimum zoom') : zin ? 'Zoom in (+)' : 'Zoom out (−)';
  }
  // A button that just hit its limit must not strand keyboard focus.
  if (focused && zoomButtons.includes(focused) && focused.disabled) {
    (zoomButtons.find(b => !b.disabled) || document.querySelector('.planet-model-stage'))?.focus({ preventScroll: true });
  }
});
document.querySelector('.reset-view')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('portfolio:reset')));
document.querySelector('.planet-analysis')?.addEventListener('toggle', event => {
  if (event.target.open && document.documentElement.dataset.sceneMode === 'constellation') setSceneMode('planet');
});

// Fine pointers only; no persistent loop or mobile scroll interception.
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
cards.forEach(card => {
  let rect, frame = 0;
  const reset = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    card.style.removeProperty('--tilt-x');
    card.style.removeProperty('--tilt-y');
  };
  card.addEventListener('pointerenter', () => { rect = card.getBoundingClientRect(); });
  card.addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType === 'touch' || document.body.classList.contains('motion-paused')) return;
    if (frame) cancelAnimationFrame(frame);
    const x = event.clientX, y = event.clientY;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (document.body.classList.contains('motion-paused')) return;
      rect ||= card.getBoundingClientRect();
      const dx = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      const dy = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
      card.style.setProperty('--light-x', `${dx * 100}%`);
      card.style.setProperty('--light-y', `${dy * 100}%`);
      card.style.setProperty('--tilt-x', `${(0.5 - dy) * 2}deg`);
      card.style.setProperty('--tilt-y', `${(dx - 0.5) * 2}deg`);
    });
  }, { passive: true });
  card.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
});
const year = document.querySelector('#current-year');
if (year) year.textContent = new Date().getFullYear();
