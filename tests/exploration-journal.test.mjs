import assert from 'node:assert/strict';
import{test}from'node:test';
import{ExplorationRuntime,emptyExplorationSave}from'../src/core/exploration.ts';
import{PHOTO_SITES}from'../src/core/exploration-photo.ts';
import{projectExplorationJournal}from'../src/platform/web/exploration-journal.ts';

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
