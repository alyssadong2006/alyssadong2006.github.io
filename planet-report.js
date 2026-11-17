// Native <details> remains usable without JavaScript. The scan is a fictional
// spectrometer sequence; results are local copy, not a scientific measurement.
const analysis = document.querySelector('.planet-analysis');
if (analysis) {
  const report = analysis.querySelector('.composition');
  const results = analysis.querySelector('.scan-results');
  const status = analysis.querySelector('.scan-status');
  const label = analysis.querySelector('.scan-action-label');
  const rescan = analysis.querySelector('.rescan-control');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set();
  let scanning = false;

  function clearSequence() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    scanning = false;
    window.dispatchEvent(new CustomEvent('portfolio:scan', { detail: { active: false } }));
  }

  function finishScan() {
    clearSequence();
    report.dataset.scanState = 'complete';
    results.hidden = false;
    results.setAttribute('aria-busy', 'false');
    status.textContent = 'Scan complete · 3 signatures found';
  }

  function step(delay, callback) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (analysis.open && scanning) callback();
    }, delay);
    timers.add(timer);
  }

  function startScan() {
    clearSequence();
    if (!analysis.open) return;
    // Motion off still permits reading and rescanning the report instantly.
    if (reducedMotion.matches || document.body.classList.contains('motion-paused') || document.hidden) {
      finishScan();
      return;
    }
    scanning = true;
    report.dataset.scanState = 'scanning';
    results.hidden = true;
    results.setAttribute('aria-busy', 'true');
    status.textContent = '01 / Calibrating spectrometer…';
    window.dispatchEvent(new CustomEvent('portfolio:scan', { detail: { active: true } }));
    step(550, () => { status.textContent = '02 / Reading spectral lines…'; });
    step(1150, () => { status.textContent = '03 / Resolving composition…'; });
    step(1800, finishScan);
  }

  rescan.hidden = false;
  rescan.addEventListener('click', startScan);
  analysis.addEventListener('toggle', () => {
    label.textContent = analysis.open ? 'Close report' : 'Scan composition';
    if (analysis.open) startScan();
    else {
      clearSequence();
      report.dataset.scanState = 'ready';
      results.hidden = false;
      results.setAttribute('aria-busy', 'false');
      status.textContent = 'Composition report · 3 signatures';
    }
  });
  window.addEventListener('portfolio:motion', event => {
    if (event.detail?.paused && scanning) finishScan();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && scanning) finishScan();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && scanning) finishScan();
  });
  if (analysis.open) startScan();
}
