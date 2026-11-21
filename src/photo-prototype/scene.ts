import Phaser from 'phaser';
import {MAP,SITES,WALLS} from './content';
import {preloadPhotoAssets,preparePhotoAssets} from './assets';
import type {PhotoRuntime} from './runtime';

// Shared ratio table (1 unit = 1 px on the 2200x1300 plate, 1 m = 66 units).
// Visitor 130u (game-scaled from 1.70m), slab 26x24u, stair riser 12u.
const CH=130;
const GROUND_FROM=620;
const GROUND_TO=1300;
const SLAB_PERIOD_W=416;
const SLAB_PERIOD_H=341;

export function mountScene(root:HTMLElement,r:PhotoRuntime,keys:Set<string>,update:()=>void){
 const abort=new AbortController();let mouseActive=false,swayTarget=0,sway=0;
 const forcedSway=new URLSearchParams(location.search).get('photo-sway')==='1'?1:undefined;
 window.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;mouseActive=true;swayTarget=Phaser.Math.Clamp((e.clientX-innerWidth/2)/(innerWidth*.35),-1,1);},{signal:abort.signal});
 window.addEventListener('pointerout',e=>{if(!e.relatedTarget){mouseActive=false;swayTarget=0;}},{signal:abort.signal});
 window.addEventListener('blur',()=>{mouseActive=false;swayTarget=0;},{signal:abort.signal});
 const game=new Phaser.Game({parent:root,type:Phaser.CANVAS,width:innerWidth,height:innerHeight,backgroundColor:'#6d7f80',banner:false,audio:{noAudio:true},input:{keyboard:false,mouse:false,touch:false},scene:{
  preload(this:Phaser.Scene){preloadPhotoAssets(this);},
  create(this:Phaser.Scene){
   preparePhotoAssets(this);
   const life=this.add.graphics().setDepth(-850);
   const floor=this.add.graphics().setDepth(-500);
   const markers=this.add.graphics().setDepth(-200);
   const front=this.add.graphics().setDepth(2000);
   const overlay=this.add.graphics().setDepth(3000);
   const shadow=this.add.graphics();
   const actor=this.add.graphics();
   const actorImg=this.textures.exists('photo-charM')?this.add.image(0,0,'photo-charM').setOrigin(.5,1).setVisible(false):undefined;
   const npcImg=this.textures.exists('photo-npcOld')?this.add.image(0,0,'photo-npcOld').setOrigin(.5,1).setVisible(false):undefined;
   const far=this.textures.exists('photo-farCity')?this.add.image(0,0,'photo-farCity').setOrigin(0).setDepth(-900):undefined;
   const slab=this.textures.exists('photo-slab')?this.add.tileSprite(0,0,1,1,'photo-slab').setOrigin(0).setDepth(-600):undefined;
   const blds=[
    {wx:260,wy:1030,w:280,h:560,key:'photo-tea'},
    {wx:1900,wy:1090,w:240,h:420,key:'photo-shop'},
    {wx:980,wy:700,w:260,h:190,key:'photo-gate'},
   ].map(b=>({...b,img:this.textures.exists(b.key)?this.add.image(0,0,b.key).setOrigin(.5,1):undefined}));
   const hintText=this.add.text(0,0,'',{fontFamily:'system-ui, "Microsoft YaHei", sans-serif',fontSize:'15px',color:'#ffe6b0',backgroundColor:'#101416cc',padding:{x:10,y:5}}).setOrigin(.5,1).setDepth(4000).setVisible(false);
   const dialogText=this.add.text(0,0,'',{fontFamily:'system-ui, "Microsoft YaHei", sans-serif',fontSize:'16px',color:'#fff2d8',backgroundColor:'#141a1ee6',padding:{x:14,y:10},wordWrap:{width:Math.min(innerWidth-80,560)},lineSpacing:6}).setOrigin(.5,1).setDepth(4001).setVisible(false);
   let prevF=false,prevT=false,prevR=false,clock=0,idle=0,facing=1,previous={x:r.x,y:r.y};
   root.dataset.assetsReady='true';
   this.events.on('update',(_t:number,delta:number)=>{
    const dt=Math.min(delta,50),any=(...k:string[])=>k.some(v=>keys.has(v)),mx=Number(any('KeyD','ArrowRight'))-Number(any('KeyA','ArrowLeft')),my=Number(any('KeyS','ArrowDown'))-Number(any('KeyW','ArrowUp'));
    r.zoom=any('ShiftLeft','ShiftRight')?1.8:1;r.move(mx,my,dt/1000);r.flash=Math.max(0,r.flash-delta);
    const distance=Math.hypot(r.x-previous.x,r.y-previous.y),moving=distance>.01;
    previous={x:r.x,y:r.y};idle=moving?0:idle+dt;clock+=moving?dt:0;if(mx)facing=mx<0?-1:1;
    sway=forcedSway??(sway+((mouseActive?swayTarget:0)-sway)*.12);
    const w=this.scale.width,h=this.scale.height,c=r.site>=0?r.composition(w,h):null,k=c?.k??Math.max(w/MAP.width,h/MAP.height)*1.35;
    const ox=c?.ox??Phaser.Math.Clamp(w/2-r.x*k,w-MAP.width*k,0),oy=c?.oy??Phaser.Math.Clamp(h*.84-r.y*k,h-MAP.height*k,0);
    const sx=(u:number)=>ox+u*k,sy=(u:number)=>oy+u*k;
    life.clear();floor.clear();markers.clear();front.clear();overlay.clear();actor.clear();shadow.clear();
    if(r.mode==='indoor'){
     overlay.fillStyle(0x2a201a,1);overlay.fillRect(0,0,w,h);
     overlay.fillStyle(0x6b5238,1);overlay.fillPoints([{x:w*.08,y:h},{x:w*.92,y:h},{x:w*.74,y:h*.56},{x:w*.26,y:h*.56}],true);
     overlay.fillStyle(0x3a2d22,1);overlay.fillRect(0,0,w,h*.56);
     overlay.fillStyle(0xe8b268,.85);overlay.fillRect(w*.37,h*.17,w*.26,h*.28);
     overlay.lineStyle(3,0x241a12,1);overlay.strokeRect(w*.37,h*.17,w*.26,h*.28);
     overlay.fillStyle(0x8a6440,1);overlay.fillRect(w*.41,h*.62,w*.18,h*.05);overlay.fillRect(w*.43,h*.67,w*.03,h*.16);overlay.fillRect(w*.54,h*.67,w*.03,h*.16);
     overlay.fillStyle(0xf2b266,.22);overlay.fillCircle(w*.5,h*.18,70);
     hintText.setText('F 出门').setPosition(w/2,h-70).setVisible(true);dialogText.setVisible(false);
     update();return;
    }
    // Far plate: Yuzhong skyline + Jialing river, 2200x620 covering world 0..620.
    if(far)far.setPosition(ox,oy).setDisplaySize(MAP.width*k,620*k);
    else{for(let y=0;y<620*k;y+=6)rect(overlay,0,y,w,6,Phaser.Display.Color.GetColor(196,168,140));}
    // Ground: seamless slab tile, no seams, ratios guaranteed by the table.
    if(slab){slab.setPosition(ox,oy+GROUND_FROM*k).setSize(MAP.width*k,(GROUND_TO-GROUND_FROM)*k).setTileScale(SLAB_PERIOD_W*k/1024,SLAB_PERIOD_H*k/1024);}
    else{floor.fillStyle(0x8f8d7c,1);floor.fillRect(ox,oy+GROUND_FROM*k,MAP.width*k,(GROUND_TO-GROUND_FROM)*k);}
    // Shoreline stone railing: posts every 90u, two rails.
    for(let x=0;x<=MAP.width;x+=90){floor.fillStyle(0x9d9789,1);floor.fillRect(sx(x)-5*k,sy(GROUND_FROM-26),10*k,26*k);}
    floor.lineStyle(6*k,0xaba595,1);floor.lineBetween(ox,sy(GROUND_FROM-24),ox+MAP.width*k,sy(GROUND_FROM-24));
    floor.lineStyle(3*k,0x7d786c,1);floor.lineBetween(ox,sy(GROUND_FROM-12),ox+MAP.width*k,sy(GROUND_FROM-12));
    // Four-step stair, 12u riser / 20u tread, stepped inward to read as terraces.
    for(let n=0;n<4;n++){const y0=GROUND_FROM+40+n*20,inset=n*10;
     rect(floor,sx(1390+inset),sy(y0),(220-inset*2)*k,18*k,n%2?0xb0ab98:0xbcb7a2);
     rect(floor,sx(1390+inset),sy(y0)+14*k,(220-inset*2)*k,6*k,0x4f4e48);
     rect(floor,sx(1390+inset),sy(y0),(220-inset*2)*k,2*k,0xd2ceb8,.65);}
    // Buildings: stone plinth so each block sits on the street, then the plate.
    for(const b of blds){if(!b.img)continue;
     floor.fillStyle(0x8a8578,1);floor.fillRect(sx(b.wx-b.w*.42),sy(b.wy)+9*k,b.w*.84*k,10*k);
     floor.fillStyle(0x1c2426,.16);floor.fillEllipse(sx(b.wx),sy(b.wy)+12,b.w*.65*k,14*k);
     b.img.setPosition(sx(b.wx),sy(b.wy)+18*k).setDisplaySize(b.w*k,b.h*k).setDepth(b.wy);
    }
    // Life on the river and in the air: boats drift slowly, egrets fly with visible wings.
    for(let i=0;i<2;i++){const p=((_t/1000)/210+i*.5)%1,bx=-300+p*2900,by=545+i*38;
     life.fillStyle(0x2f3536,.9);life.fillEllipse(sx(bx),sy(by),92*k,18*k);
     life.fillStyle(0x7d5f42,.95);life.fillEllipse(sx(bx-8),sy(by-10),44*k,13*k);
     life.lineStyle(2.5*k,0x9c8a63,.9);life.lineBetween(sx(bx+16),sy(by-22),sx(bx+16),sy(by-4));
    }
    for(let i=0;i<4;i++){const span=2700,period=88+i*11,p=(((_t/1000)/period)+i*.27)%1,bx=-140+p*span,by=505+i*24+Math.sin(p*6+i)*8;
     const s=24*k,flap=Math.sin(_t/1000*4.6+i*1.7)*.6,lev=.55+flap*.45;
     life.fillStyle(0x2c3a3c,.55);life.fillEllipse(sx(bx),sy(by)+1.5*k,s*1.05,s*.42);
     life.fillTriangle(sx(bx),sy(by),sx(bx)-s*1.2,sy(by)+s*lev*.8,sx(bx)-s*.32,sy(by)-s*.6);
     life.fillTriangle(sx(bx),sy(by),sx(bx)+s*1.2,sy(by)+s*lev*.8,sx(bx)+s*.32,sy(by)-s*.6);
     life.fillStyle(0xf7f5ee,.98);life.fillEllipse(sx(bx),sy(by),s*.85,s*.3);
     life.fillTriangle(sx(bx),sy(by),sx(bx)-s*1.1,sy(by)+s*lev*.7,sx(bx)-s*.3,sy(by)-s*.5);
     life.fillTriangle(sx(bx),sy(by),sx(bx)+s*1.1,sy(by)+s*lev*.7,sx(bx)+s*.3,sy(by)-s*.5);
    }
    // Camera sites.
    for(let i=0;i<SITES.length;i++){const s=SITES[i],nx=sx(s.x),ny=sy(s.y);
     markers.lineStyle(2,i===r.nearby?0xffe3a0:0xd8bf87,.85);markers.strokeEllipse(nx,ny,56*k,20*k);
     markers.fillStyle(0xf0d89d,.85);markers.fillTriangle(nx,ny-16*k,nx-5*k,ny-26*k,nx+5*k,ny-26*k);}
    // Player + shadow, height 130u from the ratio table.
    if(r.site<0){
     shadow.fillStyle(0x17272d,.4);shadow.fillEllipse(sx(r.x),sy(r.y)+2,46*k,12*k);
     if(actorImg){
      const key=r.gender?'photo-charF':'photo-charM';
      if(actorImg.texture.key!==key)actorImg.setTexture(key);
      const bob=moving?Math.abs(Math.sin(clock/110))*2.4*k:0;
      actorImg.setDisplaySize(CH*390/520*k,CH*k).setPosition(sx(r.x),sy(r.y)-bob).setFlipX(facing<0).setDepth(r.y+1).setVisible(true);
     }else{actor.setPosition(sx(r.x),sy(r.y)).setDepth(r.y+1);actor.fillStyle(0x3c7775);actor.fillRect(-9*k,-44*k,18*k,30*k);actor.fillStyle(0xf0c99a);actor.fillCircle(0,-52*k,9*k);}
    }else actorImg?.setVisible(false);
    // ---- Interaction: old teahouse NPC, teahouse door, three souvenirs, weather ----
    const npc={x:760,y:980},door={x:300,y:1030},giftSpots=[[420,1180],[1600,1200],[1000,760]];
    if(npcImg){npcImg.setDisplaySize(CH*k*251/620,CH*k).setPosition(sx(npc.x),sy(npc.y)).setDepth(npc.y+1).setVisible(r.mode==='world'&&r.site<0);}
    // Door on the teahouse frontage: dark opening + two panel leaves.
    const dx=sx(door.x),dy=sy(door.y),dw=44*k,dh=88*k;
    front.fillStyle(0x241a12,1);front.fillRect(dx-dw/2,dy-dh,dw,dh);
    front.fillStyle(0x8a5a34,1);front.fillRect(dx-dw/2+3*k,dy-dh+3*k,dw/2-4*k,dh-3*k);front.fillRect(dx+1*k,dy-dh+3*k,dw/2-4*k,dh-3*k);
    front.fillStyle(0xd8a45a,.95);front.fillCircle(dx+7*k,dy-dh*.55,2.2*k);
    giftSpots.forEach(([gx,gy],i)=>{if(r.gifts[i])return;front.fillStyle(0xffe6a0,.24);front.fillCircle(sx(gx),sy(gy),10*k);front.fillStyle(0xffd270,1);front.fillCircle(sx(gx),sy(gy),3.4*k);});
    if(r.rain)for(let i=0;i<48;i++){const rx=((i*173+_t*.35)%(w+60))-30,ry=((i*97+_t*1.05)%(h+80))-40;overlay.lineStyle(1,0xd2e2ec,.34);overlay.lineBetween(rx,ry,rx-5,ry+16);}
    // Viewfinder: dim the plate, gold frame, thirds, corner ticks, subject outline.
    if(c){rect(overlay,0,0,w,h,0x000000,.42);const f=c.frame;
     overlay.lineStyle(2,0xf0c96a);overlay.strokeRect(f.x,f.y,f.w,f.h);
     overlay.lineStyle(1,0xf0c96a,.35);
     for(const n of[1,2]){overlay.lineBetween(f.x+f.w*n/3,f.y,f.x+f.w*n/3,f.y+f.h);overlay.lineBetween(f.x,f.y+f.h*n/3,f.x+f.w,f.y+f.h*n/3);}
     overlay.lineStyle(4,0xffe0a0);
     for(const[xx,yy,sxx,syy]of[[f.x,f.y,1,1],[f.x+f.w,f.y,-1,1],[f.x,f.y+f.h,1,-1],[f.x+f.w,f.y+f.h,-1,-1]]){overlay.lineBetween(xx,yy,xx+12*sxx,yy);overlay.lineBetween(xx,yy,xx,yy+12*syy);}
     const sub=c.subject;if(sub.x>=f.x&&sub.y>=f.y&&sub.x+sub.w<=f.x+f.w&&sub.y+sub.h<=f.y+f.h){overlay.lineStyle(2,0xffdfa0,.5);overlay.strokeRect(sub.x,sub.y,sub.w,sub.h);}}
    if(r.time===1)rect(overlay,0,0,w,h,0x0e2340,.42);else if(r.time===2)rect(overlay,0,0,w,h,0xffd9a0,.16);    if(r.rain&&(_t%7000)<130)rect(overlay,0,0,w,h,0xffffff,.3);
    const fNow=keys.has('KeyF');
    if(fNow&&!prevF){if(r.dialog)r.dialog=0;else if(Math.hypot(r.x-npc.x,r.y-npc.y)<72)r.dialog=1;else if(Math.hypot(r.x-door.x,r.y-door.y)<60)r.mode='indoor';else{const gi=giftSpots.findIndex((g,i)=>!r.gifts[i]&&Math.hypot(r.x-g[0],r.y-g[1])<46);if(gi>=0)r.gifts[gi]=true;}}
    prevF=fNow;
    const tNow=keys.has('KeyT');if(tNow&&!prevT)r.time=(r.time+1)%3;prevT=tNow;
    const nNow=keys.has('KeyR');if(nNow&&!prevR)r.rain=!r.rain;prevR=nNow;
    if(r.dialog)dialogText.setText('“后生，坐一下嘛。这壶茶要等江风转凉才出味。”\n“台子边上拍，灯亮起来的时候最好看。”').setPosition(w/2,h-96).setVisible(true);else dialogText.setVisible(false);
    const hint=r.site>=0?'':r.dialog?'F 结束对话':Math.hypot(r.x-npc.x,r.y-npc.y)<72?'F 与茶馆老人交谈':Math.hypot(r.x-door.x,r.y-door.y)<60?'F 推门进屋':giftSpots.some((g,i)=>!r.gifts[i]&&Math.hypot(r.x-g[0],r.y-g[1])<46)?'F 拾取':'';
    hintText.setText(hint).setPosition(w/2,h-70).setVisible(!!hint&&!r.dialog);
    Object.assign(root.dataset,{actorX:String(sx(r.x)),actorGroundY:String(sy(r.y)),actorHeight:String(CH),slabTileScale:String(SLAB_PERIOD_W*k/1024),k:String(k),sway:String(sway)});
    update();
   });
  }
 }});
 const resize=()=>game.scale.resize(innerWidth,innerHeight);window.addEventListener('resize',resize,{signal:abort.signal});
 return()=>{abort.abort();game.destroy(true);};
}
function rect(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,alpha=1){g.fillStyle(color,alpha);g.fillRect(x,y,w,h);}
