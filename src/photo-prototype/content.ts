export type Rect={x:number;y:number;w:number;h:number};
export type Site={name:string;x:number;y:number;subject:Rect;focalRatio:number};
export type AreaExit={x:number;y:number;to:number;label:string;spawnX:number;spawnY:number};
export type Area={
 bounds:Rect;walls:Rect[];sites:Site[];plate:string;
 exit:AreaExit;hasCars:boolean;npc:{x:number;y:number}|null;door:{x:number;y:number}|null;
};
// One whole-plate illustration per area (1998x1180). Lighting and scale are baked in the image,
// so the scene no longer assembles ground, buildings and props separately.
export const MAP={width:1998,height:1180};

const TERRACE:Area={
 bounds:{x:520,y:700,w:900,h:420},
 walls:[{x:0,y:380,w:470,h:640},{x:1460,y:420,w:538,h:600}],
 plate:'photo-plate0',
 sites:[
  {name:'茶馆正面',x:680,y:990,subject:{x:60,y:330,w:380,h:400},focalRatio:.235},
  {name:'木作近景',x:1560,y:1010,subject:{x:1480,y:430,w:440,h:380},focalRatio:.235},
  {name:'江景栏杆',x:1010,y:880,subject:{x:620,y:430,w:520,h:260},focalRatio:.235},
 ],
 exit:{x:1350,y:1100,to:1,label:'→ 沧白路街道',spawnX:200,spawnY:960},
 hasCars:false,npc:{x:800,y:860},door:{x:228,y:686},
};

const STREET:Area={
 bounds:{x:100,y:900,w:1800,h:240},
 walls:[{x:0,y:640,w:1998,h:260}],
 plate:'photo-plate1',
 sites:[
  {name:'沿街铺面',x:680,y:960,subject:{x:120,y:420,w:500,h:340},focalRatio:.235},
  {name:'车流街口',x:1200,y:960,subject:{x:700,y:440,w:560,h:320},focalRatio:.235},
  {name:'街尾牌坊',x:1720,y:960,subject:{x:1600,y:400,w:380,h:380},focalRatio:.235},
 ],
 exit:{x:120,y:960,to:0,label:'← 回观景台',spawnX:1300,spawnY:1060},
 hasCars:true,npc:null,door:null,
};
export const AREAS=[TERRACE,STREET];
export const SAVE_KEY='pokan.photo-proto-2.album.v2';
export const RANKS=['未拍摄','铜','银','金'];
export const RANK_COLORS=['#8c9694','#c98b4b','#c9d2d8','#f0c96a'];
