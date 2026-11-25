import type {ExplorationMapDefinition, ExplorationTarget} from './exploration-content.ts';

export const FERRY_TRAVEL_MS = 4300;
export const RIDGE_PIER_X = 720;
export const RIVER_PIER_X = 2180;
export const FERRY_SAFE = {
  riverDock:{map:'riverfront',x:RIVER_PIER_X,y:1119},
  ridgeDock:{map:'ridge',x:RIDGE_PIER_X,y:796},
  ridgeLookout:{map:'ridge',x:474,y:220},
} as const;

export const FERRY_TARGETS: readonly ExplorationTarget[] = [
  {id:'ferry-out',map:'riverfront',x:RIVER_PIER_X,y:1148,label:'询问去照水岭的渡船'},
  {id:'ferry-back',map:'ridge',x:RIDGE_PIER_X,y:810,label:'乘渡船返回城里'},
  {id:'ridge-lookout',map:'ridge',x:468,y:209,label:'在古树台回望两岸'},
];

// Narrow bands lie inside the painted tread and landings. The pier also has
// its own narrow footprint so the player never steps into the river.
const trailWidths = [
  [184,243,389,558], [243,267,432,585], [267,295,485,635],
  [295,325,530,689], [325,357,559,756], [357,414,581,793],
  [414,484,552,852], [484,667,564,853], [667,711,550,879],
  [711,757,470,931], [757,840,665,777],
] as const;
export const RIDGE_MAP: ExplorationMapDefinition = {
  name:'照水岭 · 林间步道',width:1440,height:960,outdoor:true,
  bounds:{x:350,y:184,w:600,h:656},buildings:[],
  walls:trailWidths.flatMap(([top,bottom,left,right])=>[
    {x:350,y:top,w:left-350,h:bottom-top},{x:right,y:top,w:950-right,h:bottom-top},
  ]),
};
