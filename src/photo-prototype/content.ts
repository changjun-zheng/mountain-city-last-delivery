import {EXP_MAPS,explorationWalls} from '../core/exploration-content';
export type Rect={x:number;y:number;w:number;h:number};
// Read-only geometry: no cloned wall table, world mutation or exploration runtime.
export const MAP=EXP_MAPS.upper;
export const WALLS=explorationWalls('upper',false);
const guide=MAP.buildings.find(b=>b.kind==='guide')!;
const workshop=MAP.buildings.find(b=>b.kind==='workshop')!;
export const SITES=[
 {name:'导览楼正面',x:710,y:680,subject:guide,focalRatio:.288},
 {name:'木作楼近景',x:1620,y:680,subject:workshop,focalRatio:.326},
 {name:'双楼宽景',x:1160,y:780,subject:{x:guide.x,y:Math.min(guide.y,workshop.y),w:workshop.x+workshop.w-guide.x,h:workshop.y+workshop.h-guide.y},focalRatio:.184},
];
export const SAVE_KEY='pokan.photo-proto-2.album.v1';
export const RANKS=['未拍摄','铜','银','金'];
export const RANK_COLORS=['#8c9694','#c98b4b','#c9d2d8','#f0c96a'];
