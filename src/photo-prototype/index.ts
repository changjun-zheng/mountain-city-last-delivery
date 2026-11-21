import {PhotoRuntime} from './runtime';
import {SAVE_KEY} from './content';
import {mountScene} from './scene';
import {createUI} from './ui';
import './styles.css';
export function launchPhotoPrototype(){
 const root=document.createElement('main');root.className='photo-prototype';root.id='photo-prototype';document.body.append(root);
 const r=new PhotoRuntime(),keys=new Set<string>(),abort=new AbortController();
 try{const album=JSON.parse(localStorage.getItem(SAVE_KEY)??'null');if(Array.isArray(album)&&album.length===6&&album.every(v=>Number.isInteger(v)&&v>=0&&v<=3))r.album=[...album];}catch{/* Independent slice remains playable when storage is unavailable. */}
 const putDown=()=>{keys.clear();r.exit();update(r);};
 const update=createUI(root,putDown),syncZoom=()=>{r.zoom=keys.has('ShiftLeft')||keys.has('ShiftRight')?1.8:1;};
 window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();putDown();return;}
  if(!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyE','KeyC','KeyF','KeyT','KeyR','Space','Escape'].includes(e.code))return;
  e.preventDefault();keys.add(e.code);syncZoom();if(e.repeat)return;
  if(e.code==='KeyE')r.enter();else if(e.code==='KeyC')r.gender=r.gender?0:1;else if(e.code==='Escape')putDown();
  else if(e.code==='Space'&&r.site>=0){r.shoot(innerWidth,innerHeight);try{localStorage.setItem(SAVE_KEY,JSON.stringify(r.album));}catch{r.reason+=' · 本次无法保存';}}
  update(r);
 },{signal:abort.signal});
 window.addEventListener('keyup',e=>{keys.delete(e.code);syncZoom();update(r);},{signal:abort.signal});
 const clear=()=>{keys.clear();syncZoom();update(r);};window.addEventListener('blur',clear,{signal:abort.signal});document.addEventListener('visibilitychange',clear,{signal:abort.signal});
 (window as unknown as Record<string,unknown>).__photo=r;
 const destroy=mountScene(root,r,keys,()=>update(r));window.addEventListener('pagehide',()=>{abort.abort();destroy();},{once:true});update(r);
}
