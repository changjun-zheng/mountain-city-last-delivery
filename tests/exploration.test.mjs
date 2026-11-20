import {runFloorRoute} from './exploration-floor-routes.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExplorationRuntime, validateExplorationSave, emptyExplorationSave } from '../src/core/exploration.ts';
import { EXP_SAFE } from '../src/core/exploration-content.ts';
import { InMemoryRunProgress, EXP02A_PROGRESS_CONTENT as P, PROTOTYPE_PROGRESS_CONTENT } from '../src/core/progress.ts';
import { ExplorationInputSources } from '../src/platform/web/exploration-input.ts';
import { ExplorationStorage, EXP_STORAGE_KEY } from '../src/platform/web/exploration-storage.ts';

// Explicit historical C fixture: fresh A gameplay is covered by the prologue suite.
function driver(save={...emptyExplorationSave(),safe:'arrival'}) {
  const r=new ExplorationRuntime('test-runtime',save);let time=0;r.frame(time);
  const step=(n=1)=>{for(let i=0;i<n;i++)r.frame(time+=20);};
  const move=(x,y,n)=>{r.move(x,y);step(n);r.move(0,0);};
  const to=(x,y)=>{
    for(let i=0;i<2000;i++){
      const p=r.snapshot.position,dx=x-p.x,dy=y-p.y;
      if(Math.hypot(dx,dy)<4){r.move(0,0);return;}
      r.move(Math.abs(dx)<2?0:Math.sign(dx),Math.abs(dy)<2?0:Math.sign(dy));step();
    }
    assert.fail(`Unreachable ${x},${y} from ${JSON.stringify(r.snapshot.position)}`);
  };
  const interact=(target)=>{assert.equal(r.snapshot.target?.id,target);r.interact(true);r.interact(false);};
  const close=()=>{r.closeDialogue();step();};
  return {r,step,move,to,interact,close,jump:ms=>{time+=ms;r.frame(time);}};
}
function takeItem(d) {
  d.to(880,690);d.to(880,580);d.interact('guide-door');assert.equal(d.r.snapshot.map,'guide');
  runFloorRoute(d,'guideUp');d.interact('note');d.close();
  runFloorRoute(d,'guideBack');d.interact('guide-exit');
  d.to(880,630);d.to(2300,630);d.to(2300,580);d.interact('workshop-door');
  runFloorRoute(d,'workshopUp');d.interact('plaque');d.close();
  runFloorRoute(d,'workshopBack');d.interact('workshop-exit');
}

// EXP-01 movement, persistence, idempotence and source coverage is retained;
// coordinates/IDs now reference the authorized EXP-02A map/content version.
test('EXP E01 eight directions stay equal speed; expanded building, corner, gate and large frames block',()=>{
  for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const d=driver(),p=d.r.snapshot.position;d.move(x,y,5);const q=d.r.snapshot.position;
    assert.ok(Math.abs(Math.hypot(q.x-p.x,q.y-p.y)-17.5)<.001);
  }
  const d=driver();d.to(880,630);d.move(0,-1,100);assert.ok(d.r.snapshot.position.y>=542);
  d.move(1,-1,40);assert.ok(d.r.snapshot.position.x>940);
  d.to(1120,630);d.to(2700,630);d.to(2700,750);d.r.move(1,0);d.jump(1_000_000);assert.ok(d.r.snapshot.position.x<=2738);
  d.move(1,0,200);assert.ok(d.r.snapshot.position.x<=2738);d.move(0,-1,200);assert.ok(d.r.snapshot.position.y>=252);
});
test('EXP E02 real multi-room navigation, missing conditions, held interaction and three round trips',()=>{
  const d=driver();d.to(880,690);d.to(880,580);d.interact('guide-door');const id=d.r.id;
  for(let i=0;i<3;i++){d.interact('guide-exit');assert.deepEqual(d.r.snapshot.position,{x:880,y:580});d.interact('guide-door');assert.equal(d.r.id,id);}
  d.interact('guide-exit');takeItem(d);assert.equal(d.r.snapshot.item,true);assert.equal(d.r.snapshot.accepted,false);
  d.to(2300,650);d.to(2700,650);d.to(2700,750);d.interact('gate');d.close();assert.equal(d.r.snapshot.unlocked,false);assert.equal(d.r.snapshot.item,true);
  d.to(2700,650);d.to(175,650);d.to(175,690);d.interact('core-to-entry');d.to(1140,780);d.to(1140,800);d.interact('visitor');assert.equal(d.r.snapshot.accepted,false);
  const revision=d.r.snapshot.revision;d.r.interact(true);d.step(20);assert.equal(d.r.snapshot.revision,revision);d.close();d.r.interact(false);assert.equal(d.r.snapshot.accepted,true);
  d.to(2040,800);d.to(2040,780);d.interact('entry-to-core');d.to(230,650);d.to(2700,650);d.to(2700,750);d.interact('gate');assert.equal(d.r.snapshot.unlocked,false);d.close();assert.equal(d.r.snapshot.unlocked,true);
  const before=d.r.snapshot.progress;d.interact('gate');d.close();assert.deepEqual(d.r.snapshot.progress,before);
  d.to(3060,750);d.interact('east-down');assert.equal(d.r.snapshot.map,'middle');d.to(3000,1200);d.interact('middle-east-lower');assert.equal(d.r.snapshot.map,'lower');assert.equal(d.r.id,id);
  d.to(2100,650);d.to(1780,650);d.to(1780,1120);d.to(1700,1120);d.interact('riverfront-down');d.to(900,650);d.to(900,1050);d.to(1950,1050);d.interact('view');d.r.closePhotoPreview();assert.equal(d.r.snapshot.completed,true);assert.equal(d.r.snapshot.photographed,false,'Old found-view goal is not a photograph');
  const restored=new ExplorationRuntime('new-runtime',d.r.save);assert.equal(restored.snapshot.completed,true);assert.equal(restored.snapshot.map,'riverfront');assert.deepEqual(restored.snapshot.position,{x:1910,y:1050});assert.equal(restored.snapshot.pauseCount,0);
});
test('EXP E03 closed records, immutable targets, atomic validation and every unlocked safe anchor',()=>{
  const isolated=driver();assert.deepEqual(isolated.r.snapshot.position,{x:230,y:690});isolated.to(880,690);isolated.to(880,580);
  assert.throws(()=>{isolated.r.snapshot.target.x=999;},TypeError);assert.equal(isolated.r.snapshot.target.x,880);
  const legacy=new InMemoryRunProgress();assert.equal(legacy.completeGoal(P.unlocked).status,'rejected');assert.equal(legacy.recordCollection(P.item).status,'rejected');
  const progress=new InMemoryRunProgress('exp02a');assert.equal(progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId).status,'rejected');progress.completeGoal(P.accepted);const baseline=progress.snapshot;
  assert.equal(progress.restore({...baseline,goals:[P.accepted,'goal.exp02a.unknown']}),false);assert.deepEqual(progress.snapshot,baseline);
  const empty=new ExplorationRuntime('empty').save;
  for(const value of [null,{}, {...empty,schemaVersion:2},{...empty,contentVersion:'exp01-wooden-court-1'},{...empty,safe:'toString'},{...empty,safe:'overlook'},{...empty,safe:'eastLower'},{...empty,body:{}}])assert.equal(validateExplorationSave(value),undefined);
  const contradictory=new InMemoryRunProgress('exp02a');contradictory.completeGoal(P.unlocked);assert.equal(validateExplorationSave({...empty,progress:contradictory.snapshot}),undefined);
  assert.equal(progress.restore({...baseline,goals:[P.accepted,P.accepted],counts:{...baseline.counts,goals:2}}),false);assert.deepEqual(progress.snapshot,baseline);
  const full=new InMemoryRunProgress('exp02a');full.completeGoal(P.accepted);full.completeGoal(P.clue);full.recordCollection(P.item);full.completeGoal(P.unlocked);
  for(const [safe,point] of Object.entries(EXP_SAFE)){
    const r=new ExplorationRuntime('safe',{...empty,safe,progress:full.snapshot});assert.equal(r.snapshot.map,point.map);r.move(1,1);r.frame(0);r.frame(20);assert.notDeepEqual(r.snapshot.position,{x:point.x,y:point.y});
  }
});
test('EXP E03 storage preserves malformed originals and reports write failures without clearing unrelated keys',()=>{
  const data=new Map([['another-game','keep']]);const port={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const save=new ExplorationRuntime('a').save;
  const storage=new ExplorationStorage(port);storage.load();storage.save(save);assert.equal(storage.status,'已自动保存');assert.ok(storage.load());
  for(const raw of ['{broken',JSON.stringify({...save,schemaVersion:999}),JSON.stringify({...save,safe:'overlook'})]){
    data.set(EXP_STORAGE_KEY,raw);const broken=new ExplorationStorage(port);assert.equal(broken.load(),undefined);broken.save(save);assert.equal(data.get(EXP_STORAGE_KEY),raw);assert.match(broken.status,/本次未保存/);
  }
  const failure=new ExplorationStorage({...port,setItem:()=>{throw new Error('quota');}});data.delete(EXP_STORAGE_KEY);failure.load();failure.save(save);assert.match(failure.status,/本次未保存/);
  assert.equal(storage.restart(),true);assert.ok(data.has(EXP_STORAGE_KEY));assert.equal(new ExplorationStorage(port).load().safe,'chapterStart');assert.equal(data.get('another-game'),'keep');
});
test('EXP E04 alias and mixed sources release independently; pause owners freeze and resume without catchup',()=>{
  const s=new ExplorationInputSources();s.key('KeyD',true);s.key('ArrowRight',true);s.key('KeyD',false);assert.equal(s.snapshot.x,1);
  s.pointers.set(1,{x:0,y:1,interact:false});s.pointers.set(2,{x:0,y:0,interact:true});s.key('ArrowRight',false);assert.equal(s.snapshot.y,1);assert.equal(s.snapshot.interact,true);
  s.pointers.delete(2);assert.equal(s.snapshot.y,1);assert.equal(s.snapshot.interact,false);s.clear();assert.equal(s.snapshot.pointers,0);
  const d=driver();const a=Symbol('menu'),b=Symbol('hidden');const ta=d.r.lifecycle.acquire(a,Symbol()),tb=d.r.lifecycle.acquire(b,Symbol());
  const before=d.r.snapshot;d.move(1,0,100);assert.equal(d.r.snapshot.tick,before.tick);
  assert.equal(d.r.lifecycle.release(a,ta),'released');assert.equal(d.r.snapshot.paused,true);
  assert.equal(d.r.lifecycle.release(a,tb),'rejected');d.r.lifecycle.release(b,tb);d.r.frame(99999);assert.equal(d.r.snapshot.tick,before.tick);
  d.r.frame(100019);assert.equal(d.r.snapshot.tick,before.tick+1);
  d.r.dispose();d.r.dispose();d.r.move(1,0);d.r.interact(true);d.r.frame(200000);assert.equal(d.r.snapshot.disposed,true);assert.equal(d.r.snapshot.tick,before.tick+1);
});
