import {runFloorRoute} from './exploration-floor-routes.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExplorationRuntime, validateExplorationSave, emptyExplorationSave } from '../src/core/exploration.ts';
import { EXP_SAFE } from '../src/core/exploration-content.ts';
import { FERRY_SAFE } from '../src/core/exploration-ferry.ts';
import { InMemoryRunProgress, EXP02A_PROGRESS_CONTENT as P, PROTOTYPE_PROGRESS_CONTENT } from '../src/core/progress.ts';
import { ExplorationInputSources } from '../src/platform/web/exploration-input.ts';
import { ExplorationStorage, EXP_STORAGE_KEY } from '../src/platform/web/exploration-storage.ts';

import {coreDriver as driver} from './exploration-floor-routes.mjs';
function takeItem(d){d.use('guide-door');d.use('note');d.close();d.use('guide-down');d.use('guide-exit');d.use('workshop-middle-door');d.use('workshop-up-3');d.use('plaque');d.close();d.use('workshop-down-2');d.use('workshop-middle-exit');}

// EXP-01 movement, persistence, idempotence and source coverage is retained;
// coordinates/IDs now reference the authorized EXP-02A map/content version.
test('EXP E01 eight directions stay equal speed; expanded building, corner, gate and large frames block',()=>{
  for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const d=driver(),p=d.r.snapshot.position;d.move(x,y,5);const q=d.r.snapshot.position;
    assert.ok(Math.abs(Math.hypot(q.x-p.x,q.y-p.y)-17.5)<.001);
  }
  const d=driver();d.to(710,600);d.move(0,-1,100);assert.ok(d.r.snapshot.position.y>=532);
  d.move(1,-1,40);assert.ok(d.r.snapshot.position.x>710);
  const gate=driver({...emptyExplorationSave(),safe:'cMiddleDownEast'});gate.r.move(0,1);gate.jump(1_000_000);assert.ok(gate.r.snapshot.position.y<=1068);gate.move(0,1,200);assert.ok(gate.r.snapshot.position.y<=1068);gate.move(1,0,200);assert.ok(gate.r.snapshot.position.x<=2128);
});
test('EXP E02 real multi-room navigation, missing conditions, held interaction and three round trips',()=>{
  const d=driver(),id=d.r.id;d.use('guide-door');
  for(let i=0;i<3;i++){d.use('guide-upper-exit');assert.equal(d.r.save.safe,'cGuideH3');d.use('guide-door');assert.equal(d.r.id,id);}
  d.use('guide-upper-exit');takeItem(d);assert.equal(d.r.snapshot.item,true);assert.equal(d.r.snapshot.accepted,false);
  d.use('gate');d.close();assert.equal(d.r.snapshot.unlocked,false);assert.equal(d.r.snapshot.item,true);
  d.use('middle-west-upper');d.use('core-to-entry');d.use('visitor');assert.equal(d.r.snapshot.accepted,false);
  const revision=d.r.snapshot.revision;d.r.interact(true);d.step(20);assert.equal(d.r.snapshot.revision,revision);d.close();d.r.interact(false);assert.equal(d.r.snapshot.accepted,true);
  d.use('entry-to-core');d.use('east-down');d.use('gate');assert.equal(d.r.snapshot.unlocked,false);d.close();assert.equal(d.r.snapshot.unlocked,true);
  const before=d.r.snapshot.progress;d.use('gate');d.close();assert.deepEqual(d.r.snapshot.progress,before);
  d.use('middle-east-lower');assert.equal(d.r.snapshot.map,'lower');assert.equal(d.r.id,id);d.use('riverfront-down');d.use('view');d.r.closePhotoPreview();assert.equal(d.r.snapshot.completed,true);assert.equal(d.r.snapshot.photographed,false,'Old found-view goal is not a photograph');
  const restored=new ExplorationRuntime('new-runtime',d.r.save);assert.equal(restored.snapshot.completed,true);assert.equal(restored.snapshot.map,'riverfront');assert.deepEqual(restored.snapshot.position,{x:1910,y:1050});assert.equal(restored.snapshot.pauseCount,0);
});
test('EXP E03 closed records, immutable targets, atomic validation and every unlocked safe anchor',()=>{
  const isolated=driver();assert.deepEqual(isolated.r.snapshot.position,{x:230,y:690});isolated.target('guide-door');
  assert.throws(()=>{isolated.r.snapshot.target.x=999;},TypeError);assert.equal(isolated.r.snapshot.target.x,710);
  const legacy=new InMemoryRunProgress();assert.equal(legacy.completeGoal(P.unlocked).status,'rejected');assert.equal(legacy.recordCollection(P.item).status,'rejected');
  const progress=new InMemoryRunProgress('exp02a');assert.equal(progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId).status,'rejected');progress.completeGoal(P.accepted);const baseline=progress.snapshot;
  assert.equal(progress.restore({...baseline,goals:[P.accepted,'goal.exp02a.unknown']}),false);assert.deepEqual(progress.snapshot,baseline);
  const empty=new ExplorationRuntime('empty').save;
  for(const value of [null,{}, {...empty,schemaVersion:2},{...empty,contentVersion:'exp01-wooden-court-1'},{...empty,safe:'toString'},{...empty,safe:'overlook'},{...empty,safe:'eastLower'},{...empty,body:{}}])assert.equal(validateExplorationSave(value),undefined);
  const contradictory=new InMemoryRunProgress('exp02a');contradictory.completeGoal(P.unlocked);assert.equal(validateExplorationSave({...empty,progress:contradictory.snapshot}),undefined);
  assert.equal(progress.restore({...baseline,goals:[P.accepted,P.accepted],counts:{...baseline.counts,goals:2}}),false);assert.deepEqual(progress.snapshot,baseline);
  const full=new InMemoryRunProgress('exp02a');full.completeGoal(P.accepted);full.completeGoal(P.clue);full.recordCollection(P.item);full.completeGoal(P.unlocked);
  for(const [safe,point] of Object.entries(EXP_SAFE)){
    if(Object.hasOwn(FERRY_SAFE,safe)){assert.equal(validateExplorationSave({...empty,safe,progress:full.snapshot}),undefined);continue;}
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
