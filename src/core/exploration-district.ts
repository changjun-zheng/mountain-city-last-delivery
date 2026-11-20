import type { ExplorationMapDefinition, ExplorationTarget } from './exploration-content.ts';

// Finite trial geometry. Courtyard and waterfront walls are the walking blockers.
const middleBuildings = [
  {x:750,y:260,w:600,h:140,name:'北檐木楼'},
  {x:1750,y:260,w:700,h:140,name:'东檐木楼'},
  {x:1100,y:600,w:900,h:350,name:'围合内院'},
  {x:600,y:1190,w:500,h:190,name:'外缘木楼'},
  {x:2100,y:1190,w:500,h:190,name:'南檐木楼'},
];
const riverBuildings = [{x:1050,y:360,w:700,h:390,name:'临岸木楼'},{x:2050,y:280,w:350,h:360,name:'江岸亭廊'}];
export const DISTRICT_WATER = Object.freeze({x:60,y:1150,w:2480,h:290});
export const DISTRICT_MAPS:Readonly<Record<'middle'|'riverfront',ExplorationMapDefinition>> = Object.freeze({
  middle:{name:'洪崖洞主题 · 中层内院与外廊',width:3300,height:1500,outdoor:true,
    bounds:{x:60,y:240,w:3180,h:1200},buildings:middleBuildings,
    walls:[...middleBuildings,{x:700,y:650,w:100,h:250},{x:2400,y:700,w:100,h:300}]},
  riverfront:{name:'嘉陵江岸主题 · 独立步道',width:2600,height:1500,outdoor:true,
    bounds:{x:60,y:240,w:2480,h:1200},buildings:riverBuildings,
    walls:[...riverBuildings,DISTRICT_WATER,{x:60,y:1130,w:2480,h:20},{x:600,y:800,w:100,h:120}]},
});
export const DISTRICT_SAFE = Object.freeze({
  middleEastUpper:{map:'middle',x:3000,y:450},middleWestUpper:{map:'middle',x:400,y:450},
  middleEastLower:{map:'middle',x:3000,y:1200},middleWestLower:{map:'middle',x:400,y:1200},
  riverArrival:{map:'riverfront',x:350,y:650},riverView:{map:'riverfront',x:1910,y:1050},
} as const);
export const DISTRICT_TARGETS:readonly ExplorationTarget[] = Object.freeze([
  {id:'middle-east-upper',map:'middle',x:3000,y:410,label:'东阶返回上层',destination:'eastUpper',locked:true},
  {id:'middle-west-upper',map:'middle',x:400,y:410,label:'西阶返回上层',destination:'westUpper',locked:true},
  {id:'middle-east-lower',map:'middle',x:3000,y:1250,label:'东阶前往下层',destination:'eastLower',locked:true},
  {id:'middle-west-lower',map:'middle',x:400,y:1250,label:'西阶前往下层',destination:'westLower',locked:true},
  {id:'middle-court',map:'middle',x:1000,y:520,label:'观察内院与内廊'},
  {id:'middle-outer',map:'middle',x:2200,y:1080,label:'观察外廊去向'},
  {id:'riverfront-down',map:'lower',x:1700,y:1130,label:'沿阶道前往独立江岸',destination:'riverArrival',locked:true},
  {id:'riverfront-up',map:'riverfront',x:310,y:650,label:'沿阶道返回下层街巷',destination:'overlook',locked:true},
]);
