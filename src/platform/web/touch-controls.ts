import type { GrayboxCore } from '../../core/graybox.ts';
import type { PauseRequestKey, PauseToken } from '../../core/lifecycle.ts';
import type { GameAction } from './input-sources.ts';
import type { PlayerInputBinding } from './player-input.ts';

export type TouchControlsSnapshot = Readonly<{
  enabled: boolean;
  menuOpen: boolean;
  interactionActive: boolean;
  interactionCanClose: boolean;
  notice: string;
}>;

export type TouchControlsBinding = Readonly<{
  enabled: boolean;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}>;

type TouchControlOptions = Readonly<{
  root: HTMLElement;
  controls: HTMLElement;
  notice: HTMLElement;
  toggle: HTMLButtonElement;
  pause: HTMLButtonElement;
  menu: HTMLElement;
  continueButton: HTMLButtonElement;
  closeDialogue: HTMLButtonElement;
  input: PlayerInputBinding;
  core: GrayboxCore;
  changed: () => void;
}>;

const POINTER_ACTION_BY_BUTTON: Readonly<Record<string, GameAction | undefined>> =
  Object.freeze({
    left: 'left',
    right: 'right',
    jump: 'jump',
    interact: 'interact',
  });

export function bindTouchControls(options: TouchControlOptions): TouchControlsBinding {
  const {
    root,
    controls,
    notice,
    toggle,
    pause,
    menu,
    continueButton,
    closeDialogue,
    input,
    core,
    changed,
  } = options;
  const activePointers = new Map<number, {
    action: GameAction;
    generation: number;
    target: HTMLElement;
  }>();
  const menuOwner = Symbol('prototype-menu-owner');
  let menuKey: PauseRequestKey = Symbol('prototype-menu-request');
  let menuToken: PauseToken | undefined;
  let pauseClickCount = 0;
  let lastPauseResult = '';
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches === true;
  let enabled = root.dataset.touchEnabled === 'true' || coarsePointer;
  let disposed = false;

  const refresh = () => {
    if (disposed) return;
    const interaction = core.snapshot.interaction;
    const canClose = interaction.mode === 'investigation';
    root.dataset.touchEnabled = String(enabled);
    root.dataset.pointerMode = coarsePointer ? 'coarse' : 'fine';
    root.dataset.menuOpen = String(menuToken !== undefined);
    root.dataset.interactionActive = String(canClose);
    controls.hidden = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.textContent = enabled ? '触控操作：开' : '触控操作：关';
    menu.hidden = menuToken === undefined;
    pause.setAttribute('aria-expanded', String(menuToken !== undefined));
    closeDialogue.hidden = !canClose;
    closeDialogue.disabled = !canClose;
    const portrait = window.matchMedia?.('(orientation: portrait)')?.matches ?? false;
    notice.hidden = !(enabled && portrait);
    notice.textContent = '建议横屏游玩；当前竖屏仍可操作。';
    root.dataset.touchSources = JSON.stringify(input.aggregator.snapshot());
    root.dataset.pauseClickCount = String(pauseClickCount);
    root.dataset.lastPauseResult = lastPauseResult;
    changed();
  };

  const releasePointer = (
    pointerId: number,
    emitEdge: boolean,
  ) => {
    const record = activePointers.get(pointerId);
    if (!record) return;
    activePointers.delete(pointerId);
    record.target.dataset.active = 'false';
    try {
      record.target.releasePointerCapture(pointerId);
    } catch { /* synthetic events may not own capture */ }
    input.pointerCancel(
      record.action,
      pointerId,
      record.generation,
      emitEdge,
    );
  };

  const releaseAllPointers = (emitEdges: boolean) => {
    for (const pointerId of [...activePointers.keys()]) {
      releasePointer(pointerId, emitEdges);
    }
  };

  const pointerDown = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    const action = POINTER_ACTION_BY_BUTTON[target.dataset.action ?? ''];
    if (!enabled || !action || event.isPrimary === false && activePointers.has(event.pointerId)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const generation = input.aggregator.generation;
    if (!input.pointerDown(action, event.pointerId)) return;
    activePointers.set(event.pointerId, {
      action,
      generation,
      target,
    });
    try { target.setPointerCapture(event.pointerId); } catch { /* synthetic events may not capture */ }
    target.dataset.active = 'true';
    refresh();
  };

  const pointerEnd = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (!activePointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    releasePointer(event.pointerId, true);
    refresh();
  };

  const pointerCancel = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (!activePointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    // pointercancel is the browser's authoritative termination of this touch.
    // Emit the matching release edge so a later genuine touch starts cleanly.
    releasePointer(event.pointerId, true);
    refresh();
  };
  const pointerInterrupted = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (!activePointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    // The control no longer owns this action after leaving or losing capture.
    // End the action edge so a later genuine touch is usable immediately.
    releasePointer(event.pointerId, true);
    refresh();
  };

  const actionButtons = Array.from(
    controls.querySelectorAll<HTMLElement>('[data-action]'),
  );
  const boundButtons = new Map<HTMLElement, {
    down: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
    cancel: (event: PointerEvent) => void;
    leave: (event: PointerEvent) => void;
    lost: (event: PointerEvent) => void;
  }>();
  for (const button of actionButtons) {
    const handlers = {
      down: pointerDown,
      up: pointerEnd,
      cancel: pointerCancel,
      leave: pointerInterrupted,
      lost: pointerInterrupted,
    };
    button.addEventListener('pointerdown', handlers.down);
    button.addEventListener('pointerup', handlers.up);
    button.addEventListener('pointercancel', handlers.cancel);
    button.addEventListener('pointerleave', handlers.leave);
    button.addEventListener('lostpointercapture', handlers.lost);
    boundButtons.set(button, handlers);
  }

  const openMenu = () => {
    if (disposed || menuToken !== undefined) return;
    // The explicit pause button ends this adapter's current input interval.
    // Emit releases for sources that were already active so no pending press
    // survives the pause; blur/hidden still use cancelAll(false) upstream.
    input.cancelAll(true);
    activePointers.clear();
    const token = core.lifecycle.acquire(menuOwner, menuKey);
    lastPauseResult = token === undefined ? 'rejected' : 'acquired';
    if (token === undefined) {
      notice.hidden = false;
      notice.textContent = '暂停请求被拒绝。';
      return;
    }
    menuToken = token;
    refresh();
  };
  const closeMenu = () => {
    if (menuToken === undefined) return;
    lastPauseResult = core.lifecycle.release(menuOwner, menuToken);
    menuToken = undefined;
    // A retired request key is intentionally not reusable. A later open is a
    // new request interval with a new key, while repeated clicks within one
    // open interval reuse the same token above.
    menuKey = Symbol('prototype-menu-request');
    refresh();
  };
  const pauseClick = () => {
    pauseClickCount++;
    if (menuToken === undefined) openMenu();
    else closeMenu();
  };
  const continueClick = closeMenu;
  const closeClick = () => {
    if (menuToken === undefined && core.closeInteraction()) refresh();
  };
  const toggleClick = () => {
    enabled = !enabled;
    if (!enabled) releaseAllPointers(true);
    refresh();
  };
  pause.addEventListener('click', pauseClick);
  continueButton.addEventListener('click', continueClick);
  closeDialogue.addEventListener('click', closeClick);
  toggle.addEventListener('click', toggleClick);

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      releaseAllPointers(false);
      refresh();
    }
  };
  const onBlur = () => {
    releaseAllPointers(false);
    refresh();
  };
  const onOrientation = () => {
    releaseAllPointers(true);
    refresh();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('orientationchange', onOrientation);
  window.addEventListener('resize', onOrientation);
  const unsubscribeAvailability = input.onAvailabilityChange(() => refresh());

  refresh();
  return Object.freeze({
    get enabled() {
      return enabled;
    },
    setEnabled(value: boolean) {
      if (disposed) return;
      enabled = value;
      if (!enabled) releaseAllPointers(true);
      refresh();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      releaseAllPointers(true);
      if (menuToken !== undefined) {
        core.lifecycle.release(menuOwner, menuToken);
        menuToken = undefined;
        menuKey = Symbol('prototype-menu-request');
      }
      pause.removeEventListener('click', pauseClick);
      continueButton.removeEventListener('click', continueClick);
      closeDialogue.removeEventListener('click', closeClick);
      toggle.removeEventListener('click', toggleClick);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('orientationchange', onOrientation);
      window.removeEventListener('resize', onOrientation);
      unsubscribeAvailability();
      for (const [button, handlers] of boundButtons) {
        button.removeEventListener('pointerdown', handlers.down);
        button.removeEventListener('pointerup', handlers.up);
        button.removeEventListener('pointercancel', handlers.cancel);
        button.removeEventListener('pointerleave', handlers.leave);
        button.removeEventListener('lostpointercapture', handlers.lost);
      }
      boundButtons.clear();
    },
  });
}
