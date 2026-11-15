import type { GrayboxCore } from '../../core/graybox.ts';
import {
  InputSourceAggregator,
  codeForAction,
  type GameAction,
} from './input-sources.ts';

export interface PlayerInputBinding {
  readonly aggregator: InputSourceAggregator;
  readonly available: boolean;
  pointerDown(action: GameAction, pointerId: number): boolean;
  pointerUp(action: GameAction, pointerId: number, generation: number): boolean;
  pointerCancel(
    action: GameAction,
    pointerId: number,
    generation: number,
    emitEdge?: boolean,
  ): boolean;
  cancelPointers(emitEdges?: boolean): void;
  cancelAll(emitEdges?: boolean): void;
  onAvailabilityChange(listener: (available: boolean) => void): () => void;
  dispose(): void;
}

export function bindPlayerInput(
  core: GrayboxCore,
  changed: () => void = () => {},
): PlayerInputBinding {
  const aggregator = new InputSourceAggregator(
    (code, down, repeat = false) => core.key(code, down, repeat),
    changed,
  );
  const availabilityListeners = new Set<(available: boolean) => void>();
  let available = true;
  let disposed = false;

  const setAvailability = () => {
    if (disposed) return;
    const next = document.visibilityState === 'visible' && document.hasFocus();
    if (next === available) return;
    available = next;
    if (!available) {
      // Input loss must not fabricate keyup: the original Space/E release
      // gates remain until the device reports a real release or new press.
      aggregator.cancelAll(false);
      core.setAvailable(false);
    } else {
      core.setAvailable(true);
    }
    for (const listener of availabilityListeners) listener(available);
    changed();
  };
  const clearStaleInputAfterVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    aggregator.cancelAll(false);
  };

  const keydown = (event: KeyboardEvent) => {
    const codes = [
      'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE',
      'Escape', 'KeyR',
    ];
    if (!codes.includes(event.code)) return;
    if ((event.target as HTMLElement | null)?.tagName === 'SELECT') return;
    event.preventDefault();
    if (event.code === 'KeyR') {
      if (!event.repeat && !core.snapshot.paused) core.reset();
    } else if (event.code === 'Escape') {
      core.key(event.code, true, event.repeat);
    } else if (!core.snapshot.paused) {
      // A press made while paused must not become a buffered gameplay input
      // that fires after resume. Release events still flow to clear PC-02 gates.
      aggregator.keyboardDown(event.code, event.repeat);
    }
  };
  const keyup = (event: KeyboardEvent) => {
    if (event.code === 'Escape') core.key(event.code, false);
    else aggregator.keyboardUp(event.code);
  };

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', setAvailability);
  window.addEventListener('focus', setAvailability);
  document.addEventListener('visibilitychange', setAvailability);
  document.addEventListener('visibilitychange', clearStaleInputAfterVisibility);
  setAvailability();

  return Object.freeze({
    aggregator,
    get available() {
      return available;
    },
    pointerDown(action: GameAction, pointerId: number): boolean {
      if (disposed || !available || core.snapshot.paused) return false;
      const sources = aggregator.snapshot()[action];
      const staleReleaseGate =
        action === 'jump'
          ? core.snapshot.player.needsRelease
          : action === 'interact'
            ? core.snapshot.interaction.needsRelease
            : false;
      if (staleReleaseGate && sources.length === 0) {
        // A new genuine touch proves the interrupted source has ended. Emit
        // the old release before its press; blur/hidden alone never does this.
        core.key(codeForAction(action), false, false);
      }
      return aggregator.pointerActionDown(action, pointerId);
    },
    pointerUp(
      action: GameAction,
      pointerId: number,
      generation: number,
    ): boolean {
      return !disposed && aggregator.pointerActionUp(
        action,
        pointerId,
        generation,
      );
    },
    pointerCancel(
      action: GameAction,
      pointerId: number,
      generation: number,
      emitEdge = true,
    ): boolean {
      return !disposed && aggregator.pointerActionUp(
        action,
        pointerId,
        generation,
        emitEdge,
      );
    },
    cancelPointers(emitEdges = true): void {
      if (!disposed) aggregator.clearPointers(emitEdges);
    },
    cancelAll(emitEdges = false): void {
      if (!disposed) aggregator.cancelAll(emitEdges);
    },
    onAvailabilityChange(
      listener: (available: boolean) => void,
    ): () => void {
      availabilityListeners.add(listener);
      return () => availabilityListeners.delete(listener);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', setAvailability);
      window.removeEventListener('focus', setAvailability);
      document.removeEventListener('visibilitychange', setAvailability);
      document.removeEventListener('visibilitychange', clearStaleInputAfterVisibility);
      aggregator.destroy(false);
      core.setAvailable(false);
      availabilityListeners.clear();
    },
  });
}
