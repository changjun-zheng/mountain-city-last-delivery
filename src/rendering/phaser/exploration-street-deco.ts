import Phaser from 'phaser';

// Street dressing for the prologue shopping street: hanging boards, lanterns,
// stalls, a parked car, passers-by, trees and wires. Purely visual, drawn with
// Graphics at the depth of the thing's foot, so actors still sort in front of
// or behind them correctly. Nothing here adds collision.
type Label = (x: number, y: number, t: string, size?: number, color?: string, depth?: number) => void;

const WOOD = 0x6b4b31;
const WOOD_LIGHT = 0x8d6744;
const CLOTH_RED = 0xb4433a;
const CLOTH_CREAM = 0xe8dcc2;
const CLOTH_TEAL = 0x336f68;
const IRON = 0x3d4a4c;
const LAMP = 0xffcb78;

function roundRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x, y, w, h, r);
}

/** Vertical hanging board below the eave, the sort every shop on this street has. */
export function hangingBoard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, base: number): void {
  // bracket to the wall
  g.fillStyle(IRON);
  g.fillRect(x + w / 2 - 2, y - 10, 4, 10);
  g.fillRect(x + w / 2 - 2, y - 12, 12, 3);
  // board
  g.fillStyle(base);
  g.fillRect(x, y, w, h);
  g.fillStyle(0x000000, 0.2);
  g.fillRect(x + w - 4, y + 2, 4, h - 4);
  g.lineStyle(2, 0xe6d8b6, 0.85);
  g.strokeRect(x + 2, y + 2, w - 4, h - 4);
  // two rows of square characters read as lettering at this size
  g.fillStyle(0xf6e9c8, 0.95);
  for (let i = 0; i < 3; i++) g.fillRect(x + w / 2 - 6, y + 12 + i * (h - 24) / 3, 12, 12);
}

/** Lantern on a short cord, hung from the eave on either side of a doorway. */
export function lantern(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(cx + 6, cy + r + 8, r * 2, r);
  g.lineStyle(1, IRON, 0.9);
  g.lineBetween(cx, cy - r - 16, cx, cy - r);
  g.fillStyle(LAMP, 0.22);
  g.fillCircle(cx, cy, r * 2.1);
  g.fillStyle(0xb7392f);
  g.fillEllipse(cx, cy, r * 1.7, r * 2);
  g.fillStyle(0xd4453a);
  g.fillEllipse(cx - r * 0.25, cy - r * 0.2, r * 1.2, r * 1.5);
  g.fillStyle(0xf0b451);
  g.fillRect(cx - r * 0.45, cy - r, r * 0.9, r * 0.28);
  g.fillRect(cx - r * 0.45, cy + r * 0.72, r * 0.9, r * 0.28);
  g.fillStyle(0x6d2b23);
  g.fillRect(cx - 1, cy + r * 1.1, 2, r * 0.5);
}

/** Market stall: striped canopy, table with a top and a front, goods on top. */
export function stall(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, awning = CLOTH_RED): void {
  g.fillStyle(0x000000, 0.16);
  g.fillRect(x + 8, y + h - 4, w, 10);
  // table
  g.fillStyle(WOOD);
  g.fillRect(x + 6, y + h - 34, w - 12, 30);
  g.fillStyle(WOOD_LIGHT);
  g.fillRect(x + 6, y + h - 40, w - 12, 8);
  g.fillStyle(0x000000, 0.22);
  g.fillRect(x + 6, y + h - 10, w - 12, 10);
  // goods
  const cols = [0xd8a24a, 0xc0503f, 0x7f9a55, 0xe0d2a8];
  for (let i = 0; i < 6; i++) {
    const gx = x + 14 + i * (w - 28) / 6;
    g.fillStyle(cols[i % 4]);
    g.fillRect(gx, y + h - 48, 12, 9);
    g.fillStyle(0x000000, 0.14);
    g.fillRect(gx, y + h - 41, 12, 2);
  }
  // canopy, tilted so it reads as a roof over the stall
  g.fillStyle(awning);
  g.fillPoints([
    { x: x, y: y + h - 62 }, { x: x + w, y: y + h - 62 },
    { x: x + w - 10, y: y + h - 88 }, { x: x + 10, y: y + h - 88 },
  ], true);
  g.fillStyle(CLOTH_CREAM, 0.85);
  for (let i = 0; i < 4; i++) {
    const px = x + 14 + i * (w - 26) / 4;
    g.fillPoints([
      { x: px, y: y + h - 62 }, { x: px + 7, y: y + h - 62 },
      { x: px + 10, y: y + h - 88 }, { x: px + 3, y: y + h - 88 },
    ], true);
  }
  g.lineStyle(2, 0x000000, 0.28);
  g.lineBetween(x, y + h - 62, x + w, y + h - 62);
}

/** Small parked car seen from above: body, cabin, glass, wheels. */
export function parkedCar(g: Phaser.GameObjects.Graphics, x: number, y: number, body = 0xc8b24a): void {
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(x + 4, y + 4, 96, 52);
  roundRect(g, x - 44, y - 26, 88, 52, 10, body);
  g.fillStyle(0x000000, 0.18);
  g.fillRect(x - 40, y + 14, 80, 6);
  roundRect(g, x - 24, y - 20, 48, 30, 8, 0x39494b);
  g.fillStyle(0x8fb3b8, 0.65);
  g.fillRect(x - 20, y - 16, 40, 8);
  g.fillStyle(0x1d2a2c);
  g.fillRect(x - 38, y - 30, 12, 6);
  g.fillRect(x + 26, y - 30, 12, 6);
  g.fillRect(x - 38, y + 24, 12, 6);
  g.fillRect(x + 26, y + 24, 12, 6);
  g.fillStyle(0xe8d59a, 0.9);
  g.fillRect(x + 40, y - 10, 6, 8);
  g.fillRect(x + 40, y + 2, 6, 8);
}

/** A standing passer-by, same proportions as the player but static. */
export function passerby(g: Phaser.GameObjects.Graphics, x: number, y: number, coat: number, skin = 0xe6bd95, hair = 0x3a3230): void {
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(x, y - 2, 26, 9);
  g.fillStyle(0x2a363b);
  g.fillRect(x - 8, y - 14, 6, 14);
  g.fillRect(x + 2, y - 14, 6, 14);
  g.fillStyle(coat);
  g.fillPoints([{ x: x - 10, y: y - 13 }, { x: x + 10, y: y - 13 }, { x: x + 12, y: y - 36 }, { x: x - 12, y: y - 36 }], true);
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(x - 8, y - 34, 16, 3);
  g.fillStyle(skin);
  g.fillCircle(x, y - 46, 11);
  g.fillStyle(hair);
  g.fillEllipse(x, y - 52, 22, 11);
  g.fillStyle(0x2a2a2a);
  g.fillCircle(x - 4, y - 46, 1.6);
  g.fillCircle(x + 4, y - 46, 1.6);
}

/** Park bench: back rail, slatted seat and two legs, read from above. */
export function bench(g: Phaser.GameObjects.Graphics, x: number, y: number, w = 64): void {
  g.fillStyle(0x16282a, 0.16);
  g.fillRect(x + 5, y + 3, w, 8);
  g.fillStyle(WOOD);
  g.fillRect(x, y - 19, w, 7);
  g.fillStyle(WOOD_LIGHT);
  g.fillRect(x, y - 19, w, 3);
  g.fillStyle(0x9a7550);
  g.fillRect(x, y - 10, w, 12);
  g.fillStyle(0xb08a5f);
  g.fillRect(x, y - 10, w, 3);
  g.fillStyle(0x000000, 0.14);
  for (let i = 1; i < 3; i++) g.fillRect(x + i * w / 3, y - 10, 1, 12);
  g.fillStyle(IRON);
  g.fillRect(x + 5, y + 1, 5, 8);
  g.fillRect(x + w - 10, y + 1, 5, 8);
}

/** Newspaper kiosk: a small dark box with a lit display window and an awning. */
export function kiosk(g: Phaser.GameObjects.Graphics, x: number, y: number, w = 96, h = 58): void {
  for (let i = 0; i < 3; i++) {
    g.fillStyle(0x16282a, 0.14 * (1 - i / 3));
    g.fillRect(x + 6 + i * 7, y + 2 + i * 7, w - 6 - i * 12, 8);
  }
  g.fillStyle(0x2f4a4c);
  g.fillRect(x, y - h, w, h);
  g.fillStyle(0x24393c);
  g.fillRect(x, y - h, w, 6);
  g.fillStyle(0xd7c9a4);
  g.fillRect(x + 8, y - h + 10, w - 16, h - 20);
  const cols = [0xc0503f, 0x336f68, 0xd8a24a, 0x8a6a3a];
  for (let i = 0; i < 6; i++) {
    g.fillStyle(cols[i % 4]);
    g.fillRect(x + 11 + i * (w - 22) / 6, y - h + 14, (w - 22) / 6 - 3, 15);
  }
  g.fillStyle(0x000000, 0.18);
  g.fillRect(x + 8, y - h + 32, w - 16, 8);
  g.fillStyle(CLOTH_RED);
  g.fillPoints([
    { x: x - 6, y: y - h }, { x: x + w + 6, y: y - h },
    { x: x + w + 2, y: y - h - 13 }, { x: x - 2, y: y - h - 13 },
  ], true);
  g.fillStyle(CLOTH_CREAM, 0.8);
  for (let i = 0; i < 3; i++) {
    const px = x + 6 + i * (w - 10) / 3;
    g.fillPoints([
      { x: px, y: y - h }, { x: px + 6, y: y - h },
      { x: px + 4, y: y - h - 13 }, { x: px - 2, y: y - h - 13 },
    ], true);
  }
}

/** Street tree: trunk plus a layered canopy seen from above. */
export function streetTree(g: Phaser.GameObjects.Graphics, x: number, y: number, scale = 1): void {
  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(x + 10 * scale, y + 4, 88 * scale, 34 * scale);
  g.fillStyle(0x4c3a29);
  g.fillRect(x - 4 * scale, y - 26 * scale, 8 * scale, 26 * scale);
  g.fillStyle(0x2f4f3a);
  g.fillCircle(x, y - 52 * scale, 30 * scale);
  g.fillStyle(0x3d6346);
  g.fillCircle(x - 20 * scale, y - 44 * scale, 20 * scale);
  g.fillCircle(x + 20 * scale, y - 46 * scale, 19 * scale);
  g.fillStyle(0x50804f);
  g.fillCircle(x - 6 * scale, y - 62 * scale, 18 * scale);
  g.fillStyle(0x66975c, 0.7);
  g.fillCircle(x - 12 * scale, y - 68 * scale, 9 * scale);
}

/** Utility pole with crossbars; wires are drawn separately between poles. */
export function utilityPole(g: Phaser.GameObjects.Graphics, x: number, y: number, h = 110): void {
  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(x + 8, y, 30, 10);
  g.fillStyle(IRON);
  g.fillRect(x - 3, y - h, 6, h);
  g.fillRect(x - 18, y - h + 12, 36, 4);
  g.fillRect(x - 12, y - h + 26, 24, 3);
  g.fillStyle(0x8b9a95, 0.35);
  g.fillRect(x - 2, y - h, 2, h);
}

/** A wire between two pole tops, drawn as a shallow sag. */
export function wire(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, sag = 14): void {
  g.lineStyle(1, 0x2c3a3c, 0.75);
  const steps = 10;
  let px = x1, py = y1;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = x1 + (x2 - x1) * t;
    const ny = y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * sag;
    g.lineBetween(px, py, nx, ny);
    px = nx; py = ny;
  }
}

/** Low stone bollard with a lamp, one of the small lights along the paving. */
export function lampPost(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(x, y, 26, 9);
  g.fillStyle(0x4c5b5b);
  g.fillRect(x - 3, y - 44, 6, 44);
  g.fillStyle(0x3d4a4c);
  g.fillRect(x - 9, y - 50, 18, 8);
  g.fillStyle(0xffd794, 0.2);
  g.fillCircle(x, y - 56, 26);
  g.fillStyle(0xffd794);
  g.fillRect(x - 6, y - 60, 12, 12);
  g.fillStyle(0xfff0c8);
  g.fillRect(x - 3, y - 58, 6, 8);
}

/** A low stone planter: the cheapest way to close a gap between two blocks. */
export function planter(g: Phaser.GameObjects.Graphics, x: number, y: number, w = 90, h = 46): void {
  g.fillStyle(0x000000, 0.14);
  g.fillEllipse(x + w / 2, y + h - 2, w + 8, 14);
  g.fillStyle(0xb9b2a0);
  g.fillRect(x, y, w, h);
  g.fillStyle(0xd2cbb6);
  g.fillRect(x, y, w, 6);
  g.fillStyle(0x8e8878, 0.5);
  g.fillRect(x, y + h - 7, w, 7);
  let k = 0;
  for (let i = 0; i < Math.max(2, Math.floor(w / 26)); i++) {
    const rr = 13 + (k % 3) * 4;
    g.fillStyle(k % 2 ? 0x3f6244 : 0x4d7350, 0.95);
    g.fillCircle(x + 15 + i * 26, y + h * 0.45, rr);
    g.fillStyle(0x000000, 0.1);
    g.fillCircle(x + 15 + i * 26, y + h * 0.45 + rr * 0.5, rr * 0.7);
    if (k % 3 === 0) {
      g.fillStyle(0xd07a4a, 0.8);
      g.fillCircle(x + 20 + i * 26, y + h * 0.3, 3);
    }
    k++;
  }
}

/** A stack of crates and a barrel, the debris that always collects in a gap. */
export function crateStack(g: Phaser.GameObjects.Graphics, x: number, y: number, w = 44): void {
  g.fillStyle(0x000000, 0.14);
  g.fillRect(x + 3, y + 4, w, 10);
  const shades = [0x9a7a4a, 0x87673c, 0xa88a58];
  for (let i = 0; i < 3; i++) {
    const cw = w - i * 6, cx = x + i * 3, cy = y - i * 11;
    g.fillStyle(shades[i % 3]);
    g.fillRect(cx, cy, cw, 12);
    g.fillStyle(0x5c4426, 0.75);
    g.fillRect(cx, cy, cw, 2);
    g.fillRect(cx + cw / 2 - 1, cy, 2, 12);
  }
  g.fillStyle(0x7d5738);
  g.fillRect(x + w + 6, y - 18, 20, 20);
  g.fillStyle(0xa07850);
  g.fillEllipse(x + w + 16, y - 18, 20, 7);
}

/** A short stone bollard. */
export function stoneStool(g: Phaser.GameObjects.Graphics, x: number, y: number, r = 9): void {
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(x, y + 2, r * 2.4, r);
  g.fillStyle(0xa9a291);
  g.fillRect(x - r, y - r * 3, r * 2, r * 3);
  g.fillStyle(0xc6bfae);
  g.fillEllipse(x, y - r * 3, r * 2, r * 1.1);
  g.fillStyle(0x6f6a5c, 0.6);
  g.fillRect(x + r * 0.3, y - r * 3, r * 0.7, r * 3);
}

/** A bicycle leaned against a wall. */
export function bicycle(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x000000, 0.13);
  g.fillEllipse(x + 20, y + 2, 44, 10);
  g.lineStyle(2, 0x37474a, 0.95);
  g.strokeCircle(x + 9, y - 9, 9);
  g.strokeCircle(x + 37, y - 9, 9);
  g.lineBetween(x + 9, y - 9, x + 20, y - 19);
  g.lineBetween(x + 20, y - 19, x + 37, y - 9);
  g.lineBetween(x + 20, y - 19, x + 24, y - 24);
  g.lineBetween(x + 17, y - 24, x + 27, y - 24);
  g.fillStyle(0x6a4a3a);
  g.fillRect(x + 17, y - 26, 10, 3);
}

/** Two posts and a line of washing strung between them. */
export function laundryPole(g: Phaser.GameObjects.Graphics, x: number, y: number, w = 140): void {
  g.fillStyle(0x000000, 0.12);
  g.fillRect(x - 2, y + 2, 5, 8);
  g.fillRect(x + w - 3, y + 2, 5, 8);
  g.fillStyle(0x5a4a3a);
  g.fillRect(x, y - 56, 3, 58);
  g.fillRect(x + w - 3, y - 50, 3, 52);
  g.lineStyle(1, 0xd8cbb0, 0.6);
  g.lineBetween(x + 1, y - 54, x + w - 2, y - 48);
  const cloth = [0xb6c4c0, 0xd0b48a, 0x9aa8a0, 0xc48a7a];
  for (let i = 0; i < 4; i++) {
    const cx = x + 18 + i * (w - 30) / 4;
    const cy = y - 53 + (i * (w - 30) / 4) * 0.04;
    g.fillStyle(cloth[i % 4], 0.95);
    g.fillRect(cx, cy, 12, 20 + (i % 2) * 8);
    g.fillStyle(0x000000, 0.12);
    g.fillRect(cx, cy + 16 + (i % 2) * 8, 12, 4);
  }
}
