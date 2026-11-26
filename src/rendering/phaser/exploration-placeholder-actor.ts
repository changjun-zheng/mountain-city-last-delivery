import Phaser from 'phaser';

// STYLE-02A temporary protagonist. A low-detail flat-colour placeholder that
// still satisfies the A-direction identity points: 3.3 heads, 3/4 front with
// both eyes, visible neck, teal coat, one camera and one backpack. It replaces
// the cel-v1 traveller sprite on every map; the real art pass lands 11-29.
const HEIGHT = 88;

const SKIN = 0xd9a889;
const SKIN_DARK = 0xbf886b;
const SKIN_DEEP = 0xa9705a;
const HAIR = 0x2b2320;
const HAIR_LIGHT = 0x40332c;
const COAT = 0x4f8a7e;
const COAT_DARK = 0x3b6a60;
const COAT_LIGHT = 0x6aa798;
const PANTS = 0x24383b;
const PANTS_DARK = 0x1c2e31;
const SHOE = 0x16272a;
const PACK = 0x8a5a3e;
const PACK_DARK = 0x66422d;
const CAMERA = 0x223033;
const LENS = 0x9ed4c8;
const INK = 0x241d1a;

type Graphics = Phaser.GameObjects.Graphics;

export function createPlaceholderActor(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const cast = scene.add.ellipse(-7, 2, 40, 11, 0x0c1818, .16).setRotation(-.1);
  const shadow = scene.add.ellipse(0, 0, 27, 8, 0x0c1818, .38);
  const art = scene.add.graphics();
  const body = scene.add.container(0, 0, [cast, shadow, art]);
  body.setData('art', art);
  return body;
}

export function posePlaceholderActor(
  body: Phaser.GameObjects.Container,
  fx: number, fy: number, stride: number | undefined, gait: 'slow' | 'brisk',
): void {
  const previous = Number(body.getData('direction') ?? 0);
  const horizontal = previous >= 2 ? Math.abs(fx) * 1.2 >= Math.abs(fy) : Math.abs(fx) > Math.abs(fy) * 1.2;
  const dir = horizontal ? (fx < 0 ? 2 : 3) : (fy < 0 ? 1 : 0);
  body.setData('direction', dir);
  const brisk = gait === 'brisk';
  const phase = stride === undefined ? 0 : stride / (brisk ? 30 : 24) * Math.PI;
  const sine = stride === undefined ? 0 : Math.sin(phase);
  const step = sine > .38 ? 1 : sine < -.38 ? -1 : 0;
  const key = `${dir}:${step}:${brisk ? 1 : 0}:${stride === undefined ? 0 : 1}`;
  if (body.getData('pose') === key) return;
  body.setData('pose', key);
  draw(body.getData('art') as Graphics, dir, step, brisk && stride !== undefined, stride !== undefined);
}

function draw(g: Graphics, dir: number, step: number, brisk: boolean, moving: boolean): void {
  g.clear();
  const side = dir === 2 || dir === 3;
  const facing = dir === 3 ? 1 : -1;
  const back = dir === 1;
  // Standing keeps both feet planted; only a mid-stride walking pose lifts one.
  const lift = !moving || step === 0 ? 0 : (brisk ? 3 : 2);
  const bob = moving && step !== 0 ? -.7 : 0;

  // Legs and shoes. The near leg lifts first so a two-pose walk reads at 88px.
  drawLeg(g, -5.5, step >= 1 ? lift : 0, back);
  drawLeg(g, 5.5, step <= -1 ? lift : 0, back);

  // One backpack, behind the coat. On a back view it sits over the coat.
  if (!back) {
    const packX = side ? -facing * 13 : 0;
    if (side) {
      g.fillStyle(PACK_DARK, .95);
      g.fillRoundedRect(packX - 4, -50 + bob, 9, 21, 3);
    } else {
      g.fillStyle(PACK_DARK, .9);
      g.fillRoundedRect(-16, -49 + bob, 5, 17, 2);
      g.fillRoundedRect(11, -49 + bob, 5, 17, 2);
    }
  }

  // Coat: shoulders wider than the waist, one darker right panel, hem band.
  const half = side ? 9 : 12;
  g.fillStyle(COAT);
  g.fillRoundedRect(-half, -53 + bob, half * 2, 28, 5);
  if (!side) {
    g.fillStyle(COAT_DARK, .9);
    g.fillRoundedRect(2, -53 + bob, half - 2, 28, 4);
  }
  g.fillStyle(COAT_DARK);
  g.fillRoundedRect(-half, -28 + bob, half * 2, 5, 2);
  g.fillStyle(COAT_LIGHT, .8);
  g.fillRoundedRect(-half + 1, -53 + bob, 2.5, 22, 1);

  // Arms swing opposite the legs, hands just below the coat cuff.
  drawArm(g, -half - 2, -step * 2, bob, false);
  drawArm(g, half - 1, step * 2, bob, true);

  // Neck and head share one skin block; the neck stays visibly open.
  g.fillStyle(SKIN_DARK);
  g.fillRoundedRect(-4, -58, 8, 7, 2);
  g.fillStyle(SKIN);
  g.fillEllipse(0, -70 + bob, 23, 27);

  if (back) {
    g.fillStyle(HAIR);
    g.fillEllipse(0, -72 + bob, 24, 25);
    g.fillStyle(HAIR_LIGHT, .55);
    g.fillEllipse(0, -78 + bob, 16, 9);
  } else {
    // 3/4 front: both eyes, the far one smaller and darker.
    drawHair(g, dir, bob);
    const nearX = side ? facing * 1.6 : 0;
    const nearEyeX = side ? facing * 3.1 : -4.0;
    const farEyeX = side ? -facing * 4.2 : 4.0;
    g.fillStyle(INK);
    g.fillCircle(nearX + nearEyeX, -69.5 + bob, side ? 1.9 : 1.8);
    g.fillStyle(INK, side ? .72 : 1);
    g.fillCircle(nearX + farEyeX, -69.3 + bob, side ? 1.5 : 1.8);
    g.lineStyle(1, 0x5a4232, .9);
    g.lineBetween(nearX - 6.4, -73.6 + bob, nearX - 2.2, -73.7 + bob);
    g.lineBetween(nearX + 2.2, -73.7 + bob, nearX + 6.2, -73.5 + bob);
    g.fillStyle(SKIN_DEEP, .75);
    g.fillEllipse(nearX, -66.6 + bob, 4, 2.4);
    g.lineStyle(1.2, 0x9c604c, .95);
    g.lineBetween(nearX - 2.1, -63.4 + bob, nearX + 2.1, -63.2 + bob);
    // Camera at the chest, with a teal lens and no extra straps.
    g.fillStyle(CAMERA);
    g.fillRoundedRect(nearX - 7, -45 + bob, 14, 9, 2);
    g.fillStyle(LENS);
    g.fillCircle(nearX, -40.5 + bob, 3.1);
    g.fillStyle(INK);
    g.fillCircle(nearX, -40.5 + bob, 1.3);
  }

  if (back) {
    // The pack is the silhouette on a back view: flap, body, one strap loop.
    g.fillStyle(PACK);
    g.fillRoundedRect(-8, -51 + bob, 16, 21, 4);
    g.fillStyle(PACK_DARK);
    g.fillRoundedRect(-8, -51 + bob, 16, 6, 3);
    g.fillStyle(0xb07a54, .75);
    g.fillRoundedRect(-5, -42 + bob, 10, 3, 1.5);
    g.lineStyle(1.4, PACK_DARK, .9);
    g.lineBetween(-6, -51 + bob, -6, -30 + bob);
    g.lineBetween(6, -51 + bob, 6, -30 + bob);
  }
}

function drawLeg(g: Graphics, x: number, lift: number, back: boolean): void {
  g.fillStyle(back ? PANTS_DARK : PANTS);
  g.fillRoundedRect(x - 3.4, -27 - lift, 6.8, 24 + lift, 3);
  g.fillStyle(SHOE);
  g.fillRoundedRect(x - 4.1, -4 - lift * .3, 8.2, 5, 2);
}

function drawArm(g: Graphics, x: number, swing: number, bob: number, dark: boolean): void {
  g.fillStyle(dark ? COAT_DARK : COAT);
  g.fillRoundedRect(x, -51 + bob + swing * .5, 5.4, 18, 2.5);
  g.fillStyle(dark ? SKIN_DARK : SKIN);
  g.fillCircle(x + 2.7, -32 + bob + swing * .5, 2.8);
}

function drawHair(g: Graphics, dir: number, bob: number): void {
  // Cap plus side locks; the fringe stops above the eyes on a front view.
  g.fillStyle(HAIR);
  g.fillEllipse(0, -78 + bob, 24, 14);
  const s = dir === 3 ? 1 : dir === 2 ? -1 : 0;
  if (s === 0) {
    g.fillRoundedRect(-11.5, -78 + bob, 3.5, 9, 1.5);
    g.fillRoundedRect(8, -78 + bob, 3.5, 9, 1.5);
    g.fillTriangle(-9, -76 + bob, -2, -70.8 + bob, 2, -76 + bob);
  } else {
    g.fillRoundedRect(s > 0 ? -12 : 8.5, -78 + bob, 3.5, 11, 1.5);
    g.fillTriangle(s > 0 ? -10 : 3, -76 + bob, s > 0 ? -4 : 4, -70.6 + bob, s > 0 ? 0 : 8, -76 + bob);
  }
  g.fillStyle(HAIR_LIGHT, .5);
  g.fillEllipse(-2, -80 + bob, 13, 5);
}

export const PLACEHOLDER_HEIGHT = HEIGHT;
