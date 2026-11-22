import Phaser from 'phaser';
import {MAP} from './content';
import {preloadPhotoAssets,preparePhotoAssets} from './assets';
import type {PhotoRuntime} from './runtime';

// Whole-plate scenes: the illustration carries ground, buildings and lighting;
// only the visitor, the old teahouse keeper and the cabs stay movable.
// Character height from the plate's own scale: the doorways read about 2 m and
// measure ~135 units, so a 1.7 m visitor lands near 112-118 units.
const CH=116;
const TAXI_L=270;
const TAXI_H=104;

export function mountScene(root:HTMLElement,r:PhotoRuntime,keys:Set<string>,update:()=>void){
 const abort=new AbortController();let mouseActive=false,swayTarget=0,sway=0;
 const forcedSway=new URLSearchParams(location.search).get('photo-sway')==='1'?1:undefined;
 window.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;mouseActive=true;swayTarget=Phaser.Math.Clamp((e.clientX-innerWidth/2)/(innerWidth*.35),-1,1);},{signal:abort.signal});
 window.addEventListener('pointerout',e=>{if(!e.relatedTarget){mouseActive=false;swayTarget=0;}},{signal:abort.signal});
 window.addEventListener('blur',()=>{mouseActive=false;swayTarget=0;},{signal:abort.signal});
 const game=new Phaser.Game({parent:root,type:Phaser.CANVAS,width:innerWidth,height:innerHeight,backgroundColor:'#2b3a38',banner:false,audio:{noAudio:true},input:{keyboard:false,mouse:false,touch:false},scene:{
  preload(this:Phaser.Scene){preloadPhotoAssets(this);},
  create(this:Phaser.Scene){
   preparePhotoAssets(this);
   const front=this.add.graphics().setDepth(2000),overlay=this.add.graphics().setDepth(3000),shadow=this.add.graphics(),actor=this.add.graphics();
   const plates=['photo-plate0','photo-plate1'].map(key=>this.textures.exists(key)?this.add.image(0,0,key).setOrigin(0).setDepth(-900):undefined);
   const actorImg=this.textures.exists('photo-charM')?this.add.image(0,0,'photo-charM').setOrigin(.5,1).setVisible(false):undefined;
   const npcImg=this.textures.exists('photo-npcOld')?this.add.image(0,0,'photo-npcOld').setOrigin(.5,1).setVisible(false):undefined;
   const taxiImgs=[0,1,2,3].map(()=>this.textures.exists('photo-taxi')?this.add.image(0,0,'photo-taxi').setOrigin(.5,1).setVisible(false):undefined);
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
    const w=this.scale.width,h=this.scale.height,c=r.site>=0?r.composition(w,h):null,k=c?.k??Math.max(w/MAP.width,h/MAP.height)*1.12;
    const ox=c?.ox??Phaser.Math.Clamp(w/2-r.x*k,w-MAP.width*k,0),oy=c?.oy??Phaser.Math.Clamp(h*.80-r.y*k,h-MAP.height*k,0);
    const sx=(u:number)=>ox+u*k,sy=(u:number)=>oy+u*k;
    front.clear();overlay.clear();actor.clear();shadow.clear();
    if(r.mode==='indoor'){
     overlay.fillStyle(0x2a201a,1);overlay.fillRect(0,0,w,h);
     overlay.fillStyle(0x6b5238,1);overlay.fillPoints([{x:w*.08,y:h},{x:w*.92,y:h},{x:w*.74,y:h*.56},{x:w*.26,y:h*.56}],true);
     overlay.fillStyle(0x3a2d22,1);overlay.fillRect(0,0,w,h*.56);
     overlay.fillStyle(0xe8b268,.85);overlay.fillRect(w*.37,h*.17,w*.26,h*.28);
     overlay.lineStyle(3,0x241a12,1);overlay.strokeRect(w*.37,h*.17,w*.26,h*.28);
     overlay.fillStyle(0x8a6440,1);overlay.fillRect(w*.41,h*.62,w*.18,h*.05);overlay.fillRect(w*.43,h*.67,w*.03,h*.16);overlay.fillRect(w*.54,h*.67,w*.03,h*.16);
     overlay.fillStyle(0xf2b266,.22);overlay.fillCircle(w*.5,h*.18,70);
     hintText.setText('F 出门').setPosition(w/2,h-70).setVisible(true);dialogText.setVisible(false);
     plates.forEach((p,i)=>p?.setVisible(i===r.area));
     update();return;
    }
    // ---- Whole plate ----
    plates.forEach((p,i)=>p?.setVisible(i===r.area));
    const cur=plates[r.area];
    if(cur)cur.setPosition(ox,oy).setDisplaySize(MAP.width*k,MAP.height*k);
    // ---- Camera sites + player ----
    for(let i=0;i<r.sites.length;i++){const s=r.sites[i],nx=sx(s.x),ny=sy(s.y),near=i===r.nearby;
     front.lineStyle(near?2:1,near?0xffe3a0:0xd8bf87,near?.9:.28);front.strokeEllipse(nx,ny,near?52*k:40*k,near?18*k:14*k);
     if(near){front.fillStyle(0xf0d89d,.9);front.fillTriangle(nx,ny-14*k,nx-4*k,ny-23*k,nx+4*k,ny-23*k);}}
    if(r.site<0){
     shadow.fillStyle(0x17272d,.3);shadow.fillEllipse(sx(r.x),sy(r.y)+1,32*k,9*k);
     if(actorImg){
      const key=r.gender?'photo-charF':'photo-charM';
      if(actorImg.texture.key!==key)actorImg.setTexture(key);
      const ts=actorImg.texture.getSourceImage() as {width:number;height:number};
      const bob=moving?Math.abs(Math.sin(clock/110))*2*k:0;
      actorImg.setDisplaySize(CH*k*ts.width/ts.height,CH*k).setPosition(sx(r.x),sy(r.y)-bob).setFlipX(facing<0).setTint(0xfff1df).setDepth(r.y+1).setVisible(true);
     }else{actor.setPosition(sx(r.x),sy(r.y)).setDepth(r.y+1);actor.fillStyle(0x3c7775);actor.fillRect(-9*k,-44*k,18*k,30*k);actor.fillStyle(0xf0c99a);actor.fillCircle(0,-52*k,9*k);}
    }else actorImg?.setVisible(false);
    // ---- Keeper / door / souvenirs / exit ----
    if(npcImg){if(A.npc){const nt=npcImg.texture.getSourceImage() as {width:number;height:number};npcImg.setDisplaySize(CH*k*nt.width/nt.height,CH*k).setPosition(sx(A.npc.x),sy(A.npc.y)).setTint(0xffe8d2).setDepth(A.npc.y+1).setVisible(r.mode==='world'&&r.site<0);}else npcImg.setVisible(false);}
    if(A.door&&Math.hypot(r.x-A.door.x,r.y-A.door.y)<96){const dx=sx(A.door.x),dy=sy(A.door.y),dw=40*k,dh=62*k;
     front.fillStyle(0x1d140f,.55);front.fillRect(dx-dw/2,dy-dh,dw,dh);
     front.lineStyle(1,0xe8c07a,.55);front.strokeRect(dx-dw/2,dy-dh,dw,dh);}
    const giftSpots=r.area===0?[[640,1120],[1180,1140],[900,760]]:[[360,1000],[1100,1010],[1700,1000]];
    giftSpots.forEach(([gx,gy],i)=>{if(r.gifts[i])return;front.fillStyle(0xffe6a0,.24);front.fillCircle(sx(gx),sy(gy),10*k);front.fillStyle(0xffd270,1);front.fillCircle(sx(gx),sy(gy),3.4*k);});
    const ex=A.exit,exx=sx(ex.x),exy=sy(ex.y),exNear=Math.hypot(r.x-ex.x,r.y-ex.y)<150;
    if(exNear){front.fillStyle(0x141a1e,.62);front.fillRect(exx-74*k,exy-20*k,148*k,40*k);}
    front.lineStyle(2,0xf0c96a,exNear?.95:.5);front.strokeEllipse(exx,exy-40*k,34*k,14*k);
    front.fillStyle(0xf0c96a,.95);front.fillTriangle(exx,exy-58*k,exx-8*k,exy-44*k,exx+8*k,exy-44*k);
    // ---- Traffic on the street only ----
    if(A.hasCars){
     const parked=[[560,706],[1250,706]],cruise=[[0,742,30],[1,766,42]];
     for(const[px,py]of parked){front.fillStyle(0x161c1e,.3);front.fillEllipse(sx(px),sy(py),TAXI_L*k*1.02,14*k);}
     parked.forEach(([px,py],i)=>{const img=taxiImgs[i];if(!img)return;img.setVisible(true).setDisplaySize(TAXI_L*k,TAXI_H*k).setPosition(sx(px),sy(py)).setDepth(py);});
     cruise.forEach(([idx,cy,period],i)=>{const img=taxiImgs[2+i];if(!img)return;
      const q=(((_t/1000)/period)+i*.5)%1,cx=-320+q*2660;
      img.setVisible(true).setDisplaySize(TAXI_L*k,TAXI_H*k).setPosition(sx(cx),sy(cy)).setDepth(cy);});
     // One waiting passenger beside each parked cab, arm raised.
     for(const px of[490,1450]){const px2=sx(px),py2=sy(706);
      front.fillStyle(0x2f3b44,1);front.fillRect(px2-6*k,py2-44*k,12*k,30*k);
      front.fillStyle(0xe0b48a,1);front.fillCircle(px2,py2-50*k,6*k);
      front.lineStyle(3,0xe0b48a,1);front.lineBetween(px2+4*k,py2-40*k,px2+19*k,py2-54*k);}
    }else{for(const img of taxiImgs)img?.setVisible(false);}
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
     else if(A.npc&&Math.hypot(r.x-A.npc.x,r.y-A.npc.y)<72)r.dialog=1;
     else if(A.door&&Math.hypot(r.x-A.door.x,r.y-A.door.y)<60)r.mode='indoor';
     else{const gi=giftSpots.findIndex((g,i)=>!r.gifts[i]&&Math.hypot(r.x-g[0],r.y-g[1])<46);if(gi>=0)r.gifts[gi]=true;}
    }
    prevF=fNow;
    const tNow=keys.has('KeyT');if(tNow&&!prevT)r.time=(r.time+1)%3;prevT=tNow;
    const nNow=keys.has('KeyR');if(nNow&&!prevR)r.rain=!r.rain;prevR=nNow;
    if(r.dialog)dialogText.setText(r.area===0?'“后生，坐一下嘛。这壶茶要等江风转凉才出味。”\n“台子边上拍，灯亮起来的时候最好看。”':'“沧白路车多，过街看灯。黄壳壳车顶灯亮着的，是空车。”').setPosition(w/2,h-96).setVisible(true);else dialogText.setVisible(false);
    const hint=r.site>=0?'':r.dialog?'F 结束对话':Math.hypot(r.x-ex.x,r.y-ex.y)<64?'F '+ex.label:A.npc&&Math.hypot(r.x-A.npc.x,r.y-A.npc.y)<72?'F 与茶馆老人交谈':A.door&&Math.hypot(r.x-A.door.x,r.y-A.door.y)<60?'F 推门进屋':giftSpots.some((g,i)=>!r.gifts[i]&&Math.hypot(r.x-g[0],r.y-g[1])<46)?'F 拾取':'';
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
