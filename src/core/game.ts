import { FixedStepSimulation, PROTOTYPE_SIMULATION } from './simulation.ts';
import { RuntimeLifecycleController } from './lifecycle.ts';

export type StartupScene = Readonly<{
  title: string;
  subtitle: string;
  milestone: string;
}>;

// Shared display identity only; package, storage and gameplay identities stay unchanged.
export const PROJECT_IDENTITY = Object.freeze({ title: '叠城大冒险', subtitle: 'Layered City Adventures' });

// This is the shared entry point. Hosts choose how to present the initial scene.
export function createGameCore() {
  const startupScene: StartupScene = {
    ...PROJECT_IDENTITY,
    milestone: 'M1.2.1 · 固定步验证',
  };
  let markerX = 0;
  const simulation = new FixedStepSimulation(PROTOTYPE_SIMULATION, (deltaMs) => {
    // Diagnostic motion only: 100 units/second over a 600-unit lane, no player/physics.
    markerX = (markerX + 100 * deltaMs / 1000) % 600;
  });
  const lifecycle = new RuntimeLifecycleController(simulation);
  return {
    startupScene,
    config: simulation.config,
    lifecycle,
    frame: (sampleMs: number) => simulation.frame(sampleMs),
    get snapshot() {
      return { ...simulation.snapshot, markerX, pauseCount: lifecycle.pauseCount };
    },
  };
}
export type GameCore = ReturnType<typeof createGameCore>;
