import Phaser from 'phaser';

// Lighting pass for the tilted top-down maps. Everything here is still drawn
// with Graphics, but in two separate passes: a cool wash that sits above the
// whole map, and an additive pass for the warm pools cast by lamps. Keeping them
// apart is what makes the street read as lit rather than merely tinted.
const WASH_DEPTH = 1300;
const GLOW_DEPTH = 1330;

/**
 * Cool wash over the map plus air perspective along the far end. The far end of
 * this map is the top of the canvas, so the haze band is anchored there in world
 * space and scrolls with the roofs it belongs to.
 */
export function ambient(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Layer,
  w: number,
  h: number,
  opts: { base?: number; alpha?: number; haze?: number; hazeAlpha?: number; hazeH?: number } = {},
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(WASH_DEPTH);
  layer.add(g);
  g.fillStyle(opts.base ?? 0x16283a, opts.alpha ?? 0.055);
  g.fillRect(0, 0, w, h);
  // Haze thins out downwards, so far roofs sit back and near paving stays crisp.
  const hazeH = opts.hazeH ?? 340;
  const bands = 22;
  const band = hazeH / bands;
  for (let i = 0; i < bands; i++) {
    const t = 1 - i / bands;
    g.fillStyle(opts.haze ?? 0x24384a, (opts.hazeAlpha ?? 0.22) * t * t);
    g.fillRect(0, i * band, w, band + 1);
  }
  return g;
}

/** Additive layer for lamp light. One Graphics object with the ADD blend, so
 *  every pool drawn into it brightens the map instead of painting over it. */
export function glowLayer(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(GLOW_DEPTH);
  g.setBlendMode(Phaser.BlendModes.ADD);
  layer.add(g);
  return g;
}

/** Soft elliptical pool of light on the paving, built from stacked rings. */
export function pool(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, rx: number, ry: number,
  color = 0xffca82, strength = 0.22, steps = 12,
): void {
  // Rings fade to nothing at their outer edge, so no hard rim shows on the paving.
  const per = (strength * 3) / steps;
  for (let i = steps - 1; i >= 1; i--) {
    const t = i / steps;
    const f = (1 - t) * (1 - t);
    g.fillStyle(color, per * f);
    g.fillEllipse(cx, cy, rx * 2 * t, ry * 2 * t);
  }
}

/** Soft round halo, used around lanterns and lamp heads. */
export function halo(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, r: number,
  color = 0xffcf8a, strength = 0.16, steps = 10,
): void {
  const per = (strength * 3) / steps;
  for (let i = steps - 1; i >= 1; i--) {
    const t = i / steps;
    const f = (1 - t) * (1 - t);
    g.fillStyle(color, per * f);
    g.fillCircle(cx, cy, r * t);
  }
}

/** Warm spill from a shop door: a low pool on the threshold, wider than it is tall. */
export function doorSpill(
  g: Phaser.GameObjects.Graphics,
  cx: number, baseY: number, w: number,
  color = 0xffc47a, strength = 0.2,
): void {
  pool(g, cx, baseY + 3, w * 0.7, 15, color, strength, 10);
}
