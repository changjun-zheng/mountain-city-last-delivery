import {EXP_TARGETS, type TargetId} from '../core/exploration-content.ts';
import type {ExplorationSnapshot} from '../core/exploration.ts';

// Presentation only: every cue refers to an existing target; nothing is saved.
const cues:Partial<Record<TargetId,{kind:'door'|'up'|'down';label:string}>>={
  'guide-door':{kind:'door',label:'导览楼 · 2F'},
  'guide-middle-door':{kind:'door',label:'导览楼 · 1F'},
  'guide-upper-exit':{kind:'door',label:'2F门 · 回上街'},
  'guide-exit':{kind:'door',label:'1F门 · 出中街'},
  'workshop-upper-door':{kind:'door',label:'木作楼 · 3F'},
  'workshop-middle-door':{kind:'door',label:'木作楼 · 2F'},
  'workshop-upper-exit':{kind:'door',label:'3F门 · 回上街'},
  'workshop-middle-exit':{kind:'door',label:'2F门 · 出中街'},
  'workshop-exit':{kind:'door',label:'1F门 · 出下街'},
  'guide-up':{kind:'up',label:'上2F · 纹样导览'},
  'guide-down':{kind:'down',label:'下1F · 中街出口'},
  'workshop-up-2':{kind:'up',label:'上2F · 工具整理'},
  'workshop-down-1':{kind:'down',label:'下1F · 下街门'},
  'workshop-up-3':{kind:'up',label:'上3F · 门扣柜'},
  'workshop-down-2':{kind:'down',label:'下2F · 中街出口'},
  'east-down':{kind:'down',label:'东外阶 · 到中街'},
  'west-down':{kind:'down',label:'西外阶 · 到中街'},
  'middle-east-upper':{kind:'up',label:'东外阶 · 回上街'},
  'middle-west-upper':{kind:'up',label:'西外阶 · 回上街'},
  'middle-east-lower':{kind:'down',label:'东外阶 · 下街'},
  'middle-west-lower':{kind:'down',label:'西外阶 · 下街'},
};
export const hasRouteCue=(id:TargetId):boolean=>!!cues[id];
export function routeCues(s:Pick<ExplorationSnapshot,'map'|'unlocked'>){
  return EXP_TARGETS.filter(t=>t.map===s.map&&hasRouteCue(t.id)).map(t=>({
    ...t,...cues[t.id]!,closed:!!t.locked&&!s.unlocked,
    detail:t.locked&&!s.unlocked?'封道联动 · 暂不可通行':cues[t.id]!.kind==='door'?'靠近门口交互':'靠近阶口交互',
  }));
}
export function committedGateOpening(before:Pick<ExplorationSnapshot,'runtimeId'|'map'|'pending'|'unlocked'>,after:Pick<ExplorationSnapshot,'runtimeId'|'map'|'unlocked'>):boolean{
  return before.runtimeId===after.runtimeId&&before.map==='middle'&&after.map==='middle'&&before.pending==='unlocked'&&!before.unlocked&&after.unlocked;
}
// The existing simulation uses 20 ms ticks: 45 ticks = 900 ms. Pauses freeze it.
export function gateOpeningFraction(startTick:number|undefined,tick:number,reducedMotion=false):number{
  if(startTick===undefined||reducedMotion)return 1;
  const t=Math.max(0,Math.min(1,(tick-startTick)/45));
  return 1-(1-t)**3;
}

const wave=(x:number,y:number,color='#77c5c2')=>`<g fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"><path d="M${x} ${y}q14 -15 28 0t28 0t28 0"/><path d="M${x} ${y+23}q14 -15 28 0t28 0t28 0"/></g>`;
const mountain=(x:number,y:number)=>`<path d="M${x} ${y+44}l30 -48 30 48m-32 -4 30 -48 30 48" fill="none" stroke="#795c47" stroke-width="6" stroke-linejoin="round"/>`;
const text=(x:number,y:number,value:string,size=22)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${value}</text>`;
const card=(x:number)=>`<rect x="${x}" y="16" width="208" height="218" rx="7" fill="#f8f0d9" stroke="#baa67c" stroke-width="2"/>`;
const svg=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 252"><rect width="480" height="252" rx="8" fill="#e3d4b0"/><g font-family="Microsoft YaHei,PingFang SC,sans-serif" fill="#213d46">${body}</g></svg>`;
const token=(x:number,owned=true)=>owned?`<rect x="${x-62}" y="82" width="124" height="76" rx="15" fill="#795c47" stroke="#503d2c" stroke-width="4"/><circle cx="${x-43}" cy="120" r="6" fill="#e3d4b0"/>${wave(x-24,110,'#ffe0a4')}`:`<rect x="${x-62}" y="82" width="124" height="76" rx="15" fill="none" stroke="#a69b82" stroke-width="3" stroke-dasharray="7 6"/>${text(x,132,'—',30)}`;
const gate=(x:number,open:boolean)=>`<path d="M${x-65} 160V76h130v84" fill="${open?'#c7d4bf':'#173f4b'}" stroke="#795c47" stroke-width="7"/>${open?`<path d="M${x-20} 121l15 16 35 -38" fill="none" stroke="#376e65" stroke-width="7"/>`:wave(x-42,108)}`;

export function investigationView(s:Pick<ExplorationSnapshot,'map'|'target'|'dialogue'|'inspectingMemento'|'accepted'|'clue'|'item'|'unlocked'>){
  if(!s.dialogue||s.inspectingMemento)return;
  const id=s.target?.id;
  if(id==='note'&&s.map==='guide2')return{
    key:'note',title:'楼层与纹样对照',
    caption:'山尖与双水波指向不同去处。先看纹样，再找相应门扣。',
    svg:svg(card(16)+card(256)+text(120,53,'山纹')+mountain(79,90)+text(120,189,'上街杂物门')+text(120,219,'不是下行通路',18)+text(360,53,'江纹')+wave(318,110,'#386c77')+text(360,189,'中街栈门')+text(360,219,'门后外阶通下街',18)),
  };
  if(id==='plaque'&&s.map==='workshop3')return{
    key:`plaque:${s.clue}:${s.item}`,title:s.item?'随身的江纹导扣':'门扣柜里的可借导扣',
    caption:s.item?'导扣已经带在身上，不会因试错消失。':s.clue?'两道水波与导览一致；确认带走后，再去门前核对。':'木面刻着两道水波；先看清纹样，确认后才会带走。',
    svg:svg(card(16)+card(256)+text(120,53,s.item?'已带在身上':'柜中的导扣')+token(120)+text(120,206,'两道水波')+text(360,53,s.clue?'导览中的江纹':'观察纹样')+wave(318,110,'#386c77')+text(360,195,s.clue?'与导览相合':'水波，不是山尖')+text(360,223,s.clue?'到中街门前再核对':'用途需与导览对照',18)),
  };
  if(id==='gate'&&s.map==='middle'){
    const ready=s.accepted&&s.clue&&s.item;
    return {key:`gate:${s.accepted}:${s.clue}:${s.item}:${s.unlocked}`,title:s.unlocked?'江纹通路已开放':'门前比对',
      caption:s.unlocked?'两端外阶与木作1F门都可通行。':!s.accepted?'先与沧白路游客确认这次取景委托。':!s.clue?'门上是双水波；先去导览楼2F弄清去向。':!s.item?'已经认出江纹；还需要木作楼3F的导扣。':'双水波吻合。按下确认，才会转动门闩、开放通路。',
      svg:svg(card(16)+card(256)+text(120,53,s.item?'随身导扣':'随身物件')+token(120,s.item)+text(120,206,s.item?'两道水波':'尚未带来导扣')+text(360,53,'江纹栈门')+gate(360,s.unlocked)+text(360,206,s.unlocked?'已开路':ready?'纹样吻合':'双水波门扣'))};
  }
}
