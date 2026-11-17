import * as THREE from './vendor/three.module.js';

// Original, curved seated-cat contour. The pose is a side/three-quarter view:
// upright ears, a rounded back, two paws, and a tail curling up on the left.
// No image tracing, textures, or external model assets are used.
export function createCatConstellation() {
  const shape = new THREE.Shape();
  const p = (x, y) => [(x - 250) / 62, (190 - y) / 62];
  const move = (x, y) => shape.moveTo(...p(x, y));
  const line = (x, y) => shape.lineTo(...p(x, y));
  const curve = (x1, y1, x2, y2, x3, y3) => shape.bezierCurveTo(...p(x1, y1), ...p(x2, y2), ...p(x3, y3));

  move(360, 110);
  curve(377, 85, 370, 66, 370, 54);
  curve(367, 34, 362, 8, 372, 4);
  curve(380, 1, 393, 23, 401, 26);
  curve(418, 19, 444, 20, 456, 23);
  curve(466, 15, 478, 0, 485, 4);
  curve(497, 13, 488, 48, 490, 63);
  curve(498, 83, 492, 111, 477, 123);
  curve(483, 139, 477, 164, 463, 178);
  curve(446, 196, 440, 233, 437, 270);
  curve(434, 301, 444, 331, 452, 340);
  curve(461, 352, 455, 367, 442, 368);
  line(414, 368);
  curve(401, 367, 396, 350, 391, 340);
  curve(383, 324, 378, 310, 367, 302);
  curve(353, 310, 348, 338, 342, 343);
  curve(356, 345, 368, 351, 367, 364);
  curve(366, 371, 350, 374, 336, 374);
  line(170, 374);
  curve(111, 379, 61, 367, 31, 338);
  curve(7, 316, -2, 284, 8, 263);
  curve(15, 248, 29, 249, 36, 264);
  curve(48, 279, 39, 297, 35, 301);
  curve(42, 325, 61, 340, 87, 344);
  curve(116, 351, 143, 350, 165, 342);
  curve(180, 336, 181, 312, 183, 292);
  curve(176, 256, 174, 222, 188, 190);
  curve(202, 162, 232, 139, 270, 131);
  curve(300, 124, 329, 123, 350, 120);
  curve(354, 118, 358, 114, 360, 110);

  const outline = shape.getSpacedPoints(192).map(v => [v.x, v.y, 0.12 + Math.sin(v.x * 0.5) * 0.06]);
  const stars = outline.filter((_, i) => i < outline.length - 1 && i % 6 === 0);
  const bright = new Set();
  // Bright anchor stars at ears, paws, tail tip, and the shoulder.
  for (const anchor of [[372,4], [485,4], [442,368], [15,260], [270,131]]) {
    const [x, y] = p(...anchor);
    let nearest = 0, distance = Infinity;
    stars.forEach((s, i) => {
      const d = (s[0] - x) ** 2 + (s[1] - y) ** 2;
      if (d < distance) { distance = d; nearest = i; }
    });
    bright.add(nearest);
  }

  const nearestStar = (x, y) => {
    const [px, py] = p(x, y);
    let nearest = 0, distance = Infinity;
    stars.forEach((s, i) => {
      const d = (s[0] - px) ** 2 + (s[1] - py) ** 2;
      if (d < distance) { distance = d; nearest = i; }
    });
    return nearest;
  };
  // A few restrained body connections make this a map of stars, not a logo.
  const shoulder = nearestStar(270, 131), haunch = nearestStar(188, 190);
  const paw = nearestStar(336, 374), chest = nearestStar(437, 270);
  const links = [[shoulder, paw], [shoulder, chest], [haunch, paw]];

  const polygon = shape.getPoints(160);
  function inside(x, y) {
    let found = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) found = !found;
    }
    return found;
  }
  const interior = [];
  for (let attempt = 0; attempt < 1600 && interior.length < 100; attempt++) {
    const x = -4.05 + Math.random() * 8.1, y = -3.1 + Math.random() * 6.2;
    if (inside(x, y)) interior.push([x, y, 0.15 + Math.random() * 0.2]);
  }
  // alIndex: the shoulder star (links[0][0]) that carries the AL-0527 label.
  return { shape, outline, stars, bright, interior, links, alIndex: shoulder };
}
