import { FixedStepSimulation } from './simulation.ts';
import { RuntimeLifecycleController } from './lifecycle.ts';
import { PlayerMotor, type PlayerState } from './player.ts';
import { InteractionController, type InteractionObject } from './interaction.ts';
import { InMemoryRunProgress } from './progress.ts';
import {
  PrototypeGoalRouteRuntime,
  GOAL_ROUTE_EVENT_TYPE,
  type GoalRouteRuntimeOptions,
} from './goal-route-runtime.ts';
import type { RuntimeUuidProvider } from './events.ts';
import { BusinessRuntimeBus } from './business-runtime-bus.ts';
import {
  captureInitialTemporarySnapshot,
  FixedTemporarySnapshotStore,
  type SnapshotAnchor,
  type SnapshotFaultInjector,
  type TemporarySnapshotSource,
  type TemporarySnapshotState,
} from './snapshot.ts';
import {
  CHECKPOINT_CAPTURE_EVENT_TYPE,
  SnapshotCaptureRuntime,
  type CheckpointCaptureAuthorization,
  type SnapshotCaptureRuntimeOptions,
} from './snapshot-capture-runtime.ts';
import {
  CHECKPOINT_ENTRY_EVENT_TYPE,
  CheckpointTriggerRuntime,
  type CheckpointTriggerOccupancySnapshot,
} from './checkpoint-triggers.ts';
import { TRANSACTION_RESULT_EVENT_TYPE } from './transaction-results.ts';
import type { TransactionExecutionFaultInjector } from './transactions.ts';

export const GRAYBOX_SIMULATION = Object.freeze({ fixedDeltaMs: 1000 / 60, maxStepsPerFrame: 5 });
export type TemporaryObjectFreezeResult = Readonly<{
  status: 'frozen' | 'existing' | 'busy';
  frozenObjectIds: readonly string[];
}>;
export type TemporaryObjectReleaseResult = Readonly<{
  status: 'released' | 'already-released' | 'owner-mismatch';
  releasedObjectIds: readonly string[];
}>;
export type DebugResetResult = Readonly<{
  status: 'reset' | 'blocked';
  message: string;
}>;
export type GrayboxPhysics = TemporarySnapshotSource & {
  readonly state: PlayerState;
  readonly steps: number;
  readonly timestamp: number;
  readonly spawnAnchor: SnapshotAnchor;
  readonly checkpointTriggers: readonly CheckpointTriggerOccupancySnapshot[];
  readonly checkpointTriggersEnabled: boolean;
  drive(vx: number, vy: number): void;
  step(deltaMs: number, tick: number): void;
  setPermanentEffect(effectId: string, expectedActive: boolean): void;
  freezeTemporaryObjects(objectIds: readonly string[], owner: object): TemporaryObjectFreezeResult;
  releaseTemporaryObjects(owner: object): TemporaryObjectReleaseResult;
  isTemporaryObjectChangeAllowed(objectId: string): boolean;
  readonly frozenTemporaryObjectIds: readonly string[];
  reset(): void;
};

export type GrayboxCoreOptions = Readonly<{
  uuidProvider: RuntimeUuidProvider;
  progress?: InMemoryRunProgress;
  goalRouteOptions?: GoalRouteRuntimeOptions;
  snapshotFaultInjector?: SnapshotFaultInjector;
  checkpointCaptureOptions?: Omit<SnapshotCaptureRuntimeOptions, 'transactionFaultInjector'> & Readonly<{
    transactionFaultInjector?: TransactionExecutionFaultInjector;
  }>;
}>;

export function createGrayboxCore(
  physics: GrayboxPhysics,
  options: GrayboxCoreOptions,
) {
  const progress = options.progress ?? new InMemoryRunProgress();
  const snapshotStore = new FixedTemporarySnapshotStore();
  const goalOptions = options.goalRouteOptions ?? {};
  const businessBus = new BusinessRuntimeBus(options.uuidProvider, {
    allowedEventTypes: [
      GOAL_ROUTE_EVENT_TYPE,
      CHECKPOINT_ENTRY_EVENT_TYPE,
      CHECKPOINT_CAPTURE_EVENT_TYPE,
      TRANSACTION_RESULT_EVENT_TYPE,
    ],
    checkpointEntryEventType: CHECKPOINT_ENTRY_EVENT_TYPE,
    initialNextEventId: goalOptions.initialNextEventId,
    initialNextCommandId: goalOptions.initialNextCommandId,
    initialNextTransactionId: goalOptions.initialNextTransactionId,
    inboxCapacity: goalOptions.inboxCapacity ?? 16,
    historyCapacity: goalOptions.historyCapacity ?? 64,
    transactionResultCapacity: goalOptions.transactionResultCapacity ?? 16,
    commandCapacity: goalOptions.commandCapacity ?? 16,
    eventFaultInjector: goalOptions.eventFaultInjector,
    retirementFaultInjector: goalOptions.retirementFaultInjector,
  });
  const goalRoute = new PrototypeGoalRouteRuntime(
    progress,
    options.uuidProvider,
    options.goalRouteOptions,
    businessBus,
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
  const checkpointCapture = new SnapshotCaptureRuntime(
    businessBus,
    progress,
    physics,
    snapshotStore,
    options.checkpointCaptureOptions,
  );
  const checkpointTriggers = new CheckpointTriggerRuntime({
    bus: businessBus,
    requestCapture: (checkpointId, tick, authorization) =>
      checkpointCapture.requestCapture(checkpointId, tick, authorization),
    getCurrentCheckpointId: () => snapshotStore.current?.checkpointId ?? null,
    getCaptureSnapshot: () => checkpointCapture.snapshot,
  });
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
    checkpointTriggers.beginTick(tick);
    const velocity = motor.beforeStep(physics.state, deltaMs);
    physics.drive(velocity.vx, velocity.vy);
    physics.step(deltaMs, tick); // Exactly one Matter update per actual SimulationTick.
    checkpointTriggers.observeAfterPhysics(
      tick,
      physics.checkpointTriggers,
      physics.checkpointTriggersEnabled,
    );
    checkpointTriggers.closeAndArbitrate(tick);
    motor.afterStep(physics.state, deltaMs);
    interaction.updatePlayerState(physics.state);
    interaction.afterStep(physics.state, deltaMs);
    // Business coordination happens once after the actual world, physics and
    // interaction updates for this fixed Tick. New result events remain Pending
    // for the next coordination dispatch.
    const dispatch = businessBus.dispatch(tick);
    goalRoute.afterDispatch(tick, dispatch);
    checkpointTriggers.startWinnerAfterDispatch(tick);
    checkpointCapture.afterDispatch(tick, dispatch);
    checkpointTriggers.afterDispatch(
      tick,
      dispatch,
      checkpointCapture.snapshot,
    );
    reconcilePermanentEffects();
  });
  const lifecycle = new RuntimeLifecycleController(simulation);
  checkpointTriggers.synchronizeBaseline(
    physics.checkpointTriggers,
    physics.checkpointTriggersEnabled,
    simulation.snapshot.tick,
  );
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
    requestCheckpointCapture: (
      checkpointId: string,
      authorization: CheckpointCaptureAuthorization,
    ) => checkpointCapture.requestCapture(
      checkpointId,
      simulation.snapshot.tick,
      authorization,
    ),
    recoverCheckpointCapture: () => checkpointCapture.recover(simulation.snapshot.tick),
    setAvailable: (available: boolean) => {
      interaction.setAvailable(available);
      motor.controls.request(availabilityOwner, !available);
    },
    reset(): DebugResetResult {
      if (physics.frozenTemporaryObjectIds.length > 0) {
        const message =
          'Debug reset is unavailable while checkpoint objects are frozen.';
        checkpointTriggers.noteResetBlocked(message);
        return Object.freeze({ status: 'blocked' as const, message });
      }
      try {
        physics.reset();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        checkpointTriggers.noteResetBlocked(message);
        return Object.freeze({ status: 'blocked' as const, message });
      }
      interaction.reset();
      motor.reset();
      reconcilePermanentEffects();
      interaction.updatePlayerState(physics.state);
      interaction.afterStep(physics.state, 0);
      checkpointTriggers.noteResetCompleted(
        physics.checkpointTriggers,
        simulation.snapshot.tick,
      );
      resets++;
      return Object.freeze({
        status: 'reset' as const,
        message: 'Temporary graybox reset; checkpoint and run progress preserved.',
      });
    },
    get snapshot() {
      return { ...simulation.snapshot, pauseCount: lifecycle.pauseCount,
        player: { ...physics.state, ...motor.snapshot }, physicsSteps: physics.steps,
        physicsTimestamp: physics.timestamp, resets, interaction: interaction.snapshot,
        progress: progress.snapshot, goalRoute: goalRoute.snapshot,
        checkpointSnapshot: Object.freeze({
          ...checkpointSnapshot,
          current: snapshotStore.current,
        }),
        checkpointCapture: checkpointCapture.snapshot,
        checkpointTriggers: checkpointTriggers.snapshot,
        frozenTemporaryObjectIds: physics.frozenTemporaryObjectIds,
      };
    },
  };
}
export type GrayboxCore = ReturnType<typeof createGrayboxCore>;
