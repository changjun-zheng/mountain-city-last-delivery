import type { PlayerControlCoordinator, PlayerState } from './player.ts';
import { PROTOTYPE_PROGRESS_CONTENT } from './progress.ts';

export type InteractionKind = 'investigation' | 'pickup' | 'collection' | 'goal';

export type InteractionProgressReference = Readonly<{
  category: 'collection' | 'goal';
  id: string;
}>;

export type InteractionObject = Readonly<{
  id: string;
  kind: InteractionKind;
  progress?: InteractionProgressReference;
  label: string;
  title: string;
  content: string;
  x: number;
  y: number;
  rangeX: number;
  rangeY: number;
}>;

export type InteractionMode = 'idle' | 'investigation' | 'feedback';
export type InteractionActivationHandler = (object: InteractionObject) => string | undefined;

// Temporary graybox values. These do not confirm final keys, ranges, selection
// weights or feedback duration.
export const INTERACTION_PROTOTYPE = Object.freeze({
  interactKey: 'KeyE',
  closeKey: 'Escape',
  pickupFeedbackMs: 1200,
  facingVelocityThreshold: 5,
});

export const INTERACTION_OBJECTS: readonly InteractionObject[] = Object.freeze([
  Object.freeze({
    id: 'prototype-investigation-a',
    kind: 'investigation' as const,
    label: 'A',
    title: '灰盒调查对象 A',
    content: '这是用于验证主动交互、目标选择与控制协调的临时调查内容。',
    x: 200,
    y: 450,
    rangeX: 80,
    rangeY: 110,
  }),
  Object.freeze({
    id: 'prototype-investigation-b',
    kind: 'investigation' as const,
    label: 'B',
    title: '灰盒调查对象 B',
    content: 'A、B 范围局部重叠；同一时间只选择一个主要目标。',
    x: 260,
    y: 450,
    rangeX: 80,
    rangeY: 110,
  }),
  Object.freeze({
    id: 'prototype-pickup-c',
    kind: 'pickup' as const,
    label: 'C',
    title: '灰盒拾取反馈对象',
    content: '仅显示短暂反馈，不发放奖励，也不写入永久进度。',
    x: 335,
    y: 450,
    rangeX: 70,
    rangeY: 110,
  }),
  Object.freeze({
    id: PROTOTYPE_PROGRESS_CONTENT.collection.interactionId,
    kind: 'collection' as const,
    progress: Object.freeze({
      category: 'collection' as const,
      id: PROTOTYPE_PROGRESS_CONTENT.collection.businessId,
    }),
    label: PROTOTYPE_PROGRESS_CONTENT.collection.label,
    title: PROTOTYPE_PROGRESS_CONTENT.collection.title,
    content: PROTOTYPE_PROGRESS_CONTENT.collection.content,
    x: PROTOTYPE_PROGRESS_CONTENT.collection.x,
    y: PROTOTYPE_PROGRESS_CONTENT.collection.y,
    rangeX: PROTOTYPE_PROGRESS_CONTENT.collection.rangeX,
    rangeY: PROTOTYPE_PROGRESS_CONTENT.collection.rangeY,
  }),
  Object.freeze({
    id: PROTOTYPE_PROGRESS_CONTENT.goal.interactionId,
    kind: 'goal' as const,
    progress: Object.freeze({
      category: 'goal' as const,
      id: PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
    }),
    label: PROTOTYPE_PROGRESS_CONTENT.goal.label,
    title: PROTOTYPE_PROGRESS_CONTENT.goal.title,
    content: PROTOTYPE_PROGRESS_CONTENT.goal.content,
    x: PROTOTYPE_PROGRESS_CONTENT.goal.x,
    y: PROTOTYPE_PROGRESS_CONTENT.goal.y,
    rangeX: PROTOTYPE_PROGRESS_CONTENT.goal.rangeX,
    rangeY: PROTOTYPE_PROGRESS_CONTENT.goal.rangeY,
  }),
]);

export function selectInteractionTarget(
  objects: readonly InteractionObject[],
  player: Pick<PlayerState, 'x' | 'y'>,
  facing: -1 | 1,
): InteractionObject | undefined {
  return objects
    .filter(object =>
      Math.abs(object.x - player.x) <= object.rangeX &&
      Math.abs(object.y - player.y) <= object.rangeY)
    .map(object => {
      const dx = object.x - player.x;
      const dy = object.y - player.y;
      const facingRank = dx !== 0 && Math.sign(dx) === facing ? 0 : 1;
      return { object, facingRank, distanceSquared: dx * dx + dy * dy };
    })
    .sort((a, b) =>
      a.facingRank - b.facingRank ||
      a.distanceSquared - b.distanceSquared ||
      a.object.id.localeCompare(b.object.id))
    .at(0)?.object;
}

export type InteractionSnapshot = Readonly<{
  mode: InteractionMode;
  selectedId: string | null;
  activeId: string | null;
  prompt: string | null;
  title: string | null;
  content: string | null;
  feedbackText: string | null;
  feedbackRemainingMs: number;
  candidateCount: number;
  consumedCount: number;
  investigationStarts: number;
  feedbackCount: number;
  facing: -1 | 1;
  needsRelease: boolean;
  controlBlocked: boolean;
}>;

export class InteractionController {
  readonly #controls: PlayerControlCoordinator;
  readonly #objects: readonly InteractionObject[];
  readonly #isPaused: () => boolean;
  readonly #activateProgress: InteractionActivationHandler | undefined;
  readonly #owner = Symbol('interaction-control');
  #available = true;
  #facing: -1 | 1 = 1;
  #selectedId: string | null = null;
  #candidateCount = 0;
  #investigationId: string | null = null;
  #feedbackId: string | null = null;
  #feedbackText: string | null = null;
  #feedbackRemainingMs = 0;
  #held = new Set<string>();
  #needsInteractRelease = false;
  #consumedCount = 0;
  #investigationStarts = 0;
  #feedbackCount = 0;

  constructor(
    controls: PlayerControlCoordinator,
    isPaused: () => boolean,
    objects: readonly InteractionObject[] = INTERACTION_OBJECTS,
    activateProgress?: InteractionActivationHandler,
  ) {
    this.#controls = controls;
    this.#isPaused = isPaused;
    this.#objects = objects;
    this.#activateProgress = activateProgress;
  }

  key(code: string, down: boolean, repeat = false): boolean {
    if (code !== INTERACTION_PROTOTYPE.interactKey && code !== INTERACTION_PROTOTYPE.closeKey) {
      return false;
    }
    if (!down) {
      this.#held.delete(code);
      if (code === INTERACTION_PROTOTYPE.interactKey) this.#needsInteractRelease = false;
      return true;
    }
    if (repeat || this.#held.has(code)) return true;
    this.#held.add(code);

    if (code === INTERACTION_PROTOTYPE.closeKey) {
      if (this.#available && !this.#isPaused()) this.#closeInvestigation();
      return true;
    }
    if (code === INTERACTION_PROTOTYPE.interactKey &&
        this.#needsInteractRelease) return true;
    this.#requestInteraction();
    return true;
  }

  requestClose(): boolean {
    if (!this.#available || this.#isPaused()) return false;
    return this.#closeInvestigation();
  }

  setAvailable(available: boolean): void {
    const interrupted = this.#held.has(INTERACTION_PROTOTYPE.interactKey);
    this.#available = available;
    if (!available) {
      this.#held.clear();
      if (interrupted) this.#needsInteractRelease = true;
    }
  }

  afterStep(player: PlayerState, deltaMs: number): void {
    this.#lastPlayer = player;
    if (Math.abs(player.vx) > INTERACTION_PROTOTYPE.facingVelocityThreshold) {
      this.#facing = player.vx > 0 ? 1 : -1;
    }
    if (this.#feedbackRemainingMs > 0) {
      this.#feedbackRemainingMs = Math.max(0, this.#feedbackRemainingMs - deltaMs);
      if (this.#feedbackRemainingMs === 0) {
        this.#feedbackId = null;
        this.#feedbackText = null;
      }
    }
    const candidates = this.#candidates(player);
    this.#candidateCount = candidates.length;
    this.#selectedId = selectInteractionTarget(candidates, player, this.#facing)?.id ?? null;
  }

  reset(): void {
    const interrupted = this.#needsInteractRelease ||
      this.#held.has(INTERACTION_PROTOTYPE.interactKey);
    this.#controls.request(this.#owner, false);
    this.#held.clear();
    this.#needsInteractRelease = interrupted;
    this.#selectedId = null;
    this.#candidateCount = 0;
    this.#investigationId = null;
    this.#feedbackId = null;
    this.#feedbackText = null;
    this.#feedbackRemainingMs = 0;
    this.#consumedCount = 0;
    this.#investigationStarts = 0;
    this.#feedbackCount = 0;
  }

  interruptTransientSession(): void {
    const interrupted = this.#needsInteractRelease ||
      this.#held.has(INTERACTION_PROTOTYPE.interactKey) ||
      this.#investigationId !== null;
    this.#controls.request(this.#owner, false);
    this.#held.clear();
    if (interrupted) this.#needsInteractRelease = true;
    this.#selectedId = null;
    this.#candidateCount = 0;
    this.#investigationId = null;
    this.#feedbackId = null;
    this.#feedbackText = null;
    this.#feedbackRemainingMs = 0;
  }

  restoreFacing(facing: -1 | 1): void {
    this.#facing = facing;
  }

  get snapshot(): InteractionSnapshot {
    const active = this.#objects.find(object => object.id === this.#investigationId);
    const feedback = this.#objects.find(object => object.id === this.#feedbackId);
    const selected = this.#objects.find(object => object.id === this.#selectedId);
    const mode: InteractionMode = active ? 'investigation' : feedback ? 'feedback' : 'idle';
    const canOfferPrompt = this.#available &&
      !this.#isPaused() &&
      this.#controls.allowed &&
      !this.#needsInteractRelease &&
      !this.#held.has(INTERACTION_PROTOTYPE.interactKey);
    return {
      mode,
      selectedId: selected?.id ?? null,
      activeId: active?.id ?? null,
      prompt: !active && selected && canOfferPrompt
        ? `${INTERACTION_PROTOTYPE.interactKey === 'KeyE' ? 'E' : INTERACTION_PROTOTYPE.interactKey} ${this.#actionLabel(selected)} ${selected.label}`
        : null,
      title: active?.title ?? null,
      content: active?.content ?? null,
      feedbackText: feedback
        ? this.#feedbackText ?? `${feedback.label}：短暂反馈 +1（无奖励／未保存）`
        : null,
      feedbackRemainingMs: this.#feedbackRemainingMs,
      candidateCount: this.#candidateCount,
      consumedCount: this.#consumedCount,
      investigationStarts: this.#investigationStarts,
      feedbackCount: this.#feedbackCount,
      facing: this.#facing,
      needsRelease: this.#needsInteractRelease,
      controlBlocked: !this.#controls.allowed,
    };
  }

  #requestInteraction(): void {
    if (!this.#available || this.#isPaused() || this.#investigationId) return;
    if (!this.#controls.allowed) return;
    const target = selectInteractionTarget(this.#candidates(this.#lastPlayer), this.#lastPlayer, this.#facing);
    // The source of truth remains the last simulated state. Selection is
    // re-evaluated here so a stale visible prompt cannot execute a wrong target.
    if (!target) return;
    this.#consumedCount++;
    this.#selectedId = target.id;
    if (target.kind === 'investigation') {
      this.#investigationId = target.id;
      this.#investigationStarts++;
      this.#controls.request(this.#owner, true);
    } else {
      this.#feedbackId = target.id;
      this.#feedbackText = target.kind === 'pickup'
        ? null
        : this.#activateProgress?.(target) ?? `${target.label}：进度请求被拒绝`;
      this.#feedbackRemainingMs = INTERACTION_PROTOTYPE.pickupFeedbackMs;
      this.#feedbackCount++;
    }
  }

  #closeInvestigation(): boolean {
    if (!this.#investigationId) return false;
    this.#investigationId = null;
    this.#controls.request(this.#owner, false);
    return true;
  }

  #candidates(player: Pick<PlayerState, 'x' | 'y'>): readonly InteractionObject[] {
    return this.#objects.filter(object =>
      Math.abs(object.x - player.x) <= object.rangeX &&
      Math.abs(object.y - player.y) <= object.rangeY);
  }

  #lastPlayer: PlayerState = {
    x: Number.NaN,
    y: Number.NaN,
    vx: 0,
    vy: 0,
    worldVx: 0,
    worldVy: 0,
    supportVx: 0,
    supportVy: 0,
    grounded: false,
    normalX: 0,
    normalY: -1,
    support: '',
    wall: false,
    ceiling: false,
  };

  updatePlayerState(player: PlayerState): void {
    this.#lastPlayer = player;
  }

  #actionLabel(object: InteractionObject): string {
    if (object.kind === 'pickup') return '拾取';
    if (object.kind === 'collection') return '收藏';
    if (object.kind === 'goal') return '完成目标';
    return '调查';
  }
}
