import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ExplorationRuntime,emptyExplorationSave,validateExplorationSave} from '../src/core/exploration.ts';
import {EXP_SAFE,explorationWalls} from '../src/core/exploration-content.ts';
import {FERRY_SAFE,FERRY_TRAVEL_MS} from '../src/core/exploration-ferry.ts';
import {planExplorationRoute} from '../src/core/exploration-navigation.ts';
import {PHOTO_METADATA} from '../src/core/exploration-photo.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';

function driver(save) {
  const runtime=new ExplorationRuntime('guidance-test',save);
  let clock=0;
  runtime.frame(clock);
  return {runtime, step(count=1){for(let n=0;n<count;n++)runtime.frame(clock+=20);}};
}

function riverside(safe,photographed=false) {
  const progress=new InMemoryRunProgress('exp03b');
  for(const goal of [P.accepted,P.clue,P.unlocked])progress.completeGoal(goal);
  progress.recordCollection(P.item);
  if(photographed){progress.completeGoal(P.completed);progress.completeGoal(Q.photographed);}
  return {...emptyExplorationSave(),safe,progress:progress.snapshot,observedSites:photographed?['river']:[],photo:photographed?PHOTO_METADATA:null};
}

test('tracking stops at the normal interaction and never grants it',()=>{
  const {runtime,step}=driver();
  assert.equal(runtime.snapshot.tracking.next.id,'city-monument');
  const save=runtime.save;
  assert.equal(runtime.startAutoWalk(),true);
  step(380);
  assert.equal(runtime.snapshot.tracking.walking,false);
  assert.equal(runtime.snapshot.target.id,'city-monument');
  assert.equal(runtime.snapshot.dialogue,'');
  assert.deepEqual(runtime.save,save);
  runtime.skipOnboarding();
  assert.equal(runtime.snapshot.tracking.next.id,'city-to-entry');
  assert.ok(runtime.startAutoWalk());
  step(810);
  assert.equal(runtime.snapshot.target.id,'city-to-entry');
  assert.equal(runtime.snapshot.map,'plaza');
  runtime.interact(true);runtime.interact(false);
  assert.equal(runtime.snapshot.map,'entry');
  assert.equal(runtime.snapshot.tracking.next.id,'visitor');
});

test('route switches on task selection, drops on manual input, and avoids closed links',()=>{
  const {runtime,step}=driver({...emptyExplorationSave(),safe:'cArrival'});
  runtime.trackTask('bookmark');
  assert.ok(runtime.startAutoWalk());
  step(4);
  runtime.move(1,0);
  assert.equal(runtime.snapshot.tracking.walking,false);
  runtime.clearInput();
  runtime.trackTask('sketch');
  assert.equal(runtime.snapshot.tracking.task,'bookmark');
  assert.equal(planExplorationRoute('middle',EXP_SAFE.cMiddleWest,explorationWalls('middle',false),'view',false),undefined);
  runtime.trackTask('none');
  assert.equal(runtime.startAutoWalk(),false);
  assert.deepEqual(runtime.snapshot.tracking.points,[]);
});

test('ferry requires a photographed commission, travels through time and saves on either bank',()=>{
  for(const safe of Object.keys(FERRY_SAFE))assert.equal(validateExplorationSave(riverside(safe)),undefined);
  const early=driver(riverside('riverView'));
  early.runtime.move(0,1);early.step(23);early.runtime.clearInput();
  assert.ok(early.runtime.snapshot.position.y<=1064);
  early.runtime.move(1,0);early.step(77);early.runtime.clearInput();
  early.runtime.move(0,1);early.step(68);early.runtime.clearInput();
  assert.ok(early.runtime.snapshot.position.y>1202 && early.runtime.snapshot.position.y<=1208);
  assert.equal(early.runtime.snapshot.target.id,'ferry-out');
  early.runtime.interact(true);early.runtime.interact(false);
  assert.equal(early.runtime.snapshot.pending,undefined);
  early.runtime.closeDialogue();
  assert.equal(early.runtime.snapshot.ferry,undefined);

  const {runtime,step}=driver(riverside('riverView',true));
  assert.ok(runtime.startAutoWalk());step(130);
  assert.equal(runtime.snapshot.target.id,'ferry-out');
  runtime.interact(true);runtime.interact(false);runtime.closeDialogue(false);
  assert.equal(runtime.snapshot.ferry,undefined);
  runtime.interact(true);runtime.interact(false);runtime.closeDialogue();
  assert.equal(runtime.snapshot.ferry.direction,'outbound');
  assert.equal(runtime.save.safe,'riverView');
  const pauseOwner=Symbol('pause');
  const pauseToken=runtime.lifecycle.acquire(pauseOwner,Symbol('test'));
  step(20);assert.equal(runtime.snapshot.ferry.fraction,0);
  runtime.lifecycle.release(pauseOwner,pauseToken);
  runtime.move(0,1);step(1+FERRY_TRAVEL_MS/20);
  assert.equal(runtime.snapshot.map,'ridge');
  assert.deepEqual(runtime.snapshot.position,{x:FERRY_SAFE.ridgeDock.x,y:FERRY_SAFE.ridgeDock.y});
  assert.ok(validateExplorationSave(runtime.save));
  assert.ok(runtime.startAutoWalk());step(370);
  assert.equal(runtime.snapshot.target.id,'ridge-lookout');
  runtime.interact(true);runtime.interact(false);runtime.closeDialogue();
  const restored=driver(runtime.save);
  assert.equal(restored.runtime.snapshot.safe,'ridgeLookout');
  restored.runtime.trackTask('bookmark');
  assert.ok(restored.runtime.startAutoWalk());restored.step(370);
  assert.equal(restored.runtime.snapshot.target.id,'ferry-back');
  restored.runtime.interact(true);restored.runtime.interact(false);restored.runtime.closeDialogue();
  restored.step(1+FERRY_TRAVEL_MS/20);
  assert.equal(restored.runtime.snapshot.safe,'riverDock');
});
