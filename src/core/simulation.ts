export type SimulationConfig = Readonly<{ fixedDeltaMs: number; maxStepsPerFrame: number }>;

// Engineering verification values, not confirmed gameplay or physics parameters.
export const PROTOTYPE_SIMULATION: SimulationConfig = Object.freeze({
  fixedDeltaMs: 20,
  maxStepsPerFrame: 5,
});

export class FixedStepSimulation {
  readonly config: SimulationConfig;
  #lastSample: number | undefined;
  #remainder = 0;
  #tick = 0;
  #discardedMs = 0;
  #steps = 0;
  #paused = false;
  readonly #step: (deltaMs: number, tick: number) => void;

  constructor(config: SimulationConfig, step: (deltaMs: number, tick: number) => void) {
    if (!Number.isFinite(config.fixedDeltaMs) || config.fixedDeltaMs <= 0 ||
        !Number.isSafeInteger(config.maxStepsPerFrame) || config.maxStepsPerFrame <= 0) {
      throw new Error('Invalid simulation configuration.');
    }
    this.config = Object.freeze({ ...config });
    this.#step = step;
  }

  frame(sampleMs: number): void {
    if (!Number.isFinite(sampleMs) || sampleMs < 0 ||
        (this.#lastSample !== undefined && sampleMs < this.#lastSample)) {
      throw new Error('Simulation samples must be finite, nonnegative and monotonic.');
    }
    this.#steps = 0;
    if (this.#paused) return;
    if (this.#lastSample === undefined) {
      this.#lastSample = sampleMs;
      return;
    }
    const elapsed = sampleMs - this.#lastSample;
    this.#lastSample = sampleMs;
    const accumulated = this.#remainder + elapsed;
    let due = Math.floor(accumulated / this.config.fixedDeltaMs);
    let remainder = accumulated % this.config.fixedDeltaMs;
    // Ignore sub-nanosecond rounding near a step boundary.
    if (this.config.fixedDeltaMs - remainder <= this.config.fixedDeltaMs * 1e-10) {
      due++;
      remainder = 0;
    }
    const steps = Math.min(due, this.config.maxStepsPerFrame);
    for (let i = 0; i < steps; i++) {
      this.#tick++;
      this.#step(this.config.fixedDeltaMs, this.#tick);
      this.#steps++;
    }
    // Discard complete excess steps without invoking step() or inventing ticks.
    this.#discardedMs += (due - steps) * this.config.fixedDeltaMs;
    this.#remainder = remainder;
  }

  pause(): void {
    this.#paused = true;
    this.#lastSample = undefined;
    this.#steps = 0;
  }

  resume(): void {
    this.#paused = false;
    // The next rendered frame establishes a new baseline, never a background delta.
    this.#lastSample = undefined;
    this.#steps = 0;
  }

  get snapshot() {
    return {
      tick: this.#tick, remainderMs: this.#remainder, discardedMs: this.#discardedMs,
      stepsLastFrame: this.#steps, paused: this.#paused,
    };
  }
}
