import Phaser from 'phaser';
import {EXP_MAPS,EXP_TARGETS,type Building} from '../../core/exploration-content';
import {PROLOGUE_INFILL,PROLOGUE_MONUMENT} from '../../core/exploration-prologue';
import {drawTopDownBuilding, drawTopDownRoom} from './exploration-topdown-art';
import {stoneTiles, lightPool} from './exploration-paint';
import {ambient, glowLayer, pool, halo, doorSpill} from './exploration-lighting';
import {modernShopFront,type ModernShopKind} from './exploration-modern-shopfront';
import {hangingBoard, stall, parkedCar, passerby, streetTree, utilityPole, wire, lampPost, bench, kiosk, planter, crateStack, stoneStool, bicycle, laundryPole} from './exploration-street-deco';

// Original modular trial art, informed only by the archived A-01 silhouette and
// warm night palette. The PNG is neither altered nor loaded as a map texture.
export function drawPrologueCity(scene:Phaser.Scene,layer:Phaser.GameObjects.Layer,id:'plaza'|'entry'|'service',makeVisitor:()=>Phaser.GameObjects.Container):void {
  const m=EXP_MAPS[id],base=scene.add.graphics().setDepth(-90);layer.add(base);
  const rect=(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,c:number)=>{g.fillStyle(c);g.fillRect(x,y,w,h);};
  const poly=(g:Phaser.GameObjects.Graphics,p:number[],c:number)=>{g.fillStyle(c);g.fillPoints(p.reduce<Phaser.Math.Vector2[]>((a,_,i)=>{if(i%2===0)a.push(new Phaser.Math.Vector2(p[i],p[i+1]));return a;},[]),true);};
  const label=(x:number,y:number,t:string,size=19,color='#ffe4ad',depth=1600)=>{const o=scene.add.text(x,y,t,{fontFamily:'KaiTi, STKaiti, Microsoft YaHei, serif',fontSize:`${size}px`,color,align:'center'}).setOrigin(.5).setDepth(depth);layer.add(o);return o;};
  // Which shopfront each building wears. Anything not listed keeps the plain box.
  const shopKindOf=(name:string):ModernShopKind|null=>{
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
    if(PROLOGUE_INFILL.includes(b)){
      drawTopDownBuilding(g,b,{
        roof:0x39504f,ridge:0x1f3233,wall:0x253537,eave:0xcdbfa0,ground:0x79857e,
        door:0xf0d49a,facade:0xc9b995,facadeLine:0x87795f,fhCap:92,fhRatio:0.5,
      });
      return;
    }
    lightPool(g,b.x+b.w/2,b.y+b.h+12,92,24);
    // The bookshop reads taller than its neighbours: roof down to two thirds of the
    // wall, which stops a single-storey shop from looking like it wears a hat.
    const fhCap=b.name==='城市书店'?180:170;
    const fhRatio=b.name==='城市书店'?0.63:0.55;
    const fh=Math.min(fhCap,Math.max(76,b.h*fhRatio)),wallTop=b.y+b.h-fh;
    const kind=shopKindOf(b.name);
    // Plan view only: footprint equals the blocker, roof plane on top, doorway notch below.
    drawTopDownBuilding(g,b,{
      roof:b.kind==='service'?0x4f6f6b:0x39504f,
      ridge:0x1f3233,
      wall:0x253537,
      eave:0xcdbfa0,
      ground:0x79857e,
      door:b.kind==='service'?0xffdda0:0xf0d9a8,
      doorInset:b.kind==='service'?72:58,
      facade:0xd3c2a0,
      facadeLine:0x87795f,
      fhCap,fhRatio,
      skipWindows:kind!==null,
    });
    if(kind){
      modernShopFront(g,b,wallTop,fh,kind);
      label(b.x+b.w/2,wallTop+11,b.name,16,'#f2e8d5',b.y+b.h+1);
    }else{
      label(b.x+b.w/2,b.y+b.h*0.63,b.name,18,'#f7ecd2',b.y+b.h+1);
    }
  };
  const link=(x:number,y:number,name:string)=>{const g=scene.add.graphics().setDepth(y-1);layer.add(g);rect(g,x-48,y-17,96,34,0xb7bda7);g.lineStyle(3,0x5e7475);g.strokeRect(x-48,y-17,96,34);g.lineBetween(x-30,y,x+28,y);g.lineBetween(x+28,y,x+17,y-9);label(x,y-42,name,17,'#f1ddb0',1600);};
  const navigation=(x:number,y:number,name:string,direction:number,plateX=x,plateY=y-62)=>{
    const g=scene.add.graphics().setDepth(-2);layer.add(g);
    g.lineStyle(2,0xe8c35a,.7).strokeRoundedRect(x-38,y-13,76,26,7);
    g.lineBetween(x-22*direction,y,x+22*direction,y);
    g.lineBetween(x+22*direction,y,x+13*direction,y-7);
    g.lineBetween(x+22*direction,y,x+13*direction,y+7);
    if(plateX!==x)g.lineStyle(1,0x4f8a7e,.7).lineBetween(x,y+15,plateX,plateY-18);
    const plate=scene.add.text(plateX,plateY,name,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:'17px',color:'#f2e8d5',backgroundColor:'#122224',padding:{x:9,y:6}}).setOrigin(.5).setDepth(-1);layer.add(plate);
    const b=plate.getBounds();g.lineStyle(2,0xe8c35a).lineBetween(b.x+5,b.bottom-1,b.right-5,b.bottom-1);
  };

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
    label(280,245,'导览／操作提示',17,'#fff0c5',1600);label(550,92,'游客服务小店',25);label(550,470,'先观察，再主动交互',18,'#ffe4ad',1600);
    const exit=EXP_TARGETS.find(target=>target.id==='service-exit');
    if(exit)link(exit.x,exit.y,exit.label);
    // Interior lamp: one warm pool over the counter, corners left to go dark.
    ambient(scene,layer,m.width,m.height,{base:0x2a1a0a,alpha:0.09,hazeAlpha:0});
    const gl=glowLayer(scene,layer);
    pool(gl,440,392,200,124,0xffb964,0.22);pool(gl,548,548,118,46,0xffc47a,0.16);
    return;
  }
  rect(base,0,0,m.width,m.height,0x1a2e30);
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
    // Dusk sky: a warm low band behind the far blocks, cooling as it rises.
    base.fillStyle(0xe9a65d,0.1);base.fillRect(0,64,3300,116);
    base.fillStyle(0xd98a4f,0.07);base.fillRect(0,116,3300,64);
    base.fillStyle(0x203637,0.18);base.fillRect(0,0,3300,64);
    sky(180,0x6f8283,38,86,152,112,0);
    sky(180,0x4c6160,56,120,120,104,44);
    sky(180,0x374b4d,78,170,94,86,68);
    // Haze over the far edge so the skyline sits behind the square instead of on it.
    base.fillStyle(0x2a3f3e,0.09);base.fillRect(60,0,3180,180);
    // A low tree belt along the foot of the skyline: the far city meets the square
    // through greenery rather than a straight seam.
    for(let x=-20;x<3400;x+=26){
      const t=Math.abs(Math.sin(x*0.19));
      base.fillStyle(0x2f4f45,0.8);
      base.fillEllipse(x,181-t*6,44,24+t*16);
    }
    const b=m.bounds;rect(base,b.x,b.y,b.w,b.h,0x868779);
    stoneTiles(base,b.x,b.y,b.w,b.h,0x868779,0x9fa08f,0x64665a,110,55);
    // Paving broken into big slabs: joints every 320px read as a laid square rather
    // than one poured surface, and they give the walk scale.
    for(let x=b.x+300;x<b.x+b.w;x+=320){base.fillStyle(0x6f7266,0.4);base.fillRect(x,b.y,3,b.h);base.fillStyle(0xbfbca9,0.24);base.fillRect(x+3,b.y,1,b.h);}
    for(let y=b.y+300;y<b.y+b.h;y+=320){base.fillStyle(0x6f7266,0.4);base.fillRect(b.x,y,b.w,3);base.fillStyle(0xbfbca9,0.24);base.fillRect(b.x,y+3,b.w,1);}
    base.fillStyle(0xc0b89c);base.fillEllipse(740,905,320,320);
    for(let i=1;i<=4;i++){base.lineStyle(1,0x7d7a6c,0.45);base.strokeEllipse(740,905,320*i/4,320*i/4);}
    for(let a=0;a<20;a++){const t=a/20*Math.PI*2+0.08;base.lineStyle(1,0x7d7a6c,0.3);base.lineBetween(740+Math.cos(t)*84,905+Math.sin(t)*84,740+Math.cos(t)*158,905+Math.sin(t)*158);}
    base.lineStyle(3,0x6f7266);base.strokeEllipse(740,905,320,320);
    base.lineStyle(6,0x6f7266,0.4);base.strokeEllipse(740,905,406,406);
    stoneTiles(base,1050,595,2180,120,0xada78e,0xc0b99c,0x7c806f,80,40);base.lineStyle(2,0x7c806f,0.8);base.strokeRect(1050,595,2180,120);
    for(let x=1090;x<3200;x+=160){base.lineStyle(1,0x8b8e7e,.45);base.lineBetween(x,600,x,712);}
    // The ground behind the frontage is a back court, not more pavement: sink it
    // so the gaps between blocks read as alleys rather than grey holes.
    base.fillStyle(0x5f6a64, 0.3);
    base.fillRect(60, 180, 3180, 402);
    base.fillStyle(0x5f6a64, 0.24);
    base.fillRect(60, 978, 3180, 282);
    // The back lane band is ground, not a wall: y 430..498 sits inside the
    // walkable bounds, so nothing here may read as a solid. A darker slab strip
    // with transverse joints and a shallow drain channel keeps the alley tone
    // and stops the top of the frame reading as one empty grey field.
    base.fillStyle(0x46564f, 0.5);
    base.fillRect(60, 430, 3180, 68);
    base.fillStyle(0x364743, 0.6);
    base.fillRect(60, 458, 3180, 6);
    base.fillStyle(0x5c6c62, 0.5);
    base.fillRect(60, 456, 3180, 2);
    base.fillStyle(0x6f7c6e, 0.3);
    base.fillRect(60, 430, 3180, 2);
    base.fillStyle(0x203233, 0.35);
    base.fillRect(60, 496, 3180, 2);
    for(let x=90;x<3220;x+=178){
      base.fillStyle(0x33443f, 0.45);
      base.fillRect(x, 432, 2, 64);
      base.fillStyle(0x66756a, 0.22);
      base.fillRect(x+2, 432, 1, 64);
    }
    rect(base,2830,595,380,700,0x8f9384);
    m.buildings.forEach(modern);
    const deco=(y:number,fn:(gg:Phaser.GameObjects.Graphics)=>void)=>{const gg=scene.add.graphics().setDepth(y);layer.add(gg);fn(gg);};
    deco(560,g=>{hangingBoard(g,1660,470,26,86,0x2f4a4c);hangingBoard(g,2280,470,26,86,0x5a3630);hangingBoard(g,2870,440,24,78,0x3c4a36);});
    // No red lantern rows: the A direction lights the street with shop windows,
    // lamps and the signboards rather than festival decoration.
    deco(700,g=>{stall(g,1760,650,150,90,0xc4553d);stall(g,2760,655,140,88,0x3f7268);});
    deco(660,g=>{parkedCar(g,2040,668,0xc9a93f);});
    deco(690,g=>{passerby(g,1996,700,0x4a5f7a);passerby(g,2240,652,0x7a4a4a);passerby(g,2680,706,0x4f6a4a);passerby(g,2340,712,0x6a5a7a);passerby(g,2470,672,0x8a6a3a);});
    deco(780,g=>{streetTree(g,1640,772,1.1);streetTree(g,2980,780,1);});
    deco(790,g=>{utilityPole(g,2760,796,112);});
    deco(716,g=>{lampPost(g,1740,716);lampPost(g,2360,716);lampPost(g,2920,720);});
    // Square furniture around the monument, so the walk in from the gate has something to look at.
    deco(1014,g=>{bench(g,556,1014,74);});
    deco(985,g=>{bench(g,984,985,68);});
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
      else if(i===1){
        // The kiosk now occupies an existing solid footprint, clear of the first
        // investigation target. Its front edge and depth use the same rectangle.
        kiosk(g,w.x,w.y+w.h,w.w,w.h);
      }else {
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
    g.setName('viewport-monument-body').setData('viewportBounds',{x:r.x,y:ct,width:r.w,height:r.y+r.h+35-ct});
    g.fillStyle(0xb5b09b);g.fillRect(cx-28,ct,56,50);
    g.fillStyle(0x8f8a75);g.fillRect(cx+24,ct,4,50);
    g.fillStyle(0x6f6a58);g.fillRect(cx-28,ct,56,5);
    g.fillStyle(0xf0e7c9);g.fillCircle(cx,ct+26,14);
    g.lineStyle(2,0x8d856a);g.strokeCircle(cx,ct+26,14);
    g.fillStyle(0x5d6a6b);g.fillCircle(cx,ct+26,2);
    g.lineStyle(2,0x5a6a6a);g.lineBetween(cx,ct+26,cx+8,ct+19);g.lineBetween(cx,ct+26,cx-5,ct+20);
    label(cx,cy+r.h/2+24,'解\n放\n碑',15,'#596c6d',961).setName('viewport-monument-name');
    for(const [lx,ly] of [[570,990],[920,990],[570,790],[930,790],[1180,620],[1510,620],[2200,620],[2820,760]]){const l=scene.add.graphics().setDepth(ly);layer.add(l);l.fillStyle(0x4c5b5b);l.fillRect(lx-6,ly-6,12,11);l.fillStyle(0x8b9a95);l.fillRect(lx-6,ly-6,12,2);l.fillStyle(0xffd58b);l.fillCircle(lx,ly-1,3);}
    label(660,1225,'解放碑广场',15,'#f2e8d5',950).setAlpha(.7);label(2130,739,'商业步行街',14,'#f2e8d5',950).setAlpha(.7);navigation(3120,900,'沧白路巷口 →',1,3000,800);
    // Lighting pass: cool wash across the whole map, then every lamp as a warm
    // additive pool. Offsets are measured from the lamp's foot, not its head.
    ambient(scene,layer,m.width,m.height,{base:0x0b2223,alpha:0.07,haze:0x2f4646,hazeAlpha:0.2});
    const gl=glowLayer(scene,layer);
    for(const lx of [1740,2360,2920]){halo(gl,lx,660,38,0xffd79a,0.26);pool(gl,lx,716,124,32,0xffc27a,0.34);}
    for(const b of m.buildings) doorSpill(gl,b.x+b.w/2,b.y+b.h,74,0xffc47a,0.34);
    for(const [lx,ly] of [[570,990],[920,990],[570,790],[930,790],[1180,620],[1510,620],[2200,620],[2820,760]]) pool(gl,lx,ly+5,48,23,0xffd79a,0.2);
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
    label(1080,670,'沧白路 · 高处入口',24);label(1180,902,'栏杆下是木楼与江桥',17);navigation(140,850,'← 返回解放碑',-1,340,930);navigation(440,810,'年轻游客 · 沿街向东 →',1);link(2040,780,'进入上层街区');
    ambient(scene,layer,m.width,m.height);
  }
}
