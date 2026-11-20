import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS,type Building} from '../../core/exploration-content';
import {PROLOGUE_MONUMENT} from '../../core/exploration-prologue';

// Original modular trial art, informed only by the archived A-01 silhouette and
// warm night palette. The PNG is neither altered nor loaded as a map texture.
export function drawPrologueCity(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,id:'plaza'|'entry'|'service',makeVisitor:()=>Phaser.GameObjects.Container):void {
  const m=EXP_MAPS[id],base=scene.add.graphics().setDepth(-90);layer.add(base);
  const rect=(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,c:number)=>{g.fillStyle(c);g.fillRect(x,y,w,h);};
  const poly=(g:Phaser.GameObjects.Graphics,p:number[],c:number)=>{g.fillStyle(c);g.fillPoints(p.reduce<Phaser.Math.Vector2[]>((a,_,i)=>{if(i%2===0)a.push(new Phaser.Math.Vector2(p[i],p[i+1]));return a;},[]),true);};
  const label=(x:number,y:number,t:string,size=19,color='#ffe4ad',depth=1600)=>{const o=scene.add.text(x,y,t,{fontFamily:'KaiTi, STKaiti, Microsoft YaHei, serif',fontSize:`${size}px`,color,align:'center'}).setOrigin(.5).setDepth(depth);layer.add(o);return o;};
  const modern=(b:Building)=>{
    const g=scene.add.graphics().setDepth(b.y+b.h);layer.add(g);
    const top=b.y-85,foot=b.y+b.h;
    poly(g,[b.x+20,foot,b.x+b.w+35,foot,b.x+b.w+65,foot+24,b.x+40,foot+24],0x4b6265);
    rect(g,b.x,top,b.w,b.h+85,b.kind==='service'?0xb7c7c2:0x5b7382);
    poly(g,[b.x+b.w,top,b.x+b.w+32,top-26,b.x+b.w+32,foot-22,b.x+b.w,foot],0x354f60);
    poly(g,[b.x-7,top,b.x+20,top-25,b.x+b.w+32,top-26,b.x+b.w,top],0x889b9c);
    for(let y=top+16;y<foot-85;y+=66)for(let x=b.x+15;x<b.x+b.w-35;x+=62){
      rect(g,x,y,48,49,(Math.floor(x/62)+Math.floor(y/66))%3===0?0xd1b983:0x7b9caa);
      g.lineStyle(2,0xb7c6c5);g.lineBetween(x+6,y+3,x+39,y+45);
    }
    for(let y=top+72;y<foot-80;y+=66)rect(g,b.x,y,b.w,6,0x344f61);
    rect(g,b.x,foot-85,b.w,18,0xc6a46b);
    for(let x=b.x+12;x<b.x+b.w-15;x+=54){rect(g,x,foot-62,43,58,0xe8c58b);rect(g,x+19,foot-62,3,58,0x556c75);}
    rect(g,b.x,foot-3,b.w,8,0xc4c4ad);
    if(b.kind==='service'){const x=b.x+b.w/2;rect(g,x-31,foot-74,62,74,0x2f5666);rect(g,x-25,foot-67,50,61,0xb5d4cd);rect(g,x+13,foot-33,4,10,0xffe2a0);}
    label(b.x+b.w/2,foot-76,b.name,18,'#fff0c5',foot+1);
  };
  const link=(x:number,y:number,name:string)=>{const g=scene.add.graphics().setDepth(y-1);layer.add(g);rect(g,x-48,y-17,96,34,0xb7bda7);g.lineStyle(3,0x5e7475);g.strokeRect(x-48,y-17,96,34);g.lineBetween(x-30,y,x+28,y);g.lineBetween(x+28,y,x+17,y-9);label(x,y-42,name,17,'#f1ddb0',y+1);};
  if(id==='service'){
    rect(base,0,0,1100,650,0x284d59);const b=m.bounds;
    rect(base,b.x-18,b.y-90,b.w+36,b.h+105,0x2c4750);rect(base,b.x,b.y,b.w,b.h,0xb9b89e);rect(base,b.x,b.y-90,b.w,90,0x92b0b0);
    for(let y=b.y;y<600;y+=36)for(let x=b.x;x<b.x+b.w;x+=62){base.lineStyle(1,0x8b9f9a);base.strokeRect(x,y,60,34);}
    for(let x=b.x+20;x<b.x+b.w-50;x+=100){rect(base,x,b.y-73,70,55,0xc4d5ca);rect(base,x+32,b.y-73,4,55,0x5f8188);}
    for(const w of m.walls){const g=scene.add.graphics().setDepth(w.y+w.h);layer.add(g);rect(g,w.x,w.y-24,w.w,w.h+24,0x446d79);rect(g,w.x-4,w.y-30,w.w+8,22,0xd2c3a0);}
    rect(base,247,269,66,43,0xead9a8);base.lineStyle(3,0x467d85);base.lineBetween(258,296,299,279);base.strokeCircle(260,295,5);base.strokeCircle(299,279,5);
    label(280,245,'导览／操作提示',17,'#fff0c5',390);label(550,98,'游客服务小店',25);label(550,280,'先观察，再主动交互',18,'#ffe4ad',390);link(540,590,'返回服务店门口');return;
  }
  rect(base,0,0,m.width,m.height,0x294a60);
  if(id==='plaza'){
    for(let x=0;x<3300;x+=135){const h=80+(x%5)*25;rect(base,x,180-h,115,h,0x3c596e);for(let y=190-h;y<170;y+=24)rect(base,x+15,y,68,4,0xbfae75);}
    const b=m.bounds;rect(base,b.x,b.y,b.w,b.h,0x98a49e);
    for(let y=b.y;y<b.y+b.h;y+=40)for(let x=b.x;x<b.x+b.w;x+=80){base.lineStyle(1,0x738c8b,.55);base.strokeRect(x+(y%3)*10,y,78,38);}
    base.fillStyle(0xc2bfa4);base.fillEllipse(740,925,680,450);base.lineStyle(4,0x858f83);base.strokeEllipse(740,925,680,450);base.strokeEllipse(740,925,510,320);
    rect(base,1050,595,2180,120,0xb8b39b);rect(base,2830,595,380,700,0xa4a795);
    for(let x=1100;x<3200;x+=120){rect(base,x,630,26,4,0xe8d4a2);rect(base,x,680,26,4,0xe8d4a2);}
    m.buildings.forEach(modern);
    for(const [i,w] of m.walls.slice(m.buildings.length+1).entries()){
      const g=scene.add.graphics().setDepth(w.y+w.h);layer.add(g);
      if(i===2){rect(g,w.x,w.y,w.w,w.h,0x4c6265);for(let y=w.y;y<w.y+w.h;y+=11)rect(g,w.x,y,w.w,7,0xac8b5b);rect(g,w.x+10,w.y+w.h-5,7,15,0x304d5c);rect(g,w.x+w.w-16,w.y+w.h-5,7,15,0x304d5c);}
      else {rect(g,w.x,w.y,w.w,w.h,0x7d8e85);for(let x=w.x+12;x<w.x+w.w;x+=26){g.fillStyle(x%3?0x5e795b:0xbe9b45);g.fillEllipse(x,w.y+9,35,30);g.fillStyle(0xf0b77c);g.fillCircle(x+3,w.y+1,4);}}
    }
    const g=scene.add.graphics().setDepth(PROLOGUE_MONUMENT.y+PROLOGUE_MONUMENT.h);layer.add(g);
    const x=PROLOGUE_MONUMENT.x,y=PROLOGUE_MONUMENT.y,cx=x+90;
    g.fillStyle(0xf4ce83,.13);g.fillEllipse(cx,y+70,310,160);
    poly(g,[x,y+55,x+22,y+32,x+158,y+32,x+180,y+55,x+180,y+105,x,y+105],0xb6b69e);
    for(let i=0;i<4;i++){rect(g,x+9+i*8,y+49-i*9,162-i*16,15,0xd8cba7);rect(g,x+7+i*8,y+63+i*11,166-i*16,9,0xc7bd9f);}
    poly(g,[cx-32,660,cx+28,660,cx+35,y+48,cx-38,y+48],0xe9dec0);
    poly(g,[cx+28,660,cx+48,647,cx+51,y+34,cx+35,y+48],0xb4baa9);
    poly(g,[cx-32,660,cx-48,647,cx-50,y+34,cx-38,y+48],0xcac6ad);
    rect(g,cx-52,643,104,16,0xdacaa3);rect(g,cx-46,620,92,23,0xc6c3aa);g.fillStyle(0xe3d6b5);g.fillEllipse(cx,618,91,32);rect(g,cx-3,580,6,28,0xb8b8a4);g.fillStyle(0xe8d9b5);g.fillCircle(cx,579,5);
    g.fillStyle(0xf8edcf);g.fillCircle(cx,690,20);g.lineStyle(3,0x69787a);g.strokeCircle(cx,690,20);g.lineBetween(cx,690,cx+10,680);g.lineBetween(cx,690,cx-4,676);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;g.fillStyle(0x68797b);g.fillCircle(cx+Math.cos(a)*16,690+Math.sin(a)*16,1.5);}
    label(cx,782,'解\n放\n碑',17,'#596c6d',961);
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
