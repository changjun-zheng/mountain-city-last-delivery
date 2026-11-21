// Explicit, shared walking steps only. No pathfinding, state writes or test APIs.
export const FLOOR_ROUTES=Object.freeze({
  guideUp:[[340,540],[820,540],'guide-up',[950,700],[950,350]],
  guideBack:[[950,700],[300,700],'guide-down',[820,540],[540,540]],
  workshopUp:[[760,540],[250,540],'workshop-up-2',[1080,700],'workshop-up-3',[760,700],[760,430]],
  workshopBack:[[760,700],[250,700],'workshop-down-2',[250,700],'workshop-down-1',[250,540],[540,540]],
});
export function runFloorRoute(driver,name){for(const step of FLOOR_ROUTES[name]){if(Array.isArray(step))driver.to(...step);else driver.interact(step);}}
export async function runBrowserFloorRoute(page,name,walk,interact){for(const step of FLOOR_ROUTES[name]){if(Array.isArray(step))await walk(page,...step);else await interact(page,step);}}

// Unit-only independent grid search chooses walking waypoints. It never writes
// a runtime position, safe, progress or input internals. Browser routes remain
// explicit and use genuine keyboard/joystick events.
import assert from 'node:assert/strict';
import {ExplorationRuntime,emptyExplorationSave} from '../src/core/exploration.ts';
import {EXP_MAPS,EXP_TARGETS,EXP_SAFE,explorationWalls} from '../src/core/exploration-content.ts';
export function coreDriver(save={...emptyExplorationSave(),safe:'cArrival'}){
 const r=new ExplorationRuntime('walking-test',save);let clock=0;r.frame(clock);
 const step=(n=1)=>{for(let i=0;i<n;i++)r.frame(clock+=20);};
 const clear=p=>{const b=EXP_MAPS[r.snapshot.map].bounds;return p.x>=b.x+12&&p.x<=b.x+b.w-12&&p.y>=b.y+12&&p.y<=b.y+b.h-12&&!explorationWalls(r.snapshot.map,r.snapshot.unlocked).some(w=>p.x+12>w.x&&p.x-12<w.x+w.w&&p.y+12>w.y&&p.y-12<w.y+w.h);};
 const axis=(key,value)=>{for(let n=0;n<4000;n++){const delta=value-r.snapshot.position[key];if(Math.abs(delta)<=1.8){r.move(0,0);return;}r.move(key==='x'?Math.sign(delta)*Math.min(1,Math.abs(delta)/3.5):0,key==='y'?Math.sign(delta)*Math.min(1,Math.abs(delta)/3.5):0);step();}assert.fail('blocked axis '+JSON.stringify({map:r.snapshot.map,key,value,at:r.snapshot.position}));};
 const rawTo=(x,y)=>{axis('x',x);axis('y',y);};
 const to=(x,y)=>{
  assert.ok(clear({x,y}),'destination foot blocked '+JSON.stringify({map:r.snapshot.map,x,y}));
  const at=r.snapshot.position,rounded=[Math.round(at.x/10),Math.round(at.y/10)];
  const start=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1]].map(([a,b])=>[rounded[0]+a,rounded[1]+b]).filter(([a,b])=>clear({x:a*10,y:b*10})).sort((a,b)=>Math.hypot(a[0]*10-at.x,a[1]*10-at.y)-Math.hypot(b[0]*10-at.x,b[1]*10-at.y))[0];
  assert.ok(start,'no clear grid start');const end=[Math.round(x/10),Math.round(y/10)],key=(a,b)=>a+','+b;
  const queue=[start],seen=new Map([[key(...start),null]]);let found=false;
  for(let n=0;n<queue.length;n++){const [a,b]=queue[n];if(a===end[0]&&b===end[1]){found=true;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next=[a+dx,b+dy],k=key(...next);if(!seen.has(k)&&clear({x:next[0]*10,y:next[1]*10})){seen.set(k,[a,b]);queue.push(next);}}}
  assert.ok(found,'no walking route '+JSON.stringify({map:r.snapshot.map,start,end}));
  const path=[];for(let p=end;p;p=seen.get(key(...p)))path.push(p);path.reverse();
  const turns=path.filter((p,i)=>i===0||i===path.length-1||path[i+1][0]-p[0]!==p[0]-path[i-1][0]||path[i+1][1]-p[1]!==p[1]-path[i-1][1]);
  for(const [a,b] of turns)rawTo(a*10,b*10);rawTo(x,y);
 };
 const interact=id=>{assert.equal(r.snapshot.target?.id,id);r.interact(true);r.interact(false);};
 const target=id=>{const t=EXP_TARGETS.find(t=>t.id===id&&t.map===r.snapshot.map);assert.ok(t,id+' absent in '+r.snapshot.map);const p=[{x:t.x,y:t.y},{x:t.x,y:t.y+30},{x:t.x-30,y:t.y},{x:t.x+30,y:t.y}].find(clear);assert.ok(p,'no clear approach '+id);to(p.x,p.y);assert.equal(r.snapshot.target?.id,id);return t;};
 const use=id=>{target(id);interact(id);};
 return{r,to,rawTo,axis,step,interact,target,use,close:ok=>r.closeDialogue(ok),move:(x,y,n)=>{r.move(x,y);step(n);r.move(0,0);},jump:ms=>{clock+=ms;r.frame(clock);}};
}
