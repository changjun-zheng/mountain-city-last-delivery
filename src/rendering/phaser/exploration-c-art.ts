import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS,explorationWalls} from '../../core/exploration-content';
import type {ExplorationSnapshot} from '../../core/exploration';
import {drawBuildingFloor} from './exploration-building-art';

// Basic playable spatial blockout. Floors, retaining masses and entry markers
// follow the finite C collision/connection data, not a second decorative map.
export function drawCExploration(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,s:ExplorationSnapshot):void{
  const m=EXP_MAPS[s.map],base=scene.add.graphics().setDepth(-90);layer.add(base);
  const box=(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,c:number)=>{g.fillStyle(c);g.fillRect(x,y,w,h);};
  const label=(x:number,y:number,value:string,size=18,depth=y+5)=>{const t=scene.add.text(x,y,value,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:`${size}px`,color:'#ffe4ad',align:'center'}).setOrigin(.5).setDepth(depth);layer.add(t);};
  const slab=(x:number,y:number,w:number,h:number,c:number)=>{box(base,x,y,w,h,c);base.lineStyle(1,0x607773,.6);for(let a=x;a<x+w;a+=42)base.lineBetween(a,y,a,y+h);};
  const poly=(g:Phaser.GameObjects.Graphics,points:number[],c:number)=>{g.fillStyle(c);g.fillPoints(points.reduce<Phaser.Math.Vector2[]>((all,_,i)=>{if(i%2===0)all.push(new Phaser.Math.Vector2(points[i],points[i+1]));return all;},[]),true);};
  box(base,0,0,m.width,m.height,0x356b78);box(base,m.bounds.x,m.bounds.y,m.bounds.w,m.bounds.h,m.outdoor?0x82958a:0xa17d54);
  const floorMaps=['guide2','workshop2','workshop3'];
  if(floorMaps.includes(s.map))drawBuildingFloor(scene,layer,s);
  else if(!m.outdoor){
    box(base,m.bounds.x-18,m.bounds.y-75,m.bounds.w+36,75,0x6e5140);
    for(let x=m.bounds.x+20;x<m.bounds.x+m.bounds.w-80;x+=150){box(base,x,m.bounds.y-60,80,45,0x315361);box(base,x+37,m.bounds.y-60,6,45,0xc3ad81);}
    slab(m.bounds.x,m.bounds.y,m.bounds.w,m.bounds.h,0xa17d54);
    for(const w of m.walls){const g=scene.add.graphics().setDepth(w.y+w.h);layer.add(g);box(g,w.x,w.y-24,w.w,w.h+24,0x684734);box(g,w.x-3,w.y-24,w.w+6,24,0xc69d68);}
    label(m.width/2,115,m.name,23,1000);
    if(s.map==='market'){label(300,260,'西廊货架');label(900,235,'东院杂货');label(670,580,'穿行内间',18);}
    if(s.map==='lantern'){label(480,255,'灯笼陈列');label(850,230,'后窗纸品架');for(const x of [330,660,1080]){base.lineStyle(3,0x624638);base.lineBetween(x,200,x,260);base.fillStyle(0xffd487);base.fillEllipse(x,280,38,48);}label(850,370,'纸上江桥',16);}
    if(s.map==='guide'){label(560,270,'接待阅览 · 青白立柱',18);}
    if(s.map==='workshop'){label(420,270,'1F工作台 · 双水波立柱',18);}
    if(s.map==='tea'){label(545,240,'竹椅茶桌');label(800,280,'桥在后窗，木楼在窗外',16);}
  }else{
    // Stone back lane and wooden eaves/front lane have real depth and corners.
    slab(80,225,2040,45,0x89978b);slab(160,580,1880,170,0x9a7652);
    if(s.map==='upper'){
      slab(150,700,260,330,0xa78961);slab(1945,700,180,330,0xa78961);
      const retaining=scene.add.graphics().setDepth(799);layer.add(retaining);box(retaining,420,800,1520,240,0x465657);
      for(let x=440;x<1940;x+=80){retaining.lineStyle(2,0x6a7972);retaining.strokeRect(x,805,74,32);}
      // The cliff's exposed storey is UNDER the active projecting deck, not a
      // second house on that deck. No roof or accessible doorway is drawn here.
      for(const b of m.buildings.filter(b=>b.kind==='guide'||b.kind==='workshop')){
        const mark=b.kind==='guide'?0xb1d0c4:0xd6ab69,g=scene.add.graphics().setDepth(1040);layer.add(g);
        box(g,b.x,815,b.w,225,0x715441);poly(g,[b.x+b.w,815,b.x+b.w+35,790,b.x+b.w+35,1015,b.x+b.w,1040],0x443c35);
        for(let x=b.x+12;x<b.x+b.w;x+=90){box(g,x,812,12,228,mark);box(g,x+23,850,40,50,0xdaa868);g.lineStyle(5,0x574435);g.lineBetween(x,1010,x+75,925);}
        box(g,b.x-16,798,b.w+32,18,0xc4aa7a);box(g,b.x,910,b.w,12,0x433d34);
        box(g,b.x+b.w/2-25,953,50,87,0x263c3d);box(g,b.x+b.w/2-20,958,40,77,0xa28f6b);
        g.lineStyle(5,mark);g.lineBetween(b.x+12,520,b.x+12,800);g.lineBetween(b.x+b.w-12,520,b.x+b.w-12,800);
      }
      label(1080,790,'悬挑廊边',16,1100);
    }else if(s.map==='middle'){
      slab(670,750,140,300,0xa78961);slab(1290,750,120,300,0xa78961);slab(160,930,1880,120,0xa78961);
      label(710,600,'导览1F后街',16);label(1620,600,'木作2F街门',16);
    }else{
      slab(180,990,1900,130,0xa78961);slab(350,650,140,400,0xa78961);slab(1380,650,140,400,0xa78961);
      // Upper floor sits on continuous piers, visible from the life street.
      for(const x of [1010,1140]){box(base,x,235,70,305,0x465657);base.lineStyle(5,0x9c8460);base.lineBetween(x,470,x+70,350);}
      label(1110,240,'上方悬挑廊／下方支柱',17,550);
    }
    for(const b of m.buildings){
      const g=scene.add.graphics().setDepth(b.y+b.h);layer.add(g);
      const guide=b.kind==='guide',wood=b.kind==='workshop',mark=guide?0xb1d0c4:wood?0xd6ab69:0x8e6850;
      box(g,b.x,b.y,b.w,b.h,0x8b6349);poly(g,[b.x+b.w,b.y,b.x+b.w+35,b.y-25,b.x+b.w+35,b.y+b.h-25,b.x+b.w,b.y+b.h],0x4c443a);
      poly(g,[b.x-20,b.y,b.x+18,b.y-45,b.x+b.w+22,b.y-45,b.x+b.w+55,b.y-5,b.x+b.w+5,b.y+10],0x344d55);
      g.lineStyle(2,0x69817d);for(let x=b.x;x<b.x+b.w;x+=24)g.lineBetween(x,b.y-2,x+35,b.y-41);
      const storeys=(guide||wood)?(s.map==='middle'?2:s.map==='lower'&&wood?3:1):1;
      for(let level=0;level<storeys;level++){
        const y=b.y+level*b.h/storeys;
        for(let x=b.x+35;x<b.x+b.w-40;x+=85){box(g,x,y+28,45,55,0x393d35);box(g,x+4,y+33,37,44,0xffd487);box(g,x+21,y+30,4,51,0x594638);box(g,x+2,y+53,41,4,0x594638);}
        if(level){box(g,b.x-15,y-6,b.w+30,14,0xc6a879);box(g,b.x,y+8,b.w,10,0x453d33);for(let x=b.x+20;x<b.x+b.w;x+=48){box(g,x,y-28,5,24,mark);g.lineStyle(2,mark);g.lineBetween(x,y-28,x+42,y-28);}}
      }
      for(const x of [b.x+12,b.x+b.w-24])box(g,x,b.y,12,b.h,mark);
      box(g,b.x,b.y+b.h-12,b.w,12,0x4c3b33);
      if(guide||wood){
        // Same stripe/wave facade across levels, including the adjacent storey.
        g.lineStyle(3,mark);for(let y=b.y+100;y<b.y+b.h-20;y+=65){g.lineBetween(b.x+28,y,b.x+b.w-28,y);if(wood){g.lineBetween(b.x+40,y+13,b.x+65,y+6);g.lineBetween(b.x+40,y+21,b.x+65,y+14);}}
      }
      // Whole-building sign; the actual door separately names its own floor.
      label(b.x+b.w/2,b.y+110,b.name,18,b.y+b.h+2);
    }
    // Non-house walls and live closure rails share the actual blocker rectangles.
    for(const w of explorationWalls(s.map,s.unlocked).filter(w=>!m.buildings.includes(w as never))){
      if(s.map==='upper'&&w.y===800)continue;
      const g=scene.add.graphics().setDepth(w.y+Math.min(w.h,40));layer.add(g);box(g,w.x,w.y,w.w,w.h,0x465657);g.lineStyle(4,0xb99b6d);g.lineBetween(w.x,w.y,w.x+w.w,w.y);
    }
  }
  const stairIds=new Set(['east-down','east-up','west-down','west-up','middle-east-upper','middle-west-upper','middle-east-lower','middle-west-lower','riverfront-down']);
  for(const t of EXP_TARGETS.filter(t=>t.map===s.map&&t.destination)){
    const g=scene.add.graphics().setDepth(t.y-1);layer.add(g);
    if(stairIds.has(t.id)){for(let n=0;n<7;n++){const y=t.y-38+n*10,x=t.x-40+n*3;poly(g,[x,y,x+75,y,x+91,y+7,x+16,y+7],n%2?0x77634a:0xc2aa7d);}g.lineStyle(5,0x4c4438);g.lineBetween(t.x-47,t.y-50,t.x-26,t.y+22);g.lineBetween(t.x+42,t.y-50,t.x+63,t.y+22);}
    else if(!['guide-up','guide-down','workshop-up-2','workshop-down-1','workshop-up-3','workshop-down-2'].includes(t.id)){
      box(g,t.x-30,t.y-60,60,58,0x293c3c);box(g,t.x-24,t.y-55,48,49,t.locked&&!s.unlocked?0x624c3e:0xc0ab7f);box(g,t.x-39,t.y,78,8,0xc2aa7d);
      if(t.locked&&!s.unlocked){g.lineStyle(4,0xd9b676);g.lineBetween(t.x-24,t.y-45,t.x+24,t.y-12);g.lineBetween(t.x-24,t.y-12,t.x+24,t.y-45);}
    }else continue;
    label(t.x,t.y-82,t.label,16,t.y+30);
  }
  if(s.map==='middle'){
    const g=scene.add.graphics().setDepth(1040);layer.add(g);g.lineStyle(4,0xffd487);for(const y of [966,976]){g.lineBetween(1912,y,1923,y-6);g.lineBetween(1923,y-6,1935,y);g.lineBetween(1935,y,1947,y-6);}label(1930,935,s.unlocked?'江纹封道已通':'江纹封道',18,1040);
  }
}
