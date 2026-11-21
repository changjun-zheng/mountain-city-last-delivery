import Phaser from 'phaser';
import {MAP} from './content';
import {preloadPhotoAssets,preparePhotoAssets} from './assets';
import type {PhotoRuntime} from './runtime';

// Shared ratio table (1 unit = 1 px on the 2200x1300 plate, 1 m = 66 units).
const CH=130;
const SLAB_PERIOD_W=416;
const SLAB_PERIOD_H=341;
const TAXI_L=300;
const TAXI_H=126;

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
   const life=this.add.graphics().setDepth(-850),floor=this.add.graphics().setDepth(-500),markers=this.add.graphics().setDepth(-200),front=this.add.graphics().setDepth(2000),overlay=this.add.graphics().setDepth(3000),shadow=this.add.graphics(),actor=this.add.graphics();
   const actorImg=this.textures.exists('photo-charM')?this.add.image(0,0,'photo-charM').setOrigin(.5,1).setVisible(false):undefined;
   const npcImg=this.textures.exists('photo-npcOld')?this.add.image(0,0,'photo-npcOld').setOrigin(.5,1).setVisible(false):undefined;
   const far=this.textures.exists('photo-farCity')?this.add.image(0,0,'photo-farCity').setOrigin(0).setDepth(-900):undefined;
   const slab=this.textures.exists('photo-slab')?this.add.tileSprite(0,0,1,1,'photo-slab').setOrigin(0).setDepth(-600):undefined;
   const slab2=this.textures.exists('photo-slab')?this.add.tileSprite(0,0,1,1,'photo-slab').setOrigin(0).setDepth(-600):undefined;
   const bldImgs=[0,1,2,3].map(()=>this.textures.exists('photo-tea')?this.add.image(0,0,'photo-tea').setOrigin(.5,1):undefined);
   const taxiImgs=[0,1,2,3].map(()=>this.textures.exists('photo-taxi')?this.add.image(0,0,'photo-taxi').setOrigin(.5,1):undefined);
   const hintText=this.add.text(0,0,'',{fontFamily:'system-ui, "Microsoft YaHei", sans-serif',fontSize:'15px',color:'#ffe6b0',backgroundColor:'#101416cc',padding:{x:10,y:5}}).setOrigin(.5,1).setDepth(4000).setVisible(false);
   const dialogText=this.add.text(0,0,'',{fontFamily:'system-ui, "Microsoft YaHei", sans-serif',fontSize:'16px',color:'#fff2d8',backgroundColor:'#141a1ee6',padding:{x:14,y:10},wordWrap:{width:Math.min(innerWidth-80,560)},lineSpacing:6}).setOrigin(.5,1).setDepth(4001).setVisible(false);
   let prevF=false,prevT=false,prevR=false,clock=0,idle=0,facing=1,previous={x:r.x,y:r.y},lastArea=-1;
   root.dataset.assetsReady='true';
   this.events.on('update',(_t:number,delta:number)=>{
    const A=r.areaDef,dt=Math.min(delta,50),any=(...k:string[])=>k.some(v=>keys.has(v)),mx=Number(any('KeyD','ArrowRight'))-Number(any('KeyA','ArrowLeft')),my=Number(any('KeyS','ArrowDown'))-Number(any('KeyW','ArrowUp'));
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
    // ---- Area 0: river backdrop ----
    if(far)far.setVisible(r.area===0);
    if(r.area===0){if(far){far.setCrop(0,0,2200,620).setPosition(ox,oy).setDisplaySize(MAP.width*k,620*k);}}
    else{
     // Programmatic skyline silhouette behind the shopfronts.
     for(let i=0;i<10;i++){const bx=120+i*230,bw=150+(i%3)*46,bh=64+((i*37)%98),by=176-bh;
      rect(floor,sx(bx),sy(by),bw*k,bh*k,i%2?0x6a727a:0x737b83);rect(floor,sx(bx),sy(by),bw*k,3*k,0x9aa3ab,.5);
      for(let wy=by+14;wy<170;wy+=24)for(let wx=bx+12;wx<bx+bw-14;wx+=26){rect(floor,sx(wx),sy(wy),9*k,11*k,0xd3d8da,.28);}}
    }
    // ---- Ground ----
    if(slab){
     if(A.ground.kind==='stone'){slab.setPosition(ox,oy+A.ground.from*k).setSize(MAP.width*k,(A.ground.to-A.ground.from)*k).setTileScale(SLAB_PERIOD_W*k/1024,SLAB_PERIOD_H*k/1024).setVisible(true);slab2?.setVisible(false);}
     else{slab.setPosition(ox,oy+160*k).setSize(MAP.width*k,480*k).setTileScale(SLAB_PERIOD_W*k/1024,SLAB_PERIOD_H*k/1024).setVisible(true);
      if(slab2)slab2.setPosition(ox,oy+900*k).setSize(MAP.width*k,400*k).setTileScale(SLAB_PERIOD_W*k/1024,SLAB_PERIOD_H*k/1024).setVisible(true);}
    }
    if(A.ground.kind==='street'){
     rect(floor,ox,sy(640),MAP.width*k,260*k,0x4a4d50);
     rect(floor,ox,sy(640),MAP.width*k,5*k,0x6d7176);
     for(let x=200;x<2200;x+=160){rect(floor,sx(x),sy(768),70*k,6*k,0xd9d4c2,.72);}
     rect(floor,ox,sy(896),MAP.width*k,10*k,0x8a8578);
    }
    // ---- Shoreline railing only on the terrace ----
    if(A.ground.kind==='stone'){
     for(let x=0;x<=MAP.width;x+=90){floor.fillStyle(0x9d9789,1);floor.fillRect(sx(x)-5*k,sy(A.ground.from-26),10*k,26*k);}
     floor.lineStyle(6*k,0xaba595,1);floor.lineBetween(ox,sy(A.ground.from-24),ox+MAP.width*k,sy(A.ground.from-24));
     floor.lineStyle(3*k,0x7d786c,1);floor.lineBetween(ox,sy(A.ground.from-12),ox+MAP.width*k,sy(A.ground.from-12));
     for(let n=0;n<4;n++){const y0=A.ground.from+40+n*20,inset=n*10;
      rect(floor,sx(1390+inset),sy(y0),(220-inset*2)*k,18*k,n%2?0xb0ac98:0xbcb7a2);
      rect(floor,sx(1390+inset),sy(y0)+14*k,(220-inset*2)*k,6*k,0x4f4e48);
      rect(floor,sx(1390+inset),sy(y0),(220-inset*2)*k,2*k,0xd2ceb8,.65);}
    }
    // ---- Buildings ----
    for(let i=0;i<bldImgs.length;i++){const img=bldImgs[i],b=A.buildings[i];
     if(!img){continue;}
     if(!b){img.setVisible(false);continue;}
     img.setTexture(b.key).setVisible(true).setFlipX(!!b.flip);
     floor.fillStyle(0x8a8578,1);floor.fillRect(sx(b.wx-b.w*.42),sy(b.wy)+9*k,b.w*.84*k,10*k);
     floor.fillStyle(0x1c2426,.16);floor.fillEllipse(sx(b.wx),sy(b.wy)+12,b.w*.65*k,14*k);
     img.setPosition(sx(b.wx),sy(b.wy)+18*k).setDisplaySize(b.w*k,b.h*k).setDepth(b.wy);
    }
    // ---- River life (terrace only) ----
    if(A.hasRiver){
     for(let i=0;i<2;i++){const p=((_t/1000)/210+i*.5)%1,bx=-300+p*2900,by=545+i*38;
      life.fillStyle(0x2f3536,.9);life.fillEllipse(sx(bx),sy(by),92*k,18*k);
      life.fillStyle(0x7d5f42,.95);life.fillEllipse(sx(bx-8),sy(by-10),44*k,13*k);
      life.lineStyle(2.5*k,0x9c8a63,.9);life.lineBetween(sx(bx+16),sy(by-22),sx(bx+16),sy(by-4));}
     for(let i=0;i<4;i++){const span=2700,period=88+i*11,p=(((_t/1000)/period)+i*.27)%1,bx=-140+p*span,by=505+i*24+Math.sin(p*6+i)*8;
      const s=24*k,flap=Math.sin(_t/1000*4.6+i*1.7)*.6,lev=.55+flap*.45;
      life.fillStyle(0x2c3a3c,.55);life.fillEllipse(sx(bx),sy(by)+1.5*k,s*1.05,s*.42);
      life.fillTriangle(sx(bx),sy(by),sx(bx)-s*1.2,sy(by)+s*lev*.8,sx(bx)-s*.32,sy(by)-s*.6);
      life.fillTriangle(sx(bx),sy(by),sx(bx)+s*1.2,sy(by)+s*lev*.8,sx(bx)+s*.32,sy(by)-s*.6);
      life.fillStyle(0xf7f5ee,.98);life.fillEllipse(sx(bx),sy(by),s*.85,s*.3);
      life.fillTriangle(sx(bx),sy(by),sx(bx)-s*1.1,sy(by)+s*lev*.7,sx(bx)-s*.3,sy(by)-s*.5);
      life.fillTriangle(sx(bx),sy(by),sx(bx)+s*1.1,sy(by)+s*lev*.7,sx(bx)+s*.3,sy(by)-s*.5);}
    }
    // ---- Traffic (street only): two cabs parked hailing, two cruising slowly ----
    if(A.hasCars){
     const parked=[[430,700],[1540,700]],cruise=[[0,790,26],[1,860,38]];     parked.forEach(([px,py],i)=>{const img=taxiImgs[i];if(!img)return;
      img.setVisible(true).setFlipX(false).setDisplaySize(TAXI_L*k,TAXI_H*k).setPosition(sx(px),sy(py)).setDepth(py);});
     cruise.forEach(([idx,cy,period],i)=>{const img=taxiImgs[2+i];if(!img)return;
      const p=(((_t/1000)/period)+i*.5)%1,cx=-320+p*2900;
      img.setVisible(true).setDisplaySize(TAXI_L*k,TAXI_H*k).setPosition(sx(cx),sy(cy)).setDepth(cy);});
     // Two waiting passengers next to the parked cabs, one arm raised.
     for(const px of[360,1470]){const px2=sx(px),py2=sy(700);
      front.fillStyle(0x2f3b44,1);front.fillRect(px2-6*k,py2-44*k,12*k,30*k);
      front.fillStyle(0xe0b48a,1);front.fillCircle(px2,py2-50*k,6*k);
      front.lineStyle(3,0xe0b48a,1);front.lineBetween(px2+4*k,py2-40*k,px2+19*k,py2-54*k);}
    }else{for(const img of taxiImgs)img?.setVisible(false);}
    // ---- Camera sites ----
    for(let i=0;i<r.sites.length;i++){const s=r.sites[i],nx=sx(s.x),ny=sy(s.y);
     markers.lineStyle(2,i===r.nearby?0xffe3a0:0xd8bf87,.85);markers.strokeEllipse(nx,ny,56*k,20*k);
     markers.fillStyle(0xf0d89d,.85);markers.fillTriangle(nx,ny-16*k,nx-5*k,ny-26*k,nx+5*k,ny-26*k);}
    // ---- Player ----
    if(r.site<0){
     shadow.fillStyle(0x17272d,.4);shadow.fillEllipse(sx(r.x),sy(r.y)+2,46*k,12*k);
     if(actorImg){
      const key=r.gender?'photo-charF':'photo-charM';
      if(actorImg.texture.key!==key)actorImg.setTexture(key);
      const bob=moving?Math.abs(Math.sin(clock/110))*2.4*k:0;
      actorImg.setDisplaySize(CH*390/520*k,CH*k).setPosition(sx(r.x),sy(r.y)-bob).setFlipX(facing<0).setDepth(r.y+1).setVisible(true);
     }else{actor.setPosition(sx(r.x),sy(r.y)).setDepth(r.y+1);actor.fillStyle(0x3c7775);actor.fillRect(-9*k,-44*k,18*k,30*k);actor.fillStyle(0xf0c99a);actor.fillCircle(0,-52*k,9*k);}
    }else actorImg?.setVisible(false);
    // ---- NPC / door / souvenirs / exit ----
    const npc=A.npc,door=A.door,giftSpots=r.area===0?[[420,1180],[1600,1200],[1000,760]]:[[350,940],[1300,945],[1800,940]];
    if(npcImg){if(A.npc){npcImg.setDisplaySize(CH*k*251/620,CH*k).setPosition(sx(A.npc.x),sy(A.npc.y)).setDepth(A.npc.y+1).setVisible(r.mode==='world'&&r.site<0);}else npcImg.setVisible(false);}
    if(door){const dx=sx(door.x),dy=sy(door.y),dw=44*k,dh=88*k;
     front.fillStyle(0x241a12,1);front.fillRect(dx-dw/2,dy-dh,dw,dh);
     front.fillStyle(0x8a5a34,1);front.fillRect(dx-dw/2+3*k,dy-dh+3*k,dw/2-4*k,dh-3*k);front.fillRect(dx+1*k,dy-dh+3*k,dw/2-4*k,dh-3*k);
     front.fillStyle(0xd8a45a,.95);front.fillCircle(dx+7*k,dy-dh*.55,2.2*k);}
    giftSpots.forEach(([gx,gy],i)=>{if(r.gifts[i])return;front.fillStyle(0xffe6a0,.24);front.fillCircle(sx(gx),sy(gy),10*k);front.fillStyle(0xffd270,1);front.fillCircle(sx(gx),sy(gy),3.4*k);});
    const ex=A.exit,exx=sx(ex.x),exy=sy(ex.y);
    front.fillStyle(0x141a1e,.6);front.fillRect(exx-70*k,exy-20*k,140*k,40*k);
    front.fillStyle(0xf0c96a,.95);front.fillTriangle(exx,exy-11*k,exx-9*k,exy+2*k,exx+9*k,exy+2*k);
    front.fillStyle(0xf0c96a,.95);front.fillRect(exx-4*k,exy+2*k,8*k,13*k);
    if(r.rain)for(let i=0;i<48;i++){const rx=((i*173+_t*.35)%(w+60))-30,ry=((i*97+_t*1.05)%(h+80))-40;overlay.lineStyle(1,0xd2e2ec,.34);overlay.lineBetween(rx,ry,rx-5,ry+16);}
    // ---- Viewfinder ----
    if(c){rect(overlay,0,0,w,h,0x000000,.42);const f=c.frame;
     overlay.lineStyle(2,0xf0c96a);overlay.strokeRect(f.x,f.y,f.w,f.h);
     overlay.lineStyle(1,0xf0c96a,.35);
     for(const n of[1,2]){overlay.lineBetween(f.x+f.w*n/3,f.y,f.x+f.w*n/3,f.y+f.h);overlay.lineBetween(f.x,f.y+f.h*n/3,f.x+f.w,f.y+f.h*n/3);}
     overlay.lineStyle(4,0xffe0a0);
     for(const[xx,yy,sxx,syy]of[[f.x,f.y,1,1],[f.x+f.w,f.y,-1,1],[f.x,f.y+f.h,1,-1],[f.x+f.w,f.y+f.h,-1,-1]]){overlay.lineBetween(xx,yy,xx+12*sxx,yy);overlay.lineBetween(xx,yy,xx,yy+12*syy);}
     const sub=c.subject;if(sub.x>=f.x&&sub.y>=f.y&&sub.x+sub.w<=f.x+f.w&&sub.y+sub.h<=f.y+f.h){overlay.lineStyle(2,0xffdfa0,.5);overlay.strokeRect(sub.x,sub.y,sub.w,sub.h);}}
    if(r.time===1)rect(overlay,0,0,w,h,0x0e2340,.42);else if(r.time===2)rect(overlay,0,0,w,h,0xffd9a0,.16);
    if(r.rain&&(_t%7000)<130)rect(overlay,0,0,w,h,0xffffff,.3);
    // ---- Input ----
    const fNow=keys.has('KeyF');
    if(fNow&&!prevF){
     if(Math.hypot(r.x-ex.x,r.y-ex.y)<64){r.area=ex.to;r.x=ex.spawnX;r.y=ex.spawnY;r.site=-1;r.dialog=0;previous={x:r.x,y:r.y};}
     else if(r.dialog)r.dialog=0;
     else if(npc&&Math.hypot(r.x-npc.x,r.y-npc.y)<72)r.dialog=1;
     else if(door&&Math.hypot(r.x-door.x,r.y-door.y)<60)r.mode='indoor';
     else{const gi=giftSpots.findIndex((g,i)=>!r.gifts[i]&&Math.hypot(r.x-g[0],r.y-g[1])<46);if(gi>=0)r.gifts[gi]=true;}
    }
    prevF=fNow;
    const tNow=keys.has('KeyT');if(tNow&&!prevT)r.time=(r.time+1)%3;prevT=tNow;
    const nNow=keys.has('KeyR');if(nNow&&!prevR)r.rain=!r.rain;prevR=nNow;
    if(r.dialog)dialogText.setText(r.area===0?'“后生，坐一下嘛。这壶茶要等江风转凉才出味。”\n“台子边上拍，灯亮起来的时候最好看。”':'“沧白路车多，过街看灯。黄壳壳车顶灯亮着的，是空车。”').setPosition(w/2,h-96).setVisible(true);else dialogText.setVisible(false);
    const hint=r.site>=0?'':r.dialog?'F 结束对话':Math.hypot(r.x-ex.x,r.y-ex.y)<64?'F '+ex.label:npc&&Math.hypot(r.x-npc.x,r.y-npc.y)<72?'F 与茶馆老人交谈':door&&Math.hypot(r.x-door.x,r.y-door.y)<60?'F 推门进屋':giftSpots.some((g,i)=>!r.gifts[i]&&Math.hypot(r.x-g[0],r.y-g[1])<46)?'F 拾取':'';
    hintText.setText(hint).setPosition(w/2,h-70).setVisible(!!hint&&!r.dialog);
    if(lastArea!==r.area){lastArea=r.area;root.dataset.area=String(r.area);}
    Object.assign(root.dataset,{actorX:String(sx(r.x)),actorGroundY:String(sy(r.y)),actorHeight:String(CH),k:String(k),area:String(r.area),sway:String(sway)});
    update();
   });
  }
 }});
 const resize=()=>game.scale.resize(innerWidth,innerHeight);window.addEventListener('resize',resize,{signal:abort.signal});
 return()=>{abort.abort();game.destroy(true);};
}
function rect(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,alpha=1){g.fillStyle(color,alpha);g.fillRect(x,y,w,h);}
