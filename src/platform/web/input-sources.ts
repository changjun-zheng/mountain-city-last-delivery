export type GameAction = 'left' | 'right' | 'jump' | 'interact';

export type InputSource =
  | Readonly<{ kind: 'keyboard'; code: string }>
  | Readonly<{ kind: 'pointer'; pointerId: number; generation: number }>;

export type InputActionSink = (
  code: string,
  down: boolean,
  repeat?: boolean,
) => void;

const KEYBOARD_ACTIONS: Readonly<Record<string, GameAction | undefined>> =
  Object.freeze({
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    Space: 'jump',
    KeyE: 'interact',
  });

const ACTION_CODES: Readonly<Record<GameAction, string>> = Object.freeze({
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  interact: 'KeyE',
});

const sourceKey = (source: InputSource): string => source.kind === 'keyboard'
  ? `keyboard:${source.code}`
  : `pointer:${source.generation}:${source.pointerId}`;

export function actionForKey(code: string): GameAction | undefined {
  return KEYBOARD_ACTIONS[code];
}

export function codeForAction(action: GameAction): string {
  return ACTION_CODES[action];
}

// One instance owns the source counts. Core key edges are emitted only when the
// effective count crosses zero, so releasing one alias never releases another.
export class InputSourceAggregator {
  readonly #sources = new Map<GameAction, Map<string, InputSource>>();
  readonly #sink: InputActionSink;
  readonly #onChange: () => void;
  #generation = 0;
  #destroyed = false;

  constructor(sink: InputActionSink, onChange: () => void = () => {}) {
    this.#sink = sink;
    this.#onChange = onChange;
  }

  get generation(): number {
    return this.#generation;
  }

  pointerSource(pointerId: number): InputSource {
    if (!Number.isSafeInteger(pointerId) || pointerId < 0) {
      throw new TypeError('pointerId must be a non-negative safe integer.');
    }
    return Object.freeze({
      kind: 'pointer' as const,
      pointerId,
      generation: this.#generation,
    });
  }

  keyboardDown(code: string, repeat = false): boolean {
    const action = actionForKey(code);
    if (!action) return false;
    return this.#press(action, Object.freeze({ kind: 'keyboard' as const, code }), repeat);
  }

  pointerActionDown(action: GameAction, pointerId: number): boolean {
    return this.#press(action, this.pointerSource(pointerId), false);
  }

  keyboardUp(code: string): boolean {
    const action = actionForKey(code);
    if (!action) return false;
    return this.#release(action, Object.freeze({ kind: 'keyboard' as const, code }));
  }

  pointerActionUp(
    action: GameAction,
    pointerId: number,
    generation = this.#generation,
    emitEdge = true,
  ): boolean {
    return this.#release(
      action,
      Object.freeze({ kind: 'pointer' as const, pointerId, generation }),
      emitEdge,
    );
  }

  clearPointers(emitEdges = true): void {
    this.#generation++;
    for (const action of Object.keys(ACTION_CODES) as GameAction[]) {
      const sources = this.#sources.get(action);
      if (!sources) continue;
      for (const [key, source] of sources) {
        if (source.kind === 'pointer') sources.delete(key);
      }
      if (sources.size === 0) {
        this.#sources.delete(action);
        if (emitEdges) this.#sink(codeForAction(action), false, false);
      }
    }
    this.#onChange();
  }

  cancelAll(emitEdges = true): void {
    for (const action of Object.keys(ACTION_CODES) as GameAction[]) {
      this.#sources.delete(action);
      if (emitEdges) this.#sink(codeForAction(action), false, false);
    }
    this.#onChange();
  }

  destroy(emitEdges = true): void {
    if (this.#destroyed) return;
    this.clearPointers(emitEdges);
    this.cancelAll(emitEdges);
    this.#destroyed = true;
  }

  snapshot(): Readonly<Record<GameAction, readonly string[]>> {
    return Object.freeze(Object.fromEntries(
      (Object.keys(ACTION_CODES) as GameAction[]).map(action => [
        action,
        Object.freeze([...(this.#sources.get(action)?.keys() ?? [])].sort()),
      ]),
    )) as Readonly<Record<GameAction, readonly string[]>>;
  }

  #press(action: GameAction, source: InputSource, repeat: boolean): boolean {
    if (this.#destroyed || repeat) return false;
    let sources = this.#sources.get(action);
    if (!sources) {
      sources = new Map();
      this.#sources.set(action, sources);
    }
    const key = sourceKey(source);
    if (sources.has(key)) return false;
    const wasEmpty = sources.size === 0;
    sources.set(key, source);
    if (wasEmpty) this.#sink(codeForAction(action), true, false);
    this.#onChange();
    return true;
  }

  #release(
    action: GameAction,
    source: InputSource,
    emitEdge = true,
  ): boolean {
    const sources = this.#sources.get(action);
    if (!sources || !sources.delete(sourceKey(source))) return false;
    this.#settle(action, emitEdge);
    return true;
  }

  #settle(action: GameAction, emitEdge = true): void {
    const sources = this.#sources.get(action);
    if (sources?.size) {
      this.#onChange();
      return;
    }
    this.#sources.delete(action);
    if (emitEdge) this.#sink(codeForAction(action), false, false);
    this.#onChange();
  }
}
