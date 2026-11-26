import { ExplorationRuntime, emptyExplorationSave } from '../../core/exploration';
import { WEST_STREET_JOIN } from '../../core/exploration-c-routes';
import { mountExplorationScene } from '../../rendering/phaser/exploration';
import { bindExplorationInput } from './exploration-input';
import { ExplorationStorage } from './exploration-storage';
import { bindVisibilityPause } from './visibility';
import { runtimeUuidProvider } from './runtime-uuid';
import type { PauseToken } from '../../core/lifecycle';
import {PHOTO_SITES,type PhotoSiteId} from '../../core/exploration-photo';
import {explorationPhotoSvg} from '../../rendering/phaser/exploration-photo-art';
import {explorationUiMarkup,renderExplorationJournal} from './exploration-ui';
import {explorationDialogueAction} from './exploration-journal';
import './exploration-ui.css';
import './exploration-storybook.css';
import './exploration-title.css';
import './exploration-ui-v2.css';
import './exploration-style-a.css';
import {mementoImageUrl} from '../../rendering/phaser/exploration-memento-art';
import {committedGateOpening,investigationView} from '../../rendering/exploration-feedback';
import {createGateSound} from './exploration-gate-sound';
import type {ExplorationWeather} from '../../rendering/phaser/exploration-weather';

export async function launchExploration({showTitle=true}:{showTitle?:boolean}={}) {
  const artSample=new URLSearchParams(location.search).get('sample')==='storybook';
  if(artSample)showTitle=false;
  document.title='坎坡之间';
  document.body.classList.add('exp-mode');
  const root=document.createElement('section');
  root.id='exp-root';root.dataset.artSample=String(artSample);root.tabIndex=-1;root.setAttribute('aria-label','坎坡之间');
  root.innerHTML=explorationUiMarkup;
  document.body.append(root);
  const get=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
  const cleanup:(()=>void|Promise<void>)[]=[];
  const phoneUpright=matchMedia('(pointer: coarse) and (orientation: portrait)');
  const gateSound=createGateSound();
  cleanup.push(gateSound.dispose);
  let investigationKey='',gateFeedbackUntil=-1;
  let weather: ExplorationWeather = 'dusk';
  const abort=new AbortController();
  let disposed=false;
  let input:ReturnType<typeof bindExplorationInput>|undefined;
  const orientationOwner=Symbol('orientation');
  let orientationToken:PauseToken|undefined;
  let runtime:ExplorationRuntime|undefined;
  let storage:ExplorationStorage|undefined;
  const views={title:showTitle,intro:false,menu:false,journal:false,help:false,confirm:false};
  type View=keyof typeof views;
  const owners:Record<View,symbol>={title:Symbol('title'),intro:Symbol('intro'),menu:Symbol('menu'),journal:Symbol('journal'),help:Symbol('instructions'),confirm:Symbol('confirm')};
  const tokens:Partial<Record<View,PauseToken>>={};
  let started=!showTitle,hasJourney=false;
  let sceneReady=false;
  let loadStatus='';
  let savedRevision=-1;
  let shownPhoto:PhotoSiteId|undefined;
  let notesSignature='';
  let shutterGesture:{id:string;pointerId:number;released:boolean}|undefined;
  let photoCloseGesture:{id:string;pointerId:number;released:boolean}|undefined;
  let mementoGesture:{id:string;pointerId:number;released:boolean}|undefined;
  let dialogueGeneration=0,lastDialogue='';
  let dialogueCloseGesture:{generation:number;pointerId:number;released:boolean}|undefined;
  let lastMementoCount=0,feedbackUntil=0;
  let collectionFeedback='';
  let lastCardOpen=false;
  let focusedPanel:HTMLElement|undefined,returnFocus:HTMLElement|undefined;
  let restartSource:'play'|'title'|'card'='play';
  const update=()=>{
    if(disposed||!runtime)return;
    input?.sync();
    const s=runtime.snapshot;
    if(lastDialogue!==s.dialogue){lastDialogue=s.dialogue;dialogueGeneration++;dialogueCloseGesture=undefined;}
    if(shutterGesture&&shutterGesture.id!==s.photoPreview?.id)shutterGesture=undefined;
    if(photoCloseGesture&&photoCloseGesture.id!==s.photoPreview?.id)photoCloseGesture=undefined;
    if(mementoGesture&&mementoGesture.id!==s.mementoInspectionId)mementoGesture=undefined;
    if(started&&savedRevision!==s.revision){storage?.save(runtime.save);savedRevision=s.revision;}
    const sampleObjective=s.map==='upper'?'走进眼前的导览楼，看看楼上的纹样。':s.map==='middle'
      ?'沿街往右到木廊市集，也可沿西外阶回上街。':s.map==='guide2'
      ?s.clue?'已记下纹样：从右侧门回上街，也可以下楼看看。':'往里走，调查右侧展柜旁的纹样。':undefined;
    const sideTask = s.tracking.options.find(task=>task.id===s.tracking.task);
    const routeText = sideTask ? (sideTask.finished ? `已收好 · ${sideTask.name}` : `选做 · ${sideTask.name} · ${s.tracking.next?.label??'请查看旅程记录'}`) : s.objective;
    const hudText = artSample && sampleObjective && s.tracking.task==='none' ? sampleObjective : routeText;
    const saveText = artSample ? '街区试游 · 进度独立' : storage?.status ?? '本次未保存';
    const objective = get('exp-objective'), place = get('exp-place'), save = get('exp-save');
    if (objective.textContent !== hudText) objective.textContent = hudText;
    if (place.textContent !== s.place) place.textContent = s.place;
    if (save.textContent !== saveText) save.textContent = saveText;
    const menuSave=get('exp-menu-save');
    const menuSaveText=saveText.includes('保存')?`${saveText} · ${s.place}`:saveText;
    if(menuSave.textContent!==menuSaveText)menuSave.textContent=menuSaveText;
    const archiveNotice=get('exp-archive-notice');
    const notice=storage?.notice??'';
    if(archiveNotice.textContent!==notice)archiveNotice.textContent=notice;
    const uiOpen=Object.values(views).some(Boolean);
    root.dataset.weather=weather;
    const ferryStatus=get('exp-ferry-status');
    ferryStatus.hidden=!s.ferry||uiOpen;
    const ferryText=s.ferry?.direction==='outbound'?'渡船驶向照水岭':'渡船驶回山城';
    if(ferryStatus.textContent!==ferryText)ferryStatus.textContent=ferryText;
    const auto = get<HTMLButtonElement>('exp-auto-walk');
    auto.hidden=!!s.pauseCount || !s.tracking.points.length;
    const autoLabel = s.tracking.walking ? '停止跟走' : '顺路前往';
    if(auto.textContent!==autoLabel)auto.textContent=autoLabel;
    auto.setAttribute('aria-pressed',String(s.tracking.walking));
    if(views.journal){
      for(const task of ['main','none',...s.tracking.options.map(option=>option.id)] as const){
        const button=get<HTMLButtonElement>(`exp-track-${task}`);
        const option=s.tracking.options.find(option=>option.id===task);
        button.disabled=!!option&&(option.locked||option.finished);
        button.setAttribute('aria-pressed',String(s.tracking.task===task));
        if(option){
          const label=`选做 · ${option.name}${option.finished?'（已收好）':option.locked?'（下街未开放）':''}`;
          if(button.textContent!==label)button.textContent=label;
        }
      }
    }
    const teaching=s.onboarding!=='done';
    root.dataset.onboarding=s.onboarding;
    get('exp-onboarding').hidden=!teaching||uiOpen||!!s.dialogue||!!s.photoPreview;
    const approaching=s.onboarding==='approach',nearMonument=s.target?.id==='city-monument';
    get('exp-onboarding-step').textContent=approaching?'初到广场 · 1 / 2':'学会调查 · 2 / 2';
    get('exp-onboarding-title').textContent=approaching?(nearMonument?'试着调查眼前的纪念碑':'先去纪念碑边看看'):'去街巷另一头认识一位游客';
    get('exp-onboarding-text').textContent=approaching?(nearMonument?'按 E／空格，或点右下「交互」。读完后松开，再按一次确认收起。':'用 WASD／方向键或左下摇杆，向右走到金色标记处。这里可以试一次观察与交互。'):'沿右侧街面向东走，经街巷到沧白路。游客有一张想寄出的夜景照片，靠近后交谈。';
    get('exp-onboarding-skip').textContent=approaching?'跳过教学':'知道了';
    get('exp-onboarding-replay').hidden=views.title||s.map!=='plaza'||s.accepted;
    const crossWest = s.target?.id===WEST_STREET_JOIN.down || s.target?.id===WEST_STREET_JOIN.up;
    const crossWestText = s.target?.id===WEST_STREET_JOIN.down ? '沿西外阶向下走，到中街' : '沿西外阶向上走，回上街';
    const promptVisible=!!s.target&&!s.dialogue&&!s.photoPreview&&!s.cardOpen&&!uiOpen;
    const promptEl=get('exp-prompt'),promptKey=get('exp-prompt-key'),promptText=get('exp-prompt-text');
    promptEl.hidden=!promptVisible;
    promptKey.hidden=crossWest;
    const promptCopy=crossWest?crossWestText:s.target?.label??'';
    if(promptText.textContent!==promptCopy)promptText.textContent=promptCopy;
    get<HTMLButtonElement>('exp-interact').disabled=!s.target||!!s.pauseCount||crossWest;
    get('exp-dialogue').hidden=!s.dialogue||uiOpen;
    get('exp-dialogue-text').textContent=s.dialogue;
    const investigation=investigationView(s);
    get('exp-investigation').hidden=!investigation;
    get('exp-dialogue').dataset.investigation=String(!!investigation);
    if(investigationKey!==(investigation?.key??'')){
      investigationKey=investigation?.key??'';
      const image=get<HTMLImageElement>('exp-investigation-image');
      if(investigation){
        image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(investigation.svg)}`;
        image.alt=investigation.title+'：'+investigation.caption;
        get('exp-investigation-title').textContent=investigation.title;
        get('exp-investigation-caption').textContent=investigation.caption;
      }else image.removeAttribute('src');
      get('exp-dialogue').scrollTop=0;
    }
    if(s.map!=='middle')gateFeedbackUntil=-1;
    get('exp-gate-feedback').hidden=s.tick>=gateFeedbackUntil||uiOpen||!!s.dialogue;
    root.dataset.gateSound=gateSound.status;
    const mementoImage=get<HTMLImageElement>('exp-memento-image');
    mementoImage.hidden=!s.inspectingMemento;
    if(s.inspectingMemento){const url=mementoImageUrl(s.inspectingMemento);if(mementoImage.getAttribute('src')!==url)mementoImage.src=url;}else mementoImage.removeAttribute('src');
    const collecting=!!s.inspectingMemento&&!!s.pending;
    get('exp-close').textContent=explorationDialogueAction(s);
    get('exp-memento-cancel').hidden=!collecting;
    if(s.mementos.length>lastMementoCount){collectionFeedback=s.mementoTitle?`已获得试制称号：${s.mementoTitle}`:'已收进纪念册，可在旅程记录中查看。';feedbackUntil=performance.now()+4500;}
    lastMementoCount=s.mementos.length;
    get('exp-memento-feedback').textContent=performance.now()<feedbackUntil?collectionFeedback:'';
    get('exp-photo').hidden=!s.photoPreview||uiOpen;
    get('exp-photo-card').hidden=!s.cardOpen||uiOpen;
    get('exp-card-memento-count').textContent=`${s.mementos.length}/3 · 全部选做`;
    get('exp-card-memento-title').textContent=s.mementoTitle??'尚未获得 · 选做奖励';
    get<HTMLButtonElement>('exp-shutter').disabled=s.pauseCount!==1||!s.photoPreview;
    if(s.photoPreview){
      const site=PHOTO_SITES[s.photoPreview.siteId];get('exp-photo-title').textContent=site.name;
      get('exp-photo-requirement').textContent=s.accepted?'游客希望：桥、江水与木楼同框':'尚未听完游客的取景要求';
      if(shownPhoto!==site.id){get<HTMLImageElement>('exp-photo-image').src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(explorationPhotoSvg(site.id))}`;shownPhoto=site.id;}
      get('exp-photo-feedback').textContent=s.photoPreview.feedback;
      get('exp-shutter').dataset.previewId=s.photoPreview.id;
    }
    const signature=JSON.stringify([s.objective,s.accepted,s.clue,s.item,s.unlocked,s.photographed,s.observations.map(o=>o.id),s.mementos.map(m=>m.id),s.mementoTitle]);
    if(signature!==notesSignature){
      renderExplorationJournal(root,s);
      notesSignature=signature;
    }
    for(const [view,id]of Object.entries({title:'exp-title-screen',intro:'exp-intro',menu:'exp-menu',journal:'exp-notes',help:'exp-instructions-panel',confirm:'exp-confirm'}))get(id).hidden=!views[view as View];
    const beginButton=get<HTMLButtonElement>('exp-begin');
    const beginLabel=hasJourney?'继续旅程':'开始冒险';
    if(beginButton.textContent!==beginLabel)beginButton.textContent=beginLabel;
    // The scene mounts behind the title. Begin only becomes actionable once the
    // real scene/resources are mounted, so the button never promises a no-op.
    beginButton.disabled=!sceneReady;
    root.dataset.sceneReady=String(sceneReady);
    const titleStatus=get('exp-title-status');
    const status=loadStatus!=='尚未保存'&&loadStatus.includes('未保存')
      ?loadStatus+'。可先试走；明确重新开始才会覆盖当前试玩记录。'
      :started?'当前旅程保留在本页，继续探索。':hasJourney?'上次的发现已保留，从安全地点继续。':'从解放碑出发，沿街巷自由探索。';
    if(titleStatus.textContent!==status)titleStatus.textContent=status;
    get('exp-restart-status').textContent=storage?.status.includes('无法写入')?storage.status:'';
    get('exp-archive-notice').hidden=!storage?.notice;
    root.dataset.view=views.confirm?'confirm':views.help?'help':views.journal?'journal':views.menu?'menu':views.title?'title':views.intro?'intro':s.cardOpen?'completion':'play';
    root.dataset.uiOwners=JSON.stringify(Object.keys(tokens));
    root.dataset.hasJourney=String(hasJourney);
    Object.assign(root.dataset,{runtimeId:s.runtimeId,map:s.map,x:String(s.position.x),y:String(s.position.y),tick:String(s.tick),paused:String(s.paused),tokens:String(s.pauseCount),
      target:s.target?.id??'',accepted:String(s.accepted),clue:String(s.clue),item:String(s.item),unlocked:String(s.unlocked),completed:String(s.completed),
      trackedTask:s.tracking.task,routeTarget:s.tracking.next?.id??'',routePoints:String(s.tracking.points.length),autoWalk:String(s.tracking.walking),ferry:s.ferry?.direction??'',ferryFraction:String(s.ferry?.fraction??0),
      revision:String(s.revision),mapRevision:String(s.mapRevision),progress:JSON.stringify(s.progress),dialogue:String(!!s.dialogue),preview:s.photoPreview?.siteId??'',previewId:s.photoPreview?.id??'',observations:JSON.stringify(s.observations.map(o=>o.id)),photographed:String(s.photographed),cardOpen:String(s.cardOpen),pending:s.pending??'',mementoInspection:s.mementoInspectionId??'',mementos:JSON.stringify(s.mementos.map(m=>m.id)),mementoTitle:s.mementoTitle??'',safe:s.safe,worldWidth:String(s.worldWidth),worldHeight:String(s.worldHeight),disposed:String(s.disposed)});
    // Move focus only at panel boundaries, never on each simulation frame.
    // This does not submit an action or replace the existing gesture guards.
    const panel=uiOpen?undefined:s.dialogue?get('exp-dialogue'):s.photoPreview?get('exp-photo'):undefined;
    if(panel!==focusedPanel){
      const previous=focusedPanel;focusedPanel=panel;
      if(panel){
        if(!previous)returnFocus=document.activeElement instanceof HTMLElement&&root.contains(document.activeElement)?document.activeElement:root;
        if(document.visibilityState!=='hidden')focus(s.photoPreview?'exp-photo-close':'exp-close');
      }else{
        if(!uiOpen&&!s.cardOpen&&previous?.contains(document.activeElement)&&document.visibilityState!=='hidden'){
          const target=returnFocus?.isConnected&&returnFocus.getClientRects().length&&!returnFocus.matches(':disabled')?returnFocus:root;
          target.focus({preventScroll:true});
        }
        returnFocus=undefined;
      }
    }
    const cardOpened=!!s.cardOpen&&!lastCardOpen;
    lastCardOpen=!!s.cardOpen;
    if(cardOpened)focus('exp-card-close');
  };
  const setView=(view:View,open:boolean,{preserveCard=false}:{preserveCard?:boolean}={})=>{
    if(!runtime||disposed)return;
    input?.clear();shutterGesture=undefined;photoCloseGesture=undefined;mementoGesture=undefined;dialogueCloseGesture=undefined;
    if(open&&!tokens[view])tokens[view]=runtime.lifecycle.acquire(owners[view],Symbol(view));
    if(open){runtime.closeDialogue(false);runtime.closePhotoPreview(false);if(!preserveCard)runtime.closePhotoCard();}
    if(!open&&tokens[view]){runtime.lifecycle.release(owners[view],tokens[view]);delete tokens[view];}
    views[view]=open;update();
  };
  const focus=(id:string)=>get(id).focus({preventScroll:true});
  const hideLoading=()=>{
    const loading=get('exp-loading');
    loading.classList.add('is-done');
    window.setTimeout(()=>{if(!disposed)loading.hidden=true;},300);
  };
  const setMenu=(open:boolean)=>{setView('menu',open);focus(open?'exp-resume':'exp-menu-button');};
  const setJournal=(open:boolean)=>{setView('journal',open);focus(open?'exp-notes-close':views.menu?'exp-menu-journal':'exp-notes-toggle');};
  const startJourney=(from:'title'|'intro')=>{
    started=true;hasJourney=true;
    setView(from,false);
    root.focus({preventScroll:true});
  };
  const begin=()=>{
    if(hasJourney||started){startJourney('title');return;}
    setView('intro',true);
    setView('title',false);
    focus('exp-intro-start');
  };
  const returnTitle=()=>{
    setView('title',true);
    for(const view of ['intro','menu','journal','help','confirm'] as const)if(views[view])setView(view,false);
    focus('exp-begin');
  };
  const cancelRestart=()=>{
    const source=restartSource;
    setView('confirm',false);
    if(source==='card'&&!runtime?.snapshot.cardOpen){runtime?.openPhotoCard();update();}
    focus(source==='card'&&runtime?.snapshot.cardOpen?'exp-card-restart':views.title?'exp-title-restart':'exp-restart');
    restartSource='play';
  };
  const closeInstructions=()=>{
    setView('help',false);
    if(views.title)focus('exp-instructions');
    else if(views.menu)focus('exp-menu-help');
    else if(!get('exp-onboarding').hidden)focus('exp-onboarding-help');
    else root.focus({preventScroll:true});
  };
  const escape=()=>{
    if(views.confirm)cancelRestart();
    else if(views.help)closeInstructions();
    else if(views.intro)returnTitle();
    else if(views.journal)setJournal(false);
    else if(!views.title)setMenu(!views.menu);
  };
  const close=()=>{
    const before=runtime?.snapshot;
    input?.clear();dialogueCloseGesture=undefined;
    if(runtime?.snapshot.photoPreview)runtime.closePhotoPreview();else if(runtime?.snapshot.cardOpen)runtime.closePhotoCard();else runtime?.closeDialogue(true,runtime.snapshot.mementoInspectionId);
    if(before&&runtime&&committedGateOpening(before,runtime.snapshot)){
      gateFeedbackUntil=runtime.snapshot.tick+225;
      void gateSound.play();
    }
    mementoGesture=undefined;update();
  };
  const on=(id:string,callback:()=>void)=>get(id).addEventListener('click',callback,{signal:abort.signal});
  const dispose=async()=>{
    if(disposed)return;
    disposed=true;
    shutterGesture=undefined;
    photoCloseGesture=undefined;
    mementoGesture=undefined;
    dialogueCloseGesture=undefined;
    // Reverse acquisition order: frame/rendering, platform listeners, runtime.
    for(const release of cleanup.reverse())await release();
    for(const view of Object.keys(tokens) as View[]){if(runtime&&tokens[view])runtime.lifecycle.release(owners[view],tokens[view]);delete tokens[view];}
    abort.abort();runtime?.dispose();
    get('exp-photo').hidden=true;get('exp-photo-card').hidden=true;
    get('exp-photo-image').removeAttribute('src');get('exp-card-image').removeAttribute('src');
    get('exp-investigation-image').removeAttribute('src');get('exp-gate-feedback').hidden=true;
    for(const img of Array.from(root.querySelectorAll('#exp-memento-list img, #exp-memento-image')))img.removeAttribute('src');
    root.dataset.disposed='true';root.dataset.tokens='0';root.dataset.hostBindings='0';
    // Backstop: a bfcache restore must never sit under the loading veil.
    get('exp-loading').hidden=true;
  };
  try {
    // Access can itself throw (private/blocked storage). Keep an explicit failure port.
    let port:Storage;
    try {port=localStorage;}catch {port={getItem:()=>{throw new Error('Storage unavailable');}} as unknown as Storage;}
    if(artSample){
      const memory=new Map<string,string>([['pokan.exp06a.save.v1',JSON.stringify({...emptyExplorationSave(),safe:'cGuideH3'})]]);
      port={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{memory.set(key,value);},removeItem:(key:string)=>{memory.delete(key);}} as Storage;
    }
    storage=new ExplorationStorage(port);
    const loaded=storage.load();loadStatus=storage.status;hasJourney=!!loaded;
    runtime=new ExplorationRuntime(runtimeUuidProvider().generate(),loaded);
    if(artSample)runtime.trackTask('none');
    lastMementoCount=runtime.snapshot.mementos.length;
    // Acquire before mounting Phaser or binding input: even the first frame is paused.
    if(showTitle)tokens.title=runtime.lifecycle.acquire(owners.title,Symbol('initial-title'));
    input=bindExplorationInput({runtime,root,stick:get('exp-stick'),knob:get('exp-knob'),interact:get<HTMLButtonElement>('exp-interact'),close,menu:escape,changed:update,
      uiKey:event=>!!orientationToken||Object.values(views).some(Boolean)&&(event.code==='KeyE'||event.code==='Space')||
        event.code==='Space'&&event.target instanceof HTMLButtonElement&&!!event.target.closest('#exp-onboarding, #exp-auto-walk')||
        !!runtime?.snapshot.cardOpen&&event.code==='Space'&&event.target instanceof HTMLButtonElement});
    cleanup.push(input.dispose);
    const orientationNotice=get('exp-orientation');
    const orientationContent=Array.from(root.children).filter((child):child is HTMLElement=>child instanceof HTMLElement&&child!==orientationNotice);
    let focusBeforeRotation:HTMLElement|undefined;
    const orient=()=>{
      if(!runtime||phoneUpright.matches===!!orientationToken)return;
      input?.clear();
      shutterGesture=undefined;photoCloseGesture=undefined;mementoGesture=undefined;dialogueCloseGesture=undefined;
      if(phoneUpright.matches){
        focusBeforeRotation=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
        orientationToken=runtime.lifecycle.acquire(orientationOwner,Symbol('phone-orientation'));
        gateSound.stop();
      }else if(orientationToken){
        runtime.lifecycle.release(orientationOwner,orientationToken);
        orientationToken=undefined;
      }
      orientationNotice.hidden=!orientationToken;
      // The title screen also stays inert until the scene is ready, so its buttons
      // cannot be Tab-reached and fired while the loading veil is still up.
      for(const element of orientationContent)element.inert=!!orientationToken||(element.id==='exp-title-screen'&&!sceneReady);
      update();
      if(orientationToken)orientationNotice.focus({preventScroll:true});
      else if(focusBeforeRotation?.isConnected&&root.contains(focusBeforeRotation)&&focusBeforeRotation.getClientRects().length){
        focusBeforeRotation.focus({preventScroll:true});
      }else if(views.title&&sceneReady)focus('exp-begin');
      else root.focus({preventScroll:true});
    };
    phoneUpright.addEventListener('change',orient,{signal:abort.signal});
    cleanup.push(()=>{if(runtime&&orientationToken)runtime.lifecycle.release(orientationOwner,orientationToken);});
    orient();
    root.dataset.inputBindings='1';root.dataset.hostBindings='1';
    const visibility=bindVisibilityPause(runtime.lifecycle,()=>{input?.clear();if(document.visibilityState==='hidden'){gateSound.stop();runtime?.closeDialogue(false);runtime?.closePhotoPreview(false);runtime?.closePhotoCard();}update();});cleanup.push(visibility);
    const collectButton=get<HTMLButtonElement>('exp-close');
    collectButton.addEventListener('pointerdown',event=>{
      const s=runtime?.snapshot,id=s?.mementoInspectionId;
      mementoGesture=id?{id,pointerId:event.pointerId,released:false}:undefined;
      dialogueCloseGesture=s?.dialogue&&!id?{generation:dialogueGeneration,pointerId:event.pointerId,released:false}:undefined;
    },{signal:abort.signal});
    collectButton.addEventListener('pointerup',event=>{
      if(mementoGesture?.pointerId===event.pointerId)mementoGesture.released=true;
      if(dialogueCloseGesture?.pointerId===event.pointerId)dialogueCloseGesture.released=true;
    },{signal:abort.signal});
    collectButton.addEventListener('pointercancel',()=>{mementoGesture=undefined;dialogueCloseGesture=undefined;},{signal:abort.signal});
    collectButton.addEventListener('lostpointercapture',event=>{
      if(mementoGesture?.pointerId===event.pointerId&&!mementoGesture.released)mementoGesture=undefined;
      if(dialogueCloseGesture?.pointerId===event.pointerId&&!dialogueCloseGesture.released)dialogueCloseGesture=undefined;
    },{signal:abort.signal});
    collectButton.addEventListener('click',event=>{
      const inspection=runtime?.snapshot.mementoInspectionId;
      if(inspection&&event.detail!==0&&(!mementoGesture?.released||mementoGesture.id!==inspection)){mementoGesture=undefined;return;}
      if(!inspection&&event.detail!==0&&(!dialogueCloseGesture?.released||dialogueCloseGesture.pointerId!==event.pointerId||dialogueCloseGesture.generation!==dialogueGeneration)){dialogueCloseGesture=undefined;return;}
      close();
    },{signal:abort.signal});
    on('exp-memento-cancel',()=>{input?.clear();mementoGesture=undefined;runtime?.closeDialogue(false);update();});
    on('exp-menu-button',()=>setMenu(!views.menu));on('exp-resume',()=>setMenu(false));
    on('exp-weather',()=>{
      weather=weather==='dusk'?'rain':'dusk';
      get('exp-weather').textContent=weather==='rain'?'天气 · 小雨':'天气 · 夕照';
      setMenu(false);
    });
    const photoClose=get<HTMLButtonElement>('exp-photo-close');
    photoClose.addEventListener('pointerdown',event=>{
      const preview=runtime?.snapshot.photoPreview;
      photoCloseGesture=preview?{id:preview.id,pointerId:event.pointerId,released:false}:undefined;
    },{signal:abort.signal});
    photoClose.addEventListener('pointerup',event=>{
      if(photoCloseGesture?.pointerId===event.pointerId)photoCloseGesture.released=true;
    },{signal:abort.signal});
    photoClose.addEventListener('pointercancel',()=>{photoCloseGesture=undefined;},{signal:abort.signal});
    photoClose.addEventListener('lostpointercapture',event=>{
      if(photoCloseGesture?.pointerId===event.pointerId&&!photoCloseGesture.released)photoCloseGesture=undefined;
    },{signal:abort.signal});
    photoClose.addEventListener('click',event=>{
      const preview=runtime?.snapshot.photoPreview;
      const owned=event.detail===0||photoCloseGesture?.released&&photoCloseGesture.pointerId===event.pointerId&&photoCloseGesture.id===preview?.id;
      photoCloseGesture=undefined;
      if(!disposed&&preview&&owned)close();
    },{signal:abort.signal});
    on('exp-photo-menu',()=>setMenu(true));
    const shutter=get<HTMLButtonElement>('exp-shutter');
    shutter.addEventListener('pointerdown',event=>{
      const preview=runtime?.snapshot.photoPreview;
      shutterGesture=preview?{id:preview.id,pointerId:event.pointerId,released:false}:undefined;
    },{signal:abort.signal});
    shutter.addEventListener('pointerup',event=>{if(shutterGesture?.pointerId===event.pointerId)shutterGesture.released=true;},{signal:abort.signal});
    shutter.addEventListener('pointercancel',()=>{shutterGesture=undefined;},{signal:abort.signal});
    shutter.addEventListener('lostpointercapture',event=>{if(shutterGesture?.pointerId===event.pointerId&&!shutterGesture.released)shutterGesture=undefined;},{signal:abort.signal});
    shutter.addEventListener('click',event=>{
      if(disposed||!runtime)return;
      // Pointer gestures carry the preview identity from press time; an old
      // pointer released after cancellation cannot shoot a reopened preview.
      const id=event.detail===0?shutter.dataset.previewId:shutterGesture?.released?shutterGesture.id:undefined;
      shutterGesture=undefined;input?.clear();runtime.takePhoto(id??'');update();
    },{signal:abort.signal});
    on('exp-card-close',close);
    on('exp-card-title',returnTitle);
    on('exp-card-restart',()=>{restartSource='card';setView('confirm',true,{preserveCard:true});focus('exp-cancel-restart');});
    on('exp-card-reopen',()=>{input?.clear();shutterGesture=undefined;setView('journal',false);setView('menu',false);runtime?.openPhotoCard();update();});
    on('exp-notes-toggle',()=>setJournal(true));on('exp-menu-journal',()=>setJournal(true));on('exp-notes-close',()=>setJournal(false));
    for(const task of ['main','bookmark','sketch','postcard','none'] as const){
      on(`exp-track-${task}`,()=>{runtime?.trackTask(task);setJournal(false);});
    }
    on('exp-auto-walk',()=>{
      if(!runtime)return;
      if(runtime.snapshot.tracking.walking)runtime.stopAutoWalk();
      else runtime.startAutoWalk();
      root.focus({preventScroll:true});
      update();
    });
    get<HTMLImageElement>('exp-card-image').src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(explorationPhotoSvg('river'))}`;
    on('exp-begin',begin);on('exp-title',returnTitle);
    on('exp-intro-start',()=>startJourney('intro'));on('exp-intro-back',returnTitle);
    const instructions=()=>{setView('help',true);focus('exp-instructions-close');};
    on('exp-instructions',instructions);on('exp-menu-help',instructions);on('exp-onboarding-help',instructions);
    on('exp-onboarding-skip',()=>{input?.clear();runtime?.skipOnboarding();update();root.focus({preventScroll:true});});
    on('exp-onboarding-replay',()=>{runtime?.replayOnboarding();setView('help',false);if(views.menu)setView('menu',false);update();root.focus({preventScroll:true});});
    on('exp-instructions-close',closeInstructions);
    const confirm=(source:'play'|'title'='play')=>{restartSource=source;setView('confirm',true);focus('exp-cancel-restart');};
    on('exp-restart',()=>confirm('play'));on('exp-title-restart',()=>confirm('title'));
    on('exp-cancel-restart',cancelRestart);
    on('exp-confirm-restart',()=>{if(storage?.restart())location.reload();else update();});
    window.addEventListener('resize',()=>{shutterGesture=undefined;photoCloseGesture=undefined;mementoGesture=undefined;dialogueCloseGesture=undefined;update();},{signal:abort.signal});
    window.addEventListener('blur',()=>{shutterGesture=undefined;photoCloseGesture=undefined;mementoGesture=undefined;dialogueCloseGesture=undefined;},{signal:abort.signal});
    root.addEventListener('keydown',event=>{
      if(event.code!=='Tab')return;
      if(orientationToken){event.preventDefault();return;}
      const panel=[get('exp-confirm'),get('exp-instructions-panel'),get('exp-notes'),get('exp-menu'),get('exp-title-screen'),get('exp-intro'),get('exp-photo-card'),get('exp-photo'),get('exp-dialogue')].find(p=>!p.hidden);
      if(!panel)return;
      const buttons=Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).filter(b=>!b.disabled&&b.getClientRects().length>0);
      const first=buttons[0],last=buttons.at(-1);
      if(first&&event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(first&&!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
    },{signal:abort.signal});
    window.addEventListener('pagehide',()=>{void dispose();},{once:true,signal:abort.signal});
    const scene=await mountExplorationScene(get('exp-stage'),runtime,update,()=>weather);
    if(disposed){get('exp-loading').hidden=true;await scene.destroy();return {dispose};}
    cleanup.push(scene.destroy);
    sceneReady=true;
    // Readiness unlocks the title only when the orientation lock is also clear.
    get('exp-title-screen').inert=!!orientationToken;
    update();root.dataset.ready='true';hideLoading();
    if(showTitle&&!orientationToken)focus('exp-begin');
    return {dispose};
  }catch(error){
    get('exp-loading').hidden=true;
    await dispose();get('exp-error').hidden=false;get('exp-error').textContent='探索小样启动失败，请刷新重试。';throw error;
  }
}
