export type ExplorationMap = 'upper' | 'lower' | 'guide' | 'workshop' | 'tea' | 'plaza' | 'entry' | 'service';
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Point = Readonly<{ x: number; y: number }>;
export type TargetId = 'visitor' | 'guide-door' | 'workshop-door' | 'tea-door' | 'note' | 'plaque' |
  'guide-exit' | 'workshop-exit' | 'tea-exit' | 'gate' | 'wrong-gate' | 'east-down' | 'east-up' |
  'west-down' | 'west-up' | 'view' | 'tea-observe' | 'window' | 'street-sign' | 'photo-eaves' |
  'city-monument'|'city-sign'|'service-door'|'service-exit'|'service-guide'|'city-to-entry'|'entry-to-city'|'entry-to-core'|'core-to-entry'|'entry-view'|'memento-bookmark'|'memento-sketch'|'memento-postcard';
import {PHOTO_CONTENT_VERSION} from './exploration-photo.ts';
import {PROLOGUE_MAPS,PROLOGUE_SAFE,PROLOGUE_TARGETS} from './exploration-prologue.ts';
import {MEMENTO_TARGETS} from './exploration-mementos.ts';
export const EXP02A_CONTENT_VERSION = 'exp02a-core-district-1';
export const EXP02B_CONTENT_VERSION = PHOTO_CONTENT_VERSION;
export const EXP02C_CONTENT_VERSION = 'exp02c-prologue-1';
export const EXP_CONTENT_VERSION = 'exp03b-city-mementos-1';
export type Building = Rect & Readonly<{ name: string; kind?: 'guide' | 'workshop' | 'tea' | 'market' | 'city' | 'service' }>;
export type ExplorationMapDefinition = Readonly<{
  name: string; width: number; height: number; bounds: Rect;
  buildings: readonly Building[]; walls: readonly Rect[]; outdoor: boolean;
}>;
const upperBuildings: readonly Building[] = [
  { x:120,y:300,w:300,h:180,name:'檐下杂铺' },
  { x:700,y:330,w:360,h:200,name:'临江导览',kind:'guide' },
  { x:1250,y:330,w:420,h:190,name:'木廊市集',kind:'market' },
  { x:2120,y:330,w:360,h:200,name:'木作间',kind:'workshop' },
  { x:2900,y:300,w:270,h:180,name:'东栈小亭' },
  { x:1200,y:720,w:320,h:220,name:'旧窗铺' },
  { x:1500,y:940,w:320,h:170,name:'檐下茶歇',kind:'tea' },
  { x:2050,y:900,w:420,h:180,name:'木器铺',kind:'market' },
  { x:120,y:930,w:220,h:160,name:'西口雨棚' },
  { x:650,y:830,w:240,h:120,name:'街边摊',kind:'market' },
];
const lowerBuildings: readonly Building[] = [
  { x:140,y:310,w:290,h:190,name:'下街小铺' },
  { x:700,y:400,w:380,h:190,name:'花窗长廊' },
  { x:1650,y:400,w:400,h:190,name:'灯笼铺',kind:'market' },
  { x:2460,y:310,w:300,h:200,name:'东阶门楼' },
  { x:1200,y:780,w:430,h:200,name:'望江木楼' },
  { x:600,y:790,w:280,h:160,name:'竹椅铺' },
  { x:2320,y:750,w:380,h:190,name:'晾晒廊' },
];
export const EXP_GATE: Rect = Object.freeze({ x:2750,y:690,w:40,h:120 });
export const EXP_RIVER: Rect = Object.freeze({ x:1830,y:990,w:1410,h:250 });
export const EXP_MAPS: Readonly<Record<ExplorationMap, ExplorationMapDefinition>> = Object.freeze({
  upper: { name:'洪崖洞主题 · 上层木廊',width:3300,height:1300,outdoor:true,
    bounds:{x:60,y:240,w:3180,h:1000},buildings:upperBuildings,
    walls:[...upperBuildings,{x:2750,y:240,w:40,h:450},{x:2750,y:810,w:40,h:430}] },
  lower: { name:'洪崖洞主题 · 下层生活街巷',width:3300,height:1300,outdoor:true,
    bounds:{x:60,y:240,w:3180,h:1000},buildings:lowerBuildings,walls:[...lowerBuildings,EXP_RIVER] },
  guide: { name:'临江导览小店',width:1100,height:650,outdoor:false,
    bounds:{x:180,y:220,w:740,h:380},buildings:[],
    walls:[{x:440,y:320,w:200,h:70},{x:300,y:260,w:80,h:35}] },
  workshop: { name:'木作间',width:1100,height:650,outdoor:false,
    bounds:{x:130,y:210,w:840,h:390},buildings:[],
    walls:[{x:400,y:320,w:240,h:90},{x:770,y:250,w:130,h:80},{x:730,y:360,w:60,h:30},
      // Thin tool screen also supplies a real line-of-sight regression case.
      {x:700,y:365,w:12,h:100}] },
  tea: { name:'檐下茶歇',width:1100,height:650,outdoor:false,
    bounds:{x:180,y:240,w:740,h:360},buildings:[],
    walls:[{x:340,y:370,w:90,h:80},{x:630,y:370,w:90,h:80},{x:460,y:260,w:170,h:40}] },
  ...PROLOGUE_MAPS,
});
export const EXP_LEGACY_SAFE = Object.freeze({
  arrival: { map:'upper',x:230,y:690 },
  guideDoor: { map:'upper',x:880,y:580 },
  guideRoom: { map:'guide',x:540,y:540 },
  workshopDoor: { map:'upper',x:2300,y:580 },
  workshopRoom: { map:'workshop',x:540,y:540 },
  teaDoor: { map:'upper',x:1660,y:1160 },
  teaRoom: { map:'tea',x:540,y:540 },
  eastUpper: { map:'upper',x:3060,y:750 },
  eastLower: { map:'lower',x:2960,y:650 },
  westUpper: { map:'upper',x:540,y:1150 },
  westLower: { map:'lower',x:430,y:1030 },
  overlook: { map:'lower',x:1660,y:1120 },
} as const);
export const EXP_SAFE=Object.freeze({...EXP_LEGACY_SAFE,...PROLOGUE_SAFE});
export type SafeId = keyof typeof EXP_SAFE;
export type ExplorationTarget = Point & Readonly<{id:TargetId;map:ExplorationMap;label:string;destination?:SafeId;locked?:boolean}>;
export const EXP_TARGETS: readonly ExplorationTarget[] = Object.freeze([
  {id:'visitor',map:'entry',x:1100,y:800,label:'与年轻游客交谈'},
  {id:'guide-door',map:'upper',x:880,y:550,label:'进入导览小店',destination:'guideRoom'},
  {id:'workshop-door',map:'upper',x:2300,y:550,label:'进入木作间',destination:'workshopRoom'},
  {id:'tea-door',map:'upper',x:1660,y:1130,label:'进入茶歇',destination:'teaRoom'},
  {id:'guide-exit',map:'guide',x:540,y:570,label:'返回导览门口',destination:'guideDoor'},
  {id:'workshop-exit',map:'workshop',x:540,y:570,label:'返回木作间门口',destination:'workshopDoor'},
  {id:'tea-exit',map:'tea',x:540,y:570,label:'返回茶歇门口',destination:'teaDoor'},
  {id:'note',map:'guide',x:340,y:320,label:'阅读楼层与纹样导览'},
  {id:'plaque',map:'workshop',x:760,y:415,label:'查看江纹导扣'},
  {id:'tea-observe',map:'tea',x:545,y:325,label:'看看茶桌与竹椅'},
  {id:'gate',map:'upper',x:2710,y:750,label:'核对江纹栈门'},
  {id:'wrong-gate',map:'upper',x:110,y:850,label:'查看山纹杂物门'},
  {id:'east-down',map:'upper',x:3060,y:750,label:'沿东侧木阶下楼',destination:'eastLower',locked:true},
  {id:'east-up',map:'lower',x:3000,y:650,label:'沿东侧木阶上楼',destination:'eastUpper',locked:true},
  {id:'west-down',map:'upper',x:540,y:1190,label:'打开西回廊短连接',destination:'westLower',locked:true},
  {id:'west-up',map:'lower',x:430,y:1080,label:'沿西回廊回上层',destination:'westUpper',locked:true},
  {id:'view',map:'lower',x:1700,y:1130,label:'调查江边开阔面'},
  {id:'window',map:'lower',x:900,y:650,label:'调查花窗视野'},
  {id:'photo-eaves',map:'lower',x:2180,y:680,label:'调查檐下视野'},
  {id:'street-sign',map:'upper',x:1120,y:650,label:'看看岔口路牌'},
  ...PROLOGUE_TARGETS,
  ...MEMENTO_TARGETS,
].map(t=>Object.freeze(t)) as readonly ExplorationTarget[]);

// Closed, data-only connections; no generic map loader or behavior registry.
export function explorationWalls(map: ExplorationMap, unlocked: boolean): readonly Rect[] {
  return map==='upper'&&!unlocked?[...EXP_MAPS[map].walls,EXP_GATE]:EXP_MAPS[map].walls;
}
export function segmentHitsRect(a:Point,b:Point,r:Rect):boolean {
  let near=0,far=1;
  for(const [start,delta,min,max] of [[a.x,b.x-a.x,r.x,r.x+r.w],[a.y,b.y-a.y,r.y,r.y+r.h]]){
    if(Math.abs(delta)<1e-9){if(start>min&&start<max)continue;return false;}
    const t1=(min-start)/delta,t2=(max-start)/delta;
    near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
    if(near>=far)return false;
  }
  return far>0&&near<1;
}
