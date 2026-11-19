import Phaser from 'phaser';
import {
  FIRST_LEVEL_ROUTE_GATE,
  FIRST_LEVEL_SIZE,
  type FirstLevelMatterWorld,
} from '../../physics/matter/first-level-world.ts';
import backdropSvg from './assets/h5-02/night-backdrop.svg?raw';
import architectureSvg from './assets/h5-02/c-stilts-architecture.svg?raw';
import walkwaysSvg from './assets/h5-02/c-walkways.svg?raw';
import foregroundSvg from './assets/h5-02/foreground.svg?raw';
import explorerSvg from './assets/h5-02/explorer.svg?raw';
import deviceSvg from './assets/h5-02/device-neutral.svg?raw';
import liftSvg from './assets/h5-02/service-lift.svg?raw';
import gateSvg from './assets/h5-02/route-gate.svg?raw';
import nightDetailSvg from './assets/h5-02-r1/c-night-detail.svg?raw';
import timberModuleSvg from './assets/h5-02-r1/c-timber-module.svg?raw';

export const FIRST_LEVEL_ART_KEYS = Object.freeze({
  backdrop: 'h5-02-night-backdrop',
  architecture: 'h5-02-c-stilts',
  walkways: 'h5-02-c-walkways',
  foreground: 'h5-02-foreground',
  explorer: 'h5-02-explorer',
  device: 'h5-02-device',
  lift: 'h5-02-service-lift',
  gate: 'h5-02-route-gate',
  nightDetail: 'h5-02-r1-night-detail',
  timberModule: 'h5-02-r1-timber-module',
});

export type FirstLevelArt = Readonly<{
  lift: Phaser.GameObjects.Image;
  gate: Phaser.GameObjects.Image;
  cStructure: Phaser.GameObjects.Image;
  update: (world: FirstLevelMatterWorld) => void;
}>;

export function preloadFirstLevelArt(scene: Phaser.Scene): void {
  // Vite's asset URL contains query metadata that Phaser 3.90 misclassifies
  // during SVG loading. Raw imports keep the editable SVG sources in the build;
  // blob URLs avoid the loader's inline-data branch and preserve the source SVG.
  const loadSvg = (key: string, svg: string) => {
    const url = URL.createObjectURL(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    );
    scene.load.svg(key, url);
    scene.load.once(`filecomplete-svg-${key}`, () => URL.revokeObjectURL(url));
    scene.load.once(`loaderror`, () => URL.revokeObjectURL(url));
  };
  loadSvg(FIRST_LEVEL_ART_KEYS.backdrop, backdropSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.architecture, architectureSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.walkways, walkwaysSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.foreground, foregroundSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.explorer, explorerSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.device, deviceSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.lift, liftSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.gate, gateSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.nightDetail, nightDetailSvg);
  loadSvg(FIRST_LEVEL_ART_KEYS.timberModule, timberModuleSvg);
}

export function assertFirstLevelArtLoaded(scene: Phaser.Scene): void {
  const missing = Object.values(FIRST_LEVEL_ART_KEYS)
    .filter(key => !scene.textures.exists(key));
  if (missing.length > 0) {
    throw new Error(`H5-02 art assets failed to load: ${missing.join(', ')}`);
  }
}

export function createFirstLevelArt(
  scene: Phaser.Scene,
  world: FirstLevelMatterWorld,
): FirstLevelArt {
  // All traversable architecture is authored against the actual world geometry.
  // Distant silhouettes alone use parallax. No decorative stair is a route.
  const backdrop = scene.add.graphics().setDepth(-30).setScrollFactor(0.12, 0.08);
  backdrop.fillGradientStyle(0x101b36, 0x192949, 0x324654, 0x25394c, 1);
  backdrop.fillRect(0, 0, 9000, 2300);
  for (let x = 0; x < 8500; x += 190) {
    backdrop.fillStyle(0x273449, 1);
    backdrop.fillTriangle(x - 140, 700, x + 160, 350 + (x % 330), x + 500, 900);
  }
  const architecture = scene.add.graphics().setDepth(-10);
  const text = (x: number, y: number, value: string) =>
    scene.add.text(x, y, value, { fontFamily: 'Microsoft YaHei', fontSize: '18px',
      color: '#f3d8a5', backgroundColor: '#26333d', padding: { x: 8, y: 4 } }).setDepth(-3);
  // A: broad stepped monument, clock tower and commercial street.
  architecture.fillStyle(0xc7c3b5);
  architecture.fillRect(575, 355, 150, 45);
  architecture.fillRect(598, 180, 104, 175);
  architecture.fillRect(612, 92, 76, 88);
  architecture.fillTriangle(610, 92, 650, 62, 690, 92);
  architecture.lineStyle(4, 0x7b827e);
  architecture.strokeRect(612, 92, 76, 88);
  architecture.fillStyle(0xffe3a0);
  architecture.fillCircle(650, 137, 24);
  architecture.lineStyle(3, 0x4d565d);
  architecture.lineBetween(650, 137, 650, 117);
  architecture.lineBetween(650, 137, 664, 145);
  text(590, 315, '人民解放纪念碑');
  for (const [x, w, h, color, sign] of [
    [820, 240, 210, 0x445364, '山城百货'], [1090, 210, 170, 0x68534c, '街角书屋'],
    [1320, 210, 260, 0x354654, '沧白路 →'],
  ] as const) {
    architecture.fillStyle(color); architecture.fillRect(x, 400 - h, w, h);
    architecture.fillStyle(0xe9b766);
    for (let wx = x + 18; wx < x + w - 12; wx += 44)
      for (let wy = 425 - h; wy < 365; wy += 48) architecture.fillRect(wx, wy, 25, 31);
    architecture.fillStyle(0x9b7153); architecture.fillRect(x - 8, 350, w + 16, 14);
    text(x + 15, 360, sign);
  }
  // B: stone overlook, open rail and a lower skyline visible below the street.
  architecture.lineStyle(5, 0xaa9675);
  architecture.lineBetween(1800, 309, 2980, 309);
  for (let x = 1800; x < 2980; x += 60) architecture.lineBetween(x, 309, x, 350);
  architecture.lineStyle(14, 0x98623f);
  architecture.strokeRect(2740, 190, 170, 160);
  architecture.lineBetween(2710, 190, 2825, 146);
  architecture.lineBetween(2825, 146, 2940, 190);
  text(2750, 200, '洪崖洞');
  for (let x = 2000; x < 3000; x += 160) {
    architecture.fillStyle(0x364452); architecture.fillRect(x, 600, 130, 500);
    architecture.fillStyle(0x9d7950);
    for (let y = 620; y < 1020; y += 65) architecture.fillRect(x + 20, y, 60, 24);
  }
  // C: distinct rooms, stone bases and timber bays attached to each real floor.
  for (const floor of world.definition.terrain.filter(body =>
    ['c-upper-ground', 'c-middle-ground', 'c-lower-ground'].includes(body.label))) {
    const left = floor.x - floor.width / 2, top = floor.y - floor.height / 2;
    for (let x = left; x < left + floor.width; x += 155) {
      architecture.fillStyle(0x493e39); architecture.fillRect(x, top - 205, 145, 200);
      architecture.fillStyle(0x786048); architecture.fillRect(x, top + 28, 145, 220);
      architecture.fillStyle(0xd8ab65); architecture.fillRect(x + 28, top - 160, 73, 90);
      architecture.lineStyle(5, 0x5b4130);
      architecture.lineBetween(x + 64, top - 160, x + 64, top - 70);
      architecture.lineBetween(x + 28, top - 115, x + 101, top - 115);
      architecture.lineStyle(8, 0xa27850);
      architecture.lineBetween(x + 6, top - 210, x + 6, top + 235);
      architecture.lineBetween(x - 12, top - 213, x + 150, top - 213);
      architecture.lineBetween(x + 6, top + 220, x + 136, top + 30);
      architecture.fillStyle(0x26303b);
      architecture.fillTriangle(x - 20, top - 217, x + 70, top - 245, x + 160, top - 217);
    }
  }
  const clue = scene.add.graphics().setDepth(-1);
  clue.lineStyle(3, 0xf0cf81, 0.9);
  clue.lineBetween(2550, 260, 3050, 290);
  clue.lineBetween(3050, 290, 3850, 555);
  text(2500, 245, '灯带沿木楼向下');
  // D: water and bridge are below/behind the walk, never implied as support.
  architecture.fillStyle(0x214755); architecture.fillRect(6400, 1415, 1600, 385);
  architecture.lineStyle(12, 0x7c7774); architecture.lineBetween(6480, 1120, 7980, 1120);
  architecture.lineStyle(7, 0xa6967c);
  architecture.lineBetween(6600, 1300, 6600, 900);
  architecture.lineBetween(7760, 1300, 7760, 900);
  architecture.lineBetween(6600, 900, 7180, 1105);
  architecture.lineBetween(7180, 1105, 7760, 900);
  for (let x = 6600; x < 7900; x += 90) {
    architecture.lineStyle(2, 0xb0a48e, 0.5);
    architecture.lineBetween(x, 1040, x, 1120);
    architecture.lineStyle(3, 0xc7a36c, 0.4);
    architecture.lineBetween(x, 1480 + x % 60, x + 52, 1480 + x % 60);
  }
  text(7500, 1280, '嘉陵江岸 · 拍摄点');
  const cStructure = scene.add.image(3520, 690, FIRST_LEVEL_ART_KEYS.timberModule)
    .setOrigin(0).setDepth(-18).setAlpha(0.25);
  const terrain = scene.add.graphics().setDepth(-2);
  for (const body of world.terrain) {
    if (body.label === FIRST_LEVEL_ROUTE_GATE.label) continue;
    const isC = body.label.startsWith('c-');
    const isWood = isC || body.label === 'b-terrace';
    const isRiverbank = body.label === 'd-riverbank';
    terrain.fillStyle(
      isRiverbank ? 0x56636b : isWood ? 0x72513a : 0x5c6972,
      0.98,
    );
    terrain.fillPoints(body.vertices ?? [], true);
    terrain.lineStyle(
      isWood ? 4 : 3,
      isWood ? 0xd0a06a : 0x9aa9ae,
      0.94,
    );
    terrain.strokePoints(body.vertices ?? [], true);

    const { min, max } = body.bounds;
    const top = min.y;
    if (isWood && Math.abs(body.angle) < 0.001) {
      terrain.fillStyle(0xd3a56f, 0.45);
      terrain.fillRect(min.x + 2, top + 2, max.x - min.x - 4, 5);
      terrain.lineStyle(1, 0x51392d, 0.58);
      for (let x = min.x + 16; x < max.x; x += 24) {
        terrain.lineBetween(x, top + 7, x, Math.min(max.y, top + 24));
      }
      const supportCount = Math.max(2, Math.floor((max.x - min.x) / 90));
      for (let index = 0; index <= supportCount; index++) {
        const x = Phaser.Math.Linear(
          min.x + 10,
          max.x - 10,
          index / supportCount,
        );
        terrain.fillStyle(0x543a2d, 0.94);
        terrain.fillRect(x - 4, top + 15, 8, Math.min(82, max.y - top + 40));
        terrain.lineStyle(2, 0x9f7049, 0.7);
        terrain.lineBetween(x, top + 22, x - 22, top + 62);
        terrain.lineBetween(x, top + 22, x + 22, top + 62);
      }
      if (body.label === 'c-upper-ground' || body.label === 'c-middle-ground') {
        terrain.lineStyle(4, 0x9a6c49, 0.9);
        terrain.lineBetween(min.x + 8, top - 35, max.x - 8, top - 35);
        for (let x = min.x + 16; x < max.x - 8; x += 34) {
          terrain.lineBetween(x, top - 35, x, top);
        }
      }
    } else {
      terrain.lineStyle(1, 0x39434d, 0.6);
      for (let x = min.x + 20; x < max.x; x += 38) {
        terrain.lineBetween(x, top + 6, x, max.y);
      }
      for (let y = top + 18; y < max.y; y += 22) {
        terrain.lineBetween(min.x, y, max.x, y);
      }
    }
  }

  const device = scene.add.image(3900, 545, FIRST_LEVEL_ART_KEYS.device)
    .setOrigin(0.5)
    .setDisplaySize(206, 109)
    .setDepth(3);
  scene.add.rectangle(3900, 604, 108, 7, 0x171d27, 0.55).setDepth(2);
  device.setData('role', 'first-level-neutral-device');

  const lift = scene.add.image(
    world.liftBody.position.x,
    world.liftBody.position.y - 9,
    FIRST_LEVEL_ART_KEYS.lift,
  ).setOrigin(0.5).setDepth(6);
  const gate = scene.add.image(
    FIRST_LEVEL_ROUTE_GATE.x,
    world.definition.lift.fromY - 60,
    FIRST_LEVEL_ART_KEYS.gate,
  ).setOrigin(0.5).setDepth(7);
  // Stair treads follow the real rotated rectangle's upper edge.
  for (const body of world.definition.terrain.filter(body => Math.abs(body.angle) > 0.001)) {
    const angle = body.angle * Math.PI / 180;
    const dx = Math.cos(angle) * body.width / 2, dy = Math.sin(angle) * body.width / 2;
    const x1 = body.x - dx + Math.sin(angle) * body.height / 2;
    const y1 = body.y - dy - Math.cos(angle) * body.height / 2;
    terrain.lineStyle(3, 0xf0bd7e);
    for (let d = 0; d < body.width; d += 18) {
      const x = x1 + Math.cos(angle) * d, y = y1 + Math.sin(angle) * d;
      terrain.lineBetween(x, y, x + 18, y);
      terrain.lineBetween(x + 18, y, x + 18, y + 9);
    }
    terrain.lineStyle(4, 0x976b45);
    terrain.lineBetween(x1, y1 - 38, x1 + 2 * dx, y1 + 2 * dy - 38);
  }

  const camera = scene.cameras.main;
  camera.setBounds(
    0,
    0,
    FIRST_LEVEL_SIZE.width,
    FIRST_LEVEL_SIZE.height,
  );

  return Object.freeze({
    lift,
    gate,
    cStructure,
    update(currentWorld: FirstLevelMatterWorld) {
      lift.setPosition(
        currentWorld.liftBody.position.x,
        currentWorld.liftBody.position.y - 9,
      ).setAlpha(currentWorld.routeOpen ? 1 : 0.78);
      gate.setVisible(!currentWorld.routeOpen)
        .setAlpha(currentWorld.routeOpen ? 0 : 0.96);
    },
  });
}
