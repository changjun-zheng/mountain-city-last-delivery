import type { BusinessRuntimeBus } from './business-runtime-bus.ts';
import type { InteractionObject } from './interaction.ts';
import {
  FIRST_LEVEL_PROGRESS_CONTENT,
  InMemoryRunProgress,
} from './progress.ts';
import {
  PrototypeGoalRouteRuntime,
  type GoalRouteRuntimeSnapshot,
} from './goal-route-runtime.ts';
import type {
  GrayboxCheckpointConfig,
  SnapshotScenario,
} from './snapshot.ts';

export const FIRST_LEVEL_ID = 'first-level-night-postcard';
export const FIRST_LEVEL_INITIAL_CHECKPOINT_ID =
  'first-level-initial-spawn';
export const FIRST_LEVEL_LIFT_OBJECT_ID = 'first-level-service-lift';

export const FIRST_LEVEL_EVENT_TYPES = Object.freeze([
  'first-level.quest.accept.requested',
  'first-level.lift.unlock.requested',
  'first-level.postcard.complete.requested',
] as const);

const FIRST_LEVEL_CHECKPOINT_CONFIG: GrayboxCheckpointConfig = Object.freeze({
  checkpointId: FIRST_LEVEL_INITIAL_CHECKPOINT_ID,
  levelId: FIRST_LEVEL_ID,
  anchor: Object.freeze({ x: 80, y: 518, facing: 1 as const }),
  fallbackAnchors: Object.freeze([
    Object.freeze({ x: 360, y: 518, facing: 1 as const }),
    Object.freeze({ x: 480, y: 448, facing: 1 as const }),
  ]),
});

// The first playable slice deliberately has one initial fallback snapshot and no
// additional playable checkpoint. Its registered mutable object is the service
// lift that carries the player from C to D.
export const FIRST_LEVEL_SNAPSHOT_SCENARIO: SnapshotScenario = Object.freeze({
  schemaVersion: 1,
  defaultCheckpointId: FIRST_LEVEL_INITIAL_CHECKPOINT_ID,
  checkpointConfigs: Object.freeze([FIRST_LEVEL_CHECKPOINT_CONFIG]),
  registry: Object.freeze([
    Object.freeze({
      objectId: FIRST_LEVEL_LIFT_OBJECT_ID,
      stateVersion: 1,
      axis: 'vertical' as const,
    }),
  ]),
});

export const FIRST_LEVEL_INTERACTION_IDS = Object.freeze({
  tutorial: 'first-level-a-tutorial',
  npc: 'first-level-b-npc',
  clue: 'first-level-b-clue',
  leverLeft: 'first-level-c-lever-left',
  leverRight: 'first-level-c-lever-right',
  photo: 'first-level-d-photo',
});

export const FIRST_LEVEL_ACTIONS = Object.freeze({
  talkToNpc: 'first-level.action.talk-to-npc',
  operateLeftLever: 'first-level.action.operate-left-lever',
  operateRightLever: 'first-level.action.operate-right-lever',
  finishPhoto: 'first-level.action.finish-photo',
});

// A/B/C/D are functional placeholder labels. Their dialogue and clue text are
// prototype copy and do not define a real-world route or final narrative.
export const FIRST_LEVEL_INTERACTIONS: readonly InteractionObject[] =
  Object.freeze([
    Object.freeze({
      id: FIRST_LEVEL_INTERACTION_IDS.tutorial,
      kind: 'investigation' as const,
      label: 'A',
      title: 'A 区 · 出发提示',
      content:
        'A/D 或方向键移动，Space 跳跃。' +
        '靠近游客后按 E 开始对话；读完内容再主动结束对话。',
      x: 180,
      y: 498,
      rangeX: 70,
      rangeY: 90,
    }),
    Object.freeze({
      id: FIRST_LEVEL_INTERACTION_IDS.npc,
      kind: 'investigation' as const,
      actionId: FIRST_LEVEL_ACTIONS.talkToNpc,
      activateOnClose: true,
      label: 'B · 游客',
      title: 'B 区 · 年轻游客',
      content:
        '“我想把今晚的夜景寄给远方。能顺着山势灯带，' +
        '替我找到拍摄观景点吗？”\n\n结束对话后自动接取委托。',
      x: 650,
      y: 448,
      rangeX: 70,
      rangeY: 90,
    }),
    Object.freeze({
      id: FIRST_LEVEL_INTERACTION_IDS.clue,
      kind: 'investigation' as const,
      label: 'B · 线索',
      title: 'B 区 · 唯一环境线索',
      content:
        '灯带沿山势转向 C 区装置左侧；装置上的两个控制位都能尝试。',
      x: 790,
      y: 448,
      rangeX: 75,
      rangeY: 90,
    }),
    Object.freeze({
      id: FIRST_LEVEL_INTERACTION_IDS.leverLeft,
      kind: 'goal' as const,
      actionId: FIRST_LEVEL_ACTIONS.operateLeftLever,
      actionLabel: '选择控制位',
      label: 'C · 装置左侧',
      title: 'C 区 · 装置左侧控制位',
      content: '同一装置的两个控制位之一。',
      x: 1135,
      y: 518,
      rangeX: 66,
      rangeY: 90,
    }),
    Object.freeze({
      id: FIRST_LEVEL_INTERACTION_IDS.leverRight,
      kind: 'goal' as const,
      actionId: FIRST_LEVEL_ACTIONS.operateRightLever,
      actionLabel: '选择控制位',
      label: 'C · 装置右侧',
      title: 'C 区 · 装置右侧控制位',
      content: '同一装置的两个控制位之一。',
      x: 1235,
      y: 518,
      rangeX: 66,
      rangeY: 90,
    }),
    Object.freeze({
      id: FIRST_LEVEL_INTERACTION_IDS.photo,
      kind: 'goal' as const,
      actionId: FIRST_LEVEL_ACTIONS.finishPhoto,
      actionLabel: '拍摄并分享',
      label: 'D · 观景点',
      title: 'D 区 · 拍摄与分享',
      content: '确认委托、路线与位置条件后，完成游戏内拍摄和分享。',
      x: 1830,
      y: 258,
      rangeX: 80,
      rangeY: 100,
    }),
  ]);

export type FirstLevelPhase =
  | 'intro'
  | 'quest-in-progress'
  | 'quest-accepted'
  | 'lift-in-progress'
  | 'route-open'
  | 'completion-in-progress'
  | 'completed'
  | 'blocked';

export type FirstLevelActionSnapshot = Readonly<{
  action: 'quest' | 'lift' | 'complete';
  flow: GoalRouteRuntimeSnapshot;
}>;

export type FirstLevelRuntimeSnapshot = Readonly<{
  runtimeInstanceId: string;
  phase: FirstLevelPhase;
  objective: string;
  feedback: string;
  completionVisible: boolean;
  questAccepted: boolean;
  routeUnlocked: boolean;
  completed: boolean;
  actions: readonly FirstLevelActionSnapshot[];
  lastError: string | null;
}>;

export type FirstLevelRuntimeContext = Readonly<{
  bus: BusinessRuntimeBus;
  progress: InMemoryRunProgress;
}>;

export class FirstLevelRuntime {
  readonly runtimeInstanceId: string;
  readonly #progress: InMemoryRunProgress;
  readonly #quest: PrototypeGoalRouteRuntime;
  readonly #lift: PrototypeGoalRouteRuntime;
  readonly #completion: PrototypeGoalRouteRuntime;
  #feedback = '探索 A 区，向右前往 B 区的观景层。';
  #lastError: string | null = null;

  constructor(context: FirstLevelRuntimeContext) {
    this.runtimeInstanceId = context.bus.runtimeInstanceId;
    this.#progress = context.progress;
    const provider = { generate: () => context.bus.runtimeInstanceId };
    this.#quest = new PrototypeGoalRouteRuntime(
      context.progress,
      provider,
      {
        eventType: FIRST_LEVEL_EVENT_TYPES[0],
        commandType: 'first-level.progress.accept-quest',
        targetId: 'first-level.progress.quest-target',
        goalId: FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.goalId,
        interactionId: FIRST_LEVEL_INTERACTION_IDS.npc,
        initialMessage: '委托请求等待固定协调阶段处理。',
        successMessage: '委托《把山城夜景寄给远方》已接取并记录一次。',
      },
      context.bus,
    );
    this.#lift = new PrototypeGoalRouteRuntime(
      context.progress,
      provider,
      {
        eventType: FIRST_LEVEL_EVENT_TYPES[1],
        commandType: 'first-level.progress.unlock-lift-route',
        targetId: 'first-level.progress.lift-target',
        goalId: FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
        interactionId: FIRST_LEVEL_INTERACTION_IDS.leverLeft,
        initialMessage: '吊臂请求等待固定协调阶段处理。',
        successMessage: '左侧吊臂已接线；升降平台启动，D 区路线开放。',
      },
      context.bus,
    );
    this.#completion = new PrototypeGoalRouteRuntime(
      context.progress,
      provider,
      {
        eventType: FIRST_LEVEL_EVENT_TYPES[2],
        commandType: 'first-level.progress.complete-postcard',
        targetId: 'first-level.progress.completion-target',
        goalId: FIRST_LEVEL_PROGRESS_CONTENT.completed.goalId,
        interactionId: FIRST_LEVEL_INTERACTION_IDS.photo,
        initialMessage: '拍摄与分享请求等待固定协调阶段处理。',
        successMessage: '首关完成：夜景照片已在游戏内完成拍摄与分享。',
      },
      context.bus,
    );
    if (this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.completed.goalId,
    )) {
      this.#feedback = '首关已完成；运行身份和全部永久记录保持不变。';
    }
  }

  activate(actionId: string | undefined): string | undefined {
    try {
      switch (actionId) {
        case FIRST_LEVEL_ACTIONS.talkToNpc: {
          const result = this.#quest.requestGoal();
          this.#feedback = result.status === 'created'
            ? '对话结束，委托请求已提交；接受后当前目标会自动更新。'
            : result.feedback;
          return this.#feedback;
        }
        case FIRST_LEVEL_ACTIONS.operateRightLever:
          this.#feedback =
            '右侧吊臂没有接上线索中的灯带；没有永久惩罚，可以改试左侧。';
          return this.#feedback;
        case FIRST_LEVEL_ACTIONS.operateLeftLever: {
          const result = this.#lift.requestGoal();
          this.#feedback = result.status === 'created'
            ? '左侧吊臂请求已提交；平台将在事务完成后真实启动。'
            : result.feedback;
          return this.#feedback;
        }
        case FIRST_LEVEL_ACTIONS.finishPhoto:
          return this.#requestCompletion();
        default:
          return undefined;
      }
    } catch (error) {
      this.#lastError = error instanceof Error ? error.message : String(error);
      this.#feedback = `首关流程错误：${this.#lastError}`;
      return this.#feedback;
    }
  }

  afterDispatch(
    simulationTick: number,
    dispatch: ReturnType<BusinessRuntimeBus['dispatch']>,
  ): void {
    for (const flow of [this.#quest, this.#lift, this.#completion]) {
      flow.afterDispatch(simulationTick, dispatch);
    }
    if (this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.goalId,
    ) && !this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
    )) {
      this.#feedback = '委托已接取。观察 B 区唯一线索，再前往 C 区操作吊臂。';
    }
    if (this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
    ) && !this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.completed.goalId,
    )) {
      this.#feedback = '路线已开放。乘真实升降平台前往 D 区观景点。';
    }
    if (this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.completed.goalId,
    )) {
      this.#feedback = '《把山城夜景寄给远方》完成；世界效果已稳定。';
    }
  }

  get snapshot(): FirstLevelRuntimeSnapshot {
    const questAccepted = this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.goalId,
    );
    const routeUnlocked = this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
    );
    const completed = this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.completed.goalId,
    );
    const phase = this.#phase(questAccepted, routeUnlocked, completed);
    return Object.freeze({
      runtimeInstanceId: this.runtimeInstanceId,
      phase,
      objective: objectiveFor(phase),
      feedback: this.#feedback,
      completionVisible: completed,
      questAccepted,
      routeUnlocked,
      completed,
      actions: Object.freeze([
        Object.freeze({ action: 'quest' as const, flow: this.#quest.snapshot }),
        Object.freeze({ action: 'lift' as const, flow: this.#lift.snapshot }),
        Object.freeze({
          action: 'complete' as const,
          flow: this.#completion.snapshot,
        }),
      ]),
      lastError: this.#lastError,
    });
  }

  #requestCompletion(): string {
    const quest = this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.goalId,
    );
    const route = this.#progress.verifyGoal(
      FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
    );
    if (!quest || !route) {
      this.#feedback = !quest
        ? '还不能拍摄：尚未主动接取 B 区游客的委托。'
        : '还不能拍摄：C 区路线尚未开放。';
      return this.#feedback;
    }
    const result = this.#completion.requestGoal();
    this.#feedback = result.status === 'created'
      ? '拍摄与分享请求已提交；全部业务记录成功后才显示通关反馈。'
      : result.feedback;
    return this.#feedback;
  }

  #phase(
    questAccepted: boolean,
    routeUnlocked: boolean,
    completed: boolean,
  ): FirstLevelPhase {
    if (completed) return 'completed';
    if (this.#completion.snapshot.phase !== 'idle') {
      return this.#completion.snapshot.phase === 'blocked'
        ? 'blocked'
        : 'completion-in-progress';
    }
    if (routeUnlocked) return 'route-open';
    if (this.#lift.snapshot.phase !== 'idle') {
      return this.#lift.snapshot.phase === 'blocked'
        ? 'blocked'
        : 'lift-in-progress';
    }
    if (questAccepted) return 'quest-accepted';
    if (this.#quest.snapshot.phase !== 'idle') {
      return this.#quest.snapshot.phase === 'blocked'
        ? 'blocked'
        : 'quest-in-progress';
    }
    return 'intro';
  }
}

function objectiveFor(phase: FirstLevelPhase): string {
  switch (phase) {
    case 'intro':
      return 'A：练习移动与跳跃，向右前往 B 区观景层。';
    case 'quest-in-progress':
      return 'B：正在登记游客委托……';
    case 'quest-accepted':
      return 'C：对照山势灯带，试运行同一吊臂装置。';
    case 'lift-in-progress':
      return 'C：平台启动中，等待路线开放。';
    case 'route-open':
      return 'C → D：乘升降平台抵达观景点并主动拍摄分享。';
    case 'completion-in-progress':
      return 'D：正在模拟拍摄与分享……';
    case 'completed':
      return '首关完成：夜景已寄给远方。';
    case 'blocked':
      return '当前步骤未能完成；观察场景线索后可重试。';
  }
}
