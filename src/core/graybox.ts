import { FixedStepSimulation } from './simulation.ts';
import { RuntimeLifecycleController } from './lifecycle.ts';
import { PlayerMotor, type PlayerState } from './player.ts';
import { InteractionController, type InteractionObject } from './interaction.ts';
import { InMemoryRunProgress } from './progress.ts';
import {
  PrototypeGoalRouteRuntime,
  type GoalRouteRuntimeOptions,
} from './goal-route-runtime.ts';
import type { RuntimeUuidProvider } from './events.ts';
import {
  captureInitialTemporarySnapshot,
  FixedTemporarySnapshotStore,
  type SnapshotAnchor,
  type SnapshotFaultInjector,
  type TemporarySnapshotSource,
  type TemporarySnapshotState,
} from './snapshot.ts';

export const GRAYBOX_SIMULATION = Object.freeze({ fixedDeltaMs: 1000 / 60, maxStepsPerFrame: 5 });
export type GrayboxPhysics = TemporarySnapshotSource & {
  readonly state: PlayerState;
  readonly steps: number;
  readonly timestamp: number;
  readonly spawnAnchor: SnapshotAnchor;
  drive(vx: number, vy: number): void;
  step(deltaMs: number, tick: number): void;
  setPermanentEffect(effectId: string, expectedActive: boolean): void;
  reset(): void;
};

export type GrayboxCoreOptions = Readonly<{
  uuidProvider: RuntimeUuidProvider;
  progress?: InMemoryRunProgress;
  goalRouteOptions?: GoalRouteRuntimeOptions;
  snapshotFaultInjector?: SnapshotFaultInjector;
}>;

export function createGrayboxCore(
  physics: GrayboxPhysics,
  options: GrayboxCoreOptions,
) {
  const progress = options.progress ?? new InMemoryRunProgress();
  const goalRoute = new PrototypeGoalRouteRuntime(
    progress,
    options.uuidProvider,
    options.goalRouteOptions,
  );
  const motor = new PlayerMotor();
  const availabilityOwner = Symbol('input-availability');
  const checkpointInitializationOwner = Symbol('checkpoint-initialization');
  // Initialization happens before host input is wired, so this lock must not
  // manufacture a PC-02 release gate by treating startup as an input loss.
  motor.controls.request(checkpointInitializationOwner, true, false);
  let simulation!: FixedStepSimulation;
  const reconcilePermanentEffects = () => {
    progress.reconcileEffects((effectId, expectedActive) => {
      physics.setPermanentEffect(effectId, expectedActive);
    });
  };
  const snapshotStore = new FixedTemporarySnapshotStore();
  let checkpointSnapshot: TemporarySnapshotState;
  try {
    // CONFIRMED initialization order: temporary world exists, permanent effects
    // are applied, then one complete fallback snapshot is captured and committed.
    reconcilePermanentEffects();
    const captured = captureInitialTemporarySnapshot(
      physics,
      {
        runtimeInstanceId: goalRoute.runtimeInstanceId,
        anchor: physics.spawnAnchor,
      },
      snapshotStore,
      options.snapshotFaultInjector,
    );
    checkpointSnapshot = Object.freeze({ ...captured });
  } catch (error) {
    checkpointSnapshot = Object.freeze({
      status: 'FAILED' as const,
      error: error instanceof Error ? error.message : String(error),
      captureAttempts: 1,
      capturedAtTick: null,
      current: null,
    });
  }
  if (checkpointSnapshot.status === 'READY') {
    // Release only this owner. Focus, interaction and later recovery owners
    // retain their independent control restrictions.
    motor.controls.request(checkpointInitializationOwner, false);
  }
  const activateProgress = (object: InteractionObject): string | undefined => {
    if (!object.progress) return undefined;
    if (object.progress.category === 'collection') {
      const result = progress.recordCollection(object.progress.id);
      return result.status === 'added'
        ? `${object.label}：测试收藏 +1（${object.progress.id}）`
        : `${object.label}：已收藏，重复请求未新增（${object.progress.id}）`;
    }
    const result = goalRoute.requestGoal();
    return `${object.label}：${result.feedback}`;
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
    // Business coordination happens once after the actual world, physics and
    // interaction updates for this fixed Tick. New result events remain Pending
    // for the next coordination dispatch.
    goalRoute.step(tick);
    reconcilePermanentEffects();
  });
  const lifecycle = new RuntimeLifecycleController(simulation);
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
        progress: progress.snapshot, goalRoute: goalRoute.snapshot,
        checkpointSnapshot: Object.freeze({
          ...checkpointSnapshot,
          current: snapshotStore.current,
        }) };
    },
  };
}
export type GrayboxCore = ReturnType<typeof createGrayboxCore>;
