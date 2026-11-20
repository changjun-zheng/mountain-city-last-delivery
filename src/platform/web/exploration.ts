import { ExplorationRuntime } from '../../core/exploration';
import { mountExplorationScene } from '../../rendering/phaser/exploration';
import { bindExplorationInput } from './exploration-input';
import { ExplorationStorage } from './exploration-storage';
import { bindVisibilityPause } from './visibility';
import { runtimeUuidProvider } from './runtime-uuid';
import type { PauseToken } from '../../core/lifecycle';
import {PHOTO_SITES,type PhotoSiteId} from '../../core/exploration-photo';
import {explorationPhotoSvg} from '../../rendering/phaser/exploration-photo-art';

export async function launchExploration() {
  document.title='坡坎之间 · 核心街区';
  document.body.classList.add('exp-mode');
  const root=document.createElement('section');
  root.id='exp-root';root.setAttribute('aria-label','坡坎之间探索小样');
  root.innerHTML=`
    <div id="exp-stage" role="img" aria-label="可行走的木廊街区"></div>
    <header class="exp-hud"><div><strong>坡坎之间</strong><span id="exp-place">木廊探路</span></div><p id="exp-objective"></p><button id="exp-menu-button" type="button">暂停</button></header>
    <aside class="exp-record"><p id="exp-clue">线索：尚未发现</p><p id="exp-item">随身：空</p><small id="exp-save" role="status"></small><p id="exp-archive-notice"></p><button id="exp-notes-toggle" type="button">取景记录</button><button id="exp-card-reopen" type="button" hidden>重看纪念卡</button><div id="exp-notes" hidden><p id="exp-notes-requirement"></p><ul id="exp-notes-list"></ul></div></aside>
    <p id="exp-help">WASD / 方向键行走　E / 空格交互　Esc 暂停</p>
    <p id="exp-orientation" hidden>建议横屏，获得更完整的街区视野</p>
    <div id="exp-touch"><div id="exp-stick" role="group" aria-label="移动摇杆"><span id="exp-knob"></span></div><button id="exp-interact" type="button">交互</button></div>
    <p id="exp-prompt"></p>
    <section id="exp-dialogue" class="exp-panel" role="dialog" aria-label="调查对话" hidden><p id="exp-dialogue-text"></p><button id="exp-close" type="button">收起 · E</button></section>
    <section id="exp-photo" class="exp-photo-overlay" role="dialog" aria-label="取景预览" hidden><div class="exp-panel exp-photo-panel"><h2 id="exp-photo-title"></h2><p id="exp-photo-requirement"></p><img id="exp-photo-image" alt="游戏内原创取景预览"/><p id="exp-photo-feedback" role="status"></p><div class="exp-photo-actions"><button id="exp-shutter" type="button">拍摄这一刻</button><button id="exp-photo-menu" type="button">暂停</button><button id="exp-photo-close" type="button">返回探索 · E</button></div></div></section>
    <section id="exp-photo-card" class="exp-photo-overlay" role="dialog" aria-label="夜景纪念卡" hidden><div class="exp-panel exp-photo-panel exp-postcard"><h2>坡坎之间</h2><p>把山城夜景寄给远方</p><img id="exp-card-image" alt="桥、江水与木楼同框的游戏内夜景纪念卡"/><p>桥连着两岸，木楼留着灯。你找到的这一刻，已经留在旅程里。</p><small>游戏内原创夜景纪念 · 核心街区委托</small><div class="exp-photo-actions"><button id="exp-card-close" type="button">返回探索 · E</button></div></div></section>
    <section id="exp-menu" class="exp-shade" role="dialog" aria-label="暂停菜单" hidden><div class="exp-panel"><h1 id="exp-menu-title">歇一会儿</h1><p>旅程与已发现的线索会保留。</p><button id="exp-resume" type="button">继续探索</button><button id="exp-title" type="button">返回标题</button><button id="exp-restart" type="button">重新开始</button><div id="exp-confirm" hidden><p>清除本小样的本地记录，开始新旅程？</p><button id="exp-confirm-restart" type="button">确认重新开始</button><button id="exp-cancel-restart" type="button">保留旅程</button></div></div></section>
    <p id="exp-error" role="alert" hidden></p>`;
  document.body.append(root);
  const get=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
  const cleanup:(()=>void|Promise<void>)[]=[];
  const abort=new AbortController();
  let disposed=false;
  let input:ReturnType<typeof bindExplorationInput>|undefined;
  let runtime:ExplorationRuntime|undefined;
  let storage:ExplorationStorage|undefined;
  let token:PauseToken|undefined;
  const owner=Symbol('exp-menu');
  let menu=false,title=false;
  let savedRevision=-1;
  let shownPhoto:PhotoSiteId|undefined;
  let notesSignature='';
  let shutterGesture:{id:string;pointerId:number;released:boolean}|undefined;
  const update=()=>{
    if(disposed||!runtime)return;
    input?.sync();
    const s=runtime.snapshot;
    if(shutterGesture&&shutterGesture.id!==s.photoPreview?.id)shutterGesture=undefined;
    if(savedRevision!==s.revision){storage?.save(runtime.save);savedRevision=s.revision;}
    get('exp-objective').textContent=s.objective;
    get('exp-place').textContent=s.place;
    get('exp-clue').textContent=s.clue?'线索：江纹向下，山纹留在上层':'线索：尚未发现';
    get('exp-item').textContent=s.item?'随身：江纹导扣 · 两道水波':'随身：空';
    get('exp-save').textContent=storage?.status??'本次未保存';
    get('exp-archive-notice').textContent=storage?.notice??'';
    get('exp-prompt').textContent=s.target&&!s.dialogue&&!s.photoPreview&&!s.cardOpen&&!menu?`E / 交互 · ${s.target.label}`:'';
    get<HTMLButtonElement>('exp-interact').disabled=!s.target||!!s.pauseCount;
    get('exp-dialogue').hidden=!s.dialogue||menu;
    get('exp-dialogue-text').textContent=s.dialogue;
    get('exp-photo').hidden=!s.photoPreview||menu;
    get('exp-photo-card').hidden=!s.cardOpen||menu;
    get('exp-card-reopen').hidden=!s.photographed;
    get<HTMLButtonElement>('exp-shutter').disabled=s.pauseCount!==1||!s.photoPreview;
    if(s.photoPreview){
      const site=PHOTO_SITES[s.photoPreview.siteId];get('exp-photo-title').textContent=site.name;
      get('exp-photo-requirement').textContent=s.accepted?'游客希望：桥、江水与木楼同框':'尚未听完游客的取景要求';
      if(shownPhoto!==site.id){get<HTMLImageElement>('exp-photo-image').src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(explorationPhotoSvg(site.id))}`;shownPhoto=site.id;}
      get('exp-photo-feedback').textContent=s.photoPreview.feedback;
      get('exp-shutter').dataset.previewId=s.photoPreview.id;
    }
    const signature=JSON.stringify([s.accepted,s.observations.map(o=>o.id)]);
    if(signature!==notesSignature){
      get('exp-notes-requirement').textContent=s.accepted?'游客要求：桥、江水与木楼同框':'尚未听完游客的取景要求';
      const list=get('exp-notes-list');list.replaceChildren();
      for(const observation of s.observations){const item=document.createElement('li');item.textContent=`${observation.name}：${observation.observation}`;list.append(item);}
      if(!s.observations.length){const item=document.createElement('li');item.textContent='尚未调查取景视野';list.append(item);}
      notesSignature=signature;
    }
    get('exp-menu').hidden=!menu;
    get('exp-menu-title').textContent=title?'坡坎之间':'歇一会儿';
    get('exp-title').hidden=title;
    get('exp-orientation').hidden=innerWidth>=innerHeight;
    Object.assign(root.dataset,{runtimeId:s.runtimeId,map:s.map,x:String(s.position.x),y:String(s.position.y),tick:String(s.tick),paused:String(s.paused),tokens:String(s.pauseCount),
      target:s.target?.id??'',accepted:String(s.accepted),clue:String(s.clue),item:String(s.item),unlocked:String(s.unlocked),completed:String(s.completed),
      revision:String(s.revision),mapRevision:String(s.mapRevision),progress:JSON.stringify(s.progress),dialogue:String(!!s.dialogue),preview:s.photoPreview?.siteId??'',previewId:s.photoPreview?.id??'',observations:JSON.stringify(s.observations.map(o=>o.id)),photographed:String(s.photographed),cardOpen:String(s.cardOpen),pending:s.pending??'',safe:s.safe,worldWidth:String(s.worldWidth),worldHeight:String(s.worldHeight),disposed:String(s.disposed)});
  };
  const setMenu=(open:boolean)=>{
    if(!runtime||disposed)return;
    input?.clear();shutterGesture=undefined;if(open){runtime.closeDialogue(false);runtime.closePhotoPreview(false);runtime.closePhotoCard();}menu=open;
    if(open&&!token)token=runtime.lifecycle.acquire(owner,Symbol('menu'));
    else if(!open&&token){runtime.lifecycle.release(owner,token);token=undefined;title=false;}
    get('exp-confirm').hidden=true;update();
  };
  const close=()=>{input?.clear();if(runtime?.snapshot.photoPreview)runtime.closePhotoPreview();else if(runtime?.snapshot.cardOpen)runtime.closePhotoCard();else runtime?.closeDialogue();update();};
  const on=(id:string,callback:()=>void)=>get(id).addEventListener('click',callback,{signal:abort.signal});
  const dispose=async()=>{
    if(disposed)return;
    disposed=true;
    shutterGesture=undefined;
    // Reverse acquisition order: frame/rendering, platform listeners, runtime.
    for(const release of cleanup.reverse())await release();
    if(runtime&&token)runtime.lifecycle.release(owner,token);
    token=undefined;abort.abort();runtime?.dispose();
    get('exp-photo').hidden=true;get('exp-photo-card').hidden=true;
    get('exp-photo-image').removeAttribute('src');get('exp-card-image').removeAttribute('src');
    root.dataset.disposed='true';root.dataset.tokens='0';root.dataset.hostBindings='0';
  };
  try {
    // Access can itself throw (private/blocked storage). Keep an explicit failure port.
    let port:Storage;
    try {port=localStorage;}catch {port={getItem:()=>{throw new Error('Storage unavailable');}} as unknown as Storage;}
    storage=new ExplorationStorage(port);
    runtime=new ExplorationRuntime(runtimeUuidProvider().generate(),storage.load());
    input=bindExplorationInput({runtime,root,stick:get('exp-stick'),knob:get('exp-knob'),interact:get<HTMLButtonElement>('exp-interact'),close,menu:()=>setMenu(!menu),changed:update});
    cleanup.push(input.dispose);
    root.dataset.inputBindings='1';root.dataset.hostBindings='1';
    const visibility=bindVisibilityPause(runtime.lifecycle,()=>{input?.clear();if(document.visibilityState==='hidden'){runtime?.closeDialogue(false);runtime?.closePhotoPreview(false);runtime?.closePhotoCard();}update();});cleanup.push(visibility);
    on('exp-close',close);on('exp-menu-button',()=>setMenu(!menu));on('exp-resume',()=>setMenu(false));
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
    on('exp-card-reopen',()=>{input?.clear();runtime?.openPhotoCard();update();});
    on('exp-notes-toggle',()=>{get('exp-notes').hidden=!get('exp-notes').hidden;});
    get<HTMLImageElement>('exp-card-image').src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(explorationPhotoSvg('river'))}`;
    on('exp-title',()=>{title=true;setMenu(true);});on('exp-restart',()=>{get('exp-confirm').hidden=false;});
    on('exp-cancel-restart',()=>{get('exp-confirm').hidden=true;});
    on('exp-confirm-restart',()=>{if(storage?.restart())location.reload();else update();});
    window.addEventListener('resize',()=>{shutterGesture=undefined;update();},{signal:abort.signal});
    window.addEventListener('blur',()=>{shutterGesture=undefined;},{signal:abort.signal});
    window.addEventListener('pagehide',()=>{void dispose();},{once:true,signal:abort.signal});
    const scene=await mountExplorationScene(get('exp-stage'),runtime,update);
    if(disposed){await scene.destroy();return {dispose};}
    cleanup.push(scene.destroy);
    update();root.dataset.ready='true';
    return {dispose};
  }catch(error){
    await dispose();get('exp-error').hidden=false;get('exp-error').textContent='探索小样启动失败，请刷新重试。';throw error;
  }
}
