import {RANKS,SITES,RANK_COLORS} from './content';
import {score,type PhotoRuntime} from './runtime';
export function createUI(root:HTMLElement,putDown:()=>void){
 const panel=document.createElement('section');panel.className='photo-ui';
 panel.innerHTML=`<header><span class="photo-eyebrow">上街 · 镜头练习</span><h1>把这一刻，留在山城</h1><p>沿真实街面找位置，让木楼、檐廊与江光入画。</p></header><nav class="photo-actions"><button type="button" class="photo-put-down">放下相机 <kbd>Esc</kbd></button><a href="/">返回游戏标题</a></nav><section class="photo-album" aria-label="上街相册"></section><div class="photo-mode"></div><output aria-live="polite"><strong></strong><span></span></output><div class="photo-prompt"></div><p class="photo-complete"></p><div class="photo-flash" aria-hidden="true"></div>`;
 root.append(panel);panel.querySelector('button')!.addEventListener('click',putDown);let albumSignature='';
 return(r:PhotoRuntime)=>{
  const signature=r.album.join(',');if(signature!==albumSignature){panel.querySelector('.photo-album')!.innerHTML=SITES.map((s,i)=>`<article style="--rank:${RANK_COLORS[r.album[i]]}" class="${r.album[i]?'owned':''}"><div class="photo-mini"><i></i><i></i><i></i></div><span>${s.name}</span><strong><b>●</b> ${r.album[i]?RANKS[r.album[i]]:'待发现'}</strong></article>`).join('');albumSignature=signature;}
  panel.querySelector<HTMLButtonElement>('.photo-put-down')!.hidden=r.site<0;
  panel.querySelector('.photo-mode')!.textContent=r.site>=0?`${SITES[r.site].name} / ${r.zoom.toFixed(1)}×`:'沿着金色机位标记，自由找景';
  panel.querySelector('.photo-prompt')!.innerHTML=r.site>=0?'<kbd>WASD / 方向键</kbd> 走位　<kbd>Shift</kbd> 长焦　<kbd>空格</kbd> 快门　<kbd>Esc</kbd> 放下':r.nearby>=0?'<kbd>E</kbd> 举起相机 · '+SITES[r.nearby].name:'<kbd>WASD / 方向键</kbd> 漫步上街　靠近金色机位，再按 <kbd>E</kbd>';
  const out=panel.querySelector('output')!;out.hidden=!r.result;out.style.color=RANK_COLORS[r.rank]||'#f0c96a';out.querySelector('strong')!.textContent=r.result;out.querySelector('span')!.textContent=r.reason||'已留在相册 · 随时调整位置，再拍一张';
  panel.querySelector('.photo-complete')!.textContent=r.album.every(v=>v>0)?'上街三景，已收入相册。还想再拍一张吗？':'';
  panel.querySelector<HTMLElement>('.photo-flash')!.style.opacity=String(r.flash/100*.85);
  const composition=r.site>=0?r.composition(innerWidth,innerHeight):null,judgment=composition?score(composition.frame,composition.subject):null;
  Object.assign(root.dataset,{x:String(r.x),y:String(r.y),site:String(r.site),nearby:String(r.nearby),album:JSON.stringify(r.album),shots:String(r.shots),result:r.result,reason:r.reason,zoom:String(r.zoom),flash:String(r.flash),frame:JSON.stringify(composition?.frame??null),subject:JSON.stringify(composition?.subject??null),distance:String(composition?.d??0),coverage:String(judgment?.coverage??0),inFrame:String(judgment?.inside??false)});
 };
}
