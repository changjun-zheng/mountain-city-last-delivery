import type {} from 'phaser';
import { PLAYER_PROTOTYPE, type PlayerState } from '../../core/player.ts';
import type { GrayboxPhysics } from '../../core/graybox.ts';

// Uses Phaser's bundled Matter, injected so the identical world can run in deterministic tests.
export type MatterLibrary = {
  Bodies: typeof MatterJS.Bodies; Body: typeof MatterJS.Body; Composite: typeof MatterJS.Composite;
  Engine: typeof MatterJS.Engine;
  Query: { collides(body: MatterJS.BodyType, bodies: MatterJS.BodyType[]): { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] };
};
type Pair = { isActive: boolean; isSensor: boolean; bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType;
  collision: { normal: { x: number; y: number } } };
export const GRAYBOX_SIZE = { width: 2000, height: 680 };

export class MatterGrayboxWorld implements GrayboxPhysics {
  readonly terrain: MatterJS.BodyType[] = [];
  readonly player: MatterJS.BodyType;
  readonly foot: MatterJS.BodyType;
  readonly #matter: MatterLibrary;
  readonly #engine: MatterJS.Engine;
  readonly #advance: (deltaMs: number) => void;
  readonly #gravity: { x: number; y: number; scale: number };
  #state: PlayerState = { x: 80, y: 472, vx: 0, vy: 0, grounded: false,
    normalX: 0, normalY: -1, support: '', wall: false, ceiling: false };
  #steps = 0;

  constructor(matter: MatterLibrary, engine: MatterJS.Engine, advance: (deltaMs: number) => void) {
    this.#matter = matter;
    this.#engine = engine;
    this.#advance = advance;
    const gravity = (engine as unknown as { gravity: { x: number; y: number; scale: number } }).gravity;
    this.#gravity = gravity;
    Object.assign(gravity, { x: 0, y: 1.4, scale: 0.001 }); // Prototype: 1400 units/s².
    const rectangle = (x: number, y: number, w: number, h: number, label: string) => {
      const body = matter.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 1, label });
      this.terrain.push(body);
      return body;
    };
    rectangle(440, 535, 880, 70, 'ground-a');
    rectangle(1165, 535, 310, 70, 'ground-b');
    rectangle(1790, 415, 340, 70, 'upper-ground');
    rectangle(10, 250, 20, 500, 'left-boundary');
    rectangle(1970, 250, 20, 500, 'right-boundary');
    rectangle(535, 455, 30, 90, 'wall');
    rectangle(290, 415, 200, 30, 'low-ceiling');
    rectangle(745, 409, 90, 18, 'solid-platform-a');
    rectangle(1155, 399, 90, 18, 'solid-platform-b');
    const slope = matter.Bodies.fromVertices(0, 0, [[
      { x: 0, y: 120 }, { x: 300, y: 0 }, { x: 300, y: 180 }, { x: 0, y: 180 },
    ]], { isStatic: true, friction: 1, label: 'continuous-slope' });
    matter.Body.translate(slope, { x: 1320 - slope.bounds.min.x, y: 380 - slope.bounds.min.y });
    this.terrain.push(slope);
    this.player = matter.Bodies.rectangle(80, 472, PLAYER_PROTOTYPE.width, PLAYER_PROTOTYPE.height, {
      label: 'player', friction: 0, frictionStatic: 2, frictionAir: 0, restitution: 0,
      chamfer: { radius: 3 },
    });
    matter.Body.setInertia(this.player, Infinity);
    this.foot = matter.Bodies.rectangle(80, 496, 22, 8, { isSensor: true, isStatic: true, label: 'foot-region' });
    // The sensor is a query-only independent region: it never blocks or changes player mass.
    for (const body of [...this.terrain, this.player]) {
      matter.Composite.add(engine.world as unknown as MatterJS.CompositeType, body);
    }
  }

  drive(vx: number, vy: number): void {
    this.player.friction = this.#state.grounded && Math.abs(vx) < 0.01 ? 1 : 0;
    if (this.#state.support === 'continuous-slope' && Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) {
      // Prototype static-support anti-slide: counter gravity only after validated contact.
      // Engine collision detection still runs; air, moving input and jumping never use this.
      this.player.force.y -= this.player.mass * this.#gravity.y * this.#gravity.scale;
    }
    this.#matter.Body.setVelocity(this.player, { x: vx / 60, y: vy / 60 });
  }

  step(deltaMs: number): void {
    this.#advance(deltaMs);
    this.#steps++;
    const body = this.player;
    this.#matter.Body.setPosition(this.foot, { x: body.position.x, y: body.position.y + PLAYER_PROTOTYPE.height / 2 + 1 });
    const candidates = new Set(this.#matter.Query.collides(this.foot, this.terrain).map(c => c.bodyA === this.foot ? c.bodyB : c.bodyA));
    let support = '', normalX = 0, normalY = -1, wall = false, ceiling = false;
    for (const pair of this.#engine.pairs.list as Pair[]) {
      if (!pair.isActive || pair.isSensor || (pair.bodyA !== body && pair.bodyB !== body)) continue;
      const other = pair.bodyA === body ? pair.bodyB : pair.bodyA;
      const sign = pair.bodyA === body ? 1 : -1;
      const nx = sign * pair.collision.normal.x, ny = sign * pair.collision.normal.y;
      if (Math.abs(nx) > 0.7) wall = true;
      if (ny > 0.65) ceiling = true;
      // Tangential ascent has negative world-Y velocity but is still supported.
      const separatingSpeed = (body.velocity.x * nx + body.velocity.y * ny) * 60;
      if (candidates.has(other) && ny < -0.65 && separatingSpeed <= 40) {
        support = other.label;
        normalX = nx;
        normalY = ny;
      }
    }
    this.#state = { x: body.position.x, y: body.position.y, vx: body.velocity.x * 60,
      vy: body.velocity.y * 60, grounded: Boolean(support), normalX, normalY, support, wall, ceiling };
  }

  reset(): void {
    const m = this.#matter;
    m.Body.setPosition(this.player, { x: 80, y: 472 });
    m.Body.setVelocity(this.player, { x: 0, y: 0 });
    m.Body.setAngularVelocity(this.player, 0);
    this.player.force.x = this.player.force.y = 0;
    this.player.torque = 0;
    const impulse = (this.player as MatterJS.BodyType & { positionImpulse: { x: number; y: number } }).positionImpulse;
    impulse.x = impulse.y = 0;
    m.Engine.clear(this.#engine);
    // Engine.clear also empties the broadphase detector. Rebuild it on the next step.
    m.Composite.setModified(this.#engine.world as unknown as MatterJS.CompositeType, true, false, true);
    this.#state = { x: 80, y: 472, vx: 0, vy: 0, grounded: false,
      normalX: 0, normalY: -1, support: '', wall: false, ceiling: false };
  }
  get state(): PlayerState { return this.#state; }
  get steps(): number { return this.#steps; }
  get timestamp(): number { return this.#engine.timing.timestamp; }
}
