export type ProgressCategory = 'collection' | 'goal' | 'reward' | 'effect';
export type ProgressMutationStatus = 'added' | 'existing' | 'rejected';

export type ProgressMutation = Readonly<{
  category: ProgressCategory;
  id: string;
  status: ProgressMutationStatus;
}>;

export type GoalCompletionResult = Readonly<{
  status: ProgressMutationStatus;
  goal: ProgressMutation;
  reward: ProgressMutation;
  effect: ProgressMutation;
}>;

export type PermanentEffectSnapshot = Readonly<{
  id: string;
  expectedActive: boolean;
}>;

export type RunProgressSnapshot = Readonly<{
  collections: readonly string[];
  goals: readonly string[];
  rewards: readonly string[];
  effects: readonly PermanentEffectSnapshot[];
  counts: Readonly<{
    collections: number;
    goals: number;
    rewards: number;
    effects: number;
  }>;
}>;

// Clearly marked runtime-only test content. These identifiers are stable across
// temporary object rebuilds, but are not persisted or reused as Event/Command IDs.
export const PROTOTYPE_PROGRESS_CONTENT = Object.freeze({
  collection: Object.freeze({
    interactionId: 'prototype-collection-d',
    businessId: 'collection.prototype.travel-token',
    label: 'D',
    title: 'D08 测试收藏 D',
    content: '仅用于验证运行内收藏去重，不进入正式收藏册或磁盘存档。',
    x: 420,
    y: 450,
    rangeX: 45,
    rangeY: 110,
  }),
  goal: Object.freeze({
    interactionId: 'prototype-goal-e',
    businessId: 'goal.prototype.open-test-route',
    rewardId: 'reward.prototype.open-test-route',
    effectId: 'effect.prototype.open-test-route',
    label: 'E',
    title: 'D08 测试目标 E',
    content: '完成测试目标并登记一次测试奖励；永久效果保持路线开启。',
    x: 490,
    y: 450,
    rangeX: 45,
    rangeY: 110,
  }),
});

// D12-A1 runtime-only stable business records. They are intentionally
// independent from the laboratory prototype goal and from each other.
export const FIRST_LEVEL_PROGRESS_CONTENT = Object.freeze({
  questAccepted: Object.freeze({
    goalId: 'goal.first-level.night-postcard.accepted',
    effectId: 'effect.first-level.night-postcard.accepted',
  }),
  liftRouteUnlocked: Object.freeze({
    goalId: 'goal.first-level.lift-route.unlocked',
    effectId: 'effect.first-level.lift-route.open',
  }),
  completed: Object.freeze({
    goalId: 'goal.first-level.night-postcard.completed',
    effectId: 'effect.first-level.night-postcard.completed',
  }),
});

type GoalProgressDefinition = Readonly<{
  rewardId?: string;
  effectId?: string;
}>;

const COLLECTION_IDS = new Set<string>([PROTOTYPE_PROGRESS_CONTENT.collection.businessId]);
const GOAL_RELATIONS = new Map<string, GoalProgressDefinition>([
  [
    PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
    Object.freeze({
      rewardId: PROTOTYPE_PROGRESS_CONTENT.goal.rewardId,
      effectId: PROTOTYPE_PROGRESS_CONTENT.goal.effectId,
    }),
  ],
  [
    FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.goalId,
    Object.freeze({
      effectId: FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.effectId,
    }),
  ],
  [
    FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
    Object.freeze({
      effectId: FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.effectId,
    }),
  ],
  [
    FIRST_LEVEL_PROGRESS_CONTENT.completed.goalId,
    Object.freeze({
      effectId: FIRST_LEVEL_PROGRESS_CONTENT.completed.effectId,
    }),
  ],
]);
const REWARD_RELATIONS = new Map<string, string>([
  [
    PROTOTYPE_PROGRESS_CONTENT.goal.rewardId,
    PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
  ],
]);
const EFFECT_RELATIONS = new Map<string, string>([
  [
    PROTOTYPE_PROGRESS_CONTENT.goal.effectId,
    PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
  ],
  [
    FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.effectId,
    FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.goalId,
  ],
  [
    FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.effectId,
    FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
  ],
  [
    FIRST_LEVEL_PROGRESS_CONTENT.completed.effectId,
    FIRST_LEVEL_PROGRESS_CONTENT.completed.goalId,
  ],
]);

// A closed, separate content directory for EXP-01; legacy callers stay unchanged.
export const EXP01_PROGRESS_CONTENT = Object.freeze({
  item: 'collection.exp01.passage-plaque',
  accepted: 'goal.exp01.photo-request',
  clue: 'goal.exp01.route-note',
  unlocked: 'goal.exp01.passage-open',
  completed: 'goal.exp01.view-found',
  effect: 'effect.exp01.passage-open',
});

export const EXP02A_PROGRESS_CONTENT = Object.freeze({
  item: 'collection.exp02a.river-clasp',
  accepted: 'goal.exp02a.photo-request',
  clue: 'goal.exp02a.river-route-note',
  unlocked: 'goal.exp02a.east-passage-open',
  completed: 'goal.exp02a.lower-view-found',
  effect: 'effect.exp02a.east-passage-open',
});
export const EXP02B_PROGRESS_CONTENT = Object.freeze({
  photographed:'goal.exp02b.night-postcard.photographed',
  reward:'reward.exp02b.night-postcard',
});

const rejected = (category: ProgressCategory, id: unknown): ProgressMutation => Object.freeze({
  category,
  id: typeof id === 'string' ? id : '',
  status: 'rejected',
});

// Prototype-only run progress. This class has no storage or platform API; a new
// Runtime Instance starts with a new instance and therefore an empty repository.
export class InMemoryRunProgress {
  readonly #collections = new Set<string>();
  readonly #goals = new Set<string>();
  readonly #rewards = new Set<string>();
  readonly #effects = new Map<string, boolean>();
  readonly #collectionIds: ReadonlySet<string>;
  readonly #goalRelations: ReadonlyMap<string, GoalProgressDefinition>;
  readonly #rewardRelations: ReadonlyMap<string, string>;
  readonly #effectRelations: ReadonlyMap<string, string>;

  constructor(content: 'legacy' | 'exp01' | 'exp02a' | 'exp02b' = 'legacy') {
    if (content !== 'legacy' && content !== 'exp01' && content !== 'exp02a' && content !== 'exp02b') throw new Error('Unknown progress content.');
    const e = content === 'exp02a'||content==='exp02b' ? EXP02A_PROGRESS_CONTENT : EXP01_PROGRESS_CONTENT;
    this.#collectionIds = content === 'legacy' ? COLLECTION_IDS : new Set([e.item]);
    const goals = new Map<string,GoalProgressDefinition>([
      [e.accepted, {}], [e.clue, {}], [e.unlocked, { effectId: e.effect }], [e.completed, {}],
    ]);
    if(content==='exp02b')goals.set(EXP02B_PROGRESS_CONTENT.photographed,{rewardId:EXP02B_PROGRESS_CONTENT.reward});
    this.#goalRelations = content === 'legacy' ? GOAL_RELATIONS : goals;
    this.#rewardRelations = content === 'legacy' ? REWARD_RELATIONS : content==='exp02b'?new Map([[EXP02B_PROGRESS_CONTENT.reward,EXP02B_PROGRESS_CONTENT.photographed]]):new Map();
    this.#effectRelations = content === 'legacy' ? EFFECT_RELATIONS : new Map([[e.effect, e.unlocked]]);
  }

  // Validate the entire closed-directory record before changing any live state.
  restore(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const s = value as RunProgressSnapshot;
    if (!Array.isArray(s.collections) || !Array.isArray(s.goals) ||
        !Array.isArray(s.rewards) || !Array.isArray(s.effects) || !s.counts ||
        Object.keys(s).sort().join(',') !== 'collections,counts,effects,goals,rewards') return false;
    const unique = (ids: readonly unknown[]) => ids.every(id => typeof id === 'string') && new Set(ids).size === ids.length;
    if (![s.collections, s.goals, s.rewards].every(unique) ||
        s.collections.some(id => !this.#collectionIds.has(id)) ||
        s.goals.some(id => !this.#goalRelations.has(id))) return false;
    const rewards: string[] = [];
    const effects: string[] = [];
    for (const goal of s.goals) {
      const relation = this.#goalRelations.get(goal)!;
      if (relation.rewardId) rewards.push(relation.rewardId);
      if (relation.effectId) effects.push(relation.effectId);
    }
    const equal = (a: readonly string[], b: readonly string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    if (!equal(s.rewards, rewards) || s.effects.some(e => !e || typeof e.id !== 'string' ||
        e.expectedActive !== true || Object.keys(e).sort().join(',') !== 'expectedActive,id') ||
        !equal(s.effects.map(e => e.id), effects)) return false;
    const counts = { collections: s.collections.length, goals: s.goals.length, rewards: rewards.length, effects: effects.length };
    if (Object.keys(s.counts).sort().join(',') !== 'collections,effects,goals,rewards' ||
        (Object.keys(counts) as (keyof typeof counts)[]).some(k => s.counts[k] !== counts[k])) return false;
    this.#collections.clear(); this.#goals.clear(); this.#rewards.clear(); this.#effects.clear();
    s.collections.forEach(id => this.#collections.add(id));
    s.goals.forEach(id => this.#goals.add(id));
    s.rewards.forEach(id => this.#rewards.add(id));
    s.effects.forEach(e => this.#effects.set(e.id, true));
    return true;
  }

  recordCollection(collectionId: string): ProgressMutation {
    if (!this.#collectionIds.has(collectionId)) return rejected('collection', collectionId);
    const status = this.#add(this.#collections, collectionId);
    return Object.freeze({ category: 'collection' as const, id: collectionId, status });
  }

  completeGoal(goalId: string): GoalCompletionResult {
    const relation = this.#goalRelations.get(goalId);
    if (!relation) {
      return Object.freeze({
        status: 'rejected' as const,
        goal: rejected('goal', goalId),
        reward: rejected('reward', ''),
        effect: rejected('effect', ''),
      });
    }
    const status = this.#add(this.#goals, goalId);
    const reward = relation.rewardId
      ? this.claimReward(relation.rewardId, goalId)
      : rejected('reward', '');
    const effect = relation.effectId
      ? this.setPermanentEffect(relation.effectId, true)
      : rejected('effect', '');
    return Object.freeze({
      status: status === 'added' || reward.status === 'added' || effect.status === 'added'
        ? 'added' as const
        : 'existing' as const,
      goal: Object.freeze({ category: 'goal' as const, id: goalId, status }),
      reward,
      effect,
    });
  }

  claimReward(rewardId: string, goalId: string): ProgressMutation {
    if (this.#rewardRelations.get(rewardId) !== goalId || !this.#goals.has(goalId)) {
      return rejected('reward', rewardId);
    }
    return Object.freeze({
      category: 'reward' as const,
      id: rewardId,
      status: this.#add(this.#rewards, rewardId),
    });
  }

  setPermanentEffect(effectId: string, expectedActive: boolean): ProgressMutation {
    const goalId = this.#effectRelations.get(effectId);
    if (!goalId || !this.#goals.has(goalId) || typeof expectedActive !== 'boolean') {
      return rejected('effect', effectId);
    }
    const exists = this.#effects.has(effectId);
    this.#effects.set(effectId, expectedActive);
    return Object.freeze({
      category: 'effect' as const,
      id: effectId,
      status: exists ? 'existing' as const : 'added' as const,
    });
  }

  verifyGoal(goalId: string): boolean {
    const relation = this.#goalRelations.get(goalId);
    if (!relation || !this.#goals.has(goalId)) return false;
    if (relation.rewardId && !this.#rewards.has(relation.rewardId)) return false;
    if (relation.effectId) {
      return this.#effects.get(relation.effectId) === true;
    }
    return true;
  }

  reconcileEffects(apply: (effectId: string, expectedActive: boolean) => void): void {
    for (const [effectId, expectedActive] of this.#effects) apply(effectId, expectedActive);
  }

  get snapshot(): RunProgressSnapshot {
    const collections = Object.freeze([...this.#collections]);
    const goals = Object.freeze([...this.#goals]);
    const rewards = Object.freeze([...this.#rewards]);
    const effects = Object.freeze([...this.#effects].map(([id, expectedActive]) =>
      Object.freeze({ id, expectedActive }),
    ));
    return Object.freeze({
      collections,
      goals,
      rewards,
      effects,
      counts: Object.freeze({
        collections: collections.length,
        goals: goals.length,
        rewards: rewards.length,
        effects: effects.length,
      }),
    });
  }

  #add(target: Set<string>, id: string): 'added' | 'existing' {
    if (target.has(id)) return 'existing';
    target.add(id);
    return 'added';
  }
}
