import Phaser from 'phaser';
import {
  createGrayboxCore,
  type GrayboxCore,
} from '../../core/graybox.ts';
import {
  FIRST_LEVEL_EVENT_TYPES,
  FIRST_LEVEL_INTERACTIONS,
  FirstLevelRuntime,
  type FirstLevelRuntimeSnapshot,
} from '../../core/first-level.ts';
import { PROJECT_IDENTITY } from '../../core/game.ts';
import { PLAYER_PROTOTYPE } from '../../core/player.ts';
import type { RuntimeUuidProvider } from '../../core/events.ts';
import {
  FIRST_LEVEL_ROUTE_GATE,
  FIRST_LEVEL_SIZE,
  FirstLevelMatterWorld,
  type FirstLevelMatterDiagnostics,
} from '../../physics/matter/first-level-world.ts';
import type { MatterLibrary } from '../../physics/matter/graybox-world.ts';

export function mountFirstLevelScene(
  parent: HTMLElement,
  platform: string,
  now: () => number,
  uuidProvider: RuntimeUuidProvider,
  created: (core: GrayboxCore) => void,
  sampled: (diagnostics?: FirstLevelMatterDiagnostics) => void,
): Promise<{ destroy: () => Promise<void> }> {
  parent.setAttribute(
    'aria-label',
    `${PROJECT_IDENTITY.title} · ${PROJECT_IDENTITY.subtitle} · 首关 A–D`,
  );
  return new Promise(resolve => {
    new Phaser.Game({
      parent,
      type: Phaser.CANVAS,
      width: 1000,
      height: 580,
      banner: false,
      autoFocus: false,
      backgroundColor: '#172832',
      audio: { noAudio: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'matter',
        matter: { autoUpdate: false, enableSleeping: false },
      },
      scene: {
        create(this: Phaser.Scene) {
          const matter = (
            Phaser.Physics.Matter as unknown as { Matter: MatterLibrary }
          ).Matter;
          const world = new FirstLevelMatterWorld(
            matter,
            this.matter.world.engine,
            dt => this.matter.world.step(dt),
          );
          const core = createGrayboxCore(world, {
            uuidProvider,
            extraEventTypes: FIRST_LEVEL_EVENT_TYPES,
            interactionObjects: FIRST_LEVEL_INTERACTIONS,
            createGameplayRuntime: context =>
              new FirstLevelRuntime(context),
          });
          created(core);

          const backdrop = this.add.graphics();
          for (let index = 0; index < 12; index++) {
            const x = 50 + index * 175;
            const height = 125 + (index % 5) * 34;
            backdrop.fillStyle(index % 2 === 0 ? 0x1d3440 : 0x203b44, 0.8);
            backdrop.fillRect(x, 500 - height, 120, height);
            backdrop.fillStyle(0xe7b45f, 0.28);
            for (let row = 0; row < 4; row++) {
              backdrop.fillRect(x + 15 + (row % 2) * 34, 515 - height + row * 26, 10, 13);
            }
          }
          backdrop.fillStyle(0x0f1e27, 0.92);
          backdrop.fillRect(0, 520, 1000, 60);

          const terrain = this.add.graphics();
          for (const body of world.terrain) {
            if (body.label === FIRST_LEVEL_ROUTE_GATE.label) continue;
            terrain.fillStyle(
              body.label.includes('ground') || body.label.endsWith('step')
                ? 0x526b73
                : 0x374c55,
            );
            terrain.fillPoints(body.vertices ?? [], true);
            terrain.lineStyle(2, 0x91adb1);
            terrain.strokePoints(body.vertices ?? [], true);
          }

          const label = (x: number, y: number, text: string, color = '#f5eddb') =>
            this.add.text(x, y, text, {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '18px',
              color,
              backgroundColor: '#152a34',
              padding: { x: 7, y: 4 },
            });
          label(35, 545, 'A · 街巷起点');
          label(535, 427, 'B · 观景层');
          label(1005, 545, 'C · 吊臂与升降通路');
          label(1670, 225, 'D · 拍摄观景点');

          const lift = this.add.rectangle(
            1460,
            549,
            100,
            18,
            0xc77d4d,
          ).setStrokeStyle(3, 0xffc087);
          const gate = this.add.rectangle(
            FIRST_LEVEL_ROUTE_GATE.x,
            FIRST_LEVEL_ROUTE_GATE.y,
            FIRST_LEVEL_ROUTE_GATE.width,
            FIRST_LEVEL_ROUTE_GATE.height,
            0x9b5058,
          ).setStrokeStyle(3, 0xf3c4c7);
          const gateText = this.add.text(1480, 115, 'D 路线关闭', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '14px',
            color: '#ffc3c7',
            backgroundColor: '#3d2529',
            padding: { x: 6, y: 3 },
          });

          const interactionColors = new Map([
            ['first-level-a-tutorial', 0x58b6c8],
            ['first-level-b-npc', 0xf1c15f],
            ['first-level-b-clue', 0xa88cdb],
            ['first-level-c-lever-left', 0x6fc38a],
            ['first-level-c-lever-right', 0xd47775],
            ['first-level-d-photo', 0x6fc7c0],
          ]);
          const interactionVisuals = new Map(
            FIRST_LEVEL_INTERACTIONS.map(object => {
              const color =
                interactionColors.get(object.id) ?? 0xe8cf83;
              const range = this.add.ellipse(
                object.x,
                object.y,
                object.rangeX * 2,
                object.rangeY * 2,
                color,
                0.035,
              ).setStrokeStyle(1, color, 0.45);
              const marker = this.add.circle(object.x, object.y, 13, color, 0.92)
                .setStrokeStyle(2, 0xf7f0df);
              const text = this.add.text(
                object.x - 35,
                object.y - 47,
                object.label,
                {
                  fontFamily: 'Microsoft YaHei, sans-serif',
                  fontSize: '13px',
                  color: '#f8f1e4',
                  backgroundColor: '#152a34',
                  padding: { x: 4, y: 2 },
                },
              );
              return [object.id, { range, marker, text, color }];
            }),
          );

          const objective = this.add.text(18, 18, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '17px',
            color: '#fff3d3',
            backgroundColor: '#1c3743',
            padding: { x: 10, y: 7 },
            wordWrap: { width: 720, useAdvancedWrap: true },
          }).setScrollFactor(0).setDepth(30);
          const status = this.add.text(980, 18, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '13px',
            color: '#dceef0',
            backgroundColor: '#172b34',
            padding: { x: 8, y: 6 },
            align: 'right',
          }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);
          const controls = this.add.text(
            18,
            530,
            'A/D 或 ←/→ 移动 · Space 跳跃 · E 主动交互 · Escape 关闭 · R 调试重置',
            {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '14px',
              color: '#e8f2f2',
              backgroundColor: '#13252e',
              padding: { x: 9, y: 6 },
            },
          ).setScrollFactor(0).setDepth(30);
          const prompt = this.add.text(500, 548, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '18px',
            color: '#fff4cd',
            backgroundColor: '#294b54',
            padding: { x: 11, y: 6 },
          }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(40).setVisible(false);
          const feedback = this.add.text(500, 486, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '16px',
            color: '#183128',
            backgroundColor: '#c7e6b8',
            padding: { x: 11, y: 7 },
            wordWrap: { width: 760, useAdvancedWrap: true },
            align: 'center',
          }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(40).setVisible(false);
          const dialogPanel = this.add.rectangle(
            510,
            105,
            920,
            166,
            0x152832,
            0.98,
          ).setStrokeStyle(3, 0xc4a5e4).setScrollFactor(0).setDepth(45)
            .setVisible(false);
          const dialogTitle = this.add.text(72, 40, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '20px',
            color: '#fff3d7',
          }).setScrollFactor(0).setDepth(46).setVisible(false);
          const dialogContent = this.add.text(72, 76, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '16px',
            color: '#e1edf0',
            wordWrap: { width: 820, useAdvancedWrap: true },
          }).setScrollFactor(0).setDepth(46).setVisible(false);
          const close = this.add.text(935, 166, '[ Escape 关闭 ]', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '14px',
            color: '#fff2c9',
            backgroundColor: '#3b4d58',
            padding: { x: 8, y: 4 },
          }).setOrigin(1, 0).setScrollFactor(0).setDepth(46)
            .setVisible(false)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => core.closeInteraction());
          const completion = this.add.container(500, 250).setScrollFactor(0)
            .setDepth(80).setVisible(false);
          const completionCard = this.add.rectangle(
            0,
            0,
            660,
            230,
            0x17352f,
            0.98,
          ).setStrokeStyle(4, 0x8fd7b4);
          const completionTitle = this.add.text(0, -62, '首关完成', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '30px',
            color: '#e1ffed',
          }).setOrigin(0.5);
          const completionText = this.add.text(
            0,
            6,
            '《把山城夜景寄给远方》\n夜景已拍摄并在游戏内分享给远方。\n按 R 可重置临时世界，完成记录仍会保留。',
            {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '18px',
              color: '#d6f0df',
              align: 'center',
              lineSpacing: 8,
            },
          ).setOrigin(0.5);
          completion.add([completionCard, completionTitle, completionText]);

          const failureZone = this.add.rectangle(
            world.failureZone.x,
            world.failureZone.y,
            world.failureZone.width,
            world.failureZone.height,
            0xc55252,
            0.1,
          ).setStrokeStyle(1, 0xd77979, 0.5);
          const player = this.add.rectangle(
            world.state.x,
            world.state.y,
            PLAYER_PROTOTYPE.width,
            PLAYER_PROTOTYPE.height,
            0xf0bd71,
          ).setStrokeStyle(2, 0xffe6b6);
          const foot = this.add.rectangle(
            world.state.x,
            world.state.y + 23,
            22,
            8,
          ).setStrokeStyle(1, 0x84e1be);
          const camera = this.cameras.main;
          camera.setBounds(0, 0, FIRST_LEVEL_SIZE.width, FIRST_LEVEL_SIZE.height);
          camera.startFollow(player, true, 0.12, 0.12);
          const fade = this.add.rectangle(
            500,
            290,
            1000,
            580,
            0x101416,
            1,
          ).setScrollFactor(0).setDepth(100).setVisible(false);

          this.events.on(Phaser.Scenes.Events.UPDATE, () => {
            core.frame(now());
            const snapshot = core.snapshot;
            const state = snapshot.player;
            const interaction = snapshot.interaction;
            const firstLevel =
              snapshot.gameplay as FirstLevelRuntimeSnapshot | null;
            const recovery = snapshot.recovery;
            lift.setPosition(world.liftBody.position.x, world.liftBody.position.y)
              .setFillStyle(world.routeOpen ? 0x63b984 : 0x8c6d63);
            gate.setFillStyle(world.routeOpen ? 0x417f62 : 0x9b5058)
              .setStrokeStyle(3, world.routeOpen ? 0x9ee3bd : 0xf3c4c7)
              .setVisible(!world.routeOpen);
            gateText.setText(world.routeOpen ? 'D 路线开放' : 'D 路线关闭')
              .setColor(world.routeOpen ? '#baf0ce' : '#ffc3c7')
              .setBackgroundColor(world.routeOpen ? '#1d3c2d' : '#3d2529');
            player.setPosition(state.x, state.y)
              .setFillStyle(state.controlAllowed ? 0xf0bd71 : 0x9ca8ad);
            foot.setPosition(state.x, state.y + PLAYER_PROTOTYPE.height / 2 + 1)
              .setStrokeStyle(1, state.grounded ? 0x84e1be : 0xe17979);
            failureZone.setFillStyle(
              0xc55252,
              world.failureZone.occupied ? 0.22 : 0.1,
            );
            fade.setAlpha(recovery.fadeAlpha).setVisible(recovery.fadeAlpha > 0.001);
            objective.setText(firstLevel?.objective ?? '首关状态加载中');
            status.setText(
              `委托 ${firstLevel?.questAccepted ? '✓' : '—'}\n` +
              `路线 ${world.routeOpen ? 'OPEN' : 'CLOSED'}\n` +
              `完成 ${firstLevel?.completed ? '✓' : '—'}\n` +
              `Tick ${snapshot.tick} · ${snapshot.paused ? 'PAUSED' : 'RUNNING'}\n` +
              `D12-A1 · ${platform}`,
            );
            prompt.setText(interaction.prompt ?? '')
              .setVisible(Boolean(interaction.prompt));
            feedback.setText(
              interaction.feedbackText ??
              firstLevel?.feedback ??
              '',
            ).setVisible(Boolean(
              interaction.feedbackText ||
              firstLevel?.feedback && firstLevel.phase !== 'completed',
            ));
            const dialogOpen = interaction.mode === 'investigation';
            dialogPanel.setVisible(dialogOpen);
            dialogTitle.setText(interaction.title ?? '').setVisible(dialogOpen);
            dialogContent.setText(interaction.content ?? '').setVisible(dialogOpen);
            close.setVisible(dialogOpen);
            completion.setVisible(Boolean(firstLevel?.completionVisible));
            for (const object of FIRST_LEVEL_INTERACTIONS) {
              const visual = interactionVisuals.get(object.id);
              if (!visual) continue;
              const selectedId =
                interaction.activeId ?? interaction.selectedId;
              const selected = selectedId === object.id;
              visual.range
                .setStrokeStyle(selected ? 3 : 1, visual.color, selected ? 0.9 : 0.45)
                .setFillStyle(visual.color, selected ? 0.1 : 0.035);
              visual.marker.setScale(selected ? 1.3 : 1);
            }
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
