import { FixedStepSimulation } from './simulation.ts';
import { RuntimeLifecycleController } from './lifecycle.ts';
import { PlayerMotor, type PlayerState } from './player.ts';
import { InteractionController, type InteractionObject } from './interaction.ts';
import { InMemoryRunProgress } from './progress.ts';

export const GRAYBOX_SIMULATION = Object.freeze({ fixedDeltaMs: 1000 / 60, maxStepsPerFrame: 5 });
export type GrayboxPhysics = {
  readonly state: PlayerState;
  readonly steps: number;
  readonly timestamp: number;
  drive(vx: number, vy: number): void;
  step(deltaMs: number, tick: number): void;
  setPermanentEffect(effectId: string, expectedActive: boolean): void;
  reset(): void;
};

export function createGrayboxCore(
  physics: GrayboxPhysics,
  progress = new InMemoryRunProgress(),
) {
  const motor = new PlayerMotor();
  const availabilityOwner = Symbol('input-availability');
  let simulation!: FixedStepSimulation;
  const reconcilePermanentEffects = () => {
    progress.reconcileEffects((effectId, expectedActive) => {
      physics.setPermanentEffect(effectId, expectedActive);
    });
  };
  const activateProgress = (object: InteractionObject): string | undefined => {
    if (!object.progress) return undefined;
    if (object.progress.category === 'collection') {
      const result = progress.recordCollection(object.progress.id);
      return result.status === 'added'
        ? `${object.label}：测试收藏 +1（${object.progress.id}）`
        : `${object.label}：已收藏，重复请求未新增（${object.progress.id}）`;
    }
    const result = progress.completeGoal(object.progress.id);
    reconcilePermanentEffects();
    if (result.status === 'rejected') return `${object.label}：测试目标请求被拒绝`;
    return result.status === 'added'
      ? `${object.label}：测试目标完成 · 测试奖励 +1 · 路线 OPEN`
      : `${object.label}：目标已完成，奖励未重复发放 · 路线保持 OPEN`;
  };
  const interaction = new InteractionController(
    motor.controls,
    () => simulation.snapshot.paused,
    undefined,
    activateProgress,
  );
  let resets = 0;
  simulation = new FixedStepSimulation(GRAYBOX_SIMULATION, (deltaMs, tick) => {
    const velocity = motor.beforeStep(physics.state, deltaMs);
    physics.drive(velocity.vx, velocity.vy);
    physics.step(deltaMs, tick); // Exactly one Matter update per actual SimulationTick.
    motor.afterStep(physics.state, deltaMs);
    interaction.updatePlayerState(physics.state);
    interaction.afterStep(physics.state, deltaMs);
  });
  const lifecycle = new RuntimeLifecycleController(simulation);
  reconcilePermanentEffects();
  interaction.updatePlayerState(physics.state);
  interaction.afterStep(physics.state, 0);
  return {
    config: simulation.config, lifecycle,
    frame: (sampleMs: number) => simulation.frame(sampleMs),
    key: (code: string, down: boolean, repeat = false) => {
      interaction.updatePlayerState(physics.state);
      motor.key(code, down, repeat);
      interaction.key(code, down, repeat);
    },
    closeInteraction: () => interaction.requestClose(),
    setAvailable: (available: boolean) => {
      interaction.setAvailable(available);
      motor.controls.request(availabilityOwner, !available);
    },
    reset() {
      physics.reset();
      interaction.reset();
      motor.reset();
      reconcilePermanentEffects();
      interaction.updatePlayerState(physics.state);
      interaction.afterStep(physics.state, 0);
      resets++;
    },
    get snapshot() {
      return { ...simulation.snapshot, pauseCount: lifecycle.pauseCount,
        player: { ...physics.state, ...motor.snapshot }, physicsSteps: physics.steps,
        physicsTimestamp: physics.timestamp, resets, interaction: interaction.snapshot,
        progress: progress.snapshot };
    },
  };
}
export type GrayboxCore = ReturnType<typeof createGrayboxCore>;
