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
    const horizontal = grayboxDiagnostics?.movingPlatforms.find(platform => platform.axis === 'horizontal');
    const vertical = grayboxDiagnostics?.movingPlatforms.find(platform => platform.axis === 'vertical');
    const zoneA = grayboxDiagnostics?.diagnosticZones.find(zone => zone.label === 'diagnostic-zone-a');
    const zoneB = grayboxDiagnostics?.diagnosticZones.find(zone => zone.label === 'diagnostic-zone-b');
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
    } else game = await mountGrayboxScene(parent, platform, () => performance.now(), wire, showDiagnostics);
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
