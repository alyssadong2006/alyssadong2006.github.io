(() => {
  'use strict';
  const body = document.body, mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = body.classList.contains('motion-paused'), timers = {}, el = null;
  const blocked = () => paused || document.hidden || mq.matches;
  function build() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'impact-fx';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i class="ifx-wash"></i><i class="ifx-glow"></i><i class="ifx-ring ifx-ring1"></i><i class="ifx-ring ifx-ring2"></i>';
    body.appendChild(el);
    return el;
  }
  function center() {
    const s = document.querySelector('.planet-model-stage'), r = s && s.getBoundingClientRect();
    if (r && r.width && r.height) return [r.left + r.width / 2, r.top + r.height / 2];
    return [innerWidth / 2, innerHeight / 2];
  }
  function clear() {
    for (const k in timers) clearTimeout(timers[k]);
    timers = {};
    body.classList.remove('page-pulsing', 'page-exploding');
    if (el) el.className = 'impact-fx';
  }
  function fire(kind, cls, bodyCls, ms) {
    if (blocked()) return;
    const o = build(), [x, y] = center();
    o.style.setProperty('--ix', x + 'px');
    o.style.setProperty('--iy', y + 'px');
    if (kind === 'boom') { body.classList.remove('page-pulsing'); clearTimeout(timers.pulse); }
    else if (body.classList.contains('page-exploding')) return;
    clearTimeout(timers[kind]);
    o.className = 'impact-fx';
    body.classList.remove(bodyCls);
    void o.offsetWidth;
    o.classList.add('on', cls);
    body.classList.add(bodyCls);
    timers[kind] = setTimeout(() => {
      body.classList.remove(bodyCls);
      if (kind === 'boom' || !body.classList.contains('page-exploding')) o.className = 'impact-fx';
    }, ms);
  }
  window.addEventListener('portfolio:pulse', () => fire('pulse', 'pulse', 'page-pulsing', 900));
  window.addEventListener('portfolio:explode', () => fire('boom', 'boom', 'page-exploding', 1550));
  window.addEventListener('portfolio:motion', e => { paused = !!(e.detail && e.detail.paused); if (blocked()) clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  const onMq = () => { if (mq.matches) clear(); };
  mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq);
})();
