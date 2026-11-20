import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS} from '../../core/exploration-content';
import {PHOTO_SITES} from '../../core/exploration-photo';

// Playable blockout only: every wall below comes from the actual collision data.
export function drawDistrict(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,id:'middle'|'riverfront'):void {
  const m=EXP_MAPS[id],g=scene.add.graphics().setDepth(-80);layer.add(g);
  const rect=(x:number,y:number,w:number,h:number,c:number)=>{g.fillStyle(c);g.fillRect(x,y,w,h);};
  rect(0,0,m.width,m.height,0x315361);rect(m.bounds.x,m.bounds.y,m.bounds.w,m.bounds.h,0x82958a);
  for(let y=260;y<1440;y+=40){g.lineStyle(1,0x657e78,.55);g.lineBetween(60,y,m.width-60,y);}
  const label=(x:number,y:number,text:string)=>{const t=scene.add.text(x,y,text,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:'18px',color:'#ffe4ad'}).setOrigin(.5).setDepth(y+20);layer.add(t);};
  if(id==='middle'){
    for(const [x,y,w,h] of [[300,450,2800,100],[850,500,100,650],[2050,500,100,650],[300,1050,2800,100]]){rect(x,y,w,h,0x9a7652);}
    label(900,470,'内廊路口 · 沿院北绕行');label(2100,470,'东院岔口');label(2800,1040,'外廊／东阶');label(400,1000,'西阶／外廊');
  }else{
    rect(60,1150,2480,290,0x356b78);rect(280,610,620,110,0x9a7652);rect(850,650,100,440,0x9a7652);rect(900,1000,1500,100,0x9a7652);
    g.lineStyle(8,0x9faaa0);g.lineBetween(300,1330,2400,1250);for(const x of [650,1800]){rect(x,1180,12,150,0x91a3a0);}
    label(400,570,'到达平台 · 沿木楼西侧向江边');label(1900,990,'桥／江水／木楼取景面');
  }
  for(const w of m.walls){const house=m.buildings.includes(w as never);const wall=scene.add.graphics().setDepth(w.y+w.h);layer.add(wall);wall.fillStyle(house?0x724838:0x584b3c);wall.fillRect(w.x,w.y,w.w,w.h);if(house){wall.fillStyle(0x344d55);wall.fillRect(w.x-8,w.y-22,w.w+16,26);wall.fillStyle(0xffd487);for(let x=w.x+24;x<w.x+w.w-30;x+=90)wall.fillRect(x,w.y+25,35,32);} }
  // Water is drawn as water, while the matching thin rail remains a solid blocker.
  if(id==='riverfront'){rect(60,1150,2480,290,0x356b78);for(let x=100;x<2500;x+=95){rect(x,1180+(x%170),45,2,0x87a69a);}const water=scene.add.graphics().setDepth(1450);layer.add(water);water.fillStyle(0x356b78);water.fillRect(60,1150,2480,290);water.lineStyle(8,0x9faaa0);water.lineBetween(300,1330,2400,1250);}
  for(const t of EXP_TARGETS.filter(t=>t.map===id)){
    if(t.destination){const stairs=scene.add.graphics().setDepth(t.y-1);layer.add(stairs);for(let n=0;n<7;n++){stairs.fillStyle(n%2?0x79684e:0xb29a6e);stairs.fillRect(t.x-54,t.y-35+n*10,108,8);}label(t.x,t.y-65,t.label);}
    else if(t.id.startsWith('middle-')){label(t.x,t.y-45,t.label);}
  }
  for(const site of Object.values(PHOTO_SITES).filter(s=>s.map===id)){g.lineStyle(2,0xd8c392);g.strokeEllipse(site.x,site.y,38,16);}
}
