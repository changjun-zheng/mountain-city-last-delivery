import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS,type Building} from '../../core/exploration-content';
import {PROLOGUE_MONUMENT} from '../../core/exploration-prologue';
import {drawTopDownBuilding, drawTopDownRoom} from './exploration-topdown-art';

// Original modular trial art, informed only by the archived A-01 silhouette and
// warm night palette. The PNG is neither altered nor loaded as a map texture.
export function drawPrologueCity(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,id:'plaza'|'entry'|'service',makeVisitor:()=>Phaser.GameObjects.Container):void {
  const m=EXP_MAPS[id],base=scene.add.graphics().setDepth(-90);layer.add(base);
  const rect=(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,c:number)=>{g.fillStyle(c);g.fillRect(x,y,w,h);};
  const poly=(g:Phaser.GameObjects.Graphics,p:number[],c:number)=>{g.fillStyle(c);g.fillPoints(p.reduce<Phaser.Math.Vector2[]>((a,_,i)=>{if(i%2===0)a.push(new Phaser.Math.Vector2(p[i],p[i+1]));return a;},[]),true);};
  const label=(x:number,y:number,t:string,size=19,color='#ffe4ad',depth=1600)=>{const o=scene.add.text(x,y,t,{fontFamily:'KaiTi, STKaiti, Microsoft YaHei, serif',fontSize:`${size}px`,color,align:'center'}).setOrigin(.5).setDepth(depth);layer.add(o);return o;};
  const modern=(b:Building)=>{
    const g=scene.add.graphics().setDepth(b.y+b.h);layer.add(g);
    // Plan view only: footprint equals the blocker, roof plane on top, doorway notch below.
    drawTopDownBuilding(g,b,{
      roof:b.kind==='service'?0x93a39c:0x64756d,
      ridge:0x44524d,
      wall:0x323d45,
      eave:0xcbd3ca,
      ground:0x98a49e,
      door:b.kind==='service'?0xffe2a0:0xf2dcb0,
      doorInset:b.kind==='service'?72:58,
    });
    label(b.x+b.w/2,b.y+b.h/2,b.name,18,'#fff0c5',b.y+b.h+1);
  };
  const link=(x:number,y:number,name:string)=>{const g=scene.add.graphics().setDepth(y-1);layer.add(g);rect(g,x-48,y-17,96,34,0xb7bda7);g.lineStyle(3,0x5e7475);g.strokeRect(x-48,y-17,96,34);g.lineBetween(x-30,y,x+28,y);g.lineBetween(x+28,y,x+17,y-9);label(x,y-42,name,17,'#f1ddb0',y+1);};
  if(id==='service'){
    rect(base,0,0,1100,650,0x284d59);const b=m.bounds;
    // Shop floor as a plan: wall band with thickness, doorway notch, till as a footprint.
    rect(base,b.x-44,b.y-44,b.w+88,b.h+88,0x8c9b96);
    drawTopDownRoom(base,b,m.walls,{
      floor:0xc0a274,floorLine:0x9c7f55,wall:0x33454c,wallTop:0x536b6f,
      outside:0xa8b4ac,doorway:0xffe2a0,
      propTop:0xa8875a,propEdge:0x59422e,propLine:0x3c2d1e,
    });
    rect(base,247,269,66,43,0xead9a8);base.lineStyle(3,0x467d85);base.lineBetween(258,296,299,279);base.strokeCircle(260,295,5);base.strokeCircle(299,279,5);
    label(280,245,'导览／操作提示',17,'#fff0c5',390);label(550,92,'游客服务小店',25);label(550,470,'先观察，再主动交互',18,'#ffe4ad',390);link(760,546,'返回服务店门口');return;
  }
  rect(base,0,0,m.width,m.height,0x294a60);
  if(id==='plaza'){
    // Far blocks read as distant roofs, not as a row of facades on the horizon.
    for(let x=-20;x<3320;x+=130){const d=62+(x%5)*16;rect(base,x,180-d,108,d,0x35505f);rect(base,x,180-d,108,7,0x4b6a78);base.lineStyle(1,0x2c4552,.7);for(let y=180-d+11;y<178;y+=9)base.lineBetween(x+4,y,x+104,y);}
    const b=m.bounds;rect(base,b.x,b.y,b.w,b.h,0x98a49e);
    for(let y=b.y;y<b.y+b.h;y+=26)for(let x=b.x;x<b.x+b.w;x+=52){base.lineStyle(1,0x738c8b,.55);base.strokeRect(x+(y%3)*7,y,50,24);}
    base.fillStyle(0xb8b298);base.fillEllipse(740,905,320,320);base.lineStyle(3,0x858f83);base.strokeEllipse(740,905,320,320);base.strokeEllipse(740,905,238,238);
    rect(base,1050,595,2180,120,0xb8b39b);base.lineStyle(2,0x8d9184);base.strokeRect(1050,595,2180,120);
    for(let x=1070;x<3200;x+=40){base.lineStyle(1,0x9a9d8e,.6);base.lineBetween(x,600,x,712);}
    rect(base,2830,595,380,700,0xa4a795);
    m.buildings.forEach(modern);
    for(const [i,w] of m.walls.slice(m.buildings.length+1).entries()){
      const g=scene.add.graphics().setDepth(w.y+w.h);layer.add(g);
      if(i===2){rect(g,w.x,w.y,w.w,w.h,0x3a4a52);for(let y=w.y+4;y<w.y+w.h-4;y+=10)rect(g,w.x+4,y,w.w-8,8,0xa08a5f);g.lineStyle(3,0x2c3a42);g.strokeRect(w.x,w.y,w.w,w.h);}
      else {rect(g,w.x,w.y,w.w,w.h,0x7d8e85);for(let x=w.x+12;x<w.x+w.w;x+=26){g.fillStyle(x%3?0x5e795b:0xbe9b45);g.fillEllipse(x,w.y+9,35,30);g.fillStyle(0xf0b77c);g.fillCircle(x+3,w.y+1,4);}}
    }
    const g=scene.add.graphics().setDepth(PROLOGUE_MONUMENT.y+PROLOGUE_MONUMENT.h);layer.add(g);
    const r=PROLOGUE_MONUMENT,cx=r.x+r.w/2,cy=r.y+r.h/2;
    // Plan view: a plinth matching the blocker, tower top and clock seen from above.
    g.fillStyle(0x8f9790);g.fillRect(r.x-3,r.y-3,r.w+6,r.h+6);
    g.fillStyle(0xd6cba9);g.fillRect(r.x,r.y,r.w,r.h);
    g.lineStyle(2,0xa9a184);g.strokeRect(r.x+7,r.y+7,r.w-14,r.h-14);
    g.lineStyle(1,0xbcb394);g.strokeRect(r.x+16,r.y+16,r.w-32,r.h-32);
    g.fillStyle(0x2f3d3d,.22);g.fillEllipse(cx+26,cy+18,150,54);
    g.fillStyle(0x9a9276);g.fillRect(cx-24,cy-24,48,48);
    g.fillStyle(0xefe6c8);g.fillRect(cx-20,cy-20,40,40);
    g.lineStyle(2,0x8d856a);g.strokeRect(cx-24,cy-24,48,48);
    g.fillStyle(0xf8edcf);g.fillCircle(cx,cy,11);g.lineStyle(2,0x69787a);g.strokeCircle(cx,cy,11);
    g.lineBetween(cx,cy,cx+7,cy-6);g.lineBetween(cx,cy,cx-4,cy-5);
    label(cx,cy+r.h/2+24,'解\n放\n碑',17,'#596c6d',961);
    for(const [lx,ly] of [[570,990],[920,990],[570,790],[930,790],[1180,620],[1510,620],[2200,620],[2820,760]]){const l=scene.add.graphics().setDepth(ly);layer.add(l);l.fillStyle(0xffd58b,.13);l.fillCircle(lx,ly,28);rect(l,lx-7,ly-4,14,8,0xffd58b);}
    label(660,1225,'解放碑广场',21,'#f1ddb0');label(2130,739,'商业步行街',20);label(2970,976,'街巷向东 · 沧白路入口',18);link(3120,900,'前往沧白路');
  }else{
    // Drop-facing platform: a blocked river/cliff strip and miniature lower
    // stilted facades convey height rather than another walkable timber court.
    rect(base,0,980,2200,320,0x356b78);
    for(let i=0;i<65;i++)rect(base,(i*137)%2200,1000+(i*41)%290,35+(i%4)*22,2,0x6f9b9f);
    for(const [x,w] of [[140,220],[450,240],[800,250],[1110,210]]){
      rect(base,x,1080,w,145,0xa4714c);poly(base,[x-15,1080,x+25,1040,x+w,1040,x+w+28,1075,x+w,1085],0x38575d);poly(base,[x+w,1082,x+w+28,1075,x+w+28,1205,x+w,1225],0x5f4739);
      for(let p=x+17;p<x+w-20;p+=42){rect(base,p,1100,27,30,0xffd184);rect(base,p,1151,27,30,0xffd184);rect(base,p,1225,8,64,0x624c39);}rect(base,x,1142,w,7,0x5e4537);
    }
    base.lineStyle(7,0xb9c4b4);base.lineBetween(1320,1220,2180,1148);for(const x of [1560,2010]){rect(base,x,1010,10,195,0x91aaa7);base.lineStyle(3,0xb9c4b4);base.lineBetween(x,1010,x-190,1210);base.lineBetween(x,1010,x+190,1170);}
    const b=m.bounds;rect(base,b.x,b.y,b.w,750,0x99aaa5);
    for(let y=b.y;y<980;y+=38)for(let x=b.x;x<b.x+b.w;x+=80){base.lineStyle(1,0x6f8a89,.55);base.strokeRect(x,y,78,36);}
    rect(base,60,700,2080,180,0xb5b6a0);m.buildings.forEach(modern);
    const rail=scene.add.graphics().setDepth(981);layer.add(rail);rect(rail,60,953,2080,7,0xb7ae8d);rect(rail,60,980,2080,8,0x536a69);for(let x=60;x<2140;x+=40)rect(rail,x,956,6,30,0x536a69);
    const visitor=EXP_TARGETS.find(t=>t.id==='visitor')!;const actor=makeVisitor();actor.setPosition(visitor.x,visitor.y).setDepth(visitor.y);layer.add(actor);label(visitor.x,visitor.y-61,'年轻游客',17,'#ffe4ad',visitor.y+1);
    label(1080,670,'沧白路 · 高处入口',24);label(1180,902,'栏杆下是木楼与江桥',17);link(140,850,'返回解放碑');link(2040,780,'进入上层街区');
  }
}
