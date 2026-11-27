import {runFloorRoute} from './exploration-floor-routes.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExplorationRuntime, validateExplorationSave, emptyExplorationSave } from '../src/core/exploration.ts';
import { EXP_MAPS, EXP_TARGETS, EXP_SAFE, EXP_LEGACY_SAFE, EXP_CONTENT_VERSION, explorationWalls, segmentHitsRect } from '../src/core/exploration-content.ts';
import { InMemoryRunProgress, EXP01_PROGRESS_CONTENT, EXP02A_PROGRESS_CONTENT as P } from '../src/core/progress.ts';
import { ExplorationStorage, EXP_STORAGE_KEY, EXP_LEGACY_STORAGE_KEY } from '../src/platform/web/exploration-storage.ts';
import { FERRY_SAFE } from '../src/core/exploration-ferry.ts';

import {coreDriver as driver} from './exploration-floor-routes.mjs';
function fullProgress(){const p=new InMemoryRunProgress('exp02a');p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);p.completeGoal(P.unlocked);return p.snapshot;}

test('STORY-01 storage-door information follows discovered clue and actual clasp ownership without committing anything',()=>{
 for(const [clue,item] of [[false,false],[true,false],[false,true],[true,true]]){
  const p=new InMemoryRunProgress('exp03b');
  if(clue||item)p.completeGoal(P.accepted);
  if(clue)p.completeGoal(P.clue);
  if(item)p.recordCollection(P.item);
  const save={...emptyExplorationSave(),safe:'cUpperWest',progress:p.snapshot};assert.ok(validateExplorationSave(save));
  const d=driver(save);d.target('wrong-gate');const before=d.r.save,revision=d.r.snapshot.revision;
  for(const close of [false,true,true]){
   d.interact('wrong-gate');const s=d.r.snapshot;
   assert.match(s.dialogue,/三角山纹/);assert.match(s.dialogue,/杂物/);assert.equal(s.pending,undefined);
   if(item){assert.match(s.dialogue,/两道水波.*不匹配/);assert.match(s.dialogue,/导扣仍留在身上/);}
   else if(clue){assert.match(s.dialogue,/江纹栈门在中街/);assert.doesNotMatch(s.dialogue,/身上|导扣仍|导扣.*保留/);}
   else assert.doesNotMatch(s.dialogue,/江纹|导扣|水波/);
   assert.deepEqual(d.r.save,before);d.r.closeDialogue(close);assert.deepEqual(d.r.save,before);
   assert.equal(d.r.snapshot.revision,revision);assert.equal(d.r.snapshot.unlocked,false);assert.equal(d.r.lifecycle.pauseCount,0);
  }
 }
});

test('STORY-01 real middle gate still requires accepted request, clue and clasp, and confirmation',()=>{
 const gate=EXP_TARGETS.find(t=>t.id==='gate');assert.equal(gate.map,'middle');assert.equal(gate.locked,undefined);
 assert.equal(EXP_TARGETS.find(t=>t.id==='wrong-gate').map,'upper');
 for(const [accepted,clue,item] of [[false,false,false],[true,false,false],[true,true,false],[true,false,true],[true,true,true]]){
  const p=new InMemoryRunProgress('exp03b');if(accepted)p.completeGoal(P.accepted);if(clue)p.completeGoal(P.clue);if(item)p.recordCollection(P.item);
  const save={...emptyExplorationSave(),safe:'cUpperWest',progress:p.snapshot};assert.ok(validateExplorationSave(save));
  const d=driver(save);d.use('east-down');d.target('gate');const before=d.r.save;
  d.interact('gate');assert.equal(d.r.snapshot.pending,accepted&&clue&&item?'unlocked':undefined);d.r.closeDialogue(false);assert.deepEqual(d.r.save,before);
  d.interact('gate');d.r.closeDialogue();assert.equal(d.r.snapshot.unlocked,accepted&&clue&&item);
  assert.deepEqual(d.r.snapshot.progress.collections,before.progress.collections);
 }
});

test('STORY-01 collecting clasp before reading the display keeps the same truthful storage-door reply',()=>{
 const p=new InMemoryRunProgress('exp03b');p.completeGoal(P.accepted);
 const d=driver({...emptyExplorationSave(),safe:'cWoodH3',progress:p.snapshot});
 d.use('workshop-upper-door');d.use('plaque');d.r.closeDialogue();d.use('workshop-upper-exit');d.use('wrong-gate');
 const reply=d.r.snapshot.dialogue;assert.match(reply,/导扣仍留在身上/);assert.equal(d.r.snapshot.clue,false);d.r.closeDialogue();
 d.use('guide-door');d.use('note');d.r.closeDialogue();d.use('guide-upper-exit');d.use('wrong-gate');
 assert.equal(d.r.snapshot.dialogue,reply);assert.equal(d.r.snapshot.item,true);assert.equal(d.r.snapshot.clue,true);assert.equal(d.r.snapshot.unlocked,false);
});

// EXP-06A explicitly replaces old C geometry/door expectations. Historical
// safe values remain frozen; cancellation, items and route ownership are kept.
test('EXP-02A A1 current bounded C and five useful paired building doorways, all foot anchors clear',()=>{
 assert.equal(Object.keys(EXP_MAPS).length,16);assert.equal(Object.keys(EXP_LEGACY_SAFE).length,12);
 for(const id of ['upper','middle','lower']){assert.equal(EXP_MAPS[id].width,2200);assert.ok(EXP_MAPS[id].buildings.length>=3);}
 for(const [safe,door,room,back] of [['cGuideH3','guide-door','guide2','guide-upper-exit'],['cWoodH3','workshop-upper-door','workshop3','workshop-upper-exit'],['cTeaH1','tea-door','tea','tea-exit'],['cLanternH1','lantern-door','lantern','lantern-exit'],['cMarketWest','market-west-door','market','market-west-exit']]){const d=driver({...emptyExplorationSave(),safe,progress:fullProgress()});d.use(door);assert.equal(d.r.snapshot.map,room);d.use(back);assert.equal(d.r.save.safe,safe);}
 for(const point of Object.values(EXP_SAFE)){const b=EXP_MAPS[point.map].bounds;assert.ok(point.x>=b.x+12&&point.x<=b.x+b.w-12&&point.y>=b.y+12&&point.y<=b.y+b.h-12);assert.ok(!explorationWalls(point.map,true).some(w=>point.x+12>w.x&&point.x-12<w.x+w.w&&point.y+12>w.y&&point.y-12<w.y+w.h));}
});
test('EXP-02A A3 cancel discards pending quest, note and pickup; normal close commits once',()=>{
 const d=driver({...emptyExplorationSave(),safe:'entryFromCity'});d.use('visitor');d.r.closeDialogue(false);assert.equal(d.r.snapshot.accepted,false);d.use('visitor');d.r.closeDialogue();assert.equal(d.r.snapshot.accepted,true);const before=d.r.snapshot.progress;d.r.closeDialogue();assert.deepEqual(d.r.snapshot.progress,before);d.use('entry-to-core');d.use('guide-door');d.use('note');d.r.closeDialogue(false);assert.equal(d.r.snapshot.clue,false);d.use('note');d.r.closeDialogue();assert.equal(d.r.snapshot.clue,true);d.use('guide-upper-exit');d.use('workshop-upper-door');d.use('plaque');d.r.closeDialogue(false);assert.equal(d.r.snapshot.item,false);d.use('plaque');d.r.closeDialogue();assert.equal(d.r.snapshot.item,true);
});
test('EXP-02A A3 no interaction through the workshop screen or across maps; wrong gate preserves item',()=>{
 const d=driver({...emptyExplorationSave(),safe:'cWood1Door'});d.to(680,415);assert.equal(d.r.snapshot.target,undefined);d.r.interact(true);d.r.interact(false);assert.equal(d.r.snapshot.dialogue,'');assert.equal(d.r.snapshot.item,false);assert.ok(segmentHitsRect({x:680,y:415},{x:760,y:415},{x:700,y:365,w:12,h:100}));
 d.use('workshop-up-2');d.use('workshop-up-3');d.use('plaque');d.r.closeDialogue();assert.equal(d.r.snapshot.item,true);assert.equal(d.r.snapshot.clue,false);d.use('workshop-upper-exit');assert.notEqual(d.r.snapshot.target?.id,'plaque');d.use('wrong-gate');d.r.closeDialogue();assert.equal(d.r.snapshot.item,true);assert.equal(d.r.snapshot.unlocked,false);
});
test('EXP-02A A3 free upper/middle loop cannot bypass lower unlock; open paired loop keeps same runtime',()=>{
 const d=driver();d.use('west-down');assert.equal(d.r.snapshot.map,'middle');d.use('middle-west-lower');d.r.closeDialogue();assert.equal(d.r.snapshot.map,'middle');
 const loop=driver({...emptyExplorationSave(),safe:'cUpperWest',progress:fullProgress()}),id=loop.r.id;
 for(const target of ['west-down','middle-west-lower','west-up','middle-west-upper'])loop.use(target);assert.equal(loop.r.save.safe,'cUpperWest');assert.equal(loop.r.id,id);
});
test('EXP-02A A4 independent content IDs, future/old version protection and unchanged old storage key',()=>{
  const old=new InMemoryRunProgress('exp01');old.completeGoal(EXP01_PROGRESS_CONTENT.accepted);old.completeGoal(EXP01_PROGRESS_CONTENT.clue);old.recordCollection(EXP01_PROGRESS_CONTENT.item);old.completeGoal(EXP01_PROGRESS_CONTENT.unlocked);old.completeGoal(EXP01_PROGRESS_CONTENT.completed);
  const oldRaw=JSON.stringify({schemaVersion:1,contentVersion:'exp01-wooden-court-1',safe:'overlook',progress:old.snapshot});
  const map=new Map([[EXP_LEGACY_STORAGE_KEY,oldRaw],['unrelated','keep']]);const port={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const storage=new ExplorationStorage(port);assert.equal(storage.load(),undefined);assert.match(storage.notice,/旧庭院小样档案保留/);const fresh=new ExplorationRuntime('fresh');assert.equal(fresh.snapshot.completed,false);storage.save(fresh.save);assert.equal(map.get(EXP_LEGACY_STORAGE_KEY),oldRaw);
  assert.equal(validateExplorationSave(JSON.parse(oldRaw)),undefined);assert.equal(validateExplorationSave({...fresh.save,progress:old.snapshot}),undefined);
  const bad={...fresh.save,contentVersion:EXP_CONTENT_VERSION+'future'};map.set(EXP_STORAGE_KEY,JSON.stringify(bad));const blocked=new ExplorationStorage(port);blocked.load();blocked.save(fresh.save);assert.equal(map.get(EXP_STORAGE_KEY),JSON.stringify(bad));assert.equal(map.get(EXP_LEGACY_STORAGE_KEY),oldRaw);
  assert.equal(storage.restart(),true);assert.ok(map.has(EXP_STORAGE_KEY));assert.equal(new ExplorationStorage(port).load().safe,'chapterStart');assert.equal(map.get(EXP_LEGACY_STORAGE_KEY),oldRaw);assert.equal(map.get('unrelated'),'keep');
});
test('EXP-02A A4 complete import rebuilds every map safe point without input, queue or duplicate records',()=>{
  const save={...new ExplorationRuntime('base').save,progress:fullProgress()};
  for(const [safe,p] of Object.entries(EXP_SAFE)){
    if(Object.hasOwn(FERRY_SAFE,safe)){assert.equal(validateExplorationSave({...save,safe}),undefined);continue;}
    const a=new ExplorationRuntime('restored-'+safe,{...save,safe});assert.equal(a.snapshot.map,p.map);assert.deepEqual(a.snapshot.position,{x:p.x,y:p.y});assert.equal(a.snapshot.unlocked,true);assert.equal(a.snapshot.pending,undefined);assert.equal(a.snapshot.pauseCount,0);
    assert.deepEqual(Object.keys(a.save).sort(),['contentVersion','observedSites','photo','progress','safe','schemaVersion']);assert.equal(a.save.photo,null);const progress=a.snapshot.progress;a.closeDialogue();assert.deepEqual(a.snapshot.progress,progress);
  }
});
