import Phaser from 'phaser';

// Shopfront dressing for the prologue street. One function serves the whole row
// so the buildings read as one hand, but `kind` changes what each shop is selling:
// the sign colour, what sits behind the glass, and what is stacked by the door.
type Box = { x: number; y: number; w: number; h: number };

const WOOD = 0x6b4b31;
const WOOD_LIGHT = 0x8d6744;
const PAPER = 0xe6d8b6;

export type ShopKind = 'books' | 'service' | 'arcade' | 'grocer' | 'snack' | 'window' | 'tea';

const SIGN_COLOR: Record<ShopKind, number> = {
  books: 0x2f4a4c,
  service: 0x5a4230,
  arcade: 0x7a3e32,
  grocer: 0x33503a,
  snack: 0x8a4034,
  window: 0x2e3a52,
  tea: 0x4a5a38,
};

/**
 * Everything a shopfront needs on top of the plain box: a painted sign board
 * under the eave, stock behind the glass, the meter box and drainpipe every old
 * wall collects, a framed door, and goods laid out on the pavement.
 */
export function shopFront(
  g: Phaser.GameObjects.Graphics,
  b: Box, wallTop: number, fh: number, kind: ShopKind,
): void {
  const bottom = b.y + b.h;
  const cx = b.x + b.w / 2;
  const dw = Math.min(72, Math.max(48, b.w * 0.19));
  const dx = cx - dw / 2;
  const dh = Math.min(76, Math.max(52, fh * 0.56));
  const winW = Math.min(58, Math.max(34, dw * 0.8));
  const winH = Math.min(46, Math.max(28, fh * 0.3));
  const wy = wallTop + fh * 0.17;
  const winL = cx - dw / 2 - 14 - winW;
  const winR = cx + dw / 2 + 14;

  // --- panelled timber dado along the base: the stretch of wall below the sills
  // should read as shopfront joinery, not as leftover plaster
  const dadoH = Math.min(58, fh * 0.34);
  g.fillStyle(0x000000, 0.16);
  g.fillRect(b.x, bottom - dadoH - 2, b.w, 3);
  g.fillStyle(0x4d3826, 0.85);
  g.fillRect(b.x, bottom - dadoH, b.w, dadoH);
  g.fillStyle(0x63492f, 0.55);
  g.fillRect(b.x, bottom - dadoH, b.w, 3);
  g.lineStyle(1, 0x33251a, 0.55);
  for (let x = b.x + 26; x < b.x + b.w - 20; x += 34) g.lineBetween(x, bottom - dadoH + 4, x, bottom - 5);
  g.fillStyle(0x2f2216, 0.4);
  g.fillRect(b.x, bottom - 4, b.w, 4);

  // --- timber posts framing the bay: the one cue that says old street rather
  // than an office block with stickers on it
  for (const px of [b.x + 22, b.x + b.w - 30]) {
    g.fillStyle(0x000000, 0.12);
    g.fillRect(px + 3, wallTop + 2, 10, fh - 2);
    g.fillStyle(WOOD);
    g.fillRect(px, wallTop, 8, fh);
    g.fillStyle(WOOD_LIGHT);
    g.fillRect(px, wallTop, 2, fh);
    g.fillStyle(0x3f2d1f, 0.75);
    g.fillRect(px - 2, wallTop, 12, 4);
    g.fillRect(px - 2, bottom - 5, 12, 5);
  }

  // --- drainpipe down the left edge, with its shoe at the base
  g.fillStyle(0x78857f, 0.85);
  g.fillRect(b.x + 9, wallTop + 5, 5, fh - 8);
  g.fillStyle(0x56615d, 0.6);
  g.fillRect(b.x + 9, wallTop + 5, 2, fh - 8);
  g.fillStyle(0x4a5652);
  g.fillRect(b.x + 6, bottom - 11, 11, 7);

  // --- painted sign board, the shop name is laid over it by the caller
  const sw = b.w * 0.84, sx = cx - sw / 2, sh = 24, sy = wallTop - 2;
  g.fillStyle(0x22201c, 0.22);
  g.fillRect(sx - 2, sy + 2, sw + 4, sh + 4);
  g.fillStyle(SIGN_COLOR[kind]);
  g.fillRect(sx, sy, sw, sh);
  g.fillStyle(0x000000, 0.2);
  g.fillRect(sx, sy + sh - 5, sw, 5);
  g.fillStyle(0xdcd0b2, 0.75);
  g.fillRect(sx + 3, sy + 3, sw - 6, 1);
  g.lineStyle(2, 0xd9c9a0, 0.6);
  g.strokeRect(sx + 2, sy + 2, sw - 4, sh - 4);

  // --- glass, frame and mullions first: without a pane behind it the stock reads
  // as ribbons floating on the wall
  const frameWindow = (wx: number) => {
    g.fillStyle(0x000000, 0.18);
    g.fillRect(wx - 3, wy - 1, winW + 6, winH + 8);
    g.fillStyle(WOOD);
    g.fillRect(wx - 4, wy - 4, winW + 8, winH + 8);
    g.fillStyle(0x6f5a3c, 0.95);
    g.fillRect(wx, wy, winW, winH);
    g.fillStyle(0xb99a66, 0.55);
    g.fillRect(wx + 1, wy + 1, winW - 2, winH - 2);
    g.fillStyle(0xe6cf9a, 0.22);
    g.fillRect(wx + 2, wy + 2, winW - 4, winH * 0.5);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(wx + 2, wy + 2, winW - 4, 3);
    // mullions, a cross and one vertical divider
    g.fillStyle(WOOD, 0.9);
    g.fillRect(wx + winW / 2 - 1, wy, 3, winH);
    g.fillRect(wx, wy + winH * 0.55 - 1, winW, 3);
    g.fillStyle(0xd9c9a0, 0.35);
    g.fillRect(wx + 2, wy + winH - 3, winW - 4, 3);
  };
  frameWindow(winL);
  frameWindow(winR);

  // --- what is behind the glass
  const dressWindow = (wx: number) => {
    if (kind === 'books') {
      g.fillStyle(0xffe2b8, 0.35);
      for (let i = 1; i < 4; i++) g.fillRect(wx + 3, wy + 3 + i * (winH - 6) / 4, winW - 6, 2);
      for (let i = 0; i < 6; i++) {
        const bx = wx + 5 + i * (winW - 10) / 6;
        g.fillStyle(i % 2 ? 0xc89a6a : 0x86a0a6, 0.9);
        g.fillRect(bx, wy + 5, 4, winH - 11);
        g.fillStyle(0xfff0d0, 0.5);
        g.fillRect(bx, wy + 5, 4, 2);
      }
    } else if (kind === 'arcade') {
      // bolts of cloth hung along a rail
      g.fillStyle(0xffe2b8, 0.3);
      g.fillRect(wx + 4, wy + 6, winW - 8, 2);
      const cloth = [0xc06a5a, 0x6a8a9c, 0xc8ac6a, 0x76768e];
      for (let i = 0; i < 4; i++) {
        g.fillStyle(cloth[i % 4], 0.92);
        g.fillRect(wx + 6 + i * (winW - 12) / 4, wy + 9, 8, 14 + (i % 2) * 7);
      }
    } else if (kind === 'grocer') {
      // three shelves of jars and packets
      for (let i = 0; i < 3; i++) {
        g.fillStyle(0xffe2b8, 0.4);
        g.fillRect(wx + 3, wy + 8 + i * 10, winW - 6, 2);
        for (let j = 0; j < 4; j++) {
          g.fillStyle([0xd89a5a, 0xb07a4a, 0x8a9a5a][(i + j) % 3], 0.95);
          g.fillRect(wx + 5 + j * (winW - 10) / 4, wy + 10 + i * 10, 7, 5);
        }
      }
    } else if (kind === 'snack') {
      // steamers stacked at the counter, warm inside
      for (let i = 0; i < 2; i++) {
        const sx2 = wx + winW * 0.3 + i * winW * 0.42;
        g.fillStyle(0xb07a4a, 0.95);
        g.fillEllipse(sx2, wy + winH * 0.7, 18, 10);
        g.fillStyle(0xf0e0b8, 0.95);
        g.fillEllipse(sx2, wy + winH * 0.58, 16, 8);
        g.fillStyle(0xfff6e0, 0.35);
        g.fillCircle(sx2, wy + winH * 0.42, 5);
      }
    } else if (kind === 'tea') {
      // a pot on a brazier and a row of cups, bamboo blind behind
      g.fillStyle(0xd8c79a, 0.35);
      for (let i = 0; i < 5; i++) g.fillRect(wx + 4 + i * (winW - 8) / 5, wy + 4, 2, winH - 10);
      g.fillStyle(0x8a9a6a, 0.9);
      g.fillEllipse(wx + winW * 0.4, wy + winH * 0.62, 20, 12);
      g.fillStyle(0x5f7a4a, 0.9);
      g.fillRect(wx + winW * 0.4 - 4, wy + winH * 0.4, 8, 6);
      g.fillStyle(0xf0e4c0, 0.85);
      for (let i = 0; i < 3; i++) g.fillCircle(wx + winW * 0.72 + i * 7, wy + winH * 0.7, 3);
    } else if (kind === 'window') {
      // a dressed mannequin under a spotlight, the point of a display window
      g.fillStyle(0xfff0cc, 0.34);
      g.fillEllipse(wx + winW * 0.5, wy + winH * 0.2, winW * 0.7, 10);
      g.fillStyle(0x4a5a76, 0.9);
      g.fillRect(wx + winW * 0.42, wy + winH * 0.34, 10, winH * 0.4);
      g.fillStyle(0xd8b89a, 0.9);
      g.fillCircle(wx + winW * 0.47, wy + winH * 0.26, 4);
      g.fillStyle(0x9a7a5a, 0.8);
      g.fillRect(wx + winW * 0.62, wy + winH * 0.42, 8, winH * 0.3);
      g.fillStyle(0xc8a06a, 0.6);
      g.fillRect(wx + winW * 0.18, wy + winH * 0.5, 6, winH * 0.22);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(wx + winW * 0.5, wy + winH * 0.16, 3);
    } else {
      // service desk: a notice board and a row of forms
      g.fillStyle(0xf0e4c4, 0.92);
      g.fillRect(wx + 5, wy + 5, winW - 10, winH - 12);
      g.fillStyle(0x6a6a5a, 0.55);
      for (let i = 0; i < 3; i++) g.fillRect(wx + 8, wy + 9 + i * 6, winW - 16 - (i % 2) * 8, 2);
    }
  };
  dressWindow(winL);
  dressWindow(winR);

  // --- window boxes under both sills
  for (const wx of [winL, winR]) {
    g.fillStyle(WOOD);
    g.fillRect(wx - 3, wy + winH + 5, winW + 6, 9);
    g.fillStyle(WOOD_LIGHT);
    g.fillRect(wx - 3, wy + winH + 5, winW + 6, 2);
    for (let i = 0; i < 5; i++) {
      g.fillStyle(i % 2 ? 0x3d6346 : 0x466b48);
      g.fillCircle(wx + 3 + i * (winW - 4) / 5, wy + winH + 5, 3.4);
    }
  }

  // --- meter box and air-conditioner, the small clutter every wall collects
  g.fillStyle(0x55635f);
  g.fillRect(b.x + 30, wallTop + 28, 15, 19);
  g.fillStyle(0x8d9a95);
  g.fillRect(b.x + 32, wallTop + 30, 11, 9);
  g.fillStyle(0x000000, 0.2);
  g.fillRect(b.x + 30, wallTop + 28, 15, 2);

  const ax = b.x + b.w - 62, ay = wallTop + 30;
  g.fillStyle(0x000000, 0.16);
  g.fillRect(ax + 3, ay + 4, 30, 19);
  g.fillStyle(0x8d9a95);
  g.fillRect(ax, ay, 30, 19);
  g.fillStyle(0x6b7a76);
  g.fillRect(ax, ay, 30, 3);
  g.lineStyle(1, 0x54625f, 0.8);
  g.strokeCircle(ax + 20, ay + 11, 6);
  g.lineBetween(ax + 20, ay + 11, ax + 23, ay + 8);
  g.fillStyle(0x5a6a68, 0.45);
  for (let i = 0; i < 3; i++) g.fillRect(ax + 4 + i * 3, ay + 19, 1, 8 + i * 5);

  // --- a poster pasted between the door and the left window
  g.fillStyle(PAPER, 0.9);
  g.fillRect(b.x + 44, wallTop + 76, 24, 33);
  g.fillStyle(SIGN_COLOR[kind], 0.85);
  g.fillRect(b.x + 47, wallTop + 82, 17, 3);
  g.fillStyle(0x6a6a5a, 0.55);
  g.fillRect(b.x + 47, wallTop + 90, 13, 2);
  g.fillRect(b.x + 47, wallTop + 96, 16, 2);

  // --- the doorway itself: stone frame, two leaves, a transom over them
  const dy0 = bottom - dh;
  g.fillStyle(0xd2c8ac, 0.95);
  g.fillRect(dx - 6, dy0 - 7, 6, dh + 7);
  g.fillRect(dx + dw, dy0 - 7, 6, dh + 7);
  g.fillRect(dx - 6, dy0 - 9, dw + 12, 9);
  g.fillStyle(0xa89c80, 0.7);
  g.fillRect(dx - 6, dy0 - 9, dw + 12, 2);
  g.fillStyle(0x000000, 0.14);
  g.fillRect(dx - 6, dy0 - 7, 2, dh + 7);
  g.fillRect(dx + dw + 4, dy0 - 7, 2, dh + 7);

  const lw = (dw - 4) / 2;
  g.fillStyle(0x8a6a44);
  g.fillRect(dx + 2, dy0 + 4, lw, dh - 9);
  g.fillRect(dx + 4 + lw, dy0 + 4, lw, dh - 9);
  g.fillStyle(0x9c7a4e, 0.6);
  g.fillRect(dx + 2, dy0 + 4, lw, 2);
  g.fillRect(dx + 4 + lw, dy0 + 4, lw, 2);
  g.fillStyle(0xe4bd74, 0.9);
  g.fillRect(dx + 5, dy0 + 8, lw - 5, 22);
  g.fillRect(dx + 7 + lw, dy0 + 8, lw - 5, 22);
  g.fillStyle(0xfff0cc, 0.18);
  g.fillRect(dx + 5, dy0 + 8, lw - 5, 3);
  g.fillRect(dx + 7 + lw, dy0 + 8, lw - 5, 3);
  g.fillStyle(0x000000, 0.18);
  for (let i = 1; i < 3; i++) {
    g.fillRect(dx + 3, dy0 + 34 + i * 8, lw - 1, 1);
    g.fillRect(dx + 5 + lw, dy0 + 34 + i * 8, lw - 1, 1);
  }
  g.fillStyle(0xc9a24a);
  g.fillRect(dx + lw - 1, dy0 + 40, 2, 11);
  g.fillRect(dx + 5 + lw, dy0 + 40, 2, 11);
  g.fillStyle(0xffdc94, 0.5);
  g.fillRect(dx + 3, dy0 + 2, dw - 6, 4);
  g.fillStyle(0x5a5340);
  g.fillRect(dx + 1, bottom - 3, dw - 2, 4);

  // --- goods laid out on the pavement, different for every kind of shop
  if (kind === 'books' || kind === 'grocer') {
    const stack = (sx2: number, cols: number[]) => {
      for (let i = 0; i < 4; i++) {
        g.fillStyle(0x000000, 0.13);
        g.fillRect(sx2 + 3, bottom - 5 - i * 6 + 3, 26, 5);
        g.fillStyle(cols[i % cols.length]);
        g.fillRect(sx2 + i, bottom - 5 - i * 6, 24 - i * 3, 5);
        g.fillStyle(0xd9cbb0, 0.65);
        g.fillRect(sx2 + i, bottom - 5 - i * 6, 24 - i * 3, 1);
      }
    };
    if (kind === 'books') {
      stack(dx - 46, [0x6d3c30, 0x2e4652, 0x545434, 0x7d6c46]);
      stack(dx + dw + 10, [0x6d3c30, 0x2e4652, 0x545434, 0x7d6c46]);
    } else {
      stack(dx - 46, [0x9a7b4a, 0x8a6a3a, 0x6a5a3a, 0xa08a5a]);
      stack(dx + dw + 10, [0x8a6a3a, 0x9a7b4a, 0xa08a5a, 0x6a5a3a]);
      // a barrel of pickles beside the cartons
      const bx2 = dx + dw + 46;
      g.fillStyle(0x000000, 0.14);
      g.fillEllipse(bx2, bottom + 2, 26, 8);
      g.fillStyle(0x7d5738);
      g.fillRect(bx2 - 11, bottom - 20, 22, 20);
      g.fillStyle(0xa07850);
      g.fillEllipse(bx2, bottom - 20, 22, 8);
      g.fillStyle(0x5a3f28, 0.7);
      g.fillRect(bx2 - 11, bottom - 14, 22, 2);
      g.fillRect(bx2 - 11, bottom - 7, 22, 2);
    }
  }

  if (kind === 'books') {
    const abx = dx + dw + 48;
    g.fillStyle(0x000000, 0.14);
    g.fillRect(abx, bottom + 10, 24, 6);
    g.fillStyle(SIGN_COLOR[kind]);
    g.fillPoints([
      { x: abx, y: bottom + 6 }, { x: abx + 20, y: bottom + 6 },
      { x: abx + 17, y: bottom - 16 }, { x: abx + 3, y: bottom - 16 },
    ], true);
    g.fillStyle(PAPER, 0.85);
    g.fillRect(abx + 5, bottom - 13, 12, 3);
    g.fillRect(abx + 5, bottom - 8, 9, 2);
  }

  if (kind === 'service') {
    // an arrow board pointing at the door, and a bench to wait on
    const abx = dx + dw + 40;
    g.fillStyle(0x000000, 0.14);
    g.fillRect(abx + 3, bottom + 6, 22, 6);
    g.fillStyle(0xd9cbb0);
    g.fillRect(abx, bottom - 22, 26, 24);
    g.fillStyle(SIGN_COLOR[kind], 0.9);
    g.fillRect(abx + 4, bottom - 18, 18, 3);
    g.fillRect(abx + 4, bottom - 12, 12, 2);
    g.lineStyle(2, SIGN_COLOR[kind], 0.9);
    g.lineBetween(abx + 6, bottom - 5, abx + 18, bottom - 5);
    g.lineBetween(abx + 18, bottom - 5, abx + 14, bottom - 9);

    const bx3 = dx - 70;
    g.fillStyle(0x000000, 0.14);
    g.fillRect(bx3 + 4, bottom + 2, 56, 7);
    g.fillStyle(WOOD);
    g.fillRect(bx3, bottom - 16, 56, 6);
    g.fillStyle(0x9a7550);
    g.fillRect(bx3, bottom - 10, 56, 8);
    g.fillStyle(0x3d4a4c);
    g.fillRect(bx3 + 4, bottom + 1, 4, 7);
    g.fillRect(bx3 + 48, bottom + 1, 4, 7);
  }

  if (kind === 'arcade') {
    // a rail of bolts wheeled out onto the pavement
    const rx = dx + dw + 40;
    g.fillStyle(0x000000, 0.14);
    g.fillRect(rx, bottom + 4, 44, 6);
    g.fillStyle(0x4a3a52);
    g.fillRect(rx, bottom - 30, 3, 32);
    g.fillRect(rx + 41, bottom - 30, 3, 32);
    g.fillRect(rx, bottom - 30, 44, 3);
    const cloth = [0x9a4a4a, 0x4a6a7a, 0xa08a5a];
    for (let i = 0; i < 4; i++) {
      g.fillStyle(cloth[i % 3], 0.8);
      g.fillRect(rx + 5 + i * 10, bottom - 28, 7, 20 - (i % 2) * 4);
    }
    g.fillStyle(0x2f3a3a);
    g.fillCircle(rx + 4, bottom + 2, 3);
    g.fillCircle(rx + 40, bottom + 2, 3);
  }

  if (kind === 'snack') {
    // stacked steamers on a stand, and a stool to eat on
    const sx3 = dx - 58;
    g.fillStyle(0x000000, 0.14);
    g.fillRect(sx3, bottom + 4, 40, 6);
    g.fillStyle(0x4a3a2a);
    g.fillRect(sx3 + 2, bottom - 12, 3, 16);
    g.fillRect(sx3 + 33, bottom - 12, 3, 16);
    g.fillStyle(0x8a5a3a);
    g.fillRect(sx3, bottom - 16, 38, 5);
    for (let i = 0; i < 2; i++) {
      g.fillStyle(0xa87a50);
      g.fillEllipse(sx3 + 10 + i * 17, bottom - 20, 16, 8);
      g.fillStyle(0xd9c9a0, 0.7);
      g.fillEllipse(sx3 + 10 + i * 17, bottom - 24, 14, 7);
    }
    g.fillStyle(0xfff0d0, 0.22);
    g.fillCircle(sx3 + 10, bottom - 34, 5);
    g.fillCircle(sx3 + 27, bottom - 32, 4);

    g.fillStyle(WOOD);
    g.fillRect(dx + dw + 26, bottom - 12, 18, 4);
    g.fillRect(dx + dw + 28, bottom - 9, 3, 9);
    g.fillRect(dx + dw + 41, bottom - 9, 3, 9);
  }

  if (kind === 'window') {
    // a standing poster board and a bucket of flowers, the kind of clutter that
    // spills out of a display shop rather than a grocer
    const px2 = dx - 54;
    g.fillStyle(0x000000, 0.14);
    g.fillRect(px2 + 3, bottom + 6, 22, 6);
    g.fillStyle(SIGN_COLOR.window);
    g.fillRect(px2, bottom - 26, 26, 28);
    g.fillStyle(0xe8dcc4, 0.92);
    g.fillRect(px2 + 3, bottom - 23, 20, 18);
    g.fillStyle(SIGN_COLOR.window, 0.75);
    g.fillRect(px2 + 5, bottom - 19, 14, 3);
    g.fillRect(px2 + 5, bottom - 13, 10, 2);
    g.fillStyle(0x6a4a3a);
    g.fillRect(px2, bottom - 2, 26, 4);

    const fx = dx + dw + 32;
    g.fillStyle(0x000000, 0.13);
    g.fillRect(fx + 1, bottom + 2, 18, 6);
    g.fillStyle(0x7d5738);
    g.fillRect(fx, bottom - 15, 16, 17);
    g.fillStyle(0x2f6b3a, 0.92);
    for (let i = 0; i < 5; i++) g.fillCircle(fx + 3 + i * 3, bottom - 19 - (i % 2) * 3, 4);
    g.fillStyle(0xc86060, 0.7);
    g.fillCircle(fx + 5, bottom - 22, 2);
    g.fillCircle(fx + 12, bottom - 21, 2);
  }

  if (kind === 'tea') {
    // a low bamboo table and two stools out on the pavement
    const tx = dx + dw + 26;
    g.fillStyle(0x000000, 0.14);
    g.fillRect(tx + 3, bottom + 4, 36, 6);
    g.fillStyle(0xb0985e);
    g.fillRect(tx, bottom - 18, 34, 4);
    g.fillStyle(0x8a7446);
    g.fillRect(tx + 2, bottom - 14, 3, 15);
    g.fillRect(tx + 29, bottom - 14, 3, 15);
    g.fillStyle(0x87a06a, 0.9);
    for (let i = 0; i < 2; i++) {
      const sx4 = tx + 3 + i * 17;
      g.fillRect(sx4, bottom - 8, 9, 3);
      g.fillRect(sx4 + 1, bottom - 5, 2, 6);
      g.fillRect(sx4 + 6, bottom - 5, 2, 6);
    }
    g.fillStyle(0xf2e6c4, 0.95);
    g.fillCircle(tx + 9, bottom - 20, 3);
    g.fillCircle(tx + 18, bottom - 21, 3);
    g.fillCircle(tx + 26, bottom - 19, 2);
  }

  if (kind === 'service' && fh > 150) {
    // a hanging directory for a taller block
    g.fillStyle(0x000000, 0.18);
    g.fillRect(b.x + b.w - 44, wallTop + 52, 30, 40);
    g.fillStyle(0xd9cbb0, 0.9);
    g.fillRect(b.x + b.w - 42, wallTop + 50, 28, 40);
    g.fillStyle(SIGN_COLOR[kind], 0.8);
    for (let i = 0; i < 3; i++) g.fillRect(b.x + b.w - 38, wallTop + 56 + i * 10, 20, 2);
  }

  // --- a lamp over the door, so the threshold reads as the way in
  g.fillStyle(0x2f3a3a);
  g.fillRect(cx - 4, bottom - dh - 26, 8, 9);
  g.fillStyle(0xffd48a, 0.95);
  g.fillRect(cx - 2, bottom - dh - 23, 4, 5);
  g.fillStyle(0xffe9b8, 0.8);
  g.fillRect(cx - 1, bottom - dh - 22, 2, 3);
}
