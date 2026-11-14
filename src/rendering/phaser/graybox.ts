import Phaser from 'phaser';
import { PROJECT_IDENTITY } from '../../core/game';
import { createGrayboxCore, type GrayboxCore } from '../../core/graybox.ts';
import { INTERACTION_OBJECTS } from '../../core/interaction.ts';
import { PLAYER_PROTOTYPE } from '../../core/player.ts';
import { PROTOTYPE_PROGRESS_CONTENT } from '../../core/progress.ts';
import type { RuntimeUuidProvider } from '../../core/events.ts';
import { GRAYBOX_CHECKPOINT_TRIGGERS } from '../../core/checkpoint-triggers.ts';
import {
  MatterGrayboxWorld, ONE_WAY_PLATFORM, PROGRESS_TEST_ROUTE_GATE,
  type MatterGrayboxDiagnostics, type MatterLibrary,
} from '../../physics/matter/graybox-world';

export function mountGrayboxScene(parent: HTMLElement, platform: string, now: () => number,
  uuidProvider: RuntimeUuidProvider,
  created: (core: GrayboxCore) => void,
  sampled: (diagnostics?: MatterGrayboxDiagnostics) => void): Promise<{ destroy: () => Promise<void> }> {
  parent.setAttribute('aria-label', `${PROJECT_IDENTITY.title} · ${PROJECT_IDENTITY.subtitle} · 可操作物理灰盒`);
  return new Promise(resolve => {
    new Phaser.Game({
      parent, type: Phaser.CANVAS, width: 1000, height: 580, banner: false, autoFocus: false,
      backgroundColor: '#152632', audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'matter', matter: { autoUpdate: false, enableSleeping: false } },
      scene: {
        create(this: Phaser.Scene) {
          const matter = (Phaser.Physics.Matter as unknown as { Matter: MatterLibrary }).Matter;
          const world = new MatterGrayboxWorld(matter, this.matter.world.engine, dt => this.matter.world.step(dt));
          const core = createGrayboxCore(world, { uuidProvider });
          created(core);
          const terrain = this.add.graphics();
          for (const body of world.terrain) {
            const oneWay = body.label === ONE_WAY_PLATFORM.label;
            const progressGate = body.label === PROGRESS_TEST_ROUTE_GATE.label;
            if (progressGate) continue;
            terrain.fillStyle(oneWay ? 0x6c5a91
              : body.label === 'continuous-slope' ? 0x54866e : 0x526879);
            terrain.fillPoints(body.vertices ?? [], true);
            terrain.lineStyle(oneWay ? 3 : 2, oneWay ? 0xd9b8ff : 0x91acba);
            terrain.strokePoints(body.vertices ?? [], true);
          }
          const label = (x: number, y: number, text: string) => this.add.text(x, y, text, {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px', color: '#e2edf2',
          });
          label(200, 365, '低天花板');
          label(480, 370, '墙壁');
          label(690, 360, '实体平台：上下均阻挡');
          label(1005, 382, '单向平台：下方跳穿 ↑');
          label(887, 520, '间隙 · R 重置');
          label(1350, 350, '连续坡面');
          label(1618, 266, '水平移动平台 ↔');
          label(1848, 190, '垂直升降平台 ↕');
          label(560, 207, 'D09-D1 测试路线门');
          const progressGateVisual = this.add.rectangle(
            PROGRESS_TEST_ROUTE_GATE.x,
            PROGRESS_TEST_ROUTE_GATE.y,
            PROGRESS_TEST_ROUTE_GATE.width,
            PROGRESS_TEST_ROUTE_GATE.height,
            0x9a4f54,
          ).setStrokeStyle(3, 0xf0d2d4);
          const progressGateState = this.add.text(560, 230, 'CLOSED', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px',
            color: '#ffb3b8', backgroundColor: '#3a2428', padding: { x: 5, y: 3 },
          });
          const zoneVisuals = new Map(world.diagnostics.diagnosticZones.map((zone, index) => {
            const color = index === 0 ? 0x4fc3f7 : 0xf06292;
            const rectangle = this.add.rectangle(
              zone.x, zone.y, zone.width, zone.height, color, 0.06,
            ).setStrokeStyle(2, color);
            const text = this.add.text(
              zone.x - zone.width / 2 + 5, zone.y - zone.height / 2 + 4 + index * 18,
              `${zone.label}\nOFF E0 X0`,
              { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', color: '#eef8fb' },
            );
            return [zone.label, { rectangle, text, color }];
          }));
          const checkpointTriggerVisuals = new Map(
            GRAYBOX_CHECKPOINT_TRIGGERS.map((trigger, index) => {
              const color = index === 0 ? 0xf0bd71 : 0x56c7a5;
              const rectangle = this.add.rectangle(
                trigger.x,
                trigger.y,
                trigger.width,
                trigger.height,
                color,
                0.08,
              ).setStrokeStyle(2, color);
              const text = this.add.text(
                trigger.x - trigger.width / 2 + 5,
                trigger.y - trigger.height / 2 + 4,
                `${trigger.label} · P${trigger.priority}`,
                {
                  fontFamily: 'Microsoft YaHei, sans-serif',
                  fontSize: '13px',
                  color: '#fff4d6',
                  backgroundColor: '#3a3428',
                  padding: { x: 4, y: 2 },
                },
              );
              return [trigger.triggerId, { rectangle, text, color }];
            }),
          );
          const movingVisuals = new Map(world.movingPlatforms.map(platformState => {
            const horizontal = platformState.axis === 'horizontal';
            return [platformState.label, this.add.rectangle(
              platformState.x, platformState.y, platformState.width, platformState.height,
              horizontal ? 0xc77d4d : 0x4c9fa0,
            ).setStrokeStyle(3, horizontal ? 0xffc087 : 0x91efea)];
          }));
          const interactionColors = [0x51b8d4, 0xb888de, 0x8bc56e];
          const interactionVisuals = new Map(INTERACTION_OBJECTS.map((object, index) => {
            const color = interactionColors[index] ?? 0xf0bd71;
            const range = this.add.ellipse(
              object.x, object.y, object.rangeX * 2, object.rangeY * 2, color, 0.035,
            ).setStrokeStyle(1, color, 0.45);
            const marker = this.add.circle(object.x, object.y, 13, color, 0.9)
              .setStrokeStyle(2, 0xf4eddc);
            const text = this.add.text(object.x - 27, object.y - 43,
              `${object.kind === 'pickup' ? '拾取' : '调查'} ${object.label}`, {
              fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px',
              color: '#f4eddc', backgroundColor: '#152632', padding: { x: 4, y: 2 },
            });
            return [object.id, { range, marker, text, color }];
          }));
          const interactionPrompt = this.add.text(500, 535, '', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '18px', color: '#fff1c8',
            backgroundColor: '#203c49', padding: { x: 12, y: 6 },
          }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30).setVisible(false);
          const feedback = this.add.text(500, 500, '', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '18px', color: '#20301e',
            backgroundColor: '#b9df98', padding: { x: 12, y: 7 },
          }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setVisible(false);
          const progressHud = this.add.text(980, 16, '', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', color: '#dff3ec',
            backgroundColor: '#142b2d', padding: { x: 8, y: 6 }, align: 'right',
            wordWrap: { width: 390, useAdvancedWrap: true },
          }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);
          const checkpointFailure = this.add.text(20, 170, '', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '17px', color: '#ffd4d4',
            backgroundColor: '#4a2025', padding: { x: 10, y: 7 },
            wordWrap: { width: 720, useAdvancedWrap: true },
          }).setScrollFactor(0).setDepth(50).setVisible(false);
          const checkpointTriggerHud = this.add.text(20, 220, '', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#fff4d6',
            backgroundColor: '#26372f', padding: { x: 9, y: 7 },
            wordWrap: { width: 620, useAdvancedWrap: true },
          }).setScrollFactor(0).setDepth(24);
          const interactionPanel = this.add.rectangle(760, 126, 420, 190, 0x172832, 0.97)
            .setStrokeStyle(4, 0xb888de).setScrollFactor(0).setDepth(40).setVisible(false);
          const interactionTitle = this.add.text(570, 52, '', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '21px', color: '#f4eddc',
          }).setScrollFactor(0).setDepth(41).setVisible(false);
          const interactionContent = this.add.text(570, 88, '', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '16px', color: '#d8e6ec',
            wordWrap: { width: 380, useAdvancedWrap: true },
          }).setScrollFactor(0).setDepth(41).setVisible(false);
          const closeInteraction = this.add.text(876, 185, '[ 关闭　Escape ]', {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px', color: '#fff1c8',
            backgroundColor: '#3b4d58', padding: { x: 10, y: 6 },
          }).setOrigin(1, 0).setScrollFactor(0).setDepth(42).setVisible(false)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => core.closeInteraction());
          const player = this.add.rectangle(80, 472, PLAYER_PROTOTYPE.width, PLAYER_PROTOTYPE.height, 0xf0bd71)
            .setStrokeStyle(2, 0xffe6b6);
          const foot = this.add.rectangle(80, 495, 22, 8).setStrokeStyle(1, 0x84e1be);
          const camera = this.cameras.main;
          camera.setBounds(0, 0, 2000, 680);
          camera.startFollow(player, true, 0.15, 0.15);
          this.add.text(20, 16, `${PROJECT_IDENTITY.title} · ${PROJECT_IDENTITY.subtitle}\nM1.2.2 物理灰盒  /  ${platform}\nA/D 或 ←/→ 移动 · Space 跳跃（短按低跳／长按高跳）\n调查 A／B：E 打开；丢弃 C：E 只显示短反馈\nD08 / D09-D1：E 收藏 D；目标 E 经 Event→Command→Transaction→Result 后开门\nD10-A3：开门后走入金／绿检查点 A/B；低 priority 胜出，离开再进入才重试\nR 重置临时世界但保留本次运行身份、进度、有效检查点和已开放路线\n蓝／粉区域、橙／青平台、金／绿检查点和测试路线门：只作灰盒验证\nR /「重置灰盒」回到出生点 · 失焦恢复后先松开按键再按\nMatter 优先验证中；非最终物理方案。所有数值为原型。`, {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '17px', color: '#f4eddc',
            backgroundColor: '#152632', padding: { x: 8, y: 6 },
            wordWrap: { width: 830, useAdvancedWrap: true },
          }).setScrollFactor(0).setDepth(5);
          this.events.on(Phaser.Scenes.Events.UPDATE, () => {
            core.frame(now());
            const snapshot = core.snapshot;
            const state = snapshot.player;
            const interaction = snapshot.interaction;
            const progress = snapshot.progress;
            const goalRoute = snapshot.goalRoute;
            const checkpointSnapshot = snapshot.checkpointSnapshot;
            const checkpointTriggers = snapshot.checkpointTriggers;
            for (const platformState of world.movingPlatforms) {
              movingVisuals.get(platformState.label)?.setPosition(platformState.x, platformState.y);
            }
            for (const zone of world.diagnostics.diagnosticZones) {
              const visual = zoneVisuals.get(zone.label);
              visual?.rectangle.setFillStyle(visual.color, zone.occupied ? 0.18 : 0.06);
              visual?.rectangle.setStrokeStyle(zone.occupied ? 4 : 2, visual.color);
              visual?.text.setText(
                `${zone.label}\n${zone.occupied ? 'ON' : 'OFF'} E${zone.enterCount} X${zone.exitCount} ` +
                `${zone.occupied ? zone.occupiedSteps : zone.lastOccupiedSteps}t`,
              );
            }
            for (const trigger of checkpointTriggers.zones) {
              const visual = checkpointTriggerVisuals.get(trigger.triggerId);
              if (!visual) continue;
              visual.rectangle
                .setFillStyle(visual.color, trigger.occupied ? 0.2 : 0.08)
                .setStrokeStyle(trigger.occupied ? 4 : 2, visual.color);
              visual.text.setText(
                `${trigger.label} · P${trigger.priority} · ` +
                `${checkpointTriggers.enabled ? (trigger.occupied ? 'ON' : 'READY') : 'LOCKED'}\n` +
                `E${trigger.enterCount} X${trigger.exitCount} ` +
                `${trigger.lastDecision ?? '-'}`,
              );
            }
            player.setPosition(state.x, state.y);
            player.setFillStyle(state.controlAllowed ? 0xf0bd71 : 0xa5adb3);
            foot.setPosition(state.x, state.y + PLAYER_PROTOTYPE.height / 2 + 1);
            foot.setStrokeStyle(1, state.grounded ? 0x84e1be : 0xec7878);
            progressGateState.setText(world.progressRouteOpen ? 'OPEN' : 'CLOSED')
              .setColor(world.progressRouteOpen ? '#b8efc8' : '#ffb3b8')
              .setBackgroundColor(world.progressRouteOpen ? '#1d3c2d' : '#3a2428');
            progressGateVisual
              .setFillStyle(world.progressRouteOpen ? 0x4f9b68 : 0x9a4f54)
              .setStrokeStyle(3, world.progressRouteOpen ? 0xb8efc8 : 0xf0d2d4);
            for (const object of INTERACTION_OBJECTS) {
              const visual = interactionVisuals.get(object.id);
              if (!visual) continue;
              const selected = interaction.selectedId === object.id;
              const completed = object.progress?.category === 'collection'
                ? progress.collections.includes(object.progress.id)
                : object.progress?.category === 'goal'
                  ? progress.goals.includes(object.progress.id)
                  : false;
              visual.range.setStrokeStyle(selected ? 3 : 1, visual.color, selected ? 0.9 : 0.45);
              visual.range.setFillStyle(visual.color, selected ? 0.1 : 0.035);
              visual.marker.setScale(selected ? 1.25 : 1)
                .setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : 0xf4eddc);
              visual.marker.setFillStyle(completed ? 0x74c886 : visual.color, 0.9);
              const kindLabel = object.kind === 'pickup' ? '拾取'
                : object.kind === 'collection' ? '收藏'
                  : object.kind === 'goal' ? '目标' : '调查';
              visual.text.setText(`${kindLabel} ${object.label}${completed ? ' ✓' : ''}`);
            }
            interactionPrompt.setText(interaction.prompt ?? '').setVisible(Boolean(interaction.prompt));
            feedback.setText(interaction.feedbackText ?? '').setVisible(interaction.mode === 'feedback');
            const investigationOpen = interaction.mode === 'investigation';
            progressHud.setText(
              `D10-A1 初始快照 ${checkpointSnapshot.status}` +
              ` · schema ${checkpointSnapshot.current?.schemaVersion ?? '-'}` +
              ` · ${checkpointSnapshot.current?.objects.length ?? 0} objects` +
              ` · ${checkpointSnapshot.captureAttempts} capture\n` +
              `D08 / D09-D1 运行进度\n` +
              `收藏 ${PROTOTYPE_PROGRESS_CONTENT.collection.label} ${progress.counts.collections}/1  ` +
              `目标 ${PROTOTYPE_PROGRESS_CONTENT.goal.label} ${progress.counts.goals}/1\n` +
              `奖励 ${progress.counts.rewards}/1  ` +
              `效果 ${world.progressRouteOpen ? 'OPEN' : 'CLOSED'}\n` +
              `E 链路 ${goalRoute.phase.toUpperCase()}\n` +
              `E${goalRoute.eventId ?? '-'} · C${goalRoute.commandId ?? '-'} · ` +
              `T${goalRoute.transactionId ?? '-'} · R${goalRoute.resultEventId ?? '-'}\n` +
              `Accept ${goalRoute.acceptedTick ?? '-'} · Apply ${goalRoute.applyTick ?? '-'} · ` +
              `Verify ${goalRoute.verifyTick ?? '-'} · Consume ${goalRoute.resultConsumedTick ?? '-'}\n` +
              goalRoute.message,
            ).setVisible(!investigationOpen);
            checkpointFailure
              .setText(checkpointSnapshot.status === 'FAILED'
                ? `快照初始化失败／探索未开放：${checkpointSnapshot.error ?? 'unknown error'}`
                : '')
              .setVisible(checkpointSnapshot.status === 'FAILED');
            const arbitration = checkpointTriggers.lastArbitration;
            const capture = snapshot.checkpointCapture;
            checkpointTriggerHud
              .setText(
                `D10-A3 检查点触发 · ${checkpointTriggers.feedbackKind.toUpperCase()}\n` +
                `当前 ${checkpointTriggers.currentCheckpointId ?? '-'}` +
                ` · 候选 ${checkpointTriggers.candidateCheckpointId ?? '-'}\n` +
                `${checkpointTriggers.feedback}\n` +
                `批次 #${checkpointTriggers.batchCount} @${checkpointTriggers.batchTick ?? '-'}` +
                ` · 关闭 ${checkpointTriggers.closedTick ?? '-'}` +
                ` · 仲裁 ${checkpointTriggers.arbitrationTick ?? '-'}\n` +
                `Entry E${checkpointTriggers.latestEntryEventId ?? '-'}` +
                ` · Capture E${checkpointTriggers.latestCaptureEventId ?? '-'}\n` +
                `Capture ${capture.phase}` +
                ` · C${capture.commandId ?? '-'} T${capture.transactionId ?? '-'}` +
                ` R${capture.resultEventId ?? '-'}` +
                ` · 保存 ${capture.successfulCommits}` +
                ` · lock ${capture.lock.held ? 'HELD' : 'FREE'}` +
                ` · resource ${capture.resourceOwnership.resourcesReleased ? 'RELEASED' : 'HELD'}\n` +
                (arbitration
                  ? `Winner ${arbitration.winnerTriggerId ?? '-'} / ` +
                    `${arbitration.winnerCheckpointId ?? '-'} · ` +
                    arbitration.entrants.map(entry =>
                      `${entry.triggerId}:${entry.decision}@${entry.entryEventId}`).join(' | ')
                  : 'Winner -'),
              )
              .setColor(checkpointTriggers.feedbackKind === 'failed'
                ? '#ffd0d0'
                : checkpointTriggers.feedbackKind === 'saved'
                  ? '#c9f7d7'
                  : '#fff4d6')
              .setVisible(!investigationOpen);
            interactionPanel.setVisible(investigationOpen);
            interactionTitle.setText(interaction.title ?? '').setVisible(investigationOpen);
            interactionContent.setText(interaction.content ?? '').setVisible(investigationOpen);
            closeInteraction.setVisible(investigationOpen);
            sampled(world.diagnostics);
          });
          const game = this.game;
          game.events.once(Phaser.Core.Events.POST_RENDER, () => resolve({
            destroy: () => new Promise<void>(done => {
              game.events.once(Phaser.Core.Events.DESTROY, done);
              game.destroy(true);
            }),
          }));
        },
      },
    });
  });
}
