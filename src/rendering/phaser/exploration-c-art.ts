import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS,explorationWalls} from '../../core/exploration-content';
import type {ExplorationSnapshot} from '../../core/exploration';
import {drawBuildingFloor} from './exploration-building-art';
import {drawTopDownBuilding, drawTopDownRoom, drawTopDownRoofPlane} from './exploration-topdown-art';

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
    // Interior as a plan view: one floor plane, a wall band with real thickness,
    // a doorway notch on the lower side, props keeping their own footprints.
    drawTopDownRoom(base,m.bounds,m.walls,{
      floor:0xb99a70,floorLine:0x947650,wall:0x38403a,wallTop:0x5b6660,
      outside:0xa89070,doorway:0xffe4ad,
      propTop:0x8a6a4a,propEdge:0x5a4436,propLine:0x3f3228,
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
    if(s.map==='upper'){
      // Steps stay on the ground plane: flat treads, no skewed risers.
      box(base,150,700,260,240,0x8e9084);
      for(let y=706;y<936;y+=14){base.lineStyle(2,0x6f7168,.8);base.lineBetween(154,y,406,y);}
      box(base,1945,700,180,240,0x8e9084);
      for(let y=706;y<936;y+=14){base.lineStyle(2,0x6f7168,.8);base.lineBetween(1949,y,2121,y);}
      // Retaining mass: a wall top with visible thickness, blocker unchanged.
      const retaining=scene.add.graphics().setDepth(799);layer.add(retaining);box(retaining,420,800,1520,240,0x465657);
      retaining.lineStyle(1,0x6a7972,.85);
      for(let y=808;y<1032;y+=52)for(let x=432;x<1936;x+=64)retaining.strokeRect(x,y,58,44);
      retaining.lineStyle(5,0xb99b6d);retaining.lineBetween(420,803,1940,803);
      retaining.lineStyle(2,0x39504f);retaining.lineBetween(420,1039,1940,1039);
      // The storey below the cliff is a roof plane you can see and cannot enter.
      for(const b of m.buildings.filter(b=>b.kind==='guide'||b.kind==='workshop')){
        const g=scene.add.graphics().setDepth(1040);layer.add(g);
        drawTopDownRoofPlane(g,{x:b.x,y:815,w:b.w,h:225},0x5f6b5f,0x44524d,0xb99b6d);
      }
      label(150,566,'西口回沧白路入口',17,1260);
    }else if(s.map==='middle'){
      slab(670,750,140,300,0xa78961);slab(1290,750,120,300,0xa78961);slab(160,930,1880,120,0xa78961);
      label(710,646,'导览1F后街',15);label(1620,650,'木作2F街门',15);
    }else{
      slab(180,990,1900,130,0xa78961);slab(350,650,140,400,0xa78961);slab(1380,650,140,400,0xa78961);
      // Upper floor sits on continuous piers, visible from the life street.
      for(const x of [1010,1140]){box(base,x,235,70,305,0x465657);base.lineStyle(5,0x9c8460);base.lineBetween(x,470,x+70,350);}
      label(1110,240,'上方悬挑廊／下方支柱',17,550);
    }
    for(const b of m.buildings){
      const g=scene.add.graphics().setDepth(b.y+b.h);layer.add(g);
      const guide=b.kind==='guide',wood=b.kind==='workshop';
      const storeys=(guide||wood)?(s.map==='middle'?2:s.map==='lower'&&wood?3:1):1;
      // Roof plane only: footprint == blocker, doorway notch cut into the lower edge.
      drawTopDownBuilding(g,b,{
        roof:0x64756d,
        ridge:0x44524d,
        wall:0x3b352c,
        eave:0xc2a683,
        ground:0x82958a,
        door:0xf0cd96,
      });
      // Storey count stays readable without a facade: a flat corner tag on the roof.
      if(storeys>1)label(b.x+b.w-24,b.y+b.h-18,`${storeys}F`,14,b.y+b.h+2);
      label(b.x+b.w/2,b.y+b.h*0.63,b.name,18,b.y+b.h+2);
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
    label(t.x,t.y+40,t.label,15,t.y+30);
  }
  if(s.map==='middle'){
    const g=scene.add.graphics().setDepth(1040);layer.add(g);g.lineStyle(4,0xffd487);for(const y of [966,976]){g.lineBetween(1912,y,1923,y-6);g.lineBetween(1923,y-6,1935,y);g.lineBetween(1935,y,1947,y-6);}label(1930,935,s.unlocked?'江纹封道已通':'江纹封道',18,1040);
  }
}
