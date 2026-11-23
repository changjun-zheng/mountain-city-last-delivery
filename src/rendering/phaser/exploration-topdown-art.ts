import Phaser from 'phaser';
import { plaster, tileRoof } from './exploration-paint';

// Tilted top-down projection primitives.
//
// A building is one box: the footprint equals the collision rectangle, the front
// wall stands on the lower part of it, the roof sits directly above the wall at
// the same width but compressed, and a thin side face on the right gives the box
// thickness. The ground stays an orthographic plane, so streets never converge.
//
// Depth: the whole building is drawn at depth y + h (its front edge), the actor
// at its foot y. Walking north of the front edge puts the actor behind the block.
export type Box = { x: number; y: number; w: number; h: number };

export type BuildingStyle = {
  roof: number;
  ridge: number;
  wall: number;
  eave: number;
  ground: number;
  door: number;
  tile?: boolean;
  doorInset?: number;
  facade?: number;
  facadeLine?: number;
  side?: number;
  /** Optional cap on front-wall height, for the odd block that should read taller. */
  fhCap?: number;
  /** Optional wall/footprint ratio, default 0.55. Raising it squeezes the roof. */
  fhRatio?: number;
  /** Set when a shopfront draws its own display windows instead of the generic pair. */
  skipWindows?: boolean;
};

export type RoomStyle = {
  floor: number;
  floorLine: number;
  wall: number;
  wallTop: number;
  outside: number;
  doorway: number;
  propTop: number;
  propEdge: number;
  propLine: number;
  wallBand?: number;
  frontWall?: number;
};

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const c = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | c;
}

/** Front wall height, roof height and side thickness for a footprint. */
export function tiltedProportions(b: Box, style: BuildingStyle) {
  const fh = Math.min(style.fhCap ?? 140, Math.max(76, b.h * (style.fhRatio ?? 0.55)));
  // roof runs from the wall top up to the footprint's back edge, so the block
  // fills its footprint instead of leaving a dark strip above the roof
  const rd = Math.max(fh * 0.6, Math.min(b.h - fh, fh * 1.15));
  const sw = style.side ?? Math.min(18, Math.max(10, b.w * 0.03));
  return { fh, rd, sw };
}

/**
 * A building seen from a tilted top-down view: roof plane on top, front wall
 * below it with the doorway cut through, eave line between them, and one thin
 * side face. `b` is the footprint and therefore the collision rectangle.
 */
export function drawTopDownBuilding(g: Phaser.GameObjects.Graphics, b: Box, st: BuildingStyle): void {
  const { fh, rd, sw } = tiltedProportions(b, st);
  const bottom = b.y + b.h;
  const wallTop = bottom - fh;
  const facade = st.facade ?? mix(mix(st.eave, st.roof, 0.3), 0xdccbaa, 0.45);
  const facadeLine = st.facadeLine ?? mix(st.roof, 0x000000, 0.2);
  const side = mix(facade, st.roof, 0.72);
  const dw = Math.min(72, Math.max(48, b.w * 0.19));
  const dh = Math.min(76, Math.max(52, fh * 0.56));

  // contact shadow so the block sits on the paving instead of floating on it;
  // the fade runs about 45px out, which is what lets the lamp pools read against it
  for (let i = 0; i < 4; i++) {
    const t = 1 - i / 4;
    g.fillStyle(0x16282a, 0.14 * t * t);
    g.fillRect(b.x + 4 + i * 7, bottom + 2 + i * 8, b.w - 8 - i * 12, 9);
  }
  g.fillStyle(0x1a2a2c, 0.12);
  g.fillRect(b.x + b.w, wallTop + 10, 10, fh - 8);

  // footprint, slightly darker than the facade so the wall base reads on the ground
  g.fillStyle(mix(facade, 0x000000, 0.35));
  g.fillRect(b.x, b.y, b.w, b.h);

  // side face on the right of the front wall only, never a whole extruded side
  g.fillStyle(side);
  g.fillPoints([
    { x: b.x + b.w, y: wallTop },
    { x: b.x + b.w + sw, y: wallTop - sw * 0.55 },
    { x: b.x + b.w + sw, y: bottom },
    { x: b.x + b.w, y: bottom },
  ], true);

  // front wall: painted plaster, joints, grime at the base
  plaster(g, b.x, wallTop, b.w, fh, facade, mix(facade, 0xffffff, 0.26), mix(facade, 0x000000, 0.32));
  // low western sun: the left edge of every wall catches a warm rim, which is
  // what gives a flat elevation a direction of light
  g.fillStyle(0xffd49a, 0.17);
  g.fillRect(b.x, wallTop, 9, fh);
  g.fillStyle(0xffe6c0, 0.1);
  g.fillRect(b.x + 9, wallTop, 6, fh);
  // plinth: the last stretch of wall above the paving goes dark, so the base
  // grips the ground instead of ending in a straight cut
  g.fillStyle(mix(facade, 0x2c2a22, 0.55), 0.5);
  g.fillRect(b.x, bottom - 13, b.w, 13);
  g.fillStyle(mix(facade, 0xffffff, 0.2), 0.32);
  g.fillRect(b.x, bottom - 15, b.w, 2);
  // Faint piers instead of course lines: a long wall should read as bays, not
  // as a shutter with slats.
  g.lineStyle(1, facadeLine, 0.13);
  for (let x = b.x + 110; x < b.x + b.w - 40; x += 110) g.lineBetween(x, wallTop + 9, x, bottom - 15);
  // wall corners
  g.lineStyle(2, facadeLine, 0.5);
  g.lineBetween(b.x, wallTop, b.x, bottom);
  g.lineBetween(b.x + b.w, wallTop, b.x + b.w, bottom);

  // eave line, the single cue that separates wall from roof
  g.fillStyle(mix(st.eave, facade, 0.2));
  g.fillRect(b.x - 5, wallTop - 8, b.w + 10, 9);

  // eave shadow: the wall darkens just under the overhang, which is what gives
  // the block its height without falling back on perspective
  for (let i = 0; i < 6; i++) {
    g.fillStyle(mix(st.roof, 0x000000, 0.6), 0.18 * (1 - i / 6));
    g.fillRect(b.x, wallTop + 1 + i * 4, b.w, 4);
  }

  // roof plane: tile rows, lit ridge, shaded right edge
  const roofTop = wallTop - rd;
  tileRoof(g, b.x, roofTop, b.w, rd, st.roof, mix(st.roof, 0x000000, 0.62), mix(st.roof, 0xffffff, 0.32));
  g.lineStyle(2, mix(st.roof, 0x000000, 0.5), 0.55);
  g.strokeRect(b.x, roofTop, b.w, rd);
  // roof shadow onto the wall, keeps the roof from looking pasted on
  g.fillStyle(mix(st.roof, 0x000000, 0.35), 0.35);
  g.fillRect(b.x, wallTop, b.w, 4);

  // doorway cut into the front wall, bottom flush with the ground line
  const dx = b.x + b.w / 2 - dw / 2;
  g.fillStyle(mix(st.roof, 0x000000, 0.55));
  g.fillRect(dx, bottom - dh, dw, dh);
  g.fillStyle(mix(st.door, 0x000000, 0.12));
  g.fillRect(dx + 4, bottom - dh + 4, dw - 8, dh - 6);
  // lit interior: a warm strip on the threshold and a thinner one under the lintel
  g.fillStyle(0xffc97c, 0.42);
  g.fillRect(dx + 4, bottom - 9, dw - 8, 5);
  g.fillStyle(0xffe4b0, 0.28);
  g.fillRect(dx + 4, bottom - dh + 5, dw - 8, 3);
  g.lineStyle(2, st.eave);
  g.lineBetween(dx, bottom - dh, dx, bottom);
  g.lineBetween(dx + dw, bottom - dh, dx + dw, bottom);
  // shallow threshold on the ground, not a staircase
  g.fillStyle(st.eave, 0.8);
  g.fillRect(dx - 8, bottom, dw + 16, 5);

  // windows on the front wall, one each side of the doorway where there is room.
  // Shopfronts draw their own display windows, so they skip this pass entirely.
  if (!st.skipWindows) {
  const winW = Math.min(46, Math.max(26, dw * 0.8));
  const winH = Math.min(30, fh * 0.22);
  const wy = wallTop + fh * 0.16;
  const glass = mix(facade, 0x24444e, 0.6);
  const frame = mix(st.roof, 0x000000, 0.45);
  const pane = (wx: number) => {
    // Some windows are lit, some are not; that mix is what stops a row of shops
    // from looking like one repeated decal.
    const lit = Math.floor((wx + b.y) * 0.7) % 10 < 6;
    if (lit) {
      g.fillStyle(0xffcf86, 0.1);
      g.fillRect(wx - 7, wy - 6, winW + 14, winH + 18);
    }
    g.fillStyle(frame);
    g.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);
    g.fillStyle(lit ? mix(0xf0bd6c, glass, 0.2) : glass);
    g.fillRect(wx, wy, winW, winH);
    if (lit) {
      g.fillStyle(0xffdc94, 0.42);
      g.fillRect(wx + 2, wy + 2, winW - 4, winH - 4);
    }
    g.lineStyle(1, mix(st.eave, facade, 0.3), 0.8);
    g.lineBetween(wx + winW / 2, wy, wx + winW / 2, wy + winH);
    g.lineBetween(wx, wy + winH / 2, wx + winW, wy + winH / 2);
    g.fillStyle(mix(st.eave, facade, 0.2), 0.5);
    g.fillRect(wx - 4, wy + winH + 2, winW + 8, 4);
  };
  const gapSide = dw / 2 + 16;
  if (b.w / 2 - gapSide - winW > 14) {
    pane(b.x + b.w / 2 - gapSide - winW);
    pane(b.x + b.w / 2 + gapSide);
  } else if (b.w - dw > winW + 26) {
    pane(dx + dw + 14);
  }
  }
}

/** A roof plane for a storey you can see but not walk on (the storey below a cliff). */
export function drawTopDownRoofPlane(g: Phaser.GameObjects.Graphics, b: Box, roof: number, line: number, eave: number): void {
  g.fillStyle(eave);
  g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle(roof);
  g.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  g.lineStyle(1, line, 0.4);
  for (let y = b.y + 14; y < b.y + b.h - 8; y += 10) g.lineBetween(b.x + 9, y, b.x + b.w - 9, y);
  g.lineStyle(2, line, 0.7);
  g.lineBetween(b.x + 12, b.y + b.h / 2, b.x + b.w - 12, b.y + b.h / 2);
}

/**
 * A room seen from above: floor plane, three wall bands with a lit cap, a real
 * front wall carrying the exit, and props with a top face plus front face.
 */
export function drawTopDownRoom(
  g: Phaser.GameObjects.Graphics,
  r: Box,
  walls: readonly Box[],
  st: RoomStyle,
): void {
  const band = st.wallBand ?? 16;
  const front = Math.min(92, Math.max(64, r.h * 0.24));
  const gap = Math.min(104, Math.max(70, r.w * 0.17));
  const cx = r.x + r.w / 2;
  const frontTop = r.y + r.h - front;
  const frontColor = st.frontWall ?? mix(st.wallTop, st.wall, 0.35);
  const frontLine = mix(st.wall, 0x000000, 0.3);

  // floor
  g.fillStyle(st.floor);
  g.fillRect(r.x, r.y, r.w, r.h);
  g.lineStyle(1, st.floorLine, 0.4);
  for (let y = r.y + 8; y < frontTop; y += 13) g.lineBetween(r.x, y, r.x + r.w, y);

  // ground just outside the exit
  g.fillStyle(st.outside);
  g.fillRect(cx - gap / 2, r.y + r.h, gap, 30);
  g.lineStyle(2, st.wallTop);
  g.lineBetween(cx - gap / 2, r.y + r.h, cx - gap / 2, r.y + r.h + 30);
  g.lineBetween(cx + gap / 2, r.y + r.h, cx + gap / 2, r.y + r.h + 30);
  g.lineBetween(cx - gap / 2, r.y + r.h + 30, cx + gap / 2, r.y + r.h + 30);

  // front wall, exit opening cut down to the floor line
  g.fillStyle(frontColor);
  g.fillRect(r.x, frontTop, cx - gap / 2 - r.x, front);
  g.fillRect(cx + gap / 2, frontTop, r.x + r.w - cx - gap / 2, front);
  g.lineStyle(1, frontLine, 0.3);
  for (let y = frontTop + 18; y < r.y + r.h - 8; y += 24) {
    g.lineBetween(r.x + 4, y, cx - gap / 2 - 4, y);
    g.lineBetween(cx + gap / 2 + 4, y, r.x + r.w - 4, y);
  }
  g.fillStyle(mix(st.wallTop, 0xffffff, 0.15));
  g.fillRect(r.x, frontTop, r.w, 7);
  g.fillStyle(frontLine, 0.6);
  g.fillRect(r.x, r.y + r.h - 6, r.w, 6);
  g.lineStyle(2, st.wall);
  g.lineBetween(cx - gap / 2, frontTop, cx - gap / 2, r.y + r.h);
  g.lineBetween(cx + gap / 2, frontTop, cx + gap / 2, r.y + r.h);
  // exit floor strip
  g.fillStyle(st.doorway, 0.9);
  g.fillRect(cx - gap / 2 + 4, frontTop + 4, gap - 8, 4);

  // back and side wall bands, with a lit cap on the outer edge
  g.fillStyle(st.wallTop);
  g.fillRect(r.x, r.y, r.w, band);
  g.fillRect(r.x, r.y, band, r.h - front);
  g.fillRect(r.x + r.w - band, r.y, band, r.h - front);
  g.fillStyle(mix(st.wallTop, 0xffffff, 0.2));
  g.fillRect(r.x, r.y, r.w, 5);
  g.fillRect(r.x, r.y, 5, r.h - front);
  g.fillRect(r.x + r.w - 5, r.y, 5, r.h - front);
  g.lineStyle(2, st.wall);
  g.strokeRect(r.x, r.y, r.w, r.h);
  g.lineStyle(1, st.wall, 0.7);
  g.strokeRect(r.x + band, r.y + band, r.w - band * 2, r.h - front - band);

  // props keep their collision footprint, drawn as a solid with a top face
  for (const w of walls) drawTopDownProp(g, w, st);
}

/** A prop as footprint plus top face plus a front face; the rectangle is the blocker. */
export function drawTopDownProp(g: Phaser.GameObjects.Graphics, w: Box, st: RoomStyle): void {
  const face = Math.min(12, Math.max(6, w.h * 0.18));
  g.fillStyle(st.propEdge);
  g.fillRect(w.x - 2, w.y - 2, w.w + 4, w.h + 4);
  g.fillStyle(mix(st.propTop, 0x000000, 0.3));
  g.fillRect(w.x, w.y + w.h - face, w.w, face);
  g.fillStyle(st.propTop);
  g.fillRect(w.x, w.y, w.w, w.h - face);
  g.lineStyle(1, st.propLine, 0.8);
  g.strokeRect(w.x + 3, w.y + 3, w.w - 6, w.h - face - 3);
}
