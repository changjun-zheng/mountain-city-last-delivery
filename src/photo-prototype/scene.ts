import Phaser from 'phaser';
import {MAP,SITES,WALLS} from './content';
import type {PhotoRuntime} from './runtime';
export function mountScene(root:HTMLElement,r:PhotoRuntime,keys:Set<string>,update:()=>void){
 const game=new Phaser.Game({parent:root,type:Phaser.CANVAS,width:innerWidth,height:innerHeight,backgroundColor:'#17272d',banner:false,audio:{noAudio:true},input:{keyboard:false,mouse:false,touch:false},scene:{
  create(this:Phaser.Scene){const g=this.add.graphics();this.events.on('update',(_t:number,delta:number)=>{
   const any=(...k:string[])=>k.some(v=>keys.has(v));
   r.zoom=any('ShiftLeft','ShiftRight')?1.8:1;
   r.move(Number(any('KeyD','ArrowRight'))-Number(any('KeyA','ArrowLeft')),Number(any('KeyS','ArrowDown'))-Number(any('KeyW','ArrowUp')),Math.min(delta,50)/1000);
   r.flash=Math.max(0,r.flash-delta);
   const w=this.scale.width,h=this.scale.height,c=r.site>=0?r.composition(w,h):null;
   const k=c?.k??Math.min(w/MAP.width,h/MAP.height)*1.1;
   const ox=c?.ox??Math.max(Math.min(0,w-MAP.width*k),Math.min(0,w/2-r.x*k));
   const oy=c?.oy??h*.84-r.y*k;
   const rect=(x:number,y:number,rw:number,rh:number,color:number,alpha=1)=>{g.fillStyle(color,alpha);g.fillRect(x,y,rw,rh);};
   const poly=(p:number[],color:number,alpha=1)=>{g.fillStyle(color,alpha);g.fillPoints(p.reduce<Phaser.Math.Vector2[]>((a,_,i)=>{if(!(i%2))a.push(new Phaser.Math.Vector2(p[i],p[i+1]));return a;},[]),true);};
   const box=(x:number,y:number,rw:number,rh:number,color:number,alpha=1)=>rect(ox+x*k,oy+y*k,rw*k,rh*k,color,alpha);
   const shape=(p:number[],color:number,alpha=1)=>poly(p.map((v,i)=>(i%2?oy:ox)+v*k),color,alpha);
   const line=(x:number,y:number,x2:number,y2:number,color:number,size=1,alpha=1)=>{g.lineStyle(size*k,color,alpha);g.lineBetween(ox+x*k,oy+y*k,ox+x2*k,oy+y2*k);};
   g.clear();
   // L1: fixed evening sky, softly stratified instead of a flat backdrop.
   const top=[111,111,117],bottom=[255,213,149];
   for(let y=0;y<h;y+=4){const t=Math.min(1,y/(h*.45));rect(0,y,w,4,Phaser.Display.Color.GetColor(...top.map((a,i)=>Math.round(a+(bottom[i]-a)*t)) as [number,number,number]));}
   for(let n=5;n>0;n--){g.fillStyle(0xffe5a9,.018);g.fillCircle(w*.64,h*.24,25+n*16);}
   g.fillStyle(0xffe8af,.65);g.fillCircle(w*.64,h*.24,24);
   // L2: distant mountain folds, river and the opposite-bank skyline.
   for(let row=0;row<3;row++){const points=[0,h];for(let x=-80;x<w+100;x+=80)points.push(x,h*(.25+row*.065)+Math.sin(x*.009+row*2)*h*.065);points.push(w,h);poly(points,[0x929c8b,0xaaa183,0xbda779][row],.42);}
   rect(0,h*.39,w,h*.25,0x90b0a9,.65);
   for(let n=0;n<65;n++){const x=(n*127)%w,y=h*.4+(n*37)%(h*.22);rect(x,y,20+(n%5)*13,1,n%3?0xd0c6a0:0xffdfa0,.45);}
   for(let n=0;n<40;n++){const x=n*w/39,hh=12+(n*37)%43;rect(x,h*.4-hh,14+(n%4)*8,hh,0x8f9179,.4);}
   g.lineStyle(7,0xc4ba96,.7);g.lineBetween(0,h*.44,w,h*.42);
   for(const x of [w*.2,w*.77]){rect(x,h*.32,7,h*.12,0xb7ac8d,.8);g.lineStyle(1,0xe1cfa6,.7);for(let n=-4;n<=4;n++)g.lineBetween(x,h*.32,x+n*35,h*.435);}
   // L4 ground is laid before the foot-depth building silhouettes (L3).
   const b=MAP.bounds;box(b.x,b.y,b.w,b.h,0x9c9b80);
   for(let y=b.y;y<b.y+b.h;y+=45)for(let x=b.x-60;x<b.x+b.w;x+=83){const xx=x+(Math.floor(y/45)%2)*41,seed=(Math.floor(xx)*17+Math.floor(y)*31)%11;box(xx+2,y+2,79,41,[0xa8a38a,0x949781,0xb2aa8d,0x9fa087][Math.abs(seed)%4]);line(xx+3,y+42,xx+79,y+42,0x777f70,1,.6);}
   // A warm wooden eaves walk on the real, unobstructed front street.
   box(160,580,1880,180,0xb29a70);for(let x=160;x<2040;x+=26){line(x,580,x,760,0x776d52,1,.65);line(x+2,585,x+2,755,0xddbd84,1,.4);}line(160,579,2040,579,0xd6bc8b,5);line(160,762,2040,762,0x756d53,4);
   // The actual upper retaining masses remain solid and visibly edged.
   for(const wall of WALLS.filter(a=>!MAP.buildings.includes(a as never))){box(wall.x,wall.y,wall.w,wall.h,0x5f6b61);for(let y=wall.y;y<wall.y+wall.h;y+=38)for(let x=wall.x;x<wall.x+wall.w;x+=110){box(x+3,y+3,103,32,0x6c7566);line(x,y+36,x+108,y+36,0x48564f,2);}box(wall.x-3,wall.y-10,wall.w+6,12,0xd2bb83);}
   // L3: real building footprints, timber frames, eaves and tiled side planes.
   for(const house of MAP.buildings){const{x,y,w:bw,h:bh}=house;
    shape([x+15,y+bh,x+bw+45,y+bh,x+bw+90,y+bh+25,x+45,y+bh+25],0x39463d,.28);
    box(x,y,bw,bh,0x966f4c);shape([x+bw,y,x+bw+32,y-24,x+bw+32,y+bh-24,x+bw,y+bh],0x544536);
    for(let yy=y+24;yy<y+bh-28;yy+=89){box(x,yy+64,bw,8,0x513f31);for(let xx=x+25;xx<x+bw-30;xx+=67){box(xx,yy,40,48,0x493e30);box(xx+4,yy+5,32,38,0xf0c786);line(xx+19,yy,xx+19,yy+48,0x6d5038,3);line(xx,yy+23,xx+40,yy+23,0x6d5038,3);}}
    for(let xx=x+8;xx<x+bw;xx+=82){box(xx,y,9,bh,0x5b4534);box(xx+9,y,3,bh,0xc49b62);}
    box(x-9,y+bh-29,bw+18,16,0xba9763);for(let xx=x;xx<x+bw;xx+=32)box(xx,y+bh-57,4,28,0x4c4434);
    shape([x-27,y+4,x+12,y-56,x+bw-4,y-56,x+bw+46,y+4,x+bw+8,y+17,x-32,y+17],0x454f48);
    for(let yy=y-43;yy<y+4;yy+=12){line(x+10-(yy-y+43)*.55,yy,x+bw+15+(yy-y+43)*.45,yy,0x788172,2);}
    for(let xx=x+13;xx<x+bw;xx+=23)line(xx,y-52,xx-25,y+5,0x2e3e3a,2,.7);
    const door=x+bw/2;box(door-24,y+bh-73,48,60,0x39463b);box(door-19,y+bh-68,38,49,0x68533b);box(door+10,y+bh-42,4,7,0xf0c96a);
   }
   for(let i=0;i<SITES.length;i++){const s=SITES[i],active=i===r.nearby||i===r.site;g.lineStyle(2,active?0xffe3a0:0xe2c78f,.8);g.strokeEllipse(ox+s.x*k,oy+s.y*k,68*k,24*k);box(s.x-10,s.y-10,20,13,0xf0d89d,.9);box(s.x-4,s.y-14,8,4,0xf0d89d);}
   if(!c){g.fillStyle(0x17272d,.35);g.fillEllipse(ox+r.x*k,oy+r.y*k+3,30*k,12*k);box(r.x-10,r.y-29,20,26,0x3c7775);g.fillStyle(0xffdbab);g.fillCircle(ox+r.x*k,oy+(r.y-38)*k,11*k);line(r.x-9,r.y-27,r.x+9,r.y-7,0xe4bb7c,4);g.lineStyle(1.5,0xffedb7,.9);g.strokeEllipse(ox+r.x*k,oy+r.y*k+2,30*k,12*k);}
   // L5: close eaves, lantern light and tree foliage frame the view.
   poly([0,0,190,0,125,83,0,125],0x273c37,.95);poly([w-185,0,w,0,w,152,w-75,112],0x273c37,.95);
   for(let n=0;n<8;n++){g.lineStyle(2,0x738071,.5);g.lineBetween(0,n*14,155-n*9,13+n*8);}
   for(const [x,start,count] of [[w-42,105,3],[w-140,85,2]]){g.lineStyle(2,0x564632);g.lineBetween(x,0,x,start+count*70);for(let n=0;n<count;n++){const yy=start+n*70;for(let j=3;j>0;j--){g.fillStyle(0xffcb78,.025);g.fillCircle(x,yy,20+j*13);}g.fillStyle(0xb6623c);g.fillEllipse(x,yy,29,39);g.fillStyle(0xf3b65c);g.fillEllipse(x-3,yy-1,17,31);rect(x-9,yy-22,18,4,0x554432);rect(x-8,yy+18,16,4,0x554432);rect(x-1,yy+22,2,12,0xd2a260);}}
   g.lineStyle(18,0x384b3e,.85);g.lineBetween(0,h,95,h-120);g.lineBetween(45,h-50,15,h-165);
   for(let n=0;n<30;n++){const xx=(n*47)%120-35,yy=h-20-(n*29)%120;g.fillStyle(n%3?0x3f5842:0x647650,.9);g.fillEllipse(xx,yy,45,23);}
   rect(0,0,w,h,0xffcf87,.06);
   if(c){rect(0,0,w,h,0x000000,.55);const f=c.frame;g.lineStyle(2,0xf0c96a);g.strokeRect(f.x,f.y,f.w,f.h);g.lineStyle(1,0xf0c96a,.35);for(const n of [1,2]){g.lineBetween(f.x+f.w*n/3,f.y,f.x+f.w*n/3,f.y+f.h);g.lineBetween(f.x,f.y+f.h*n/3,f.x+f.w,f.y+f.h*n/3);}g.lineStyle(4,0xffe0a0);for(const [xx,yy,sx,sy] of [[f.x,f.y,1,1],[f.x+f.w,f.y,-1,1],[f.x,f.y+f.h,1,-1],[f.x+f.w,f.y+f.h,-1,-1]]){g.lineBetween(xx,yy,xx+12*sx,yy);g.lineBetween(xx,yy,xx,yy+12*sy);}const s=c.subject;if(s.x>=f.x&&s.y>=f.y&&s.x+s.w<=f.x+f.w&&s.y+s.h<=f.y+f.h){g.lineStyle(2,0xffdfa0,.5);g.strokeRect(s.x,s.y,s.w,s.h);}}
   update();
  });}
 }});
 const resize=()=>game.scale.resize(innerWidth,innerHeight);window.addEventListener('resize',resize);
 return()=>{window.removeEventListener('resize',resize);game.destroy(true);};
}
