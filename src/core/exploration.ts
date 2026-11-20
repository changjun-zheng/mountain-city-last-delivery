import { FixedStepSimulation } from './simulation.ts';
import { RuntimeLifecycleController, type PauseToken } from './lifecycle.ts';
import { InMemoryRunProgress, EXP02A_PROGRESS_CONTENT as P, EXP02B_PROGRESS_CONTENT as Q, type RunProgressSnapshot } from './progress.ts';
import { EXP_MAPS, EXP_SAFE, EXP_LEGACY_SAFE, EXP_TARGETS, EXP_CONTENT_VERSION, EXP02A_CONTENT_VERSION, EXP02B_CONTENT_VERSION, explorationWalls, segmentHitsRect, type ExplorationMap, type SafeId, type Point, type Rect } from './exploration-content.ts';
import { PHOTO_SITES, PHOTO_SITE_IDS, PHOTO_METADATA, missingPhotoElements, type PhotoSiteId, type PhotoMetadata } from './exploration-photo.ts';

export type LegacyExplorationSave = Readonly<{schemaVersion:1;contentVersion:string;safe:SafeId;progress:RunProgressSnapshot}>;
export type ExplorationSave = LegacyExplorationSave & Readonly<{observedSites:readonly PhotoSiteId[];photo:PhotoMetadata|null}>;
function validateBaseSave(value:unknown,content:'exp02a'|'exp02b'|'exp02c'):LegacyExplorationSave|undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as LegacyExplorationSave;
  const expected=content==='exp02a'?EXP02A_CONTENT_VERSION:content==='exp02b'?EXP02B_CONTENT_VERSION:EXP_CONTENT_VERSION;
  if (s.schemaVersion !== 1 || s.contentVersion !== expected ||
      typeof s.safe !== 'string' || !Object.hasOwn(content==='exp02c'?EXP_SAFE:EXP_LEGACY_SAFE, s.safe)) return;
  const progress = new InMemoryRunProgress(content==='exp02a'?'exp02a':'exp02b');
  if (!progress.restore(s.progress)) return;
  const has = (id: string) => progress.verifyGoal(id);
  const item = progress.snapshot.collections.includes(P.item);
  if ((has(P.unlocked) && (!has(P.accepted) || !has(P.clue) || !item)) ||
      (has(P.completed) && !has(P.unlocked)) ||
      ((EXP_SAFE[s.safe].map==='lower'||s.safe==='eastUpper'||s.safe==='westUpper')&&!has(P.unlocked))) return;
  return Object.freeze({ schemaVersion: 1, contentVersion: EXP_CONTENT_VERSION, safe: s.safe, progress: progress.snapshot });
}
export function migrateExp02ASave(value:unknown):ExplorationSave|undefined {
  if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='contentVersion,progress,safe,schemaVersion')return;
  const base=validateBaseSave(value,'exp02a');
  return base?Object.freeze({...base,observedSites:Object.freeze([]),photo:null}):undefined;
}
function validatePhotoSave(value:unknown,content:'exp02b'|'exp02c'):ExplorationSave|undefined {
  if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='contentVersion,observedSites,photo,progress,safe,schemaVersion')return;
  const base=validateBaseSave(value,content);if(!base)return;
  const s=value as ExplorationSave;
  if(!Array.isArray(s.observedSites)||s.observedSites.some(id=>!PHOTO_SITE_IDS.includes(id))||new Set(s.observedSites).size!==s.observedSites.length)return;
  const p=new InMemoryRunProgress('exp02b');p.restore(base.progress);
  const photographed=p.verifyGoal(Q.photographed);
  if(s.observedSites.length&&!p.verifyGoal(P.unlocked))return;
  if(photographed){
    if(!p.verifyGoal(P.completed)||!p.verifyGoal(P.unlocked)||!s.observedSites.includes('river')||!s.photo||
      Object.keys(s.photo).sort().join(',')!=='cardId,siteId'||s.photo.cardId!==PHOTO_METADATA.cardId||s.photo.siteId!=='river')return;
  }else if(s.photo!==null)return;
  return Object.freeze({...base,observedSites:Object.freeze([...s.observedSites]),photo:photographed?PHOTO_METADATA:null});
}
export function validateExplorationSave(value:unknown):ExplorationSave|undefined {return validatePhotoSave(value,'exp02c');}
export function migrateExp02BSave(value:unknown):ExplorationSave|undefined {return validatePhotoSave(value,'exp02b');}
export function emptyExplorationSave():ExplorationSave {
  return Object.freeze({schemaVersion:1,contentVersion:EXP_CONTENT_VERSION,safe:'chapterStart',progress:new InMemoryRunProgress('exp02b').snapshot,observedSites:Object.freeze([]),photo:null});
}

const RADIUS = 12;
const SPEED = 175;
type PendingDiscovery = 'accepted'|'clue'|'item'|'unlocked'|'completed';
function blocked(p: Point, wall: Rect): boolean {
  return p.x + RADIUS > wall.x && p.x - RADIUS < wall.x + wall.w &&
    p.y + RADIUS > wall.y && p.y - RADIUS < wall.y + wall.h;
}

// One authority for movement, map transitions and progress. No browser/rendering APIs.
export class ExplorationRuntime {
  readonly id: string;
  readonly simulation: FixedStepSimulation;
  readonly lifecycle: RuntimeLifecycleController;
  readonly #progress = new InMemoryRunProgress('exp02b');
  #map: ExplorationMap = EXP_SAFE.chapterStart.map;
  #position: Point = { x: EXP_SAFE.chapterStart.x, y: EXP_SAFE.chapterStart.y };
  #safe: SafeId = 'chapterStart';
  #intent = { x: 0, y: 0 };
  #interactHeld = false;
  #facing = { x: 0, y: 1 };
  #dialogue = '';
  #pending: PendingDiscovery|undefined;
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
  #disposed = false;

  constructor(id: string, save?: unknown) {
    this.id = id;
    const validated = save === undefined ? undefined : validateExplorationSave(save);
    if (save !== undefined && !validated) throw new Error('Invalid EXP-02C save.');
    if (validated) {
      this.#progress.restore(validated.progress);
      this.#safe = validated.safe;
      this.#map = EXP_SAFE[this.#safe].map;
      this.#position = { x: EXP_SAFE[this.#safe].x, y: EXP_SAFE[this.#safe].y };
      validated.observedSites.forEach(id=>this.#observedSites.add(id));
    }
    this.simulation = new FixedStepSimulation({ fixedDeltaMs: 20, maxStepsPerFrame: 5 }, dt => this.#step(dt));
    this.lifecycle = new RuntimeLifecycleController(this.simulation);
  }
  frame(now: number): void { if (!this.#disposed) this.simulation.frame(now); }
  move(x: number, y: number): void {
    if (this.#disposed || this.lifecycle.pauseCount) return;
    this.#intent = { x: Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0, y: Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0 };
  }
  clearInput(): void { this.#intent = { x: 0, y: 0 }; this.#interactHeld = false; }
  interact(down: boolean): void {
    if (this.#disposed) return;
    const edge = down && !this.#interactHeld;
    this.#interactHeld = down;
    if (!edge || this.lifecycle.pauseCount) return;
    const target = this.snapshot.target;
    if (!target) return;
    if (target.destination) {
      if(target.locked&&!this.#progress.verifyGoal(P.unlocked))this.#say('回廊门扣与东侧江纹栈门联动。先找到对应的通行方式，不能从这里绕过。');
      else this.#switch(target.destination);
      return;
    }
    switch (target.id) {
      case 'city-monument':this.#say('浅色柱体、钟面与分层基座立在广场中央。围着基座能回到步行街，东侧街巷通向沧白路。这里只观察外观，不进入碑体。');break;
      case 'city-sign':this.#say('方向牌：沿东侧过渡街巷前往沧白路高处入口；回望西侧是解放碑广场。街面是游戏化改编，不是现实精确步行导航。');break;
      case 'service-guide':this.#say('先在街面自由行走，靠近门口或导览牌，再主动交互。松开后可再次操作。\n沿商业步行街向东，经街巷到沧白路入口，那里能俯看木楼群。小店调查可跳过，不需要购买或收集。');break;
      case 'entry-view':this.#say('栏杆下是层叠的木楼，江桥在更远处。东侧门廊连到上层街区，西侧街巷可回解放碑。先听听身旁游客想找什么。');break;
      case 'visitor':
        this.#say('游客：想把桥、江水和木楼一起寄给远方。上层檐廊挡住了低处的视野，得找到下层朝江的开阔面。\n我在这里等你。导览小店有楼层示意，木作间保管着旧门扣。', 'accepted'); break;
      case 'note':
        this.#say('导览画着两种纹样：山纹留在上层杂物廊；江纹沿东栈木阶通往下层。\n江纹门扣画的是两道水波，不是三角山尖。木作间的可借导扣也刻着这个记号；栈门开启后，西回廊可回访。', 'clue'); break;
      case 'plaque':
        this.#say(this.#progress.snapshot.collections.includes(P.item)?'江纹导扣已带在身上。两道水波还清楚地刻在木面上。':'木架上放着一枚可借的江纹导扣，刻有两道水波。\n收起这段观察后带走导扣；它能与同纹门扣相合，但不是所有门都能打开。', 'item'); break;
      case 'wrong-gate':
        this.#say('杂物门刻着三角山纹，与水波导扣不同。这不是通往低处江景的路，导扣仍保留。'); break;
      case 'street-sign':
        this.#say('岔口路牌：北檐串着导览小店与木作间，南檐绕过旧窗铺可到茶歇；东栈是下层入口，西回廊供开路后回访。'); break;
      case 'tea-observe':
        this.#say('竹椅沿窗摆着，桌面留着茶壶的水印。这里适合歇脚，但屋檐挡住了桥面。\n这只是街区生活陈设，不影响寻找取景点。'); break;
      case 'window':
        this.#openPreview('window'); break;
      case 'photo-eaves':this.#openPreview('eaves');break;
      case 'gate':
        if (this.#progress.verifyGoal(P.unlocked)) this.#say('江纹栈门已开。门后的木阶通往下层，西回廊也可以回访。');
        else if (!this.#progress.verifyGoal(P.accepted)) this.#say('门后通往下层街巷。先听完游客的取景想法，确认此行要找的方向。');
        else if (!this.#progress.verifyGoal(P.clue)) this.#say('门上是两道水波。手里的东西即使形状相近，也要先弄清它和楼层的关系；导览小店有纹样与去向的对照。');
        else if (!this.#progress.snapshot.collections.includes(P.item)) this.#say('这正是导览里的江纹门扣。木作间保管的水波导扣可与它相合。');
        else {
          this.#say('水波纹与门扣吻合。轻转导扣，东栈门与西回廊的联动扣一起松开。\n收起这段操作后通路开放；导扣保留，之后可以沿两端回访。', 'unlocked');
        } break;
      case 'view':
        if (this.#progress.verifyGoal(P.unlocked)) {
          this.#openPreview('river');
        } break;
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
      this.#progress.completeGoal(P.completed);this.#safe='overlook';this.#revision++;
    }
    if(this.#photoToken)this.lifecycle.release(this.#photoOwner,this.#photoToken);
    this.#photoToken=undefined;this.#photoPreview=undefined;this.clearInput();
  }
  takePhoto(previewId:string):'rejected'|'incomplete'|'captured'|'existing' {
    const preview=this.#photoPreview;
    if(this.#disposed||!preview||preview.id!==previewId||!this.#photoToken||this.lifecycle.pauseCount!==1||
      this.#map!=='lower'||!this.#progress.verifyGoal(P.accepted)||!this.#progress.verifyGoal(P.unlocked)||
      this.snapshot.target?.id!==PHOTO_SITES[preview.siteId].targetId)return 'rejected';
    const missing=missingPhotoElements(preview.siteId);
    if(missing.length){this.#photoPreview=Object.freeze({...preview,feedback:PHOTO_SITES[preview.siteId].observation+' 再换一个视野看看；物品和次数都不受影响。'});return 'incomplete';}
    const existing=this.#progress.verifyGoal(Q.photographed);
    this.#progress.completeGoal(P.completed);
    this.#progress.completeGoal(Q.photographed);
    this.#safe='overlook';this.#revision++;
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
  closeDialogue(completed = true): void {
    if (this.#disposed || !this.#dialogueToken) return;
    if(completed&&this.#pending){
      if(this.#pending==='item')this.#progress.recordCollection(P.item);
      else this.#progress.completeGoal(P[this.#pending]);
      if(this.#pending==='completed')this.#safe='overlook';
      this.#revision++;
    }
    this.#pending=undefined;
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
  #switch(safe: SafeId): void {
    this.clearInput();
    this.#safe = safe;
    this.#map = EXP_SAFE[safe].map;
    this.#position = { x: EXP_SAFE[safe].x, y: EXP_SAFE[safe].y };
    this.#mapRevision++;
    this.#revision++;
  }
  #step(dt: number): void {
    const n = Math.max(1, Math.hypot(this.#intent.x, this.#intent.y));
    const dx = this.#intent.x / n * SPEED * dt / 1000;
    const dy = this.#intent.y / n * SPEED * dt / 1000;
    if (dx || dy) this.#facing = { ...this.#intent };
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
  }
  get save(): ExplorationSave {
    return Object.freeze({ schemaVersion: 1, contentVersion: EXP_CONTENT_VERSION, safe: this.#safe, progress: this.#progress.snapshot,
      observedSites:Object.freeze([...this.#observedSites]),photo:this.#progress.verifyGoal(Q.photographed)?PHOTO_METADATA:null });
  }
  get snapshot() {
    const progress = this.#progress.snapshot;
    const has = (id: string) => this.#progress.verifyGoal(id);
    const walls=explorationWalls(this.#map,has(P.unlocked));
    const target = EXP_TARGETS.filter(t => t.map === this.#map && Math.hypot(t.x - this.#position.x, t.y - this.#position.y) <= 64 && !walls.some(w=>segmentHitsRect(this.#position,t,w)))
      .sort((a, b) => Math.hypot(a.x - this.#position.x, a.y - this.#position.y) - Math.hypot(b.x - this.#position.x, b.y - this.#position.y))[0];
    return Object.freeze({ runtimeId: this.id, map: this.#map, position: Object.freeze({ ...this.#position }), facing: Object.freeze({ ...this.#facing }),
      target: target ? Object.freeze({ ...target }) : undefined, dialogue: this.#dialogue, pending: this.#pending, revision: this.#revision, mapRevision: this.#mapRevision, progress,
      photoPreview:this.#photoPreview,observations:Object.freeze(PHOTO_SITE_IDS.filter(id=>this.#observedSites.has(id)).map(id=>PHOTO_SITES[id])),
      photographed:has(Q.photographed),photo:has(Q.photographed)?PHOTO_METADATA:null,cardOpen:!!this.#cardToken,
      place:EXP_MAPS[this.#map].name,worldWidth:EXP_MAPS[this.#map].width,worldHeight:EXP_MAPS[this.#map].height,safe:this.#safe,
      accepted: has(P.accepted), clue: has(P.clue), item: progress.collections.includes(P.item), unlocked: has(P.unlocked), completed: has(P.completed),
      objective: has(Q.photographed) ? '夜景委托完成 · 可重看纪念卡' : !has(P.accepted) ? (this.#map==='plaza'||this.#map==='service'?'经商业街前往沧白路入口':this.#map==='entry'?'与高处入口的年轻游客交谈':'沿西口返回沧白路入口找游客') : !has(P.clue) ? '调查楼层与纹样的关系' : !progress.collections.includes(P.item) ? '寻找与江纹相合的导扣' : !has(P.unlocked) ? '核对纹样，找通往下层的入口' : '比较取景视野，主动拍下桥、江水与木楼',
      ...this.simulation.snapshot, pauseCount: this.lifecycle.pauseCount, disposed: this.#disposed });
  }
  dispose(): void {
    if (this.#disposed) return;
    this.closePhotoPreview(false);this.closePhotoCard();this.closeDialogue(false); this.clearInput(); this.simulation.pause(); this.#disposed = true;
  }
}
export type ExplorationSnapshot = ExplorationRuntime['snapshot'];
