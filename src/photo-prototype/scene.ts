import Phaser from 'phaser';
import {MAP,SITES,WALLS} from './content';
import {ASSETS,PHOTO_STAIR,preloadPhotoAssets,preparePhotoAssets} from './assets';
import type {PhotoRuntime} from './runtime';

// 烘焙底图的纵向微调，范围 ±60；只影响视觉，不参与任何判定
const SCENE_OFFSET_Y=0;

export function mountScene(root:HTMLElement,r:PhotoRuntime,keys:Set<string>,update:()=>void){
 const abort=new AbortController();let mouseActive=false,swayTarget=0,sway=0;
 // Explicit visual-only acceptance probe. Never passed to runtime/composition.
 const forcedSway=new URLSearchParams(location.search).get('photo-sway')==='1'?1:undefined;
 window.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;mouseActive=true;swayTarget=Phaser.Math.Clamp((e.clientX-innerWidth/2)/(innerWidth*.35),-1,1);},{signal:abort.signal});
 window.addEventListener('pointerout',e=>{if(!e.relatedTarget){mouseActive=false;swayTarget=0;}},{signal:abort.signal});
 window.addEventListener('blur',()=>{mouseActive=false;swayTarget=0;},{signal:abort.signal});
 const game=new Phaser.Game({parent:root,type:Phaser.CANVAS,width:innerWidth,height:innerHeight,backgroundColor:'#667873',banner:false,audio:{noAudio:true},input:{keyboard:false,mouse:false,touch:false},scene:{
  preload(this:Phaser.Scene){preloadPhotoAssets(this);},
  create(this:Phaser.Scene){
   const backSky=this.add.graphics().setDepth(-1000),backRiver=this.add.graphics().setDepth(-900),backTown=this.add.graphics().setDepth(-800),front=this.add.graphics().setDepth(2000);
   const floor=this.add.graphics().setDepth(-500),markers=this.add.graphics().setDepth(-300),overlay=this.add.graphics().setDepth(3000),actor=this.add.graphics(),shadow=this.add.graphics();
   const actorImg=this.textures.exists('photo-charM')?this.add.image(0,0,'photo-charM').setOrigin(.5,1).setVisible(false):undefined;
   const baked=this.textures.exists('photo-world');
   const ground=baked?undefined:this.textures.exists('photo-ground')?this.add.tileSprite(0,0,1,1,'photo-ground').setOrigin(0).setDepth(-600):undefined;
   // The supplied corridor has large transparent padding. Trim its render frame,
   // without altering the original PNG, so its visible foot meets y=440.
   preparePhotoAssets(this);
   const images=new Map<string,Phaser.GameObjects.Image>();
   const image=(id:string,key:string,x:number,y:number,w:number,h:number,ax:number,ay:number,depth:number,alpha=1)=>{
    if(!this.textures.exists('photo-'+key))return false;
    let sprite=images.get(id);if(!sprite){const texture=key==='river'&&this.textures.exists('photo-river-soft')?'photo-river-soft':'photo-'+key;sprite=this.add.image(x,y,texture,key==='corridor'?'visible':undefined);images.set(id,sprite);}
    sprite.setOrigin(ax,ay).setPosition(x,y).setDisplaySize(w,h).setDepth(depth).setAlpha(alpha);return true;
   };
   const rect=(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,alpha=1)=>{g.fillStyle(color,alpha);g.fillRect(x,y,w,h);};
   let z=0,speed=1,pitch=0,clock=0,idle=0,facing=1,stepDistance=0,stepRemaining=0,stepBounces=0,previous={x:r.x,y:r.y};
   const anchors={sky:{x:0,y:-600},river:{x:0,y:200},houseA:{x:710,y:520},houseB:{x:1620,y:540},corridor:{x:1105,y:440},tree:{x:140,y:900},stair:{x:PHOTO_STAIR.x+PHOTO_STAIR.w/2,y:PHOTO_STAIR.y+PHOTO_STAIR.h}};
   root.dataset.assetAnchors=JSON.stringify(anchors);root.dataset.assetsReady='true';root.dataset.loadedAssets=JSON.stringify(Object.keys(ASSETS).filter(k=>this.textures.exists('photo-'+k)));
   this.events.on('update',(_t:number,delta:number)=>{
    const dt=Math.min(delta,50),any=(...k:string[])=>k.some(v=>keys.has(v)),mx=Number(any('KeyD','ArrowRight'))-Number(any('KeyA','ArrowLeft')),my=Number(any('KeyS','ArrowDown'))-Number(any('KeyW','ArrowUp'));
    const inTerrace=r.x>=420&&r.x<=1940,zTarget=inTerrace?(r.y<540?2:r.y<780?1:0):0;
    const stair=r.x>=PHOTO_STAIR.x&&r.x<=PHOTO_STAIR.x+PHOTO_STAIR.w&&r.y>=PHOTO_STAIR.y&&r.y<=PHOTO_STAIR.y+PHOTO_STAIR.h;
    z+=(zTarget-z)*.18;speed+=((stair?.55:1-zTarget*.12)-speed)*.18;pitch+=((stair?-.14:0)-pitch)*.18;
    // Approved terrain pace multiplier; collision algorithm and world positions
    // remain owned by the unchanged runtime. All judgments see only those positions.
    r.zoom=any('ShiftLeft','ShiftRight')?1.8:1;r.move(mx,my,dt/1000*speed);r.flash=Math.max(0,r.flash-delta);
    const distance=Math.hypot(r.x-previous.x,r.y-previous.y),moving=distance>.01;
    previous={x:r.x,y:r.y};idle=moving?0:idle+dt;clock+=moving?dt*speed:0;if(mx)facing=mx<0?-1:1;
    stepRemaining=Math.max(0,stepRemaining-dt);if(stair&&moving){stepDistance+=distance;if(stepDistance>=40){stepDistance%=40;stepRemaining=60;stepBounces++;}}else if(!stair)stepDistance=0;
    sway=forcedSway??(sway+((mouseActive?swayTarget:0)-sway)*.12);
    const w=this.scale.width,h=this.scale.height,c=r.site>=0?r.composition(w,h):null,k=c?.k??Math.max(w/MAP.width,h/MAP.height)*1.1;
    const ox=c?.ox??Phaser.Math.Clamp(w/2-r.x*k,w-MAP.width*k,0),oy=c?.oy??Phaser.Math.Clamp(h*.84-r.y*k,h-MAP.height*k,0);
    const offset=(factor:number)=>-sway*70*factor;
    backSky.clear();backRiver.clear();backTown.clear();front.clear();floor.clear();markers.clear();overlay.clear();actor.clear();shadow.clear();
    const box=(x:number,y:number,rw:number,rh:number,color:number,alpha=1)=>rect(floor,ox+x*k,oy+y*k,rw*k,rh*k,color,alpha);
    // 世界高度小于屏幕高度时，上方露出的区域用天空渐变延展，避免看到底色。
    // 只填 oy 以上的空白，不覆盖底图；depth -1000，永远在最底层。
    if(oy>0&&!c){for(let y=0;y<oy;y+=5){const t=y/Math.max(oy,1);rect(backSky,0,y,w,5,Phaser.Display.Color.GetColor(188+Math.round(58*t),106+Math.round(64*t),92+Math.round(6*t)));}}
    // 烘焙底图优先：一张不透明整图，内部已含建筑、地面、树、灯笼。sway 恒为 0。
    const worldOk=image('world','world',ox,oy+SCENE_OFFSET_Y*k,2200*k,1300*k,0,0,-600);
    if(!worldOk){
    // Background camera origins scroll slowly. Mouse sway has only x offsets;
    // asset world anchors remain fixed and L3 has exactly zero sway displacement.
    if(!image('sky','sky',ox*.05+offset(.05),oy*.05-600*k,2600*k,1000*k,0,0,-1000)){
     for(let y=0;y<1000*k;y+=4){const t=y/(1000*k);rect(backSky,ox*.05+offset(.05),oy*.05-600*k+y,2600*k,4,Phaser.Display.Color.GetColor(110+Math.round(120*t),115+Math.round(75*t),128+Math.round(15*t)));}
    }
    if(!image('river','river',ox*.28+offset(.28),oy*.28+200*k,2600*k,527*k,0,0,-900))rect(backRiver,ox*.28+offset(.28),oy*.28+200*k,2600*k,527*k,0x819b99);
    for(let n=0;n<16;n++){const ratio=.35+(n%4)*.05,key=n%2?'houseA':'houseB',x=60+n*145,shore=oy*.28+(200+527*.58+(n%3)*9)*k;if(!image('town'+n,key,ox*.58+x*k+offset(.58),shore,480*ratio*k,560*ratio*k,.5,1,-800+n*.001,.25+(n%4)*.05))rect(backTown,ox*.58+(x-240*ratio)*k+offset(.58),shore-560*ratio*k,480*ratio*k,560*ratio*k,0x805c3e,.3);}
    const b=MAP.bounds;
    if(ground){ground.setPosition(ox+b.x*k,oy+b.y*k).setSize(b.w*k,b.h*k).setTileScale(k,k);}else{
     box(b.x,b.y,b.w,b.h,0x9c9b80);for(let y=b.y;y<b.y+b.h;y+=45)for(let x=b.x;x<b.x+b.w;x+=83){box(x+2,y+2,79,41,0xaaa489);}
    }
    for(const wall of WALLS.filter(a=>!MAP.buildings.includes(a as never))){box(wall.x,wall.y,wall.w,wall.h,0x5b685e);box(wall.x,wall.y-8,wall.w,9,0xbbaa7d);for(let y=wall.y;y<wall.y+wall.h;y+=35){floor.lineStyle(k,0x3e5149,.6);floor.lineBetween(ox+wall.x*k,oy+y*k,ox+(wall.x+wall.w)*k,oy+y*k);}}
    image('stair','stair',ox+anchors.stair.x*k,oy+anchors.stair.y*k,PHOTO_STAIR.w*k,PHOTO_STAIR.h*k,.5,1,300);
    if(!this.textures.exists('photo-stair'))for(let n=0;n<5;n++)box(PHOTO_STAIR.x,PHOTO_STAIR.y+n*30,PHOTO_STAIR.w,26,0xc9b890);
    for(const house of MAP.buildings){const key=house.kind==='guide'?'houseA':house.kind==='workshop'?'houseB':'corridor',cx=house.x+house.w/2,by=house.y+house.h;
     const width=key==='houseA'?480:key==='houseB'?460:300,height=key==='houseA'?560:key==='houseB'?540:131;
     if(!image(key,key,ox+cx*k,oy+by*k,width*k,height*k,.5,1,by)){
      box(cx-width/2,by-height,width,height,0x805c3e);box(cx-width/2-12,by-height-20,width+24,24,0x454f48);for(let x=cx-width/2+20;x<cx+width/2-30;x+=64)box(x,by-height+45,32,44,0xf0c786);
     }
     // Decorative foreground lanterns, with the same eaves anchor in world space.
     const lanternX=cx+width*.37,lanternY=by-height+70;
     if(!image('lantern-'+key,'lantern',ox+lanternX*k+offset(1.18),oy+lanternY*k,60*k,184*k,.5,0,2001)){
      front.fillStyle(0xf2b266,.6);front.fillEllipse(ox+lanternX*k+offset(1.18),oy+(lanternY+92)*k,60*k,184*k);
     }
    }
    }
    if(worldOk){
     // 嘉陵江活水：波光随流缓移，两艘小船顺流漂，天上几只江鸥。
     for(let i=0;i<7;i++){const ry=oy+(96+i*14)*k,rx=ox+(((_t*.022+i*260)%2400)-200)*k;front.lineStyle(Math.max(1,2*k),0xffe3a8,.24);front.lineBetween(rx,ry,rx+110*k,ry);}
     for(let i=0;i<2;i++){const p=(_t*.006+i*.5)%1,bx=ox+(-260+p*2700)*k,by=oy+(198+i*26)*k;front.fillStyle(0x3b3029,.92);front.fillEllipse(bx,by,92*k,17*k);front.fillStyle(0x8d6a48,.92);front.fillEllipse(bx-6*k,by-9*k,44*k,13*k);front.fillStyle(0xb8965f,.75);front.fillRect(bx+14*k,by-16*k,3*k,16*k);}
     for(let i=0;i<5;i++){const p=(_t*.004+i*.38)%1,bx=-60+p*(w+120),by=36+i*9+Math.sin(p*11+i)*16;front.lineStyle(Math.max(1,1.8*k),0x2e3a38,.62);front.lineBetween(bx-9*k,by,bx,by-5*k);front.lineBetween(bx,by-5*k,bx+9*k,by);}
    }
    for(let i=0;i<SITES.length;i++){const s=SITES[i];markers.lineStyle(2,i===r.nearby?0xffe3a0:0xd8bf87,.8);markers.strokeEllipse(ox+s.x*k,oy+s.y*k,68*k,24*k);rect(markers,ox+(s.x-10)*k,oy+(s.y-10)*k,20*k,13*k,0xf0d89d,.9);}
    // Shadow stays on the ground; z, lean and foot pulse affect only the skeleton.
    if(r.site<0){shadow.setDepth(r.y-1);shadow.fillStyle(0x17272d,.45-z*.08);shadow.fillEllipse(ox+r.x*k,oy+r.y*k+3,64*k*(1+z*.3),12*k);}
    const state=r.site>=0?'shutter':stair&&moving?'climb':moving?'walk':'idle',frame=Math.floor(clock/125)%4,phase=frame*Math.PI/2,leg=state==='walk'||state==='climb'?Math.sin(phase)*(state==='climb'?4:8):0,breath=state==='idle'&&idle>400?(Math.floor(_t/650)%2?2:-2):0;
    const bob=(state==='walk'||state==='climb')?Math.abs(Math.sin(clock/110))*3*k:0;
    if(actorImg){
     const key=r.gender?'photo-charF':'photo-charM';
     if(actorImg.texture.key!==key)actorImg.setTexture(key);
     const chH=190*k;
     actorImg.setDisplaySize(chH*390/520,chH).setPosition(ox+r.x*k,oy+r.y*k-z*8-bob).setFlipX(facing<0).setRotation(stair?-.05:0).setDepth(r.y+1).setVisible(r.site<0);
    }else if(r.site<0){actor.setPosition(ox+r.x*k,oy+r.y*k-z*8+3*stepRemaining/60).setScale(facing*k*2.6,k*2.6).setRotation(pitch).setDepth(r.y+1);
    actor.lineStyle(5,0x253b3d);actor.lineBetween(-6,-19,-7+leg,-2);actor.lineBetween(6,-19,7-leg,-2);actor.fillStyle(0x3c7775);actor.fillRoundedRect(-12,-40+breath,24,25,4);actor.fillStyle(0xf0c99a);actor.fillCircle(0,-50+breath,10);actor.fillStyle(0x263d3c);actor.fillEllipse(-1,-57+breath,22,9);actor.lineStyle(3,0xe5ba73);actor.lineBetween(-9,-38+breath,10,-18+breath);
    actor.lineStyle(5,0xf0c99a);actor.lineBetween(-13,-36+breath,-16-leg*.5,-21+breath);actor.lineBetween(13,-36+breath,16+leg*.5,-21+breath);}
    if(!worldOk&&!image('tree','tree',ox+140*k+offset(1.18),oy+900*k,620*k,780*k,.5,1,2000)){
     rect(front,ox+130*k+offset(1.18),oy+500*k,20*k,400*k,0x5b4534);front.fillStyle(0x3f5842,.9);front.fillEllipse(ox+140*k+offset(1.18),oy+330*k,620*k,420*k);
    }
    rect(overlay,0,0,w,h,0xffcf87,.06);
    if(c){rect(overlay,0,0,w,h,0x000000,.42);const f=c.frame;overlay.lineStyle(2,0xf0c96a);overlay.strokeRect(f.x,f.y,f.w,f.h);overlay.lineStyle(1,0xf0c96a,.35);for(const n of[1,2]){overlay.lineBetween(f.x+f.w*n/3,f.y,f.x+f.w*n/3,f.y+f.h);overlay.lineBetween(f.x,f.y+f.h*n/3,f.x+f.w,f.y+f.h*n/3);}overlay.lineStyle(4,0xffe0a0);for(const[xx,yy,sx,sy]of[[f.x,f.y,1,1],[f.x+f.w,f.y,-1,1],[f.x,f.y+f.h,1,-1],[f.x+f.w,f.y+f.h,-1,-1]]){overlay.lineBetween(xx,yy,xx+12*sx,yy);overlay.lineBetween(xx,yy,xx,yy+12*sy);}const s=c.subject;if(s.x>=f.x&&s.y>=f.y&&s.x+s.w<=f.x+f.w&&s.y+s.h<=f.y+f.h){overlay.lineStyle(2,0xffdfa0,.5);overlay.strokeRect(s.x,s.y,s.w,s.h);}}
    const rounded=(n:number)=>Math.round(n*100)/100;
    const fixedLayer={buildings:['houseA','houseB','corridor'].map(key=>{const s=images.get(key);return s?{key,x:rounded(s.x),y:rounded(s.y),w:rounded(s.displayWidth),h:rounded(s.displayHeight)}:null;}),ground:ground?{x:rounded(ground.x),y:rounded(ground.y)}:null,actor:{x:rounded(actor.x),y:rounded(actor.y)},markers:SITES.map(s=>({x:rounded(ox+s.x*k),y:rounded(oy+s.y*k)})),frame:c?.frame??null};
    Object.assign(root.dataset,{l3Positions:JSON.stringify(fixedLayer),sway:String(sway),swayTarget:String(mouseActive?swayTarget:0),l3OffsetX:'0',layerOffsets:JSON.stringify({L0:offset(.05),L1:offset(.28),L2:offset(.58),L3:0,L4:offset(1.18)}),z:String(z),zTarget:String(zTarget),terrainSpeed:String(speed),stair:String(stair),actorState:state,actorRotation:String(pitch),walkFrame:String(frame),stepBounces:String(stepBounces),actorX:String(ox+r.x*k),actorGroundY:String(oy+r.y*k),shadowAlpha:String(.45-z*.08),shadowLength:String(1+z*.3)});
    update();
   });
  }
 }});
 const resize=()=>game.scale.resize(innerWidth,innerHeight);window.addEventListener('resize',resize,{signal:abort.signal});
 return()=>{abort.abort();game.destroy(true);};
}
