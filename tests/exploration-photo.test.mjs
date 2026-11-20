import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ExplorationRuntime,validateExplorationSave,migrateExp02ASave,emptyExplorationSave} from '../src/core/exploration.ts';
import {EXP02A_CONTENT_VERSION,EXP_SAFE,segmentHitsRect,EXP_MAPS} from '../src/core/exploration-content.ts';
import {PHOTO_METADATA,PHOTO_SITES,missingPhotoElements} from '../src/core/exploration-photo.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';
import {ExplorationStorage,EXP_STORAGE_KEY,EXP_PREVIOUS_STORAGE_KEY,EXP_LEGACY_STORAGE_KEY} from '../src/platform/web/exploration-storage.ts';
import {explorationPhotoSvg} from '../src/rendering/phaser/exploration-photo-art.ts';

function oldSave(stage='open',safe='eastLower'){
  const p=new InMemoryRunProgress('exp02a');
  if(stage!=='empty')p.completeGoal(P.accepted);
  if(['clue','item','open','found'].includes(stage))p.completeGoal(P.clue);
  if(['item','open','found'].includes(stage))p.recordCollection(P.item);
  if(['open','found'].includes(stage))p.completeGoal(P.unlocked);
  if(stage==='found')p.completeGoal(P.completed);
  return {schemaVersion:1,contentVersion:EXP02A_CONTENT_VERSION,safe,progress:p.snapshot};
}
function driver(save=migrateExp02ASave(oldSave())){
  const r=new ExplorationRuntime('photo-test',save);let time=0;r.frame(time);
  const to=(x,y)=>{for(let i=0;i<3000;i++){const p=r.snapshot.position,dx=x-p.x,dy=y-p.y;if(Math.hypot(dx,dy)<4){r.move(0,0);return;}r.move(Math.abs(dx)<2?0:Math.sign(dx),Math.abs(dy)<2?0:Math.sign(dy));r.frame(time+=20);}assert.fail('Unreachable '+JSON.stringify({x,y,actual:r.snapshot.position}));};
  const interact=id=>{assert.equal(r.snapshot.target?.id,id);r.interact(true);r.interact(false);};
  const view=(site)=>{interact(PHOTO_SITES[site].targetId);assert.equal(r.snapshot.photoPreview.siteId,site);return r.snapshot.photoPreview.id;};
  if(save.safe==='overlook'){interact('riverfront-down');to(900,650);to(900,1050);}
  return {r,to,interact,view};
}
const port=(data=new Map())=>({data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)});

test('EXP-02B P01 visible compositions differ, known records only; observation order does not gate valid capture',()=>{
  assert.deepEqual(missingPhotoElements('eaves'),['bridge']);assert.deepEqual(missingPhotoElements('window'),['timber']);assert.deepEqual(missingPhotoElements('river'),[]);
  const pictures=['eaves','window','river'].map(explorationPhotoSvg);assert.equal(new Set(pictures).size,3);assert.ok(pictures.every(s=>!s.includes('http:')||s.includes('xmlns="http://www.w3.org/2000/svg"')));
  const d=driver();assert.equal(d.r.snapshot.observations.length,0);d.to(2180,650);d.to(2180,680);d.view('eaves');assert.deepEqual(d.r.snapshot.observations.map(o=>o.id),['eaves']);d.r.closePhotoPreview(false);
  d.to(2180,650);d.to(900,650);d.view('window');d.r.closePhotoPreview(false);assert.deepEqual(d.r.snapshot.observations.map(o=>o.id),['eaves','window']);assert.equal(d.r.snapshot.photographed,false);
  const direct=driver(migrateExp02ASave(oldSave('open','overlook')));direct.to(1950,1050);const id=direct.view('river');assert.equal(direct.r.takePhoto(id),'captured');assert.deepEqual(direct.r.snapshot.observations.map(o=>o.id),['river']);
});
test('EXP-02B P02 core rejects absent, stale, foreign, wrong map/position and extra pause owners without rewards',()=>{
  const fresh=new ExplorationRuntime('fresh');assert.equal(fresh.takePhoto('anything'),'rejected');assert.equal(fresh.snapshot.progress.counts.rewards,0);
  const d=driver(migrateExp02ASave(oldSave('open','overlook')));assert.equal(d.r.takePhoto('not-open'),'rejected');d.to(1950,1050);let id=d.view('river');
  assert.equal(d.r.takePhoto('foreign-runtime:view:1'),'rejected');
  const owner=Symbol('menu-or-hidden'),token=d.r.lifecycle.acquire(owner,Symbol());const before=d.r.snapshot.progress;assert.equal(d.r.takePhoto(id),'rejected');assert.deepEqual(d.r.snapshot.progress,before);d.r.lifecycle.release(owner,token);
  d.r.closePhotoPreview(false);assert.equal(d.r.takePhoto(id),'rejected');assert.equal(d.r.snapshot.photographed,false);
  d.to(2030,1050);assert.equal(d.r.snapshot.target,undefined);assert.equal(d.r.takePhoto(id),'rejected');
  d.to(1950,1050);const newId=d.view('river');assert.notEqual(newId,id);assert.equal(d.r.takePhoto(id),'rejected');d.r.closePhotoPreview(false);
  const noQuest=new ExplorationRuntime('no-quest',emptyExplorationSave());assert.equal(noQuest.takePhoto(newId),'rejected');assert.equal(noQuest.snapshot.progress.counts.rewards,0);
  const behind=driver(migrateExp02ASave(oldSave('open','workshopRoom')));behind.to(680,540);behind.to(680,415);assert.equal(behind.r.snapshot.target,undefined);assert.equal(behind.r.takePhoto(newId),'rejected');assert.ok(segmentHitsRect({x:680,y:415},{x:760,y:415},EXP_MAPS.workshop.walls[3]));
  d.r.dispose();assert.equal(d.r.takePhoto(newId),'rejected');
});
test('EXP-02B P02 wrong composition preserves item and formal progress; opening/cancel and held E never photograph',()=>{
  const d=driver();d.to(2180,650);d.to(2180,680);const id=d.view('eaves'),before=d.r.snapshot.progress;
  for(let i=0;i<5;i++)d.r.interact(true);assert.equal(d.r.snapshot.photographed,false);assert.equal(d.r.takePhoto(id),'incomplete');assert.match(d.r.snapshot.photoPreview.feedback,/桥面/);assert.deepEqual(d.r.snapshot.progress,before);assert.equal(d.r.snapshot.item,true);assert.equal(d.r.snapshot.progress.counts.rewards,0);d.r.closePhotoPreview(false);assert.equal(d.r.takePhoto(id),'rejected');
  const river=driver(migrateExp02ASave(oldSave('open','overlook')));river.to(1950,1050);river.view('river');river.r.closePhotoPreview();assert.equal(river.r.snapshot.completed,true);assert.equal(river.r.snapshot.photographed,false);assert.equal(river.r.save.photo,null);
});
test('EXP-02B P03 explicit capture grants one independent goal/reward, immutable metadata and reconstructable card',()=>{
  const d=driver(migrateExp02ASave(oldSave('found','overlook')));d.to(1950,1050);assert.equal(d.r.snapshot.completed,true);assert.equal(d.r.snapshot.photographed,false);let id=d.view('river');assert.equal(d.r.takePhoto(id),'captured');assert.equal(d.r.snapshot.cardOpen,true);assert.equal(d.r.snapshot.pauseCount,1);assert.equal(d.r.snapshot.progress.counts.rewards,1);assert.equal(d.r.takePhoto(id),'rejected');
  const progress=d.r.snapshot.progress;d.r.closePhotoCard();assert.equal(d.r.openPhotoCard(),true);d.r.closePhotoCard();assert.deepEqual(d.r.snapshot.progress,progress);
  const save=d.r.save;assert.deepEqual(save.photo,PHOTO_METADATA);assert.ok(JSON.stringify(save).length<2000);assert.ok(!JSON.stringify(save).match(/base64|canvas|preview|token|velocity/i));
  const restored=new ExplorationRuntime('new-photo-runtime',save);assert.equal(restored.snapshot.photographed,true);assert.equal(restored.snapshot.cardOpen,false);assert.equal(restored.openPhotoCard(),true);restored.closePhotoCard();assert.deepEqual(restored.snapshot.progress,progress);
  const again=driver(save);again.to(1950,1050);id=again.view('river');assert.equal(again.r.takePhoto(id),'existing');assert.deepEqual(again.r.snapshot.progress,progress);
  for(const catalog of ['legacy','exp01','exp02a'])assert.equal(new InMemoryRunProgress(catalog).completeGoal(Q.photographed).status,'rejected');
});
test('EXP-02B P04 exactly supported legacy stages import atomically without photographic completion or source mutation',()=>{
  for(const [stage,safe] of [['empty','arrival'],['accepted','arrival'],['clue','guideRoom'],['item','workshopRoom'],['open','eastLower'],['found','overlook']]){
    const original=oldSave(stage,safe),raw=JSON.stringify(original),p=port(new Map([[EXP_PREVIOUS_STORAGE_KEY,raw],[EXP_LEGACY_STORAGE_KEY,'old courtyard'],['unrelated','keep']])),storage=new ExplorationStorage(p),save=storage.load();assert.ok(save);assert.deepEqual(save.progress,original.progress);assert.equal(save.safe,safe);assert.equal(save.photo,null);assert.deepEqual(save.observedSites,[]);assert.match(storage.notice,/已沿用街区进度/);
    storage.save(save);assert.equal(p.getItem(EXP_PREVIOUS_STORAGE_KEY),raw);const r=new ExplorationRuntime('migrated-'+stage,new ExplorationStorage(p).load());assert.equal(r.snapshot.photographed,false);assert.equal(r.snapshot.progress.counts.rewards,0);assert.equal(r.snapshot.safe,safe);
  }
  const invalids=[{...oldSave(),contentVersion:'future'}, {...oldSave('empty','arrival'),safe:'eastLower'}, {...oldSave(),progress:{...oldSave().progress,rewards:['invented']}}];
  for(const invalid of invalids){assert.equal(migrateExp02ASave(invalid),undefined);const raw=JSON.stringify(invalid),p=port(new Map([[EXP_PREVIOUS_STORAGE_KEY,raw]])),s=new ExplorationStorage(p);assert.equal(s.load(),undefined);s.save(emptyExplorationSave());assert.equal(p.getItem(EXP_STORAGE_KEY),null);assert.equal(p.getItem(EXP_PREVIOUS_STORAGE_KEY),raw);}
});
test('EXP-02B P04 bad new record never falls back; explicit restart writes blank tombstone and cannot reimport old progress',()=>{
  const legacyRaw=JSON.stringify(oldSave('found','overlook')),p=port(new Map([[EXP_PREVIOUS_STORAGE_KEY,legacyRaw],[EXP_STORAGE_KEY,'{bad'],['other','keep']]));
  const s=new ExplorationStorage(p);assert.equal(s.load(),undefined);s.save(emptyExplorationSave());assert.equal(p.getItem(EXP_STORAGE_KEY),'{bad');assert.equal(s.restart(),true);
  for(let i=0;i<3;i++){const fresh=new ExplorationStorage(p).load();assert.ok(fresh);assert.equal(fresh.progress.counts.goals,0);assert.equal(fresh.photo,null);assert.equal(fresh.safe,'chapterStart');}
  assert.equal(p.getItem(EXP_PREVIOUS_STORAGE_KEY),legacyRaw);assert.equal(p.getItem('other'),'keep');
  const denied={...p,setItem:()=>{throw new Error('quota');}},storage=new ExplorationStorage(denied);storage.load();storage.save(emptyExplorationSave());assert.match(storage.status,/本次未保存/);assert.equal(storage.restart(),false);
});
test('EXP-02B P04 saved photo and investigated metadata must agree with the closed progress directory',()=>{
  const empty=emptyExplorationSave();
  for(const bad of [{...empty,photo:PHOTO_METADATA},{...empty,observedSites:['river']},{...empty,observedSites:['unknown']},{...empty,observedSites:['window','window']},{...empty,photo:{...PHOTO_METADATA,base64:'x'}},{...empty,contentVersion:'future'}])assert.equal(validateExplorationSave(bad),undefined);
  const d=driver(migrateExp02ASave(oldSave('open','overlook')));d.to(1950,1050);d.r.takePhoto(d.view('river'));const valid=d.r.save;
  for(const bad of [{...valid,photo:null},{...valid,photo:{...PHOTO_METADATA,siteId:'eaves'}},{...valid,observedSites:[]},{...valid,progress:{...valid.progress,rewards:[],counts:{...valid.progress.counts,rewards:0}}}])assert.equal(validateExplorationSave(bad),undefined);
});
