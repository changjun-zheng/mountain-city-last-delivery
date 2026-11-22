import {RANKS,RANK_COLORS} from './content';
import {score,type PhotoRuntime} from './runtime';
const AREA_NAMES=['洪崖洞观景台','沧白路街道'];
export function createUI(root:HTMLElement,putDown:()=>void){
 const panel=document.createElement('section');panel.className='photo-ui';
 panel.innerHTML=`<header><span class="photo-eyebrow">上街 · 镜头练习</span><h1>把这一刻，留在山城</h1><p>沿真实街面找位置，让木楼、檐廊与江光入画。</p></header><nav class="photo-actions"><button type="button" class="photo-put-down">放下相机 <kbd>Esc</kbd></button><a href="/">返回游戏标题</a></nav><section class="photo-album" aria-label="上街相册"></section><div class="photo-mode"></div><output aria-live="polite"><strong></strong><span></span></output><div class="photo-prompt"></div><p class="photo-complete"></p><div class="photo-flash" aria-hidden="true"></div>`;
 root.append(panel);panel.querySelector('button')!.addEventListener('click',putDown);let albumSignature='';
 return(r:PhotoRuntime)=>{
  const signature=r.album.join(',')+'|'+r.area;
  if(signature!==albumSignature){
   albumSignature=signature;
   const cards:HTMLDivElement=panel.querySelector('.photo-album')!;
   cards.innerHTML=[0,1,2,3,4,5].map(idx=>{const rank=r.album[idx];return `<article style="--rank:${RANK_COLORS[rank]}" class="${rank?'owned':''}"><div class="photo-mini"><i></i><i></i><i></i></div><span>${['观·茶','观·木','观·坊','沧·铺','沧·街','沧·坊'][idx]}</span><strong><b>●</b> ${rank?RANKS[rank]:'待发现'}</strong></article>`;}).join('');
  }
  panel.querySelector<HTMLButtonElement>('.photo-put-down')!.hidden=r.site<0||r.mode==='indoor';
  const indoor=r.mode==='indoor';
  (panel.querySelector('.photo-album') as HTMLElement).style.display=indoor?'none':'';
  (panel.querySelector('.photo-prompt') as HTMLElement).style.display=indoor?'none':'';
  panel.querySelector('.photo-mode')!.textContent=indoor?'屋内 · 慢慢看':r.site>=0?`${AREA_NAMES[r.area]} · ${r.sites[r.site].name} / ${r.zoom.toFixed(1)}×`:`${AREA_NAMES[r.area]} · 自由找景`;
  panel.querySelector('.photo-prompt')!.innerHTML=r.site>=0?'<kbd>WASD / 方向键</kbd> 走位　<kbd>Shift</kbd> 长焦　<kbd>空格</kbd> 快门　<kbd>Esc</kbd> 放下':r.nearby>=0?'<kbd>E</kbd> 举起相机 · '+r.sites[r.nearby].name:'<kbd>WASD / 方向键</kbd> 漫步　靠近金色机位按 <kbd>E</kbd>　<kbd>F</kbd> 区域切换';
  const out=panel.querySelector('output')!;out.hidden=!r.result;out.style.color=RANK_COLORS[r.rank]||'#f0c96a';out.querySelector('strong')!.textContent=r.result;out.querySelector('span')!.textContent=r.reason||'已留在相册 · 随时调整位置，再拍一张';
  panel.querySelector('.photo-complete')!.textContent=r.album.every(v=>v>0)?'六处街景，已收入相册。还想再拍一张吗？':'';
  panel.querySelector<HTMLElement>('.photo-flash')!.style.opacity=String(r.flash/100*.85);
  const composition=r.site>=0?r.composition(innerWidth,innerHeight):null,judgment=composition?score(composition.frame,composition.subject):null;
  Object.assign(root.dataset,{x:String(r.x),y:String(r.y),area:String(r.area),site:String(r.site),nearby:String(r.nearby),album:JSON.stringify(r.album),shots:String(r.shots),result:r.result,reason:r.reason,zoom:String(r.zoom),flash:String(r.flash),frame:JSON.stringify(composition?.frame??null),subject:JSON.stringify(composition?.subject??null),coverage:String(judgment?.coverage??0),inFrame:String(judgment?.inside??false)});
 };
}
