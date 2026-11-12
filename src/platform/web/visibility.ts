import type { RuntimeLifecycleController, PauseToken, PauseRequestKey } from '../../core/lifecycle.ts';

export function bindVisibilityPause(controller: RuntimeLifecycleController, changed: () => void) {
  const owner = Symbol('page-visibility-owner');
  let request: { key: PauseRequestKey; token: PauseToken } | undefined;
  const notify = () => {
    if (document.visibilityState === 'hidden') {
      // The owner creates the key before acquire, then reuses it for this hidden interval.
      const key = request?.key ?? Symbol('visibility-request');
      const token = controller.acquire(owner, key);
      if (token !== undefined) request = { key, token };
    } else if (request) {
      controller.release(owner, request.token);
      request = undefined;
    }
    changed();
  };
  document.addEventListener('visibilitychange', notify);
  notify(); // Covers startup in an already hidden tab/window.
  return () => {
    document.removeEventListener('visibilitychange', notify);
    if (request) controller.release(owner, request.token);
    request = undefined;
  };
}
