export type PauseOwner = symbol;
export type PauseRequestKey = symbol;
export type PauseToken = symbol;

export class RuntimeLifecycleController {
  readonly #simulation: { pause(): void; resume(): void };
  readonly #requests = new Map<PauseOwner, Map<PauseRequestKey, PauseToken>>();
  readonly #records = new Map<PauseToken, { owner: PauseOwner; active: boolean }>();
  readonly #active = new Set<PauseToken>();

  constructor(simulation: { pause(): void; resume(): void }) {
    this.#simulation = simulation;
  }

  acquire(owner: PauseOwner, key: PauseRequestKey): PauseToken | undefined {
    const requests = this.#requests.get(owner) ?? new Map<PauseRequestKey, PauseToken>();
    const existing = requests.get(key);
    if (existing !== undefined) {
      // Retired request keys are remembered for this controller's entire lifetime.
      return this.#active.has(existing) ? existing : undefined;
    }
    const token = Symbol('pause-token');
    requests.set(key, token);
    this.#requests.set(owner, requests);
    this.#records.set(token, { owner, active: true });
    this.#active.add(token);
    if (this.#active.size === 1) this.#simulation.pause();
    return token;
  }

  release(owner: PauseOwner, token: PauseToken): 'released' | 'already-released' | 'rejected' {
    const record = this.#records.get(token);
    if (!record || record.owner !== owner) return 'rejected';
    if (!record.active) return 'already-released';
    record.active = false;
    this.#active.delete(token);
    if (this.#active.size === 0) this.#simulation.resume();
    return 'released';
  }

  get pauseCount(): number { return this.#active.size; }
}
