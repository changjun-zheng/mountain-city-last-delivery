import {SITES,MAP,WALLS,type Rect} from './content';
export function score(view:Rect,subject:Rect){
 const t=6,inside=subject.x>=view.x-t&&subject.y>=view.y-t&&subject.x+subject.w<=view.x+view.w+t&&subject.y+subject.h<=view.y+view.h+t;
 const coverage=subject.w*subject.h/(view.w*view.h);
 const rank=!inside?0:coverage>=.44?3:coverage>=.25?2:coverage>=.10?1:0;
 return {rank,coverage,inside,reason:!inside?'主体偏出画面，退后半步':coverage<.10?'主体太小，按 Shift 换焦段':''};
}
export class PhotoRuntime{
 x=1120;y=1180;site=-1;zoom=1;gender=0;album=[0,0,0];result='';reason='';rank=0;shots=0;flash=0;coverage=0;
 get nearby(){return SITES.findIndex(s=>Math.hypot(s.x-this.x,s.y-this.y)<=64);}
 enter(){if(this.site<0){if(this.nearby<0)return;this.site=this.nearby;}this.result='';this.reason='';}
 exit(){this.site=-1;this.result='';this.reason='';this.zoom=1;}
 move(x:number,y:number,dt:number){
  const n=Math.max(1,Math.hypot(x,y)),steps=Math.max(1,Math.ceil(175*dt/6)),b=MAP.bounds;
  const valid=(px:number,py:number)=>px>=b.x+12&&px<=b.x+b.w-12&&py>=b.y+12&&py<=b.y+b.h-12&&!WALLS.some(w=>px+12>w.x&&px-12<w.x+w.w&&py+12>w.y&&py-12<w.y+w.h);
  for(let i=0;i<steps;i++){const nx=this.x+x/n*175*dt/steps;if(valid(nx,this.y))this.x=nx;const ny=this.y+y/n*175*dt/steps;if(valid(this.x,ny))this.y=ny;}
 }
 composition(w:number,h:number){
  // Raised-camera view: the subject rectangle is centred and magnified 1.6x.
  // Camera origin is clamped so the baked plate always covers the viewport.
  const frame={x:w*.175,y:h*.175,w:w*.65,h:h*.65},b=SITES[this.site].subject;
  const k=Math.max(w/MAP.width,h/MAP.height)*1.55*this.zoom;
  const cx=b.x+b.w/2,cy=b.y+b.h/2;
  const ox=Math.min(0,Math.max(w-MAP.width*k,w/2-cx*k));
  const oy=Math.min(0,Math.max(h-MAP.height*k,h/2-cy*k));
  const subject={x:ox+b.x*k,y:oy+b.y*k,w:b.w*k,h:b.h*k};
  return {frame,subject,k,ox,oy,d:0};
 }
 shoot(w:number,h:number){const c=this.composition(w,h),s=score(c.frame,c.subject);this.album[this.site]=Math.max(this.album[this.site],s.rank);this.shots++;this.rank=s.rank;this.coverage=s.coverage;this.result=s.rank?`${['','铜','银','金'][s.rank]} · ${Math.round(s.coverage*100)}%`:'未达标';this.reason=s.reason;this.flash=100;return s;}
}
