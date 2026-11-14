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

  recordCollection(collectionId: string): ProgressMutation {
    if (!COLLECTION_IDS.has(collectionId)) return rejected('collection', collectionId);
    const status = this.#add(this.#collections, collectionId);
    return Object.freeze({ category: 'collection' as const, id: collectionId, status });
  }

  completeGoal(goalId: string): GoalCompletionResult {
    const relation = GOAL_RELATIONS.get(goalId);
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
    if (REWARD_RELATIONS.get(rewardId) !== goalId || !this.#goals.has(goalId)) {
      return rejected('reward', rewardId);
    }
    return Object.freeze({
      category: 'reward' as const,
      id: rewardId,
      status: this.#add(this.#rewards, rewardId),
    });
  }

  setPermanentEffect(effectId: string, expectedActive: boolean): ProgressMutation {
    const goalId = EFFECT_RELATIONS.get(effectId);
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
    const relation = GOAL_RELATIONS.get(goalId);
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
