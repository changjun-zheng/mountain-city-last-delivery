import Phaser from 'phaser';
import type { PlayerState } from '../../core/player.ts';
import { FIRST_LEVEL_ART_KEYS } from './first-level-art.ts';

export type FirstLevelActor = Readonly<{
  container: Phaser.GameObjects.Container;
  update: (
    state: PlayerState,
    snapshot: Readonly<{
      tick: number;
      paused: boolean;
      controlAllowed: boolean;
    }>,
  ) => void;
}>;

export function createFirstLevelActor(
  scene: Phaser.Scene,
  x: number,
  y: number,
): FirstLevelActor {
  const container = scene.add.container(x, y).setDepth(12);
  const shadow = scene.add.ellipse(0, 22, 32, 7, 0x07111b, 0.55);
  const body = scene.add.image(0, 22, FIRST_LEVEL_ART_KEYS.explorer)
    .setOrigin(0.5, 1);
  // The editable SVG is authored at 72x88. Render it at roughly 50x61 world
  // pixels so the face and clothing remain reviewable without changing the
  // player's physical body or foot alignment.
  const baseScale = 0.7;
  body.setScale(baseScale);
  container.add([shadow, body]);
  let facing: 1 | -1 = 1;

  return Object.freeze({
    container,
    update(
      state: PlayerState,
      snapshot: Readonly<{
        tick: number;
        paused: boolean;
        controlAllowed: boolean;
      }>,
    ) {
      if (Math.abs(state.vx) > 1) facing = state.vx < 0 ? -1 : 1;
      const moving = Math.abs(state.vx) > 12;
      const airborne = !state.grounded;
      const phase = snapshot.tick * (moving ? 0.42 : 0.09);
      const idleBob = !airborne && !moving
        ? Math.sin(phase) * 0.8
        : 0;
      const runBob = moving && !airborne
        ? Math.abs(Math.sin(phase)) * 1.7
        : 0;
      const airTilt = airborne
        ? Phaser.Math.Clamp(state.vy / 900, -0.1, 0.12)
        : 0;
      const runTilt = moving && !airborne
        ? Math.sin(phase) * 0.025 * facing
        : 0;
      container
        .setPosition(state.x, state.y)
        .setAlpha(snapshot.controlAllowed ? 1 : 0.72);
      body
        .setFlipX(facing < 0)
        .setY(22 - idleBob - runBob)
        .setRotation(airTilt + runTilt)
        .setScale(
          baseScale * (
            moving ? 1 + Math.abs(Math.sin(phase)) * 0.025 : 1
          ),
          baseScale * (
            airborne
              ? 0.96
              : moving
                ? 1 - Math.abs(Math.sin(phase)) * 0.035
                : 1
          ),
        );
      shadow
        .setScale(airborne ? 0.72 : moving ? 1.08 : 1, 1)
        .setAlpha(airborne ? 0.28 : snapshot.controlAllowed ? 0.55 : 0.35);
    },
  });
}
