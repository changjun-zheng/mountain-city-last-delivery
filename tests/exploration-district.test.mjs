import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExplorationRuntime, validateExplorationSave, emptyExplorationSave } from '../src/core/exploration.ts';
import { EXP_MAPS, EXP_TARGETS, EXP_SAFE, EXP_LEGACY_SAFE, EXP_CONTENT_VERSION, explorationWalls, segmentHitsRect } from '../src/core/exploration-content.ts';
import { InMemoryRunProgress, EXP01_PROGRESS_CONTENT, EXP02A_PROGRESS_CONTENT as P } from '../src/core/progress.ts';
import { ExplorationStorage, EXP_STORAGE_KEY, EXP_LEGACY_STORAGE_KEY } from '../src/platform/web/exploration-storage.ts';

// Explicit historical C fixture: fresh A gameplay is covered by the prologue suite.
function driver(save={...emptyExplorationSave(),safe:'arrival'}) {
  const r=new ExplorationRuntime('district-test',save);let time=0;r.frame(time);
  const to=(x,y)=>{for(let i=0;i<3000;i++){const p=r.snapshot.position,dx=x-p.x,dy=y-p.y;if(Math.hypot(dx,dy)<4){r.move(0,0);return;}r.move(Math.abs(dx)<2?0:Math.sign(dx),Math.abs(dy)<2?0:Math.sign(dy));r.frame(time+=20);}assert.fail('Unreachable '+JSON.stringify({x,y,actual:r.snapshot.position}));};
  const interact=id=>{assert.equal(r.snapshot.target?.id,id);r.interact(true);r.interact(false);};
  return {r,to,interact};
}
function fullProgress(){const p=new InMemoryRunProgress('exp02a');p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);p.completeGoal(P.unlocked);return p.snapshot;}

test('EXP-02A A1 five bounded maps, three paired doorways and all safe anchors clear foot blockers',()=>{
  assert.equal(Object.keys(EXP_MAPS).length,10);
  for(const id of ['upper','lower']){assert.equal(EXP_MAPS[id].width,3300);assert.equal(EXP_MAPS[id].height,1300);assert.ok(EXP_MAPS[id].buildings.length>=7);}
  assert.deepEqual(Object.keys(EXP_LEGACY_SAFE),['arrival','guideDoor','guideRoom','workshopDoor','workshopRoom','teaDoor','teaRoom','eastUpper','eastLower','westUpper','westLower','overlook']);
  for(const [door,room,back] of [['guide-door','guide','guideDoor'],['workshop-door','workshop','workshopDoor'],['tea-door','tea','teaDoor']]){
    const t=EXP_TARGETS.find(t=>t.id===door);assert.equal(EXP_SAFE[t.destination].map,room);
    const exit=EXP_TARGETS.find(t=>t.map===room&&t.destination);assert.equal(exit.destination,back);assert.equal(EXP_SAFE[back].map,'upper');
  }
  for(const point of Object.values(EXP_SAFE)){
    const b=EXP_MAPS[point.map].bounds;assert.ok(point.x>=b.x+12&&point.x<=b.x+b.w-12&&point.y>=b.y+12&&point.y<=b.y+b.h-12);
    assert.ok(!explorationWalls(point.map,true).some(w=>point.x+12>w.x&&point.x-12<w.x+w.w&&point.y+12>w.y&&point.y-12<w.y+w.h));
  }
});
test('EXP-02A A3 cancel discards pending quest, note and pickup; normal close commits once',()=>{
  const d=driver({...emptyExplorationSave(),safe:'entryFromCity'});d.to(1100,850);d.to(1100,800);d.interact('visitor');assert.equal(d.r.snapshot.accepted,false);d.r.closeDialogue(false);assert.equal(d.r.snapshot.accepted,false);
  d.interact('visitor');d.r.closeDialogue();assert.equal(d.r.snapshot.accepted,true);const accepted=d.r.snapshot.progress;d.r.closeDialogue();assert.deepEqual(d.r.snapshot.progress,accepted);
  d.to(2040,800);d.to(2040,780);d.interact('entry-to-core');d.to(880,690);d.to(880,580);d.interact('guide-door');d.to(340,540);d.to(340,325);d.interact('note');d.r.closeDialogue(false);assert.equal(d.r.snapshot.clue,false);
  d.interact('note');d.r.closeDialogue();assert.equal(d.r.snapshot.clue,true);d.to(340,540);d.to(540,540);d.interact('guide-exit');
  d.to(880,650);d.to(2300,650);d.to(2300,580);d.interact('workshop-door');d.to(760,540);d.to(760,430);d.interact('plaque');d.r.closeDialogue(false);assert.equal(d.r.snapshot.item,false);d.interact('plaque');d.r.closeDialogue();assert.equal(d.r.snapshot.item,true);
});
test('EXP-02A A3 no interaction through the workshop screen or across maps',()=>{
  const d=driver();d.to(2300,690);d.to(2300,580);d.interact('workshop-door');
  d.to(680,540);d.to(680,415);assert.equal(d.r.snapshot.target,undefined);d.r.interact(true);d.r.interact(false);assert.equal(d.r.snapshot.dialogue,'');assert.equal(d.r.snapshot.item,false);
  assert.equal(segmentHitsRect({x:680,y:415},{x:760,y:415},{x:700,y:365,w:12,h:100}),true);
  assert.equal(segmentHitsRect({x:760,y:430},{x:760,y:415},{x:700,y:365,w:12,h:100}),false);
  d.to(680,540);d.to(760,540);d.to(760,430);d.interact('plaque');d.r.closeDialogue();assert.equal(d.r.snapshot.item,true);assert.equal(d.r.snapshot.clue,false);
  d.to(760,540);d.to(540,540);d.interact('workshop-exit');assert.notEqual(d.r.snapshot.target?.id,'plaque');
  d.to(2300,650);d.to(150,650);d.to(150,850);d.interact('wrong-gate');d.r.closeDialogue();assert.equal(d.r.snapshot.item,true);assert.equal(d.r.snapshot.unlocked,false);
});
test('EXP-02A A3 west connection cannot bypass unlock; unlocked paired loop keeps same runtime',()=>{
  const d=driver();d.to(540,690);d.to(540,1150);d.interact('west-down');d.r.closeDialogue();assert.equal(d.r.snapshot.map,'upper');
  const save={...d.r.save,safe:'westUpper',progress:fullProgress()},loop=driver(save),id=loop.r.id;
  loop.interact('west-down');assert.equal(loop.r.snapshot.map,'middle');loop.to(400,1200);loop.interact('middle-west-lower');assert.equal(loop.r.snapshot.map,'lower');assert.equal(loop.r.id,id);assert.deepEqual(loop.r.snapshot.position,{x:430,y:1030});
  loop.interact('west-up');assert.equal(loop.r.snapshot.map,'middle');loop.to(400,450);loop.interact('middle-west-upper');assert.equal(loop.r.snapshot.map,'upper');assert.equal(loop.r.id,id);assert.deepEqual(loop.r.snapshot.position,{x:540,y:1150});
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
    const a=new ExplorationRuntime('restored-'+safe,{...save,safe});assert.equal(a.snapshot.map,p.map);assert.deepEqual(a.snapshot.position,{x:p.x,y:p.y});assert.equal(a.snapshot.unlocked,true);assert.equal(a.snapshot.pending,undefined);assert.equal(a.snapshot.pauseCount,0);
    assert.deepEqual(Object.keys(a.save).sort(),['contentVersion','observedSites','photo','progress','safe','schemaVersion']);assert.equal(a.save.photo,null);const progress=a.snapshot.progress;a.closeDialogue();assert.deepEqual(a.snapshot.progress,progress);
  }
});
