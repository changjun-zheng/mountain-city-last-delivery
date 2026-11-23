import Phaser from 'phaser';

// Deterministic little painter helpers. Everything here is drawn with Graphics
// calls on top of the flat shapes, so the map reads as material instead of a
// set of solid rectangles. Seeds come from the rectangle itself, so redrawing
// the same map twice gives the same texture.
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Painted plaster wall: base tone, a few lighter and darker patches, vertical
 *  joints, and grime along the base. `h` is the whole front wall height. */
export function plaster(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  base: number, light: number, dark: number,
): void {
  g.fillStyle(base);
  g.fillRect(x, y, w, h);
  const r = rng(x * 73 + y * 131 + w * 17);
  for (let i = 0; i < 12; i++) {
    const px = x + r() * Math.max(1, w - 46);
    const py = y + r() * Math.max(1, h - 14);
    g.fillStyle(light, 0.07 + r() * 0.06);
    g.fillRect(px, py, 18 + r() * 44, 5 + r() * 9);
  }
  for (let i = 0; i < 10; i++) {
    const px = x + r() * Math.max(1, w - 34);
    const py = y + r() * Math.max(1, h - 12);
    g.fillStyle(dark, 0.06 + r() * 0.07);
    g.fillRect(px, py, 12 + r() * 30, 4 + r() * 7);
  }
  g.fillStyle(dark, 0.2);
  for (let px = x + 30; px < x + w - 10; px += 36) g.fillRect(px, y + 3, 1, h - 8);
  g.fillStyle(dark, 0.3);
  g.fillRect(x, y + h - 8, w, 8);
  g.fillStyle(light, 0.12);
  g.fillRect(x, y + 2, w, 3);
}

/** Roof tiles seen from above: alternating rows, per-tile seams, a lit ridge
 *  at the top edge and a shaded band on the right. */
export function tileRoof(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  base: number, dark: number, light: number,
): void {
  g.fillStyle(base);
  g.fillRect(x, y, w, h);
  // Pantiles run down the slope, so in plan view they read as vertical courses
  // (a horizontal hatch reads as a venetian blind instead of a roof).
  const colW = Math.max(14, Math.floor(w / 24));
  const r = rng(x * 31 + y * 97 + w * 7);
  for (let xx = x; xx < x + w - 1; xx += colW) {
    const t = r();
    g.fillStyle(t > 0.5 ? light : dark, 0.1);
    g.fillRect(xx, y, colW - 1, h);
    g.fillStyle(dark, 0.3);
    g.fillRect(xx, y, 1, h);
    g.fillStyle(light, 0.18);
    g.fillRect(xx + 1, y, 1, h);
    // a tile end every few rows, staggered across neighbouring courses
    const off = Math.floor((xx - x) / colW) % 2 ? 12 : 0;
    g.fillStyle(dark, 0.16);
    for (let yy = y + 10 + off; yy < y + h - 6; yy += 26) g.fillRect(xx + 1, yy, colW - 2, 1);
  }
  // Ridge: one lit line a third of the way down, with the roof falling away from
  // it on both sides. Without this a big roof reads as a flat grey slab.
  const ridgeY = y + Math.floor(h * 0.34);
  g.fillStyle(dark, 0.17);
  g.fillRect(x, y, w, ridgeY - y);
  g.fillStyle(light, 0.52);
  g.fillRect(x, ridgeY, w, 3);
  g.fillStyle(0x000000, 0.15);
  g.fillRect(x, ridgeY + 3, w, y + h - ridgeY - 3);
  g.fillStyle(light, 0.18);
  g.fillRect(x, y, w, 3);
  g.fillStyle(0x000000, 0.16);
  g.fillRect(x + w - 7, y, 7, h);
  g.fillStyle(0x000000, 0.1);
  g.fillRect(x, y + h - 5, w, 5);
}

/** Stone paving: a grid of slabs with slight tone variation and dark joints. */
export function stoneTiles(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  base: number, light: number, dark: number,
  cw = 64, ch = 32,
): void {
  g.fillStyle(base);
  g.fillRect(x, y, w, h);
  const r = rng(x * 19 + y * 41 + w * 3);
  for (let yy = y; yy < y + h; yy += ch) {
    for (let xx = x; xx < x + w; xx += cw) {
      const t = r();
      if (t < 0.18) g.fillStyle(dark, 0.06);
      else if (t > 0.82) g.fillStyle(light, 0.05);
      if (t < 0.18 || t > 0.82) g.fillRect(xx + 1, yy + 1, cw - 2, ch - 2);
      g.fillStyle(dark, 0.1);
      for (let k = 0; k < 3; k++) g.fillRect(xx + 4 + ((k * 17 + xx) % (cw - 10)), yy + 4 + ((k * 11 + yy) % (ch - 8)), 3, 2);
      g.fillStyle(dark, 0.26);
      g.fillRect(xx, yy + ch - 1, cw, 1);
      g.fillRect(xx + cw - 1, yy, 1, ch);
    }
  }
  g.fillStyle(light, 0.05);
  g.fillRect(x, y, w, 2);
}

/** Soft contact shadow under a block, cast to the lower right of the light. */
export function contactShadow(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  depth = 14,
): void {
  g.fillStyle(0x1a2a2c, 0.16);
  g.fillRect(x + 5, y + h, w, depth);
  g.fillStyle(0x1a2a2c, 0.12);
  g.fillRect(x + w, y + 12, 10, h - 4);
}

/** Warm pool of light on the paving, e.g. under a shop lamp. */
export function lightPool(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, rx: number, ry: number,
  color = 0xffd48a, alpha = 0.16,
): void {
  g.fillStyle(color, alpha * 0.55);
  g.fillEllipse(cx, cy, rx * 1.35, ry * 1.35);
  g.fillStyle(color, alpha);
  g.fillEllipse(cx, cy, rx, ry);
}
