import Phaser from 'phaser';
import {
  createGrayboxCore,
  type GrayboxCore,
} from '../../core/graybox.ts';
import {
  FIRST_LEVEL_EVENT_TYPES,
  FIRST_LEVEL_INTERACTIONS,
  FIRST_LEVEL_SPATIAL_CONFIG,
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
  debugVisible: () => boolean,
): Promise<{ destroy: () => Promise<void> }> {
  parent.setAttribute(
    'aria-label',
    `${PROJECT_IDENTITY.title} · ${PROJECT_IDENTITY.subtitle} · 首关 A–D`,
  );
  parent.dataset.firstLevelTopology =
    FIRST_LEVEL_SPATIAL_CONFIG.topology.join('>');
  parent.dataset.firstLevelLiftValidation =
    FIRST_LEVEL_SPATIAL_CONFIG.lift.validation;
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
          for (let index = 0; index < 18; index++) {
            const x = 20 + index * 116;
            const base = 675 - Math.floor(index / 3) * 46;
            const height = 190 + (index % 5) * 28;
            backdrop.fillStyle(
              index % 2 === 0 ? 0x1a303a : 0x213b44,
              0.72,
            );
            backdrop.fillRect(x, base - height, 92, height);
            backdrop.fillStyle(0xe7b45f, 0.24);
            for (let row = 0; row < 6; row++) {
              backdrop.fillRect(
                x + 14 + (row % 2) * 42,
                base - height + 24 + row * 25,
                10,
                12,
              );
            }
          }
          backdrop.fillStyle(0x0d2833, 0.96);
          backdrop.fillRect(0, 681, 2050, 79);
          backdrop.lineStyle(2, 0x5ba1ae, 0.35);
          for (let x = 20; x < 2050; x += 110) {
            const y = 707 + (x % 3) * 8;
            backdrop.beginPath();
            backdrop.moveTo(x, y);
            backdrop.lineTo(x + 64, y);
            backdrop.strokePath();
          }

          const terrain = this.add.graphics();
          for (const body of world.terrain) {
            if (body.label === FIRST_LEVEL_ROUTE_GATE.label) continue;
            const isDock = body.label === 'd-riverbank';
            const isWood =
              body.label.startsWith('c-') ||
              body.label === 'b-terrace';
            terrain.fillStyle(
              isDock ? 0x5f665f : isWood ? 0x645044 : 0x526b73,
            );
            terrain.fillPoints(body.vertices ?? [], true);
            terrain.lineStyle(2, 0x91adb1);
            terrain.strokePoints(body.vertices ?? [], true);
          }

          const clueLight = this.add.graphics();
          clueLight.lineStyle(7, 0x80d8e8, 0.18);
          clueLight.beginPath();
          clueLight.moveTo(520, 170);
          clueLight.lineTo(790, 218);
          clueLight.lineTo(1135, 315);
          clueLight.strokePath();
          clueLight.lineStyle(3, 0x9deaf2, 0.92);
          clueLight.beginPath();
          clueLight.moveTo(520, 170);
          clueLight.lineTo(790, 218);
          clueLight.lineTo(1135, 315);
          clueLight.strokePath();
          this.add.text(520, 138, 'B 线索 · 灯带沿吊脚楼转向装置左侧', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '14px',
            color: '#c9f7fb',
            backgroundColor: '#17333c',
            padding: { x: 7, y: 4 },
          });

          const label = (x: number, y: number, text: string, color = '#f5eddb') =>
            this.add.text(x, y, text, {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '18px',
              color,
              backgroundColor: '#152a34',
              padding: { x: 7, y: 4 },
            });
          label(35, 260, 'A · 解放碑出生街区');
          label(500, 202, 'B · 沧白路 / 洪崖洞入口');
          label(955, 320, 'C1 · 上层木廊');
          label(1270, 398, 'C2 · 中层街巷');
          label(1395, 476, 'C3 · 下层檐廊');
          label(1685, 586, 'D · 嘉陵江岸');

          const monument = this.add.graphics();
          monument.fillStyle(0xd7d2c5, 0.85);
          monument.fillRect(168, 255, 24, 45);
          monument.fillRect(158, 278, 44, 22);
          monument.fillStyle(0xf3e6ba, 0.9);
          monument.fillTriangle(180, 246, 170, 258, 190, 258);
          this.add.text(76, 220, '解放碑（占位）', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '13px',
            color: '#fff0c7',
            backgroundColor: '#273a40',
            padding: { x: 5, y: 2 },
          });

          const entrance = this.add.graphics();
          entrance.lineStyle(6, 0xa56f4b, 0.9);
          entrance.strokeRect(840, 188, 78, 72);
          entrance.lineBetween(840, 188, 879, 168);
          entrance.lineBetween(879, 168, 918, 188);
          this.add.text(820, 148, '洪崖洞入口', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '13px',
            color: '#ffe4b7',
            backgroundColor: '#402f28',
            padding: { x: 5, y: 2 },
          });

          const layeredFacade = this.add.graphics();
          layeredFacade.lineStyle(5, 0x7c573f, 0.72);
          for (const x of [1020, 1190, 1350, 1510]) {
            layeredFacade.lineBetween(x, 278, x, 560);
          }
          layeredFacade.lineStyle(3, 0xb9855c, 0.58);
          for (const y of [340, 430, 520]) {
            layeredFacade.lineBetween(980, y, 1580, y);
          }

          const lift = this.add.rectangle(
            FIRST_LEVEL_SPATIAL_CONFIG.lift.x,
            FIRST_LEVEL_SPATIAL_CONFIG.lift.fromY,
            FIRST_LEVEL_SPATIAL_CONFIG.lift.width,
            FIRST_LEVEL_SPATIAL_CONFIG.lift.height,
            0xa96f44,
          ).setStrokeStyle(3, 0xe6ae78);
          const liftLabel = this.add.text(
            FIRST_LEVEL_SPATIAL_CONFIG.lift.x,
            FIRST_LEVEL_SPATIAL_CONFIG.lift.fromY - 30,
            'C3 → D 升降辅助通路',
            {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '13px',
              color: '#ffe0bd',
              backgroundColor: '#3d2d25',
              padding: { x: 5, y: 2 },
            },
          ).setOrigin(0.5);
          const gate = this.add.rectangle(
            FIRST_LEVEL_ROUTE_GATE.x,
            FIRST_LEVEL_ROUTE_GATE.y,
            FIRST_LEVEL_ROUTE_GATE.width,
            FIRST_LEVEL_ROUTE_GATE.height,
            0x9b5058,
          ).setStrokeStyle(3, 0xf3c4c7);
          const gateText = this.add.text(
            FIRST_LEVEL_ROUTE_GATE.x - 54,
            FIRST_LEVEL_ROUTE_GATE.y - 66,
            '江岸路线关闭',
            {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '14px',
              color: '#ffc3c7',
              backgroundColor: '#3d2529',
              padding: { x: 6, y: 3 },
            },
          );

          const interactionColors = new Map([
            ['first-level-a-tutorial', 0x58b6c8],
            ['first-level-b-npc', 0xf1c15f],
            ['first-level-b-clue', 0xa88cdb],
            ['first-level-c-lever-left', 0xd4bd75],
            ['first-level-c-lever-right', 0xd4bd75],
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

          const device = this.add.rectangle(
            1185,
            300,
            174,
            76,
            0x3e5058,
            0.96,
          ).setStrokeStyle(3, 0x81979d);
          const deviceStem = this.add.rectangle(1185, 344, 18, 38, 0x5f737a)
            .setStrokeStyle(2, 0x98abb0);
          const deviceBase = this.add.rectangle(1185, 356, 112, 10, 0x2f4149)
            .setStrokeStyle(2, 0x879b9f);
          this.add.text(1185, 258, 'C1 · 单一吊臂控制装置', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '14px',
            color: '#f5e9c7',
            backgroundColor: '#26373f',
            padding: { x: 6, y: 3 },
          }).setOrigin(0.5);

          const npc = this.add.container(650, 238);
          const npcHead = this.add.circle(0, -23, 11, 0xf2c79f)
            .setStrokeStyle(2, 0xffead3);
          const npcHair = this.add.ellipse(0, -32, 22, 10, 0x37414c);
          const npcBody = this.add.rectangle(0, 0, 25, 34, 0x67a9b6)
            .setStrokeStyle(2, 0xb6e5e8);
          const npcLegs = this.add.rectangle(0, 24, 20, 15, 0x394b5b);
          const npcBag = this.add.rectangle(-17, 2, 10, 22, 0xd6a95d);
          npc.add([npcLegs, npcBody, npcHair, npcHead, npcBag]);

          const photoFrame = this.add.rectangle(
            1830,
            598,
            42,
            30,
            0x2f4851,
            0.96,
          ).setStrokeStyle(3, 0x8dd8d4);
          this.add.circle(1830, 598, 9, 0x13232a).setStrokeStyle(2, 0x8dd8d4);
          const photoLabel = this.add.text(1830, 632, 'D · 嘉陵江岸拍摄点', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '13px',
            color: '#d4fbf7',
            backgroundColor: '#203a40',
            padding: { x: 5, y: 2 },
          }).setOrigin(0.5);

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
            552,
            'A/D 或 ←/→ 移动 · Space 跳跃 · E 主动交互 · Escape 关闭 · R 重置临时世界',
            {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '14px',
              color: '#e8f2f2',
              backgroundColor: '#13252e',
              padding: { x: 9, y: 6 },
            },
          ).setScrollFactor(0).setDepth(30);
          const prompt = this.add.text(500, 514, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '18px',
            color: '#fff4cd',
            backgroundColor: '#294b54',
            padding: { x: 11, y: 6 },
          }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(40).setVisible(false);
          const feedback = this.add.text(500, 480, '', {
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
          ).setStrokeStyle(1, 0xd77979, 0.5).setVisible(false);
          const player = this.add.container(world.state.x, world.state.y);
          const playerShadow = this.add.ellipse(0, 24, 32, 8, 0x0b1318, 0.45);
          const playerLegs = this.add.rectangle(0, 16, 18, 16, 0x624f36);
          const playerBody = this.add.rectangle(0, -1, 24, 30, 0xf0bd71)
            .setStrokeStyle(2, 0xffe6b6);
          const playerHead = this.add.circle(0, -23, 11, 0xf2c79f)
            .setStrokeStyle(2, 0xffe6c4);
          const playerHair = this.add.ellipse(0, -31, 22, 9, 0x4b3526);
          player.add([
            playerShadow,
            playerLegs,
            playerBody,
            playerHair,
            playerHead,
          ]);
          const foot = this.add.rectangle(
            world.state.x,
            world.state.y + 23,
            22,
            8,
          ).setStrokeStyle(1, 0x84e1be).setVisible(false);
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

          let observedPhase: FirstLevelRuntimeSnapshot['phase'] | null = null;
          let phaseAnnouncement = '';
          let phaseAnnouncementUntil = 0;
          this.events.on(Phaser.Scenes.Events.UPDATE, () => {
            const frameTime = now();
            core.frame(frameTime);
            const snapshot = core.snapshot;
            const state = snapshot.player;
            const interaction = snapshot.interaction;
            const firstLevel =
              snapshot.gameplay as FirstLevelRuntimeSnapshot | null;
            if (firstLevel && firstLevel.phase !== observedPhase) {
              observedPhase = firstLevel.phase;
              phaseAnnouncement = firstLevel.phase === 'intro'
                ? ''
                : firstLevel.feedback;
              phaseAnnouncementUntil = phaseAnnouncement
                ? frameTime + 2800
                : 0;
            }
            const recovery = snapshot.recovery;
            const showDebug = debugVisible();
            lift.setPosition(world.liftBody.position.x, world.liftBody.position.y)
              .setFillStyle(world.routeOpen ? 0x63b984 : 0xa96f44);
            liftLabel.setPosition(
              world.liftBody.position.x,
              world.liftBody.position.y - 30,
            );
            gate.setFillStyle(world.routeOpen ? 0x417f62 : 0x9b5058)
              .setStrokeStyle(3, world.routeOpen ? 0x9ee3bd : 0xf3c4c7)
              .setVisible(!world.routeOpen);
            gateText.setText(
              world.routeOpen ? '嘉陵江岸路线开放' : '江岸路线关闭',
            )
              .setColor(world.routeOpen ? '#baf0ce' : '#ffc3c7')
              .setBackgroundColor(world.routeOpen ? '#1d3c2d' : '#3d2529');
            player.setPosition(state.x, state.y);
            playerBody.setFillStyle(state.controlAllowed ? 0xf0bd71 : 0x9ca8ad);
            playerHead.setFillStyle(state.controlAllowed ? 0xf2c79f : 0xb5bdc0);
            foot.setPosition(state.x, state.y + PLAYER_PROTOTYPE.height / 2 + 1)
              .setStrokeStyle(1, state.grounded ? 0x84e1be : 0xe17979)
              .setVisible(showDebug);
            failureZone.setFillStyle(
              0xc55252,
              world.failureZone.occupied ? 0.22 : 0.1,
            ).setVisible(showDebug);
            fade.setAlpha(recovery.fadeAlpha).setVisible(recovery.fadeAlpha > 0.001);
            objective.setText(firstLevel?.objective ?? '首关状态加载中');
            status.setText(
              `委托 ${firstLevel?.questAccepted ? '✓' : '—'}\n` +
              `路线 ${world.routeOpen ? 'OPEN' : 'CLOSED'}\n` +
              `完成 ${firstLevel?.completed ? '✓' : '—'}\n` +
              `Tick ${snapshot.tick} · ${snapshot.paused ? 'PAUSED' : 'RUNNING'}\n` +
              `DEBUG · ${platform}`,
            ).setVisible(showDebug);
            prompt.setText(interaction.prompt ?? '')
              .setVisible(Boolean(interaction.prompt) && !firstLevel?.completed);
            const runtimeFailure = firstLevel?.phase === 'blocked'
              ? firstLevel.feedback
              : null;
            feedback.setText(
              (frameTime < phaseAnnouncementUntil ? phaseAnnouncement : null) ??
              interaction.feedbackText ??
              runtimeFailure ??
              '',
            ).setVisible(Boolean(
              frameTime < phaseAnnouncementUntil ||
              interaction.feedbackText ||
              runtimeFailure,
            ));
            const dialogOpen = interaction.mode === 'investigation';
            const activeObject = FIRST_LEVEL_INTERACTIONS.find(
              object => object.id === interaction.activeId,
            );
            dialogPanel.setVisible(dialogOpen);
            dialogTitle.setText(interaction.title ?? '').setVisible(dialogOpen);
            dialogContent.setText(interaction.content ?? '').setVisible(dialogOpen);
            close.setText(activeObject?.activateOnClose
              ? '[ 完成对话 · Escape ]'
              : '[ 关闭 · Escape ]')
              .setVisible(dialogOpen);
            completion.setVisible(Boolean(firstLevel?.completionVisible));
            for (const object of FIRST_LEVEL_INTERACTIONS) {
              const visual = interactionVisuals.get(object.id);
              if (!visual) continue;
              const selectedId =
                interaction.activeId ?? interaction.selectedId;
              const selected = selectedId === object.id;
              visual.range
                .setStrokeStyle(selected ? 3 : 1, visual.color, selected ? 0.9 : 0.45)
                .setFillStyle(visual.color, selected ? 0.1 : 0.035)
                .setVisible(showDebug);
              visual.marker.setScale(selected ? 1.3 : 1);
            }
            parent.dataset.debugVisible = String(showDebug);
            parent.dataset.dialogCompletesOnClose = String(
              Boolean(activeObject?.activateOnClose),
            );
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
