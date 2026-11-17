// A fictional local-sector scan; no asset-loading dependency or extra renderer.
const KEY = 'al-0527-scanner-v2';
const root = document.documentElement;
let storageBlocked = false;
function seen() {
  try { if (sessionStorage.getItem(KEY)) return true; } catch { storageBlocked = true; }
  if (window.__alScannerBooted) return true;
  return storageBlocked && document.referrer && new URL(document.referrer).origin === location.origin;
}
function remember() {
  window.__alScannerBooted = true;
  try { sessionStorage.setItem(KEY, '1'); } catch { /* private-storage fallback */ }
}
function startScan() {
  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches || document.body?.classList.contains('motion-paused');
  const el = document.createElement('div');
  el.id = 'al-boot';
  el.className = 'al-boot' + (quiet ? ' is-reduced' : '');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Local sector discovery scan');
  el.innerHTML = `
    <div class="scan-grid" aria-hidden="true"></div>
    <div class="scan-sweep" aria-hidden="true"></div>
    <header class="scan-header" aria-hidden="true"><span>AD / DEEP FIELD OBSERVATORY</span><span>OPTICAL ARRAY <b>0527</b></span></header>
    <div class="scan-ruler" aria-hidden="true"><span>+90</span><span>+60</span><span>+30</span><span>00</span><span>−30</span><span>−60</span></div>
    <svg class="scan-chart" viewBox="0 0 600 460" aria-hidden="true">
      <defs><pattern id="scan-dots" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r=".8" fill="#bfa0be"/></pattern></defs>
      <rect width="600" height="460" fill="url(#scan-dots)"/>
      <g class="chart-guides"><path d="M0 230H600M300 0V460"/><circle cx="300" cy="230" r="160"/><circle cx="300" cy="230" r="210"/><path d="M20 20h40m-40 0v40m560-40h-40m40 0v40M20 440h40m-40 0v-40m560 40h-40m40 0v-40"/></g>
      <g class="scan-field"><circle cx="70" cy="80" r="2"/><circle cx="110" cy="196" r="1.5"/><circle cx="560" cy="155" r="2"/><circle cx="260" cy="400" r="1.5"/><circle cx="500" cy="390" r="2"/><circle cx="230" cy="48" r="1.5"/><circle cx="75" cy="390" r="2"/></g>
      <g class="cat-detection"><path class="cat-path" d="M410 135L418 90L417 45L445 67L474 63L502 44L507 99L496 145L482 180L464 267L477 330L455 350L431 328L404 295L389 338L410 353L370 358L230 358L165 345L128 318L111 284L120 261L137 273L132 303L176 332L225 337L252 312L254 270L267 219L301 181L346 159L395 150Z"/>
      <path class="cat-internal" d="M346 159L370 358M346 159L464 267M267 219L370 358"/>
      <g class="cat-stars"><circle cx="417" cy="45" r="3"/><circle cx="502" cy="44" r="3"/><circle cx="477" cy="330" r="2.5"/><circle cx="120" cy="261" r="3"/><circle cx="230" cy="358" r="2"/><circle cx="267" cy="219" r="2"/><circle cx="464" cy="267" r="2"/><circle cx="410" cy="135" r="2"/></g></g>
      <g class="planet-detection"><circle cx="346" cy="159" r="12" class="scan-planet"/><ellipse cx="346" cy="159" rx="24" ry="7" transform="rotate(-25 346 159)"/><path d="M316 139v-10h10m40 0h10v10m0 40v10h-10m-40 0h-10v-10"/><path d="M376 149h42l18-18"/><text x="440" y="129">AL-0527</text><text x="440" y="145" class="chart-small">PLANET / NEAR FIELD</text></g>
      <g class="cat-label"><path d="M390 366v22h70"/><text x="466" y="392">MEOW</text><text x="466" y="408" class="chart-small">CONSTELLATION</text></g>
    </svg>
    <div class="scan-readout" aria-hidden="true"><div class="scan-kicker">SECTOR SWEEP / 001</div><h1>Scanning<br>the surroundings<span class="scan-cursor">_</span></h1><p class="scan-status">Resolving nearby signatures</p><div class="scan-findings"><div data-object="planet"><span>01 / PLANET</span><strong>AL-0527</strong><i>LOCATED</i></div><div data-object="cat"><span>02 / CONSTELLATION</span><strong>MEOW</strong><i>MAPPED</i></div></div></div>
    <div class="scan-telemetry" aria-hidden="true"><span>AZ <b class="scan-az">000.0°</b></span><span>FIELD <b>ROSE / PEARL</b></span><span>RETURN <b class="scan-return">SEARCHING</b></span></div>
    <footer class="scan-footer"><span aria-hidden="true">PASSIVE SENSOR / PERSONAL UNIVERSE</span><button type="button" class="al-skip">Skip scan ↗</button></footer>`;
  (document.body || root).appendChild(el);
  if (getComputedStyle(el).position !== 'fixed') { el.remove(); return; }
  root.dataset.bootState = 'loading';
  const t0 = performance.now(), scanMs = quiet ? 1550 : 2000, dissolveMs = 650;
  const status = el.querySelector('.scan-status'), heading = el.querySelector('h1'), az = el.querySelector('.scan-az'), returned = el.querySelector('.scan-return');
  let paintedPhase = -1;
  const mask = document.createElement('canvas');
  mask.width = Math.ceil(innerWidth / 2); mask.height = Math.ceil(innerHeight / 2);
  const ctx = mask.getContext('2d');
  const tiles = [];
  for (let y = 0; y < mask.height; y += 12) for (let x = 0; x < mask.width; x += 12) {
    const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    tiles.push({ x, y, order: (x / mask.width) * .55 + (hash - Math.floor(hash)) * .45 });
  }
  let interval = 0, end = 0, hard = 0, leave = 0, done = false;
  function cleanup() {
    if (done) return; done = true;
    clearInterval(interval); clearTimeout(end); clearTimeout(hard); clearTimeout(leave);
    el.removeEventListener('click', click); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', cleanup);
    el.remove(); root.dataset.bootDuration = String(Math.round(performance.now() - t0)); root.dataset.bootState = 'complete';
    requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('portfolio:booted'))));
  }
  function click(e) { if (e.target.closest('.al-skip')) cleanup(); }
  function hidden() { if (document.hidden) cleanup(); }
  function paint() {
    const elapsed = performance.now() - t0;
    const phase = quiet ? 2 : elapsed < 650 ? 0 : elapsed < 1250 ? 1 : 2;
    el.dataset.phase = String(phase);
    if (phase !== paintedPhase) {
      paintedPhase = phase;
      heading.innerHTML = ['Scanning<br>the surroundings', 'Planet<br>discovered', 'Constellation<br>discovered'][phase] + '<span class="scan-cursor">_</span>';
    }
    status.textContent = phase === 0 ? 'Resolving nearby signatures' : phase === 1 ? 'Nearby planet discovered · AL-0527' : 'Constellation discovered · MEOW';
    returned.textContent = phase === 0 ? 'SEARCHING' : phase === 1 ? '01 OBJECT' : '02 OBJECTS';
    az.textContent = (Math.min(1, elapsed / scanMs) * 127.4).toFixed(1).padStart(5, '0') + '°';
  }
  function dissolve() {
    clearInterval(interval); paint();
    if (quiet || matchMedia('(prefers-reduced-motion: reduce)').matches || document.body?.classList.contains('motion-paused') || !ctx) { cleanup(); return; }
    root.dataset.bootState = 'revealing';
    el.classList.add('is-dissolving'); status.textContent = 'Opening observation deck';
    const begin = performance.now();
    function pixels() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) { cleanup(); return; }
      const p = Math.min(1, (performance.now() - begin) / dissolveMs);
      ctx.clearRect(0, 0, mask.width, mask.height); ctx.fillStyle = '#fff';
      for (const tile of tiles) if (tile.order > p) ctx.fillRect(tile.x, tile.y, 12, 12);
      const image = `url(${mask.toDataURL()})`;
      el.style.maskImage = image; el.style.webkitMaskImage = image;
      if (p < 1) leave = setTimeout(pixels, 45); else cleanup();
    }
    pixels();
  }
  el.addEventListener('click', click); document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', cleanup);
  paint(); interval = setInterval(paint, 100); end = setTimeout(dissolve, scanMs); hard = setTimeout(cleanup, 2800);
}
try { if (!seen()) { remember(); if (performance.now() <= 2500) startScan(); } } catch { document.getElementById('al-boot')?.remove(); root.dataset.bootState = 'complete'; window.dispatchEvent(new Event('portfolio:booted')); }
