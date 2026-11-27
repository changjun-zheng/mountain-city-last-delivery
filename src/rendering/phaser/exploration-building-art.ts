import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS} from '../../core/exploration-content';
import type {ExplorationSnapshot} from '../../core/exploration';

// Only the two upper workshop floors use these furnishings. Their feet retain
// the existing blocker rectangles; the raised tops project toward the back.
function drawWorkshopFloor(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,s:ExplorationSnapshot):void {
  const m=EXP_MAPS[s.map],b=m.bounds;
  const graphics=(depth:number)=>{const g=scene.add.graphics().setDepth(depth);layer.add(g);return g;};
  const floor=graphics(-70);
  const fill=(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,c:number,a=1)=>{g.fillStyle(c,a);g.fillRect(x,y,w,h);};
  const text=(x:number,y:number,value:string,size=18)=>{
    const t=scene.add.text(x,y,value,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:`${size}px`,color:'#d7d8c7'}).setOrigin(.5).setDepth(-55);layer.add(t);
  };
  const sign=(x:number,y:number,value:string,name:string)=>{
    const t=scene.add.text(x,y,value,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:'20px',align:'center',color:'#122224',backgroundColor:'#f2e8d5',padding:{x:8,y:5}}).setOrigin(.5).setDepth(1000).setName(name);layer.add(t);
  };
  fill(floor,b.x-18,b.y-50,b.w+36,b.h+68,0x233d3d);
  fill(floor,b.x,b.y,b.w,b.h,0x797b70);
  // Broad, quiet boards keep the floor horizontal rather than a dense wall texture.
  floor.lineStyle(1,0x53645e,.45);
  for(let y=b.y+54;y<b.y+b.h;y+=72){floor.lineBetween(b.x,y,b.x+b.w,y);for(let x=b.x+((y%144)?110:250);x<b.x+b.w;x+=300)floor.lineBetween(x,y-72,x,y);}
  fill(floor,b.x,b.y-36,b.w,36,0x506c65);fill(floor,b.x,b.y-40,b.w,5,0xb3ae8f);
  fill(floor,b.x-12,b.y,12,b.h,0x405850);fill(floor,b.x+b.w,b.y,12,b.h,0x405850);
  floor.fillStyle(0xe9bd78,.08);floor.fillPoints([{x:280,y:180},{x:760,y:180},{x:950,y:630},{x:380,y:630}],true);
  text(660,110,m.name,24);
  // Cabinets/workbench: top, thin lip, face, recessed handles and floor contact.
  const cabinet=(w:{x:number;y:number;w:number;h:number},height:number,bench=false)=>{
    const g=graphics(w.y+w.h);
    fill(g,w.x+4,w.y+w.h,w.w+9,9,0x263e38,.25);
    fill(g,w.x,w.y-height,w.w,w.h+height,0x816e55);
    fill(g,w.x+5,w.y-height+4,w.w-10,w.h-6,0xb2a17a);
    fill(g,w.x,w.y+w.h-height,w.w,height,bench?0x455f59:0x526c61);
    fill(g,w.x,w.y+w.h-height,w.w,5,0xd3bc8a);
    fill(g,w.x+w.w-9,w.y-height,9,w.h+height,0x65715e);
    if(bench){
      fill(g,w.x+12,w.y+w.h-height+6,w.w-24,height-6,0x354d49);
      fill(g,w.x+13,w.y+w.h-height+6,12,height-6,0x8c886c);fill(g,w.x+w.w-28,w.y+w.h-height+6,12,height-6,0x8c886c);
      fill(g,w.x+32,w.y+w.h-12,w.w-64,6,0x9c9273);
    }else{
      const drawers=Math.max(1,Math.floor(w.w/65));
      for(let i=0;i<drawers;i++){const x=w.x+7+i*(w.w-18)/drawers;fill(g,x,w.y+w.h-height+9,(w.w-24)/drawers,Math.max(8,height-16),0x60796b);fill(g,x+12,w.y+w.h-height+14,18,3,0xc7c7aa);}
      fill(g,w.x+6,w.y+w.h-5,w.w-12,5,0x334e46);
    }
    return g;
  };
  const tools=(g:Phaser.GameObjects.Graphics,x:number,y:number)=>{
    fill(g,x,y,44,8,0xd0c2a0);fill(g,x+14,y-18,6,29,0x4b6860);fill(g,x+5,y-21,24,7,0x334d4b);
    fill(g,x+51,y-13,32,19,0x6c816e);fill(g,x+56,y-10,22,3,0xbac3a5);
  };
  if(s.map==='workshop2'){
    const island=cabinet(m.walls[0],30);tools(island,421,327);tools(island,474,440);
    const bench=cabinet(m.walls[1],34,true);tools(bench,822,520);fill(bench,934,493,63,30,0xd9c9a4);bench.lineStyle(2,0x678278);bench.lineBetween(944,500,980,514);
    const back=cabinet(m.walls[2],42);tools(back,823,226);tools(back,923,226);
    text(485,250,'工具存放',18);text(902,439,'整理工作台',18);
    fill(floor,665,300,70,20,0xc1b087);floor.lineStyle(3,0x496665);floor.strokeTriangle(673,316,683,301,693,316);floor.lineBetween(702,306,727,302);floor.lineBetween(702,314,727,310);
    // The only street doorway is at the existing east-wall target.
    const door=graphics(-54);
    fill(door,1180,324,12,34,0xa9a88c);fill(door,1180,448,12,39,0xa9a88c);
    fill(door,1166,356,24,91,0x2d4846);fill(door,1172,360,18,83,0x9cb4a3);
    fill(door,1140,366,50,68,0x83998a);fill(door,1136,366,6,68,0xd2c7a6);
    door.lineStyle(2,0x8c9d87);door.lineBetween(1139,369,1139,431);
  }else{
    const storage=cabinet(m.walls[0],40);tools(storage,420,320);tools(storage,539,319);
    const clasp=cabinet(m.walls[1],28);
    if(!s.item){fill(clasp,737,360,39,9,0xe8c35a);clasp.lineStyle(2,0x41645d);clasp.lineBetween(742,362,769,362);clasp.lineBetween(742,367,769,367);}
    else fill(clasp,737,360,39,9,0x829484);
    const box=cabinet(m.walls[4],32);box.lineStyle(3,0x496b63);box.strokeTriangle(1028,278,1050,255,1072,278);
    for(const w of [m.walls[2],m.walls[3]]){
      const screen=graphics(w.y+w.h);
      fill(screen,w.x+2,w.y+w.h,w.w+7,7,0x233d36,.3);
      fill(screen,w.x,w.y-40,w.w,w.h+40,0x49665c);
      fill(screen,w.x,w.y-42,w.w,5,0xc4b68e);
      fill(screen,w.x+3,w.y-34,Math.max(3,w.w-6),w.h+29,0x728679);
      for(let y=w.y+24;y<w.y+w.h;y+=62)fill(screen,w.x,y,w.w,3,0x536e61);
      fill(screen,w.x,w.y+w.h-10,w.w,10,0x354f45);
    }
    sign(760,292,'水波门扣柜\n'+(s.item?'导扣已带走':'可借 · 江纹导扣'),'route01-water-cabinet');
    sign(1060,235,'山纹工具箱','route01-mountain-box');
    sign(1018,627,'↙ 从长屏风下端绕行','route01-screen-way');
    floor.lineStyle(2,0xd2c29a,.8);floor.lineBetween(932,625,926,616);floor.lineBetween(926,616,910,616);
    text(500,251,'储物区',18);
    // Existing upper-street exit, with a flush sill and no new door or blocker.
    fill(floor,1028,785,104,9,0xc9b78f);fill(floor,1028,794,104,5,0x405b50);
  }
  for(const target of EXP_TARGETS.filter(t=>t.map===s.map&&['workshop-up-3','workshop-down-2','workshop-down-1'].includes(t.id))){
    const g=graphics(target.y-1),x=target.x-54,y=target.y-29,up=target.id==='workshop-up-3';
    fill(g,x-9,y-6,126,94,0x344d48);fill(g,x,y-6,108,15,0x9a9e89);
    for(let n=0;n<6;n++){
      const sy=y+8+n*12,c=up?0xaaa58d:0x858f7f;
      fill(g,x,sy,108,8,c);fill(g,x,sy+8,108,4,0x596e61);
      g.lineStyle(1,0xc1b89b,.4);g.lineBetween(x+4,sy,x+104,sy);
    }
    // Solid side cheeks and sloping rails make the change in height legible.
    g.fillStyle(0x627b6b);g.fillPoints([{x:x-9,y:y-8},{x:x-3,y:y-8},{x:x-3,y:y+76},{x:x-9,y:y+84}],true);
    g.lineStyle(4,0xc8b58a);g.lineBetween(x-7,y-14,x-7,y+61);g.lineBetween(x+115,y-14,x+115,y+61);
    g.lineStyle(3,0x4c665b);for(const rx of [x-7,x+115]){g.lineBetween(rx,y-14,rx,y+9);g.lineBetween(rx,y+61,rx,y+84);}
    g.lineStyle(3,0xe1cf9b);const cy=y+39;g.lineBetween(target.x,cy+(up?8:-8),target.x,cy+(up?-8:8));g.lineBetween(target.x,cy+(up?-8:8),target.x-7,cy);g.lineBetween(target.x,cy+(up?-8:8),target.x+7,cy);
  }
}

export function drawBuildingFloor(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,s:ExplorationSnapshot):void {
  if(s.map==='workshop2'||s.map==='workshop3'){drawWorkshopFloor(scene,layer,s);return;}
  const m=EXP_MAPS[s.map],g=scene.add.graphics().setDepth(-70);layer.add(g);
  const rect=(x:number,y:number,w:number,h:number,color:number)=>{g.fillStyle(color);g.fillRect(x,y,w,h);};
  const label=(x:number,y:number,text:string,size=18)=>{const t=scene.add.text(x,y,text,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:`${size}px`,color:'#ffe4ad'}).setOrigin(.5).setDepth(y+25);layer.add(t);};
  if(s.map==='guide2'){
    const b=m.bounds;rect(b.x-18,b.y-50,b.w+36,b.h+68,0x423a32);rect(b.x,b.y,b.w,b.h,0xa17d54);
    for(let x=b.x;x<b.x+b.w;x+=26){g.lineStyle(1,0x765c41);g.lineBetween(x,b.y,x,b.y+b.h);}
    for(const w of m.walls){const wall=scene.add.graphics().setDepth(w.y+w.h);layer.add(wall);wall.fillStyle(0x684734);wall.fillRect(w.x,w.y-22,w.w,w.h+22);wall.fillStyle(0xc69d68);wall.fillRect(w.x-3,w.y-24,w.w+6,25);}
    label(660,105,m.name,24);
    label(350,240,'阅览区');label(950,210,'楼层／纹样导览');rect(920,305,60,35,0xf4dfac);g.lineStyle(3,0x5c7b77);g.strokeTriangle(927,332,937,313,947,332);g.lineBetween(952,317,974,312);g.lineBetween(952,327,974,322);
  }
  for(const target of EXP_TARGETS.filter(t=>t.map===s.map&&['guide-up','guide-down','workshop-up-2'].includes(t.id)&&t.destination)){
    const stairs=scene.add.graphics().setDepth(target.y-1);layer.add(stairs);for(let n=0;n<7;n++){stairs.fillStyle(n%2?0x79684e:0xb29a6e);stairs.fillRect(target.x-48,target.y-35+n*9,96,7);}
  }
  if(s.map==='workshop'){label(320,435,'1F工作台／2F工具／3F门扣',16);}
}
