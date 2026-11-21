import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {ExplorationRuntime,emptyExplorationSave,validateExplorationSave,migrateExp05BSave,migrateExp05ASave,migrateExp03BSave,migrateExp02CSave,migrateExp02BSave,migrateExp02ASave} from '../src/core/exploration.ts';
import {EXP_MAPS,EXP_SAFE,EXP_TARGETS,EXP05B_SAFE,EXP05A_SAFE,EXP_PRE05_SAFE,EXP_LEGACY_SAFE,EXP05B_CONTENT_VERSION,EXP05A_CONTENT_VERSION,EXP03B_CONTENT_VERSION,EXP02C_CONTENT_VERSION,EXP02B_CONTENT_VERSION,EXP02A_CONTENT_VERSION,explorationWalls,segmentHitsRect} from '../src/core/exploration-content.ts';
import {C_OLD_SAFE_MAP} from '../src/core/exploration-c-routes.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';
import {MEMENTO_COLLECTION_IDS,MEMENTO_COMPLETION as M} from '../src/core/exploration-mementos.ts';
import {PHOTO_SITES,PHOTO_METADATA} from '../src/core/exploration-photo.ts';
import {ExplorationStorage,EXP_STORAGE_KEY,EXP_05B_STORAGE_KEY} from '../src/platform/web/exploration-storage.ts';
import {coreDriver} from './exploration-floor-routes.mjs';
export function stage(safe='cArrival',which='open',all=false){const p=new InMemoryRunProgress('exp03b');if(which!=='empty'){p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);p.completeGoal(P.unlocked);}if(which==='photo'){p.completeGoal(P.completed);p.completeGoal(Q.photographed);}if(all){for(const id of MEMENTO_COLLECTION_IDS)p.recordCollection(id);p.completeGoal(M.goal);}return {...emptyExplorationSave(),safe,progress:p.snapshot,observedSites:which==='photo'?['river']:[],photo:which==='photo'?PHOTO_METADATA:null};}
const mapped=safe=>C_OLD_SAFE_MAP[safe]??safe;
const port=entries=>{const values=new Map(entries);return{values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:()=>assert.fail('archive removal')};};

test('C01 every current safe clears foot; each portal walks, goes and returns to its own side without held bounce',()=>{
 assert.equal(Object.keys(EXP_MAPS).length,15);assert.equal(Object.keys(EXP05B_SAFE).length,31);
 assert.equal(new Set(EXP_TARGETS.map(t=>t.id)).size,EXP_TARGETS.length);
 for(const [safe,p] of Object.entries(EXP_SAFE)){const d=coreDriver(stage(safe));assert.deepEqual(d.r.snapshot.position,{x:p.x,y:p.y});d.to(p.x+20,p.y);d.to(p.x,p.y);}
 for(const t of EXP_TARGETS.filter(t=>t.destination)){
  const source=Object.keys(EXP_SAFE).find(k=>EXP_SAFE[k].map===t.map);assert.ok(source,t.id);
  const d=coreDriver(stage(source));d.target(t.id);d.r.interact(true);assert.equal(d.r.save.safe,t.destination);const landed=d.r.snapshot;d.step(5);assert.equal(d.r.snapshot.map,landed.map);d.r.interact(false);
  const back=EXP_TARGETS.filter(b=>b.map===landed.map&&b.destination&&EXP_SAFE[b.destination].map===t.map).sort((a,b)=>Math.hypot(a.x-landed.position.x,a.y-landed.position.y)-Math.hypot(b.x-landed.position.x,b.y-landed.position.y))[0];
  assert.ok(back,'missing paired back '+t.id);if(t.id!=='core-to-entry')assert.ok(Math.hypot(back.x-landed.position.x,back.y-landed.position.y)<=64,'new paired landing '+t.id);d.use(back.id);assert.equal(d.r.snapshot.map,t.map);assert.equal(d.r.id,'walking-test');
 }
});
test('C01 C02 early exterior and two building routes cross H3/H2; all outgoing H1/D edges deny before original gate',()=>{
 const routes=[['cUpperWest',['west-down','middle-west-upper']],['cGuideH3',['guide-door','guide-down','guide-exit','guide-middle-door','guide-up','guide-upper-exit']],['cWoodH3',['workshop-upper-door','workshop-down-2','workshop-middle-exit','workshop-middle-door','workshop-up-3','workshop-upper-exit']]];
 for(const [safe,ids] of routes){const d=coreDriver({...emptyExplorationSave(),safe});for(const id of ids)d.use(id);assert.equal(d.r.snapshot.accepted,false);assert.equal(d.r.snapshot.unlocked,false);}
 const market=coreDriver({...emptyExplorationSave(),safe:'cMarketWest'});for(const id of ['market-west-door','market-east-exit'])market.use(id);assert.equal(market.r.save.safe,'cMarketEast');assert.notDeepEqual(EXP_SAFE.cMarketWest,EXP_SAFE.cMarketEast);market.use('market-east-door');market.use('market-west-exit');
 const early=Object.keys(EXP_SAFE).filter(k=>!['lower','tea','lantern','riverfront'].includes(EXP_SAFE[k].map));
 for(const safe of early)assert.ok(validateExplorationSave({...emptyExplorationSave(),safe}),safe);
 for(const t of EXP_TARGETS.filter(t=>t.destination&&['lower','tea','lantern','riverfront'].includes(EXP_SAFE[t.destination].map))){assert.equal(t.locked,true,t.id);if(!['lower','tea','lantern','riverfront'].includes(t.map)){const safe=early.find(k=>EXP_SAFE[k].map===t.map),d=coreDriver({...emptyExplorationSave(),safe});d.use(t.id);assert.equal(d.r.snapshot.map,t.map);assert.equal(d.r.snapshot.unlocked,false);d.r.closeDialogue(false);}}
 // Actual movement at both exterior openings meets the same closed barrier.
 for(const x of [250,2000]){const d=coreDriver({...emptyExplorationSave(),safe:x===250?'cMiddleDownWest':'cMiddleDownEast'});d.r.move(0,1);d.step(100);assert.ok(d.r.snapshot.position.y<=1068);}
});
test('C02 unique middle gate is reachable while closed; each missing condition, cancellation and repeat preserves semantics',()=>{
 assert.deepEqual(EXP_TARGETS.filter(t=>t.id==='gate').map(t=>t.map),['middle']);
 for(const missing of [P.accepted,P.clue,P.item]){const p=new InMemoryRunProgress('exp03b');for(const id of [P.accepted,P.clue])if(id!==missing)p.completeGoal(id);if(missing!==P.item)p.recordCollection(P.item);const d=coreDriver({...emptyExplorationSave(),safe:'cGuideH2',progress:p.snapshot});d.use('gate');d.r.closeDialogue();assert.equal(d.r.snapshot.unlocked,false);}
 const p=new InMemoryRunProgress('exp03b');p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);const d=coreDriver({...emptyExplorationSave(),safe:'cGuideH2',progress:p.snapshot});d.use('gate');d.r.closeDialogue(false);assert.equal(d.r.snapshot.unlocked,false);d.use('gate');d.r.closeDialogue();assert.equal(d.r.snapshot.unlocked,true);const done=d.r.snapshot.progress;d.use('gate');d.r.closeDialogue();assert.deepEqual(d.r.snapshot.progress,done);d.use('middle-east-lower');assert.equal(d.r.snapshot.map,'lower');
});
test('C03 original note and clasp unique, in-range real screen rejection and normal cancellation/pickup; five useful rooms',()=>{
 for(const [safe,id,field] of [['cGuide2Door','note','clue'],['cWood3Door','plaque','item']]){assert.equal(EXP_TARGETS.filter(t=>t.id===id).length,1);const d=coreDriver({...emptyExplorationSave(),safe});d.use(id);d.r.closeDialogue(false);assert.equal(d.r.snapshot[field],false);d.use(id);d.r.closeDialogue();assert.equal(d.r.snapshot[field],true);const before=d.r.save;d.use(id);d.r.closeDialogue();assert.deepEqual(d.r.save,before);}
 const d=coreDriver({...emptyExplorationSave(),safe:'cWoodStair3'});d.to(680,415);const t=EXP_TARGETS.find(t=>t.id==='plaque');assert.ok(Math.hypot(t.x-d.r.snapshot.position.x,t.y-d.r.snapshot.position.y)<=64);assert.ok(explorationWalls('workshop3',false).some(w=>segmentHitsRect(d.r.snapshot.position,t,w)));assert.equal(d.r.snapshot.target,undefined);d.r.interact(true);d.r.interact(false);assert.equal(d.r.snapshot.item,false);assert.equal(d.r.snapshot.pending,undefined);d.use('plaque');d.r.closeDialogue();assert.equal(d.r.snapshot.item,true);
 for(const [safe,id] of [['cGuide1Door','memento-bookmark'],['cTeaRoom','memento-sketch'],['cLanternRoom','memento-postcard']]){const e=coreDriver(stage(safe));e.use(id);assert.equal(e.r.snapshot.inspectingMemento!==undefined,true);e.r.closeDialogue(false);assert.equal(e.r.snapshot.mementos.length,0);e.use(id);e.r.closeDialogue(true,e.r.snapshot.mementoInspectionId);assert.equal(e.r.snapshot.mementos.length,1);}
 const tea=coreDriver(stage('cTeaRoom'));tea.use('window');assert.equal(tea.r.snapshot.photoPreview.siteId,'window');assert.equal(tea.r.takePhoto(tea.r.snapshot.photoPreview.id),'incomplete');
});
test('C04 all 31 legacy safe rows map after old admission; 31/25/19/12 snapshots reject every new identity',()=>{
 const profiles=[[EXP05B_CONTENT_VERSION,migrateExp05BSave,EXP05B_SAFE],[EXP05A_CONTENT_VERSION,migrateExp05ASave,EXP05A_SAFE],[EXP03B_CONTENT_VERSION,migrateExp03BSave,EXP_PRE05_SAFE],[EXP02C_CONTENT_VERSION,migrateExp02CSave,EXP_PRE05_SAFE],[EXP02B_CONTENT_VERSION,migrateExp02BSave,EXP_LEGACY_SAFE],[EXP02A_CONTENT_VERSION,migrateExp02ASave,EXP_LEGACY_SAFE]];
 for(const [version,convert,keys] of profiles){
  for(const safe of Object.keys(keys)){const value={...stage(safe,version===EXP02A_CONTENT_VERSION?'open':'photo',version===EXP05B_CONTENT_VERSION||version===EXP05A_CONTENT_VERSION||version===EXP03B_CONTENT_VERSION),contentVersion:version};if(version===EXP02A_CONTENT_VERSION){delete value.photo;delete value.observedSites;}const raw=JSON.stringify(value),result=convert(value);assert.ok(result,safe);assert.equal(result.safe,mapped(safe));assert.deepEqual(result.progress,value.progress);assert.equal(JSON.stringify(value),raw);assert.ok(validateExplorationSave(result));}
  for(const safe of Object.keys(EXP_SAFE).filter(k=>!Object.hasOwn(keys,k))){const value={...stage(safe),contentVersion:version};if(version===EXP02A_CONTENT_VERSION){delete value.photo;delete value.observedSites;}assert.equal(convert(value),undefined,version+' '+safe);}
  for(const safe of ['eastUpper','westUpper',...Object.keys(keys).filter(k=>['middle','lower','riverfront'].includes(keys[k].map))]){const value={...emptyExplorationSave(),contentVersion:version,safe};if(version===EXP02A_CONTENT_VERSION){delete value.photo;delete value.observedSites;}assert.equal(convert(value),undefined,'historical admission '+safe);}
 }
 assert.ok(validateExplorationSave({...emptyExplorationSave(),safe:'cMiddleEast'}));
 for(const safe of ['teaDoor','teaRoom']){const original={...emptyExplorationSave(),contentVersion:EXP05B_CONTENT_VERSION,safe},raw=JSON.stringify(original),p=port([[EXP_05B_STORAGE_KEY,raw],['other','keep']]),storage=new ExplorationStorage(p),result=storage.load();assert.equal(result.safe,safe==='teaDoor'?'cGuideH2':'cGuide1Door');assert.equal(new ExplorationRuntime('migrated',result).snapshot.unlocked,false);assert.match(storage.notice,/尚未开放的下街.*未补开/);storage.save(result);assert.equal(p.getItem(EXP_05B_STORAGE_KEY),raw);assert.equal(new ExplorationStorage(p).load().safe,result.safe);assert.equal(p.getItem('other'),'keep');}
});
test('C04 bad newer blocks older, migrated photo/title not reissued, restart writes only new blank A',()=>{
 const original={...stage('overlook','photo',true),contentVersion:EXP05B_CONTENT_VERSION},raw=JSON.stringify(original),p=port([[EXP_05B_STORAGE_KEY,raw],['other','keep']]),storage=new ExplorationStorage(p),value=storage.load();assert.equal(value.safe,'cLowerRiver');const d=coreDriver(value),before=d.r.save.progress;assert.equal(before.counts.rewards,2);d.use('riverfront-down');d.to(900,650);d.to(900,1050);d.use('view');assert.equal(d.r.takePhoto(d.r.snapshot.photoPreview.id),'existing');assert.deepEqual(d.r.snapshot.progress,before);assert.equal(d.r.save.safe,'riverView');storage.save(d.r.save);
 for(const corrupt of ['{bad',JSON.stringify({...emptyExplorationSave(),safe:'middleEastUpper'})]){p.setItem(EXP_STORAGE_KEY,corrupt);const blocked=new ExplorationStorage(p);assert.equal(blocked.load(),undefined);blocked.save(emptyExplorationSave());assert.equal(p.getItem(EXP_STORAGE_KEY),corrupt);}
 assert.equal(storage.restart(),true);for(let n=0;n<3;n++){const save=new ExplorationStorage(p).load();assert.deepEqual(save,emptyExplorationSave());}assert.equal(p.getItem(EXP_05B_STORAGE_KEY),raw);assert.equal(p.getItem('other'),'keep');
 assert.deepEqual(PHOTO_SITES.river,{id:'river',map:'riverfront',safe:'riverView',targetId:'view',name:'江边开阔面',x:1950,y:1050,elements:{bridge:'visible',water:'visible',timber:'visible'},observation:'桥面、江水与层叠木楼都能清楚地留在同一幅画内。'});
});
