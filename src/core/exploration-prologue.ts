import type {Building,ExplorationMapDefinition,ExplorationTarget,Rect} from './exploration-content.ts';

// Three finite additions, not a general map catalog. All values are trial layout.
export const PROLOGUE_MONUMENT:Rect=Object.freeze({x:650,y:850,w:180,h:110});
const cityBuildings:readonly Building[]=[
  {x:120,y:500,w:300,h:280,name:'城市书店',kind:'city'},
  {x:1100,y:330,w:300,h:200,name:'游客服务',kind:'service'},
  {x:1700,y:250,w:430,h:320,name:'城市商廊',kind:'city'},
  {x:2320,y:290,w:500,h:280,name:'步行街商店',kind:'city'},
  {x:1600,y:1000,w:450,h:260,name:'街角橱窗',kind:'city'},
  {x:2300,y:1010,w:400,h:230,name:'沿街小店',kind:'city'},
  {x:2910,y:280,w:250,h:250,name:'巷口商铺',kind:'city'},
  {x:2850,y:1050,w:330,h:220,name:'过渡街巷',kind:'city'},
];
const entryBuildings:readonly Building[]=[
  {x:420,y:250,w:420,h:240,name:'入口街廊',kind:'city'},
  {x:1400,y:260,w:330,h:230,name:'观景平台服务点',kind:'city'},
  {x:1800,y:400,w:260,h:140,name:'东侧门廊',kind:'city'},
];
export const PROLOGUE_MAPS:Readonly<Record<'plaza'|'entry'|'service',ExplorationMapDefinition>>=Object.freeze({
  plaza:{name:'解放碑 · 城市序章',width:3300,height:1500,outdoor:true,bounds:{x:60,y:180,w:3180,h:1260},buildings:cityBuildings,
    walls:[...cityBuildings,PROLOGUE_MONUMENT,{x:300,y:1050,w:220,h:90},{x:1000,y:1060,w:170,h:90},{x:450,y:550,w:180,h:65}]},
  entry:{name:'沧白路 · 洪崖洞高处入口',width:2200,height:1300,outdoor:true,bounds:{x:60,y:230,w:2080,h:1000},buildings:entryBuildings,
    walls:[...entryBuildings,{x:60,y:980,w:2080,h:250}]},
  service:{name:'解放碑 · 游客服务小店',width:1100,height:650,outdoor:false,bounds:{x:160,y:240,w:780,h:360},buildings:[],
    walls:[{x:400,y:300,w:300,h:70},{x:770,y:250,w:100,h:70}]},
});
export const PROLOGUE_SAFE=Object.freeze({
  chapterStart:{map:'plaza',x:470,y:790},
  cityFromEntry:{map:'plaza',x:3060,y:900},
  serviceDoor:{map:'plaza',x:1250,y:580},
  serviceRoom:{map:'service',x:540,y:540},
  entryFromCity:{map:'entry',x:200,y:850},
  entryFromCore:{map:'entry',x:1940,y:780},
  coreFromEntry:{map:'upper',x:230,y:690},
} as const);
export const PROLOGUE_TARGETS:readonly ExplorationTarget[]=Object.freeze([
  {id:'city-monument',map:'plaza',x:900,y:900,label:'观察纪念碑外观'},
  {id:'city-sign',map:'plaza',x:2700,y:720,label:'查看巷口方向牌'},
  {id:'service-door',map:'plaza',x:1250,y:550,label:'进入游客服务小店',destination:'serviceRoom'},
  {id:'service-exit',map:'service',x:540,y:570,label:'返回服务店门口',destination:'serviceDoor'},
  {id:'service-guide',map:'service',x:280,y:330,label:'看看导览与操作提示'},
  {id:'city-to-entry',map:'plaza',x:3120,y:900,label:'沿街巷前往沧白路',destination:'entryFromCity'},
  {id:'entry-to-city',map:'entry',x:140,y:850,label:'返回解放碑步行街',destination:'cityFromEntry'},
  {id:'entry-to-core',map:'entry',x:2040,y:780,label:'进入洪崖洞上层街区',destination:'coreFromEntry'},
  {id:'core-to-entry',map:'upper',x:130,y:690,label:'沿西口返回沧白路入口',destination:'entryFromCore'},
  {id:'entry-view',map:'entry',x:1180,y:920,label:'看看栏杆下的街区'},
].map(t=>Object.freeze(t)) as readonly ExplorationTarget[]);
