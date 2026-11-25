import type { ExplorationRuntime } from '../../core/exploration';

// Physical keys and pointer IDs remain independent until projection.
export class ExplorationInputSources {
  readonly keys = new Set<string>();
  readonly pointers = new Map<number, { x: number; y: number; interact: boolean }>();
  key(code: string, down: boolean) { if (down) this.keys.add(code); else this.keys.delete(code); }
  clear() { this.keys.clear(); this.pointers.clear(); }
  get snapshot() {
    const any = (...codes: string[]) => codes.some(c=>this.keys.has(c));
    let x = Number(any('KeyD','ArrowRight'))-Number(any('KeyA','ArrowLeft'));
    let y = Number(any('KeyS','ArrowDown'))-Number(any('KeyW','ArrowUp'));
    let interact=any('KeyE','Space');
    for(const p of this.pointers.values()){x+=p.x;y+=p.y;interact ||= p.interact;}
    const n=Math.max(1,Math.hypot(x,y));
    return {x:x/n,y:y/n,interact,keys:[...this.keys],pointers:this.pointers.size};
  }
}

export function bindExplorationInput(options: {
  runtime: ExplorationRuntime; root: HTMLElement; stick: HTMLElement; knob: HTMLElement;
  interact: HTMLButtonElement; close: () => void; menu: () => void; changed: () => void;
  uiKey?: (event:KeyboardEvent)=>boolean;
}) {
  const {runtime,root,stick,knob,interact,changed}=options;
  const sources=new ExplorationInputSources();
  const held=new Set<string>();
  const suppressed=new Set<string>();
  const abort=new AbortController();
  let disposed=false;
  let stickPointer:number|undefined;
  let lastMap=runtime.snapshot.mapRevision;
  let lastLocked=false;
  let lastDialogue=false;
  const publish=()=>{
    if(disposed)return;
    const s=sources.snapshot;
    runtime.move(s.x,s.y,s.keys.includes('ShiftLeft')||s.keys.includes('ShiftRight'));runtime.interact(s.interact);
    root.dataset.input=JSON.stringify(s);
    changed();
  };
  const clear=()=>{
    for(const k of held)suppressed.add(k);
    const captures=[...sources.pointers.keys()];
    sources.clear();stickPointer=undefined;knob.style.transform='translate(0px,0px)';runtime.clearInput();
    for(const id of captures) for(const el of [stick,interact]) if(el.hasPointerCapture(id))el.releasePointerCapture(id);
    root.dataset.input=JSON.stringify(sources.snapshot);
  };
  const keys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','KeyE','Space','ShiftLeft','ShiftRight']);
  window.addEventListener('keydown',e=>{
    if(options.uiKey?.(e))return;
    if(e.code==='Escape' && !e.repeat){e.preventDefault();options.menu();return;}
    if(!keys.has(e.code))return;
    if(e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    e.preventDefault();held.add(e.code);
    if(e.repeat || suppressed.has(e.code))return;
    if((runtime.snapshot.dialogue || runtime.snapshot.photoPreview || runtime.snapshot.cardOpen) && (e.code==='KeyE'||e.code==='Space')){
      suppressed.add(e.code);options.close();return;
    }
    if(runtime.lifecycle.pauseCount){suppressed.add(e.code);return;}
    sources.key(e.code,true);publish();
  },{signal:abort.signal});
  window.addEventListener('keyup',e=>{held.delete(e.code);suppressed.delete(e.code);sources.key(e.code,false);publish();},{signal:abort.signal});
  const release=(e:PointerEvent)=>{
    if(!sources.pointers.has(e.pointerId))return;
    sources.pointers.delete(e.pointerId);
    if(e.pointerId===stickPointer){stickPointer=undefined;knob.style.transform='translate(0px,0px)';}
    publish();
  };
  const drag=(e:PointerEvent)=>{
    if(e.pointerId!==stickPointer)return;
    const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
    const len=Math.hypot(dx,dy),n=Math.max(32,len);
    const x=len<7?0:dx/n,y=len<7?0:dy/n;
    sources.pointers.set(e.pointerId,{x,y,interact:false});
    knob.style.transform=`translate(${x*28}px,${y*28}px)`;publish();
  };
  for(const el of [stick,interact]) {
    el.addEventListener('pointerdown',e=>{
      e.preventDefault();
      if(runtime.lifecycle.pauseCount || sources.pointers.has(e.pointerId))return;
      if(el===stick && stickPointer!==undefined)return;
      el.setPointerCapture(e.pointerId);
      if(el===stick){stickPointer=e.pointerId;drag(e);}
      else {sources.pointers.set(e.pointerId,{x:0,y:0,interact:true});publish();}
    },{signal:abort.signal});
    for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)el.addEventListener(name,release,{signal:abort.signal});
  }
  stick.addEventListener('pointermove',drag,{signal:abort.signal});
  window.addEventListener('blur',clear,{signal:abort.signal});
  document.addEventListener('visibilitychange',clear,{signal:abort.signal});
  window.addEventListener('resize',clear,{signal:abort.signal});
  window.addEventListener('orientationchange',clear,{signal:abort.signal});
  return {
    clear,
    sync:()=>{
      const s=runtime.snapshot,locked=!!s.pauseCount;
      if((lastMap!==s.mapRevision && !s.walkedAcrossStreet) || lastLocked!==locked || lastDialogue!==!!s.dialogue)clear();
      lastMap=s.mapRevision;lastLocked=locked;lastDialogue=!!s.dialogue;
    },
    dispose:()=>{if(disposed)return;clear();disposed=true;abort.abort();held.clear();suppressed.clear();root.dataset.inputBindings='0';},
  };
}
