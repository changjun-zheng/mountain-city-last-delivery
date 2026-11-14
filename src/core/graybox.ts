import { FixedStepSimulation } from './simulation.ts';
import { RuntimeLifecycleController } from './lifecycle.ts';
import { PlayerMotor, type PlayerState } from './player.ts';
import { InteractionController, type InteractionObject } from './interaction.ts';
import {
  InMemoryRunProgress,
  type PermanentEffectSnapshot,
} from './progress.ts';
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
  GRAYBOX_SNAPSHOT_SCENARIO,
  type SnapshotAnchor,
  type SnapshotFaultInjector,
  type SnapshotScenario,
  type TemporarySnapshot,
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
import {
  PLAYER_FAILURE_EVENT_TYPE,
  PlayerRecoveryRuntime,
  type FailureZoneSnapshot,
  type PlayerRecoveryOptions,
  type RecoveryAnchorValidationResult,
  type RecoveryWorldValidationResult,
} from './recovery.ts';

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
export type GrayboxGameplayRuntime = Readonly<{
  readonly interactionObjects?: readonly InteractionObject[];
  activate(actionId: string | undefined): string | undefined;
  afterDispatch(
    simulationTick: number,
    dispatch: ReturnType<BusinessRuntimeBus['dispatch']>,
  ): void;
  readonly snapshot: unknown;
}>;
export type GrayboxPhysics = TemporarySnapshotSource & {
  readonly state: PlayerState;
  readonly steps: number;
  readonly timestamp: number;
  readonly managedWorldRebuildCount: number;
  readonly spawnAnchor: SnapshotAnchor;
  readonly snapshotScenario?: SnapshotScenario;
  readonly checkpointTriggers: readonly CheckpointTriggerOccupancySnapshot[];
  readonly checkpointTriggersEnabled: boolean;
  readonly failureZone: FailureZoneSnapshot;
  drive(vx: number, vy: number): void;
  step(deltaMs: number, tick: number): void;
  setPermanentEffect(effectId: string, expectedActive: boolean): void;
  freezeTemporaryObjects(objectIds: readonly string[], owner: object): TemporaryObjectFreezeResult;
  releaseTemporaryObjects(owner: object): TemporaryObjectReleaseResult;
  isTemporaryObjectChangeAllowed(objectId: string): boolean;
  readonly frozenTemporaryObjectIds: readonly string[];
  applyTemporarySnapshot(objects: TemporarySnapshot['objects']): void;
  rebuildRecoveryWorld(): void;
  validateRecoveryWorld(
    objects: TemporarySnapshot['objects'],
    expectedPermanentEffects: readonly PermanentEffectSnapshot[],
  ): RecoveryWorldValidationResult;
  validateRecoveryAnchor(
    anchor: SnapshotAnchor,
    checkpointId: string,
  ): RecoveryAnchorValidationResult;
  placePlayerAtAnchor(anchor: SnapshotAnchor): void;
  synchronizeRecoveryOccupancy(tick: number): void;
  removeManagedBodyForRecoveryTest?(objectId: string): boolean;
  blockRecoveryAnchorForTest?(
    anchor: SnapshotAnchor,
    label: string,
  ): boolean;
  removeRecoveryBodyForTest?(label: string): boolean;
  reset(): void;
};

export type GrayboxCoreOptions = Readonly<{
  uuidProvider: RuntimeUuidProvider;
  progress?: InMemoryRunProgress;
  interactionObjects?: readonly InteractionObject[];
  extraEventTypes?: readonly string[];
  createGameplayRuntime?: (
    context: Readonly<{
      bus: BusinessRuntimeBus;
      progress: InMemoryRunProgress;
    }>,
  ) => GrayboxGameplayRuntime;
  goalRouteOptions?: GoalRouteRuntimeOptions;
  snapshotFaultInjector?: SnapshotFaultInjector;
  checkpointCaptureOptions?: Omit<SnapshotCaptureRuntimeOptions, 'transactionFaultInjector'> & Readonly<{
    transactionFaultInjector?: TransactionExecutionFaultInjector;
  }>;
  recoveryOptions?: PlayerRecoveryOptions;
  // Narrow, named fixture used by the D11-A3 platform smoke entry. It is not a
  // player feature and does not accept executable or arbitrary snapshot input.
  recoveryFaultScenario?: 'd11-a3-suite';
}>;

export function createGrayboxCore(
  physics: GrayboxPhysics,
  options: GrayboxCoreOptions,
) {
  const progress = options.progress ?? new InMemoryRunProgress();
  const snapshotScenario =
    physics.snapshotScenario ?? GRAYBOX_SNAPSHOT_SCENARIO;
  const snapshotStore = new FixedTemporarySnapshotStore(snapshotScenario);
  const goalOptions = options.goalRouteOptions ?? {};
  const businessBus = new BusinessRuntimeBus(options.uuidProvider, {
    allowedEventTypes: [
      GOAL_ROUTE_EVENT_TYPE,
      ...(options.extraEventTypes ?? []),
      CHECKPOINT_ENTRY_EVENT_TYPE,
      CHECKPOINT_CAPTURE_EVENT_TYPE,
      TRANSACTION_RESULT_EVENT_TYPE,
      PLAYER_FAILURE_EVENT_TYPE,
    ],
    checkpointEntryEventType: CHECKPOINT_ENTRY_EVENT_TYPE,
    playerFailureEventType: PLAYER_FAILURE_EVENT_TYPE,
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
  const recoveryOptions = createRecoveryOptionsForScenario(
    options.recoveryOptions,
    options.recoveryFaultScenario,
    snapshotStore,
    physics,
    snapshotScenario,
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
      snapshotScenario,
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
  const gameplay = options.createGameplayRuntime?.({
    bus: businessBus,
    progress,
  });
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
    const gameplayFeedback = gameplay?.activate(object.actionId);
    if (gameplayFeedback !== undefined) return gameplayFeedback;
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
    gameplay?.interactionObjects ?? options.interactionObjects,
    activateProgress,
  );
  let lifecycle!: RuntimeLifecycleController;
  let recovery!: PlayerRecoveryRuntime;
  recovery = new PlayerRecoveryRuntime({
    bus: businessBus,
    controls: motor.controls,
    world: physics,
    getCurrentSnapshot: () => snapshotStore.current,
    getCaptureSnapshot: () => checkpointCapture.snapshot,
    reconcilePermanentEffects,
    getPermanentEffects: () => progress.snapshot.effects,
    interruptInteraction: () => interaction.interruptTransientSession(),
    resetInputsAfterPlacement: () => {
      motor.reset();
      interaction.interruptTransientSession();
    },
    restoreFacing: facing => interaction.restoreFacing(facing),
    synchronizeCheckpointBaseline: (states, enabled, tick) => {
      checkpointTriggers.synchronizeBaseline(states, enabled, tick);
    },
    getCheckpointStates: () => physics.checkpointTriggers,
    getCheckpointEnabled: () => physics.checkpointTriggersEnabled,
    getLifecycle: () => lifecycle,
    options: recoveryOptions,
  });
  let resets = 0;
  simulation = new FixedStepSimulation(GRAYBOX_SIMULATION, (deltaMs, tick) => {
    checkpointTriggers.beginTick(tick);
    const velocity = recovery.controlLockHeld
      ? Object.freeze({ vx: 0, vy: 0 })
      : motor.beforeStep(physics.state, deltaMs);
    physics.drive(velocity.vx, velocity.vy);
    physics.step(deltaMs, tick); // Exactly one Matter update per actual SimulationTick.
    recovery.detectFailureAfterPhysics(tick, physics.failureZone);
    checkpointTriggers.observeAfterPhysics(
      tick,
      physics.checkpointTriggers,
      physics.checkpointTriggersEnabled && !recovery.triggersShielded,
    );
    checkpointTriggers.closeAndArbitrate(tick);
    if (!recovery.controlLockHeld) {
      motor.afterStep(physics.state, deltaMs);
    }
    interaction.updatePlayerState(physics.state);
    interaction.afterStep(physics.state, deltaMs);
    // Business coordination happens once after the actual world, physics and
    // interaction updates for this fixed Tick. New result events remain Pending
    // for the next coordination dispatch.
    const dispatch = businessBus.dispatch(tick);
    goalRoute.afterDispatch(tick, dispatch);
    gameplay?.afterDispatch(tick, dispatch);
    checkpointTriggers.startWinnerAfterDispatch(tick);
    checkpointCapture.afterDispatch(tick, dispatch);
    checkpointTriggers.afterDispatch(
      tick,
      dispatch,
      checkpointCapture.snapshot,
    );
    recovery.advanceAfterCoordination(tick, deltaMs);
    reconcilePermanentEffects();
  });
  lifecycle = new RuntimeLifecycleController(simulation);
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
    requestRecoveryRetry: () => recovery.requestManualRetry(),
    showRecoveryTitle: () => recovery.showRecoveryTitle(),
    returnToRecoveryError: () => recovery.returnToRecoveryError(),
    setAvailable: (available: boolean) => {
      interaction.setAvailable(available);
      motor.controls.request(availabilityOwner, !available);
    },
    reset(): DebugResetResult {
      if (recovery.blocksDebugActions) {
        const message =
          'Debug reset is unavailable while fall recovery owns the control lock.';
        checkpointTriggers.noteResetBlocked(message);
        return Object.freeze({ status: 'blocked' as const, message });
      }
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
        gameplay: gameplay?.snapshot ?? null,
        checkpointSnapshot: Object.freeze({
          ...checkpointSnapshot,
          current: snapshotStore.current,
        }),
        checkpointCapture: checkpointCapture.snapshot,
        checkpointTriggers: checkpointTriggers.snapshot,
        recovery: recovery.snapshot,
        frozenTemporaryObjectIds: physics.frozenTemporaryObjectIds,
      };
    },
  };
}
export type GrayboxCore = ReturnType<typeof createGrayboxCore>;

function createRecoveryOptionsForScenario(
  base: PlayerRecoveryOptions | undefined,
  scenario: GrayboxCoreOptions['recoveryFaultScenario'],
  snapshotStore: FixedTemporarySnapshotStore,
  physics: GrayboxPhysics,
  snapshotScenario: SnapshotScenario,
): PlayerRecoveryOptions | undefined {
  const withScenario = {
    ...base,
    snapshotScenario,
  } as const;
  if (scenario !== 'd11-a3-suite') return withScenario;
  if (typeof physics.removeManagedBodyForRecoveryTest !== 'function' ||
      typeof physics.blockRecoveryAnchorForTest !== 'function' ||
      typeof physics.removeRecoveryBodyForTest !== 'function') {
    throw new Error('D11-A3 recovery fixture requires the Matter test hooks.');
  }
  let recoveryOrdinal = 0;
  let attemptOrdinal = 0;
  let fallbackBlockerInstalled = false;
  return Object.freeze({
    ...withScenario,
    sourceOverride: () => {
      const source = base?.sourceOverride
        ? base.sourceOverride()
        : snapshotStore.current;
      recoveryOrdinal++;
      attemptOrdinal = 0;
      if (recoveryOrdinal === 4 && source) {
        return { ...source, schemaVersion: 999 };
      }
      return source;
    },
    faultInjector: (point) => {
      base?.faultInjector?.(point);
      if (point === 'after-temporary-snapshot') {
        attemptOrdinal++;
      }
      if (point === 'before-control-release' &&
          recoveryOrdinal === 2 &&
          fallbackBlockerInstalled) {
        if (!physics.removeRecoveryBodyForTest?.(
          'd11-a3-primary-anchor-blocker',
        )) {
          throw new Error('D11-A3 fixture could not clear the anchor blocker.');
        }
        fallbackBlockerInstalled = false;
      }
      if (point !== 'after-rebuild') return;
      if (recoveryOrdinal === 1 && attemptOrdinal === 1) {
        if (!physics.removeManagedBodyForRecoveryTest?.('moving-horizontal-a')) {
          throw new Error('D11-A3 fixture could not remove the managed body.');
        }
      }
      if (recoveryOrdinal === 2 && !fallbackBlockerInstalled) {
        fallbackBlockerInstalled = true;
        if (!physics.blockRecoveryAnchorForTest?.(
          { x: 80, y: 472, facing: 1 },
          'd11-a3-primary-anchor-blocker',
        )) {
          throw new Error('D11-A3 fixture could not block the primary anchor.');
        }
      }
      if (recoveryOrdinal === 2 && attemptOrdinal === 1) {
        if (!physics.removeManagedBodyForRecoveryTest?.('moving-horizontal-a')) {
          throw new Error('D11-A3 fixture could not trigger the auto fallback path.');
        }
      }
      if (recoveryOrdinal === 3 && attemptOrdinal <= 3) {
        if (!physics.removeManagedBodyForRecoveryTest?.('moving-horizontal-a')) {
          throw new Error('D11-A3 fixture could not persist the body fault.');
        }
      }
    },
  });
}
