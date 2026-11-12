import Phaser from 'phaser';
import type { GameCore } from '../../core/game';

export function mountStartupScene(
  parent: HTMLElement,
  core: GameCore,
  platform: string,
  now: () => number,
  sampled: () => void,
): Promise<{ destroy: () => Promise<void> }> {
  return new Promise((resolve) => {
    new Phaser.Game({
      parent,
      // Rendering schedules frames; core code alone advances the fixed-step simulation.
      type: Phaser.CANVAS,
      width: 800,
      height: 450,
      backgroundColor: '#162632',
      banner: false,
      autoFocus: false,
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: {
        create(this: Phaser.Scene) {
          const scene = core.startupScene;
          this.add.rectangle(400, 55, 52, 4, 0xf0bd71);
          this.add.text(400, 100, scene.title, {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '42px',
            color: '#fff4dc',
          }).setOrigin(0.5);
          this.add.text(400, 160, scene.subtitle, {
            fontFamily: 'sans-serif',
            fontSize: '23px',
            color: '#dce6e9',
          }).setOrigin(0.5);
          this.add.text(400, 212, `${platform}  /  ${scene.milestone}`, {
            fontFamily: 'Microsoft YaHei, sans-serif',
            fontSize: '18px',
            color: '#f0bd71',
          }).setOrigin(0.5);
          this.add.rectangle(400, 300, 600, 2, 0x526a78);
          const marker = this.add.circle(100, 300, 10, 0xf0bd71);
          const status = this.add.text(400, 365, '', {
            fontFamily: 'monospace', fontSize: '18px', color: '#dce6e9',
          }).setOrigin(0.5);
          this.events.on(Phaser.Scenes.Events.UPDATE, () => {
            // Use a raw monotonic platform sample, never Phaser's smoothed frame delta.
            core.frame(now());
            const sample = core.snapshot;
            marker.x = 100 + sample.markerX;
            status.setText(`${sample.paused ? 'PAUSED' : 'RUNNING'} · Tick ${sample.tick}`);
            sampled();
          });

          const game = this.game;
          game.events.once(Phaser.Core.Events.POST_RENDER, () => {
            resolve({
              destroy: () => new Promise<void>((done) => {
                // Phaser destroys the game and detaches its canvas on the next frame.
                game.events.once(Phaser.Core.Events.DESTROY, done);
                game.destroy(true);
              }),
            });
          });
        },
      },
    });
  });
}
