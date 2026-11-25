import type {ExplorationMapDefinition, ExplorationTarget, Rect} from './exploration-content.ts';

// EXP-06A finite C layouts. A visible lower facade is scenery behind a real
// retaining wall: each active map still has exactly one walkable foot plane.
const guide={x:500,y:260,w:420,h:260,name:'临江导览楼',kind:'guide'} as const;
const wood={x:1420,y:280,w:400,h:260,name:'木作楼',kind:'workshop'} as const;
const upperBuildings=[guide,wood,{x:980,y:260,w:250,h:180,name:'封闭窗廊'}];
const middleBuildings=[{...guide,y:140,h:380},{...wood,y:160,h:380},{x:850,y:650,w:400,h:220,name:'木廊市集',kind:'market' as const}];
const lowerBuildings=[{...wood,y:80,h:460},{x:500,y:280,w:360,h:260,name:'檐下茶歇',kind:'tea' as const},
  {x:950,y:780,w:360,h:180,name:'灯笼铺',kind:'market' as const}];
const street=(name:string,buildings:ExplorationMapDefinition['buildings'],extra:readonly Rect[]):ExplorationMapDefinition=>({
  name,width:2200,height:1300,outdoor:true,bounds:{x:60,y:220,w:2080,h:1000},buildings,walls:[...buildings,...extra],
});
// Two coordinate views of the same west staircase. Y increases downhill in
// both views; the same section of stair crosses the map seam at these depths.
export const WEST_STREET_JOIN = {
  x: 250, halfWidth: 48,
  upperY: 990, middleY: 410,
  down: 'west-down', up: 'middle-west-upper',
  middleSafe: 'cMiddleWest', upperSafe: 'cUpperWest',
} as const;
export const UPPER_EAST_STAIR_X = 2000;
export const UPPER_STREET_EDGE_Y = 800;
export const UPPER_STAIR_LANDING_Y = 880;
export const UPPER_STAIR_END_Y = 1040;
export const UPPER_STAIR_RAIL_HALF_WIDTH = 60;
export const UPPER_SHOP_DISPLAYS = [
  {x:1105,y:503,w:66,h:23},
  {x:1757,y:534,w:66,h:17},
] as const;
// Two stair cuts in the same bank. The ledge above the cuts still serves
// the west side door; the painted valley below the ledge is solid terrain.
const upperStairFlanks = [
  {x:60,w:WEST_STREET_JOIN.x-UPPER_STAIR_RAIL_HALF_WIDTH-60},
  {x:WEST_STREET_JOIN.x+UPPER_STAIR_RAIL_HALF_WIDTH,w:420-WEST_STREET_JOIN.x-UPPER_STAIR_RAIL_HALF_WIDTH},
  {x:UPPER_EAST_STAIR_X+UPPER_STAIR_RAIL_HALF_WIDTH,w:2140-UPPER_EAST_STAIR_X-UPPER_STAIR_RAIL_HALF_WIDTH},
].map(r=>({...r,y:UPPER_STAIR_LANDING_Y,h:UPPER_STAIR_END_Y-UPPER_STAIR_LANDING_Y}));
export const C_MAPS=Object.freeze({
  upper:street('上街 · 屋檐与悬挑廊',upperBuildings,[
    {x:60,y:UPPER_STAIR_END_Y,w:2080,h:180},
    {x:420,y:UPPER_STREET_EDGE_Y,w:1520,h:UPPER_STAIR_END_Y-UPPER_STREET_EDGE_Y},
    ...upperStairFlanks,
    ...UPPER_SHOP_DISPLAYS,
  ]),
  middle:street('中街 · 穿楼院落与市集',middleBuildings,[{x:60,y:1080,w:130,h:140},{x:310,y:1080,w:1630,h:140},{x:2060,y:1080,w:80,h:140}]),
  lower:street('下街 · 吊脚支柱与生活檐廊',lowerBuildings,[{x:60,y:1160,w:2080,h:60},{x:1020,y:280,w:70,h:260},{x:1150,y:280,w:70,h:260}]),
  guide:{name:'临江导览楼 · 1F 中街接待',width:1100,height:650,outdoor:false,bounds:{x:180,y:220,w:740,h:380},buildings:[],walls:[{x:440,y:320,w:200,h:70},{x:300,y:260,w:80,h:35}]},
  workshop:{name:'木作楼 · 1F 下街工作台',width:1100,height:650,outdoor:false,bounds:{x:130,y:210,w:840,h:390},buildings:[],walls:[{x:400,y:320,w:240,h:90},{x:770,y:250,w:130,h:80},{x:730,y:360,w:60,h:30},{x:700,y:365,w:12,h:100}]},
  tea:{name:'檐下茶歇 · H1窗边',width:1100,height:650,outdoor:false,bounds:{x:180,y:240,w:740,h:360},buildings:[],walls:[{x:340,y:370,w:90,h:80},{x:630,y:370,w:90,h:80},{x:460,y:260,w:170,h:40}]},
  market:{name:'木廊市集 · H2穿行内间',width:1300,height:850,outdoor:false,bounds:{x:130,y:200,w:1040,h:570},buildings:[],walls:[{x:400,y:280,w:170,h:240},{x:770,y:280,w:200,h:200},{x:600,y:650,w:180,h:60}]},
  lantern:{name:'灯笼铺 · H1陈列与后窗',width:1300,height:850,outdoor:false,bounds:{x:130,y:200,w:1040,h:570},buildings:[],walls:[{x:400,y:300,w:170,h:250},{x:730,y:250,w:220,h:90},{x:770,y:480,w:250,h:70}]},
} satisfies Record<string,ExplorationMapDefinition>);
export const C_BARRIERS:Readonly<Partial<Record<'middle'|'workshop',readonly Rect[]>>>=Object.freeze({
  middle:[{x:190,y:1080,w:120,h:140},{x:1940,y:1080,w:120,h:140}],
  workshop:[{x:500,y:588,w:80,h:12}],
});
export const C_SAFE=Object.freeze({
  cArrival:{map:'upper',x:230,y:690},
  cGuideH3:{map:'upper',x:710,y:560},cGuide2Door:{map:'guide2',x:1100,y:700},
  cGuideH2:{map:'middle',x:710,y:560},cGuide1Door:{map:'guide',x:540,y:540},
  cWoodH3:{map:'upper',x:1620,y:570},cWood3Door:{map:'workshop3',x:1080,y:700},
  cWoodH2:{map:'middle',x:1620,y:570},cWood2Door:{map:'workshop2',x:1100,y:400},
  cWoodH1:{map:'lower',x:1620,y:570},cWood1Door:{map:'workshop',x:540,y:540},
  cTeaH1:{map:'lower',x:680,y:570},cTeaRoom:{map:'tea',x:540,y:540},
  cLanternH1:{map:'lower',x:1130,y:1010},cLanternRoom:{map:'lantern',x:250,y:650},
  cMarketWest:{map:'middle',x:810,y:740},cMarketWestRoom:{map:'market',x:220,y:600},
  cMarketEast:{map:'middle',x:1290,y:740},cMarketEastRoom:{map:'market',x:1080,y:600},
  cUpperWest:{map:'upper',x:250,y:950},cMiddleWest:{map:'middle',x:250,y:450},
  cUpperEast:{map:'upper',x:2000,y:950},cMiddleEast:{map:'middle',x:2000,y:450},
  cMiddleDownWest:{map:'middle',x:250,y:1010},cLowerWest:{map:'lower',x:250,y:650},
  cMiddleDownEast:{map:'middle',x:2000,y:1010},cLowerEast:{map:'lower',x:2000,y:650},
  cLowerRiver:{map:'lower',x:1950,y:1050},cMiddleGate:{map:'middle',x:1900,y:990},
} as const);

export const C_TARGETS:readonly ExplorationTarget[]=Object.freeze([
  {id:'guide-door',map:'upper',x:710,y:550,label:'进入导览楼2F',destination:'cGuide2Door'},
  {id:'guide-upper-exit',map:'guide2',x:1100,y:740,label:'从2F出上街',destination:'cGuideH3'},
  {id:'guide-middle-door',map:'middle',x:710,y:550,label:'进入导览楼1F',destination:'cGuide1Door'},
  {id:'guide-exit',map:'guide',x:540,y:570,label:'从1F出中街',destination:'cGuideH2'},
  {id:'workshop-upper-door',map:'upper',x:1620,y:550,label:'沿短连廊进入木作3F',destination:'cWood3Door'},
  {id:'workshop-upper-exit',map:'workshop3',x:1080,y:740,label:'从3F露台出上街',destination:'cWoodH3'},
  {id:'workshop-middle-door',map:'middle',x:1620,y:550,label:'进入木作楼2F',destination:'cWood2Door'},
  {id:'workshop-middle-exit',map:'workshop2',x:1140,y:400,label:'从2F出中街',destination:'cWoodH2'},
  {id:'workshop-door',map:'lower',x:1620,y:550,label:'进入木作楼1F',destination:'cWood1Door',locked:true},
  {id:'workshop-exit',map:'workshop',x:540,y:570,label:'从1F出下街 · 江纹封道联动',destination:'cWoodH1',locked:true},
  {id:'tea-door',map:'lower',x:680,y:550,label:'进入檐下茶歇',destination:'cTeaRoom',locked:true},
  {id:'tea-exit',map:'tea',x:540,y:570,label:'返回下街茶歇门口',destination:'cTeaH1',locked:true},
  {id:'lantern-door',map:'lower',x:1130,y:980,label:'进入灯笼铺',destination:'cLanternRoom',locked:true},
  {id:'lantern-exit',map:'lantern',x:220,y:600,label:'返回灯笼铺门口',destination:'cLanternH1',locked:true},
  {id:'market-west-door',map:'middle',x:810,y:700,label:'从西廊进入市集',destination:'cMarketWestRoom'},
  {id:'market-west-exit',map:'market',x:180,y:600,label:'出市集西廊',destination:'cMarketWest'},
  {id:'market-east-door',map:'middle',x:1290,y:700,label:'从东院进入市集',destination:'cMarketEastRoom'},
  {id:'market-east-exit',map:'market',x:1120,y:600,label:'出市集东院',destination:'cMarketEast'},
  {id:'east-down',map:'upper',x:2000,y:990,label:'沿东侧外阶到中街',destination:'cMiddleEast'},
  {id:'middle-east-upper',map:'middle',x:2000,y:410,label:'沿东侧外阶回上街',destination:'cUpperEast'},
  {id:'west-down',map:'upper',x:250,y:990,label:'沿西侧外阶到中街',destination:'cMiddleWest'},
  {id:'middle-west-upper',map:'middle',x:250,y:410,label:'沿西侧外阶回上街',destination:'cUpperWest'},
  {id:'middle-east-lower',map:'middle',x:2000,y:1050,label:'经江纹封道下东阶',destination:'cLowerEast',locked:true},
  {id:'east-up',map:'lower',x:2000,y:610,label:'沿东阶返回中街',destination:'cMiddleDownEast',locked:true},
  {id:'middle-west-lower',map:'middle',x:250,y:1050,label:'经联动封道下西阶',destination:'cLowerWest',locked:true},
  {id:'west-up',map:'lower',x:250,y:610,label:'沿西阶返回中街',destination:'cMiddleDownWest',locked:true},
  {id:'gate',map:'middle',x:1930,y:990,label:'核对江纹栈门'},
  {id:'wrong-gate',map:'upper',x:110,y:850,label:'查看山纹杂物门'},
  {id:'street-sign',map:'upper',x:1100,y:650,label:'看看屋檐街路牌'},
  {id:'middle-court',map:'middle',x:700,y:900,label:'回望导览楼与上街檐廊'},
  {id:'middle-outer',map:'middle',x:1350,y:950,label:'看看支柱下的下街'},
  {id:'tea-observe',map:'tea',x:545,y:325,label:'看看茶桌与竹椅'},
  {id:'window',map:'tea',x:800,y:330,label:'调查茶歇后窗视野'},
  {id:'photo-eaves',map:'lower',x:1350,y:1050,label:'调查檐下视野'},
  {id:'note',map:'guide2',x:950,y:350,label:'阅读楼层与纹样导览'},
  {id:'plaque',map:'workshop3',x:742,y:415,label:'查看江纹导扣'},
]);

// Explicit semantic relocation, applied only AFTER the historical profile passes.
export const C_OLD_SAFE_MAP=Object.freeze({arrival:'cArrival',guideDoor:'cGuideH3',guideRoom:'cGuide1Door',workshopDoor:'cWoodH3',workshopRoom:'cWood1Door',teaDoor:'cTeaH1',teaRoom:'cTeaRoom',eastUpper:'cUpperEast',eastLower:'cLowerEast',westUpper:'cUpperWest',westLower:'cLowerWest',overlook:'cLowerRiver',coreFromEntry:'cArrival',middleEastUpper:'cMiddleEast',middleWestUpper:'cMiddleWest',middleEastLower:'cMiddleDownEast',middleWestLower:'cMiddleDownWest',guideStair1:'cGuideStair1',guideStair2:'cGuideStair2',workshopStair1:'cWoodStair1',workshopStair2Down:'cWoodStair2Down',workshopStair2Up:'cWoodStair2Up',workshopStair3:'cWoodStair3'} as const);
