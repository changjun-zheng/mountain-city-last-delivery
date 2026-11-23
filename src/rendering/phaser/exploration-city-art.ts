import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS,type Building} from '../../core/exploration-content';
import {PROLOGUE_MONUMENT} from '../../core/exploration-prologue';
import {drawTopDownBuilding, drawTopDownRoom} from './exploration-topdown-art';
import {stoneTiles, lightPool} from './exploration-paint';
import {ambient, glowLayer, pool, halo, doorSpill} from './exploration-lighting';
import {shopFront,type ShopKind} from './exploration-shopfront';
import {hangingBoard, lantern, stall, parkedCar, passerby, streetTree, utilityPole, wire, lampPost, bench, kiosk, planter, crateStack, stoneStool, bicycle, laundryPole} from './exploration-street-deco';

// Original modular trial art, informed only by the archived A-01 silhouette and
// warm night palette. The PNG is neither altered nor loaded as a map texture.
export function drawPrologueCity(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,id:'plaza'|'entry'|'service',makeVisitor:()=>Phaser.GameObjects.Container):void {
  const m=EXP_MAPS[id],base=scene.add.graphics().setDepth(-90);layer.add(base);
  const rect=(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,c:number)=>{g.fillStyle(c);g.fillRect(x,y,w,h);};
  const poly=(g:Phaser.GameObjects.Graphics,p:number[],c:number)=>{g.fillStyle(c);g.fillPoints(p.reduce<Phaser.Math.Vector2[]>((a,_,i)=>{if(i%2===0)a.push(new Phaser.Math.Vector2(p[i],p[i+1]));return a;},[]),true);};
  const label=(x:number,y:number,t:string,size=19,color='#ffe4ad',depth=1600)=>{const o=scene.add.text(x,y,t,{fontFamily:'KaiTi, STKaiti, Microsoft YaHei, serif',fontSize:`${size}px`,color,align:'center'}).setOrigin(.5).setDepth(depth);layer.add(o);return o;};
  // Which shopfront each building wears. Anything not listed keeps the plain box.
  const shopKindOf=(name:string):ShopKind|null=>{
    if(name==='城市书店')return 'books';
    if(name==='游客服务')return 'service';
    if(name==='城市商廊')return 'arcade';
    if(name==='步行街商店')return 'grocer';
    if(name==='巷口商铺')return 'snack';
    if(name==='街角橱窗')return 'window';
    if(name==='沿街小店')return 'grocer';
    if(name==='过渡街巷')return 'tea';
    return null;
  };
  const modern=(b:Building)=>{
    const g=scene.add.graphics().setDepth(b.y+b.h);layer.add(g);
    lightPool(g,b.x+b.w/2,b.y+b.h+12,92,24);
    // The bookshop reads taller than its neighbours: roof down to two thirds of the
    // wall, which stops a single-storey shop from looking like it wears a hat.
    const fhCap=b.name==='城市书店'?180:170;
    const fhRatio=b.name==='城市书店'?0.63:0.55;
    const fh=Math.min(fhCap,Math.max(76,b.h*fhRatio)),wallTop=b.y+b.h-fh;
    const kind=shopKindOf(b.name);
    // Plan view only: footprint equals the blocker, roof plane on top, doorway notch below.
    drawTopDownBuilding(g,b,{
      roof:b.kind==='service'?0x7c8a86:0x556063,
      ridge:0x323d40,
      wall:0x323d45,
      eave:0xc9c0a8,
      ground:0x98a49e,
      door:b.kind==='service'?0xffe2a0:0xf2dcb0,
      doorInset:b.kind==='service'?72:58,
      facade:0xdccaa6,
      facadeLine:0x8a7f66,
      fhCap,fhRatio,
      skipWindows:kind!==null,
    });
    if(kind){
      shopFront(g,b,wallTop,fh,kind);
      label(b.x+b.w/2,wallTop+10,b.name,15,'#f4e8c6',b.y+b.h+1);
    }else{
      label(b.x+b.w/2,b.y+b.h*0.63,b.name,18,'#fff0c5',b.y+b.h+1);
    }
  };
  const link=(x:number,y:number,name:string)=>{const g=scene.add.graphics().setDepth(y-1);layer.add(g);rect(g,x-48,y-17,96,34,0xb7bda7);g.lineStyle(3,0x5e7475);g.strokeRect(x-48,y-17,96,34);g.lineBetween(x-30,y,x+28,y);g.lineBetween(x+28,y,x+17,y-9);label(x,y-42,name,17,'#f1ddb0',1600);};
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
    label(280,245,'导览／操作提示',17,'#fff0c5',1600);label(550,92,'游客服务小店',25);label(550,470,'先观察，再主动交互',18,'#ffe4ad',1600);link(760,546,'返回服务店门口');
    // Interior lamp: one warm pool over the counter, corners left to go dark.
    ambient(scene,layer,m.width,m.height,{base:0x2a1a0a,alpha:0.09,hazeAlpha:0});
    const gl=glowLayer(scene,layer);
    pool(gl,440,392,200,124,0xffb964,0.22);pool(gl,548,548,118,46,0xffc47a,0.16);
    return;
  }
  rect(base,0,0,m.width,m.height,0x294a60);
  if(id==='plaza'){
    // Far blocks read as distant roofs, not as a row of facades on the horizon.
    // Skyline in three receding bands: pale far towers, a mid band, then the near
    // roofline. One flat row of grey blocks was killing the depth of every shot.
    const sky=(y0:number,col:number,hMin:number,hMax:number,step:number,w:number,off:number)=>{
      for(let x=-40+off;x<3400;x+=step){
        const t=Math.abs(Math.sin(x*0.073+off));
        const h=hMin+t*(hMax-hMin);
        base.fillStyle(col);base.fillRect(x,y0-h,w,h);
        base.fillStyle(0xa8bcc6,0.4);base.fillRect(x,y0-h,w,3);
        base.fillStyle(0x000000,0.12);base.fillRect(x,y0-h,w,Math.round(w*0.06));
        if(h>70){
          base.fillStyle(0xe8d3a8,0.16);
          for(let wy=y0-h+14;wy<y0-12;wy+=18)for(let wx=x+8;wx<x+w-8;wx+=16)if(((wx+wy)%9)<2)base.fillRect(wx,wy,4,5);
        }
      }
    };
    sky(180,0x7b8ea0,38,86,152,112,0);
    sky(180,0x5d7285,56,120,120,104,44);
    sky(180,0x475d70,78,170,94,86,68);
    // Haze over the far edge so the skyline sits behind the square instead of on it.
    base.fillStyle(0x2a4b5c,0.07);base.fillRect(60,0,3180,180);
    // A low tree belt along the foot of the skyline: the far city meets the square
    // through greenery rather than a straight seam.
    for(let x=-20;x<3400;x+=26){
      const t=Math.abs(Math.sin(x*0.19));
      base.fillStyle(0x30524a,0.8);
      base.fillEllipse(x,181-t*6,44,24+t*16);
    }
    const b=m.bounds;rect(base,b.x,b.y,b.w,b.h,0x9ba1a1);
    stoneTiles(base,b.x,b.y,b.w,b.h,0x9ba1a1,0xb1b7b6,0x757b7c,110,55);
    // Paving broken into big slabs: joints every 320px read as a laid square rather
    // than one poured surface, and they give the walk scale.
    for(let x=b.x+300;x<b.x+b.w;x+=320){base.fillStyle(0x7d7868,0.4);base.fillRect(x,b.y,3,b.h);base.fillStyle(0xc9c3b2,0.26);base.fillRect(x+3,b.y,1,b.h);}
    for(let y=b.y+300;y<b.y+b.h;y+=320){base.fillStyle(0x7d7868,0.4);base.fillRect(b.x,y,b.w,3);base.fillStyle(0xc9c3b2,0.26);base.fillRect(b.x,y+3,b.w,1);}
    base.fillStyle(0xc2bda6);base.fillEllipse(740,905,320,320);
    for(let i=1;i<=4;i++){base.lineStyle(1,0x8a8578,0.45);base.strokeEllipse(740,905,320*i/4,320*i/4);}
    for(let a=0;a<20;a++){const t=a/20*Math.PI*2+0.08;base.lineStyle(1,0x8a8578,0.3);base.lineBetween(740+Math.cos(t)*84,905+Math.sin(t)*84,740+Math.cos(t)*158,905+Math.sin(t)*158);}
    base.lineStyle(3,0x7d7868);base.strokeEllipse(740,905,320,320);
    base.lineStyle(6,0x7d7868,0.4);base.strokeEllipse(740,905,406,406);
    stoneTiles(base,1050,595,2180,120,0xb8b39b,0xc9c4ab,0x8d9184,80,40);base.lineStyle(2,0x8d9184,0.8);base.strokeRect(1050,595,2180,120);
    for(let x=1090;x<3200;x+=160){base.lineStyle(1,0x9a9d8e,.45);base.lineBetween(x,600,x,712);}
    // The ground behind the frontage is a back court, not more pavement: sink it
    // so the gaps between blocks read as alleys rather than grey holes.
    base.fillStyle(0x77807f, 0.3);
    base.fillRect(60, 180, 3180, 402);
    base.fillStyle(0x77807f, 0.24);
    base.fillRect(60, 978, 3180, 282);
    rect(base,2830,595,380,700,0xa4a795);
    // Low back-row houses filling the gaps between the frontage shops. They sit
    // behind the front line (shallower depth) so the row reads continuous from
    // the street without putting an invisible blocker where people walk.
    const infill=(x:number,w:number,y:number,h:number)=>{
      const g=scene.add.graphics().setDepth(y+h);layer.add(g);
      drawTopDownBuilding(g,{x,y,w,h},{
        roof:0x556063,ridge:0x323d40,wall:0x323d45,eave:0xc9c0a8,ground:0x98a49e,
        door:0xe8d0a4,facade:0xcbba98,facadeLine:0x8a7f66,fhCap:92,fhRatio:0.5,
      });
    };
    infill(2126,194,400,160);
    infill(2816,94,420,140);
    infill(1466,234,380,180);
    m.buildings.forEach(modern);
    const deco=(y:number,fn:(gg:Phaser.GameObjects.Graphics)=>void)=>{const gg=scene.add.graphics().setDepth(y);layer.add(gg);fn(gg);};
    deco(560,g=>{hangingBoard(g,1660,470,26,86,0x2f4a4c);hangingBoard(g,2280,470,26,86,0x5a3630);hangingBoard(g,2870,440,24,78,0x3c4a36);});
    deco(534,g=>{lantern(g,1878,538,10);lantern(g,1952,538,10);lantern(g,2524,538,10);lantern(g,2652,538,10);lantern(g,3004,500,9);lantern(g,3068,500,9);});
    deco(700,g=>{stall(g,1760,650,150,90,0xb4433a);stall(g,2760,655,140,88,0x336f68);});
    deco(660,g=>{parkedCar(g,2040,668,0xc9a93f);});
    deco(690,g=>{passerby(g,1996,700,0x4a5f7a);passerby(g,2240,652,0x7a4a4a);passerby(g,2680,706,0x4f6a4a);passerby(g,2340,712,0x6a5a7a);passerby(g,2470,672,0x8a6a3a);});
    deco(780,g=>{streetTree(g,1640,772,1.1);streetTree(g,2980,780,1);});
    deco(790,g=>{utilityPole(g,2760,796,112);});
    deco(716,g=>{lampPost(g,1740,716);lampPost(g,2360,716);lampPost(g,2920,720);});
    // Square furniture around the monument, so the walk in from the gate has something to look at.
    deco(1014,g=>{bench(g,556,1014,74);});
    deco(985,g=>{bench(g,984,985,68);});
    deco(890,g=>{kiosk(g,898,890,94,54);});
    deco(800,g=>{streetTree(g,1078,800,1.05);});
    // People near the monument, so the square the player first lands in is inhabited.
    deco(762,g=>{passerby(g,626,762,0x47405a);});
    deco(800,g=>{passerby(g,700,800,0x3f5f6a);});
    deco(986,g=>{passerby(g,846,986,0x6a4a3a);});
    deco(704,g=>{passerby(g,986,704,0x7a4a52);});
    // A paler band of paving runs from the spawn point across the square to the
    // street mouth, so the first minute has a route to follow rather than a field.
    base.fillStyle(0xc6bfa9, 0.42);
    base.fillRect(392, 698, 704, 116);
    base.fillStyle(0xe0d9c4, 0.22);
    base.fillRect(392, 698, 704, 6);
    base.fillStyle(0x6f6a5c, 0.3);
    base.fillRect(392, 808, 704, 7);
    base.lineStyle(1, 0x8e8878, 0.22);
    for (let x = 430; x < 1090; x += 76) base.lineBetween(x, 704, x, 808);
    // the square's north edge: a line of bollards and two lamps
    deco(756,g=>{lampPost(g,606,756);lampPost(g,946,756);});
    deco(724,g=>{planter(g,738,672,148,44);});
    // Gaps between the blocks read as empty plots. Planters, crates and washing
    // strung between them close the row without adding walkable geometry.
    deco(604,g=>{
      planter(g,2150,586,124,44);
      crateStack(g,2284,606,46);
      laundryPole(g,2138,564,188);
      crateStack(g,2832,606,42);
      stoneStool(g,2894,614,8);
    });
    deco(1312,g=>{
      planter(g,2086,1294,142,44);
      crateStack(g,2244,1314,46);
      bicycle(g,2722,1318);
      stoneStool(g,2800,1302,9);
    });
    // South of the promenade was a bare field; give it something to walk past.
    deco(862,g=>{
      planter(g,1416,850,132,42);
      stall(g,1244,898,132,80,0x8a5a36);
      bicycle(g,1562,944);
      stoneStool(g,1636,930,8);
      stoneStool(g,1668,952,7);
      bench(g,1706,962,66);
      streetTree(g,1850,930,0.95);
      crateStack(g,1996,884,42);
    });
    for(const [i,w] of m.walls.slice(m.buildings.length+1).entries()){
      const g=scene.add.graphics().setDepth(w.y+w.h);layer.add(g);
      if(i===2){
        // A raised planter by the bookshop, same family as the ones edging the square.
        rect(g,w.x,w.y,w.w,w.h,0xa2acb0);
        rect(g,w.x,w.y,w.w,8,0xbcc6c8);
        g.lineStyle(2,0x6f8079,0.9);g.strokeRect(w.x,w.y,w.w,w.h);
        let k=0;
        for(let x=w.x+16;x<w.x+w.w-8;x+=22){
          const rr=12+(k%3)*3;k++;
          g.fillStyle(0x3d6346);g.fillCircle(x,w.y+w.h*0.55+(k%2?2:-2),rr);
          g.fillStyle(0x50804f);g.fillCircle(x-4,w.y+w.h*0.5-4,rr*0.72);
          g.fillStyle(0x66975c,0.8);g.fillCircle(x+5,w.y+w.h*0.55+5,rr*0.42);
        }
        for(let x=w.x+40;x<w.x+w.w-10;x+=52){g.fillStyle(0xcc7f63);g.fillCircle(x,w.y+w.h*0.4,3);}
      }
      else {
        // Stone planter full of shrubs, the sort that edges a public square.
        g.fillStyle(0x000000,0.14);g.fillRect(w.x+4,w.y+5,w.w,w.h);
        rect(g,w.x,w.y,w.w,w.h,0x8e8c7c);
        rect(g,w.x,w.y,w.w,8,0xada895);
        g.fillStyle(0x000000,0.16);g.fillRect(w.x,w.y+w.h-8,w.w,8);
        g.lineStyle(1,0x6f6a5c,0.7);g.strokeRect(w.x,w.y,w.w,w.h);
        let k=0;
        for(let x=w.x+15;x<w.x+w.w-6;x+=21){
          const rr=11+(k%3)*4;k++;
          g.fillStyle(0x3d6346);g.fillCircle(x,w.y+w.h*0.55+(k%2?2:-2),rr);
          g.fillStyle(0x50804f);g.fillCircle(x-4,w.y+w.h*0.5-4,rr*0.7);
          g.fillStyle(0x66975c,0.8);g.fillCircle(x+5,w.y+w.h*0.55+4,rr*0.4);
        }
        for(let x=w.x+34;x<w.x+w.w-8;x+=46){g.fillStyle(0xd8826a);g.fillCircle(x,w.y+w.h*0.45,3);}
      }
    }
    const g=scene.add.graphics().setDepth(PROLOGUE_MONUMENT.y+PROLOGUE_MONUMENT.h);layer.add(g);
    const r=PROLOGUE_MONUMENT,cx=r.x+r.w/2,cy=r.y+r.h/2;
    // Three-step plinth sized to the blocker, then the monument standing on it:
    // front wall with stone courses, a dark cap, and the clock above that.
    for(let i=0;i<4;i++){g.fillStyle(0x16282a,0.15*(1-i/4)*(1-i/4));g.fillRect(r.x+10+i*8,r.y+r.h+2+i*8,r.w-12-i*14,9);}
    g.fillStyle(0x969c92);g.fillRect(r.x,r.y,r.w,r.h);
    g.fillStyle(0x000000,0.16);g.fillRect(r.x,r.y+r.h-5,r.w,5);
    g.fillStyle(0xadb0a0);g.fillRect(r.x+10,r.y+7,r.w-20,r.h-14);
    g.fillStyle(0x000000,0.14);g.fillRect(r.x+10,r.y+r.h-18,r.w-20,4);
    g.fillStyle(0xc2c3b3);g.fillRect(r.x+22,r.y+15,r.w-44,r.h-30);
    g.fillStyle(0x8a8d80,0.4);g.fillRect(r.x+22,r.y+15,r.w-44,3);
    g.lineStyle(1,0x8a8d80,0.45);g.strokeRect(r.x+22,r.y+15,r.w-44,r.h-30);
    const bw=76,bh=112,thk=8,footY=cy-2,topY=footY-bh;
    // Shaft: front face with courses, a dark right thickness, and a lit cap plane
    // so the marker reads as a standing block instead of a flat panel.
    g.fillStyle(0xc6c1ac);g.fillRect(cx-bw/2,topY,bw-thk,bh);
    g.fillStyle(0xa39d88);g.fillRect(cx+bw/2-thk,topY,thk,bh);
    g.fillStyle(0x000000,0.24);g.fillRect(cx+bw/2-2,topY,2,bh);
    g.fillStyle(0xd9d4c1);g.fillRect(cx-bw/2,topY,bw,11);
    g.fillStyle(0x8d8875,0.55);g.fillRect(cx-bw/2,topY+11,bw,2);
    g.lineStyle(1,0x9a947e,0.32);for(let y=topY+40;y<footY-14;y+=22)g.lineBetween(cx-bw/2+3,y,cx+bw/2-3,y);
    // a single inscription cartouche near the top; the rest stays bare stone
    g.fillStyle(0xb0ab96,0.7);g.fillRect(cx-26,topY+26,52,52);
    g.lineStyle(1,0x8b866f,0.6);g.strokeRect(cx-26,topY+26,52,52);
    g.fillStyle(0xf0ead2,0.85);for(let i=0;i<3;i++)g.fillRect(cx-19+i*15,topY+40,9,22);
    // clock turret above the shaft, kept small so the silhouette stays a spire
    const ct=topY-50;
    g.fillStyle(0xb5b09b);g.fillRect(cx-28,ct,56,50);
    g.fillStyle(0x8f8a75);g.fillRect(cx+24,ct,4,50);
    g.fillStyle(0x6f6a58);g.fillRect(cx-28,ct,56,5);
    g.fillStyle(0xf0e7c9);g.fillCircle(cx,ct+26,14);
    g.lineStyle(2,0x8d856a);g.strokeCircle(cx,ct+26,14);
    g.fillStyle(0x5d6a6b);g.fillCircle(cx,ct+26,2);
    g.lineStyle(2,0x5a6a6a);g.lineBetween(cx,ct+26,cx+8,ct+19);g.lineBetween(cx,ct+26,cx-5,ct+20);
    label(cx,cy+r.h/2+24,'解\n放\n碑',15,'#596c6d',961);
    for(const [lx,ly] of [[570,990],[920,990],[570,790],[930,790],[1180,620],[1510,620],[2200,620],[2820,760]]){const l=scene.add.graphics().setDepth(ly);layer.add(l);l.fillStyle(0x4c5b5b);l.fillRect(lx-6,ly-6,12,11);l.fillStyle(0x8b9a95);l.fillRect(lx-6,ly-6,12,2);l.fillStyle(0xffd58b);l.fillCircle(lx,ly-1,3);}
    label(660,1225,'解放碑广场',15,'#e2cfa6',950).setAlpha(.62);label(2130,739,'商业步行街',14,'#e2cfa6',950).setAlpha(.62);label(2970,976,'街巷向东 · 沧白路入口',12,'#e2cfa6',950).setAlpha(.55);link(3120,900,'前往沧白路');
    // Lighting pass: cool wash across the whole map, then every lamp as a warm
    // additive pool. Offsets are measured from the lamp's foot, not its head.
    ambient(scene,layer,m.width,m.height);
    const gl=glowLayer(scene,layer);
    for(const lx of [1878,1952,2524,2652,3004,3068]){halo(gl,lx,538,30,0xffb765,0.2);pool(gl,lx,594,78,24,0xffbc72,0.26);}
    for(const lx of [1740,2360,2920]){halo(gl,lx,660,34,0xffd79a,0.22);pool(gl,lx,716,112,30,0xffc27a,0.3);}
    for(const b of m.buildings) doorSpill(gl,b.x+b.w/2,b.y+b.h,64,0xffc47a,0.28);
    for(const [lx,ly] of [[570,990],[920,990],[570,790],[930,790],[1180,620],[1510,620],[2200,620],[2820,760]]) pool(gl,lx,ly+5,42,21,0xffd79a,0.16);
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
    const visitor=EXP_TARGETS.find(t=>t.id==='visitor')!;const actor=makeVisitor();actor.setPosition(visitor.x,visitor.y).setDepth(visitor.y);layer.add(actor);label(visitor.x,visitor.y-61,'年轻游客',17,'#ffe4ad',1600);
    label(1080,670,'沧白路 · 高处入口',24);label(1180,902,'栏杆下是木楼与江桥',17);link(140,850,'返回解放碑');link(2040,780,'进入上层街区');
    ambient(scene,layer,m.width,m.height);
  }
}
