import { createGameCore, type GameCore } from '../../core/game';
import type { GrayboxCore } from '../../core/graybox';
import { mountStartupScene } from '../../rendering/phaser/startup';
import { mountGrayboxScene } from '../../rendering/phaser/graybox';
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
const mode = sessionStorage.getItem('scene') === 'diagnostic' ? 'diagnostic' : 'graybox';
sceneSelect.value = mode;
reset.hidden = mode !== 'graybox';
const showDiagnostics = () => {
  if (!core) return;
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
    common.push(`Matter steps ${sample.physicsSteps} | Input ${p.controlAllowed ? 'ON' : 'LOCKED'} | ${p.needsRelease ? '请先松开 Space' : 'Space READY'}${p.y > 700 ? ' | 已掉出场景，请按 R 重置' : ''}`);
    Object.assign(diagnostics.dataset, {
      x: String(p.x), y: String(p.y), vx: String(p.vx), vy: String(p.vy),
      grounded: String(p.grounded), support: p.support, jumps: String(p.jumps),
      wall: String(p.wall), ceiling: String(p.ceiling), needsRelease: String(p.needsRelease),
      controlAllowed: String(p.controlAllowed), eligible: String(p.eligible),
      buffer: String(p.bufferMs), coyote: String(p.coyoteMs), nx: String(p.normalX), ny: String(p.normalY),
      physicsSteps: String(sample.physicsSteps), physicsTime: String(sample.physicsTimestamp), resets: String(sample.resets),
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
  const input = 'key' in next ? bindPlayerInput(next) : () => {};
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
