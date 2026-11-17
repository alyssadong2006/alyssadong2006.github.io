const motion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const flowers = new Set();
const trailLayer = document.createElement('div');
trailLayer.className = 'cursor-garden-layer';
trailLayer.setAttribute('aria-hidden', 'true');
document.body.append(trailLayer);
const spacing = 80;
let lastSpawn = null;

function clearFlowers() {
  flowers.forEach((flower) => flower.remove());
  flowers.clear();
  lastSpawn = null;
}

function plantFlower(x, y) {
  const flower = document.createElement('span');
  flower.className = 'cursor-sunflower';
  flower.setAttribute('aria-hidden', 'true');
  flower.style.left = `${x}px`;
  flower.style.top = `${y}px`;
  flower.style.setProperty('--flower-size', `${44 + Math.random() * 14}px`);
  flower.style.setProperty('--flower-drift', `${(Math.random() - 0.5) * 14}px`);
  flower.style.setProperty('--flower-turn', `${(Math.random() - 0.5) * 24}deg`);
  // Staggered outer and inner rings give the bloom a fuller, layered silhouette.
  for (const ring of ['back', 'front']) {
    for (let i = 0; i < 12; i++) {
      const petal = document.createElement('span');
      petal.className = `cursor-sunflower-petal cursor-sunflower-petal-${ring}`;
      petal.style.setProperty('--petal-angle', `${i * 30 + (ring === 'back' ? 15 : 0)}deg`);
      flower.append(petal);
    }
  }
  const centre = document.createElement('span');
  centre.className = 'cursor-sunflower-centre';
  flower.append(centre);
  flower.addEventListener('animationend', (event) => {
    // Petal animation events bubble too; only the flower's lifetime retires it.
    if (event.target !== flower) return;
    flower.remove();
    flowers.delete(flower);
  });
  if (flowers.size >= 16) {
    const oldest = flowers.values().next().value;
    oldest.remove();
    flowers.delete(oldest);
  }
  flowers.add(flower);
  trailLayer.append(flower);
}

// Space flower centres by distance, not event frequency or cursor speed.
document.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || !finePointer.matches || motion.matches || document.hidden
      || !document.body.classList.contains('daylight-theme')
      || document.documentElement.classList.contains('dimension-changing')) {
    lastSpawn = null;
    return;
  }
  const point = { x: event.clientX, y: event.clientY };
  if (!lastSpawn) {
    plantFlower(point.x, point.y);
    lastSpawn = point;
    return;
  }
  const dx = point.x - lastSpawn.x;
  const dy = point.y - lastSpawn.y;
  const distance = Math.hypot(dx, dy);
  const count = Math.floor(distance / spacing);
  if (!count) return; // Small movements (or a stationary pointer) do not bunch flowers up.
  const stepX = dx / distance * spacing;
  const stepY = dy / distance * spacing;
  // Interpolate larger moves, but cap each event's work and retain only recent blooms.
  for (let i = Math.max(1, count - 4); i <= count; i++) {
    plantFlower(lastSpawn.x + stepX * i, lastSpawn.y + stepY * i);
  }
  lastSpawn = { x: lastSpawn.x + stepX * count, y: lastSpawn.y + stepY * count };
}, { passive: true });

window.addEventListener('portfolio-theme-change', clearFlowers);
motion.addEventListener('change', clearFlowers);
finePointer.addEventListener('change', clearFlowers);
document.addEventListener('visibilitychange', clearFlowers);
document.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget) clearFlowers();
});
