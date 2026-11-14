import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  captureInitialTemporarySnapshot,
  captureTemporarySnapshot,
  FixedTemporarySnapshotStore,
  GRAYBOX_CHECKPOINT_ID,
  GRAYBOX_LEVEL_ID,
  GRAYBOX_SNAPSHOT_REGISTRY,
  GRAYBOX_SNAPSHOT_SCHEMA_VERSION,
  GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  validateTemporarySnapshot,
} from '../src/core/snapshot.ts';

const runtimeInstanceId = '70000000-0000-4000-8000-000000000001';
const anchor = Object.freeze({ x: 80, y: 472, facing: 1 });

function platformState(objectId) {
  const horizontal = objectId === 'moving-horizontal-a';
  return {
    axis: horizontal ? 'horizontal' : 'vertical',
    clockMs: 0,
    position: horizontal ? { x: 1710, y: 300 } : { x: 1910, y: 310 },
    direction: horizontal ? 1 : -1,
    phase: 0,
    cycle: 0,
  };
}

function source() {
  return {
    captureTemporaryObject(objectId) {
      return platformState(objectId);
    },
  };
}

function validCandidate() {
  return {
    schemaVersion: GRAYBOX_SNAPSHOT_SCHEMA_VERSION,
    runtimeInstanceId,
    checkpointId: GRAYBOX_CHECKPOINT_ID,
    levelId: GRAYBOX_LEVEL_ID,
    anchor: { ...anchor },
    objects: GRAYBOX_SNAPSHOT_REGISTRY.map(entry => ({
      objectId: entry.objectId,
      stateVersion: entry.stateVersion,
      state: platformState(entry.objectId),
    })),
  };
}

function rejects(mutator, pattern) {
  const candidate = validCandidate();
  mutator(candidate);
  assert.throws(() => validateTemporarySnapshot(candidate), pattern);
}

test('D10-A1 CP01 fixed registry accepts the exact set and rejects malformed manifests', () => {
  assert.deepEqual(GRAYBOX_SNAPSHOT_REGISTRY.map(entry => entry.objectId), [
    'moving-horizontal-a',
    'moving-vertical-a',
  ]);
  const valid = validateTemporarySnapshot(validCandidate());
  assert.equal(valid.schemaVersion, 1);
  assert.deepEqual(valid.objects.map(object => object.stateVersion), [1, 1]);
  assert.ok(Object.isFrozen(GRAYBOX_SNAPSHOT_REGISTRY));
  assert.ok(Object.isFrozen(valid));
  assert.ok(Object.isFrozen(valid.objects));
  assert.ok(Object.isFrozen(valid.objects[0].state.position));

  rejects(candidate => {
    candidate.objects[1].objectId = 'moving-horizontal-a';
  }, /Duplicate snapshot objectId/);
  rejects(candidate => {
    candidate.objects.pop();
  }, /incomplete|required-object/);
  rejects(candidate => {
    candidate.objects.push({
      objectId: 'moving-horizontal-b',
      stateVersion: 1,
      state: platformState('moving-horizontal-a'),
    });
  }, /incomplete|required-object/);
  rejects(candidate => {
    candidate.objects[0].objectId = 'moving-horizontal-unknown';
  }, /required|Unknown/);
  rejects(candidate => {
    candidate.objects[0].stateVersion = 2;
  }, /unsupported stateVersion/);
  rejects(candidate => {
    candidate.schemaVersion = 2;
  }, /Unsupported snapshot schemaVersion/);
  assert.throws(
    () => captureTemporarySnapshot({}, { runtimeInstanceId, anchor }),
    /captureTemporaryObject/,
  );
});

test('D10-A1 CP02 capture validates both objects, versions and the spawn anchor', () => {
  const record = captureTemporarySnapshot(source(), { runtimeInstanceId, anchor });
  assert.equal(record.runtimeInstanceId, runtimeInstanceId);
  assert.equal(record.checkpointId, GRAYBOX_CHECKPOINT_ID);
  assert.equal(record.levelId, GRAYBOX_LEVEL_ID);
  assert.deepEqual(record.anchor, { x: 80, y: 472, facing: 1 });
  assert.deepEqual(record.objects.map(object => ({
    id: object.objectId,
    version: object.stateVersion,
    clockMs: object.state.clockMs,
  })), [
    { id: 'moving-horizontal-a', version: 1, clockMs: 0 },
    { id: 'moving-vertical-a', version: 1, clockMs: 0 },
  ]);
});

test('D10-A1 CP03 failed capture or commit leaves no half record and preserves an old record', () => {
  const store = new FixedTemporarySnapshotStore();
  const first = captureTemporarySnapshot(source(), { runtimeInstanceId, anchor });
  const old = store.commit(first);

  let captures = 0;
  const partial = captureInitialTemporarySnapshot(source(), {
    runtimeInstanceId: '70000000-0000-4000-8000-000000000002',
    anchor,
  }, store, phase => {
    if (phase === 'capture' && ++captures === 2) throw new Error('second object failed');
  });
  assert.equal(partial.status, 'FAILED');
  assert.match(partial.error, /second object failed/);
  assert.equal(store.current, old);

  const candidate = validCandidate();
  candidate.anchor.x = Number.NaN;
  assert.throws(
    () => store.commit(candidate),
    /finite/,
  );
  assert.equal(store.current, old);

  const replacement = validCandidate();
  replacement.runtimeInstanceId = '70000000-0000-4000-8000-000000000003';
  assert.throws(() => store.commit(replacement, phase => {
    if (phase === 'commit') throw new Error('commit unavailable');
  }), /commit unavailable/);
  assert.equal(store.current, old);

  const emptyStore = new FixedTemporarySnapshotStore();
  const failed = captureInitialTemporarySnapshot(source(), { runtimeInstanceId, anchor }, emptyStore,
    phase => {
      if (phase === 'validate') throw new Error('validation failed');
    });
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.current, null);
  assert.equal(emptyStore.current, null);
});

test('D10-A1 CP03 stored data is detached and immutable from its capture source', () => {
  const mutable = {
    captureTemporaryObject(objectId) {
      return platformState(objectId);
    },
  };
  const record = captureTemporarySnapshot(mutable, { runtimeInstanceId, anchor });
  const before = JSON.stringify(record);
  const returnedRaw = mutable.captureTemporaryObject('moving-horizontal-a');
  returnedRaw.position.x = 999;
  assert.equal(JSON.stringify(record), before);
  assert.throws(() => {
    record.objects[0].state.position.x = 999;
  }, /read only|Cannot assign/);
  assert.equal(JSON.stringify(record), before);
});

test('D10-A1 CP04 snapshot rejects non-finite data, wrong versions and excluded fields', () => {
  rejects(candidate => {
    candidate.objects[0].state.clockMs = Number.NaN;
  }, /finite/);
  rejects(candidate => {
    candidate.objects[0].state.position.x = Number.POSITIVE_INFINITY;
  }, /finite/);
  rejects(candidate => {
    candidate.objects[0].state.axis = 'vertical';
  }, /axis/);
  rejects(candidate => {
    candidate.objects[0].state.direction = 0;
  }, /direction/);
  rejects(candidate => {
    candidate.objects[0].state.phase = 1;
  }, /phase/);
  rejects(candidate => {
    candidate.objects[0].state.cycle = 0.5;
  }, /cycle/);
  rejects(candidate => {
    candidate.progress = { collections: [] };
  }, /unsupported shape/);
  rejects(candidate => {
    candidate.objects[0].state.eventId = 1;
  }, /unsupported shape/);
});

test('D10-A2 CT04 only trusted checkpoint ID, level and preset anchor may replace the record', () => {
  const testCheckpoint = validCandidate();
  testCheckpoint.checkpointId = GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID;
  testCheckpoint.anchor = { x: 1200, y: 472, facing: 1 };
  const captured = validateTemporarySnapshot(
    testCheckpoint,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );
  assert.equal(captured.checkpointId, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID);
  assert.deepEqual(captured.anchor, { x: 1200, y: 472, facing: 1 });

  const wrongAnchor = structuredClone(testCheckpoint);
  wrongAnchor.anchor.x = 1201;
  assert.throws(
    () => validateTemporarySnapshot(wrongAnchor, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID),
    /trusted checkpoint configuration/,
  );
  const wrongLevel = structuredClone(testCheckpoint);
  wrongLevel.levelId = 'other-level';
  assert.throws(
    () => validateTemporarySnapshot(wrongLevel, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID),
    /levelId/,
  );
  assert.throws(
    () => validateTemporarySnapshot(testCheckpoint, 'graybox-untrusted-capture'),
    /checkpointId/,
  );
});
