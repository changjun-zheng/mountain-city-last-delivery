import { createGameCore } from '../../core/game';
import { mountStartupScene } from '../../rendering/phaser/startup';
import { bindVisibilityPause } from './visibility';
import './style.css';

const parent = document.querySelector<HTMLElement>('#game');
const restart = document.querySelector<HTMLButtonElement>('#restart');
const error = document.querySelector<HTMLElement>('#error');
const diagnostics = document.querySelector<HTMLElement>('#diagnostics');

if (!parent || !restart || !error || !diagnostics) {
  throw new Error('Missing Web host elements.');
}

let destroy: (() => Promise<void>) | undefined;
const core = createGameCore();
const showDiagnostics = () => {
  const sample = core.snapshot;
  diagnostics.textContent = [
    `${sample.paused ? 'PAUSED' : 'RUNNING'} | Tick ${sample.tick} | Marker ${sample.markerX.toFixed(2)}`,
    `${core.config.fixedDeltaMs} ms / step · max ${core.config.maxStepsPerFrame} steps / frame (prototype) | Tokens ${sample.pauseCount}`,
    `Steps ${sample.stepsLastFrame} | Remainder ${sample.remainderMs.toFixed(2)} ms | Discarded ${sample.discardedMs.toFixed(2)} ms`,
  ].join('\n');
  // Read-only diagnostic data, also updated synchronously when rendering is suspended.
  Object.assign(diagnostics.dataset, {
    tick: String(sample.tick), marker: String(sample.markerX),
    paused: String(sample.paused), tokens: String(sample.pauseCount),
    steps: String(sample.stepsLastFrame), discarded: String(sample.discardedMs),
  });
};
const unbindVisibility = bindVisibilityPause(core.lifecycle, showDiagnostics);
// Display metadata only; this does not grant native capabilities to the renderer.
const platform = new URLSearchParams(window.location.search).get('platform') === 'windows'
  ? 'Windows (Electron)' : 'Web';

const launch = async () => {
  try {
    const game = await mountStartupScene(parent, core, platform, () => performance.now(), showDiagnostics);
    destroy = game.destroy;
  } catch (cause) {
    console.error('Could not start the game.', cause);
    error.textContent = '游戏启动失败，请重试。';
    error.hidden = false;
  } finally {
    restart.disabled = false;
  }
};

restart.addEventListener('click', async () => {
  restart.disabled = true;
  unbindVisibility();
  await destroy?.();
  // Phaser 3 keeps a document-level visibility listener after Game.destroy().
  window.location.reload();
});
void launch();
