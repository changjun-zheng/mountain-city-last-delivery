import type { ExplorationMapDefinition, ExplorationTarget } from './exploration-content.ts';

// Finite trial geometry. Courtyard and waterfront walls are the walking blockers.
const riverBuildings = [{x:1050,y:360,w:700,h:390,name:'临岸木楼'},{x:2050,y:280,w:350,h:360,name:'江岸亭廊'}];
export const DISTRICT_WATER = Object.freeze({x:60,y:1150,w:2480,h:290});
export const DISTRICT_MAPS:Readonly<Record<'riverfront',ExplorationMapDefinition>> = Object.freeze({
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
  {id:'riverfront-down',map:'lower',x:1950,y:1090,label:'沿阶道前往独立江岸',destination:'riverArrival',locked:true},
  {id:'riverfront-up',map:'riverfront',x:310,y:650,label:'沿阶道返回下层街巷',destination:'cLowerRiver',locked:true},
]);
