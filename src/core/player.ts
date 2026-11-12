// All values are adjustable graybox parameters, not final gameplay decisions.
export const PLAYER_PROTOTYPE = Object.freeze({
  width: 28, height: 44, speed: 220, acceleration: 1500, deceleration: 2000,
  airControl: 0.8, jumpSpeed: 530, releaseMultiplier: 0.6,
  coyoteMs: 100, bufferMs: 130,
});

export type PlayerState = Readonly<{
  x: number; y: number; vx: number; vy: number;
  grounded: boolean; normalX: number; normalY: number; support: string;
  wall: boolean; ceiling: boolean;
}>;

// PC-01: only this coordinator determines whether the motor can use input.
export class PlayerControlCoordinator {
  readonly #blocks = new Set<symbol>();
  readonly #onBlocked: () => void;
  constructor(onBlocked: () => void) { this.#onBlocked = onBlocked; }
  request(owner: symbol, blocked: boolean): void {
    if (blocked) {
      if (!this.#blocks.has(owner)) this.#onBlocked();
      this.#blocks.add(owner);
    } else this.#blocks.delete(owner);
  }
  get allowed(): boolean { return this.#blocks.size === 0; }
}

export class PlayerMotor {
  readonly #held = new Set<string>();
  #press = false;
  #needsRelease = false;
  #bufferMs = 0;
  #coyoteMs = 0;
  #eligible = false;
  #awaitAir = false;
  #cut = true;
  #jumps = 0;
  readonly controls = new PlayerControlCoordinator(() => this.clearInput(true));

  key(code: string, down: boolean, repeat = false): void {
    if (!['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) return;
    if (!down) {
      this.#held.delete(code);
      if (code === 'Space') this.#needsRelease = false;
      return;
    }
    if (repeat || !this.controls.allowed || this.#held.has(code)) return;
    this.#held.add(code);
    if (code === 'Space' && !this.#needsRelease) this.#press = true;
  }

  clearInput(requireRelease: boolean): void {
    this.#held.clear();
    this.#press = false;
    this.#bufferMs = 0;
    this.#needsRelease = requireRelease;
  }

  reset(): void {
    const requireRelease = this.#needsRelease || this.#held.has('Space');
    this.clearInput(requireRelease);
    this.#coyoteMs = 0;
    this.#eligible = false;
    this.#awaitAir = false;
    this.#cut = true;
    this.#jumps = 0;
  }

  beforeStep(state: PlayerState, deltaMs: number) {
    const p = PLAYER_PROTOTYPE;
    const left = this.#held.has('KeyA') || this.#held.has('ArrowLeft');
    const right = this.#held.has('KeyD') || this.#held.has('ArrowRight');
    const axis = this.controls.allowed ? Number(right) - Number(left) : 0;
    const held = this.controls.allowed && this.#held.has('Space') && !this.#needsRelease;
    if (this.#press && this.controls.allowed) this.#bufferMs = p.bufferMs;
    this.#press = false; // One physical press is transferred at most once, including catch-up ticks.
    const factor = state.grounded ? 1 : p.airControl;
    const reversing = axis !== 0 && state.vx * axis < 0;
    const target = reversing ? 0 : axis * p.speed;
    const rate = (axis === 0 || reversing ? p.deceleration : p.acceleration) * factor;
    const change = Math.min(Math.abs(target - state.vx), rate * deltaMs / 1000);
    let vx = state.vx + Math.sign(target - state.vx) * change;
    let vy = state.vy;
    let jumped = false;
    if (this.controls.allowed && this.#bufferMs > 0 && this.#eligible) {
      vy = -p.jumpSpeed;
      this.#bufferMs = 0;
      this.#coyoteMs = 0;
      this.#eligible = false;
      this.#awaitAir = true; // Stale take-off contacts must not re-arm a jump.
      this.#cut = false;
      this.#jumps++;
      jumped = true;
    }
    if (!held && !this.#cut && vy < 0) {
      vy *= p.releaseMultiplier;
      this.#cut = true;
    }
    if (state.grounded && !jumped && !this.#awaitAir) {
      // Follow the support tangent on slopes; idle friction is applied by the physics adapter.
      vy = Math.abs(vx) > 0.01 ? vx * (-state.normalX / state.normalY) + 20 : 0;
    }
    return { vx, vy };
  }

  afterStep(state: PlayerState, deltaMs: number): void {
    this.#bufferMs = Math.max(0, this.#bufferMs - deltaMs);
    if (!state.grounded) {
      this.#awaitAir = false;
      this.#coyoteMs = Math.max(0, this.#coyoteMs - deltaMs);
      if (this.#coyoteMs === 0) this.#eligible = false;
    } else if (!this.#awaitAir) {
      this.#eligible = true;
      this.#coyoteMs = PLAYER_PROTOTYPE.coyoteMs;
    }
  }

  get snapshot() {
    return { jumps: this.#jumps, bufferMs: this.#bufferMs, coyoteMs: this.#coyoteMs,
      eligible: this.#eligible, needsRelease: this.#needsRelease, controlAllowed: this.controls.allowed };
  }
}
