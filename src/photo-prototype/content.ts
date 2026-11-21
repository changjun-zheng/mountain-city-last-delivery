import {EXP_MAPS} from '../core/exploration-content';
export type Rect={x:number;y:number;w:number;h:number};
export type Site={name:string;x:number;y:number;subject:Rect;focalRatio:number};
export type Building={wx:number;wy:number;w:number;h:number;key:string;flip?:boolean};
export type AreaExit={x:number;y:number;to:number;label:string;spawnX:number;spawnY:number};
export type Area={
 bounds:Rect;walls:Rect[];sites:Site[];buildings:Building[];
 ground:{kind:'stone'|'street';from:number;to:number};
 exit:AreaExit;hasCars:boolean;hasRiver:boolean;npc:{x:number;y:number}|null;door:{x:number;y:number}|null;
};
export const MAP={...EXP_MAPS.upper,width:2200,height:1300};

// Area 0: Hongyadong terrace — river, teahouse, wood workshop, gate.
const TERRACE:Area={
 bounds:{x:110,y:640,w:1980,h:620},
 walls:[{x:120,y:470,w:280,h:560},{x:1780,y:670,w:240,h:420},{x:820,y:520,w:320,h:180}],
 buildings:[
  {wx:260,wy:1030,w:280,h:560,key:'photo-tea'},
  {wx:1900,wy:1090,w:240,h:420,key:'photo-shop'},
  {wx:980,wy:700,w:260,h:190,key:'photo-gate'},
 ],
 sites:[
  {name:'茶馆正面',x:620,y:1110,subject:{x:280,y:530,w:280,h:460},focalRatio:.235},
  {name:'木作近景',x:1700,y:1140,subject:{x:1780,y:670,w:240,h:420},focalRatio:.235},
  {name:'牌坊与江景',x:1150,y:880,subject:{x:810,y:500,w:340,h:280},focalRatio:.235},
 ],
 ground:{kind:'stone',from:620,to:1300},
 exit:{x:2050,y:1150,to:1,label:'→ 沧白路街道',spawnX:240,spawnY:1040},
 hasCars:false,hasRiver:true,npc:{x:760,y:980},door:{x:300,y:1030},
};

// Area 1: Cangbai Road — shopfronts on top, traffic in the middle, sidewalk nearest.
const STREET:Area={
 bounds:{x:100,y:920,w:2000,h:340},
 walls:[
  {x:120,y:320,w:300,h:320},{x:520,y:340,w:300,h:300},{x:980,y:330,w:360,h:310},{x:1580,y:320,w:340,h:320},
  {x:0,y:610,w:2200,h:300},
 ],
 buildings:[
  {wx:270,wy:640,w:300,h:320,key:'photo-tea'},
  {wx:670,wy:640,w:300,h:300,key:'photo-shop'},
  {wx:1160,wy:640,w:360,h:310,key:'photo-tea',flip:true},
  {wx:1750,wy:640,w:340,h:320,key:'photo-gate'},
 ],
 sites:[
  {name:'沿街铺面',x:640,y:960,subject:{x:180,y:300,w:420,h:340},focalRatio:.235},
  {name:'车流街口',x:1300,y:960,subject:{x:1060,y:310,w:440,h:330},focalRatio:.235},
  {name:'街尾牌坊',x:1720,y:960,subject:{x:1590,y:300,w:400,h:340},focalRatio:.235},
 ],
 ground:{kind:'street',from:160,to:1300},
 exit:{x:150,y:940,to:0,label:'← 回观景台',spawnX:1700,spawnY:1180},
 hasCars:true,hasRiver:false,npc:null,door:null,
};
export const AREAS=[TERRACE,STREET];
export const SAVE_KEY='pokan.photo-proto-2.album.v2';
export const RANKS=['未拍摄','铜','银','金'];
export const RANK_COLORS=['#8c9694','#c98b4b','#c9d2d8','#f0c96a'];
