import Phaser from 'phaser';
import { PROJECT_IDENTITY } from '../../core/game';
import { createGrayboxCore, type GrayboxCore } from '../../core/graybox.ts';
import { PLAYER_PROTOTYPE } from '../../core/player.ts';
import {
  MatterGrayboxWorld, ONE_WAY_PLATFORM, type MatterGrayboxDiagnostics, type MatterLibrary,
} from '../../physics/matter/graybox-world';

export function mountGrayboxScene(parent: HTMLElement, platform: string, now: () => number,
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
          const core = createGrayboxCore(world);
          created(core);
          const terrain = this.add.graphics();
          for (const body of world.terrain) {
            const oneWay = body.label === ONE_WAY_PLATFORM.label;
            terrain.fillStyle(oneWay ? 0x6c5a91 : body.label === 'continuous-slope' ? 0x54866e : 0x526879);
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
          const movingVisuals = new Map(world.movingPlatforms.map(platformState => {
            const horizontal = platformState.axis === 'horizontal';
            return [platformState.label, this.add.rectangle(
              platformState.x, platformState.y, platformState.width, platformState.height,
              horizontal ? 0xc77d4d : 0x4c9fa0,
            ).setStrokeStyle(3, horizontal ? 0xffc087 : 0x91efea)];
          }));
          const player = this.add.rectangle(80, 472, PLAYER_PROTOTYPE.width, PLAYER_PROTOTYPE.height, 0xf0bd71)
            .setStrokeStyle(2, 0xffe6b6);
          const foot = this.add.rectangle(80, 495, 22, 8).setStrokeStyle(1, 0x84e1be);
          const camera = this.cameras.main;
          camera.setBounds(0, 0, 2000, 680);
          camera.startFollow(player, true, 0.15, 0.15);
          this.add.text(20, 16, `${PROJECT_IDENTITY.title} · ${PROJECT_IDENTITY.subtitle}\nM1.2.2 物理灰盒  /  ${platform}\nA/D 或 ←/→ 移动 · Space 跳跃（短按低跳／长按高跳）\n右侧坡面上方：橙色水平往返／青色垂直升降 · R 重置\nR /「重置灰盒」回到出生点 · 失焦恢复后先松开 Space 再按\nMatter 优先验证中；非最终物理方案。所有数值为原型。`, {
            fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '17px', color: '#f4eddc',
            backgroundColor: '#152632', padding: { x: 8, y: 6 },
          }).setScrollFactor(0).setDepth(5);
          this.events.on(Phaser.Scenes.Events.UPDATE, () => {
            core.frame(now());
            const state = core.snapshot.player;
            for (const platformState of world.movingPlatforms) {
              movingVisuals.get(platformState.label)?.setPosition(platformState.x, platformState.y);
            }
            player.setPosition(state.x, state.y);
            player.setFillStyle(state.controlAllowed ? 0xf0bd71 : 0xa5adb3);
            foot.setPosition(state.x, state.y + PLAYER_PROTOTYPE.height / 2 + 1);
            foot.setStrokeStyle(1, state.grounded ? 0x84e1be : 0xec7878);
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
