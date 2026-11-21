import {EXP_MAPS} from '../core/exploration-content';
export type Rect={x:number;y:number;w:number;h:number};
// Rebuilt plate is 2200x1300: Yuzhong skyline + Jialing river (0..620),
// walkable stone street (620..1300). Bounds keep the visitor on the street.
export const MAP={...EXP_MAPS.upper,width:2200,height:1300,bounds:{x:110,y:640,w:1980,h:620}};
// Footprints of the three buildings block walking through their frontage.
export const WALLS:Rect[]=[
 {x:120,y:470,w:280,h:560},
 {x:1780,y:670,w:240,h:420},
 {x:820,y:520,w:320,h:180},
];
// Photographable subject rects follow the same table as the buildings.
const VISUAL:Record<string,Rect>={
 guide:{x:280,y:530,w:280,h:460},
 workshop:{x:1780,y:670,w:240,h:420},
 corridor:{x:810,y:500,w:340,h:280},
};
export const SITES=[
 {name:'茶馆正面',x:620,y:1110,subject:VISUAL.guide,focalRatio:.235},
 {name:'木作近景',x:1700,y:1140,subject:VISUAL.workshop,focalRatio:.235},
 {name:'牌坊与江景',x:1150,y:880,subject:VISUAL.corridor,focalRatio:.235},
];
export const SAVE_KEY='pokan.photo-proto-2.album.v1';
export const RANKS=['未拍摄','铜','银','金'];
export const RANK_COLORS=['#8c9694','#c98b4b','#c9d2d8','#f0c96a'];
