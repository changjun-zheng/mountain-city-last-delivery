import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ExplorationRuntime,emptyExplorationSave,validateExplorationSave} from '../src/core/exploration.ts';
import {EXP_MAPS,EXP_SAFE,EXP_TARGETS} from '../src/core/exploration-content.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';
import {PHOTO_METADATA} from '../src/core/exploration-photo.ts';
import {hasRouteCue,routeCues,committedGateOpening,gateOpeningFraction,investigationView} from '../src/rendering/exploration-feedback.ts';
import {createGateSound} from '../src/platform/web/exploration-gate-sound.ts';
import {coreDriver} from './exploration-floor-routes.mjs';

// As in exploration-journal: only genuine progress IDs and admitted current saves.
const equipped={accepted:true,clue:true,item:true},opened={...equipped,unlocked:true};
let serial=0;
function saveAt(safe,flags={}){
  const progress=new InMemoryRunProgress('exp03b');
  for(const name of ['accepted','clue'])if(flags[name])progress.completeGoal(P[name]);
  if(flags.item)progress.recordCollection(P.item);
  if(flags.unlocked)progress.completeGoal(P.unlocked);
  if(flags.photographed){progress.completeGoal(P.completed);progress.completeGoal(Q.photographed);}
  const save={...emptyExplorationSave(),safe,progress:progress.snapshot,observedSites:flags.photographed?['river']:[],photo:flags.photographed?PHOTO_METADATA:null};
  assert.ok(validateExplorationSave(save),'invalid fixture: '+safe+' '+JSON.stringify(flags));
  return save;
}
const at=(safe,flags={})=>new ExplorationRuntime('feedback-'+(++serial),saveAt(safe,flags));
function inspect(safe,id,flags={}){
  const d=coreDriver(saveAt(safe,flags));
  d.use(id);
  assert.equal(d.r.snapshot.target?.id,id);
  assert.ok(d.r.snapshot.dialogue,id+' must have real dialogue');
  return d;
}
function confirmGate(){
  const r=at('cMiddleGate',equipped);
  assert.equal(r.snapshot.target?.id,'gate');
  r.interact(true);
  const before=r.snapshot;
  assert.equal(before.pending,'unlocked');
  r.closeDialogue(true);
  assert.equal(committedGateOpening(before,r.snapshot),true);
  return r;
}
const safeOn=map=>Object.keys(EXP_SAFE).find(id=>EXP_SAFE[id].map===map);
const sorted=values=>[...values].sort();
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);

// Independent whitelist: no lower-street, other-building, A/B/D or investigation cues.
const cueIds={
  upper:['guide-door','workshop-upper-door','east-down','west-down'],
  middle:['guide-middle-door','workshop-middle-door','middle-east-upper','middle-west-upper','middle-east-lower','middle-west-lower'],
  guide:['guide-exit','guide-up'],
  guide2:['guide-upper-exit','guide-down'],
  workshop:['workshop-exit','workshop-up-2'],
  workshop2:['workshop-middle-exit','workshop-down-1','workshop-up-3'],
  workshop3:['workshop-upper-exit','workshop-down-2'],
};
const cueWhitelist=new Set(Object.values(cueIds).flat());
const linkedCues=['middle-east-lower','middle-west-lower','workshop-exit'];

test('ENV F01 route whitelist is exact, with original target coordinates and destinations',()=>{
  assert.equal(cueWhitelist.size,21);
  for(const id of cueWhitelist)assert.equal(EXP_TARGETS.filter(t=>t.id===id).length,1,id);
  for(const target of EXP_TARGETS)assert.equal(hasRouteCue(target.id),cueWhitelist.has(target.id),target.id);
  for(const map of Object.keys(EXP_MAPS)){
    const r=at(safeOn(map),map==='ridge'?{...opened,photographed:true}:opened),cues=routeCues(r.snapshot);
    assert.deepEqual(sorted(cues.map(c=>c.id)),sorted(cueIds[map]??[]),map);
    for(const cue of cues){
      const target=EXP_TARGETS.find(t=>t.id===cue.id);
      for(const field of ['id','map','x','y','destination','locked'])assert.equal(cue[field],target[field],cue.id+' '+field);
      assert.ok(cue.label.length>0);
      assert.equal(cue.closed,false);
      const kind=cue.id.includes('door')||cue.id.includes('exit')?'door':
        ['guide-up','workshop-up-2','workshop-up-3','middle-east-upper','middle-west-upper'].includes(cue.id)?'up':'down';
      assert.equal(cue.kind,kind,cue.id);
      assert.equal(cue.detail,kind==='door'?'靠近门口交互':'靠近阶口交互');
    }
  }
});

test('ENV F02 closed cues are only the three linked exits, not early exploration routes',()=>{
  const closed=[];
  for(const map of Object.keys(cueIds)){
    for(const flags of [{},equipped]){
      const cues=routeCues(at(safeOn(map),flags).snapshot);
      for(const cue of cues){
        assert.equal(cue.closed,linkedCues.includes(cue.id),cue.id);
        if(cue.closed){assert.match(cue.detail,/封道联动.*暂不可通行/);if(!flags.accepted)closed.push(cue.id);}
        else assert.doesNotMatch(cue.detail,/封道|不可通行/);
      }
    }
  }
  assert.deepEqual(sorted(closed),sorted(linkedCues));
});

test('ENV F03 lower street and all out-of-scope maps receive no cues',()=>{
  for(const map of ['lower','plaza','entry','service','tea','market','lantern','riverfront']){
    // Lower/tea/lantern/riverfront require a genuinely opened save, not a forged snapshot.
    assert.deepEqual(routeCues(at(safeOn(map),opened).snapshot),[],map);
    for(const target of EXP_TARGETS.filter(t=>t.map===map))assert.equal(hasRouteCue(target.id),false,target.id);
  }
});

const investigations=[['cGuide2Door','note','guide2'],['cWood3Door','plaque','workshop3'],['cMiddleGate','gate','middle']];
test('ENV F04 investigation requires dialogue and exactly note/guide2, plaque/workshop3 or gate/middle',()=>{
  for(const [safe,id,map] of investigations){
    const d=inspect(safe,id,equipped),s=d.r.snapshot,view=investigationView(s);
    assert.equal(s.map,map);
    assert.ok(view?.key.startsWith(id),id);
    assert.match(view.svg,/^<svg\b/);
    assert.ok(view.title&&view.caption);
    // Guard probes alter presentation fields only, never progress or runtime internals.
    assert.equal(investigationView({...s,target:undefined}),undefined);
    assert.equal(investigationView({...s,inspectingMemento:'bookmark'}),undefined);
    for(const otherMap of Object.keys(EXP_MAPS).filter(m=>m!==map))assert.equal(investigationView({...s,map:otherMap}),undefined,otherMap+' '+id);
    for(const target of EXP_TARGETS.filter(t=>t.id!==id))assert.equal(investigationView({...s,target}),undefined,target.id+' in '+map);
    d.r.closeDialogue(false);
    assert.equal(investigationView(d.r.snapshot),undefined,'closed '+id);
  }
  const memento=inspect('cGuide1Door','memento-bookmark');
  assert.equal(memento.r.snapshot.inspectingMemento,'bookmark');
  assert.equal(investigationView(memento.r.snapshot),undefined);
  memento.r.closeDialogue(false);
});

test('ENV F05 item-first inspection never leaks unread guide destinations or claims pickup before confirmation',()=>{
  const d=inspect('cWood3Door','plaque'),before=d.r.save;
  const checkUnknown=view=>{
    assert.doesNotMatch(JSON.stringify(view),/中街|栈门|外阶|下街|上街杂物门|与导览相合/);
    assert.match(view.svg,/用途需与导览对照/);
  };
  const pending=investigationView(d.r.snapshot);
  assert.equal(d.r.snapshot.pending,'item');
  assert.equal(d.r.snapshot.item,false);
  assert.match(pending.title,/柜里/);
  assert.doesNotMatch(pending.title+pending.svg,/随身的|已带在身上/);
  checkUnknown(pending);
  d.r.closeDialogue(false);
  assert.deepEqual(d.r.save,before);
  d.interact('plaque');
  d.r.closeDialogue(true);
  assert.equal(d.r.snapshot.item,true);
  assert.equal(d.r.snapshot.clue,false);
  assert.equal(d.r.snapshot.accepted,false);
  d.interact('plaque');
  const owned=investigationView(d.r.snapshot);
  assert.match(owned.title,/随身/);
  assert.match(owned.svg,/已带在身上/);
  checkUnknown(owned);
  d.r.closeDialogue(false);
  const informed=inspect('cWood3Door','plaque',{clue:true});
  assert.match(investigationView(informed.r.snapshot).svg,/与导览相合.*到中街门前再核对/);
  assert.equal(informed.r.snapshot.item,false);
  informed.r.closeDialogue(false);
});

test('ENV F06 gate comparison and actual confirmation require all three independent conditions',()=>{
  for(let bits=0;bits<8;bits++){
    const flags={accepted:!!(bits&1),clue:!!(bits&2),item:!!(bits&4)};
    const r=at('cMiddleGate',flags),save=r.save;
    assert.equal(r.snapshot.target?.id,'gate');
    r.interact(true);
    const before=r.snapshot,view=investigationView(before),ready=bits===7;
    assert.equal(before.pending,ready?'unlocked':undefined,JSON.stringify(flags));
    assert.equal(view.svg.includes('纹样吻合'),ready);
    assert.equal(view.svg.includes('随身导扣'),flags.item);
    assert.equal(view.svg.includes('尚未带来导扣'),!flags.item);
    if(!flags.item){assert.match(view.svg,/stroke-dasharray/);assert.doesNotMatch(view.title+view.svg,/已带在身上|随身的江纹导扣/);}
    assert.match(view.caption,!flags.accepted?/游客/:!flags.clue?/导览楼2F/:!flags.item?/木作楼3F/:/按下确认/);
    r.closeDialogue(true);
    assert.equal(r.snapshot.unlocked,ready);
    assert.equal(committedGateOpening(before,r.snapshot),ready);
    if(!ready)assert.deepEqual(r.save,save,'missing conditions must not commit');
  }
});

test('ENV F07 actual gate interact/cancel/confirm/repeat emits only the successful opening edge',()=>{
  const r=at('cMiddleGate',equipped),initial=r.snapshot,save=r.save;
  r.interact(true);
  const pending=r.snapshot;
  assert.equal(pending.pending,'unlocked');
  assert.equal(committedGateOpening(initial,pending),false);
  assert.ok(routeCues(pending).filter(c=>c.locked).every(c=>c.closed));
  r.closeDialogue(false);
  assert.equal(committedGateOpening(pending,r.snapshot),false);
  assert.deepEqual(r.save,save);
  r.interact(true);
  const confirmed=r.snapshot;
  r.closeDialogue(true);
  const after=r.snapshot;
  assert.equal(committedGateOpening(confirmed,after),true);
  assert.equal(committedGateOpening(initial,after),false,'no pending confirmation');
  assert.equal(committedGateOpening(after,after),false);
  assert.equal(after.item,true,'the clasp is not consumed');
  assert.ok(routeCues(after).every(c=>!c.closed));
  r.closeDialogue(true);
  assert.equal(committedGateOpening(after,r.snapshot),false);
  const committed=r.save;
  r.interact(true);
  const repeated=r.snapshot;
  assert.equal(repeated.pending,undefined);
  r.closeDialogue(true);
  assert.equal(committedGateOpening(repeated,r.snapshot),false);
  assert.deepEqual(r.save,committed);
  for(const map of Object.keys(EXP_MAPS).filter(m=>m!=='middle')){
    assert.equal(committedGateOpening({...confirmed,map},after),false,'before '+map);
    assert.equal(committedGateOpening(confirmed,{...after,map}),false,'after '+map);
  }
});

test('ENV F08 different runtime and already-open save never replay the opening',()=>{
  const pendingRuntime=at('cMiddleGate',equipped);
  pendingRuntime.interact(true);
  const oldPending=pendingRuntime.snapshot,r=confirmGate();
  assert.notEqual(oldPending.runtimeId,r.snapshot.runtimeId);
  assert.equal(committedGateOpening(oldPending,r.snapshot),false);
  const loaded=new ExplorationRuntime('feedback-reloaded-'+(++serial),r.save),initial=loaded.snapshot;
  assert.equal(initial.unlocked,true);
  assert.equal(committedGateOpening(initial,initial),false);
  assert.equal(committedGateOpening(oldPending,initial),false);
  assert.equal(gateOpeningFraction(undefined,initial.tick),1);
  loaded.interact(true);
  const dialogue=loaded.snapshot,view=investigationView(dialogue);
  assert.equal(dialogue.pending,undefined);
  assert.match(view.title,/已开放/);
  assert.match(view.svg,/已开路/);
  loaded.closeDialogue(true);
  assert.equal(committedGateOpening(dialogue,loaded.snapshot),false);
  assert.deepEqual(loaded.save,r.save);
  pendingRuntime.closeDialogue(false);
});

test('ENV F09 repeated and locally edited projections never write save, progress, revisions or content',()=>{
  const targets=structuredClone(EXP_TARGETS);
  for(const [safe,id] of investigations){
    const d=inspect(safe,id,equipped),s=d.r.snapshot,before=structuredClone(s),save=structuredClone(d.r.save);
    const expectedView=investigationView(s),expectedCues=routeCues(s);
    for(let n=0;n<30;n++){
      const view=investigationView(s),cues=routeCues(s);
      assert.deepEqual(view,expectedView);
      assert.deepEqual(cues,expectedCues);
      view.title='local only';view.svg='local only';
      if(cues.length){cues[0].x=-1;cues[0].label='local only';cues[0].closed=!cues[0].closed;}
      assert.equal(committedGateOpening(s,s),false);
      gateOpeningFraction(0,n);
    }
    assert.deepEqual(d.r.snapshot,before);
    assert.deepEqual(d.r.save,save);
    d.r.closeDialogue(false);
    assert.deepEqual(d.r.save,save);
  }
  assert.deepEqual(EXP_TARGETS,targets);
});

test('ENV F10 opening is bounded and monotonic over 45 real 50 Hz ticks (0.9 seconds)',()=>{
  const r=confirmGate(),start=r.snapshot.tick;
  assert.equal(r.simulation.config.fixedDeltaMs,20);
  assert.equal(45*r.simulation.config.fixedDeltaMs,900);
  assert.equal(gateOpeningFraction(start,start-1),0);
  assert.equal(gateOpeningFraction(start,start),0);
  r.frame(0);
  let previous=0;
  for(let n=1;n<=45;n++){
    r.frame(n*20);
    assert.equal(r.snapshot.tick,start+n);
    const fraction=gateOpeningFraction(start,r.snapshot.tick);
    assert.ok(fraction>previous&&fraction<=1,n+' '+fraction);
    if(n<45)assert.ok(fraction<1,n+' must not finish early');
    previous=fraction;
  }
  assert.equal(previous,1);
  assert.equal(gateOpeningFraction(start,start+1000),1);
  assert.equal(gateOpeningFraction(undefined,start),1);
  for(const tick of [start-1,start,start+20,start+45])assert.equal(gateOpeningFraction(start,tick,true),1);
});

test('ENV F11 lifecycle pause freezes the animation tick and resume does not catch up hidden time',()=>{
  const r=confirmGate(),start=r.snapshot.tick;
  r.frame(0);for(let n=1;n<=10;n++)r.frame(n*20);
  const tick=r.snapshot.tick,fraction=gateOpeningFraction(start,tick),owner=Symbol('feedback-test');
  assert.ok(fraction>0&&fraction<1);
  const token=r.lifecycle.acquire(owner,Symbol('pause'));
  for(const clock of [1000,5000,20000]){
    r.frame(clock);
    assert.equal(r.snapshot.tick,tick);
    assert.equal(gateOpeningFraction(start,r.snapshot.tick),fraction);
  }
  assert.equal(r.lifecycle.release(owner,token),'released');
  r.frame(20020);
  assert.equal(r.snapshot.tick,tick);
  r.frame(20040);
  assert.equal(r.snapshot.tick,tick+1);
  assert.ok(gateOpeningFraction(start,r.snapshot.tick)>fraction);
});

// Scheduling/resource fakes only: these tests make no audible-timbre claim.
// Top-level tests are serial; restore original global descriptors after each case.
function audioEnvironment(t,{supported=true,state='running',failure,delayed=false,resumeState='running'}={}){
  const document={visibilityState:'visible'},contexts=[];
  let constructions=0;
  const parameter=()=>({events:[],setValueAtTime(value,time){this.events.push(['set',value,time]);},
    exponentialRampToValueAtTime(value,time){this.events.push(['ramp',value,time]);}});
  const node=()=>({connections:[],disconnects:0,connect(destination){this.connections.push(destination);},disconnect(){this.disconnects++;}});
  class FakeAudioContext {
    constructor(){
      constructions++;
      if(failure==='constructor')throw new Error('fake constructor failure');
      this.state=state;this.currentTime=12.5;this.destination={};
      this.oscillators=[];this.gains=[];this.resumeCalls=0;this.closeCalls=0;
      contexts.push(this);
    }
    resume(){
      this.resumeCalls++;
      if(failure==='resume-throw')throw new Error('fake resume throw');
      if(failure==='resume-reject')return Promise.reject(new Error('fake resume rejection'));
      if(delayed)return new Promise(resolve=>{this.finishResume=()=>{if(this.state!=='closed')this.state=resumeState;resolve();};});
      this.state=resumeState;return Promise.resolve();
    }
    close(){
      this.closeCalls++;this.state='closed';
      return failure==='close-reject'?Promise.reject(new Error('fake close rejection')):Promise.resolve();
    }
    createOscillator(){
      if(failure==='oscillator')throw new Error('fake oscillator failure');
      const oscillator={...node(),type:'sine',frequency:parameter(),starts:[],stops:[],onended:null,
        start(time){if(failure==='start')throw new Error('fake start failure');this.starts.push(time);},
        stop(time){this.stops.push(time);},end(){assert.equal(typeof this.onended,'function');this.onended();}};
      this.oscillators.push(oscillator);return oscillator;
    }
    createGain(){
      if(failure==='gain')throw new Error('fake gain failure');
      const gain={...node(),gain:parameter()};this.gains.push(gain);return gain;
    }
  }
  for(const [key,value] of [['document',document],['AudioContext',supported?FakeAudioContext:undefined]]){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  }
  const sound=createGateSound();
  t.after(()=>sound.dispose());
  return {sound,document,contexts,get constructions(){return constructions;}};
}

test('ENV A01 audio lazily schedules exactly two quiet short tones and ended releases nodes/context',async t=>{
  const env=audioEnvironment(t),{sound,contexts}=env;
  assert.equal(sound.status,'idle');assert.equal(env.constructions,0);
  await assert.doesNotReject(sound.play());
  assert.equal(sound.status,'scheduled');assert.equal(env.constructions,1);
  const audio=contexts[0];
  assert.equal(audio.resumeCalls,0);
  assert.equal(audio.oscillators.length,2);assert.equal(audio.gains.length,2);
  for(let i=0;i<2;i++){
    const oscillator=audio.oscillators[i],gain=audio.gains[i],time=audio.currentTime+i*.09;
    assert.equal(oscillator.type,'triangle');
    assert.deepEqual(oscillator.frequency.events,[['set',i?175:280,time],['ramp',85,time+.065]]);
    assert.deepEqual(gain.gain.events,[['set',.0001,time],['ramp',.035,time+.004],['ramp',.0001,time+.075]]);
    assert.ok(gain.gain.events.every(([,value])=>value>0&&value<=.035));
    assert.deepEqual(oscillator.connections,[gain]);assert.deepEqual(gain.connections,[audio.destination]);
    assert.deepEqual(oscillator.starts,[time]);assert.deepEqual(oscillator.stops,[time+.08]);
    near(oscillator.stops[0]-oscillator.starts[0],.08);
    assert.equal(oscillator.disconnects,0);assert.equal(gain.disconnects,0);
  }
  near(audio.oscillators[1].starts[0]-audio.oscillators[0].starts[0],.09);
  near(audio.oscillators[1].stops[0]-audio.currentTime,.17);
  audio.oscillators[0].end();assert.equal(audio.closeCalls,0);
  audio.oscillators[1].end();assert.equal(audio.closeCalls,1);
  assert.equal(audio.state,'closed');
  for(const node of [...audio.oscillators,...audio.gains])assert.equal(node.disconnects,1);
  sound.stop();sound.dispose();assert.equal(audio.closeCalls,1,'ended detached the retained context');
  await sound.play();assert.equal(env.constructions,1,'disposed cannot restart');
});

test('ENV A02 suspended context resumes before scheduling',async t=>{
  const {sound,contexts}=audioEnvironment(t,{state:'suspended',delayed:true});
  const play=sound.play(),audio=contexts[0];
  assert.equal(audio.resumeCalls,1);assert.equal(sound.status,'idle');
  assert.equal(audio.oscillators.length,0);assert.equal(audio.gains.length,0);
  audio.finishResume();await assert.doesNotReject(play);
  assert.equal(sound.status,'scheduled');assert.equal(audio.oscillators.length,2);
});

const audioFailures=[
  ['unsupported',{supported:false}],['constructor throw',{failure:'constructor'}],
  ['resume throw',{state:'suspended',failure:'resume-throw'}],
  ['resume reject',{state:'suspended',failure:'resume-reject'}],
  ['resume still suspended',{state:'suspended',resumeState:'suspended'}],
  ['non-running context',{state:'closed'}],['oscillator throw',{failure:'oscillator'}],
  ['gain throw',{failure:'gain'}],['start throw',{failure:'start'}],
];
for(const [name,options] of audioFailures)test('ENV A03 optional audio '+name+' does not reject or undo opening',async t=>{
  const {sound,contexts}=audioEnvironment(t,options),r=confirmGate(),save=structuredClone(r.save);
  await assert.doesNotReject(sound.play());
  assert.equal(sound.status,'unavailable');
  for(const audio of contexts){assert.ok(audio.closeCalls>=1);assert.equal(audio.state,'closed');}
  assert.equal(r.snapshot.unlocked,true);assert.deepEqual(r.save,save);
});

test('ENV A04 initially hidden skips all audio work',async t=>{
  const env=audioEnvironment(t);
  env.document.visibilityState='hidden';
  await assert.doesNotReject(env.sound.play());
  assert.equal(env.constructions,0);assert.equal(env.sound.status,'idle');
});

for(const action of ['stop','dispose','hidden'])test('ENV A05 delayed resume after '+action+' never starts a tone',async t=>{
  const env=audioEnvironment(t,{state:'suspended',delayed:true}),{sound,contexts,document}=env;
  const play=sound.play(),audio=contexts[0];
  assert.equal(audio.resumeCalls,1);assert.equal(audio.oscillators.length,0);
  if(action==='hidden')document.visibilityState='hidden';else sound[action]();
  audio.finishResume();await assert.doesNotReject(play);
  assert.equal(audio.oscillators.length,0);assert.equal(audio.gains.length,0);
  assert.ok(audio.closeCalls>=1);assert.equal(audio.state,'closed');assert.equal(sound.status,'idle');
  if(action==='stop'){
    const next=sound.play();contexts[1].finishResume();await assert.doesNotReject(next);
    assert.equal(env.constructions,2);assert.equal(contexts[1].oscillators.length,2);
  }else{
    await assert.doesNotReject(sound.play());assert.equal(env.constructions,1);
  }
});

test('ENV A06 superseded delayed request cannot play or close the newer active context',async t=>{
  const {sound,contexts}=audioEnvironment(t,{state:'suspended',delayed:true});
  const first=sound.play(),old=contexts[0],second=sound.play(),current=contexts[1];
  assert.equal(old.closeCalls,1);
  current.finishResume();await assert.doesNotReject(second);
  assert.equal(current.oscillators.length,2);
  old.finishResume();await assert.doesNotReject(first);
  assert.equal(old.oscillators.length,0);assert.equal(current.closeCalls,0);
  assert.equal(sound.status,'scheduled');
  sound.stop();assert.equal(current.closeCalls,1);
  sound.stop();sound.dispose();assert.equal(current.closeCalls,1);
});

test('ENV A07 rejected close on ended is contained and releases the retained context',async t=>{
  const {sound,contexts}=audioEnvironment(t,{failure:'close-reject'});
  await assert.doesNotReject(sound.play());
  const audio=contexts[0];
  assert.doesNotThrow(()=>{for(const oscillator of audio.oscillators)oscillator.end();});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(audio.closeCalls,1);
  for(const node of [...audio.oscillators,...audio.gains])assert.equal(node.disconnects,1);
  sound.stop();assert.equal(audio.closeCalls,1);
});
