import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS} from '../../core/exploration-content';
import type {ExplorationSnapshot} from '../../core/exploration';

export function drawBuildingFloor(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,s:ExplorationSnapshot):void {
  const m=EXP_MAPS[s.map],g=scene.add.graphics().setDepth(-70);layer.add(g);
  const rect=(x:number,y:number,w:number,h:number,color:number)=>{g.fillStyle(color);g.fillRect(x,y,w,h);};
  const label=(x:number,y:number,text:string,size=18)=>{const t=scene.add.text(x,y,text,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:`${size}px`,color:'#ffe4ad'}).setOrigin(.5).setDepth(y+25);layer.add(t);};
  if(s.map==='guide2'||s.map==='workshop2'||s.map==='workshop3'){
    const b=m.bounds;rect(b.x-18,b.y-50,b.w+36,b.h+68,0x423a32);rect(b.x,b.y,b.w,b.h,0xa17d54);
    for(let x=b.x;x<b.x+b.w;x+=26){g.lineStyle(1,0x765c41);g.lineBetween(x,b.y,x,b.y+b.h);}
    for(const w of m.walls){const wall=scene.add.graphics().setDepth(w.y+w.h);layer.add(wall);wall.fillStyle(0x684734);wall.fillRect(w.x,w.y-22,w.w,w.h+22);wall.fillStyle(0xc69d68);wall.fillRect(w.x-3,w.y-24,w.w+6,25);}
    label(660,105,m.name,24);
    if(s.map==='guide2'){
      label(350,240,'阅览区');label(950,210,'楼层／纹样导览');rect(920,305,60,35,0xf4dfac);g.lineStyle(3,0x5c7b77);g.strokeTriangle(927,332,937,313,947,332);g.lineBetween(952,317,974,312);g.lineBetween(952,327,974,322);
    }else if(s.map==='workshop2'){
      label(310,260,'工具存放');label(700,285,'纹样整理位');label(900,470,'整理工作台');rect(665,300,70,20,0xc69d68);g.lineStyle(3,0x496665);g.strokeTriangle(673,316,683,301,693,316);g.lineBetween(702,306,727,302);g.lineBetween(702,314,727,310);
    }else{
      const clasp=EXP_TARGETS.find(t=>t.id==='plaque')!;
      label(310,280,'储物区');label(clasp.x,325,'水波门扣柜');label(1050,215,'山纹工具箱');
      if(!s.item){rect(clasp.x-21,366,42,10,0xf3ce80);g.lineStyle(2,0x5a735f);g.lineBetween(clasp.x-14,369,clasp.x+13,367);g.lineBetween(clasp.x-14,373,clasp.x+13,371);}
      label(clasp.x,470,s.item?'导扣已带走':'可借 · 江纹导扣',16);g.lineStyle(3,0x5c7b77);g.strokeTriangle(1028,278,1050,255,1072,278);
    }
  }
  for(const target of EXP_TARGETS.filter(t=>t.map===s.map&&['guide-up','guide-down','workshop-up-2','workshop-down-1','workshop-up-3','workshop-down-2'].includes(t.id)&&t.destination&&t.id!=='guide-exit'&&t.id!=='workshop-exit')){
    const stairs=scene.add.graphics().setDepth(target.y-1);layer.add(stairs);for(let n=0;n<7;n++){stairs.fillStyle(n%2?0x79684e:0xb29a6e);stairs.fillRect(target.x-48,target.y-35+n*9,96,7);}label(target.x,target.y-65,target.label,16);
  }
  if(s.map==='workshop'){label(320,435,'1F工作台／2F工具／3F门扣',16);}
}
