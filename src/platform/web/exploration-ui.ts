import {projectExplorationJournal} from './exploration-journal.ts';
import type {ExplorationSnapshot} from '../../core/exploration.ts';

export const explorationUiMarkup=`
  <div id="exp-stage" role="img" aria-label="山城街区与可行走的室内"></div>
  <header class="exp-hud">
    <div class="exp-location"><span>此刻所在</span><strong id="exp-place"></strong></div>
    <p id="exp-objective"></p>
    <nav aria-label="旅程操作"><button id="exp-notes-toggle" type="button">旅程记录</button><button id="exp-menu-button" type="button" aria-label="暂停">暂停</button></nav>
  </header>
  <small id="exp-save" class="exp-save" role="status"></small>
  <p id="exp-help">WASD／方向键行走　E／空格交互　Esc 暂停</p>
  <p id="exp-orientation" hidden>建议横屏，获得更完整的街区视野；竖屏仍可操作。</p>
  <div id="exp-touch"><div id="exp-stick" role="group" aria-label="移动摇杆"><span id="exp-knob"></span></div><button id="exp-interact" type="button">交互</button></div>
  <p id="exp-prompt"></p>
  <section id="exp-dialogue" class="exp-panel" role="dialog" aria-modal="true" aria-label="调查对话" hidden><p id="exp-dialogue-text"></p><button id="exp-close" type="button">收起 · E</button></section>
  <section id="exp-photo" class="exp-photo-overlay" role="dialog" aria-modal="true" aria-label="取景预览" hidden><div class="exp-panel exp-photo-panel"><h2 id="exp-photo-title"></h2><p id="exp-photo-requirement"></p><img id="exp-photo-image" alt="游戏内原创取景预览"/><p id="exp-photo-feedback" role="status"></p><div class="exp-photo-actions"><button id="exp-shutter" type="button">拍摄这一刻</button><button id="exp-photo-menu" type="button">暂停</button><button id="exp-photo-close" type="button">返回探索 · E</button></div></div></section>
  <section id="exp-photo-card" class="exp-photo-overlay" role="dialog" aria-modal="true" aria-label="夜景纪念卡" hidden><div class="exp-panel exp-photo-panel exp-postcard"><h2>坡坎之间</h2><p>把山城夜景寄给远方</p><img id="exp-card-image" alt="桥、江水与木楼同框的游戏内夜景纪念卡"/><p>桥连着两岸，木楼留着灯。你找到的这一刻，已经留在旅程里。</p><small>游戏内原创夜景纪念</small><div class="exp-photo-actions"><button id="exp-card-close" type="button">返回探索 · E</button></div></div></section>
  <section id="exp-title-screen" class="exp-title-screen" role="dialog" aria-modal="true" aria-labelledby="exp-title-name" hidden>
    <div class="exp-title-copy"><p class="exp-title-intro">一段山城探索旅程</p><h1 id="exp-title-name">坡坎<span>之间</span></h1><p class="exp-title-description">沿街巷行走，推门看看。<br>把发现留在旅程里。</p>
      <div class="exp-title-actions"><button id="exp-begin" class="exp-primary" type="button">开始冒险</button><button id="exp-instructions" type="button">操作说明</button><button id="exp-title-restart" type="button">重新开始</button></div>
      <p id="exp-title-status" role="status"></p><p id="exp-archive-notice"></p><small>当前可玩短篇 · 进度在本浏览器自动保存</small>
    </div><div class="exp-title-window" aria-hidden="true"><span>街灯亮着，旅程等你出发。</span></div>
  </section>
  <section id="exp-menu" class="exp-shade" role="dialog" aria-modal="true" aria-labelledby="exp-menu-title" hidden><div class="exp-panel exp-menu-panel"><span class="exp-page-label">旅途中</span><h1 id="exp-menu-title">歇一会儿</h1><p>这一刻先停下，发现留在旅程里。</p><div class="exp-menu-actions"><button id="exp-resume" class="exp-primary" type="button">继续探索</button><button id="exp-menu-journal" type="button">旅程记录</button><button id="exp-menu-help" type="button">操作说明</button><button id="exp-title" type="button">返回标题</button><button id="exp-restart" type="button">重新开始</button></div></div></section>
  <section id="exp-notes" class="exp-shade exp-journal" role="dialog" aria-modal="true" aria-labelledby="exp-journal-title" hidden><div class="exp-journal-book">
    <header><div><span class="exp-page-label">把发现写下来</span><h1 id="exp-journal-title">旅程手账</h1></div><button id="exp-notes-close" type="button">收起手账</button></header>
    <div class="exp-journal-pages"><section><span id="exp-quest-status" class="exp-status-label"></span><h2 id="exp-quest-title"></h2><p id="exp-quest-text"></p><h2>已知线索与随身物件</h2><div id="exp-discoveries"></div></section><section><h2>取景记录</h2><p id="exp-notes-requirement"></p><ul id="exp-notes-list"></ul><div class="exp-journal-card"><p id="exp-journal-card-status"></p><button id="exp-card-reopen" type="button" hidden>重看纪念卡</button></div></section></div>
  </div></section>
  <section id="exp-instructions-panel" class="exp-shade" role="dialog" aria-modal="true" aria-labelledby="exp-instructions-title" hidden><div class="exp-panel exp-instructions-panel"><span class="exp-page-label">出发前看看</span><h1 id="exp-instructions-title">怎么走，怎么看</h1><dl><dt>电脑</dt><dd>WASD／方向键向八个方向行走。靠近门口、人物或物件，按 E／空格主动交互；再次按下可收起对话。Esc 打开暂停。</dd><dt>触屏</dt><dd>左下摇杆行走，右下按钮交互。横屏视野更宽，竖屏也可操作。</dd><dt>旅程</dt><dd>记录只保留已经发现的信息。自动保存后，下次从安全地点继续；返回标题保留当前旅程，重新开始会清空当前试玩进度。</dd></dl><button id="exp-instructions-close" class="exp-primary" type="button">知道了</button></div></section>
  <section id="exp-confirm" class="exp-shade" role="dialog" aria-modal="true" aria-labelledby="exp-confirm-title" hidden><div class="exp-panel exp-menu-panel"><h1 id="exp-confirm-title">重新出发？</h1><p>将清空当前试玩进度与本地记录，从解放碑开始。历史档案与其他数据保留。</p><div class="exp-menu-actions"><button id="exp-cancel-restart" class="exp-primary" type="button">保留旅程</button><button id="exp-confirm-restart" type="button">确认重新开始</button></div><p id="exp-restart-status" role="status"></p></div></section>
  <p id="exp-error" role="alert" hidden></p>`;

export function renderExplorationJournal(root:HTMLElement,s:ExplorationSnapshot):void {
  const get=(id:string)=>root.querySelector<HTMLElement>(`#${id}`)!;
  const model=projectExplorationJournal(s);
  get('exp-quest-title').textContent=model.quest.title;
  get('exp-quest-text').textContent=model.quest.text;
  get('exp-quest-status').textContent=model.quest.status;
  const discoveries=get('exp-discoveries');discoveries.replaceChildren();
  for(const entry of model.discoveries){const article=document.createElement('article'),title=document.createElement('h3'),body=document.createElement('p');title.textContent=entry.title;body.textContent=entry.text;article.append(title,body);discoveries.append(article);}
  if(!model.discoveries.length){const p=document.createElement('p');p.textContent='尚未发现线索或随身物件。';discoveries.append(p);}
  get('exp-notes-requirement').textContent=s.accepted?'已知要求：桥、江水与木楼同框。':'尚未获得取景要求。';
  const list=get('exp-notes-list');list.replaceChildren();
  for(const o of model.observations){const item=document.createElement('li'),title=document.createElement('h3'),body=document.createElement('p');title.textContent=o.title;body.textContent=o.text;item.append(title,body);list.append(item);}
  if(!model.observations.length){const item=document.createElement('li');item.textContent='尚未调查取景视野。';list.append(item);}
  get('exp-journal-card-status').textContent=model.canReviewCard?'这段夜景，已经留成纪念。':'尚未留下纪念卡。';
  get('exp-card-reopen').hidden=!model.canReviewCard;
}
