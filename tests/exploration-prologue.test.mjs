import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {ExplorationRuntime,emptyExplorationSave,validateExplorationSave,migrateExp02ASave,migrateExp02BSave} from '../src/core/exploration.ts';
import {EXP_MAPS,EXP_SAFE,EXP_LEGACY_SAFE,EXP_TARGETS,EXP02A_CONTENT_VERSION,EXP02B_CONTENT_VERSION,EXP_CONTENT_VERSION} from '../src/core/exploration-content.ts';
import {PROLOGUE_TARGETS} from '../src/core/exploration-prologue.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';
import {ExplorationStorage,EXP_STORAGE_KEY,EXP_02B_STORAGE_KEY,EXP_PREVIOUS_STORAGE_KEY} from '../src/platform/web/exploration-storage.ts';

function driver(save){
 const r=new ExplorationRuntime('prologue-test',save);let t=0;r.frame(t);
 const step=(n=1)=>{for(let i=0;i<n;i++)r.frame(t+=20);};
 const axis=(key,value)=>{for(let i=0;i<1500;i++){const d=value-r.snapshot.position[key];if(Math.abs(d)<3){r.move(0,0);return;}r.move(key==='x'?Math.sign(d):0,key==='y'?Math.sign(d):0);step();}assert.fail(`Blocked ${key}=${value}: ${JSON.stringify(r.snapshot.position)}`);};
 const to=(x,y)=>{axis('x',x);axis('y',y);};
 const interact=id=>{assert.equal(r.snapshot.target?.id,id);r.interact(true);r.interact(false);};
 const close=ok=>r.closeDialogue(ok);
 return{r,to,step,interact,close};
}
function front(d,accept=true){
 d.to(1250,790);d.to(1250,650);d.to(3060,650);d.to(3060,900);d.to(3120,900);d.interact('city-to-entry');
 d.to(1100,850);d.to(1100,800);
 if(accept){d.interact('visitor');d.close();}
 d.to(2040,800);d.to(2040,780);d.interact('entry-to-core');
}
function chain(d){
 d.to(880,690);d.to(880,580);d.interact('guide-door');d.to(340,540);d.to(340,325);d.interact('note');d.close();d.to(340,540);d.to(540,540);d.interact('guide-exit');
 d.to(880,650);d.to(2300,650);d.to(2300,580);d.interact('workshop-door');d.to(760,540);d.to(760,430);d.interact('plaque');d.close();d.to(760,540);d.to(540,540);d.interact('workshop-exit');
 d.to(2300,650);d.to(2700,650);d.to(2700,750);d.interact('gate');d.close();d.to(3060,750);d.interact('east-down');
 d.to(2180,650);d.to(2180,680);d.interact('photo-eaves');const wrong=d.r.snapshot.photoPreview.id;assert.equal(d.r.takePhoto(wrong),'incomplete');d.r.closePhotoPreview(false);
 d.to(2180,650);d.to(1100,650);d.to(1100,1120);d.to(1700,1120);d.interact('view');const id=d.r.snapshot.photoPreview.id;assert.equal(d.r.takePhoto(id),'captured');d.r.closePhotoCard();
}
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

test('EXP-02C C01 original five map geometry, original 12 safe identities and old targets remain exact',()=>{
 assert.equal(Object.keys(EXP_MAPS).length,8);assert.equal(Object.keys(EXP_LEGACY_SAFE).length,12);assert.equal(Object.keys(EXP_SAFE).length,19);
 assert.equal(hash(Object.fromEntries(oldMaps.map(k=>[k,EXP_MAPS[k]]))),'fd07f9b70a1812ffd0904c0cc5703a5dfc63996b6d4ec9bd470bf5d5aa90c398');
 assert.equal(hash(EXP_LEGACY_SAFE),'63448e372985889e4bb3334d0baba4b8b02335224edb2a4531f47995cdcdc71e');
 const newIds=new Set(PROLOGUE_TARGETS.map(t=>t.id));assert.equal(hash(EXP_TARGETS.filter(t=>t.id!=='visitor'&&!newIds.has(t.id))),'2eaf847171e84d0d055d4a990d89b960dced854b9b979b2bfa7ceb74aa498f74');
 assert.deepEqual([EXP_MAPS.plaza.width,EXP_MAPS.plaza.height,EXP_MAPS.entry.width,EXP_MAPS.entry.height,EXP_MAPS.service.width,EXP_MAPS.service.height],[3300,1500,2200,1300,1100,650]);
 const d=driver();assert.equal(d.r.snapshot.safe,'chapterStart');assert.equal(d.r.snapshot.map,'plaza');assert.deepEqual(EXP_SAFE.arrival,{map:'upper',x:230,y:690});
});
test('EXP-02C C01 C02 physical monument can be circled, optional service has no progress, portals repeat without held bounce',()=>{
 const d=driver(),p=d.r.snapshot.progress;d.to(470,1000);d.to(740,1000);d.r.move(0,-1);d.step(80);d.r.move(0,0);assert.ok(d.r.snapshot.position.y>=972);
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
 const d=driver({...emptyExplorationSave(),safe:'arrival'});assert.match(d.r.snapshot.objective,/返回沧白路入口/);d.to(175,690);d.interact('core-to-entry');d.to(1140,780);d.to(1140,800);d.interact('visitor');d.close(false);assert.equal(d.r.snapshot.accepted,false);
 d.interact('visitor');assert.equal(d.r.snapshot.accepted,false);d.close();assert.equal(d.r.snapshot.accepted,true);const p=d.r.snapshot.progress;d.interact('visitor');d.close();assert.deepEqual(d.r.snapshot.progress,p);
 d.to(2040,800);d.to(2040,780);d.interact('entry-to-core');d.to(540,690);d.to(540,1150);d.interact('west-down');d.close();assert.equal(d.r.snapshot.map,'upper');assert.equal(d.r.snapshot.unlocked,false);
});
test('EXP-02C C03 empty A goes through B and original rooms, gate, wrong view and explicit photograph exactly once',()=>{
 const d=driver();front(d);chain(d);assert.equal(d.r.snapshot.photographed,true);assert.equal(d.r.snapshot.progress.counts.rewards,1);
 const p=d.r.snapshot.progress;const restored=new ExplorationRuntime('restored',d.r.save);assert.deepEqual(restored.snapshot.progress,p);assert.equal(restored.snapshot.photographed,true);assert.equal(restored.snapshot.cardOpen,false);
});
test('EXP-02C C04 strict B and A migration accept only historical anchors and preserve every legal old B stage',()=>{
 for(const stage of ['empty','open','photo']){const b=legacy(stage),raw=JSON.stringify(b),m=migrateExp02BSave(b);assert.ok(m);assert.equal(m.contentVersion,EXP_CONTENT_VERSION);assert.deepEqual(m.progress,b.progress);assert.deepEqual(m.photo,b.photo);assert.equal(JSON.stringify(b),raw);assert.equal(m.safe,b.safe);}
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
