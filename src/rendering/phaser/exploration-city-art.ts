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
    // The whole lower view is behind the original y=980 rail blocker. Keep a
    // single dry bank beneath the shops; river begins beyond its masonry edge.
    rect(base,0,980,m.width,320,0x376570);
    for(let i=0;i<70;i++)rect(base,(i*131)%2200,1200+(i*29)%100,20+i%5*11,1,i%4===0?0x93b9af:0x5d9095);
    const bank=[60,1027,2140,1038,2200,1265,1650,1240,1240,1203,850,1190,420,1180,60,1194];
    poly(base,bank,0x959b87);
    // The riverside walk is one continuous ledge, with a face down to water.
    const shore=[60,1194,420,1180,850,1190,1240,1203,1650,1240,2200,1265];
    poly(base,[60,1160,420,1146,850,1156,1240,1169,1650,1206,2200,1231,2200,1265,1650,1240,1240,1203,850,1190,420,1180,60,1194],0xb6b09d);
    const waterfront=scene.add.graphics().setDepth(-88);layer.add(waterfront);
    for(let i=0;i<shore.length-2;i+=2){
      const [x,y,x2,y2]=shore.slice(i,i+4);
      poly(waterfront,[x,y,x2,y2,x2,y2+12,x,y+12],0x6e8279);
      waterfront.lineStyle(3,0xc9bea4).lineBetween(x,y,x2,y2);
      waterfront.lineStyle(1,0x7c897b,.4).lineBetween(x,y-17,x2,y2-17);
    }
    // A diagonal bridge leaves a real approach on this bank. Its deck, tower
    // legs and spread footing continue into the river rather than floating.
    const bridge=scene.add.graphics().setDepth(-87);layer.add(bridge);
    // Short stone abutment and paved feeder join the existing waterfront walk.
    poly(bridge,[1225,1172,1285,1134,1337,1134,1280,1184],0xb6b09d);
    poly(bridge,[1278,1147,1339,1138,1345,1154,1280,1165],0x6e8279);
    bridge.lineStyle(2,0xc9bea4).lineBetween(1225,1172,1285,1134);
    bridge.lineBetween(1285,1134,1337,1134);
    poly(bridge,[1280,1147,1334,1138,1818,1300,1732,1300],0x82948e);
    poly(bridge,[1280,1147,1732,1300,1732,1312,1280,1160],0x5c7778);
    bridge.lineStyle(3,0xb6c2b4).lineBetween(1290,1145,1770,1300);
    bridge.lineStyle(2,0xa4b5aa).lineBetween(1334,1138,1818,1300);
    for(const [x,y] of [[1483,1193],[1530,1209]]){
      rect(bridge,x-7,y-110,14,177,0x829b97);rect(bridge,x+3,y-110,4,177,0x627f80);
      poly(bridge,[x-15,y+64,x+16,y+64,x+24,y+71,x-21,y+71],0x657f7f);
      bridge.lineStyle(2,0xb1c1b3).lineBetween(x-7,y-111,x+7,y-111);
    }
    rect(bridge,1476,1090,68,9,0xa6b3a5);
    bridge.lineStyle(1,0xc3c9b6,.8);
    for(let n=0;n<5;n++){
      bridge.lineBetween(1483,1083,1330+n*28,1160+n*10);
      bridge.lineBetween(1530,1099,1610+n*32,1233+n*11);
    }
    // Wall and weathered rock are connected across the cliff, not separate piers.
    rect(base,60,980,2080,73,0x778879);rect(base,60,980,2080,21,0x8c9785);
    base.lineStyle(1,0x536e64,.45);
    for(let x=80;x<2140;x+=163)base.lineBetween(x,1002,x+15,1048);
    poly(base,[60,1038,280,1042,365,1034,620,1049,920,1040,1190,1050,1450,1038,1780,1053,2140,1045,2140,1072,60,1065],0x87937d);
    // Small, differently sized street buildings sit on this same terrace.
    const shops=scene.add.graphics().setDepth(-86);layer.add(shops);
    for(const [x,y,w,h,facade] of [[190,1046,214,94,0xb5aa8e],[640,1052,180,103,0x9eaa96],[990,1047,227,112,0xac9475]]){
      const foot=y+h,roofY=foot-60;
      rect(shops,x-8,foot,w+22,12,0x788373);
      rect(shops,x,roofY,w,foot-roofY,facade);
      poly(shops,[x+w,roofY,x+w+12,roofY-6,x+w+12,foot+3,x+w,foot],0x657d71);
      poly(shops,[x-8,roofY,x+8,y,x+w-8,y-3,x+w+13,roofY-3],0x526e65);
      rect(shops,x-8,roofY-1,w+21,4,0xaeb39a);
      for(let col=0;col<3;col++){
        const wx=x+18+col*(w-30)/3;
        rect(shops,wx,roofY+14,32,29,col===1?0xe1b97f:0x4d6d67);
        rect(shops,wx+15,roofY+14,2,29,0x7d8b75);
      }
      rect(shops,x+12,foot-8,w-23,8,0x6d7b6a);
      rect(shops,x+w-29,roofY+3,20,10,0xc1bfa8);
      shops.lineStyle(1,0x788e80).lineBetween(x+w-26,roofY+7,x+w-12,roofY+7);
    }
    // Sparse rooted vegetation softens the retaining wall without hiding it.
    for(const [x,y] of [[100,1050],[460,1052],[875,1057],[1240,1055],[1840,1060],[2110,1054]]){
      base.fillStyle(0x577c61).fillEllipse(x,y,55,22);base.fillStyle(0x77916a).fillEllipse(x-10,y-6,30,16);
    }
    const b=m.bounds;rect(base,b.x,b.y,b.w,750,0xa6aa98);
    rect(base,60,686,2080,294,0xb8b19d);
    // Modest slab modules, with broad quiet areas, instead of a giant wall grid.
    base.lineStyle(1,0x7c8c7e,.16);
    for(let row=0;row<10;row++){
      const y=700+row*28;base.lineBetween(60,y,2140,y);
      for(let x=60+(row%2)*24;x<2140;x+=48){if((x/24+row)%3!==0)base.lineBetween(x,y,x,y+26);}
    }
    rect(base,60,944,2080,36,0xc1b69f);rect(base,60,943,2080,2,0xd1c1a2);
    base.lineStyle(1,0x8e9887,.35);for(let x=60;x<2140;x+=48)base.lineBetween(x,945,x,978);
    // An open paved approach links the existing facade to the actual portal.
    poly(base,[1840,540,2048,540,2125,820,1950,820],0xc6b99d);
    base.lineStyle(2,0x8b9a87,.55).lineBetween(2048,543,2125,820);
    m.buildings.forEach(modern);
    const canopy=scene.add.graphics().setDepth(700);layer.add(canopy);
    canopy.fillStyle(0x234b43,.16).fillPoints([{x:1840,y:608},{x:2070,y:608},{x:2090,y:648},{x:1856,y:648}],true);
    poly(canopy,[1820,528,2050,528,2070,600,1840,600],0x46665f);
    poly(canopy,[1840,600,2070,600,2070,610,1840,610],0x728572);
    canopy.lineStyle(2,0xb5b69a).lineBetween(1840,600,2070,600);
    for(const x of [1870,1950,2030])canopy.lineStyle(1,0x658577,.7).lineBetween(x-18,532,x,597);
    // Roof is cantilevered from the existing blocked facade; no new ground posts.
    const threshold=scene.add.graphics().setDepth(-2);layer.add(threshold);
    threshold.lineStyle(3,0xd9c392).lineBetween(1990,796,2090,796);
    threshold.lineStyle(2,0x648577).lineBetween(1990,803,2090,803);
    const rail=scene.add.graphics().setDepth(981);layer.add(rail);
    rect(rail,60,980,2080,8,0x546f63);rect(rail,60,953,2080,5,0xbdb69c);
    for(let x=60;x<2140;x+=48){rect(rail,x,956,4,27,0x637d6d);rect(rail,x,956,1,27,0xb1b39a);}
    const visitor=EXP_TARGETS.find(t=>t.id==='visitor')!;const actor=makeVisitor();actor.setPosition(visitor.x,visitor.y).setDepth(visitor.y);layer.add(actor);label(visitor.x,visitor.y-61,'年轻游客',17,'#ffe4ad',1600);
    label(1080,670,'沧白路 · 高处入口',24);
    navigation(140,850,'← 返回解放碑',-1,340,930);navigation(440,810,'年轻游客 · 沿街向东 →',1);
    navigation(2040,780,'东侧门廊 · 进入上街 →',1,1830,828);
    const overlookPlate=scene.add.text(1420,924,'下方街屋 · 沿岸步道与江桥',{fontFamily:'Microsoft YaHei, sans-serif',fontSize:'16px',color:'#f2e8d5',backgroundColor:'#63776b',padding:{x:8,y:5}}).setOrigin(.5).setDepth(982);layer.add(overlookPlate);
    ambient(scene,layer,m.width,m.height);
  }
}
