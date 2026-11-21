import {SITES,MAP,WALLS,type Rect} from './content';
export function score(view:Rect,subject:Rect){
 const inside=subject.x>=view.x&&subject.y>=view.y&&subject.x+subject.w<=view.x+view.w&&subject.y+subject.h<=view.y+view.h;
 const coverage=subject.w*subject.h/(view.w*view.h),cx=subject.x+subject.w/2,cy=subject.y+subject.h/2;
 const centered=cx>=view.x+view.w/3&&cx<=view.x+view.w*2/3&&cy>=view.y+view.h/3&&cy<=view.y+view.h*2/3;
 const rank=!inside||coverage<.10?0:coverage>=.22&&centered?(coverage>=.42?3:2):1;
 return {rank,coverage,inside,centered,reason:!inside?'主体偏出画面':coverage<.10?'主体太小，再靠近一点或使用长焦':!centered?'构图偏了，把主体放到画面中间':''};
}
export class PhotoRuntime{
 x=230;y=690;site=-1;zoom=1;album=[0,0,0];result='';reason='';rank=0;shots=0;flash=0;coverage=0;
 get nearby(){return SITES.findIndex(s=>Math.hypot(s.x-this.x,s.y-this.y)<=64);}
 enter(){if(this.site<0){if(this.nearby<0)return;this.site=this.nearby;}this.result='';this.reason='';}
 exit(){this.site=-1;this.result='';this.reason='';this.zoom=1;}
 move(x:number,y:number,dt:number){
  const n=Math.max(1,Math.hypot(x,y)),steps=Math.max(1,Math.ceil(175*dt/6)),b=MAP.bounds;
  const valid=(px:number,py:number)=>px>=b.x+12&&px<=b.x+b.w-12&&py>=b.y+12&&py<=b.y+b.h-12&&!WALLS.some(w=>px+12>w.x&&px-12<w.x+w.w&&py+12>w.y&&py-12<w.y+w.h);
  for(let i=0;i<steps;i++){const nx=this.x+x/n*175*dt/steps;if(valid(nx,this.y))this.x=nx;const ny=this.y+y/n*175*dt/steps;if(valid(this.x,ny))this.y=ny;}
 }
 composition(w:number,h:number){
  const frame={x:w*.275,y:h*.275,w:w*.45,h:h*.45},b=SITES[this.site].subject;
  const dx=b.x+b.w/2-this.x,dy=b.y+b.h/2-this.y,d=Math.max(Math.hypot(dx,dy),60);
  const focal=h*SITES[this.site].focalRatio,k=focal/d*this.zoom;
  const cx=w/2+dx*k,cy=h/2+dy*k+focal*this.zoom;
  const subject={x:cx-b.w*k/2,y:cy-b.h*k/2,w:b.w*k,h:b.h*k};
  return {frame,subject,k,ox:w/2-this.x*k,oy:h/2-this.y*k+focal*this.zoom,d};
 }
 shoot(w:number,h:number){const c=this.composition(w,h),s=score(c.frame,c.subject);this.album[this.site]=Math.max(this.album[this.site],s.rank);this.shots++;this.rank=s.rank;this.coverage=s.coverage;this.result=s.rank?`${['','铜','银','金'][s.rank]} · ${Math.round(s.coverage*100)}%`:'未达标';this.reason=s.reason;this.flash=100;return s;}
}
