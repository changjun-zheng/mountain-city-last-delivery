import {C_OLD_SAFE_MAP} from '../src/core/exploration-c-routes.ts';
const mappedSafe=safe=>C_OLD_SAFE_MAP[safe]??safe;
import {runFloorRoute} from './exploration-floor-routes.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {ExplorationRuntime,emptyExplorationSave,validateExplorationSave,migrateExp02ASave,migrateExp02BSave} from '../src/core/exploration.ts';
import {EXP_MAPS,EXP_SAFE,EXP_LEGACY_SAFE,EXP_TARGETS,EXP02A_CONTENT_VERSION,EXP02B_CONTENT_VERSION,EXP_CONTENT_VERSION} from '../src/core/exploration-content.ts';
import {MEMENTO_TARGETS} from '../src/core/exploration-mementos.ts';
import {PROLOGUE_TARGETS} from '../src/core/exploration-prologue.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';
import {ExplorationStorage,EXP_STORAGE_KEY,EXP_02B_STORAGE_KEY,EXP_PREVIOUS_STORAGE_KEY} from '../src/platform/web/exploration-storage.ts';

import {coreDriver as driver} from './exploration-floor-routes.mjs';
function front(d,accept=true){
 d.to(1250,790);d.to(1250,650);d.to(3060,650);d.to(3060,900);d.to(3120,900);d.interact('city-to-entry');
 d.to(1100,850);d.to(1100,800);
 if(accept){d.interact('visitor');d.close();}
 d.to(2040,800);d.to(2040,780);d.interact('entry-to-core');
}
function chain(d){d.use('guide-door');d.use('note');d.close();d.use('guide-down');d.use('guide-exit');d.use('workshop-middle-door');d.use('workshop-up-3');d.use('plaque');d.close();d.use('workshop-down-2');d.use('workshop-middle-exit');d.use('gate');d.close();d.use('middle-east-lower');d.use('photo-eaves');assert.equal(d.r.takePhoto(d.r.snapshot.photoPreview.id),'incomplete');d.r.closePhotoPreview(false);d.use('riverfront-down');d.use('view');assert.equal(d.r.takePhoto(d.r.snapshot.photoPreview.id),'captured');d.r.closePhotoCard();}
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const oldMaps=['upper','lower','guide','workshop','tea'];
function legacy(stage='empty',version='b'){
 const p=new InMemoryRunProgress('exp02b');
 if(stage!=='empty'){p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);p.completeGoal(P.unlocked);}
 if(stage==='photo'){p.completeGoal(P.completed);p.completeGoal(Q.photographed);}
 const s={schemaVersion:1,contentVersion:version==='a'?EXP02A_CONTENT_VERSION:EXP02B_CONTENT_VERSION,safe:stage==='empty'?'arrival':stage==='photo'?'overlook':'eastLower',progress:p.snapshot};
 return version==='a'?s:{...s,observedSites:stage==='photo'?['river']:[],photo:stage==='photo'?{cardId:'card.exp02b.night-for-faraway',siteId:'river'}:null};
}
const port=(entries=[])=>{const data=new Map(entries);return{data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:()=>assert.fail('Must preserve archive keys')};};

test('EXP-02C C01 A/B/D geometry exact, historical 12 safe identities frozen; authorized C reworked',()=>{
 assert.equal(Object.keys(EXP_MAPS).length,15);assert.equal(Object.keys(EXP_SAFE).length,43);assert.equal(Object.keys(EXP_LEGACY_SAFE).length,12);
 assert.equal(hash(Object.fromEntries(['plaza','entry','service','riverfront'].map(k=>[k,EXP_MAPS[k]]))),'8e7f37e060da21e3a8f8ca38013143da9252a31aea8254ad5ec04a0c08993db2');
 assert.equal(hash(EXP_LEGACY_SAFE),'63448e372985889e4bb3334d0baba4b8b02335224edb2a4531f47995cdcdc71e');assert.deepEqual(EXP_SAFE.cArrival,{map:'upper',x:230,y:690});const d=driver(emptyExplorationSave());assert.equal(d.r.snapshot.map,'plaza');assert.equal(d.r.save.safe,'chapterStart');
});
test('EXP-02C C01 C02 physical monument can be circled, optional service has no progress, portals repeat without held bounce',()=>{
 const d=driver(emptyExplorationSave()),p=d.r.snapshot.progress;d.to(470,1000);d.to(740,1000);d.r.move(0,-1);d.step(80);d.r.move(0,0);assert.ok(d.r.snapshot.position.y>=972);
 d.to(900,1000);d.to(900,790);d.to(470,790);d.to(470,1000);d.to(900,1000);d.to(900,790);
 d.to(1250,790);d.to(1250,580);d.interact('service-door');d.to(280,540);d.to(280,330);d.interact('service-guide');d.close();d.to(280,540);d.to(540,540);d.interact('service-exit');assert.equal(d.r.snapshot.safe,'serviceDoor');assert.deepEqual(d.r.snapshot.progress,p);
 d.to(1250,650);d.to(3120,650);d.to(3120,900);d.r.interact(true);d.step(20);assert.equal(d.r.snapshot.map,'entry');d.step(20);assert.equal(d.r.snapshot.map,'entry');d.r.interact(false);
 const id=d.r.id;
 for(let i=0;i<3;i++){
  d.interact('entry-to-city');assert.equal(d.r.snapshot.map,'plaza');d.to(3120,900);d.interact('city-to-entry');d.to(2040,850);d.to(2040,780);d.interact('entry-to-core');
  d.to(175,690);d.interact('core-to-entry');d.to(140,780);d.to(140,850);assert.equal(d.r.id,id);
 }
 d.interact('entry-to-city');assert.deepEqual(d.r.snapshot.progress,p);
});
test('EXP-02C C03 single visitor only in B, cancel does not accept, old unaccepted C can return; no lower bypass',()=>{
 assert.deepEqual(EXP_TARGETS.filter(t=>t.id==='visitor').map(t=>t.map),['entry']);
 const d=driver({...emptyExplorationSave(),safe:'cArrival'});assert.match(d.r.snapshot.objective,/返回沧白路入口/);d.to(175,690);d.interact('core-to-entry');d.to(1140,780);d.to(1140,800);d.interact('visitor');d.close(false);assert.equal(d.r.snapshot.accepted,false);
 d.interact('visitor');assert.equal(d.r.snapshot.accepted,false);d.close();assert.equal(d.r.snapshot.accepted,true);const p=d.r.snapshot.progress;d.interact('visitor');d.close();assert.deepEqual(d.r.snapshot.progress,p);
 d.to(2040,800);d.to(2040,780);d.interact('entry-to-core');d.use('west-down');d.use('middle-west-lower');d.close();assert.equal(d.r.snapshot.map,'middle');assert.equal(d.r.snapshot.unlocked,false);
});
test('EXP-02C C03 empty A goes through B and original rooms, gate, wrong view and explicit photograph exactly once',()=>{
 const d=driver(emptyExplorationSave());front(d);chain(d);assert.equal(d.r.snapshot.photographed,true);assert.equal(d.r.snapshot.progress.counts.rewards,1);
 const p=d.r.snapshot.progress;const restored=new ExplorationRuntime('restored',d.r.save);assert.deepEqual(restored.snapshot.progress,p);assert.equal(restored.snapshot.photographed,true);assert.equal(restored.snapshot.cardOpen,false);
});
test('EXP-02C C04 strict B and A migration accept only historical anchors and preserve every legal old B stage',()=>{
 for(const stage of ['empty','open','photo']){const b=legacy(stage),raw=JSON.stringify(b),m=migrateExp02BSave(b);assert.ok(m);assert.equal(m.contentVersion,EXP_CONTENT_VERSION);assert.deepEqual(m.progress,b.progress);assert.deepEqual(m.photo,b.photo);assert.equal(JSON.stringify(b),raw);assert.equal(m.safe,mappedSafe(b.safe));}
 for(const version of ['a','b'])for(const safe of Object.keys(EXP_SAFE).filter(k=>!Object.hasOwn(EXP_LEGACY_SAFE,k))){const b={...legacy('open',version),safe};assert.equal((version==='a'?migrateExp02ASave:migrateExp02BSave)(b),undefined);}
 const a=migrateExp02ASave(legacy('open','a'));assert.ok(a);assert.equal(a.photo,null);assert.equal(a.progress.counts.rewards,0);
 for(const safe of ['chapterStart','serviceRoom','entryFromCity','entryFromCore']){const s={...emptyExplorationSave(),safe};assert.ok(validateExplorationSave(s));assert.equal(new ExplorationRuntime(safe,s).snapshot.safe,safe);}
});
test('EXP-02C C04 storage current > B > A; corrupt newer blocks fallback, preserves originals, restart remains blank A',()=>{
 const a=JSON.stringify(legacy('open','a')),b=JSON.stringify(legacy('photo'));
 const p=port([[EXP_PREVIOUS_STORAGE_KEY,a],[EXP_02B_STORAGE_KEY,b],['other','keep']]);let storage=new ExplorationStorage(p);const imported=storage.load();assert.equal(imported.photo.siteId,'river');storage.save(imported);assert.equal(new ExplorationStorage(p).load().progress.counts.rewards,1);
 for(const [key,raw] of [[EXP_STORAGE_KEY,'{bad'],[EXP_STORAGE_KEY,JSON.stringify({...imported,contentVersion:'future'})],[EXP_02B_STORAGE_KEY,'{bad'],[EXP_02B_STORAGE_KEY,JSON.stringify({...legacy(),safe:'entryFromCity'})]]){
  const q=port([[EXP_PREVIOUS_STORAGE_KEY,a],[EXP_02B_STORAGE_KEY,b],[key,raw]]),s=new ExplorationStorage(q);assert.equal(s.load(),undefined);s.save(emptyExplorationSave());assert.equal(q.getItem(key),raw);assert.match(s.status,/未保存/);if(key!==EXP_STORAGE_KEY)assert.equal(q.getItem(EXP_STORAGE_KEY),null);
 }
 assert.equal(storage.restart(),true);for(let i=0;i<3;i++){const fresh=new ExplorationStorage(p).load();assert.equal(fresh.safe,'chapterStart');assert.equal(fresh.progress.counts.goals,0);assert.equal(fresh.photo,null);}
 assert.equal(p.getItem(EXP_02B_STORAGE_KEY),b);assert.equal(p.getItem(EXP_PREVIOUS_STORAGE_KEY),a);assert.equal(p.getItem('other'),'keep');
 const denied=new ExplorationStorage({...p,setItem:()=>{throw new Error('quota');}});denied.load();denied.save(emptyExplorationSave());assert.match(denied.status,/未保存/);assert.equal(denied.restart(),false);
});
