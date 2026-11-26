import type { ExplorationMapDefinition, ExplorationTarget } from './exploration-content.ts';

// Footprints aligned with the painted warehouse, pavilion and planter.
const riverBuildings = [{x:934,y:350,w:944,h:361,name:'临岸木楼'},{x:2012,y:350,w:435,h:238,name:'江岸亭廊'}];
export const DISTRICT_MAPS:Readonly<Record<'riverfront',ExplorationMapDefinition>> = Object.freeze({
  riverfront:{name:'江湾渡口 · 临江石岸',width:2600,height:1500,outdoor:true,
    bounds:{x:60,y:350,w:2480,h:870},buildings:riverBuildings,
    walls:[...riverBuildings,{x:578,y:769,w:146,h:103},{x:60,y:350,w:107,h:722},{x:2455,y:350,w:85,h:380},
      {x:60,y:1076,w:2048,h:144},{x:2250,y:1076,w:290,h:144}]},
});
export const DISTRICT_SAFE = Object.freeze({
  middleEastUpper:{map:'middle',x:3000,y:450},middleWestUpper:{map:'middle',x:400,y:450},
  middleEastLower:{map:'middle',x:3000,y:1200},middleWestLower:{map:'middle',x:400,y:1200},
  riverArrival:{map:'riverfront',x:350,y:650},riverView:{map:'riverfront',x:1910,y:1050},
} as const);
export const DISTRICT_TARGETS:readonly ExplorationTarget[] = Object.freeze([
  {id:'riverfront-down',map:'lower',x:1950,y:1090,label:'沿江石阶到渡口',destination:'riverArrival',locked:true},
  {id:'riverfront-up',map:'riverfront',x:310,y:650,label:'沿阶道返回下层街巷',destination:'cLowerRiver',locked:true},
]);
