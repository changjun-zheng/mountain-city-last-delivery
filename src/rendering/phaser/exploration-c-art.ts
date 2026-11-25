import Phaser from 'phaser';
import {drawLowerStreet,drawMiddleStreet,drawStorybookSample,isStorybookSample} from './exploration-storybook-art';
import {EXP_MAPS,EXP_TARGETS,explorationWalls} from '../../core/exploration-content';
import type {ExplorationSnapshot} from '../../core/exploration';
import {drawBuildingFloor} from './exploration-building-art';
import {hasRouteCue} from '../exploration-feedback';
import {drawTopDownBuilding, drawTopDownRoom} from './exploration-topdown-art';

// Basic playable spatial blockout. Floors, retaining masses and entry markers
// follow the finite C collision/connection data, not a second decorative map.
export function drawCExploration(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,s:ExplorationSnapshot):void{
  if(isStorybookSample(s.map)){drawStorybookSample(scene,layer,s);return;}
  if(s.map==='middle'){drawMiddleStreet(scene,layer);return;}
  if(s.map==='lower'){drawLowerStreet(scene,layer);return;}
  const m=EXP_MAPS[s.map],base=scene.add.graphics().setDepth(-90);layer.add(base);
  const box=(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,c:number)=>{g.fillStyle(c);g.fillRect(x,y,w,h);};
  const label=(x:number,y:number,value:string,size=18,depth=y+5)=>{const t=scene.add.text(x,y,value,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:`${size}px`,color:'#ffe4ad',align:'center'}).setOrigin(.5).setDepth(depth);layer.add(t);};
  const slab=(x:number,y:number,w:number,h:number,c:number)=>{box(base,x,y,w,h,c);base.lineStyle(1,0x607773,.6);for(let a=x;a<x+w;a+=42)base.lineBetween(a,y,a,y+h);};
  box(base,0,0,m.width,m.height,0x356b78);
  box(base,m.bounds.x,m.bounds.y,m.bounds.w,m.bounds.h,m.outdoor?0x82958a:0xa17d54);
  const floorMaps=['guide2','workshop2','workshop3'];
  if(floorMaps.includes(s.map))drawBuildingFloor(scene,layer,s);
  else if(!m.outdoor){
    // Interior as a plan view: one floor plane, a wall band with real thickness,
    // a doorway notch on the lower side, props keeping their own footprints.
    drawTopDownRoom(base,m.bounds,m.walls,{
      floor:0x9c725a,floorLine:0x805c50,wall:0x463641,wallTop:0x766371,
      outside:0x4b3c47,doorway:0xffdfad,
      propTop:0x91634f,propEdge:0x593d40,propLine:0x3f2e37,
    });
    // Interior stairs were only drawn by dead code before; give them a ground plane here.
    for(const t of EXP_TARGETS.filter(t=>t.map===s.map&&t.destination&&['guide-up','guide-down','workshop-up-2','workshop-down-1','workshop-up-3','workshop-down-2'].includes(t.id))){
      const g=scene.add.graphics().setDepth(t.y+150);layer.add(g);
      for(let n=0;n<5;n++)box(g,t.x-32,t.y-26+n*10,64,8,n%2?0x6a563c:0xe8d2a8);
      g.lineStyle(3,0x322d26);g.lineBetween(t.x-36,t.y-30,t.x-36,t.y+26);g.lineBetween(t.x+36,t.y-30,t.x+36,t.y+26);
      g.strokeRect(t.x-32,t.y-26,64,48);
    }
    label(m.width/2,115,m.name,23,1000);
    if(s.map==='market'){label(300,260,'西廊货架');label(900,235,'东院杂货');label(670,580,'穿行内间',18);}
    if(s.map==='lantern'){label(480,255,'灯笼陈列');label(850,230,'后窗纸品架');for(const x of [330,660,1080]){base.lineStyle(3,0x624638);base.lineBetween(x,200,x,260);base.fillStyle(0xffd487);base.fillEllipse(x,280,38,48);}label(850,370,'纸上江桥',16);}
    if(s.map==='guide'){label(560,270,'接待阅览 · 青白立柱',18);}
    if(s.map==='workshop'){label(420,270,'1F工作台 · 双水波立柱',18);}
    if(s.map==='tea'){label(545,240,'竹椅茶桌');label(800,280,'桥在后窗，木楼在窗外',16);}
  }else{
    // Stone back lane and wooden eaves/front lane have real depth and corners.
    slab(80,225,2040,45,0x89978b);slab(160,580,1880,170,0x8c7a60);
    slab(180,990,1900,130,0xa78961);slab(350,650,140,400,0xa78961);slab(1380,650,140,400,0xa78961);
    // Upper floor sits on continuous piers, visible from the life street.
    for(const x of [1010,1140]){box(base,x,235,70,305,0x465657);base.lineStyle(5,0x9c8460);base.lineBetween(x,470,x+70,350);}
    label(1110,240,'上方悬挑廊／下方支柱',17,550);
    for(const b of m.buildings){
      const g=scene.add.graphics().setDepth(b.y+b.h);layer.add(g);
      const guide=b.kind==='guide',wood=b.kind==='workshop';
      const entranceFloor=guide||wood?1:undefined;
      // Roof plane only: footprint == blocker, doorway notch cut into the lower edge.
      drawTopDownBuilding(g,b,{
        roof:0x64756d,
        ridge:0x44524d,
        wall:0x3b352c,
        eave:0xc2a683,
        ground:0x82958a,
        door:0xf0cd96,
      });
      // Name the floor reached from THIS street, matching its real doorway.
      // A bare total-storey number looked like a conflicting entrance label.
      if(entranceFloor)label(b.x+b.w-56,b.y+b.h-18,`临街 ${entranceFloor}F`,14,b.y+b.h+2);
      label(b.x+b.w/2,b.y+b.h*0.63,b.name,18,b.y+b.h+2);
    }
    // Non-house walls and live closure rails share the actual blocker rectangles.
    for(const w of explorationWalls(s.map,s.unlocked).filter(w=>!m.buildings.includes(w as never))){
      const g=scene.add.graphics().setDepth(w.y+Math.min(w.h,40));layer.add(g);box(g,w.x,w.y,w.w,w.h,0x465657);g.lineStyle(4,0xb99b6d);g.lineBetween(w.x,w.y,w.x+w.w,w.y);
    }
  }
  const stairIds=new Set(['east-down','east-up','west-down','west-up','middle-east-upper','middle-west-upper','middle-east-lower','middle-west-lower','riverfront-down']);
  for(const t of EXP_TARGETS.filter(t=>t.map===s.map&&t.destination)){
    const g=scene.add.graphics().setDepth(t.y-1);layer.add(g);
    if(stairIds.has(t.id)){
      // Treads as flat bands on the ground, with two straight side rails.
      for(let n=0;n<5;n++){box(g,t.x-30,t.y-24+n*10,60,8,n%2?0x6a563c:0xe8d2a8);}
      g.lineStyle(3,0x322d26);g.lineBetween(t.x-34,t.y-30,t.x-34,t.y+28);g.lineBetween(t.x+34,t.y-30,t.x+34,t.y+28);
      g.strokeRect(t.x-30,t.y-24,60,48);
    }
    else if(!['guide-up','guide-down','workshop-up-2','workshop-down-1','workshop-up-3','workshop-down-2'].includes(t.id)){
      // Doorway is a notch on the ground line, not a panel painted on a facade.
      box(g,t.x-32,t.y-6,64,14,0x293c3c);
      box(g,t.x-26,t.y-3,52,9,t.locked&&!s.unlocked?0x624c3e:0xf0cd96);
      box(g,t.x-40,t.y+8,80,4,0xc2aa7d);
      if(t.locked&&!s.unlocked){g.lineStyle(4,0xd9b676);g.lineBetween(t.x-22,t.y-4,t.x+22,t.y+2);g.lineBetween(t.x-22,t.y+2,t.x+22,t.y-4);}
    }else continue;
    if(!hasRouteCue(t.id))label(t.x,t.y+40,t.label,15,t.y+30);
  }
}
