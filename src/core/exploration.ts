import {C_OLD_SAFE_MAP,WEST_STREET_JOIN} from './exploration-c-routes.ts';
import { FixedStepSimulation } from './simulation.ts';
import { RuntimeLifecycleController, type PauseToken } from './lifecycle.ts';
import { InMemoryRunProgress, EXP02A_PROGRESS_CONTENT as P, EXP02B_PROGRESS_CONTENT as Q, type RunProgressSnapshot } from './progress.ts';
import { EXP_MAPS, EXP_SAFE, EXP_LEGACY_SAFE, EXP_CONTENT_VERSION, EXP02A_CONTENT_VERSION, EXP02B_CONTENT_VERSION, EXP02C_CONTENT_VERSION, EXP03B_CONTENT_VERSION, EXP05A_CONTENT_VERSION, EXP05B_CONTENT_VERSION, EXP05B_SAFE, EXP05A_SAFE, EXP_PRE05_SAFE, explorationWalls, type ExplorationMap, type SafeId, type Point, type Rect, type TargetId } from './exploration-content.ts';
import { PHOTO_SITES, PHOTO_SITE_IDS, PHOTO_METADATA, missingPhotoElements, type PhotoSiteId, type PhotoMetadata } from './exploration-photo.ts';
import {MEMENTOS,MEMENTO_COLLECTION_IDS,MEMENTO_COMPLETION,type MementoId,type MementoTargetId} from './exploration-mementos.ts';
import {WALKER_RADIUS as RADIUS, distance, interactionAt, planExplorationRoute} from './exploration-navigation.ts';
import {FERRY_SAFE,FERRY_TRAVEL_MS} from './exploration-ferry.ts';

export type LegacyExplorationSave = Readonly<{schemaVersion:1;contentVersion:string;safe:SafeId;progress:RunProgressSnapshot}>;
export type ExplorationSave = LegacyExplorationSave & Readonly<{observedSites:readonly PhotoSiteId[];photo:PhotoMetadata|null}>;
type SaveProfile='exp02a'|'exp02b'|'exp02c'|'exp03b'|'exp05a'|'exp05b'|'exp06a';
function validateBaseSave(value:unknown,content:SaveProfile):LegacyExplorationSave|undefined {
  if(!value||typeof value!=='object')return;
  const s=value as LegacyExplorationSave;
  const versions={exp02a:EXP02A_CONTENT_VERSION,exp02b:EXP02B_CONTENT_VERSION,exp02c:EXP02C_CONTENT_VERSION,exp03b:EXP03B_CONTENT_VERSION,exp05a:EXP05A_CONTENT_VERSION,exp05b:EXP05B_CONTENT_VERSION,exp06a:EXP_CONTENT_VERSION};
  const safes:Readonly<Record<string,Readonly<{map:string;x:number;y:number}>>>=content==='exp06a'?EXP_SAFE:content==='exp05b'?EXP05B_SAFE:content==='exp05a'?EXP05A_SAFE:content==='exp03b'||content==='exp02c'?EXP_PRE05_SAFE:EXP_LEGACY_SAFE;
  if(s.schemaVersion!==1||s.contentVersion!==versions[content]||typeof s.safe!=='string'||!Object.hasOwn(safes,s.safe))return;
  const modern=content==='exp03b'||content==='exp05a'||content==='exp05b'||content==='exp06a';
  const progress=new InMemoryRunProgress(content==='exp02a'?'exp02a':modern?'exp03b':'exp02b');
  if(!progress.restore(s.progress))return;
  const has=(id:string)=>progress.verifyGoal(id),item=progress.snapshot.collections.includes(P.item),map=safes[s.safe].map;
  // Historical admission uses ONLY that version's independent snapshot, never
  // the reshaped current map or a mapped safe. The new middle is free only now.
  const needsOpen=content==='exp06a'?['lower','tea','lantern','riverfront'].includes(map):['lower','middle','riverfront'].includes(map)||String(s.safe)==='eastUpper'||String(s.safe)==='westUpper';
  if((has(P.unlocked)&&(!has(P.accepted)||!has(P.clue)||!item))||(has(P.completed)&&!has(P.unlocked))||(needsOpen&&!has(P.unlocked)))return;
  if(modern&&has(MEMENTO_COMPLETION.goal)!==MEMENTO_COLLECTION_IDS.every(id=>progress.snapshot.collections.includes(id)))return;
  let safe=s.safe;
  if(content!=='exp06a'){
    const oldSafe=String(s.safe);
    safe=(oldSafe==='teaDoor'&&!has(P.unlocked)?'cGuideH2':oldSafe==='teaRoom'&&!has(P.unlocked)?'cGuide1Door':C_OLD_SAFE_MAP[oldSafe as keyof typeof C_OLD_SAFE_MAP]??oldSafe) as SafeId;
  }
  if(!Object.hasOwn(EXP_SAFE,safe))return;
  const currentMap=EXP_SAFE[safe].map;
  if(['lower','tea','lantern','riverfront'].includes(currentMap)&&!has(P.unlocked))return;
  return Object.freeze({schemaVersion:1,contentVersion:EXP_CONTENT_VERSION,safe,progress:progress.snapshot});
}
export function migrateExp02ASave(value:unknown):ExplorationSave|undefined {
  if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='contentVersion,progress,safe,schemaVersion')return;
  const base=validateBaseSave(value,'exp02a');
  return base?Object.freeze({...base,observedSites:Object.freeze([]),photo:null}):undefined;
}
function validatePhotoSave(value:unknown,content:Exclude<SaveProfile,'exp02a'>):ExplorationSave|undefined {
  if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='contentVersion,observedSites,photo,progress,safe,schemaVersion')return;
  const base=validateBaseSave(value,content);if(!base)return;
  const s=value as ExplorationSave;
  if(!Array.isArray(s.observedSites)||s.observedSites.some(id=>!PHOTO_SITE_IDS.includes(id))||new Set(s.observedSites).size!==s.observedSites.length)return;
  const p=new InMemoryRunProgress((content==='exp03b'||content==='exp05a'||content==='exp05b'||content==='exp06a')?'exp03b':'exp02b');p.restore(base.progress);
  const photographed=p.verifyGoal(Q.photographed);
  if(Object.hasOwn(FERRY_SAFE,base.safe)&&!photographed)return;
  if(s.observedSites.length&&!p.verifyGoal(P.unlocked))return;
  if(photographed){
    if(!p.verifyGoal(P.completed)||!p.verifyGoal(P.unlocked)||!s.observedSites.includes('river')||!s.photo||
      Object.keys(s.photo).sort().join(',')!=='cardId,siteId'||s.photo.cardId!==PHOTO_METADATA.cardId||s.photo.siteId!=='river')return;
  }else if(s.photo!==null)return;
  return Object.freeze({...base,observedSites:Object.freeze([...s.observedSites]),photo:photographed?PHOTO_METADATA:null});
}
export function validateExplorationSave(value:unknown):ExplorationSave|undefined{return validatePhotoSave(value,'exp06a');}
export function migrateExp05BSave(value:unknown):ExplorationSave|undefined{return validatePhotoSave(value,'exp05b');}
export function migrateExp05ASave(value:unknown):ExplorationSave|undefined{return validatePhotoSave(value,'exp05a');}
export function migrateExp03BSave(value:unknown):ExplorationSave|undefined{return validatePhotoSave(value,'exp03b');}
export function migrateExp02CSave(value:unknown):ExplorationSave|undefined{return validatePhotoSave(value,'exp02c');}
export function migrateExp02BSave(value:unknown):ExplorationSave|undefined{return validatePhotoSave(value,'exp02b');}
export function emptyExplorationSave():ExplorationSave {
  return Object.freeze({schemaVersion:1,contentVersion:EXP_CONTENT_VERSION,safe:'chapterStart',progress:new InMemoryRunProgress('exp03b').snapshot,observedSites:Object.freeze([]),photo:null});
}

const WALK_SPEED = 175;
const SLOW_SPEED = 96;
const GUIDED_SPEED = 154;
export type TrackedExplorationTask = 'main' | 'none' | MementoId;
type PendingDiscovery = 'accepted'|'clue'|'item'|'unlocked'|'completed'|'ferry-out'|'ferry-back'|'ridge-lookout'|MementoTargetId;
type FerryDestination = 'ridgeDock' | 'riverDock';
function blocked(p: Point, wall: Rect): boolean {
  return p.x + RADIUS > wall.x && p.x - RADIUS < wall.x + wall.w &&
    p.y + RADIUS > wall.y && p.y - RADIUS < wall.y + wall.h;
}

// One authority for movement, map transitions and progress. No browser/rendering APIs.
export class ExplorationRuntime {
  readonly id: string;
  readonly simulation: FixedStepSimulation;
  readonly lifecycle: RuntimeLifecycleController;
  readonly #progress = new InMemoryRunProgress('exp03b');
  #map: ExplorationMap = EXP_SAFE.chapterStart.map;
  #position: Point = { x: EXP_SAFE.chapterStart.x, y: EXP_SAFE.chapterStart.y };
  #safe: SafeId = 'chapterStart';
  #intent = { x: 0, y: 0 };
  #slow = false;
  #interactHeld = false;
  #facing = { x: 0, y: 1 };
  #dialogue = '';
  #pending: PendingDiscovery|undefined;
  #inspectingMemento:MementoId|undefined;
  #mementoSerial=0;
  #dialogueToken: PauseToken | undefined;
  readonly #dialogueOwner = Symbol('exp-dialogue');
  readonly #photoOwner = Symbol('exp-photo-preview');
  #photoToken:PauseToken|undefined;
  #photoSerial=0;
  #photoPreview:Readonly<{id:string;siteId:PhotoSiteId;feedback:string}>|undefined;
  readonly #observedSites=new Set<PhotoSiteId>();
  #cardToken:PauseToken|undefined;
  #revision = 0;
  #mapRevision = 0;
  #walkedAcrossStreet = false;
  #disposed = false;
  #onboardingStep:'approach'|'continue'|'done'='done';
  #trackedTask: TrackedExplorationTask = 'main';
  #route: {key:string; origin:Point; plan:ReturnType<typeof planExplorationRoute>} | undefined;
  #autoPoints: Point[] = [];
  #ferry: {destination:FerryDestination; elapsed:number} | undefined;

  constructor(id: string, save?: unknown) {
    this.id = id;
    const validated = save === undefined ? undefined : validateExplorationSave(save);
    if (save !== undefined && !validated) throw new Error('Invalid EXP-06A save.');
    if (validated) {
      this.#progress.restore(validated.progress);
      this.#safe = validated.safe;
      this.#map = EXP_SAFE[this.#safe].map;
      this.#position = { x: EXP_SAFE[this.#safe].x, y: EXP_SAFE[this.#safe].y };
      validated.observedSites.forEach(id=>this.#observedSites.add(id));
    }
    this.#onboardingStep=this.#safe==='chapterStart'&&!this.#progress.verifyGoal(P.accepted)?'approach':'done';
    this.simulation = new FixedStepSimulation({ fixedDeltaMs: 20, maxStepsPerFrame: 5 }, dt => this.#step(dt));
    this.lifecycle = new RuntimeLifecycleController(this.simulation);
  }
  frame(now: number): void {
    if (this.#disposed) return;
    if (this.lifecycle.pauseCount) this.stopAutoWalk();
    this.simulation.frame(now);
  }
  move(x: number, y: number, slow = false): void {
    if (this.#disposed || this.lifecycle.pauseCount || this.#ferry) return;
    this.#intent = { x: Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0, y: Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0 };
    this.#slow = slow;
    if (this.#intent.x || this.#intent.y) this.stopAutoWalk();
  }
  clearInput(): void { this.#intent = { x: 0, y: 0 }; this.#slow = false; this.#interactHeld = false; this.stopAutoWalk(); }
  trackTask(task: TrackedExplorationTask): void {
    if (this.#disposed || (task !== 'none' && task !== 'main' && !this.#sideTasks().some(option=>option.id===task && !option.finished && !option.locked))) return;
    this.stopAutoWalk();
    this.#trackedTask = task;
  }
  startAutoWalk(): boolean {
    if (this.#disposed || this.lifecycle.pauseCount || this.#ferry || this.#intent.x || this.#intent.y) return false;
    this.#route = undefined;
    const plan = this.#guidance();
    if (!plan?.points.length) return false;
    this.#autoPoints = [...plan.points];
    return true;
  }
  stopAutoWalk(): void {
    if (!this.#autoPoints.length) return;
    this.#autoPoints = [];
    this.#route = undefined;
  }
  #sideTasks() {
    const unlocked = this.#progress.verifyGoal(P.unlocked);
    const {collections} = this.#progress.snapshot;
    return MEMENTOS.map(task=>({id:task.id, name:task.name, finished:collections.includes(task.collectionId), locked:!unlocked && task.map!=='guide'}));
  }
  #guidance() {
    if (this.#ferry) return;
    let goal: TargetId | undefined;
    const has=(id:string)=>this.#progress.verifyGoal(id);
    if (this.#trackedTask==='main') {
      if(this.#map==='ridge') goal = this.#safe==='ridgeLookout' ? undefined : 'ridge-lookout';
      else if(has(Q.photographed)) goal = this.#map==='riverfront' && this.#safe!=='riverDock' ? 'ferry-out' : undefined;
      else if (!has(P.accepted)) goal = this.#map==='plaza' && this.#onboardingStep==='approach' ? 'city-monument' : 'visitor';
      else if (!has(P.clue)) goal = 'note';
      else if (!this.#progress.snapshot.collections.includes(P.item)) goal = 'plaque';
      else goal = has(P.unlocked) ? 'view' : 'gate';
    } else if (this.#trackedTask!=='none') {
      const memento = MEMENTOS.find(task=>task.id===this.#trackedTask);
      if (memento && !this.#progress.snapshot.collections.includes(memento.collectionId)) goal = this.#map==='ridge' ? 'ferry-back' : memento.targetId;
    }
    if (!goal) return;
    const unlocked = has(P.unlocked);
    const key = `${this.#mapRevision}:${goal}:${unlocked}`;
    const origin = this.#position;
    if (this.#route?.key!==key || (!this.#autoPoints.length && distance(this.#route.origin,origin)>24)) {
      this.#route = {key, origin, plan:planExplorationRoute(this.#map,origin,explorationWalls(this.#map,unlocked),goal,unlocked)};
    }
    return this.#route.plan;
  }
  interact(down: boolean): void {
    if (this.#disposed || this.#ferry) return;
    const edge = down && !this.#interactHeld;
    this.#interactHeld = down;
    if (!edge || this.lifecycle.pauseCount) return;
    this.stopAutoWalk();
    const target = this.snapshot.target;
    if (!target) return;
    if (target.destination) {
      if(target.locked&&!this.#progress.verifyGoal(P.unlocked))this.#say('回廊门扣与东侧江纹栈门联动。先找到对应的通行方式，不能从这里绕过。');
      else this.#switch(target.destination);
      return;
    }
    const memento=MEMENTOS.find(m=>m.targetId===target.id);
    if(memento){
      const owned=this.#progress.snapshot.collections.includes(memento.collectionId);
      this.#say(`${memento.name}\n${memento.text}\n${owned?'这件纪念已经收好，图案留在旅程手账中。':'这张纸质纪念可自愿收进纪念册，也可以先放回；不影响游客委托。'}`,owned?undefined:memento.targetId);
      this.#inspectingMemento=memento.id;this.#mementoSerial++;return;
    }
    switch (target.id) {
      case 'city-monument':
        this.#say('浅色柱体、钟面与分层基座立在广场中央。围着基座能回到步行街，东侧街巷通向沧白路。这里只观察外观，不进入碑体。'+(this.#onboardingStep==='approach'?'\n松开交互键，再按 E 或点击「收起」，完成第一次调查。':''));break;
      case 'city-sign':this.#say('方向牌：沿东侧过渡街巷前往沧白路高处入口；回望西侧是解放碑广场。街面是游戏化改编，不是现实精确步行导航。');break;
      case 'service-guide':this.#say('先在街面自由行走，靠近门口或导览牌，再主动交互。松开后可再次操作。\n沿商业步行街向东，经街巷到沧白路入口，那里能俯看木楼群。小店调查可跳过，不需要购买或收集。');break;
      case 'entry-view':this.#say('栏杆下是层叠的木楼，江桥在更远处。东侧门廊连到上层街区，西侧街巷可回解放碑。先听听身旁游客想找什么。');break;
      case 'middle-court':this.#say('青白窄条从导览1F门旁延到上方2F窗边。刚才的上街就在屋檐后；市集两道门分别通西廊和东院。');break;
      case 'middle-outer':this.#say('支柱托着上方木作檐廊，栏杆后能看见下街门面。江纹封道松开后，两端外阶和木作1F门会一起通行。');break;
      case 'building-floor-sign':this.#say('木作楼：1F工作台，2F存放与整理工具，3F是储物和门扣柜。西侧楼梯可自由上楼。1F门在下街，2F临中街，3F露台接上街；下街门受江纹封道控制。');break;
      case 'building-tool-pattern':this.#say('整理台上摆着山尖纹与水波纹的工具。用途和纹样各不相同，可以绕过存放柜到另一侧楼梯；这里不需要拿走任何东西。');break;
      case 'building-wrong-box':this.#say('箱盖刻着三角山纹，里面是收好的工具。这不是水波门扣，不会取走或消耗你已有的物件。');break;
      case 'visitor':
        this.#say(this.#progress.verifyGoal(Q.photographed)?'游客：桥、江水和木楼，你已经把这一刻留住了。委托已经完成，不必再来交付；纪念卡可以在旅程记录里重看。':
          '游客：想把桥、江水和木楼一起寄给远方。上层屋檐挡住了视野，得去低处找找。\n东侧门廊通上街。临江导览楼2F有楼层示意，木作楼3F保管着旧门扣。拍好后会直接留下纪念卡，不必折返找我。', 'accepted'); break;
      case 'note':
        this.#say('导览画着两种纹样：山纹留在上街杂物门；江纹栈门在中街东侧，门后的外阶通往下街。\n江纹是两道水波，不是三角山尖。木作楼3F的可借导扣也刻着水波。这里西侧楼梯下到1F，出门就是中街；开路后两端外阶与木作1F门都能通行。', 'clue'); break;
      case 'plaque':
        this.#say(this.#progress.snapshot.collections.includes(P.item)?'江纹导扣已带在身上。两道水波还清楚地刻在木面上。':'木架上放着一枚可借的江纹导扣，刻有两道水波。\n确认后带走导扣，再与沿途门扣比对；它不会因试错消失。', 'item'); break;
      case 'wrong-gate':
        this.#say('杂物门刻着三角山纹，与水波导扣不同。这不是通往低处江景的路，导扣仍保留。'); break;
      case 'street-sign':
        this.#say('岔口路牌：上街临导览2F与木作3F；两端外阶和导览楼都能到中街。中街市集可穿行，下街仍有江纹封道。'); break;
      case 'tea-observe':
        this.#say('竹椅沿窗摆着，桌面留着茶壶的水印。这里适合歇脚，但屋檐挡住了桥面。\n这只是街区生活陈设，不影响寻找取景点。'); break;
      case 'window':
        this.#openPreview('window'); break;
      case 'photo-eaves':this.#openPreview('eaves');break;
      case 'gate':
        if (this.#progress.verifyGoal(P.unlocked)) this.#say('江纹栈门已开。中街两端外阶与木作1F门都已通往下街，可以自由往返。');
        else if (!this.#progress.verifyGoal(P.accepted)) this.#say('门后通往下街。先从两端外阶回上街，再沿西口回沧白路，与游客确认取景委托。');
        else if (!this.#progress.verifyGoal(P.clue)) this.#say('门上是两道水波。先弄清纹样和去向的关系：中街的临江导览楼1F可以上到2F，那里有对照导览。');
        else if (!this.#progress.snapshot.collections.includes(P.item)) this.#say('这正是导览里的江纹门扣。进入中街木作楼2F，从东侧楼梯上3F，看看门扣柜中的水波导扣。');
        else {
          this.#say('水波纹与门扣吻合，可以轻转导扣，松开联动扣。\n确认开门后，中街两端外阶与木作1F门会一起通往下街；导扣保留，往返不再需要开门。', 'unlocked');
        } break;
      case 'view':
        if (this.#progress.verifyGoal(P.unlocked)) {
          this.#openPreview('river');
        } break;
      case 'ferry-out':
        if(this.#progress.verifyGoal(Q.photographed)) this.#say('船家：夜景拍好了？照水岭就在对岸。上船后会把你送到林间石阶的坡脚。', 'ferry-out');
        else this.#say('船家：对岸那片山林是照水岭。等你拍好游客托付的夜景，再来搭这一趟渡船。');
        break;
      case 'ferry-back':
        this.#say('船家：上船吧，回城里还来得及。', 'ferry-back');
        break;
      case 'ridge-lookout':
        this.#say('从古树台望回去，最早擦亮的灯还在半坡。江岸在脚下，石阶绕着山背往更深处伸去。', 'ridge-lookout');
        break;
    }
  }
  #openPreview(siteId:PhotoSiteId):void {
    this.clearInput();
    this.#photoToken=this.lifecycle.acquire(this.#photoOwner,Symbol('photo-preview'));
    this.#photoPreview=Object.freeze({id:`${this.id}:view:${++this.#photoSerial}`,siteId,feedback:''});
    if(!this.#observedSites.has(siteId)){this.#observedSites.add(siteId);this.#revision++;}
  }
  closePhotoPreview(discovered=true):void {
    if(this.#disposed||!this.#photoPreview)return;
    if(discovered&&this.#photoPreview.siteId==='river'&&this.#progress.verifyGoal(P.unlocked)&&this.lifecycle.pauseCount===1){
      this.#progress.completeGoal(P.completed);this.#safe=PHOTO_SITES.river.safe;this.#revision++;
    }
    if(this.#photoToken)this.lifecycle.release(this.#photoOwner,this.#photoToken);
    this.#photoToken=undefined;this.#photoPreview=undefined;this.clearInput();
  }
  takePhoto(previewId:string):'rejected'|'incomplete'|'captured'|'existing' {
    const preview=this.#photoPreview;
    if(this.#disposed||!preview||preview.id!==previewId||!this.#photoToken||this.lifecycle.pauseCount!==1||
      this.#map!==PHOTO_SITES[preview.siteId].map||!this.#progress.verifyGoal(P.accepted)||!this.#progress.verifyGoal(P.unlocked)||
      this.snapshot.target?.id!==PHOTO_SITES[preview.siteId].targetId)return 'rejected';
    const missing=missingPhotoElements(preview.siteId);
    if(missing.length){this.#photoPreview=Object.freeze({...preview,feedback:PHOTO_SITES[preview.siteId].observation+' 再换一个视野看看；物品和次数都不受影响。'});return 'incomplete';}
    const existing=this.#progress.verifyGoal(Q.photographed);
    this.#progress.completeGoal(P.completed);
    this.#progress.completeGoal(Q.photographed);
    this.#safe=PHOTO_SITES.river.safe;this.#revision++;
    this.closePhotoPreview(false);this.openPhotoCard();
    return existing?'existing':'captured';
  }
  openPhotoCard():boolean {
    if(this.#disposed||this.lifecycle.pauseCount||!this.#progress.verifyGoal(Q.photographed))return false;
    this.clearInput();this.#cardToken=this.lifecycle.acquire(this.#photoOwner,Symbol('photo-card'));return !!this.#cardToken;
  }
  closePhotoCard():void {
    if(this.#cardToken)this.lifecycle.release(this.#photoOwner,this.#cardToken);
    this.#cardToken=undefined;this.clearInput();
  }
  closeDialogue(completed = true,mementoInspectionId?:string): void {
    if (this.#disposed || !this.#dialogueToken) return;
    if(completed&&this.#inspectingMemento&&(this.lifecycle.pauseCount!==1||mementoInspectionId!==`${this.id}:memento:${this.#mementoSerial}`))return;
    if(completed&&this.lifecycle.pauseCount===1&&this.#onboardingStep==='approach'&&this.snapshot.target?.id==='city-monument')this.#onboardingStep='continue';
    if(completed&&this.#pending){
      const memento=MEMENTOS.find(m=>m.targetId===this.#pending);
      if(memento){
        this.#progress.recordCollection(memento.collectionId);
        if(MEMENTO_COLLECTION_IDS.every(id=>this.#progress.snapshot.collections.includes(id)))this.#progress.completeGoal(MEMENTO_COMPLETION.goal);
      }else if(this.#pending==='ferry-out'||this.#pending==='ferry-back'){
        this.#ferry={destination:this.#pending==='ferry-out'?'ridgeDock':'riverDock',elapsed:0};
      }else if(this.#pending==='ridge-lookout')this.#safe='ridgeLookout';
      else if(this.#pending==='item')this.#progress.recordCollection(P.item);
      else this.#progress.completeGoal(P[this.#pending as keyof typeof P]);
      if(this.#pending==='completed')this.#safe='cLowerRiver';
      this.#revision++;
    }
    this.#pending=undefined;
    this.#inspectingMemento=undefined;
    this.lifecycle.release(this.#dialogueOwner, this.#dialogueToken);
    this.#dialogueToken = undefined;
    this.#dialogue = '';
    this.clearInput();
  }
  #say(text: string, pending?: PendingDiscovery): void {
    this.clearInput();
    this.#dialogue = text;
    this.#pending = pending;
    this.#dialogueToken = this.lifecycle.acquire(this.#dialogueOwner, Symbol('dialogue'));
  }
  #switch(safe: SafeId, walkingPosition?: Point): void {
    this.stopAutoWalk();
    if (!walkingPosition) this.clearInput();
    this.#safe = safe;
    this.#map = EXP_SAFE[safe].map;
    this.#position = walkingPosition ?? { x: EXP_SAFE[safe].x, y: EXP_SAFE[safe].y };
    this.#walkedAcrossStreet = walkingPosition !== undefined;
    this.#mapRevision++;
    this.#revision++;
  }
  #step(dt: number): void {
    if(this.#ferry){
      this.#ferry.elapsed+=dt;
      if(this.#ferry.elapsed>=FERRY_TRAVEL_MS){
        const destination=this.#ferry.destination;
        this.#ferry=undefined;
        this.#switch(destination);
      }
      return;
    }
    const before = this.#position;
    const next = this.#autoPoints[0];
    const speed = next ? GUIDED_SPEED : this.#slow ? SLOW_SPEED : WALK_SPEED;
    const stride = speed * dt / 1000;
    const intent = next ? {x:(next.x-before.x)/stride, y:(next.y-before.y)/stride} : this.#intent;
    const n = Math.max(1, Math.hypot(intent.x, intent.y));
    const dx = intent.x / n * stride;
    const dy = intent.y / n * stride;
    if (dx || dy) this.#facing = {x:intent.x/n,y:intent.y/n};
    // Swept subdivision is bounded to less than the foot radius, even for a large step.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
    const map = EXP_MAPS[this.#map];
    const walls = explorationWalls(this.#map, this.#progress.verifyGoal(P.unlocked));
    const valid = (p: Point) => p.x >= map.bounds.x + RADIUS && p.x <= map.bounds.x + map.bounds.w - RADIUS &&
      p.y >= map.bounds.y + RADIUS && p.y <= map.bounds.y + map.bounds.h - RADIUS && !walls.some(w => blocked(p, w));
    for (let i = 0; i < steps; i++) {
      const x = { x: this.#position.x + dx / steps, y: this.#position.y };
      if (valid(x)) this.#position = x;
      const y = { x: this.#position.x, y: this.#position.y + dy / steps };
      if (valid(y)) this.#position = y;
    }
    if (next && (distance(this.#position,next)<.01 || distance(before,this.#position)<.01)) {
      if (distance(this.#position,next)>=.01 || this.#autoPoints.length===1) this.stopAutoWalk();
      else this.#autoPoints.shift();
    }
    const { x, y } = this.#position;
    const join = WEST_STREET_JOIN;
    if (Math.abs(x - join.x) > join.halfWidth || Math.abs(before.x - join.x) > join.halfWidth) return;
    if (this.#map === 'upper' && before.y <= join.upperY && y > join.upperY) {
      this.#switch(join.middleSafe, { x, y: join.middleY + (y - join.upperY) });
    } else if (this.#map === 'middle' && before.y >= join.middleY && y < join.middleY) {
      this.#switch(join.upperSafe, { x, y: join.upperY + (y - join.middleY) });
    }
  }
  // Read-only, map-aware guidance. No new discovery, waypoint or saved state.
  #objective(): string {
    const has=(id:string)=>this.#progress.verifyGoal(id),map=this.#map;
    if(map==='ridge')return this.#safe==='ridgeLookout'?'沿山路下到渡口，随时可以乘船回城':'沿林间石阶上坡，在古树台回望山城';
    if(has(Q.photographed))return map==='riverfront'?'照水岭已开放 · 从东侧渡口乘船过江':'委托已完成 · 旅程记录可重看纪念卡，无需返程交付';
    if(!has(P.accepted)){
      if(map==='plaza'&&this.#onboardingStep==='approach'){
        return '第一步：沿广场浅色路到纪念碑右侧，靠近后按 E／交互';
      }
      if(map==='plaza'&&this.#onboardingStep==='continue')return '第一次调查完成 · 向右沿街巷到沧白路，与游客交谈';
      if(map==='plaza')return '沿步行街向东（右侧），前往沧白路入口';
      if(map==='service')return '从店门返回步行街，再向东前往沧白路';
      if(map==='entry')return '在入口栏杆旁，与年轻游客交谈';
      if(map==='upper')return '沿西口返回沧白路入口找游客';
      if(map==='middle')return '经两端外阶回上街，再沿西口找沧白路游客';
      if(map==='guide2'||map==='workshop3')return '从本层门口回上街，再沿西口找沧白路游客';
      if(map==='workshop')return '先经西侧楼梯上2F出中街，再由外阶回上街找游客';
      return '先出楼回中街，经外阶回上街，去西口找游客';
    }
    if(map==='plaza'||map==='service')return '回到步行街向东走，经沧白路进入上街';
    if(map==='entry')return '沿东侧门廊进入上街，继续游客的取景委托';
    if(!has(P.clue)){
      if(map==='guide2')return '在2F东侧阅览桌前，阅读楼层与纹样导览';
      if(map==='guide')return '从1F东侧楼梯上2F，查看纹样导览';
      if(map==='middle')return '进入临江导览楼1F，再上2F查看导览';
      return '到上街临江导览楼2F，查看楼层与纹样导览';
    }
    if(!this.#progress.snapshot.collections.includes(P.item)){
      if(map==='workshop3')return '在3F绕过屏风，到门扣柜前比对纹样';
      if(map==='workshop2')return '从2F东侧楼梯上3F，寻找对应纹样的导扣';
      if(map==='workshop')return '经西侧楼梯上2F，再从东侧楼梯上3F';
      if(map==='middle')return '进入木作楼2F，再上3F查看门扣柜';
      return '到上街木作楼3F，寻找与导览纹样相合的导扣';
    }
    if(!has(P.unlocked)){
      if(map==='upper')return '线索与导扣已齐 · 经两端外阶到中街东侧栈门';
      if(map==='guide2')return '线索与导扣已齐 · 下1F出中街，向东找江纹栈门';
      if(map==='workshop3'||map==='workshop')return '线索与导扣已齐 · 从木作2F出中街，向东找栈门';
      return '线索与导扣已齐 · 到中街东侧江纹栈门核对';
    }
    if(map==='riverfront')return has(P.completed)?'已找到江岸视野 · 再次取景，点击「拍摄这一刻」':'沿江岸步道找取景点，比较桥、江水与木楼';
    if(map==='lower'||map==='tea'||map==='lantern')return '比较下街取景视野，也可沿东侧阶道去江岸';
    return '下街通路已开 · 经外阶或木作1F下行，寻找取景点';
  }
  // Session-only teaching: never grants progress or adds fields to the save.
  skipOnboarding():void {if(!this.#disposed)this.#onboardingStep='done';}
  replayOnboarding():void {
    if(!this.#disposed&&this.#map==='plaza'&&!this.#progress.verifyGoal(P.accepted))this.#onboardingStep='approach';
  }
  get save(): ExplorationSave {
    return Object.freeze({ schemaVersion: 1, contentVersion: EXP_CONTENT_VERSION, safe: this.#safe, progress: this.#progress.snapshot,
      observedSites:Object.freeze([...this.#observedSites]),photo:this.#progress.verifyGoal(Q.photographed)?PHOTO_METADATA:null });
  }
  get snapshot() {
    const progress = this.#progress.snapshot;
    const has = (id: string) => this.#progress.verifyGoal(id);
    const walls=explorationWalls(this.#map,has(P.unlocked));
    const target = this.#ferry ? undefined : interactionAt(this.#map,this.#position,walls);
    const plan = this.#guidance();
    const route = this.#autoPoints.length ? this.#autoPoints : plan?.points;
    return Object.freeze({ runtimeId: this.id, map: this.#map, position: Object.freeze({ ...this.#position }), facing: Object.freeze({ ...this.#facing }),
      target: target ? Object.freeze({ ...target }) : undefined, dialogue: this.#dialogue, pending: this.#pending, inspectingMemento:this.#inspectingMemento,mementoInspectionId:this.#inspectingMemento?`${this.id}:memento:${this.#mementoSerial}`:undefined, revision: this.#revision, mapRevision: this.#mapRevision, walkedAcrossStreet: this.#walkedAcrossStreet, progress,
      mementos:Object.freeze(MEMENTOS.filter(m=>progress.collections.includes(m.collectionId))),mementoTitle:has(MEMENTO_COMPLETION.goal)?MEMENTO_COMPLETION.title:undefined,
      photoPreview:this.#photoPreview,observations:Object.freeze(PHOTO_SITE_IDS.filter(id=>this.#observedSites.has(id)).map(id=>PHOTO_SITES[id])),
      photographed:has(Q.photographed),photo:has(Q.photographed)?PHOTO_METADATA:null,cardOpen:!!this.#cardToken,
      place:EXP_MAPS[this.#map].name,worldWidth:EXP_MAPS[this.#map].width,worldHeight:EXP_MAPS[this.#map].height,safe:this.#safe,
      accepted: has(P.accepted), clue: has(P.clue), item: progress.collections.includes(P.item), unlocked: has(P.unlocked), completed: has(P.completed),
      onboarding:this.#map==='plaza'&&!has(P.accepted)?this.#onboardingStep:'done',
      objective: this.#objective(),
      tracking:{task:this.#trackedTask, options:this.#sideTasks(), next:plan?.target, points:route ? [...route] : [], walking:!!this.#autoPoints.length},
      ferry:this.#ferry ? {direction:this.#ferry.destination==='ridgeDock'?'outbound':'inbound',fraction:this.#ferry.elapsed/FERRY_TRAVEL_MS} : undefined,
      ...this.simulation.snapshot, pauseCount: this.lifecycle.pauseCount, disposed: this.#disposed });
  }
  dispose(): void {
    if (this.#disposed) return;
    this.closePhotoPreview(false);this.closePhotoCard();this.closeDialogue(false); this.clearInput(); this.simulation.pause(); this.#disposed = true;
  }
}
export type ExplorationSnapshot = ExplorationRuntime['snapshot'];
