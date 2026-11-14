import { createGameCore, type GameCore } from '../../core/game';
import type { GrayboxCore } from '../../core/graybox';
import { mountStartupScene } from '../../rendering/phaser/startup';
import { mountGrayboxScene } from '../../rendering/phaser/graybox';
import type { MatterGrayboxDiagnostics } from '../../physics/matter/graybox-world';
import { bindVisibilityPause } from './visibility';
import { bindPlayerInput } from './player-input';
import './style.css';

const parent = document.querySelector<HTMLElement>('#game');
const restart = document.querySelector<HTMLButtonElement>('#restart');
const error = document.querySelector<HTMLElement>('#error');
const diagnostics = document.querySelector<HTMLElement>('#diagnostics');
const sceneSelect = document.querySelector<HTMLSelectElement>('#scene-select');
const reset = document.querySelector<HTMLButtonElement>('#reset-graybox');

if (!parent || !restart || !error || !diagnostics || !sceneSelect || !reset) {
  throw new Error('Missing Web host elements.');
}

let destroy: (() => Promise<void>) | undefined;
let core: GameCore | GrayboxCore | undefined;
let unbind = () => {};
let lastGrayboxDiagnostics: MatterGrayboxDiagnostics | undefined;
const mode = sessionStorage.getItem('scene') === 'diagnostic' ? 'diagnostic' : 'graybox';
sceneSelect.value = mode;
reset.hidden = mode !== 'graybox';
const showDiagnostics = (diagnosticsState?: MatterGrayboxDiagnostics) => {
  if (!core) return;
  if (diagnosticsState) lastGrayboxDiagnostics = diagnosticsState;
  const grayboxDiagnostics = diagnosticsState ?? lastGrayboxDiagnostics;
  const sample = core.snapshot;
  const marker = 'player' in sample ? sample.player.x : sample.markerX;
  const common = [
    `${sample.paused ? 'PAUSED' : 'RUNNING'} | Tick ${sample.tick} | Marker ${marker.toFixed(2)}`,
    `${core.config.fixedDeltaMs.toFixed(3)} ms / step · max ${core.config.maxStepsPerFrame} steps / frame (prototype) | Tokens ${sample.pauseCount}`,
    `Steps ${sample.stepsLastFrame} | Remainder ${sample.remainderMs.toFixed(2)} ms | Discarded ${sample.discardedMs.toFixed(2)} ms`,
  ];
  if ('player' in sample) {
    const p = sample.player;
    common[0] = `${sample.paused ? 'PAUSED' : 'RUNNING'} | Tick ${sample.tick} | x ${p.x.toFixed(1)} y ${p.y.toFixed(1)} | ${p.support || 'AIR'} | Jumps ${p.jumps}`;
    if (grayboxDiagnostics) {
      const horizontal = grayboxDiagnostics.movingPlatforms.find(platform => platform.axis === 'horizontal');
      const vertical = grayboxDiagnostics.movingPlatforms.find(platform => platform.axis === 'vertical');
      if (horizontal && vertical) common.push(
        `Platforms ${grayboxDiagnostics.platformClockMs.toFixed(1)} ms | H x ${horizontal.x.toFixed(1)} phase ${horizontal.phase.toFixed(2)} ${horizontal.direction > 0 ? '→' : '←'} | V y ${vertical.y.toFixed(1)} phase ${vertical.phase.toFixed(2)} ${vertical.direction > 0 ? '↓' : '↑'}`,
      );
      const zones = ['diagnostic-zone-a', 'diagnostic-zone-b']
        .map(label => grayboxDiagnostics.diagnosticZones.find(zone => zone.label === label))
        .filter(zone => zone !== undefined);
      if (zones.length) common.push(
        `Zones baseline #${grayboxDiagnostics.diagnosticBaselineCount} @Tick ${grayboxDiagnostics.diagnosticBaselineTick} | ` +
        zones.map(zone => `${zone.label.endsWith('-a') ? 'A' : 'B'} ${zone.occupied ? 'ON' : 'OFF'} ${zone.occupied ? zone.occupiedSteps : zone.lastOccupiedSteps}t E${zone.enterCount} X${zone.exitCount}`).join(' | '),
      );
    }
    common.push(`Matter steps ${sample.physicsSteps} | Input ${p.controlAllowed ? 'ON' : 'LOCKED'} | ${p.needsRelease ? '请先松开 Space' : 'Space READY'}${p.y > 700 ? ' | 已掉出场景，请按 R 重置' : ''}`);
    const interaction = sample.interaction;
    common.push(
      `Interaction ${interaction.mode.toUpperCase()} | target ${interaction.activeId ?? interaction.selectedId ?? 'NONE'}` +
      ` | E consumed ${interaction.consumedCount} | starts ${interaction.investigationStarts}` +
      ` | feedback ${interaction.feedbackCount}${interaction.feedbackRemainingMs > 0 ? ` (${interaction.feedbackRemainingMs.toFixed(0)} ms)` : ''}`,
    );
    const progress = sample.progress;
    common.push(
      `Progress C${progress.counts.collections} G${progress.counts.goals}` +
      ` R${progress.counts.rewards} F${progress.counts.effects}` +
      ` | Gate ${grayboxDiagnostics?.progressRouteOpen ? 'OPEN' : 'CLOSED'}`,
    );
    const goalRoute = sample.goalRoute;
    common.push(
      `D09-D1 ${goalRoute.phase.toUpperCase()} | Runtime ${goalRoute.runtimeInstanceId}` +
      ` | Event ${goalRoute.eventId ?? '-'} Command ${goalRoute.commandId ?? '-'}` +
      ` Transaction ${goalRoute.transactionId ?? '-'} Result ${goalRoute.resultEventId ?? '-'}` +
      ` | Accept ${goalRoute.acceptedTick ?? '-'} Apply ${goalRoute.applyTick ?? '-'}` +
      ` Verify ${goalRoute.verifyTick ?? '-'} Consume ${goalRoute.resultConsumedTick ?? '-'}` +
      ` | ${goalRoute.message}`,
    );
    const checkpointSnapshot = sample.checkpointSnapshot;
    const checkpointRecord = checkpointSnapshot.current;
    const checkpointTriggers = sample.checkpointTriggers;
    const checkpointCapture = sample.checkpointCapture;
    const recovery = sample.recovery;
    common.push(
      `D10-A1 initial snapshot ${checkpointSnapshot.status}` +
      ` | attempts ${checkpointSnapshot.captureAttempts}` +
      ` | capture Tick ${checkpointSnapshot.capturedAtTick ?? '-'}` +
      ` | schema ${checkpointRecord?.schemaVersion ?? '-'}` +
      ` | objects ${checkpointRecord?.objects.length ?? 0}` +
      ` | anchor ${checkpointRecord ? `${checkpointRecord.anchor.x},${checkpointRecord.anchor.y},${checkpointRecord.anchor.facing}` : '-'}` +
      (checkpointSnapshot.error ? ` | ${checkpointSnapshot.error}` : ''),
    );
    common.push(
      `D10-A3 ${checkpointTriggers.phase.toUpperCase()}` +
      ` | current ${checkpointTriggers.currentCheckpointId ?? '-'}` +
      ` | candidate ${checkpointTriggers.candidateCheckpointId ?? '-'}` +
      ` | batch ${checkpointTriggers.batchTick ?? '-'} close ${checkpointTriggers.closedTick ?? '-'}` +
      ` | Entry ${checkpointTriggers.latestEntryEventId ?? '-'}` +
      ` Capture ${checkpointTriggers.latestCaptureEventId ?? '-'}` +
      ` | ${checkpointTriggers.feedback}`,
    );
    common.push(
      `D10-A3 capture ${checkpointCapture.phase}` +
      ` | source Entry ${checkpointCapture.sourceEntryEventId ?? '-'}` +
      ` Event ${checkpointCapture.eventId ?? '-'}` +
      ` Command ${checkpointCapture.commandId ?? '-'}` +
      ` Transaction ${checkpointCapture.transactionId ?? '-'}` +
      ` Result ${checkpointCapture.resultEventId ?? '-'}` +
      ` | saves ${checkpointCapture.successfulCommits}` +
      ` lock ${checkpointCapture.lock.held ? 'HELD' : 'FREE'}` +
      ` resources ${checkpointCapture.resourceOwnership.resourcesReleased ? 'RELEASED' : 'HELD'}`,
    );
    common.push(
      `D11-A1 recovery ${recovery.phase.toUpperCase()}` +
      ` | fall event ${recovery.failureEventId ?? '-'}` +
      ` | source ${recovery.sourceCheckpointId ?? '-'}` +
      ` | anchor ${recovery.sourceAnchor
        ? `${recovery.sourceAnchor.x},${recovery.sourceAnchor.y},${recovery.sourceAnchor.facing}`
        : '-'}` +
      ` | recovered ${recovery.recoveryCount}` +
      ` | control ${recovery.controlLockHeld ? 'LOCKED' : 'OPEN'}` +
      ` | ${recovery.message}`,
    );
    const horizontal = grayboxDiagnostics?.movingPlatforms.find(platform => platform.axis === 'horizontal');
    const vertical = grayboxDiagnostics?.movingPlatforms.find(platform => platform.axis === 'vertical');
    const zoneA = grayboxDiagnostics?.diagnosticZones.find(zone => zone.label === 'diagnostic-zone-a');
    const zoneB = grayboxDiagnostics?.diagnosticZones.find(zone => zone.label === 'diagnostic-zone-b');
    const checkpointZoneA = checkpointTriggers.zones.find(zone =>
      zone.triggerId === 'checkpoint-trigger-a');
    const checkpointZoneB = checkpointTriggers.zones.find(zone =>
      zone.triggerId === 'checkpoint-trigger-b');
    const failureZone = grayboxDiagnostics?.failureZone;
    Object.assign(diagnostics.dataset, {
      x: String(p.x), y: String(p.y), vx: String(p.vx), vy: String(p.vy),
      worldVx: String(p.worldVx), worldVy: String(p.worldVy),
      supportVx: String(p.supportVx), supportVy: String(p.supportVy),
      grounded: String(p.grounded), support: p.support, jumps: String(p.jumps),
      wall: String(p.wall), ceiling: String(p.ceiling), needsRelease: String(p.needsRelease),
      controlAllowed: String(p.controlAllowed), eligible: String(p.eligible),
      buffer: String(p.bufferMs), coyote: String(p.coyoteMs), nx: String(p.normalX), ny: String(p.normalY),
      physicsSteps: String(sample.physicsSteps), physicsTime: String(sample.physicsTimestamp), resets: String(sample.resets),
      oneWayCollision: grayboxDiagnostics === undefined ? '' : String(grayboxDiagnostics.oneWayCollisionEnabled),
      progressRouteOpen: grayboxDiagnostics ? String(grayboxDiagnostics.progressRouteOpen) : '',
      platformClock: grayboxDiagnostics ? String(grayboxDiagnostics.platformClockMs) : '',
      movingHX: horizontal ? String(horizontal.x) : '', movingHY: horizontal ? String(horizontal.y) : '',
      movingHVx: horizontal ? String(horizontal.vx) : '', movingHDirection: horizontal ? String(horizontal.direction) : '',
      movingHPhase: horizontal ? String(horizontal.phase) : '', movingHCycle: horizontal ? String(horizontal.cycle) : '',
      movingVX: vertical ? String(vertical.x) : '', movingVY: vertical ? String(vertical.y) : '',
      movingVVy: vertical ? String(vertical.vy) : '', movingVDirection: vertical ? String(vertical.direction) : '',
      movingVPhase: vertical ? String(vertical.phase) : '', movingVCycle: vertical ? String(vertical.cycle) : '',
      supportRelativeX: grayboxDiagnostics?.supportRelativeX == null ? '' : String(grayboxDiagnostics.supportRelativeX),
      supportRelativeY: grayboxDiagnostics?.supportRelativeY == null ? '' : String(grayboxDiagnostics.supportRelativeY),
      zoneBaselineTick: grayboxDiagnostics ? String(grayboxDiagnostics.diagnosticBaselineTick) : '',
      zoneBaselineCount: grayboxDiagnostics ? String(grayboxDiagnostics.diagnosticBaselineCount) : '',
      zoneAOccupied: zoneA ? String(zoneA.occupied) : '',
      zoneAOccupiedSteps: zoneA ? String(zoneA.occupiedSteps) : '',
      zoneALastOccupiedSteps: zoneA ? String(zoneA.lastOccupiedSteps) : '',
      zoneAEnter: zoneA ? String(zoneA.enterCount) : '',
      zoneAExit: zoneA ? String(zoneA.exitCount) : '',
      zoneALastTick: zoneA?.lastTransitionTick == null ? '' : String(zoneA.lastTransitionTick),
      zoneATransitions: zoneA ? zoneA.recentTransitions.map(record => `${record.kind}:${record.tick}:${record.diagnosticOrdinal}`).join(',') : '',
      zoneBOccupied: zoneB ? String(zoneB.occupied) : '',
      zoneBOccupiedSteps: zoneB ? String(zoneB.occupiedSteps) : '',
      zoneBLastOccupiedSteps: zoneB ? String(zoneB.lastOccupiedSteps) : '',
      zoneBEnter: zoneB ? String(zoneB.enterCount) : '',
      zoneBExit: zoneB ? String(zoneB.exitCount) : '',
      zoneBLastTick: zoneB?.lastTransitionTick == null ? '' : String(zoneB.lastTransitionTick),
      zoneBTransitions: zoneB ? zoneB.recentTransitions.map(record => `${record.kind}:${record.tick}:${record.diagnosticOrdinal}`).join(',') : '',
      interactionMode: interaction.mode,
      interactionSelected: interaction.selectedId ?? '',
      interactionActive: interaction.activeId ?? '',
      interactionPrompt: interaction.prompt ?? '',
      interactionTitle: interaction.title ?? '',
      interactionContent: interaction.content ?? '',
      interactionFeedback: interaction.feedbackText ?? '',
      interactionFeedbackRemaining: String(interaction.feedbackRemainingMs),
      interactionConsumed: String(interaction.consumedCount),
      interactionStarts: String(interaction.investigationStarts),
      interactionFeedbackCount: String(interaction.feedbackCount),
      interactionCandidates: String(interaction.candidateCount),
      interactionFacing: String(interaction.facing),
      interactionNeedsRelease: String(interaction.needsRelease),
      interactionControlBlocked: String(interaction.controlBlocked),
      progressCollectionCount: String(progress.counts.collections),
      progressGoalCount: String(progress.counts.goals),
      progressRewardCount: String(progress.counts.rewards),
      progressEffectCount: String(progress.counts.effects),
      progressCollectionIds: progress.collections.join(','),
      progressGoalIds: progress.goals.join(','),
      progressRewardIds: progress.rewards.join(','),
      progressEffects: progress.effects.map(effect =>
        `${effect.id}:${effect.expectedActive ? 'active' : 'inactive'}`).join(','),
      goalRuntimeInstanceId: goalRoute.runtimeInstanceId,
      goalPhase: goalRoute.phase,
      goalMessage: goalRoute.message,
      goalEventId: goalRoute.eventId == null ? '' : String(goalRoute.eventId),
      goalCommandId: goalRoute.commandId == null ? '' : String(goalRoute.commandId),
      goalTransactionId: goalRoute.transactionId == null
        ? '' : String(goalRoute.transactionId),
      goalResultEventId: goalRoute.resultEventId == null
        ? '' : String(goalRoute.resultEventId),
      goalDeliveryStatus: goalRoute.deliveryStatus ?? '',
      goalTransactionStatus: goalRoute.transactionStatus ?? '',
      goalResultLifecycle: goalRoute.resultLifecycle ?? '',
      goalTerminalStatus: goalRoute.terminal?.status ?? '',
      goalAcceptedTick: goalRoute.acceptedTick == null ? '' : String(goalRoute.acceptedTick),
      goalApplyTick: goalRoute.applyTick == null ? '' : String(goalRoute.applyTick),
      goalVerifyTick: goalRoute.verifyTick == null ? '' : String(goalRoute.verifyTick),
      goalTerminalTick: goalRoute.terminalTick == null ? '' : String(goalRoute.terminalTick),
      goalOriginalCompletedTick: goalRoute.originalCompletedTick == null
        ? '' : String(goalRoute.originalCompletedTick),
      goalResultCreatedTick: goalRoute.resultCreatedTick == null
        ? '' : String(goalRoute.resultCreatedTick),
      goalResultConsumedTick: goalRoute.resultConsumedTick == null
        ? '' : String(goalRoute.resultConsumedTick),
      goalOriginalAcknowledged: String(goalRoute.originalAcknowledged),
      goalOriginalRetired: String(goalRoute.originalRetired),
      goalResultAcknowledged: String(goalRoute.resultAcknowledged),
      goalResultRetired: String(goalRoute.resultRetired),
      goalResultConsumerAttempts: String(goalRoute.resultConsumerAttempts),
      goalResultConsumptionCount: String(goalRoute.resultConsumptionCount),
      goalAcceptedBusinessGoals: String(goalRoute.acceptedBusinessCounts.goals),
      goalAcceptedBusinessRewards: String(goalRoute.acceptedBusinessCounts.rewards),
      goalAcceptedBusinessEffects: String(goalRoute.acceptedBusinessCounts.effects),
      goalTerminalBusinessGoals: String(goalRoute.terminalBusinessCounts.goals),
      goalTerminalBusinessRewards: String(goalRoute.terminalBusinessCounts.rewards),
      goalTerminalBusinessEffects: String(goalRoute.terminalBusinessCounts.effects),
      goalEventRecords: String(goalRoute.counts.events),
      goalInboxEvents: String(goalRoute.counts.inboxEvents),
      goalCommands: String(goalRoute.counts.commands),
      goalAcceptedCommands: String(goalRoute.counts.acceptedCommands),
      goalTransactionIntents: String(goalRoute.counts.transactionIntents),
      goalTransactions: String(goalRoute.counts.transactions),
      goalResultEvents: String(goalRoute.counts.resultEvents),
      goalLastError: goalRoute.lastError ?? '',
      checkpointStatus: checkpointSnapshot.status,
      checkpointError: checkpointSnapshot.error ?? '',
      checkpointCaptureAttempts: String(checkpointSnapshot.captureAttempts),
      checkpointCapturedAtTick: checkpointSnapshot.capturedAtTick == null
        ? '' : String(checkpointSnapshot.capturedAtTick),
      checkpointSchemaVersion: checkpointRecord ? String(checkpointRecord.schemaVersion) : '',
      checkpointRuntimeInstanceId: checkpointRecord?.runtimeInstanceId ?? '',
      checkpointId: checkpointRecord?.checkpointId ?? '',
      checkpointLevelId: checkpointRecord?.levelId ?? '',
      checkpointAnchor: checkpointRecord
        ? `${checkpointRecord.anchor.x},${checkpointRecord.anchor.y},${checkpointRecord.anchor.facing}`
        : '',
      checkpointObjectIds: checkpointRecord?.objects.map(object => object.objectId).join(',') ?? '',
      checkpointStateVersions: checkpointRecord?.objects
        .map(object => `${object.objectId}:${object.stateVersion}`).join(',') ?? '',
      checkpointObjectCount: checkpointRecord ? String(checkpointRecord.objects.length) : '0',
      checkpointPayload: checkpointRecord ? JSON.stringify(checkpointRecord) : '',
      checkpointTriggersEnabled: String(checkpointTriggers.enabled),
      checkpointTriggerPhase: checkpointTriggers.phase,
      checkpointTriggerFeedbackKind: checkpointTriggers.feedbackKind,
      checkpointTriggerFeedback: checkpointTriggers.feedback,
      checkpointBatchCount: String(checkpointTriggers.batchCount),
      checkpointBatchTick: checkpointTriggers.batchTick == null
        ? '' : String(checkpointTriggers.batchTick),
      checkpointClosedTick: checkpointTriggers.closedTick == null
        ? '' : String(checkpointTriggers.closedTick),
      checkpointArbitrationTick: checkpointTriggers.arbitrationTick == null
        ? '' : String(checkpointTriggers.arbitrationTick),
      checkpointEntryEventCount: String(checkpointTriggers.entryEventCount),
      checkpointSelectedCount: String(checkpointTriggers.selectedCount),
      checkpointCaptureRequestCount: String(checkpointTriggers.captureRequestCount),
      checkpointBlockedCount: String(checkpointTriggers.blockedCount),
      checkpointFailureCount: String(checkpointTriggers.failureCount),
      checkpointCurrentId: checkpointTriggers.currentCheckpointId ?? '',
      checkpointCandidateId: checkpointTriggers.candidateCheckpointId ?? '',
      checkpointLatestOpportunityId: checkpointTriggers.latestOpportunityId ?? '',
      checkpointLatestEntryEventId: checkpointTriggers.latestEntryEventId == null
        ? '' : String(checkpointTriggers.latestEntryEventId),
      checkpointLatestCaptureEventId: checkpointTriggers.latestCaptureEventId == null
        ? '' : String(checkpointTriggers.latestCaptureEventId),
      checkpointLatestCaptureRequestId: checkpointTriggers.latestCaptureRequestId ?? '',
      checkpointArbitrationWinner: checkpointTriggers.lastArbitration?.winnerCheckpointId ?? '',
      checkpointArbitrationBatchTick: checkpointTriggers.lastArbitration?.batchTick == null
        ? '' : String(checkpointTriggers.lastArbitration.batchTick),
      checkpointArbitrationClosedTick: checkpointTriggers.lastArbitration?.closedTick == null
        ? '' : String(checkpointTriggers.lastArbitration.closedTick),
      checkpointArbitrationTickValue:
        checkpointTriggers.lastArbitration?.arbitrationTick == null
          ? '' : String(checkpointTriggers.lastArbitration.arbitrationTick),
      checkpointArbitrationWinnerEntryEventId:
        checkpointTriggers.lastArbitration?.winnerEntryEventId == null
          ? '' : String(checkpointTriggers.lastArbitration.winnerEntryEventId),
      checkpointArbitrationWinnerOpportunityId:
        checkpointTriggers.lastArbitration?.winnerOpportunityId ?? '',
      checkpointArbitrationCaptureEventId:
        checkpointTriggers.lastArbitration?.captureEventId == null
          ? '' : String(checkpointTriggers.lastArbitration.captureEventId),
      checkpointArbitrationCaptureRequestStatus:
        checkpointTriggers.lastArbitration?.captureRequestStatus ?? '',
      checkpointArbitrationEntrants: checkpointTriggers.lastArbitration
        ?.entrants.map(entry =>
          `${entry.triggerId}:${entry.checkpointId}:${entry.priority}:` +
          `${entry.entryEventId}:${entry.decision}:${entry.retired ? 'retired' : 'retained'}`)
        .join(',') ?? '',
      checkpointZoneAOccupied: checkpointZoneA ? String(checkpointZoneA.occupied) : '',
      checkpointZoneAEnter: checkpointZoneA ? String(checkpointZoneA.enterCount) : '',
      checkpointZoneAExit: checkpointZoneA ? String(checkpointZoneA.exitCount) : '',
      checkpointZoneALastTick: checkpointZoneA?.lastTransitionTick == null
        ? '' : String(checkpointZoneA.lastTransitionTick),
      checkpointZoneAOpportunity: checkpointZoneA?.opportunityId ?? '',
      checkpointZoneAEntryEventId: checkpointZoneA?.entryEventId == null
        ? '' : String(checkpointZoneA.entryEventId),
      checkpointZoneADecision: checkpointZoneA?.lastDecision ?? '',
      checkpointZoneBOccupied: checkpointZoneB ? String(checkpointZoneB.occupied) : '',
      checkpointZoneBEnter: checkpointZoneB ? String(checkpointZoneB.enterCount) : '',
      checkpointZoneBExit: checkpointZoneB ? String(checkpointZoneB.exitCount) : '',
      checkpointZoneBLastTick: checkpointZoneB?.lastTransitionTick == null
        ? '' : String(checkpointZoneB.lastTransitionTick),
      checkpointZoneBOpportunity: checkpointZoneB?.opportunityId ?? '',
      checkpointZoneBEntryEventId: checkpointZoneB?.entryEventId == null
        ? '' : String(checkpointZoneB.entryEventId),
      checkpointZoneBDecision: checkpointZoneB?.lastDecision ?? '',
      checkpointCapturePhase: checkpointCapture.phase,
      checkpointCaptureSourceEntryEventId: checkpointCapture.sourceEntryEventId == null
        ? '' : String(checkpointCapture.sourceEntryEventId),
      checkpointCaptureEventId: checkpointCapture.eventId == null
        ? '' : String(checkpointCapture.eventId),
      checkpointCaptureCommandId: checkpointCapture.commandId == null
        ? '' : String(checkpointCapture.commandId),
      checkpointCaptureTransactionId: checkpointCapture.transactionId == null
        ? '' : String(checkpointCapture.transactionId),
      checkpointCaptureResultEventId: checkpointCapture.resultEventId == null
        ? '' : String(checkpointCapture.resultEventId),
      checkpointCaptureRequestId: checkpointCapture.authorizationRequestId ?? '',
      checkpointCaptureSaves: String(checkpointCapture.successfulCommits),
      checkpointCaptureLockHeld: String(checkpointCapture.lock.held),
      checkpointCaptureResourcesReleased:
        String(checkpointCapture.resourceOwnership.resourcesReleased),
      failureZoneOccupied: failureZone ? String(failureZone.occupied) : '',
      failureZoneEnter: failureZone ? String(failureZone.enterCount) : '',
      failureZoneExit: failureZone ? String(failureZone.exitCount) : '',
      failureZoneLastTick: failureZone?.lastTransitionTick == null
        ? '' : String(failureZone.lastTransitionTick),
      recoveryRuntimeInstanceId: recovery.runtimeInstanceId,
      recoveryPhase: recovery.phase,
      recoveryMessage: recovery.message,
      recoveryDetectionCount: String(recovery.detectionCount),
      recoveryCount: String(recovery.recoveryCount),
      recoveryIgnoredSignalCount: String(recovery.ignoredSignalCount),
      recoveryControlLockHeld: String(recovery.controlLockHeld),
      recoveryTriggersShielded: String(recovery.triggersShielded),
      recoveryFadeElapsed: String(recovery.fadeElapsedMs),
      recoveryFadeAlpha: String(recovery.fadeAlpha),
      recoveryCaptureWaitTicks: String(recovery.captureWaitTicks),
      recoveryFailureId: recovery.currentFailureId ?? '',
      recoveryFailureEventId: recovery.failureEventId == null
        ? '' : String(recovery.failureEventId),
      recoveryFailureAcknowledged: String(recovery.failureEventAcknowledged),
      recoveryFailureRetired: String(recovery.failureEventRetired),
      recoveryDetectedTick: recovery.detectedTick == null
        ? '' : String(recovery.detectedTick),
      recoveryAdmittedTick: recovery.admittedTick == null
        ? '' : String(recovery.admittedTick),
      recoverySourceSelectedTick: recovery.sourceSelectedTick == null
        ? '' : String(recovery.sourceSelectedTick),
      recoveryRestoredTick: recovery.restoredTick == null
        ? '' : String(recovery.restoredTick),
      recoveryValidatedTick: recovery.validatedTick == null
        ? '' : String(recovery.validatedTick),
      recoveryPlacedTick: recovery.placedTick == null
        ? '' : String(recovery.placedTick),
      recoveryFadeInCompletedTick: recovery.fadeInCompletedTick == null
        ? '' : String(recovery.fadeInCompletedTick),
      recoveryReleasedTick: recovery.releasedTick == null
        ? '' : String(recovery.releasedTick),
      recoverySourceCheckpointId: recovery.sourceCheckpointId ?? '',
      recoverySourceAnchor: recovery.sourceAnchor
        ? `${recovery.sourceAnchor.x},${recovery.sourceAnchor.y},${recovery.sourceAnchor.facing}`
        : '',
      recoverySourcePayload: recovery.sourceSnapshot
        ? JSON.stringify(recovery.sourceSnapshot) : '',
      recoveryAnchorValidation: recovery.anchorValidation
        ? recovery.anchorValidation.status === 'valid'
          ? `valid:${recovery.anchorValidation.support}`
          : `invalid:${recovery.anchorValidation.reason}`
        : '',
      recoveryLastError: recovery.lastError ?? '',
      recoveryPhaseHistory: recovery.phaseHistory
        .map(record => `${record.phase}@${record.tick}`).join(','),
    });
  }
  diagnostics.textContent = common.join('\n');
  // Read-only diagnostic data, also updated synchronously when rendering is suspended.
  Object.assign(diagnostics.dataset, {
    tick: String(sample.tick), marker: String('player' in sample ? sample.player.x : sample.markerX), mode,
    paused: String(sample.paused), tokens: String(sample.pauseCount),
    steps: String(sample.stepsLastFrame), discarded: String(sample.discardedMs),
  });
};
const wire = (next: GameCore | GrayboxCore) => {
  core = next;
  const visibility = bindVisibilityPause(next.lifecycle, showDiagnostics);
  const input = 'key' in next ? bindPlayerInput(next, showDiagnostics) : () => {};
  unbind = () => { input(); visibility(); };
  showDiagnostics();
};
// Display metadata only; this does not grant native capabilities to the renderer.
const platform = new URLSearchParams(window.location.search).get('platform') === 'windows'
  ? 'Windows (Electron)' : 'Web';

const launch = async () => {
  try {
    let game;
    if (mode === 'diagnostic') {
      const diagnostic = createGameCore();
      wire(diagnostic);
      game = await mountStartupScene(parent, diagnostic, platform, () => performance.now(), showDiagnostics);
    } else game = await mountGrayboxScene(
      parent,
      platform,
      () => performance.now(),
      { generate: () => crypto.randomUUID() },
      wire,
      showDiagnostics,
    );
    destroy = game.destroy;
  } catch (cause) {
    console.error('Could not start the game.', cause);
    error.textContent = '游戏启动失败，请重试。';
    error.hidden = false;
  } finally {
    restart.disabled = false;
    reset.disabled = false;
  }
};

const reload = async () => {
  restart.disabled = true;
  reset.disabled = true;
  sceneSelect.disabled = true;
  unbind();
  await destroy?.();
  // Phaser 3 keeps a document-level visibility listener after Game.destroy().
  window.location.reload();
};
restart.addEventListener('click', reload);
sceneSelect.addEventListener('change', () => {
  sessionStorage.setItem('scene', sceneSelect.value);
  void reload();
});
reset.addEventListener('click', () => { if (core && 'reset' in core) { core.reset(); showDiagnostics(); } });
void launch();
