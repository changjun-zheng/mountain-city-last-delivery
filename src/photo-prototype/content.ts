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
// One whole-plate illustration per area (1998x1180), painted in the flat orthographic
// map style: square stone joints, roofs seen from above plus one storey of facade.
export const MAP={width:1998,height:1180};

const TERRACE:Area={
 bounds:{x:600,y:560,w:800,h:590},
 walls:[{x:0,y:150,w:560,h:900},{x:1430,y:130,w:568,h:900},{x:540,y:450,w:920,h:110}],
 plate:'photo-plate0',
 sites:[
  {name:'茶馆正面',x:660,y:1010,subject:{x:330,y:230,w:520,h:700},focalRatio:.235},
  {name:'木作近景',x:1400,y:1010,subject:{x:1290,y:230,w:620,h:700},focalRatio:.235},
  {name:'江景栏杆',x:1000,y:700,subject:{x:560,y:300,w:860,h:260},focalRatio:.235},
 ],
 exit:{x:1330,y:1110,to:1,label:'→ 沧白路街道',spawnX:200,spawnY:1000},
 hasCars:false,npc:{x:790,y:770},door:{x:706,y:716},charScale:1,
 indoor:{plate:'photo-roomTea',spawnX:1000,spawnY:1000,bounds:{x:420,y:520,w:1160,h:560},scale:1.6,focus:{x:700,y:700,label:'灶台边看看'}},
};

// Street plate: both cabs are painted in, so their footprints are solid obstacles.
const STREET:Area={
 bounds:{x:150,y:930,w:1700,h:210},
 walls:[{x:238,y:735,w:525,h:180},{x:954,y:780,w:429,h:200},{x:1600,y:150,w:398,h:520}],
 plate:'photo-plate1',
 sites:[
  {name:'沿街铺面',x:820,y:700,subject:{x:600,y:250,w:520,h:400},focalRatio:.235},
  {name:'车流街口',x:1120,y:860,subject:{x:950,y:620,w:440,h:300},focalRatio:.235},
  {name:'街尾牌坊',x:1700,y:900,subject:{x:1600,y:150,w:400,h:520},focalRatio:.235},
 ],
 exit:{x:170,y:1010,to:0,label:'← 回观景台',spawnX:1300,spawnY:1060},
 hasCars:false,npc:null,door:{x:820,y:700},charScale:1,
 indoor:{plate:'photo-roomShop',spawnX:1000,spawnY:1000,bounds:{x:420,y:520,w:1160,h:560},scale:1.6,focus:{x:900,y:640,label:'工具架前看看'}},
};
export const AREAS=[TERRACE,STREET];
export const SAVE_KEY='pokan.photo-proto-2.album.v2';
export const RANKS=['未拍摄','铜','银','金'];
export const RANK_COLORS=['#8c9694','#c98b4b','#c9d2d8','#f0c96a'];
