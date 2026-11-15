import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  FIRST_LEVEL_ACTIONS,
  FIRST_LEVEL_DEFINITION,
  FIRST_LEVEL_EVENT_TYPES,
  FIRST_LEVEL_INITIAL_CHECKPOINT_ID,
  FIRST_LEVEL_INTERACTIONS,
  FIRST_LEVEL_SPATIAL_CONFIG,
  FIRST_LEVEL_SNAPSHOT_SCENARIO,
  FirstLevelRuntime,
} from '../src/core/first-level.ts';
import { createGrayboxCore } from '../src/core/graybox.ts';
import { INTERACTION_OBJECTS } from '../src/core/interaction.ts';
import {
  captureTemporarySnapshot,
} from '../src/core/snapshot.ts';
import {
  PROTOTYPE_LEVEL_SCHEMA_VERSION,
  validatePrototypeLevelDefinition,
} from '../src/core/prototype-level.ts';
import { InMemoryRunProgress } from '../src/core/progress.ts';
import { PLAYER_PROTOTYPE } from '../src/core/player.ts';
import { FirstLevelMatterWorld } from '../src/physics/matter/first-level-world.ts';
import {
  createPrototypeLevelAssembly,
} from '../src/physics/matter/level-assembly.ts';

const M = createRequire(import.meta.url)(
  '../node_modules/phaser/src/physics/matter-js/CustomMain.js',
);

const TEST_LEVEL_ID = 'mlv-test-layout-a';
const TEST_CHECKPOINT_ID = 'mlv-test-checkpoint-a';
const TEST_LIFT_ID = 'mlv-test-vertical-lift-a';
const TEST_ROUTE_EFFECT_ID = 'mlv-test-route-effect-a';
const TEST_FAILURE_ZONE_ID = 'mlv-test-failure-zone-a';
const TEST_RUNTIME_ID = 'd1500000-0000-4000-8000-000000000001';
const TEST_FALLBACK_ANCHOR = Object.freeze({
  x: 180,
  y: 338,
  facing: -1,
});

const TEST_LEVEL_INPUT = Object.freeze({
  schemaVersion: PROTOTYPE_LEVEL_SCHEMA_VERSION,
  levelId: TEST_LEVEL_ID,
  size: Object.freeze({ width: 1200, height: 700 }),
  spawn: Object.freeze({ x: 250, y: 338, facing: 1 }),
  terrain: Object.freeze([
    Object.freeze({
      type: 'static-rectangle',
      objectId: 'mlv-test-ground-object',
      label: 'mlv-test-ground',
      x: 330,
      y: 400,
      width: 620,
      height: 80,
    }),
    Object.freeze({
      type: 'static-rectangle',
      objectId: 'mlv-test-step-object',
      label: 'mlv-test-step',
      x: 560,
      y: 330,
      width: 120,
      height: 20,
    }),
    Object.freeze({
      type: 'static-rectangle',
      objectId: 'mlv-test-lift-landing-object',
      label: 'mlv-test-lift-landing',
      x: 930,
      y: 430,
      width: 260,
      height: 30,
    }),
  ]),
  routeGate: Object.freeze({
    type: 'route-gate',
    objectId: 'mlv-test-route-gate-object',
    label: 'mlv-test-route-gate',
    x: 835,
    y: 350,
    width: 18,
    height: 90,
  }),
  lift: Object.freeze({
    type: 'vertical-lift',
    objectId: TEST_LIFT_ID,
    label: TEST_LIFT_ID,
    axis: 'vertical',
    x: 910,
    fromY: 280,
    toY: 380,
    width: 88,
    height: 18,
    periodMs: 2000,
  }),
  failureZone: Object.freeze({
    type: 'failure-sensor',
    objectId: 'mlv-test-failure-object',
    zoneId: TEST_FAILURE_ZONE_ID,
    label: 'MLV test failure sensor',
    x: 600,
    y: 690,
    width: 1200,
    height: 20,
  }),
  routeEffectId: TEST_ROUTE_EFFECT_ID,
  bodyLabels: Object.freeze({
    player: 'mlv-test-player',
    foot: 'mlv-test-foot',
    anchorProbe: 'mlv-test-anchor-probe',
    supportProbe: 'mlv-test-support-probe',
  }),
  snapshotScenario: Object.freeze({
    schemaVersion: 1,
    defaultCheckpointId: TEST_CHECKPOINT_ID,
    checkpointConfigs: Object.freeze([
      Object.freeze({
        checkpointId: TEST_CHECKPOINT_ID,
        levelId: TEST_LEVEL_ID,
        anchor: Object.freeze({ x: 250, y: 338, facing: 1 }),
        fallbackAnchors: Object.freeze([TEST_FALLBACK_ANCHOR]),
      }),
    ]),
    registry: Object.freeze([
      Object.freeze({
        objectId: TEST_LIFT_ID,
        stateVersion: 1,
        axis: 'vertical',
      }),
    ]),
  }),
  interactions: Object.freeze([
    Object.freeze({
      id: 'mlv-test-readonly-investigation',
      kind: 'investigation',
      label: 'MLV test object',
      title: 'Read-only prototype object',
      content: 'This object has no action, progress or reward identity.',
      x: 300,
      y: 320,
      rangeX: 70,
      rangeY: 90,
    }),
  ]),
});

let runtimeOrdinal = 0;
let eventOrdinal = 0;
const uuidProvider = {
  generate() {
    runtimeOrdinal++;
    return `d1500000-0000-4000-8000-${String(runtimeOrdinal).padStart(12, '0')}`;
  },
};
const uniqueRuntimeProvider = () => ({
  generate() {
    eventOrdinal++;
    return `d1600000-0000-4000-8000-${String(eventOrdinal).padStart(12, '0')}`;
  },
});

function clone(value) {
  return structuredClone(value);
}

function createStepDriver(core) {
  let sampleMs = 0;
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) {
      sampleMs += core.config.fixedDeltaMs;
      core.frame(sampleMs);
    }
  };
  const stepUntil = (condition, maximum = 1000) => {
    for (let index = 0; index < maximum; index++) {
      if (condition(core.snapshot)) return index;
      step();
    }
    assert.fail(`Condition not reached: ${JSON.stringify(core.snapshot)}`);
  };
  return { step, stepUntil };
}

function assembleTestLayout(overrides = {}) {
  return createPrototypeLevelAssembly(M, TEST_LEVEL_INPUT, {
    coreOptions: {
      uuidProvider: uniqueRuntimeProvider(),
      progress: new InMemoryRunProgress(),
      ...overrides,
    },
  });
}

function engineBodyLabels(engine) {
  return M.Composite.allBodies(engine.world).map(body => body.label);
}

function withCountingMatter({ failBodyOrdinal } = {}) {
  const counts = { engines: 0, bodies: 0 };
  let currentBody = 0;
  const matter = {
    ...M,
    Engine: {
      ...M.Engine,
      create(...args) {
        counts.engines++;
        return M.Engine.create(...args);
      },
    },
    Bodies: {
      ...M.Bodies,
      rectangle(...args) {
        counts.bodies++;
        currentBody++;
        if (currentBody === failBodyOrdinal) {
          throw new Error(`Injected Body creation failure at ${currentBody}.`);
        }
        return M.Bodies.rectangle(...args);
      },
    },
  };
  return { matter, counts };
}

test('MLV-01A V01 restricted definitions reject before Engine or Body allocation', () => {
  const valid = validatePrototypeLevelDefinition(clone(TEST_LEVEL_INPUT));
  assert.equal(valid.levelId, TEST_LEVEL_ID);
  assert.equal(valid.snapshotScenario.checkpointConfigs.length, 1);
  assert.equal(valid.lift.objectId, valid.snapshotScenario.registry[0].objectId);
  assert.deepEqual(
    valid.snapshotScenario.checkpointConfigs[0].fallbackAnchors,
    [TEST_FALLBACK_ANCHOR],
  );

  const invalid = [
    ['schema', definition => {
      definition.schemaVersion = 999;
    }],
    ['root type', definition => {
      definition.terrain[0].type = 'arbitrary-behavior';
    }],
    ['lift axis', definition => {
      definition.lift.axis = 'horizontal';
    }],
    ['non-finite coordinate', definition => {
      definition.lift.fromY = Number.NaN;
    }],
    ['duplicate object id', definition => {
      definition.terrain[1].objectId = definition.terrain[0].objectId;
    }],
    ['duplicate body label', definition => {
      definition.terrain[1].label = definition.terrain[0].label;
    }],
    ['cross-level checkpoint', definition => {
      definition.snapshotScenario.checkpointConfigs[0].levelId = 'other-level';
    }],
    ['missing default checkpoint', definition => {
      definition.snapshotScenario.defaultCheckpointId = 'missing-checkpoint';
    }],
    ['spawn mismatch', definition => {
      definition.spawn.x += 1;
    }],
    ['registry mismatch', definition => {
      definition.snapshotScenario.registry[0].objectId = 'unknown-lift';
    }],
    ['state version', definition => {
      definition.snapshotScenario.registry[0].stateVersion = 2;
    }],
    ['unknown interaction kind', definition => {
      definition.interactions[0].kind = 'arbitrary-behavior';
    }],
    ['unsupported interaction shape', definition => {
      definition.interactions[0].unsupportedActionId = 'forbidden';
    }],
    ['non-finite interaction range', definition => {
      definition.interactions[0].rangeX = Number.POSITIVE_INFINITY;
    }],
    ['missing terrain', definition => {
      definition.terrain = [];
    }],
  ];

  for (const [name, mutate] of invalid) {
    const definition = clone(TEST_LEVEL_INPUT);
    mutate(definition);
    const counting = withCountingMatter();
    assert.throws(
      () => createPrototypeLevelAssembly(
        counting.matter,
        definition,
        {
          coreOptions: {
            uuidProvider: { generate: () => TEST_RUNTIME_ID },
          },
        },
      ),
      /Definition|definition|schemaVersion|type|axis|finite|Duplicate|level|Checkpoint|checkpoint|spawn|registry|stateVersion|terrain|interaction|unsupported/,
      name,
    );
    assert.deepEqual(counting.counts, { engines: 0, bodies: 0 }, name);
  }
});

test('MLV-01A V02 independent layout drives construction, movement, snapshot, recovery and reset', () => {
  const assembly = assembleTestLayout();
  const { core, world, engine } = assembly;
  const { step, stepUntil } = createStepDriver(core);
  let freezeOwner;
  let completed = false;
  let destroyResult;
  try {
    const initial = core.snapshot.checkpointSnapshot;
    assert.equal(initial.status, 'READY');
    assert.equal(initial.current.levelId, TEST_LEVEL_ID);
    assert.equal(initial.current.checkpointId, TEST_CHECKPOINT_ID);
    assert.equal(initial.current.objects[0].objectId, TEST_LIFT_ID);
    assert.equal(core.snapshot.gameplay, null);
    assert.equal(core.snapshot.progress.counts.goals, 0);
    assert.equal(core.snapshot.progress.counts.rewards, 0);
    assert.equal(core.snapshot.progress.counts.collections, 0);
    assert.equal(TEST_DEFINITION.interactions[0].actionId, undefined);
    assert.equal(TEST_DEFINITION.interactions[0].progress, undefined);
    assert.equal(world.spawnAnchor.x, 250);
    assert.equal(world.player.label, 'mlv-test-player');
    assert.equal(world.foot.label, 'mlv-test-foot');
    const bodyLabels = engineBodyLabels(engine);
    assert.ok(bodyLabels.includes('mlv-test-ground'));
    assert.ok(bodyLabels.includes('mlv-test-route-gate'));
    assert.ok(bodyLabels.includes(TEST_LIFT_ID));
    assert.ok(bodyLabels.includes('mlv-test-failure-object'));
    assert.ok(bodyLabels.includes('mlv-test-player'));
    assert.ok(!bodyLabels.some(label => label.startsWith('first-level')));

    step(6);
    assert.equal(core.snapshot.player.grounded, true);
    assert.equal(core.snapshot.player.support, 'mlv-test-ground');
    assert.equal(world.failureZone.zoneId, TEST_FAILURE_ZONE_ID);
    assert.equal(world.diagnostics.lift.label, TEST_LIFT_ID);

    world.setPermanentEffect(TEST_ROUTE_EFFECT_ID, true);
    step(122);
    assert.equal(world.routeOpen, true);
    assert.equal(world.routeGate.collisionFilter.mask, 0);
    assert.ok(world.platformClockMs > world.definition.lift.periodMs);
    assert.equal(world.diagnostics.lift.cycle, 1);
    assert.ok(Math.abs(world.liftBody.position.y - world.definition.lift.fromY) < 5);

    freezeOwner = {};
    const frozen = world.freezeTemporaryObjects([TEST_LIFT_ID], freezeOwner);
    assert.equal(frozen.status, 'frozen');
    const frozenState = captureTemporarySnapshot(
      world,
      {
        runtimeInstanceId: TEST_RUNTIME_ID,
        checkpointId: TEST_CHECKPOINT_ID,
        anchor: TEST_DEFINITION.spawn,
      },
      undefined,
      TEST_DEFINITION.snapshotScenario,
    );
    const frozenPosition = { ...world.liftBody.position };
    const frozenClock = world.platformClockMs;
    step(12);
    assert.deepEqual(world.liftBody.position, frozenPosition);
    assert.equal(world.platformClockMs, frozenClock);
    assert.equal(
      world.releaseTemporaryObjects(freezeOwner).status,
      'released',
    );

    step(12);
    assert.notDeepEqual(world.liftBody.position, frozenPosition);
    const originalLiftBody = world.liftBody;
    world.applyTemporarySnapshot(frozenState.objects);
    world.rebuildRecoveryWorld();
    assert.notEqual(world.liftBody, originalLiftBody);
    assert.ok(engineBodyLabels(engine).includes(TEST_LIFT_ID));
    const worldValidation = world.validateRecoveryWorld(
      frozenState.objects,
      [{ id: TEST_ROUTE_EFFECT_ID, expectedActive: true }],
    );
    assert.equal(worldValidation.status, 'valid');
    assert.deepEqual(worldValidation.critical, []);

    world.placePlayerAtAnchor({ x: 1150, y: 100, facing: 1 });
    assert.equal(
      world.validateRecoveryAnchor(TEST_DEFINITION.spawn, TEST_CHECKPOINT_ID).status,
      'valid',
    );
    world.placePlayerAtAnchor(TEST_DEFINITION.spawn);
    step(3);
    const reset = core.reset();
    assert.equal(reset.status, 'reset');
    assert.equal(core.snapshot.player.x, TEST_DEFINITION.spawn.x);
    // The independent test layout has no first-level progress record, so the
    // adapter contract is verified explicitly rather than through FirstLevelRuntime.
    assert.equal(world.routeOpen, false);

    world.placePlayerAtAnchor({
      x: world.failureZone.x,
      y: world.failureZone.y,
      facing: 1,
    });
    step(2);
    assert.equal(world.failureZone.occupied, true);
    assert.equal(world.failureZone.enterCount, 1);
    stepUntil(snapshot =>
      snapshot.recovery.phase === 'succeeded' &&
      snapshot.recovery.recoveryCount === 1, 800);
    assert.equal(world.routeOpen, false);
    assert.equal(core.snapshot.player.x, TEST_DEFINITION.spawn.x);
    world.setPermanentEffect(TEST_ROUTE_EFFECT_ID, true);
    world.setPermanentEffect(TEST_ROUTE_EFFECT_ID, true);
    world.setPermanentEffect('unrelated-effect', false);
    assert.equal(world.routeOpen, true);
    assert.equal(world.routeGate.collisionFilter.mask, 0);
    assert.ok(
      JSON.stringify(world.diagnostics).includes(TEST_LIFT_ID),
    );
    assert.ok(
      !JSON.stringify(world.diagnostics).includes('first-level'),
    );
    completed = true;
  } finally {
    if (freezeOwner && world.frozenTemporaryObjectIds.length > 0) {
      world.releaseTemporaryObjects(freezeOwner);
    }
    destroyResult = assembly.destroy();
  }
  if (completed) {
    assert.ok(
      destroyResult.status === 'destroyed' ||
        destroyResult.status === 'already-destroyed',
      JSON.stringify(destroyResult),
    );
  }
});

test('MLV-01A V03 two real Engines keep controls, interactions and lifecycle isolated', () => {
  const first = createPrototypeLevelAssembly(M, FIRST_LEVEL_DEFINITION, {
    coreOptions: { uuidProvider: uniqueRuntimeProvider() },
  });
  const second = assembleTestLayout();
  const firstDriver = createStepDriver(first.core);
  const secondDriver = createStepDriver(second.core);
  try {
    firstDriver.step(4);
    secondDriver.step(4);
    assert.notEqual(first.engine, second.engine);
    assert.notEqual(first.engine.world, second.engine.world);
    assert.notEqual(first.world.player, second.world.player);
    assert.notEqual(
      first.core.snapshot.checkpointSnapshot.current.runtimeInstanceId,
      second.core.snapshot.checkpointSnapshot.current.runtimeInstanceId,
    );
    assert.equal(second.core.snapshot.progress.counts.goals, 0);
    assert.equal(second.core.snapshot.progress.counts.rewards, 0);

    second.world.placePlayerAtAnchor(TEST_DEFINITION.spawn);
    secondDriver.step(2);
    second.core.key('KeyD', true);
    secondDriver.step(25);
    second.core.key('KeyD', false);
    secondDriver.step(5);
    assert.ok(second.core.snapshot.player.x > TEST_DEFINITION.spawn.x + 15);

    second.core.key('Space', true);
    secondDriver.step();
    second.core.key('Space', false);
    secondDriver.step(2);
    assert.ok(second.core.snapshot.player.vy < 0);

    second.world.placePlayerAtAnchor({
      x: 300,
      y: 320,
      facing: 1,
    });
    secondDriver.step(2);
    assert.equal(
      second.core.snapshot.interaction.selectedId,
      'mlv-test-readonly-investigation',
    );
    second.core.key('KeyE', true);
    secondDriver.step();
    second.core.key('KeyE', false);
    secondDriver.step();
    assert.equal(second.core.snapshot.interaction.mode, 'investigation');
    assert.deepEqual(second.core.snapshot.progress.counts, {
      collections: 0,
      goals: 0,
      rewards: 0,
      effects: 0,
    });
    assert.equal(second.core.closeInteraction(), true);
    secondDriver.step();

    const pauseOwner = Symbol('second-layout-pause');
    const pauseToken = second.core.lifecycle.acquire(
      pauseOwner,
      Symbol('hidden'),
    );
    assert.ok(pauseToken);
    const tickBeforePause = second.core.snapshot.tick;
    firstDriver.step(7);
    secondDriver.step(7);
    assert.equal(second.core.snapshot.tick, tickBeforePause);
    assert.ok(first.core.snapshot.tick > 1);
    assert.equal(
      second.core.lifecycle.release(pauseOwner, pauseToken),
      'released',
    );

    const firstDestroy = first.destroy();
    assert.equal(firstDestroy.status, 'destroyed');
    const secondTick = second.core.snapshot.tick;
    secondDriver.step(5);
    assert.ok(second.core.snapshot.tick > secondTick);
    assert.equal(first.resources.engineCleared, true);
  } finally {
    first.destroy();
    second.destroy();
  }
});

test('MLV-01A V04 invalid snapshot identity and object sets stop before recovery writes', () => {
  const corruptions = [
    ['runtime', snapshot => ({
      ...snapshot,
      runtimeInstanceId: '00000000-0000-4000-8000-000000000000',
    })],
    ['level', snapshot => ({ ...snapshot, levelId: 'wrong-level' })],
    ['checkpoint', snapshot => ({
      ...snapshot,
      checkpointId: 'wrong-checkpoint',
    })],
    ['schema', snapshot => ({ ...snapshot, schemaVersion: 999 })],
    ['object state version', snapshot => ({
      ...snapshot,
      objects: snapshot.objects.map(object => ({
        ...object,
        stateVersion: 999,
      })),
    })],
    ['missing object', snapshot => ({ ...snapshot, objects: [] })],
    ['non-finite payload', snapshot => ({
      ...snapshot,
      objects: snapshot.objects.map(object => ({
        ...object,
        state: {
          ...object.state,
          position: { ...object.state.position, x: Number.NaN },
        },
      })),
    })],
  ];

  for (const [name, mutate] of corruptions) {
    let injectedSource;
    const engine = M.Engine.create();
    const world = new FirstLevelMatterWorld(
      M,
      engine,
      deltaMs => M.Engine.update(engine, deltaMs),
      TEST_LEVEL_INPUT,
    );
    const core = createGrayboxCore(world, {
      uuidProvider: uniqueRuntimeProvider(),
      interactionObjects: TEST_DEFINITION.interactions,
      recoveryOptions: {
        sourceOverride: () => injectedSource,
      },
    });
    const { step, stepUntil } = createStepDriver(core);
    try {
      const original = core.snapshot.checkpointSnapshot.current;
      assert.ok(original);
      injectedSource = mutate(clone(original));
      let worldWrites = 0;
      const apply = world.applyTemporarySnapshot.bind(world);
      const rebuild = world.rebuildRecoveryWorld.bind(world);
      const place = world.placePlayerAtAnchor.bind(world);
      const effect = world.setPermanentEffect.bind(world);
      world.applyTemporarySnapshot = (...args) => {
        worldWrites++;
        return apply(...args);
      };
      world.rebuildRecoveryWorld = () => {
        worldWrites++;
        return rebuild();
      };
      world.placePlayerAtAnchor = (...args) => {
        worldWrites++;
        return place(...args);
      };
      world.setPermanentEffect = (...args) => {
        worldWrites++;
        return effect(...args);
      };
      place({
        x: TEST_LEVEL_INPUT.failureZone.x,
        y: TEST_LEVEL_INPUT.failureZone.y,
        facing: 1,
      });
      stepUntil(snapshot => snapshot.recovery.phase === 'failed', 500);
      assert.equal(worldWrites, 0, name);
      assert.equal(core.snapshot.checkpointSnapshot.current, original, name);
      assert.equal(core.snapshot.recovery.controlLockHeld, true, name);
      assert.equal(core.snapshot.recovery.sourceSnapshot, null, name);
      assert.equal(core.snapshot.recovery.worldValidation, null, name);
      assert.equal(core.snapshot.recovery.placedTick, null, name);
    } finally {
      world.dispose();
      M.Engine.clear(engine);
    }
  }
});

test('MLV-01A-R1 R01 active first-level transaction blocks core and assembly destruction', () => {
  let runtime;
  const assembly = createPrototypeLevelAssembly(M, FIRST_LEVEL_DEFINITION, {
    coreOptions: {
      uuidProvider: uniqueRuntimeProvider(),
      extraEventTypes: FIRST_LEVEL_EVENT_TYPES,
      createGameplayRuntime: context => {
        runtime = new FirstLevelRuntime(context);
        return runtime;
      },
    },
  });
  const { core, world, engine } = assembly;
  const { step, stepUntil } = createStepDriver(core);
  try {
    core.frame(0);
    assert.ok(runtime);
    runtime.activate(FIRST_LEVEL_ACTIONS.talkToNpc);
    step();

    const active = core.snapshot;
    const quest = active.gameplay.actions.find(
      action => action.action === 'quest',
    ).flow;
    assert.equal(quest.phase, 'verifying');
    assert.equal(quest.transactionStatus, 'running');
    assert.equal(quest.eventId, 1);
    assert.equal(quest.commandId, 1);
    assert.equal(quest.transactionId, 1);
    assert.equal(quest.resultEventId, null);
    assert.equal(quest.originalRetired, true);
    assert.equal(active.progress.counts.goals, 1);

    const bodyLabelsBefore = engineBodyLabels(engine);
    const engineTimestampBefore = engine.timing.timestamp;
    const coreBlocked = core.destroy();
    assert.equal(coreBlocked.status, 'blocked');
    assert.ok(
      coreBlocked.errors.some(error => error.includes('first-level:quest')),
      JSON.stringify(coreBlocked),
    );

    const assemblyBlocked = assembly.destroy();
    assert.equal(assemblyBlocked.status, 'blocked');
    assert.equal(assemblyBlocked.core.status, 'blocked');
    assert.equal(world.disposed, false);
    assert.equal(assembly.resources.engineCleared, false);
    assert.equal(assembly.resources.coreDestroyed, false);
    assert.deepEqual(engineBodyLabels(engine), bodyLabelsBefore);
    assert.equal(engine.timing.timestamp, engineTimestampBefore);

    const afterBlocked = core.snapshot;
    assert.equal(afterBlocked.destroyed, false);
    assert.equal(afterBlocked.tick, active.tick);
    assert.equal(afterBlocked.physicsSteps, active.physicsSteps);
    assert.deepEqual(afterBlocked.progress, active.progress);
    assert.equal(
      afterBlocked.gameplay.actions[0].flow.eventId,
      quest.eventId,
    );
    assert.equal(
      afterBlocked.gameplay.actions[0].flow.commandId,
      quest.commandId,
    );
    assert.equal(
      afterBlocked.gameplay.actions[0].flow.transactionId,
      quest.transactionId,
    );

    stepUntil(snapshot =>
      snapshot.gameplay.actions[0].flow.phase === 'succeeded', 20);
    const completed = core.snapshot;
    assert.equal(completed.progress.counts.goals, 1);
    assert.equal(
      completed.gameplay.actions[0].flow.resultConsumptionCount,
      1,
    );

    assert.equal(assembly.destroy().status, 'destroyed');
    assert.equal(world.disposed, true);
    assert.equal(assembly.resources.engineCleared, true);
    assert.equal(core.snapshot.destroyed, true);
    assert.equal(assembly.destroy().status, 'already-destroyed');
  } finally {
    if (!world.disposed) world.dispose();
    if (!assembly.resources.engineCleared) {
      M.Engine.clear(engine);
      M.Composite.clear(engine.world, false, true);
    }
  }
});

test('MLV-01A-R1 R02 own goal route blocks while verifying and terminal-pending', () => {
  const assembly = assembleTestLayout({
    interactionObjects: INTERACTION_OBJECTS,
    goalRouteOptions: {
      transactionFaultInjector(point) {
        if (point === 'before-terminal-commit') {
          throw new Error('Injected terminal registration interruption.');
        }
      },
    },
  });
  const { core, world, engine } = assembly;
  const { step } = createStepDriver(core);
  const goal = INTERACTION_OBJECTS.find(
    object => object.progress?.category === 'goal',
  );
  try {
    assert.ok(goal);
    world.placePlayerAtAnchor({ x: goal.x, y: goal.y, facing: 1 });
    step(2);
    assert.equal(core.snapshot.interaction.selectedId, goal.id);
    core.key('KeyE', true);
    step();
    core.key('KeyE', false);

    const verifying = core.snapshot.goalRoute;
    assert.equal(verifying.phase, 'verifying');
    assert.equal(verifying.transactionStatus, 'running');
    assert.equal(verifying.originalRetired, true);
    assert.equal(verifying.resultEventId, null);
    const verifyingBlocked = core.destroy();
    assert.equal(verifyingBlocked.status, 'blocked');
    assert.ok(
      verifyingBlocked.errors.some(error => error.includes('core goal route')),
      JSON.stringify(verifyingBlocked),
    );

    step();
    const pending = core.snapshot.goalRoute;
    assert.equal(pending.phase, 'blocked');
    assert.equal(pending.transactionStatus, 'terminal-pending');
    assert.equal(pending.eventId, verifying.eventId);
    assert.equal(pending.commandId, verifying.commandId);
    assert.equal(pending.transactionId, verifying.transactionId);
    assert.equal(pending.resultEventId, null);
    assert.equal(core.snapshot.progress.counts.goals, 1);

    const pendingBlocked = core.destroy();
    assert.equal(pendingBlocked.status, 'blocked');
    assert.ok(
      pendingBlocked.errors.some(error =>
        error.includes('terminal-pending')),
      JSON.stringify(pendingBlocked),
    );
    assert.equal(world.disposed, false);
    assert.equal(assembly.resources.engineCleared, false);
    assert.equal(core.snapshot.destroyed, false);
    assert.equal(core.snapshot.progress.counts.goals, 1);
    assert.equal(core.snapshot.goalRoute.counts.commands, 1);
    assert.equal(core.snapshot.goalRoute.counts.transactions, 1);
    assert.equal(core.snapshot.goalRoute.counts.resultEvents, 0);
  } finally {
    if (!world.disposed) world.dispose();
    if (!assembly.resources.engineCleared) {
      M.Engine.clear(engine);
      M.Composite.clear(engine.world, false, true);
    }
  }
});

test('MLV-01A V05-A owned Matter resources, terminal gates and cleanup failures are bounded', () => {
  for (let round = 0; round < 3; round++) {
    const assembly = assembleTestLayout();
    const { core, world, engine } = assembly;
    const { step } = createStepDriver(core);
    const initialBodies = engineBodyLabels(engine);
    assert.ok(initialBodies.length > 0);
    assert.ok(world.ownedBodyCount > 0);
    step();
    assert.equal(assembly.destroy().status, 'destroyed');
    assert.equal(world.disposed, true);
    assert.equal(world.ownedBodyCount, 0);
    assert.equal(assembly.resources.engineCleared, true);
    assert.deepEqual(M.Composite.allBodies(engine.world), []);
    assert.equal(assembly.destroy().status, 'already-destroyed');
  }

  const borrowedEngine = M.Engine.create();
  const sentinel = M.Bodies.rectangle(20, 20, 10, 10, { label: 'sentinel' });
  M.Composite.add(borrowedEngine.world, sentinel);
  const sharedDefinition = validatePrototypeLevelDefinition(TEST_LEVEL_INPUT);
  const borrowedWorld = new FirstLevelMatterWorld(
    M,
    borrowedEngine,
    deltaMs => M.Engine.update(borrowedEngine, deltaMs),
    sharedDefinition,
  );
  const borrowedCore = createGrayboxCore(borrowedWorld, {
    uuidProvider: uniqueRuntimeProvider(),
    interactionObjects: sharedDefinition.interactions,
  });
  const driver = createStepDriver(borrowedCore);
  driver.step(2);
  borrowedWorld.rebuildRecoveryWorld();
  const oldFrame = borrowedCore.frame;
  const oldKey = borrowedCore.key;
  const oldAcquire = borrowedCore.lifecycle.acquire;
  const oldRelease = borrowedCore.lifecycle.release;
  const pauseOwner = Symbol('terminal-pause-owner');
  const pauseToken = borrowedCore.lifecycle.acquire(
    pauseOwner,
    Symbol('terminal-pause'),
  );
  assert.ok(pauseToken);
  const blockedDestroy = borrowedCore.destroy();
  assert.equal(blockedDestroy.status, 'blocked');
  assert.ok(
    blockedDestroy.errors.some(error => error.includes('pause token')),
    'An active pause owner must be reported as a destroy blocker',
  );
  assert.equal(
    borrowedCore.lifecycle.release(pauseOwner, pauseToken),
    'released',
  );
  assert.equal(borrowedCore.snapshot.pauseCount, 0);
  const before = borrowedCore.snapshot;
  assert.equal(borrowedCore.destroy().status, 'destroyed');
  oldKey('KeyD', true);
  oldFrame(before.tick + 10000);
  assert.equal(oldAcquire(Symbol('after-destroy'), Symbol('key')), undefined);
  assert.equal(oldRelease(pauseOwner, pauseToken), 'already-released');
  assert.equal(
    oldRelease(Symbol('wrong-owner'), pauseToken),
    'rejected',
  );
  assert.equal(
    oldRelease(pauseOwner, Symbol('unknown-token')),
    'rejected',
  );
  const after = borrowedCore.snapshot;
  assert.equal(after.tick, before.tick);
  assert.equal(after.paused, before.paused);
  assert.equal(after.physicsSteps, before.physicsSteps);
  assert.equal(after.player.x, before.player.x);
  assert.equal(after.pauseCount, before.pauseCount);
  assert.equal(after.progress.counts.goals, before.progress.counts.goals);
  assert.equal(after.destroyed, true);
  borrowedWorld.dispose();
  borrowedWorld.dispose();
  assert.deepEqual(
    M.Composite.allBodies(borrowedEngine.world).map(body => body.label),
    ['sentinel'],
  );
  M.Engine.clear(borrowedEngine);

  const partial = withCountingMatter({ failBodyOrdinal: 4 });
  const partialEngine = M.Engine.create();
  const partialSentinel = M.Bodies.rectangle(30, 30, 8, 8, {
    label: 'partial-sentinel',
  });
  M.Composite.add(partialEngine.world, partialSentinel);
  assert.throws(
    () => new FirstLevelMatterWorld(
      partial.matter,
      partialEngine,
      deltaMs => M.Engine.update(partialEngine, deltaMs),
      TEST_LEVEL_INPUT,
    ),
    /Injected Body creation failure/,
  );
  assert.deepEqual(
    M.Composite.allBodies(partialEngine.world).map(body => body.label),
    ['partial-sentinel'],
  );
  M.Engine.clear(partialEngine);

  const cleanupEngine = M.Engine.create();
  let failRemoval = true;
  let removalException = false;
  const faultingMatter = {
    ...M,
    Composite: {
      ...M.Composite,
      remove(composite, body) {
        if (failRemoval && body.label === TEST_LIFT_ID && !removalException) {
          removalException = true;
          throw new Error('Injected Body removal failure.');
        }
        return M.Composite.remove(composite, body);
      },
    },
  };
  const cleanupWorld = new FirstLevelMatterWorld(
    faultingMatter,
    cleanupEngine,
    deltaMs => M.Engine.update(cleanupEngine, deltaMs),
    TEST_LEVEL_INPUT,
  );
  assert.throws(() => cleanupWorld.dispose(), AggregateError);
  assert.ok(cleanupWorld.disposeError);
  assert.ok(cleanupWorld.ownedBodyCount > 0);
  failRemoval = false;
  cleanupWorld.dispose();
  assert.equal(cleanupWorld.disposed, true);
  assert.equal(cleanupWorld.ownedBodyCount, 0);
  M.Engine.clear(cleanupEngine);

  const unaffected = assembleTestLayout();
  assert.equal(unaffected.core.destroy().status, 'destroyed');
  assert.equal(unaffected.world.disposed, false);
  assert.equal(unaffected.destroy().status, 'destroyed');
  assert.equal(unaffected.world.disposed, true);

  const cleanupTrace = [];
  assert.throws(() => createPrototypeLevelAssembly(M, TEST_LEVEL_INPUT, {
    coreOptions: { uuidProvider: uniqueRuntimeProvider() },
    faultInjector(point) {
      cleanupTrace.push(point);
      if (point === 'after-core') {
        throw new Error('Injected assembly failure after core.');
      }
    },
  }), /Injected assembly failure after core/);
  assert.deepEqual(cleanupTrace, [
    'after-engine',
    'after-world',
    'after-core',
    'cleanup-core',
    'cleanup-world',
    'cleanup-engine',
  ]);

  let failWorldCleanupOnce = true;
  const retryableAssembly = createPrototypeLevelAssembly(
    M,
    TEST_LEVEL_INPUT,
    {
      coreOptions: { uuidProvider: uniqueRuntimeProvider() },
      faultInjector(point) {
        if (point === 'cleanup-world' && failWorldCleanupOnce) {
          failWorldCleanupOnce = false;
          throw new Error('Injected one-shot world cleanup failure.');
        }
      },
    },
  );
  const firstCleanup = retryableAssembly.destroy();
  assert.equal(firstCleanup.status, 'cleanup-failed');
  assert.equal(firstCleanup.core.status, 'destroyed');
  assert.equal(retryableAssembly.world.disposed, false);
  assert.equal(retryableAssembly.resources.engineCleared, true);
  const retriedCleanup = retryableAssembly.destroy();
  assert.equal(retriedCleanup.status, 'destroyed');
  assert.equal(retryableAssembly.world.disposed, true);
  assert.equal(retriedCleanup.core.status, 'already-destroyed');
  assert.equal(retryableAssembly.destroy().status, 'already-destroyed');
});

test('MLV-01A V06 default definition preserves the first-level values and existing behavior', () => {
  assert.equal(FIRST_LEVEL_DEFINITION.levelId, 'first-level-night-postcard');
  assert.deepEqual(FIRST_LEVEL_DEFINITION.size, FIRST_LEVEL_SPATIAL_CONFIG.size);
  assert.deepEqual(FIRST_LEVEL_DEFINITION.spawn, FIRST_LEVEL_SPATIAL_CONFIG.spawn);
  assert.deepEqual(
    FIRST_LEVEL_DEFINITION.terrain.map(terrain => ({
      label: terrain.label,
      x: terrain.x,
      y: terrain.y,
      width: terrain.width,
      height: terrain.height,
    })),
    FIRST_LEVEL_SPATIAL_CONFIG.terrain.map(terrain => ({
      label: terrain.label,
      x: terrain.x,
      y: terrain.y,
      width: terrain.width,
      height: terrain.height,
    })),
  );
  assert.deepEqual(
    FIRST_LEVEL_DEFINITION.lift,
    {
      type: 'vertical-lift',
      objectId: 'first-level-service-lift',
      label: 'first-level-service-lift',
      axis: 'vertical',
      x: FIRST_LEVEL_SPATIAL_CONFIG.lift.x,
      fromY: FIRST_LEVEL_SPATIAL_CONFIG.lift.fromY,
      toY: FIRST_LEVEL_SPATIAL_CONFIG.lift.toY,
      width: FIRST_LEVEL_SPATIAL_CONFIG.lift.width,
      height: FIRST_LEVEL_SPATIAL_CONFIG.lift.height,
      periodMs: FIRST_LEVEL_SPATIAL_CONFIG.lift.periodMs,
    },
  );
  assert.deepEqual(
    FIRST_LEVEL_DEFINITION.snapshotScenario,
    FIRST_LEVEL_SNAPSHOT_SCENARIO,
  );
  assert.equal(
    FIRST_LEVEL_DEFINITION.snapshotScenario.defaultCheckpointId,
    FIRST_LEVEL_INITIAL_CHECKPOINT_ID,
  );
  assert.deepEqual(
    FIRST_LEVEL_DEFINITION.interactions,
    FIRST_LEVEL_INTERACTIONS,
  );
  assert.deepEqual(FIRST_LEVEL_DEFINITION.bodyLabels, {
    player: 'player',
    foot: 'foot-region',
    anchorProbe: 'first-level-anchor-probe',
    supportProbe: 'first-level-support-probe',
  });
  assert.equal(FIRST_LEVEL_DEFINITION.failureZone.objectId, 'failure-gap-early-a');
  assert.equal(FIRST_LEVEL_DEFINITION.failureZone.zoneId, 'failure-gap-early-a');
  assert.equal(FIRST_LEVEL_DEFINITION.failureZone.label, '首关可恢复坠落区');

  const assembly = createPrototypeLevelAssembly(M, FIRST_LEVEL_DEFINITION, {
    coreOptions: { uuidProvider: uniqueRuntimeProvider() },
  });
  const { step } = createStepDriver(assembly.core);
  try {
    step(4);
    assert.equal(assembly.core.snapshot.checkpointSnapshot.status, 'READY');
    assert.equal(assembly.core.snapshot.player.grounded, true);
    assert.equal(assembly.world.spawnAnchor.y, FIRST_LEVEL_SPATIAL_CONFIG.spawn.y);
    assert.ok(engineBodyLabels(assembly.engine).includes('a-ground'));
    assert.ok(engineBodyLabels(assembly.engine).includes('player'));
    assert.equal(assembly.world.foot.label, 'foot-region');
    assert.ok(engineBodyLabels(assembly.engine).includes('failure-gap-early-a'));
  } finally {
    assembly.destroy();
  }
});

const TEST_DEFINITION = validatePrototypeLevelDefinition(TEST_LEVEL_INPUT);
