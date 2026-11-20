import type {ExplorationMap,ExplorationTarget} from './exploration-content.ts';

// Three optional, original paper souvenirs for this Demo, not cultural artefacts.
export const MEMENTOS=Object.freeze([
  Object.freeze({id:'bookmark',targetId:'memento-bookmark',collectionId:'collection.exp03b.stilt-bookmark',map:'guide',x:780,y:470,name:'吊脚楼书签',
    text:'书签上，木楼沿坡展开，细细的支柱托起廊边。把这次对建筑层次的观察，夹在旅程里。'}),
  Object.freeze({id:'sketch',targetId:'memento-sketch',collectionId:'collection.exp03b.bamboo-sketch',map:'tea',x:300,y:520,name:'竹椅茶歇速写',
    text:'纸上留着游戏茶桌和竹椅的几笔线条。走累时歇一会儿，灯下的片刻也值得记下。'}),
  Object.freeze({id:'postcard',targetId:'memento-postcard',collectionId:'collection.exp03b.river-postcard',map:'lower',x:470,y:900,name:'江桥夜色明信片',
    text:'原创纸面图案画着江面、桥影与灯光。这是街边发现的小纪念，不是替游客拍下的那张夜景卡。'}),
] as const);
export type MementoId=typeof MEMENTOS[number]['id'];
export type MementoTargetId=typeof MEMENTOS[number]['targetId'];
export const MEMENTO_COLLECTION_IDS:readonly string[]=Object.freeze(MEMENTOS.map(m=>m.collectionId));
export const MEMENTO_COMPLETION=Object.freeze({goal:'goal.exp03b.three-mementos',reward:'reward.exp03b.city-light-keeper',title:'山城拾光者',story:'木楼的层次、茶歇的片刻与江上的灯光，都留在这段自愿驻足的旅程里。'});
export const MEMENTO_TARGETS:readonly ExplorationTarget[]=Object.freeze(MEMENTOS.map(m=>Object.freeze({id:m.targetId,map:m.map as ExplorationMap,x:m.x,y:m.y,label:'看看纸上图案'})));
