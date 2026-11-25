import Phaser from 'phaser';
import type {ExplorationSnapshot} from '../../core/exploration';
import {RIVER_PIER_X} from '../../core/exploration-ferry';
import {EXP_MAPS, EXP_TARGETS} from '../../core/exploration-content';
import ridgeUrl from './assets/cel-v1/ridge-landing.webp';
import harbourUrl from './assets/cel-v1/bay-harbour.webp';
import ferryUrl from './assets/cel-v1/ferry.webp';

const ridgeTexture = 'ferry-ridge-landing';
const harbourTexture = 'ferry-bay-harbour';
const ferryTexture = 'ferry-boat';

export function preloadFerryArt(scene: Phaser.Scene, failed: (error:Error)=>void) {
  const assets = {[ridgeTexture]:ridgeUrl,[harbourTexture]:harbourUrl,[ferryTexture]:ferryUrl};
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR,(asset:Phaser.Loader.File)=>{
    if(Object.hasOwn(assets,asset.key))failed(new Error('Ferry artwork unavailable: '+asset.key));
  });
  for(const [name,url] of Object.entries(assets))scene.load.image(name,url);
}

function label(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,x:number,y:number,message:string) {
  layer.add(scene.add.text(x,y,message,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:'16px',color:'#f4d7a7',
    backgroundColor:'#3e3038e6',padding:{x:9,y:5}}).setOrigin(.5).setDepth(y+8));
}

export function drawFerryDistrict(scene: Phaser.Scene,layer:Phaser.GameObjects.Layer,s:ExplorationSnapshot) {
  const ridge=s.map==='ridge';
  const m=EXP_MAPS[ridge?'ridge':'riverfront'];
  layer.add(scene.add.image(0,0,ridge?ridgeTexture:harbourTexture).setOrigin(0).setDisplaySize(m.width,m.height).setDepth(-96));
  const glints=scene.add.graphics().setDepth(-90);
  layer.add(glints);
  if(ridge){
    layer.setData('storybookWater',{graphics:glints,left:120,right:1320,top:885,bottom:956});
    label(scene,layer,472,175,'古树台');
    label(scene,layer,802,748,'照水岭渡口');
    return;
  }

  layer.setData('storybookWater',{graphics:glints,left:100,right:2070,top:1155,bottom:1360});
  const boat=scene.add.image(RIVER_PIER_X+55,1269,ferryTexture).setOrigin(.5,.87).setDisplaySize(185,58).setDepth(1270);
  layer.add(boat);
  if(!s.photographed){
    const rope=scene.add.graphics().setDepth(1268);
    rope.lineStyle(2,0xbb9668,.8).lineBetween(RIVER_PIER_X+32,1219,boat.x-71,1264);
    layer.add(rope);
  }
  label(scene,layer,RIVER_PIER_X+80,1030,s.photographed?'照水岭渡船 · 可乘':'照水岭渡船');
  label(scene,layer,2335,1438,'对岸 · 照水岭');
  const ascent=EXP_TARGETS.find(target=>target.id==='riverfront-up')!;
  label(scene,layer,ascent.x,ascent.y-54,'沿坡路回下街');
  label(scene,layer,1929,997,'江岸取景台');
}

export function createFerryView(scene:Phaser.Scene) {
  const image=scene.add.image(0,0,harbourTexture).setOrigin(0).setScrollFactor(0).setDepth(22000).setVisible(false);
  const wake=scene.add.graphics().setScrollFactor(0).setDepth(22001).setVisible(false);
  const ferry=scene.add.image(0,0,ferryTexture).setOrigin(.5,.86).setScrollFactor(0).setDepth(22002).setVisible(false);
  const fade=scene.add.graphics().setScrollFactor(0).setDepth(22003).setVisible(false);
  return (trip:ExplorationSnapshot['ferry'],reducedMotion:boolean) => {
    image.setVisible(!!trip);wake.setVisible(!!trip);ferry.setVisible(!!trip);fade.setVisible(!!trip);
    if(!trip)return;
    const {width,height}=scene.cameras.main;
    const forward=trip.direction==='outbound';
    const progress=trip.fraction;
    const t=forward?progress:1-progress;
    image.setPosition(0,-height*1.12).setDisplaySize(width,height*2.12);
    const drift=reducedMotion?0:Math.sin(progress*29)*2;
    const x=Phaser.Math.Linear(.852,.743,t)*width,y=Phaser.Math.Linear(.61,.93,t)*height+drift;
    const size=Math.min(width*.18,210);
    ferry.setPosition(x,y).setDisplaySize(size,size*175/560).setFlipX(forward);
    wake.clear();
    wake.fillStyle(0x163540,.53).fillEllipse(x,y+4,size*.89,14);
    if(!reducedMotion){
      const side=forward?-1:1;
      const alpha=.18+.15*Math.sin(progress*Math.PI);
      wake.lineStyle(2,0xb3d0c8,alpha).lineBetween(x-side*size*.17,y+5,x-side*size*.86,y-3);
      wake.lineBetween(x-side*size*.16,y+13,x-side*size*.9,y+19);
    }
    fade.clear();
    const transition=Math.max(0,1-progress*9,1-(1-progress)*9);
    fade.fillStyle(0x201c2a,transition*.91).fillRect(0,0,width,height);
  };
}

