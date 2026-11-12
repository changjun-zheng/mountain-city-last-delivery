import { FixedStepSimulation } from './simulation.ts';
import { RuntimeLifecycleController } from './lifecycle.ts';
import { PlayerMotor, type PlayerState } from './player.ts';

export const GRAYBOX_SIMULATION = Object.freeze({ fixedDeltaMs: 1000 / 60, maxStepsPerFrame: 5 });
export type GrayboxPhysics = {
  readonly state: PlayerState;
  readonly steps: number;
  readonly timestamp: number;
  drive(vx: number, vy: number): void;
  step(deltaMs: number): void;
  reset(): void;
};

export function createGrayboxCore(physics: GrayboxPhysics) {
  const motor = new PlayerMotor();
  const availabilityOwner = Symbol('input-availability');
  let resets = 0;
  const simulation = new FixedStepSimulation(GRAYBOX_SIMULATION, deltaMs => {
    const velocity = motor.beforeStep(physics.state, deltaMs);
    physics.drive(velocity.vx, velocity.vy);
    physics.step(deltaMs); // Exactly one Matter update per actual SimulationTick.
    motor.afterStep(physics.state, deltaMs);
  });
  const lifecycle = new RuntimeLifecycleController(simulation);
  return {
    config: simulation.config, lifecycle,
    frame: (sampleMs: number) => simulation.frame(sampleMs),
    key: (code: string, down: boolean, repeat = false) => motor.key(code, down, repeat),
    setAvailable: (available: boolean) => motor.controls.request(availabilityOwner, !available),
    reset() { motor.reset(); physics.reset(); resets++; },
    get snapshot() {
      return { ...simulation.snapshot, pauseCount: lifecycle.pauseCount,
        player: { ...physics.state, ...motor.snapshot }, physicsSteps: physics.steps,
        physicsTimestamp: physics.timestamp, resets };
    },
  };
}
export type GrayboxCore = ReturnType<typeof createGrayboxCore>;
