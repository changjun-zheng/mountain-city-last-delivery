import Phaser from 'phaser';
import { EXP_MAPS, EXP_TARGETS, type Rect } from '../../core/exploration-content';
import type { ExplorationSnapshot } from '../../core/exploration';
import pavingUrl from './assets/sunset-sample-v1/stone-paving.webp';
import timberUrl from './assets/sunset-sample-v1/timber-floor.webp';
import grainUrl from './assets/sunset-sample-v1/timber-grain.webp';
import plasterUrl from './assets/sunset-sample-v1/lime-plaster.webp';
import roofUrl from './assets/sunset-sample-v1/roof-tiles.webp';
import guideUrl from './assets/sunset-sample-v1/guide-building.webp';
import woodUrl from './assets/sunset-sample-v1/workshop-building.webp';
import galleryUrl from './assets/sunset-sample-v1/gallery-building.webp';
import skylineUrl from './assets/sunset-sample-v1/city-haze.webp';
import windowUrl from './assets/sunset-sample-v1/sunlit-window.webp';
import deskUrl from './assets/sunset-sample-v1/reading-desk.webp';
import actorUrl from './assets/sunset-sample-v1/traveller-directions.webp';

// A bounded art sample: no content, camera, input, save or collision authority.
// All feet, furniture, doors and stair targets use the existing map definitions.
const PREFIX = 'sunset-sample-';
const assets = {
  paving: pavingUrl, timber: timberUrl, grain: grainUrl, plaster: plasterUrl,
  roof: roofUrl, guide: guideUrl, workshop: woodUrl, gallery: galleryUrl,
  skyline: skylineUrl, window: windowUrl, desk: deskUrl,
};
const key = (name: string) => PREFIX + name;
export const isSunsetSample = (map: string): boolean => map === 'upper' || map === 'guide2';

export function preloadSunsetSample(scene: Phaser.Scene, failed: (error: Error) => void): void {
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    if (file.key.startsWith(PREFIX)) failed(new Error(`Sunset sample asset failed to load: ${file.key}`));
  });
  for (const [name, url] of Object.entries(assets)) scene.load.image(key(name), url);
  scene.load.spritesheet(key('traveller'), actorUrl, { frameWidth: 96, frameHeight: 80 });
}

export function createSunsetActor(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const shadow = scene.add.ellipse(0, 0, 25, 9, 0x222d30, .25);
  const sprite = scene.add.sprite(0, 0, key('traveller'), 0).setOrigin(.5, 76 / 80);
  const body = scene.add.container(0, 0, [shadow, sprite]);
  body.setData('sprite', sprite);
  return body;
}

export function faceSunsetActor(body: Phaser.GameObjects.Container, fx: number, fy: number): void {
  const frame = Math.abs(fy) >= Math.abs(fx) ? (fy < 0 ? 1 : 0) : (fx < 0 ? 2 : 3);
  (body.getData('sprite') as Phaser.GameObjects.Sprite).setFrame(frame);
}

type Art = ReturnType<typeof artHelpers>;
function artHelpers(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
  const image = (name: string, x: number, y: number, w: number, h: number, depth: number) => {
    const result = scene.add.image(x, y, key(name)).setOrigin(0).setDisplaySize(w, h).setDepth(depth);
    layer.add(result);
    return result;
  };
  const tile = (name: string, b: Rect, depth: number, scale = .5) => {
    const result = scene.add.tileSprite(b.x, b.y, b.w, b.h, key(name))
      .setOrigin(0).setTileScale(scale).setDepth(depth);
    layer.add(result);
    return result;
  };
  const graphics = (depth: number) => {
    const result = scene.add.graphics().setDepth(depth); layer.add(result); return result;
  };
  const label = (x: number, y: number, value: string, size = 16, depth = y + 5) => {
    const result = scene.add.text(x, y, value, {
      fontFamily: 'KaiTi, STKaiti, Microsoft YaHei, serif', fontSize: `${size}px`,
      color: '#f6e4be', align: 'center', stroke: '#302c26', strokeThickness: 3,
    }).setOrigin(.5).setDepth(depth);
    layer.add(result); return result;
  };
  return { scene, layer, image, tile, graphics, label };
}

/** Static painted lighting is cached once per map; no extra timers or per-frame rebuilds. */
function lightTexture(scene: Phaser.Scene, name: 'upper' | 'guide2'): string {
  const id = key(`${name}-light`);
  if (scene.textures.exists(id)) return id;
  const { width, height } = EXP_MAPS[name];
  const texture = scene.textures.createCanvas(id, width, height);
  if (!texture) throw new Error('Unable to allocate sunset lighting texture');
  const c = texture.context;
  const shade = c.createLinearGradient(0, 0, width, height);
  shade.addColorStop(0, 'rgba(255,215,141,.20)');
  shade.addColorStop(.45, 'rgba(130,143,148,.02)');
  shade.addColorStop(1, 'rgba(29,48,67,.33)');
  c.fillStyle = shade; c.fillRect(0, 0, width, height);
  if (name === 'upper') {
    // Feathered eave shade on the real street. No fabricated scenery blockers.
    for (const b of EXP_MAPS.upper.buildings) {
      c.save(); c.filter = 'blur(9px)'; c.fillStyle = 'rgba(28,39,46,.20)';
      c.beginPath(); c.moveTo(b.x + 10, b.y + b.h);
      c.lineTo(b.x + b.w, b.y + b.h);
      c.lineTo(b.x + b.w + 126, b.y + b.h + 113);
      c.lineTo(b.x + 133, b.y + b.h + 113); c.closePath(); c.fill(); c.restore();
    }
    const sunlight = c.createRadialGradient(560, 550, 25, 560, 550, 640);
    sunlight.addColorStop(0, 'rgba(255,218,148,.17)');
    sunlight.addColorStop(1, 'rgba(255,218,148,0)');
    c.fillStyle = sunlight; c.fillRect(0, 200, width, height - 200);
    // Soft foliage silhouettes from outside the playable bounds, not solid trees
    // added to an empty route. Shadows are static and don't imply collision.
    c.save(); c.filter = 'blur(6px)';
    for (let i = 0; i < 96; i++) {
      const x = 70 + Math.sin(i * 4.9) * 180 + (i % 6) * 26;
      const y = 300 + i * 8 + Math.cos(i * 1.7) * 90;
      c.fillStyle = `rgba(29,45,44,${.055 + (i % 3) * .018})`;
      c.beginPath(); c.ellipse(x, y, 25 + i % 21, 10 + i % 12, -.6, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  } else {
    const pool = c.createRadialGradient(330, 245, 10, 450, 420, 650);
    pool.addColorStop(0, 'rgba(255,221,153,.24)');
    pool.addColorStop(.6, 'rgba(232,186,112,.05)');
    pool.addColorStop(1, 'rgba(18,25,31,.22)');
    c.fillStyle = pool; c.fillRect(0, 0, width, height);
    for (const wx of [290, 870]) {
      c.save(); c.filter = 'blur(2px)';
      for (let column = 0; column < 3; column++) for (let row = 0; row < 3; row++) {
        const x = wx + column * 30 + row * 20;
        const y = 190 + row * 85;
        c.fillStyle = `rgba(255,222,157,${.16 - row * .028})`;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 25, y); c.lineTo(x + 51, y + 78); c.lineTo(x + 22, y + 78); c.closePath(); c.fill();
      }
      c.restore();
    }
  }
  texture.refresh(); return id;
}

function placeLighting(a: Art, name: 'upper' | 'guide2'): void {
  const light = a.scene.add.image(0, 0, lightTexture(a.scene, name)).setOrigin(0).setDepth(15000);
  a.layer.add(light);
}

function stairs(a: Art, x: number, y: number, w: number, h: number, depth: number): void {
  a.tile('paving', { x, y, w, h }, depth, .35);
  const g = a.graphics(depth + 1);
  const steps = Math.max(5, Math.round(h / 18));
  for (let i = 0; i < steps; i++) {
    const py = y + i * h / steps;
    g.fillStyle(0x283537, .35); g.fillRect(x, py + h / steps - 5, w, 5);
    g.lineStyle(2, 0xd8c6a0, .7); g.lineBetween(x + 2, py + 1, x + w - 2, py + 1);
  }
  g.lineStyle(5, 0x4c4435); g.lineBetween(x - 3, y, x - 3, y + h); g.lineBetween(x + w + 3, y, x + w + 3, y + h);
  g.lineStyle(1, 0xd0ac72); g.lineBetween(x - 4, y, x - 4, y + h); g.lineBetween(x + w + 2, y, x + w + 2, y + h);
}

function retainingWall(a: Art, b: Rect): void {
  a.tile('paving', b, b.y, .5).setTint(0x78847f);
  const g = a.graphics(b.y + 1);
  g.fillStyle(0x283532, .30); g.fillRect(b.x, b.y + 10, b.w, b.h - 10);
  for (let y = b.y + 38; y < b.y + b.h; y += 38) {
    g.lineStyle(2, 0x2f3935, .55); g.lineBetween(b.x, y, b.x + b.w, y);
  }
  g.fillStyle(0xbab299); g.fillRect(b.x, b.y, b.w, 9);
  g.fillStyle(0xe0ccb0, .6); g.fillRect(b.x, b.y, b.w, 2);
  g.fillStyle(0x263a35, .32); g.fillRect(b.x, b.y + b.h - 14, b.w, 14);
}

function drawUpper(a: Art): void {
  const m = EXP_MAPS.upper, b = m.bounds;
  // The skyline is scenery outside the original walkable bounds. Bridge and
  // river were removed during extraction; the photo puzzle's views are intact.
  a.image('skyline', 0, -70, m.width, 310, -99);
  a.tile('paving', b, -90, .56);
  const floor = a.graphics(-89);
  floor.fillStyle(0xd5c6a2, .14); floor.fillRect(b.x, b.y, b.w, b.h);
  // Existing wood promenade remains wood; border stones clarify the real lane.
  a.tile('timber', { x: 160, y: 580, w: 1880, h: 170 }, -85, .55).setAlpha(.86);
  floor.lineStyle(7, 0x8f8772); floor.lineBetween(80, 224, 2120, 224);
  floor.lineStyle(2, 0xd5c9aa); floor.lineBetween(80, 225, 2120, 225);
  const curb = a.graphics(-80);
  for (const y of [577, 750]) {
    curb.fillStyle(0xddd0ac, .8); curb.fillRect(160, y, 1880, 3);
    curb.fillStyle(0x3e4039, .38); curb.fillRect(160, y + 3, 1880, 5);
  }
  // Upper edge stays an edge, not a false door or a solid new obstacle.
  for (const wall of m.walls.filter(w => !m.buildings.includes(w as never))) retainingWall(a, wall);
  stairs(a, 150, 750, 260, 264, -74);
  stairs(a, 1945, 750, 180, 264, -74);
  // The visible roof strips below the original retaining wall are only scenery.
  for (const building of m.buildings.filter(v => v.kind === 'guide' || v.kind === 'workshop')) {
    a.image('roof', building.x, 851, building.w, 162, 802).setTint(0x9caaa0);
    const beam = a.graphics(803); beam.fillStyle(0x493b2c); beam.fillRect(building.x - 5, 1007, building.w + 10, 7);
  }
  for (const building of m.buildings) {
    const asset = building.kind === 'guide' ? 'guide' : building.kind === 'workshop' ? 'workshop' : 'gallery';
    const bottom = building.y + building.h;
    // Sprite's physical front x=30..870 and y=548 aligns to the exact blocker.
    const sx = building.w / 840, sy = building.h / 548;
    a.image(asset, building.x - 30 * sx, building.y, 900 * sx, 560 * sy, bottom);
    if (building.kind) {
      a.label(building.x + building.w / 2, building.y + 311 * sy, building.name, 15, bottom + 1);
      const threshold = a.graphics(bottom - 1);
      threshold.fillStyle(0xd6c39a); threshold.fillRect(building.x + building.w / 2 - 36, bottom + 2, 72, 7);
      threshold.lineStyle(1, 0x88785f); threshold.lineBetween(building.x + building.w / 2 - 36, bottom + 9, building.x + building.w / 2 + 36, bottom + 9);
    }
  }
  // Use existing target text. No new destination, quest, object or cultural claim.
  for (const t of EXP_TARGETS.filter(t => t.map === 'upper')) {
    if (t.id === 'guide-door' || t.id === 'workshop-upper-door') {
      // A shared route plate names the existing floor entrance.
    } else if (t.id === 'street-sign') {
      const board = a.image('grain', t.x - 67, t.y - 48, 134, 32, t.y + 1);
      board.setTint(0xa9a48f);
      a.label(t.x, t.y - 31, '屋檐街', 17, t.y + 2);
    } else if (t.id === 'wrong-gate') {
      a.image('grain', 77, 817, 66, 63, 850).setTint(0x85846e);
      const g = a.graphics(851); g.lineStyle(3, 0xcab784); g.strokeTriangle(98, 849, 110, 831, 122, 849);
      a.label(t.x, 888, '山纹杂物门', 14, 851);
    } else if (t.id === 'west-down' || t.id === 'east-down') {
      // A shared up/down plate names this existing landing.
    } else if (t.id === 'core-to-entry') {
      a.label(t.x + 70, t.y - 38, '沧白路入口', 16, t.y + 1);
    }
  }
  placeLighting(a, 'upper');
}

function drawGuideRoom(a: Art): void {
  const m = EXP_MAPS.guide2, b = m.bounds;
  const backdrop = a.graphics(-99); backdrop.fillStyle(0x242a29); backdrop.fillRect(0, 0, m.width, m.height);
  a.tile('timber', b, -90, .54);
  // Wall faces terminate on the ORIGINAL boundaries, not inside the walk area.
  a.tile('plaster', { x: b.x, y: b.y - 92, w: b.w, h: 92 }, -70, .8).setTint(0xbcae92);
  a.image('grain', b.x - 14, b.y - 101, b.w + 28, 14, -60);
  a.image('grain', b.x, b.y - 7, b.w, 7, -59);
  for (const x of [b.x - 15, b.x + b.w]) {
    a.tile('grain', { x, y: b.y, w: 15, h: b.h }, 900, .5).setTint(0x83785e);
  }
  for (const x of [285, 865]) a.image('window', x, b.y - 87, 126, 78, -58);
  for (const x of [180, 560, 800, 1137]) {
    a.image('grain', x, b.y - 94, 15, 94, -57).setTint(0x88866d);
  }
  for (const [i, wall] of m.walls.entries()) {
    const shadow = a.graphics(-72);
    shadow.fillStyle(0x202c2b, .24); shadow.fillRect(wall.x + 10, wall.y + 10, wall.w + 8, wall.h + 12);
    if (i === 0) {
      // Thin north-south divider retains its exact 20x420 footprint.
      a.tile('grain', wall, wall.y + wall.h, .4).setTint(0x71634e);
      const panel = a.graphics(wall.y + wall.h + 1);
      panel.lineStyle(3, 0xb99a65); panel.lineBetween(wall.x + 2, wall.y, wall.x + 2, wall.y + wall.h);
      for (let y = wall.y + 12; y < wall.y + wall.h; y += 44) {
        panel.fillStyle(0xb5a27c, .55); panel.fillRect(wall.x + 5, y, 10, 29);
      }
    } else {
      // The desk image baseline is pinned to the collision's south edge.
      a.image('desk', wall.x, wall.y - wall.h * .20, wall.w, wall.h * 1.20, wall.y + wall.h);
    }
  }
  const note = EXP_TARGETS.find(t => t.id === 'note')!;
  // Preserve the pre-existing two pattern marks beside the real investigation.
  const paper = a.graphics(note.y - 1);
  paper.fillStyle(0xdbc99b); paper.fillRect(note.x - 29, note.y - 41, 58, 30);
  paper.lineStyle(2, 0x596e62); paper.strokeTriangle(note.x - 23, note.y - 16, note.x - 13, note.y - 34, note.x - 3, note.y - 16);
  paper.lineBetween(note.x + 3, note.y - 29, note.x + 23, note.y - 33);
  paper.lineBetween(note.x + 3, note.y - 20, note.x + 23, note.y - 24);
  a.label(note.x, note.y - 67, '楼层／纹样导览', 15, note.y);
  for (const t of EXP_TARGETS.filter(t => t.map === 'guide2' && t.destination)) {
    if (t.id === 'guide-down') {
      stairs(a, t.x - 48, t.y - 35, 96, 70, t.y - 1);
      // Floor direction is shown by the shared route plate.
    } else if (t.id === 'guide-upper-exit') {
      // Existing exit is on a landing, not a new wall across the walkable room.
      a.tile('paving', { x: t.x - 39, y: t.y - 15, w: 78, h: 45 }, -68, .4);
      const landing = a.graphics(-67); landing.lineStyle(2, 0xc2a777); landing.strokeRect(t.x - 39, t.y - 15, 78, 45);
      // Floor direction is shown by the shared route plate.
    }
  }
  a.label(350, 244, '阅览区', 16, 245);
  placeLighting(a, 'guide2');
}

export function drawSunsetSample(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, snapshot: ExplorationSnapshot): void {
  if (!isSunsetSample(snapshot.map)) throw new Error('Sunset sample used outside approved maps');
  const a = artHelpers(scene, layer);
  if (snapshot.map === 'upper') drawUpper(a); else drawGuideRoom(a);
}
