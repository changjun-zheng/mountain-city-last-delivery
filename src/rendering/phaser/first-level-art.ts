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

export const FIRST_LEVEL_ART_KEYS = Object.freeze({
  backdrop: 'h5-02-night-backdrop',
  architecture: 'h5-02-c-stilts',
  walkways: 'h5-02-c-walkways',
  foreground: 'h5-02-foreground',
  explorer: 'h5-02-explorer',
  device: 'h5-02-device',
  lift: 'h5-02-service-lift',
  gate: 'h5-02-route-gate',
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
  scene.add.image(0, 0, FIRST_LEVEL_ART_KEYS.backdrop)
    .setOrigin(0)
    .setDepth(-30)
    .setScrollFactor(0.18, 0.06);
  const cStructure = scene.add.image(
    900,
    158,
    FIRST_LEVEL_ART_KEYS.architecture,
  )
    .setOrigin(0)
    .setScale(0.86)
    .setAlpha(0.93)
    .setDepth(-16)
    .setScrollFactor(0.58, 0.82);
  scene.add.image(910, 248, FIRST_LEVEL_ART_KEYS.walkways)
    .setOrigin(0)
    .setScale(0.92)
    .setAlpha(0.58)
    .setDepth(-11)
    .setScrollFactor(0.82, 0.94);

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
    if (isWood) {
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

  const device = scene.add.image(1185, 300, FIRST_LEVEL_ART_KEYS.device)
    .setOrigin(0.5)
    .setDisplaySize(206, 109)
    .setDepth(3);
  scene.add.rectangle(1185, 359, 108, 7, 0x171d27, 0.55).setDepth(2);
  device.setData('role', 'first-level-neutral-device');

  const lift = scene.add.image(
    world.liftBody.position.x,
    world.liftBody.position.y - 9,
    FIRST_LEVEL_ART_KEYS.lift,
  ).setOrigin(0.5).setDepth(6);
  const gate = scene.add.image(
    FIRST_LEVEL_ROUTE_GATE.x,
    FIRST_LEVEL_ROUTE_GATE.y,
    FIRST_LEVEL_ART_KEYS.gate,
  ).setOrigin(0.5).setDepth(7);
  scene.add.image(500, 290, FIRST_LEVEL_ART_KEYS.foreground)
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setAlpha(0.88)
    .setDepth(20);

  const camera = scene.cameras.main;
  camera.setBounds(
    0,
    0,
    FIRST_LEVEL_SIZE.width + camera.width,
    FIRST_LEVEL_SIZE.height + camera.height,
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
      camera.setBounds(
        0,
        0,
        FIRST_LEVEL_SIZE.width + camera.width,
        FIRST_LEVEL_SIZE.height + camera.height,
      );
    },
  });
}
