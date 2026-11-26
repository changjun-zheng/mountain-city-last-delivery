import assert from 'node:assert/strict';
import{test}from'node:test';
import{ExplorationRuntime,emptyExplorationSave}from'../src/core/exploration.ts';
import{PHOTO_SITES,PHOTO_METADATA}from'../src/core/exploration-photo.ts';
import{InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q}from'../src/core/progress.ts';
import{projectExplorationJournal,explorationDialogueAction}from'../src/platform/web/exploration-journal.ts';

const fresh=new ExplorationRuntime('projection-only').snapshot;
const model=changes=>projectExplorationJournal({...fresh,...changes});
test('EXP-03A U03 empty notebook discloses neither quest answers nor undiscovered viewpoints',()=>{
 const m=model({}),text=JSON.stringify(m);assert.equal(m.quest.status,'待发现');assert.deepEqual(m.discoveries,[]);assert.deepEqual(m.observations,[]);assert.equal(m.canReviewCard,false);
 for(const secret of ['江纹','导扣','两道水波','木作','江边开阔面','檐下回望','花窗望江','桥、江水'])assert.equal(text.includes(secret),false,secret);
});
test('EXP-03A U03 accepted requirement is known, while clue, item, path and viewpoints remain undisclosed',()=>{
 const m=model({accepted:true});assert.equal(m.quest.status,'进行中');assert.match(m.quest.text,/桥、江水与木楼/);assert.deepEqual(m.discoveries,[]);assert.deepEqual(m.observations,[]);assert.equal(m.canReviewCard,false);
});
test('EXP-03A U03 clues and item appear independently, including item before accepting the quest',()=>{
 const clue=model({clue:true});assert.equal(clue.discoveries.length,1);assert.match(clue.discoveries[0].text,/江纹向下/);assert.equal(clue.quest.status,'待发现');
 const item=model({item:true});assert.equal(item.discoveries.length,1);assert.match(item.discoveries[0].title,/江纹导扣/);assert.equal(JSON.stringify(item).includes('江纹向下'),false);
});
test('EXP-03A U03 unlocked path and only actually observed compositions enter the notebook',()=>{
 const m=model({accepted:true,clue:true,item:true,unlocked:true,observations:[PHOTO_SITES.window]});assert.equal(m.discoveries.length,3);assert.match(m.discoveries[2].text,/已经打开/);assert.deepEqual(m.observations.map(o=>o.title),['花窗望江']);
 assert.equal(JSON.stringify(m).includes('江边开阔面'),false);assert.equal(JSON.stringify(m).includes('檐下回望'),false);assert.equal(m.canReviewCard,false);
});
test('EXP-03A U03 found view is not photographed completion; earned card only follows photographed truth',()=>{
 const found=model({accepted:true,completed:true,observations:[PHOTO_SITES.river]});assert.equal(found.quest.status,'进行中');assert.equal(found.canReviewCard,false);
 const card=model({accepted:true,completed:true,photographed:true,observations:[PHOTO_SITES.river]});assert.equal(card.quest.status,'已完成');assert.equal(card.canReviewCard,true);
});
test('EXP-03A U03 repeated projection never mutates runtime, save, progress or its own later observations',()=>{
 const r=new ExplorationRuntime('read-only',emptyExplorationSave()),before=JSON.stringify(r.save);for(let i=0;i<10;i++)projectExplorationJournal(r.snapshot);assert.equal(JSON.stringify(r.save),before);
 const m=projectExplorationJournal({...r.snapshot,observations:[PHOTO_SITES.window]});m.observations[0].text='local mutation';assert.equal(PHOTO_SITES.window.observation.includes('local mutation'),false);assert.equal(r.snapshot.progress.counts.rewards,0);
});

// SHORT-DEMO-01: real validated save fixtures; no movement/commit shortcuts in runtime.
function at(safe,flags={}){
 const progress=new InMemoryRunProgress('exp03b');
 for(const name of ['accepted','clue'])if(flags[name])progress.completeGoal(P[name]);
 if(flags.item)progress.recordCollection(P.item);
 for(const name of ['unlocked','completed'])if(flags[name])progress.completeGoal(P[name]);
 if(flags.photographed)progress.completeGoal(Q.photographed);
 return new ExplorationRuntime('short-demo',{...emptyExplorationSave(),safe,progress:progress.snapshot,observedSites:flags.photographed?['river']:[],photo:flags.photographed?PHOTO_METADATA:null});
}
const equipped={accepted:true,clue:true,item:true},opened={...equipped,unlocked:true};
test('SHORT S01 new and pre-quest guidance uses reachable return floors without disclosing puzzle answers',()=>{
 const start=at('chapterStart');assert.match(start.snapshot.objective,/纪念碑右侧/);
 start.skipOnboarding();assert.match(start.snapshot.objective,/向东（右侧）/);
 assert.match(at('serviceRoom').snapshot.objective,/返回步行街/);
 assert.match(at('cGuideH3').snapshot.objective,/西口返回沧白路入口/);
 assert.match(at('cGuide1Door').snapshot.objective,/出楼回中街/);
 assert.match(at('cWood1Door').snapshot.objective,/上2F出中街/);
 assert.match(at('cWood3Door').snapshot.objective,/本层门口回上街/);
 for(const safe of ['chapterStart','cGuideH3','cGuide1Door','cWood1Door']){
  const text=JSON.stringify(projectExplorationJournal(at(safe).snapshot));
  for(const secret of ['两道水波','江纹栈门','江边开阔面'])assert.equal(text.includes(secret),false,secret);
 }
});
test('SHORT S02 clue guidance follows the real guide entrance and floor, including item-first saves',()=>{
 assert.match(at('cGuideH3',{accepted:true}).snapshot.objective,/导览楼2F/);
 assert.match(at('cGuideH2',{accepted:true}).snapshot.objective,/1F.*2F/);
 assert.match(at('cGuide1Door',{accepted:true}).snapshot.objective,/东侧楼梯上2F/);
 assert.match(at('cGuide2Door',{accepted:true}).snapshot.objective,/2F东侧纹样展柜/);
 assert.match(at('cWood3Door',{accepted:true,item:true}).snapshot.objective,/查看纹样展柜/);
});
test('SHORT S03 item and gate directions name the existing floors, without forcing one acquisition order',()=>{
 const informed={accepted:true,clue:true};
 assert.match(at('cWoodH2',informed).snapshot.objective,/木作楼2F.*3F/);
 assert.match(at('cWood2Door',informed).snapshot.objective,/东侧楼梯上3F/);
 assert.match(at('cWood3Door',informed).snapshot.objective,/长屏风下端向左绕/);
 assert.match(at('cGuide2Door',equipped).snapshot.objective,/下1F出中街/);
 assert.match(at('cWood3Door',equipped).snapshot.objective,/3F左侧楼梯下2F/);
 assert.match(at('cWoodStair2Up',equipped).snapshot.objective,/2F右上临街门出中街.*江纹栈门/);
 assert.match(at('cArrival',equipped).snapshot.objective,/中街东侧栈门/);
});
test('SHORT S04 known route goes into notebook but undiscovered photo answers do not',()=>{
 const accepted=projectExplorationJournal(at('cArrival',{accepted:true}).snapshot);
 assert.match(accepted.quest.text,/导览楼2F.*木作楼3F/);
 assert.deepEqual(accepted.discoveries,[]);assert.deepEqual(accepted.observations,[]);
 const ready=at('cMiddleGate',equipped).snapshot,book=projectExplorationJournal(ready);
 assert.equal(book.direction,ready.objective);assert.match(book.direction,/中街东侧/);
 assert.equal(JSON.stringify(book).includes('江边开阔面'),false);
 assert.match(projectExplorationJournal(at('cMiddleGate',opened).snapshot).discoveries.at(-1).text,/木作1F门/);
});
test('SHORT S05 finding a view still requires shutter and never claims photographed completion',()=>{
 assert.match(at('cLowerEast',opened).snapshot.objective,/下街东南端「沿江石阶」.*江岸/);
 assert.match(at('cTeaRoom',opened).snapshot.objective,/先出茶歇回下街.*沿江石阶/);
 assert.match(at('cLanternRoom',opened).snapshot.objective,/先出灯笼铺回下街.*沿江石阶/);
 const view=at('riverView',{...opened,completed:true}).snapshot;
 assert.match(view.objective,/拍摄这一刻/);assert.equal(view.photographed,false);
 assert.equal(projectExplorationJournal(view).quest.status,'进行中');
 const done=at('riverView',{...opened,completed:true,photographed:true}).snapshot;
 assert.match(done.objective,/照水岭已开放/);assert.equal(projectExplorationJournal(done).quest.status,'已完成');
});
test('SHORT S06 confirmation labels describe pending action without changing commits or repeats',()=>{
 for(const [pending,label] of [['accepted','接受委托'],['clue','记下导览'],['item','带上导扣'],['unlocked','转动导扣，开门']]){
  assert.equal(explorationDialogueAction({...fresh,pending}),label+' · E');
  assert.equal(explorationDialogueAction({...fresh,pending},{keyboardHint:false}),label);
  assert.equal(explorationDialogueAction({...fresh,pending,[pending]:true}),'收起 · E');
  assert.equal(explorationDialogueAction({...fresh,pending,[pending]:true},{keyboardHint:false}),'收起');
 }
 assert.equal(explorationDialogueAction({...fresh,inspectingMemento:'bookmark',pending:'memento-bookmark'}),'收进纪念册 · E');
 assert.equal(explorationDialogueAction({...fresh,inspectingMemento:'bookmark',pending:'memento-bookmark'},{keyboardHint:false}),'收进纪念册');
 assert.equal(explorationDialogueAction({...fresh,inspectingMemento:'bookmark'}),'收起 · E');
 assert.equal(explorationDialogueAction(fresh),'收起 · E');
 assert.equal(explorationDialogueAction(fresh,{keyboardHint:false}),'收起');
 for(const pending of ['ferry-out','ferry-back']){assert.equal(explorationDialogueAction({...fresh,pending}),'上船 · E');assert.equal(explorationDialogueAction({...fresh,pending},{keyboardHint:false}),'上船');}
 const r=at('cMiddleGate',equipped),before=JSON.stringify(r.save),revision=r.snapshot.revision;
 for(let i=0;i<50;i++){projectExplorationJournal(r.snapshot);explorationDialogueAction(r.snapshot);}
 assert.equal(JSON.stringify(r.save),before);assert.equal(r.snapshot.revision,revision);
});
