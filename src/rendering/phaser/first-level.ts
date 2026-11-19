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
import {
  assertFirstLevelArtLoaded,
  createFirstLevelArt,
  preloadFirstLevelArt,
} from './first-level-art.ts';
import { createFirstLevelActor } from './first-level-actor.ts';

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
  parent.dataset.artTask = 'DEMO-01';
  parent.dataset.artSubtask = 'DEMO-01';
  parent.dataset.artAssetsReady = 'false';
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
        preload(this: Phaser.Scene) {
          delete parent.dataset.assetLoadError;
          this.load.once('loaderror', (file: { key: string }) => {
            parent.dataset.assetLoadError = file.key;
          });
          preloadFirstLevelArt(this);
        },
        create(this: Phaser.Scene) {
          assertFirstLevelArtLoaded(this);
          parent.dataset.artAssetsReady = 'true';
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
          const art = createFirstLevelArt(this, world);

          const liftLabel = this.add.text(
            FIRST_LEVEL_SPATIAL_CONFIG.lift.x,
            FIRST_LEVEL_SPATIAL_CONFIG.lift.fromY - 30,
            '江岸升降梯 · 下行',
            {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '13px',
              color: '#ffe0bd',
              backgroundColor: '#3d2d25',
              padding: { x: 5, y: 2 },
            },
          ).setOrigin(0.5).setDepth(8);
          const gateText = this.add.text(
            FIRST_LEVEL_ROUTE_GATE.x - 54,
            FIRST_LEVEL_SPATIAL_CONFIG.lift.fromY - 110,
            '江岸路线关闭',
            {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '14px',
              color: '#ffc3c7',
              backgroundColor: '#3d2529',
              padding: { x: 6, y: 3 },
            },
          ).setDepth(8);

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
              ).setStrokeStyle(1, color, 0.45).setDepth(10);
              const marker = this.add.circle(object.x, object.y, 13, color, 0.92)
                .setStrokeStyle(2, 0xf7f0df)
                .setDepth(11);
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
              ).setDepth(11).setVisible(false);
              return [object.id, { range, marker, text, color }];
            }),
          );

          this.add.text(3900, 490, '吊脚楼控制装置', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '14px',
            color: '#f5e9c7',
            backgroundColor: '#26373f',
            padding: { x: 6, y: 3 },
          }).setOrigin(0.5).setDepth(9);

          const npc = this.add.container(2350, 328).setDepth(5);
          const npcHead = this.add.circle(0, -23, 11, 0xf2c79f)
            .setStrokeStyle(2, 0xffead3);
          const npcHair = this.add.ellipse(0, -32, 22, 10, 0x37414c);
          const npcBody = this.add.rectangle(0, 0, 25, 34, 0x67a9b6)
            .setStrokeStyle(2, 0xb6e5e8);
          const npcLegs = this.add.rectangle(0, 24, 20, 15, 0x394b5b);
          const npcBag = this.add.rectangle(-17, 2, 10, 22, 0xd6a95d);
          npc.add([npcLegs, npcBody, npcHair, npcHead, npcBag]);

          const photoFrame = this.add.rectangle(
            7550,
            1338,
            42,
            30,
            0x2f4851,
            0.96,
          ).setStrokeStyle(3, 0x8dd8d4).setDepth(5);
          this.add.circle(7550, 1338, 9, 0x13232a)
            .setStrokeStyle(2, 0x8dd8d4)
            .setDepth(6);
          const photoLabel = this.add.text(7550, 1372, 'D · 嘉陵江岸拍摄点', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '13px',
            color: '#d4fbf7',
            backgroundColor: '#203a40',
            padding: { x: 5, y: 2 },
          }).setOrigin(0.5).setDepth(9);

          const objective = this.add.text(18, 18, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '21px',
            color: '#fff3d3',
            backgroundColor: '#1c3743',
            padding: { x: 10, y: 7 },
            wordWrap: { width: 860, useAdvancedWrap: true },
          }).setScrollFactor(0).setDepth(30);
          const status = this.add.text(980, 18, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '14px',
            color: '#dceef0',
            backgroundColor: '#172b34',
            padding: { x: 8, y: 6 },
            align: 'right',
          }).setOrigin(1, 0).setScrollFactor(0).setDepth(30).setVisible(false);
          const controls = this.add.text(
            18,
            542,
            'A/D 或方向键移动 · Space 跳跃 · E 交互 · R 调试重置',
            {
              fontFamily: 'Microsoft YaHei, sans-serif',
              fontSize: '15px',
              color: '#e8f2f2',
              backgroundColor: '#13252e',
              padding: { x: 9, y: 6 },
            },
          ).setScrollFactor(0).setDepth(30);
          const prompt = this.add.text(500, 514, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '21px',
            color: '#fff4cd',
            backgroundColor: '#294b54',
            padding: { x: 11, y: 6 },
            wordWrap: { width: 820, useAdvancedWrap: true },
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
            fontSize: '24px',
            color: '#fff3d7',
          }).setScrollFactor(0).setDepth(46).setVisible(false);
          const dialogContent = this.add.text(72, 76, '', {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '20px',
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
          const actor = createFirstLevelActor(this, world.state.x, world.state.y);
          const player = actor.container;
          const foot = this.add.rectangle(
            world.state.x,
            world.state.y + 23,
            22,
            8,
          ).setStrokeStyle(1, 0x84e1be).setVisible(false);
          const camera = this.cameras.main;
          camera.setBounds(
            0,
            0,
            FIRST_LEVEL_SIZE.width,
            FIRST_LEVEL_SIZE.height,
          );
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
          const touchControlsEnabled = () =>
            document.querySelector<HTMLElement>('#touch-prototype')
              ?.dataset.touchEnabled === 'true';
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
            const touchEnabled = touchControlsEnabled();
            art.update(world);
            liftLabel.setPosition(
              world.liftBody.position.x,
              world.liftBody.position.y - 30,
            );
            gateText.setText(
              world.routeOpen ? '嘉陵江岸路线开放' : '江岸路线关闭',
            )
              .setColor(world.routeOpen ? '#baf0ce' : '#ffc3c7')
              .setBackgroundColor(world.routeOpen ? '#1d3c2d' : '#3d2529');
            actor.update(state, {
              tick: snapshot.tick,
              paused: snapshot.paused,
              controlAllowed: state.controlAllowed,
            });
            foot.setPosition(state.x, state.y + PLAYER_PROTOTYPE.height / 2 + 1)
              .setStrokeStyle(1, state.grounded ? 0x84e1be : 0xe17979)
              .setVisible(showDebug);
            failureZone.setFillStyle(
              0xc55252,
              world.failureZone.occupied ? 0.22 : 0.1,
            ).setVisible(showDebug);
            fade.setAlpha(recovery.fadeAlpha).setVisible(recovery.fadeAlpha > 0.001);
            objective.setText(firstLevel?.objective ?? '首关状态加载中');
            objective
              .setFontSize(touchEnabled ? 18 : 21)
              .setWordWrapWidth(touchEnabled ? 540 : 860, true);
            status.setText(
              `委托 ${firstLevel?.questAccepted ? '✓' : '—'}\n` +
              `路线 ${world.routeOpen ? 'OPEN' : 'CLOSED'}\n` +
              `完成 ${firstLevel?.completed ? '✓' : '—'}\n` +
              `Tick ${snapshot.tick} · ${snapshot.paused ? 'PAUSED' : 'RUNNING'}\n` +
              `DEBUG · ${platform}`,
            ).setVisible(showDebug);
            prompt.setText(interaction.prompt ?? '')
              .setPosition(
                touchEnabled ? 300 : 500,
                touchEnabled ? 340 : 514,
              )
              .setFontSize(touchEnabled ? 18 : 21)
              .setWordWrapWidth(touchEnabled ? 440 : 820, true)
              .setVisible(Boolean(interaction.prompt) && !firstLevel?.completed);
            controls.setVisible(
              !firstLevel?.completionVisible && !touchEnabled,
            );
            const runtimeFailure = firstLevel?.phase === 'blocked'
              ? firstLevel.feedback
              : null;
            feedback.setText(
              (frameTime < phaseAnnouncementUntil ? phaseAnnouncement : null) ??
              interaction.feedbackText ??
              runtimeFailure ??
              '',
            )
              .setPosition(
                touchEnabled ? 330 : 500,
                touchEnabled ? 318 : 480,
              )
              .setWordWrapWidth(touchEnabled ? 520 : 760, true)
              .setVisible(Boolean(
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
              visual.marker
                .setScale(selected ? 1.3 : 1)
                .setVisible(showDebug);
              visual.text
                .setVisible(showDebug)
                .setAlpha(selected ? 1 : 0.82);
            }

            parent.dataset.debugVisible = String(showDebug);
            parent.dataset.visualState = JSON.stringify({
              task: 'DEMO-01',
              assetsReady: this.textures.exists('h5-02-explorer'),
              player: {
                x: Number(state.x.toFixed(2)),
                y: Number(state.y.toFixed(2)),
                vx: Number(state.vx.toFixed(2)),
                grounded: state.grounded,
                controlAllowed: state.controlAllowed,
              },
              lift: {
                x: Number(world.liftBody.position.x.toFixed(2)),
                y: Number(world.liftBody.position.y.toFixed(2)),
                routeOpen: world.routeOpen,
              },
              paused: snapshot.paused,
              tick: snapshot.tick,
              interactionMode: interaction.mode,
              hud: {
                touchControlsEnabled: touchEnabled,
                desktopControlsVisible: controls.visible,
                areaLabelsVisible: false,
                interactionDebugVisible: [...interactionVisuals.values()]
                  .some(visual => visual.range.visible),
                objectiveRight: objective.getBounds().right,
                promptLeft: prompt.getBounds().left,
                promptRight: prompt.getBounds().right,
                promptBottom: prompt.y + prompt.height,
                feedbackLeft: feedback.getBounds().left,
                feedbackRight: feedback.getBounds().right,
                feedbackBottom: feedback.y,
              },
            });
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
