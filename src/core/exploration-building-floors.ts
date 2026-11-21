import type {ExplorationMapDefinition, ExplorationTarget} from './exploration-content.ts';

// Three finite interior layouts; furniture and screens are actual foot blockers.
export const BUILDING_FLOOR_MAPS:Readonly<Record<'guide2'|'workshop2'|'workshop3',ExplorationMapDefinition>>=Object.freeze({
  guide2:{name:'临江导览楼 · 2F 阅览与纹样',width:1320,height:900,outdoor:false,
    bounds:{x:160,y:180,w:1000,h:660},buildings:[],walls:[
      {x:600,y:180,w:20,h:420},{x:250,y:300,w:200,h:80},{x:850,y:240,w:230,h:60},
      {x:250,y:520,w:180,h:60}]},
  workshop2:{name:'木作楼 · 2F 工具整理',width:1320,height:900,outdoor:false,
    bounds:{x:130,y:180,w:1060,h:660},buildings:[],walls:[
      {x:400,y:300,w:180,h:260},{x:800,y:500,w:230,h:90},{x:800,y:230,w:220,h:50}]},
  workshop3:{name:'木作楼 · 3F 储物与门扣柜',width:1320,height:900,outdoor:false,
    bounds:{x:130,y:180,w:1060,h:660},buildings:[],walls:[
      {x:400,y:320,w:240,h:90},{x:730,y:360,w:60,h:30},{x:700,y:365,w:12,h:100},
      {x:900,y:180,w:20,h:420},{x:1000,y:250,w:120,h:50}]},
});
export const BUILDING_FLOOR_SAFE=Object.freeze({
  cGuideStair1:{map:'guide',x:820,y:500},cGuideStair2:{map:'guide2',x:300,y:700},
  cWoodStair1:{map:'workshop',x:250,y:500},cWoodStair2Down:{map:'workshop2',x:250,y:700},
  cWoodStair2Up:{map:'workshop2',x:1080,y:700},cWoodStair3:{map:'workshop3',x:250,y:700},
} as const);
export const BUILDING_FLOOR_TARGETS:readonly ExplorationTarget[]=Object.freeze([
  {id:'guide-up',map:'guide',x:820,y:540,label:'上2F · 纹样导览',destination:'cGuideStair2'},
  {id:'guide-down',map:'guide2',x:300,y:740,label:'下1F · 接待阅览',destination:'cGuideStair1'},
  {id:'workshop-up-2',map:'workshop',x:250,y:540,label:'上2F · 工具整理',destination:'cWoodStair2Down'},
  {id:'workshop-down-1',map:'workshop2',x:250,y:740,label:'下1F · 工作台',destination:'cWoodStair1'},
  {id:'workshop-up-3',map:'workshop2',x:1080,y:740,label:'上3F · 门扣柜',destination:'cWoodStair3'},
  {id:'workshop-down-2',map:'workshop3',x:250,y:740,label:'下2F · 工具整理',destination:'cWoodStair2Up'},
  {id:'building-floor-sign',map:'workshop',x:320,y:460,label:'看看木作楼层用途牌'},
  {id:'building-tool-pattern',map:'workshop2',x:700,y:330,label:'观察工具与纹样'},
  {id:'building-wrong-box',map:'workshop3',x:1050,y:350,label:'看看山纹工具箱'},
]);
