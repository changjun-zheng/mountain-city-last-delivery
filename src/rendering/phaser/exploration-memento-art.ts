import type Phaser from 'phaser';
import type {MementoId} from '../../core/exploration-mementos';
import bookmark from './assets/exp-03b/bookmark.svg?raw';
import sketch from './assets/exp-03b/sketch.svg?raw';
import postcard from './assets/exp-03b/postcard.svg?raw';

const pictures={bookmark,sketch,postcard};
export const mementoImageUrl=(id:MementoId)=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pictures[id])}`;

// Small paper displays use the same three motifs/palette as the editable SVGs.
// Graphics belong to the existing map Layer; no texture cache or new loader.
export function drawMemento(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,id:MementoId,x:number,y:number,owned:boolean):void {
  const g=scene.add.graphics().setPosition(x,y).setDepth(y);layer.add(g);
  g.fillStyle(0x564a3b,.3);g.fillEllipse(4,4,66,18);
  g.fillStyle(0x876345);g.fillRect(-29,-9,58,12);g.fillRect(-22,2,5,17);g.fillRect(17,2,5,17);
  g.fillStyle(owned?0xb7b397:0xf0dfac);g.fillRoundedRect(-25,-64,50,57,3);g.lineStyle(2,0x9b855e);g.strokeRoundedRect(-25,-64,50,57,3);
  if(id==='bookmark'){
    g.fillStyle(0xa7754e);g.fillRect(-15,-44,30,23);g.lineStyle(4,0x385c63);g.lineBetween(-19,-43,-3,-55);g.lineBetween(-3,-55,20,-44);g.lineStyle(3,0x795b42);for(const dx of [-12,0,12])g.lineBetween(dx,-21,dx,-12);
    g.lineStyle(3,0xf8d68d);g.lineBetween(-12,-33,12,-33);
  }else if(id==='sketch'){
    g.lineStyle(3,0x4c6d67);g.strokeRect(-18,-49,17,20);g.lineBetween(-17,-29,-19,-13);g.lineBetween(-2,-29,-1,-14);g.lineBetween(4,-34,21,-34);g.lineBetween(7,-34,7,-14);g.lineBetween(18,-34,19,-14);
  }else{
    g.fillStyle(0x264d61);g.fillRect(-20,-57,40,43);g.fillStyle(0x417d88);g.fillRect(-20,-32,40,18);g.lineStyle(2,0xe8d69c);g.lineBetween(-19,-32,20,-35);g.lineBetween(-8,-50,-8,-32);g.lineBetween(10,-48,10,-34);g.lineBetween(-8,-50,-19,-32);g.lineBetween(-8,-50,3,-34);g.lineBetween(10,-48,3,-34);g.lineBetween(10,-48,20,-35);
  }
  if(owned){g.fillStyle(0x315f65);g.fillCircle(20,-58,10);g.lineStyle(2,0xf0dfac);g.lineBetween(15,-58,19,-54);g.lineBetween(19,-54,25,-62);}
  const label=scene.add.text(x,y+21,owned?'已收好':'纸上小纪念',{fontFamily:'Microsoft YaHei,sans-serif',fontSize:'14px',color:owned?'#c3d6cf':'#ffdfa5'}).setOrigin(.5,0).setDepth(y+1);layer.add(label);
}
