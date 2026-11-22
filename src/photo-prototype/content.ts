export type Rect={x:number;y:number;w:number;h:number};
export type Site={name:string;x:number;y:number;subject:Rect;focalRatio:number};
export type AreaExit={x:number;y:number;to:number;label:string;spawnX:number;spawnY:number};
export type Indoor={plate:string;spawnX:number;spawnY:number;bounds:Rect;scale:number;focus:{x:number;y:number;label:string}};
export type Area={
 bounds:Rect;walls:Rect[];sites:Site[];plate:string;
 exit:AreaExit;hasCars:boolean;npc:{x:number;y:number}|null;door:{x:number;y:number}|null;
 // Per-plate factor: each illustration was painted at its own depth compression,
 // so the visitor's world height is matched to that plate's doorway scale.
 charScale:number;indoor:Indoor|null;
};
// One whole-plate illustration per area (1998x1180). Lighting and scale are baked in the image,
// so the scene no longer assembles ground, buildings and props separately.
export const MAP={width:1998,height:1180};
export const INDOOR_BOUNDS:Rect={x:620,y:600,w:760,h:430};

const TERRACE:Area={
 bounds:{x:520,y:700,w:900,h:420},
 walls:[{x:0,y:380,w:470,h:640},{x:1460,y:420,w:538,h:600}],
 plate:'photo-plate0',
 sites:[
  {name:'茶馆正面',x:680,y:990,subject:{x:60,y:330,w:380,h:400},focalRatio:.235},
  {name:'木作近景',x:1560,y:1010,subject:{x:1480,y:430,w:440,h:380},focalRatio:.235},
  {name:'江景栏杆',x:1010,y:880,subject:{x:620,y:430,w:520,h:260},focalRatio:.235},
 ],
 exit:{x:1350,y:1100,to:1,label:'→ 沧白路街道',spawnX:240,spawnY:1000},
 hasCars:false,npc:{x:322,y:736},door:{x:228,y:686},charScale:1,
 indoor:{plate:'photo-roomTea',spawnX:1000,spawnY:930,bounds:INDOOR_BOUNDS,scale:2.2,focus:{x:760,y:880,label:'灶台边看看'}},
};

// Street plate: cabs are painted into the illustration, so the two parked spots
// are solid obstacles rather than moving sprites.
const STREET:Area={
 bounds:{x:220,y:610,w:1620,h:510},
 walls:[{x:1050,y:750,w:360,h:130},{x:1620,y:640,w:270,h:90}],
 plate:'photo-plate1',
 sites:[
  {name:'沿街铺面',x:780,y:660,subject:{x:700,y:200,w:480,h:430},focalRatio:.235},
  {name:'车流街口',x:1350,y:680,subject:{x:1000,y:630,w:520,h:250},focalRatio:.235},
  {name:'街尾牌坊',x:1800,y:690,subject:{x:1790,y:330,w:200,h:330},focalRatio:.235},
 ],
 exit:{x:240,y:660,to:0,label:'← 回观景台',spawnX:1300,spawnY:1060},
 hasCars:false,npc:null,door:{x:760,y:700},charScale:1,
 indoor:{plate:'photo-roomShop',spawnX:1000,spawnY:930,bounds:INDOOR_BOUNDS,scale:2.2,focus:{x:1180,y:740,label:'工具架前看看'}},
};
export const AREAS=[TERRACE,STREET];
export const SAVE_KEY='pokan.photo-proto-2.album.v2';
export const RANKS=['未拍摄','铜','银','金'];
export const RANK_COLORS=['#8c9694','#c98b4b','#c9d2d8','#f0c96a'];
