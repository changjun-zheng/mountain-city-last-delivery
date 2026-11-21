import {EXP_MAPS} from '../core/exploration-content';
export type Rect={x:number;y:number;w:number;h:number};
// 新烘焙底图 bg_world2.jpg（2200x1300）的可走区域：主街、矮台阶与观景台前沿。
// 旧 C 区墙体表与本图无关，置空以免产生看不见的碰撞。
export const MAP={...EXP_MAPS.upper,bounds:{x:120,y:560,w:1960,h:660}};
export const WALLS:Rect[]=[];
// 视觉包围盒与 tools/bake_scene.py 的 PLACEMENTS 对应；
// 但可拍主体只取「能完整进框」的一段（整栋楼被画幅裁掉两侧）。
const VISUAL:Record<string,Rect>={
 guide:{x:210,y:655,w:350,h:495},
 workshop:{x:1720,y:625,w:300,h:480},
 corridor:{x:610,y:300,w:260,h:225},
};
export const SITES=[
 {name:'左楼正面',x:560,y:1080,subject:VISUAL.guide,focalRatio:.235},
 {name:'右楼近景',x:1560,y:1080,subject:VISUAL.workshop,focalRatio:.235},
 {name:'观景台窗廊',x:740,y:640,subject:VISUAL.corridor,focalRatio:.235},
];
export const SAVE_KEY='pokan.photo-proto-2.album.v1';
export const RANKS=['未拍摄','铜','银','金'];
export const RANK_COLORS=['#8c9694','#c98b4b','#c9d2d8','#f0c96a'];
