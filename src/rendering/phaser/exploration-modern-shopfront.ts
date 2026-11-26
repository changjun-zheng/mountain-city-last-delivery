import Phaser from 'phaser';

// STYLE-02A modern shopfront for the prologue square. Replaces the timber-post
// / bamboo-blind vocabulary of exploration-shopfront.ts with glass, aluminium,
// tiled bases, awnings and a lit signboard. Footprints and label positions are
// unchanged; only the dressing on the facade differs.
type Box = { x: number; y: number; w: number; h: number };

export type ModernShopKind = 'books' | 'service' | 'arcade' | 'grocer' | 'snack' | 'window' | 'tea';

const INK = 0x142628;
const FRAME = 0x2c3a3b;
const FRAME_LIGHT = 0x6f8280;
const GLASS_WARM = 0xd9a76f;
const GLASS_LIGHT = 0xf3c98c;
const BASE_TILE = 0x3c4644;
const CREAM = 0xf2e8d5;

const ACCENT: Record<ModernShopKind, number> = {
  books: 0xe8c35a,
  service: 0x4f8a7e,
  arcade: 0xd4553d,
  grocer: 0x6aa798,
  snack: 0xd98a4f,
  window: 0x9ed4c8,
  tea: 0x8fae6a,
};

const AWNING: Record<ModernShopKind, boolean> = {
  books: true, service: false, arcade: true, grocer: true, snack: true, window: false, tea: false,
};

/**
 * Dresses one building with a modern shopfront: stone apron, tiled base,
 * aluminium-framed glass, a dark signboard, and the small practical clutter
 * (AC, drainpipe, notice board, stock by the door) that makes a street read.
 */
export function modernShopFront(
  g: Phaser.GameObjects.Graphics,
  b: Box, wallTop: number, fh: number, kind: ModernShopKind,
): void {
  const bottom = b.y + b.h;
  const cx = b.x + b.w / 2;
  const accent = ACCENT[kind];
  const dw = Math.min(76, Math.max(50, b.w * 0.2));
  const dx = cx - dw / 2;
  const dh = Math.min(78, Math.max(54, fh * 0.58));
  const winW = Math.min(62, Math.max(36, dw * 0.82));
  const winH = Math.min(50, Math.max(30, fh * 0.32));
  const wy = wallTop + fh * 0.19;
  const winL = cx - dw / 2 - 16 - winW;
  const winR = cx + dw / 2 + 16;

  // --- stone apron, then a dark tiled base instead of a timber dado
  g.fillStyle(0x9a9c8e, .95);
  g.fillRect(b.x - 6, bottom, b.w + 12, 14);
  g.fillStyle(0xc8c5b2, .5);
  g.fillRect(b.x - 6, bottom, b.w + 12, 3);
  g.fillStyle(0x5c6660, .55);
  g.fillRect(b.x - 6, bottom + 11, b.w + 12, 3);
  const baseH = Math.min(34, fh * 0.2);
  g.fillStyle(BASE_TILE);
  g.fillRect(b.x, bottom - baseH, b.w, baseH);
  g.fillStyle(0x4e5a57, .75);
  g.fillRect(b.x, bottom - baseH, b.w, 3);
  g.lineStyle(1, 0x2c3836, .5);
  for (let x = b.x + 26; x < b.x + b.w - 14; x += 42) g.lineBetween(x, bottom - baseH + 4, x, bottom - 4);
  g.fillStyle(0x000000, .2);
  g.fillRect(b.x, bottom - 4, b.w, 4);

  // --- slim aluminium mullions, the one structure line that says "shopfront"
  for (const px of [b.x + 16, b.x + b.w - 20]) {
    g.fillStyle(0x000000, .12);
    g.fillRect(px + 2, wallTop + 2, 6, fh - 2);
    g.fillStyle(FRAME);
    g.fillRect(px, wallTop, 5, fh);
    g.fillStyle(FRAME_LIGHT, .7);
    g.fillRect(px, wallTop, 1.5, fh);
  }

  // --- drainpipe on the left edge
  g.fillStyle(0x6d7a76, .9);
  g.fillRect(b.x + 7, wallTop + 5, 4, fh - 8);
  g.fillStyle(0x495550, .7);
  g.fillRect(b.x + 5, bottom - 10, 9, 6);

  // --- signboard: dark ink panel, accent strip, room for the caller's label
  const sw = b.w * 0.86, sx = cx - sw / 2, sh = 28, sy = wallTop - 3;
  g.fillStyle(0x0a1516, .35);
  g.fillRect(sx - 2, sy + 3, sw + 4, sh);
  g.fillStyle(INK);
  g.fillRect(sx, sy, sw, sh);
  g.fillStyle(accent);
  g.fillRect(sx, sy, sw, 4);
  g.fillRect(sx + 8, sy + 10, 5, 9);
  g.fillStyle(0x000000, .22);
  g.fillRect(sx, sy + sh - 4, sw, 4);
  g.fillStyle(CREAM, .12);
  g.fillRect(sx + 18, sy + 15, sw - 30, 1);

  // --- aluminium-framed display windows
  const frameWindow = (wx: number) => {
    g.fillStyle(0x000000, .18);
    g.fillRect(wx - 3, wy - 2, winW + 6, winH + 7);
    g.fillStyle(FRAME);
    g.fillRect(wx - 4, wy - 4, winW + 8, winH + 8);
    g.fillStyle(0x3c4a49);
    g.fillRect(wx, wy, winW, winH);
    g.fillStyle(GLASS_WARM, .82);
    g.fillRect(wx + 2, wy + 2, winW - 4, winH - 4);
    g.fillStyle(GLASS_LIGHT, .38);
    g.fillRect(wx + 2, wy + 2, winW - 4, winH * .46);
    // interior shelf line and a couple of live silhouettes
    g.fillStyle(0x6b4a32, .5);
    g.fillRect(wx + 2, wy + winH * .6, winW - 4, 2);
    g.fillStyle(0x2c3a39, .5);
    for (let i = 0; i < 3; i++) {
      const bx = wx + 6 + i * (winW - 12) / 3;
      g.fillRect(bx, wy + winH * .64, 5 + (i % 2) * 3, winH * .26);
    }
    // mullions and a soft cream sill
    g.fillStyle(FRAME, .95);
    g.fillRect(wx + winW / 2 - 1, wy, 2, winH);
    g.fillRect(wx, wy + winH * .55 - 1, winW, 2);
    g.fillStyle(CREAM, .5);
    g.fillRect(wx - 1, wy + winH + 2, winW + 2, 3);
    g.fillStyle(0xffffff, .1);
    g.fillRect(wx + 3, wy + 3, winW - 6, 2);
  };
  frameWindow(winL);
  frameWindow(winR);

  // --- awning over the display, flat and deep enough to cast its own edge
  if (AWNING[kind]) {
    const ax = winL - 10, aw = winR + winW - winL + 20, ay = wy - 11;
    g.fillStyle(0x000000, .16);
    g.fillRect(ax + 5, ay + 15, aw, 9);
    g.fillStyle(0x2a3f3e);
    g.fillPoints([
      { x: ax, y: ay }, { x: ax + aw, y: ay }, { x: ax + aw - 8, y: ay + 14 }, { x: ax + 8, y: ay + 14 },
    ], true);
    g.fillStyle(accent, .95);
    g.fillPoints([
      { x: ax + 3, y: ay + 1 }, { x: ax + aw - 3, y: ay + 1 }, { x: ax + aw - 9, y: ay + 10 }, { x: ax + 9, y: ay + 10 },
    ], true);
    g.fillStyle(CREAM, .6);
    g.fillRect(ax + 7, ay + 10, aw - 14, 2);
    g.fillStyle(0x000000, .18);
    g.fillRect(ax + 8, ay + 12, aw - 16, 2);
  }

  // --- meter box, AC unit and a poster: the practical wall clutter
  g.fillStyle(0x4a5653);
  g.fillRect(b.x + 28, wallTop + 30, 13, 17);
  g.fillStyle(0x84918b);
  g.fillRect(b.x + 30, wallTop + 32, 9, 8);
  g.fillStyle(0x000000, .2);
  g.fillRect(b.x + 28, wallTop + 30, 13, 2);

  const ax2 = b.x + b.w - 58, ay2 = wallTop + 32;
  g.fillStyle(0x000000, .16);
  g.fillRect(ax2 + 3, ay2 + 4, 28, 18);
  g.fillStyle(0x7d8a85);
  g.fillRect(ax2, ay2, 28, 18);
  g.fillStyle(0x5c6a66);
  g.fillRect(ax2, ay2, 28, 3);
  g.lineStyle(1, 0x4a5854, .8);
  g.strokeCircle(ax2 + 18, ay2 + 10, 5.5);
  g.lineBetween(ax2 + 18, ay2 + 10, ax2 + 21, ay2 + 7);
  g.fillStyle(0x697772, .45);
  for (let i = 0; i < 3; i++) g.fillRect(ax2 + 4 + i * 3, ay2 + 18, 1, 7 + i * 4);

  g.fillStyle(CREAM, .9);
  g.fillRect(b.x + 42, wallTop + 78, 22, 30);
  g.fillStyle(accent, .85);
  g.fillRect(b.x + 45, wallTop + 84, 15, 3);
  g.fillStyle(0x5c6660, .55);
  g.fillRect(b.x + 45, wallTop + 91, 12, 2);
  g.fillRect(b.x + 45, wallTop + 96, 14, 2);

  // --- glass door with warm interior, aluminium frame
  const dy0 = bottom - dh;
  g.fillStyle(0x000000, .16);
  g.fillRect(dx - 3, dy0 - 4, dw + 6, dh + 4);
  g.fillStyle(FRAME);
  g.fillRect(dx - 4, dy0 - 6, dw + 8, 6);
  g.fillRect(dx - 4, dy0 - 6, 5, dh + 6);
  g.fillRect(dx + dw - 1, dy0 - 6, 5, dh + 6);
  g.fillStyle(0x3a4847);
  g.fillRect(dx + 1, dy0 + 2, dw - 2, dh - 6);
  g.fillStyle(GLASS_WARM, .78);
  g.fillRect(dx + 4, dy0 + 6, dw - 8, dh - 15);
  g.fillStyle(GLASS_LIGHT, .3);
  g.fillRect(dx + 4, dy0 + 6, dw - 8, 12);
  g.fillStyle(FRAME);
  g.fillRect(cx - 1, dy0 + 4, 2, dh - 10);
  g.fillStyle(CREAM, .45);
  g.fillRect(dx + 4, dy0 + dh - 10, dw - 8, 2);
  g.fillStyle(0x1a2a2c);
  g.fillRect(dx + 6, bottom - 4, dw - 12, 4);
  g.fillStyle(accent, .9);
  g.fillRect(dx + 3, dy0 - 2, dw - 6, 3);

  // --- minimal goods by the door: one crate and one planter, not a market stall
  const crates = kind === 'books' ? [0x6d3c30, 0x2e4652, 0x8a6a3a] : [0x8a6a3a, 0x9a7b4a, 0x6a5a3a];
  const crateX = dx + dw + 14;
  for (let i = 0; i < 3; i++) {
    g.fillStyle(0x000000, .13);
    g.fillRect(crateX + 2, bottom - 4 - i * 5 + 2, 22, 4);
    g.fillStyle(crates[i % crates.length]);
    g.fillRect(crateX + i, bottom - 4 - i * 5, 21 - i * 3, 4);
  }
  g.fillStyle(0x3d5c4d);
  g.fillRoundedRect(b.x + 30, bottom - 16, 18, 14, 2);
  g.fillStyle(0x557d63);
  g.fillEllipse(b.x + 38, bottom - 20, 16, 9);
  g.fillStyle(0x6d9a78, .8);
  g.fillEllipse(b.x + 35, bottom - 22, 7, 4);

  if (kind === 'service') {
    // A small wayfinding totem by the door, not an A-frame placard. It stands
    // clear of both display windows: beside the right one when the bay allows,
    // outside the left one otherwise, never overlapping a frame.
    const totemW = 20;
    let tx = Math.min(winR + winW + 10, b.x + b.w - 28 - totemW);
    if (tx <= winR + winW + 4) tx = winL - totemW - 10;
    if (tx >= b.x + 8) {
      g.fillStyle(0x000000, .14);
      g.fillRect(tx + 3, bottom + 2, totemW, 6);
      g.fillStyle(FRAME);
      g.fillRect(tx, bottom - 34, totemW, 34);
      g.fillStyle(accent, .9);
      g.fillRect(tx + 3, bottom - 31, 14, 4);
      g.fillStyle(CREAM, .85);
      for (let i = 0; i < 3; i++) g.fillRect(tx + 4, bottom - 23 + i * 6, 12 - (i % 2) * 4, 2);
    }
  }
}
