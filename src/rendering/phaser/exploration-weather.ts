import Phaser from 'phaser';

export type ExplorationWeather = 'dusk' | 'rain';

export function createWeatherView(scene: Phaser.Scene) {
  const effects = scene.add.graphics().setScrollFactor(0).setDepth(21990);
  const overlay = scene.textures.createCanvas('exploration-rain-mist',12,256)!;
  const mist = overlay.context.createLinearGradient(0,0,0,256);
  mist.addColorStop(0,'rgba(157,181,193,.35)');
  mist.addColorStop(.4,'rgba(134,166,177,.16)');
  mist.addColorStop(.64,'rgba(108,145,154,.04)');
  mist.addColorStop(1,'rgba(108,145,154,0)');
  overlay.context.fillStyle=mist;
  overlay.context.fillRect(0,0,12,256);
  overlay.refresh();
  const haze = scene.add.image(0,0,'exploration-rain-mist').setOrigin(0).setScrollFactor(0).setDepth(21991);
  let wetness=0;
  let lastTick=0;
  return (weather:ExplorationWeather, outdoor:boolean, tick:number, reducedMotion:boolean) => {
    const change=Math.max(0,tick-lastTick)/34;
    lastTick=tick;
    const requested=weather==='rain'?1:0;
    wetness=reducedMotion?requested:Phaser.Math.Clamp(wetness+(requested===1?change:-change),0,1);
    const visible = wetness>0 && outdoor;
    effects.setVisible(visible);haze.setVisible(visible);
    if(!visible)return wetness;
    const {width,height}=scene.cameras.main;
    haze.setDisplaySize(width,height).setAlpha(wetness);
    effects.setAlpha(wetness);
    effects.clear();
    effects.fillStyle(0x294359,.24).fillRect(0,0,width,height);
    if(reducedMotion)return wetness;
    const time=tick/50;
    for(let i=0;i<88;i++){
      const x=(i*359+i*i*7+time*(24+i%5*5))%(width+35)-17;
      const y=(i*127+time*(293+i%7*24))%(height+30)-12;
      const length=8+i%7*2;
      effects.lineStyle(1,i%3===0?0xb9dae4:0x9cb4c2,.18+i%6*.039).lineBetween(x,y,x+length*.28,y+length);
      if(i%8===0){
        const ripple = (time+i*.37)%1;
        effects.lineStyle(1,0xa5c3c6,.18*(1-ripple)).strokeEllipse((i*191)%width,height*.68+(i*89)%(height*.3),3+ripple*17,1+ripple*5);
      }
    }
    return wetness;
  };
}
