import { ExplorationRuntime } from '../../core/exploration';
import { mountExplorationScene } from '../../rendering/phaser/exploration';
import { bindExplorationInput } from './exploration-input';
import { ExplorationStorage } from './exploration-storage';
import { bindVisibilityPause } from './visibility';
import { runtimeUuidProvider } from './runtime-uuid';
import type { PauseToken } from '../../core/lifecycle';
import {PHOTO_SITES,type PhotoSiteId} from '../../core/exploration-photo';
import {explorationPhotoSvg} from '../../rendering/phaser/exploration-photo-art';
import {explorationUiMarkup,renderExplorationJournal} from './exploration-ui';
import './exploration-ui.css';

export async function launchExploration({showTitle=true}:{showTitle?:boolean}={}) {
  document.title='坡坎之间';
  document.body.classList.add('exp-mode');
  const root=document.createElement('section');
  root.id='exp-root';root.setAttribute('aria-label','坡坎之间');
  root.innerHTML=explorationUiMarkup;
  document.body.append(root);
  const get=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
  const cleanup:(()=>void|Promise<void>)[]=[];
  const abort=new AbortController();
  let disposed=false;
  let input:ReturnType<typeof bindExplorationInput>|undefined;
  let runtime:ExplorationRuntime|undefined;
  let storage:ExplorationStorage|undefined;
  const views={title:showTitle,menu:false,journal:false,help:false,confirm:false};
  type View=keyof typeof views;
  const owners:Record<View,symbol>={title:Symbol('title'),menu:Symbol('menu'),journal:Symbol('journal'),help:Symbol('instructions'),confirm:Symbol('confirm')};
  const tokens:Partial<Record<View,PauseToken>>={};
  let started=!showTitle,hasJourney=false;
  let loadStatus='';
  let savedRevision=-1;
  let shownPhoto:PhotoSiteId|undefined;
  let notesSignature='';
  let shutterGesture:{id:string;pointerId:number;released:boolean}|undefined;
  const update=()=>{
    if(disposed||!runtime)return;
    input?.sync();
    const s=runtime.snapshot;
    if(shutterGesture&&shutterGesture.id!==s.photoPreview?.id)shutterGesture=undefined;
    if(started&&savedRevision!==s.revision){storage?.save(runtime.save);savedRevision=s.revision;}
    get('exp-objective').textContent=s.objective;
    get('exp-place').textContent=s.place;
    get('exp-save').textContent=storage?.status??'本次未保存';
    get('exp-archive-notice').textContent=storage?.notice??'';
    const uiOpen=Object.values(views).some(Boolean);
    get('exp-prompt').textContent=s.target&&!s.dialogue&&!s.photoPreview&&!s.cardOpen&&!uiOpen?`E / 交互 · ${s.target.label}`:'';
    get<HTMLButtonElement>('exp-interact').disabled=!s.target||!!s.pauseCount;
    get('exp-dialogue').hidden=!s.dialogue||uiOpen;
    get('exp-dialogue-text').textContent=s.dialogue;
    get('exp-photo').hidden=!s.photoPreview||uiOpen;
    get('exp-photo-card').hidden=!s.cardOpen||uiOpen;
    get<HTMLButtonElement>('exp-shutter').disabled=s.pauseCount!==1||!s.photoPreview;
    if(s.photoPreview){
      const site=PHOTO_SITES[s.photoPreview.siteId];get('exp-photo-title').textContent=site.name;
      get('exp-photo-requirement').textContent=s.accepted?'游客希望：桥、江水与木楼同框':'尚未听完游客的取景要求';
      if(shownPhoto!==site.id){get<HTMLImageElement>('exp-photo-image').src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(explorationPhotoSvg(site.id))}`;shownPhoto=site.id;}
      get('exp-photo-feedback').textContent=s.photoPreview.feedback;
      get('exp-shutter').dataset.previewId=s.photoPreview.id;
    }
    const signature=JSON.stringify([s.accepted,s.clue,s.item,s.unlocked,s.photographed,s.observations.map(o=>o.id)]);
    if(signature!==notesSignature){
      renderExplorationJournal(root,s);
      notesSignature=signature;
    }
    for(const [view,id]of Object.entries({title:'exp-title-screen',menu:'exp-menu',journal:'exp-notes',help:'exp-instructions-panel',confirm:'exp-confirm'}))get(id).hidden=!views[view as View];
    get('exp-begin').textContent=hasJourney?'继续旅程':'开始冒险';
    get('exp-title-status').textContent=loadStatus!=='尚未保存'&&loadStatus.includes('未保存')?loadStatus+'。可先试走；明确重新开始才会覆盖当前试玩记录。':started?'当前旅程保留在本页，继续探索。':hasJourney?'上次的发现已保留，从安全地点继续。':'从解放碑出发，沿街巷自由探索。';
    get('exp-restart-status').textContent=storage?.status.includes('无法写入')?storage.status:'';
    get('exp-archive-notice').hidden=!storage?.notice;
    get('exp-orientation').hidden=innerWidth>=innerHeight;
    root.dataset.view=views.confirm?'confirm':views.help?'help':views.journal?'journal':views.menu?'menu':views.title?'title':'play';
    root.dataset.uiOwners=JSON.stringify(Object.keys(tokens));
    root.dataset.hasJourney=String(hasJourney);
    Object.assign(root.dataset,{runtimeId:s.runtimeId,map:s.map,x:String(s.position.x),y:String(s.position.y),tick:String(s.tick),paused:String(s.paused),tokens:String(s.pauseCount),
      target:s.target?.id??'',accepted:String(s.accepted),clue:String(s.clue),item:String(s.item),unlocked:String(s.unlocked),completed:String(s.completed),
      revision:String(s.revision),mapRevision:String(s.mapRevision),progress:JSON.stringify(s.progress),dialogue:String(!!s.dialogue),preview:s.photoPreview?.siteId??'',previewId:s.photoPreview?.id??'',observations:JSON.stringify(s.observations.map(o=>o.id)),photographed:String(s.photographed),cardOpen:String(s.cardOpen),pending:s.pending??'',safe:s.safe,worldWidth:String(s.worldWidth),worldHeight:String(s.worldHeight),disposed:String(s.disposed)});
  };
  const setView=(view:View,open:boolean)=>{
    if(!runtime||disposed)return;
    input?.clear();shutterGesture=undefined;
    if(open&&!tokens[view])tokens[view]=runtime.lifecycle.acquire(owners[view],Symbol(view));
    if(open){runtime.closeDialogue(false);runtime.closePhotoPreview(false);runtime.closePhotoCard();}
    if(!open&&tokens[view]){runtime.lifecycle.release(owners[view],tokens[view]);delete tokens[view];}
    views[view]=open;update();
  };
  const focus=(id:string)=>get(id).focus({preventScroll:true});
  const setMenu=(open:boolean)=>{setView('menu',open);focus(open?'exp-resume':'exp-menu-button');};
  const setJournal=(open:boolean)=>{setView('journal',open);focus(open?'exp-notes-close':views.menu?'exp-menu-journal':'exp-notes-toggle');};
  const begin=()=>{started=true;hasJourney=true;setView('title',false);focus('exp-notes-toggle');};
  const returnTitle=()=>{
    setView('title',true);
    for(const view of ['menu','journal','help','confirm'] as const)if(views[view])setView(view,false);
    focus('exp-begin');
  };
  const escape=()=>{
    if(views.confirm){setView('confirm',false);focus(views.title?'exp-title-restart':'exp-restart');}
    else if(views.help){setView('help',false);focus(views.title?'exp-instructions':'exp-menu-help');}
    else if(views.journal)setJournal(false);
    else if(!views.title)setMenu(!views.menu);
  };
  const close=()=>{input?.clear();if(runtime?.snapshot.photoPreview)runtime.closePhotoPreview();else if(runtime?.snapshot.cardOpen)runtime.closePhotoCard();else runtime?.closeDialogue();update();};
  const on=(id:string,callback:()=>void)=>get(id).addEventListener('click',callback,{signal:abort.signal});
  const dispose=async()=>{
    if(disposed)return;
    disposed=true;
    shutterGesture=undefined;
    // Reverse acquisition order: frame/rendering, platform listeners, runtime.
    for(const release of cleanup.reverse())await release();
    for(const view of Object.keys(tokens) as View[]){if(runtime&&tokens[view])runtime.lifecycle.release(owners[view],tokens[view]);delete tokens[view];}
    abort.abort();runtime?.dispose();
    get('exp-photo').hidden=true;get('exp-photo-card').hidden=true;
    get('exp-photo-image').removeAttribute('src');get('exp-card-image').removeAttribute('src');
    root.dataset.disposed='true';root.dataset.tokens='0';root.dataset.hostBindings='0';
  };
  try {
    // Access can itself throw (private/blocked storage). Keep an explicit failure port.
    let port:Storage;
    try {port=localStorage;}catch {port={getItem:()=>{throw new Error('Storage unavailable');}} as unknown as Storage;}
    storage=new ExplorationStorage(port);
    const loaded=storage.load();loadStatus=storage.status;hasJourney=!!loaded;
    runtime=new ExplorationRuntime(runtimeUuidProvider().generate(),loaded);
    // Acquire before mounting Phaser or binding input: even the first frame is paused.
    if(showTitle)tokens.title=runtime.lifecycle.acquire(owners.title,Symbol('initial-title'));
    input=bindExplorationInput({runtime,root,stick:get('exp-stick'),knob:get('exp-knob'),interact:get<HTMLButtonElement>('exp-interact'),close,menu:escape,changed:update,
      uiKey:event=>Object.values(views).some(Boolean)&&event.code==='Space'&&event.target instanceof HTMLButtonElement});
    cleanup.push(input.dispose);
    root.dataset.inputBindings='1';root.dataset.hostBindings='1';
    const visibility=bindVisibilityPause(runtime.lifecycle,()=>{input?.clear();if(document.visibilityState==='hidden'){runtime?.closeDialogue(false);runtime?.closePhotoPreview(false);runtime?.closePhotoCard();}update();});cleanup.push(visibility);
    on('exp-close',close);on('exp-menu-button',()=>setMenu(!views.menu));on('exp-resume',()=>setMenu(false));
    on('exp-photo-close',close);
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
    on('exp-card-reopen',()=>{input?.clear();shutterGesture=undefined;setView('journal',false);setView('menu',false);runtime?.openPhotoCard();update();focus('exp-card-close');});
    on('exp-notes-toggle',()=>setJournal(true));on('exp-menu-journal',()=>setJournal(true));on('exp-notes-close',()=>setJournal(false));
    get<HTMLImageElement>('exp-card-image').src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(explorationPhotoSvg('river'))}`;
    on('exp-begin',begin);on('exp-title',returnTitle);
    const instructions=()=>{setView('help',true);focus('exp-instructions-close');};
    on('exp-instructions',instructions);on('exp-menu-help',instructions);
    on('exp-instructions-close',()=>{setView('help',false);focus(views.title?'exp-instructions':'exp-menu-help');});
    const confirm=()=>{setView('confirm',true);focus('exp-cancel-restart');};
    on('exp-restart',confirm);on('exp-title-restart',confirm);
    on('exp-cancel-restart',()=>{setView('confirm',false);focus(views.title?'exp-title-restart':'exp-restart');});
    on('exp-confirm-restart',()=>{if(storage?.restart())location.reload();else update();});
    window.addEventListener('resize',()=>{shutterGesture=undefined;update();},{signal:abort.signal});
    window.addEventListener('blur',()=>{shutterGesture=undefined;},{signal:abort.signal});
    root.addEventListener('keydown',event=>{
      if(event.code!=='Tab')return;
      const panel=[get('exp-confirm'),get('exp-instructions-panel'),get('exp-notes'),get('exp-menu'),get('exp-title-screen'),get('exp-photo-card'),get('exp-photo'),get('exp-dialogue')].find(p=>!p.hidden);
      if(!panel)return;
      const buttons=Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).filter(b=>!b.disabled&&b.getClientRects().length>0);
      const first=buttons[0],last=buttons.at(-1);
      if(first&&event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(first&&!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
    },{signal:abort.signal});
    window.addEventListener('pagehide',()=>{void dispose();},{once:true,signal:abort.signal});
    const scene=await mountExplorationScene(get('exp-stage'),runtime,update);
    if(disposed){await scene.destroy();return {dispose};}
    cleanup.push(scene.destroy);
    update();root.dataset.ready='true';if(showTitle)focus('exp-begin');
    return {dispose};
  }catch(error){
    await dispose();get('exp-error').hidden=false;get('exp-error').textContent='探索小样启动失败，请刷新重试。';throw error;
  }
}
