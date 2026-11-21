import {BUILDING_FLOOR_MAPS,BUILDING_FLOOR_SAFE,BUILDING_FLOOR_TARGETS} from './exploration-building-floors.ts';
import {DISTRICT_MAPS,DISTRICT_SAFE,DISTRICT_TARGETS} from './exploration-district.ts';
import {C_MAPS,C_SAFE,C_TARGETS,C_BARRIERS} from './exploration-c-routes.ts';
import {PHOTO_CONTENT_VERSION} from './exploration-photo.ts';
import {PROLOGUE_MAPS,PROLOGUE_SAFE,PROLOGUE_TARGETS} from './exploration-prologue.ts';
import {MEMENTO_TARGETS} from './exploration-mementos.ts';
export type ExplorationMap = 'market'|'lantern'|'guide2'|'workshop2'|'workshop3'|'upper'|'lower'|'middle'|'riverfront'|'guide'|'workshop'|'tea'|'plaza'|'entry'|'service';
export type Rect = Readonly<{x:number;y:number;w:number;h:number}>;
export type Point = Readonly<{x:number;y:number}>;
export type TargetId = 'visitor'|'guide-door'|'workshop-door'|'tea-door'|'note'|'plaque'|'guide-exit'|'workshop-exit'|'tea-exit'|'gate'|'wrong-gate'|'east-down'|'east-up'|'west-down'|'west-up'|'view'|'tea-observe'|'window'|'street-sign'|'photo-eaves'|
  'city-monument'|'city-sign'|'service-door'|'service-exit'|'service-guide'|'city-to-entry'|'entry-to-city'|'entry-to-core'|'core-to-entry'|'entry-view'|'memento-bookmark'|'memento-sketch'|'memento-postcard'|'middle-east-upper'|'middle-west-upper'|'middle-east-lower'|'middle-west-lower'|'middle-court'|'middle-outer'|'riverfront-down'|'riverfront-up'|'guide-up'|'guide-down'|'workshop-up-2'|'workshop-down-1'|'workshop-up-3'|'workshop-down-2'|'building-floor-sign'|'building-tool-pattern'|'building-wrong-box'|
  'guide-upper-exit'|'guide-middle-door'|'workshop-upper-door'|'workshop-upper-exit'|'workshop-middle-door'|'workshop-middle-exit'|'market-west-door'|'market-west-exit'|'market-east-door'|'market-east-exit'|'lantern-door'|'lantern-exit';
export const EXP02A_CONTENT_VERSION='exp02a-core-district-1';
export const EXP02B_CONTENT_VERSION=PHOTO_CONTENT_VERSION;
export const EXP02C_CONTENT_VERSION='exp02c-prologue-1';
export const EXP03B_CONTENT_VERSION='exp03b-city-mementos-1';
export const EXP05A_CONTENT_VERSION='exp05a-district-skeleton-1';
export const EXP05B_CONTENT_VERSION='exp05b-building-floors-1';
export const EXP_CONTENT_VERSION='exp06a-c-exploration-1';
export type Building = Rect & Readonly<{name:string;kind?:'guide'|'workshop'|'tea'|'market'|'city'|'service'}>;
export type ExplorationMapDefinition=Readonly<{name:string;width:number;height:number;bounds:Rect;buildings:readonly Building[];walls:readonly Rect[];outdoor:boolean}>;
// Kept as named compatibility exports for the historical renderer branch only.
export const EXP_GATE:Rect=C_BARRIERS.middle![1];
export const EXP_RIVER:Rect=Object.freeze({x:60,y:1160,w:2080,h:60});
export const EXP_MAPS:Readonly<Record<ExplorationMap,ExplorationMapDefinition>>=Object.freeze({
  ...C_MAPS,...PROLOGUE_MAPS,...DISTRICT_MAPS,...BUILDING_FLOOR_MAPS,
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
export const EXP_PRE05_SAFE=Object.freeze({...EXP_LEGACY_SAFE,...PROLOGUE_SAFE});
export const EXP05A_SAFE=Object.freeze({...EXP_PRE05_SAFE,...DISTRICT_SAFE});
export const EXP05B_SAFE=Object.freeze({...EXP05A_SAFE,
  guideStair1:{map:'guide',x:820,y:500},guideStair2:{map:'guide2',x:300,y:700},
  workshopStair1:{map:'workshop',x:250,y:500},workshopStair2Down:{map:'workshop2',x:250,y:700},
  workshopStair2Up:{map:'workshop2',x:1080,y:700},workshopStair3:{map:'workshop3',x:250,y:700},
} as const);
// The historical snapshots above are deliberately independent of current C.
const {coreFromEntry:_oldCore,...stablePrologueSafe}=PROLOGUE_SAFE;
export const EXP_SAFE=Object.freeze({...stablePrologueSafe,
  riverArrival:DISTRICT_SAFE.riverArrival,riverView:DISTRICT_SAFE.riverView,
  ...C_SAFE,...BUILDING_FLOOR_SAFE});
export type SafeId=keyof typeof EXP_SAFE;
export type ExplorationTarget=Point & Readonly<{id:TargetId;map:ExplorationMap;label:string;destination?:SafeId;locked?:boolean}>;
export const EXP_TARGETS:readonly ExplorationTarget[]=Object.freeze([
  {id:'visitor',map:'entry',x:1100,y:800,label:'与年轻游客交谈'},
  {id:'view',map:'riverfront',x:1950,y:1050,label:'调查江边开阔面'},
  ...C_TARGETS,...PROLOGUE_TARGETS,...MEMENTO_TARGETS,...DISTRICT_TARGETS,...BUILDING_FLOOR_TARGETS,
].map(t=>Object.freeze(t)) as readonly ExplorationTarget[]);
export function explorationWalls(map:ExplorationMap,unlocked:boolean):readonly Rect[]{
  const barriers=C_BARRIERS[map as keyof typeof C_BARRIERS];
  return !unlocked&&barriers?[...EXP_MAPS[map].walls,...barriers]:EXP_MAPS[map].walls;
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
