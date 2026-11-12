import type { GrayboxCore } from '../../core/graybox.ts';

export function bindPlayerInput(core: GrayboxCore) {
  const availability = () => core.setAvailable(document.visibilityState === 'visible' && document.hasFocus());
  const keydown = (event: KeyboardEvent) => {
    if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR'].includes(event.code)) {
      if ((event.target as HTMLElement)?.tagName === 'SELECT') return;
      event.preventDefault();
      if (event.code === 'KeyR' && !event.repeat) core.reset();
      else core.key(event.code, true, event.repeat);
    }
  };
  const keyup = (event: KeyboardEvent) => core.key(event.code, false);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', availability);
  window.addEventListener('focus', availability);
  document.addEventListener('visibilitychange', availability);
  availability();
  return () => {
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', availability);
    window.removeEventListener('focus', availability);
    document.removeEventListener('visibilitychange', availability);
    core.setAvailable(false);
  };
}
