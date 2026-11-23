import Phaser from 'phaser';

// Extra dressing for one specific shopfront. The generic box only knows how to
// stand a wall up; a shop needs to say what it sells from across the street.
type Box = { x: number; y: number; w: number; h: number };

const WOOD = 0x6b4b31;
const WOOD_LIGHT = 0x8d6744;
const PAPER = 0xe6d8b6;

/**
 * Bookshop facade: painted sign board under the eave, shelves glimpsed through
 * the two windows, the meter box and drainpipe every old building has, and book
 * stock piled on the pavement either side of the door.
 */
export function bookshopFront(
  g: Phaser.GameObjects.Graphics,
  b: Box, wallTop: number, fh: number,
): void {
  const bottom = b.y + b.h;
  const cx = b.x + b.w / 2;
  const dw = Math.min(72, Math.max(48, b.w * 0.19));
  const dx = cx - dw / 2;
  const dh = Math.min(76, Math.max(52, fh * 0.56));
  const winW = Math.min(46, Math.max(26, dw * 0.8));
  const winH = Math.min(30, fh * 0.22);
  const wy = wallTop + fh * 0.16;
  const winL = cx - dw / 2 - 16 - winW;
  const winR = cx + dw / 2 + 16;

  // --- drainpipe down the left edge, with its shoe at the base
  g.fillStyle(0x78857f, 0.85);
  g.fillRect(b.x + 9, wallTop + 5, 5, fh - 8);
  g.fillStyle(0x56615d, 0.6);
  g.fillRect(b.x + 9, wallTop + 5, 2, fh - 8);
  g.fillStyle(0x4a5652);
  g.fillRect(b.x + 6, bottom - 11, 11, 7);

  // --- painted sign board, the text is laid over it by the caller
  const sw = b.w * 0.6, sx = cx - sw / 2, sh = 24, sy = wallTop + 3;
  g.fillStyle(0x22201c, 0.22);
  g.fillRect(sx - 2, sy + 2, sw + 4, sh + 4);
  g.fillStyle(0x2f4a4c);
  g.fillRect(sx, sy, sw, sh);
  g.fillStyle(0x000000, 0.2);
  g.fillRect(sx, sy + sh - 5, sw, 5);
  g.fillStyle(0xdcd0b2, 0.75);
  g.fillRect(sx + 3, sy + 3, sw - 6, 1);
  g.lineStyle(2, 0xd9c9a0, 0.6);
  g.strokeRect(sx + 2, sy + 2, sw - 4, sh - 4);

  // --- shelves seen through the glass: rows of spines behind the frame
  const shelf = (wx: number) => {
    g.fillStyle(0x2a2420, 0.5);
    for (let i = 1; i < 4; i++) g.fillRect(wx + 3, wy + 3 + i * (winH - 6) / 4, winW - 6, 2);
    for (let i = 0; i < 5; i++) {
      const bx = wx + 5 + i * (winW - 10) / 5;
      g.fillStyle(i % 2 ? 0x5a3f30 : 0x37474a, 0.55);
      g.fillRect(bx, wy + 5, 3, winH - 10);
    }
  };
  shelf(winL);
  shelf(winR);

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
  g.fillStyle(0x8a5a4a, 0.9);
  g.fillRect(b.x + 47, wallTop + 82, 17, 3);
  g.fillStyle(0x6a6a5a, 0.55);
  g.fillRect(b.x + 47, wallTop + 90, 13, 2);
  g.fillRect(b.x + 47, wallTop + 96, 16, 2);

  // --- stacks of stock waiting to go in, either side of the threshold
  const stack = (sx: number) => {
    const cols = [0x6d3c30, 0x2e4652, 0x545434, 0x7d6c46];
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x000000, 0.13);
      g.fillRect(sx + 3, bottom - 5 - i * 6 + 3, 26, 5);
      g.fillStyle(cols[i % 4]);
      g.fillRect(sx + i, bottom - 5 - i * 6, 24 - i * 3, 5);
      g.fillStyle(0xd9cbb0, 0.65);
      g.fillRect(sx + i, bottom - 5 - i * 6, 24 - i * 3, 1);
    }
  };
  stack(dx - 46);
  stack(dx + dw + 10);

  // --- A-board on the pavement, advertising whatever is new this week
  const abx = dx + dw + 48;
  g.fillStyle(0x000000, 0.14);
  g.fillRect(abx, bottom + 10, 24, 6);
  g.fillStyle(0x2f4a4c);
  g.fillPoints([
    { x: abx, y: bottom + 6 }, { x: abx + 20, y: bottom + 6 },
    { x: abx + 17, y: bottom - 16 }, { x: abx + 3, y: bottom - 16 },
  ], true);
  g.fillStyle(PAPER, 0.85);
  g.fillRect(abx + 5, bottom - 13, 12, 3);
  g.fillRect(abx + 5, bottom - 8, 9, 2);

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
  // leaves, set a little inside the opening so the frame reads as thick stone
  g.fillStyle(0x6a5236);
  g.fillRect(dx + 2, dy0 + 4, lw, dh - 9);
  g.fillRect(dx + 4 + lw, dy0 + 4, lw, dh - 9);
  // glazing across the upper half of each leaf, lit from inside the shop
  g.fillStyle(0xe4bd74, 0.9);
  g.fillRect(dx + 5, dy0 + 8, lw - 5, 22);
  g.fillRect(dx + 7 + lw, dy0 + 8, lw - 5, 22);
  g.fillStyle(0xfff0cc, 0.18);
  g.fillRect(dx + 5, dy0 + 8, lw - 5, 3);
  g.fillRect(dx + 7 + lw, dy0 + 8, lw - 5, 3);
  // plank joints on the lower half
  g.fillStyle(0x000000, 0.18);
  for (let i = 1; i < 3; i++) {
    g.fillRect(dx + 3, dy0 + 34 + i * 8, lw - 1, 1);
    g.fillRect(dx + 5 + lw, dy0 + 34 + i * 8, lw - 1, 1);
  }
  // handles either side of the centre seam
  g.fillStyle(0xc9a24a);
  g.fillRect(dx + lw - 1, dy0 + 40, 2, 11);
  g.fillRect(dx + 5 + lw, dy0 + 40, 2, 11);
  // transom light above the leaves
  g.fillStyle(0xffdc94, 0.5);
  g.fillRect(dx + 3, dy0 + 2, dw - 6, 4);
  // threshold stone
  g.fillStyle(0x5a5340);
  g.fillRect(dx + 1, bottom - 3, dw - 2, 4);

  // --- a lamp over the door, so the threshold reads as the way in
  g.fillStyle(0x2f3a3a);
  g.fillRect(cx - 4, bottom - dh - 26, 8, 9);
  g.fillStyle(0xffd48a, 0.95);
  g.fillRect(cx - 2, bottom - dh - 23, 4, 5);
  g.fillStyle(0xffe9b8, 0.8);
  g.fillRect(cx - 1, bottom - dh - 22, 2, 3);
}
