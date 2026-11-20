import assert from 'node:assert/strict';
import{test}from'node:test';
import{createHash}from'node:crypto';
import{readFileSync}from'node:fs';
import{ExplorationRuntime,emptyExplorationSave,validateExplorationSave,migrateExp02ASave,migrateExp02BSave,migrateExp02CSave}from'../src/core/exploration.ts';
import{EXP_MAPS,EXP_SAFE,EXP_TARGETS,EXP02A_CONTENT_VERSION,EXP02B_CONTENT_VERSION,EXP02C_CONTENT_VERSION,EXP_CONTENT_VERSION}from'../src/core/exploration-content.ts';
import{MEMENTOS,MEMENTO_COLLECTION_IDS,MEMENTO_COMPLETION as M}from'../src/core/exploration-mementos.ts';
import{InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q}from'../src/core/progress.ts';
import{ExplorationStorage,EXP_STORAGE_KEY,EXP_02C_STORAGE_KEY,EXP_02B_STORAGE_KEY,EXP_PREVIOUS_STORAGE_KEY}from'../src/platform/web/exploration-storage.ts';
import{projectExplorationJournal}from'../src/platform/web/exploration-journal.ts';

function old(stage='empty',version='c',safe=stage==='empty'?'arrival':'overlook'){
 const p=new InMemoryRunProgress('exp02b');if(stage!=='empty'){p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);p.completeGoal(P.unlocked);}
 if(stage==='photo'){p.completeGoal(P.completed);p.completeGoal(Q.photographed);}
 const value={schemaVersion:1,contentVersion:version==='c'?EXP02C_CONTENT_VERSION:version==='b'?EXP02B_CONTENT_VERSION:EXP02A_CONTENT_VERSION,safe,progress:p.snapshot};
 return version==='a'?value:{...value,observedSites:stage==='photo'?['river']:[],photo:stage==='photo'?{cardId:'card.exp02b.night-for-faraway',siteId:'river'}:null};
}
function driver(save={...emptyExplorationSave(),safe:'guideRoom'}){
 const r=new ExplorationRuntime('memento-test',save);let time=0;r.frame(time);
 const step=(n=1)=>{for(let i=0;i<n;i++)r.frame(time+=20);};
 const axis=(key,v)=>{for(let i=0;i<2000;i++){const delta=v-r.snapshot.position[key];if(Math.abs(delta)<3){r.move(0,0);return;}r.move(key==='x'?Math.sign(delta):0,key==='y'?Math.sign(delta):0);step();}assert.fail('Blocked '+JSON.stringify({key,v,at:r.snapshot.position}));};
 const to=(x,y)=>{axis('x',x);axis('y',y);};
 const interact=id=>{assert.equal(r.snapshot.target?.id,id);r.interact(true);r.interact(false);};
 const collect=()=>r.closeDialogue(true,r.snapshot.mementoInspectionId);
 return{r,to,interact,collect,step};
}
function approach(d,id){if(id==='bookmark'){d.to(780,540);d.to(780,470);}else if(id==='sketch'){d.to(300,540);d.to(300,520);}else{d.to(470,1030);d.to(470,900);}}
function collecting(save,id){const safe=id==='bookmark'?'guideRoom':id==='sketch'?'teaRoom':'westLower',d=driver({...save,safe});approach(d,id);return d;}
function port(entries=[]){const data=new Map(entries);return{data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:()=>assert.fail('Do not remove archives')};}
function fullCollectionSave(photo=false){const p=new InMemoryRunProgress('exp03b');if(photo){p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);p.completeGoal(P.unlocked);p.completeGoal(P.completed);p.completeGoal(Q.photographed);}for(const id of MEMENTO_COLLECTION_IDS)p.recordCollection(id);p.completeGoal(M.goal);return{...emptyExplorationSave(),safe:photo?'overlook':'guideRoom',progress:p.snapshot,observedSites:photo?['river']:[],photo:photo?{cardId:'card.exp02b.night-for-faraway',siteId:'river'}:null};}

test('EXP-03B M01 closed new directory extends old content without changing any old whitelist',()=>{
 for(const version of ['legacy','exp01','exp02a','exp02b']){const p=new InMemoryRunProgress(version),before=p.snapshot;for(const id of MEMENTO_COLLECTION_IDS)assert.equal(p.recordCollection(id).status,'rejected');assert.equal(p.completeGoal(M.goal).status,'rejected');assert.equal(p.claimReward(M.reward,M.goal).status,'rejected');assert.deepEqual(p.snapshot,before);}
 const p=new InMemoryRunProgress('exp03b');for(const id of MEMENTO_COLLECTION_IDS)assert.equal(p.recordCollection(id).status,'added');assert.equal(p.completeGoal(M.goal).status,'added');assert.equal(p.snapshot.counts.rewards,1);assert.equal(p.verifyGoal(P.unlocked),false);assert.equal(p.verifyGoal(Q.photographed),false);
});
test('EXP-03B M01 every actual target approach opens without granting; normal identity-bound completion grants once',()=>{
 for(const m of MEMENTOS){const save=m.id==='postcard'?migrateExp02CSave(old('open')):emptyExplorationSave(),d=collecting(save,m.id),before=d.r.snapshot.progress;assert.equal(d.r.snapshot.mementos.length,0);d.interact(m.targetId);assert.deepEqual(d.r.snapshot.progress,before);assert.equal(d.r.snapshot.inspectingMemento,m.id);d.r.closeDialogue(false);assert.deepEqual(d.r.snapshot.progress,before);d.interact(m.targetId);d.collect();assert.deepEqual(d.r.snapshot.mementos.map(x=>x.id),[m.id]);const done=d.r.save;assert.ok(validateExplorationSave(done));d.r.closeDialogue(true,'stale');assert.deepEqual(d.r.save,done);d.interact(m.targetId);assert.equal(d.r.snapshot.pending,undefined);d.collect();assert.deepEqual(d.r.save,done);}
});
test('EXP-03B M01 foreign/stale completion, extra pause owner and interrupted held interaction cannot grant',()=>{
 const d=driver();approach(d,'bookmark');d.interact('memento-bookmark');const first=d.r.snapshot.mementoInspectionId;d.r.closeDialogue(true,'foreign');assert.equal(d.r.snapshot.mementos.length,0);assert.ok(d.r.snapshot.dialogue);
 const owner=Symbol('menu-hidden'),token=d.r.lifecycle.acquire(owner,Symbol());d.r.closeDialogue(true,first);assert.equal(d.r.snapshot.mementos.length,0);d.r.closeDialogue(false);d.r.lifecycle.release(owner,token);d.interact('memento-bookmark');assert.notEqual(d.r.snapshot.mementoInspectionId,first);d.r.closeDialogue(true,first);assert.equal(d.r.snapshot.mementos.length,0);d.collect();assert.equal(d.r.snapshot.mementos.length,1);d.r.dispose();d.r.closeDialogue(true,first);assert.equal(d.r.snapshot.mementos.length,1);
});
test('EXP-03B M02 any collection order persists 0/1/2/3 stages and commits one title atomically, with photo independent',()=>{
 for(const order of [['bookmark','sketch','postcard'],['postcard','bookmark','sketch'],['sketch','postcard','bookmark']]){
  let save=migrateExp02CSave(old('open'));for(let index=0;index<order.length;index++){const d=collecting(save,order[index]);d.interact('memento-'+order[index]);d.collect();save=d.r.save;assert.ok(validateExplorationSave(save));assert.equal(d.r.snapshot.mementos.length,index+1);assert.equal(d.r.snapshot.progress.counts.rewards,index===2?1:0);assert.equal(d.r.snapshot.mementoTitle,index===2?M.title:undefined);assert.equal(d.r.snapshot.photographed,false);const r=new ExplorationRuntime('new-stage',save);assert.equal(r.snapshot.mementos.length,index+1);assert.deepEqual(r.save,save);}
 }
 for(const photo of [false,true]){const save=fullCollectionSave(photo);assert.ok(validateExplorationSave(save));const r=new ExplorationRuntime('both',save);assert.equal(r.snapshot.progress.counts.rewards,photo?2:1);assert.equal(r.snapshot.photographed,photo);assert.equal(r.snapshot.accepted,photo);assert.equal(r.snapshot.unlocked,photo);}
});
test('EXP-03B M02 notebook exposes only owned paper designs and never counts the main clasp',()=>{
 const s=new ExplorationRuntime('empty').snapshot,m=projectExplorationJournal(s);assert.deepEqual(m.mementos,[]);assert.equal(m.mementoTitle,undefined);for(const paper of MEMENTOS)assert.equal(JSON.stringify(m).includes(paper.name),false);
 const clasp=new InMemoryRunProgress('exp03b');clasp.recordCollection(P.item);const r=new ExplorationRuntime('clasp',{...emptyExplorationSave(),progress:clasp.snapshot});assert.deepEqual(projectExplorationJournal(r.snapshot).mementos,[]);
 const one=driver();approach(one,'bookmark');one.interact('memento-bookmark');one.collect();const model=projectExplorationJournal(one.r.snapshot);assert.deepEqual(model.mementos.map(x=>x.id),['bookmark']);assert.equal(model.mementoTitle,undefined);assert.equal(JSON.stringify(model).includes('竹椅茶歇速写'),false);
});
test('EXP-03B M03 C/B/A strict migrations preserve old states and never admit new IDs into historical profiles',()=>{
 for(const version of ['c','b','a'])for(const stage of ['empty','open',...(version==='a'?[]:['photo'])]){
  const value=old(stage,version),raw=JSON.stringify(value),convert=version==='c'?migrateExp02CSave:version==='b'?migrateExp02BSave:migrateExp02ASave,m=convert(value);assert.ok(m);assert.deepEqual(m.progress,value.progress);assert.equal(m.safe,value.safe);assert.equal(JSON.stringify(value),raw);assert.equal(m.progress.collections.some(id=>MEMENTO_COLLECTION_IDS.includes(id)),false);assert.equal(m.progress.goals.includes(M.goal),false);assert.equal(new ExplorationRuntime('migrated',m).snapshot.mementos.length,0);
  for(const id of MEMENTO_COLLECTION_IDS){const invalid=structuredClone(value);invalid.progress.collections.push(id);invalid.progress.counts.collections++;assert.equal(convert(invalid),undefined);}
 }
 for(const safe of Object.keys(EXP_SAFE)){const c=migrateExp02CSave({...old('open'),safe});assert.ok(c,safe);}
 for(const version of ['a','b'])for(const safe of ['chapterStart','serviceRoom','entryFromCore','coreFromEntry'])assert.equal((version==='a'?migrateExp02ASave:migrateExp02BSave)({...old('open',version),safe}),undefined);
});
test('EXP-03B M03 corrupt sets/rewards/title/counts/unknown IDs reject whole record without any partial restore',()=>{
 const full=fullCollectionSave(true),clone=()=>structuredClone(full),bad=[];
 let v=clone();v.progress.collections.push(MEMENTO_COLLECTION_IDS[0]);v.progress.counts.collections++;bad.push(v);
 v=clone();v.progress.collections[1]='collection.unknown';bad.push(v);
 v=clone();v.progress.collections=v.progress.collections.filter(id=>id!==MEMENTO_COLLECTION_IDS[0]);v.progress.counts.collections--;bad.push(v);
 v=clone();v.progress.goals=v.progress.goals.filter(id=>id!==M.goal);v.progress.rewards=v.progress.rewards.filter(id=>id!==M.reward);v.progress.counts.goals--;v.progress.counts.rewards--;bad.push(v);
 v=clone();v.progress.counts.collections=999;bad.push(v);
 v=clone();v.progress.rewards.push('reward.unknown');v.progress.counts.rewards++;bad.push(v);
 bad.push({...full,contentVersion:'future'}, {...full,ui:{title:true}});
 const empty=emptyExplorationSave(),p=new InMemoryRunProgress('exp03b');p.completeGoal(M.goal);bad.push({...empty,progress:p.snapshot});
 for(const value of bad){const raw=JSON.stringify(value),s=new ExplorationStorage(port([[EXP_STORAGE_KEY,raw],[EXP_02C_STORAGE_KEY,JSON.stringify(old('photo'))]]));assert.equal(validateExplorationSave(value),undefined);assert.throws(()=>new ExplorationRuntime('invalid',value));assert.equal(s.load(),undefined);s.save(empty);assert.equal(s.port.getItem(EXP_STORAGE_KEY),raw);}
});
test('EXP-03B M03 priority new > C > B > A, blocking fallback, original bytes and new-game tombstone',()=>{
 const c=JSON.stringify(old('photo')),b=JSON.stringify(old('open','b')),a=JSON.stringify(old('open','a')),entries=[[EXP_02C_STORAGE_KEY,c],[EXP_02B_STORAGE_KEY,b],[EXP_PREVIOUS_STORAGE_KEY,a],['other','keep']];
 const p=port(entries),s=new ExplorationStorage(p);const migrated=s.load();assert.equal(migrated.photo.siteId,'river');s.save(migrated);assert.equal(new ExplorationStorage(p).load().progress.counts.rewards,1);
 for(const key of [EXP_STORAGE_KEY,EXP_02C_STORAGE_KEY,EXP_02B_STORAGE_KEY]){const q=port(entries.filter(([k])=>key===EXP_STORAGE_KEY||key===EXP_02C_STORAGE_KEY?k!==EXP_STORAGE_KEY:k!==EXP_02C_STORAGE_KEY));q.setItem(key,'{bad');const block=new ExplorationStorage(q);assert.equal(block.load(),undefined);block.save(emptyExplorationSave());assert.equal(q.getItem(key),'{bad');if(key!==EXP_STORAGE_KEY)assert.equal(q.getItem(EXP_STORAGE_KEY),null);}
 assert.equal(s.restart(),true);for(let i=0;i<3;i++){const fresh=new ExplorationStorage(p).load();assert.equal(fresh.safe,'chapterStart');assert.equal(fresh.progress.counts.collections,0);assert.equal(fresh.progress.counts.rewards,0);assert.equal(fresh.photo,null);}for(const[k,v]of entries)assert.equal(p.getItem(k),v);
 const denied=new ExplorationStorage({...p,setItem:()=>{throw new Error('Quota');}});denied.load();denied.save(emptyExplorationSave());assert.match(denied.status,/未保存/);assert.equal(denied.restart(),false);
});
test('EXP-03B M04 M05 editable drawings differ and old eight maps, nineteen anchors and all old targets remain exact',()=>{
 const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');assert.equal(hash(EXP_MAPS),'b7ade9f5c2dde243798c3e1a0e19b6083eb764d3c2d5bedbba13361864768a81');assert.equal(hash(EXP_SAFE),'2e4f609b2fc34605b40e627ac378b648b0487c199b8056bb0ed067b6f4ab89e9');assert.equal(hash(EXP_TARGETS.filter(t=>!t.id.startsWith('memento-'))),'9741d6d6c7040a2f93b3d154a2c4c7e4f0aed47121c07fdbe68254e57a73a574');
 const hashes=MEMENTOS.map(m=>createHash('sha256').update(readFileSync(new URL('../src/rendering/phaser/assets/exp-03b/'+m.id+'.svg',import.meta.url))).digest('hex'));assert.equal(new Set(hashes).size,3);assert.equal(Object.keys(EXP_MAPS).length,8);assert.equal(Object.keys(EXP_SAFE).length,19);assert.equal(EXP_TARGETS.filter(t=>!t.id.startsWith('memento-')).length,30);assert.equal(EXP_TARGETS.length,33);assert.equal(EXP_CONTENT_VERSION,'exp03b-city-mementos-1');
});
