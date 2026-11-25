import {projectExplorationJournal} from './exploration-journal.ts';
import type {ExplorationSnapshot} from '../../core/exploration.ts';
import {mementoImageUrl} from '../../rendering/phaser/exploration-memento-art';
import {MEMENTO_COMPLETION} from '../../core/exploration-mementos';

export const explorationUiMarkup=`
  <div id="exp-stage" role="img" aria-label="山城街区与可行走的室内"></div>
  <header class="exp-hud">
    <div class="exp-location">
      <strong id="exp-place"></strong>
      <p id="exp-objective"></p>
      <small id="exp-save" class="exp-save" role="status"></small>
      <button id="exp-auto-walk" type="button" hidden>顺路前往</button>
    </div>
    <nav aria-label="旅程操作"><button id="exp-notes-toggle" type="button">旅程记录</button><button id="exp-menu-button" type="button" aria-label="暂停">暂停</button></nav>
  </header>
  <aside id="exp-onboarding" aria-label="开场指引" hidden><span class="exp-page-label" id="exp-onboarding-step"></span><h2 id="exp-onboarding-title"></h2><p id="exp-onboarding-text"></p><div><button id="exp-onboarding-help" type="button">操作说明</button><button id="exp-onboarding-skip" type="button">跳过教学</button></div></aside>
  <p id="exp-help">WASD／方向键行走　Shift 慢行　E／空格交互　Esc 暂停</p>
  <section id="exp-orientation" role="dialog" aria-modal="true" aria-labelledby="exp-orientation-title" tabindex="-1" hidden>
    <div><h2 id="exp-orientation-title">请将手机横过来</h2><p>横屏后继续旅程。</p></div>
  </section>
  <div id="exp-touch"><div id="exp-stick" role="group" aria-label="移动摇杆"><span id="exp-knob"></span></div><button id="exp-interact" type="button">交互</button></div>
  <p id="exp-prompt"></p>
  <p id="exp-ferry-status" role="status" hidden></p>
  <p id="exp-memento-feedback" role="status"></p>
  <p id="exp-gate-feedback" role="status" hidden>江纹栈门已开<br><span>两端外阶与木作1F门，现在可以通行。</span></p>
  <section id="exp-dialogue" class="exp-panel" role="dialog" aria-modal="true" aria-label="调查对话" hidden><img id="exp-memento-image" alt="原创纸质纪念图案" hidden/><figure id="exp-investigation" hidden><h2 id="exp-investigation-title"></h2><img id="exp-investigation-image" alt=""/><figcaption id="exp-investigation-caption"></figcaption></figure><p id="exp-dialogue-text"></p><div class="exp-dialogue-actions"><button id="exp-memento-cancel" type="button" hidden>先放回</button><button id="exp-close" type="button">收起 · E</button></div></section>
  <section id="exp-photo" class="exp-photo-overlay" role="dialog" aria-modal="true" aria-label="取景预览" hidden><div class="exp-panel exp-photo-panel"><h2 id="exp-photo-title"></h2><p id="exp-photo-requirement"></p><img id="exp-photo-image" alt="游戏内原创取景预览"/><p>确认画面后，点击「拍摄这一刻」；E／空格只返回探索，不会拍摄。</p><p id="exp-photo-feedback" role="status"></p><div class="exp-photo-actions"><button id="exp-shutter" type="button">拍摄这一刻</button><button id="exp-photo-menu" type="button">暂停</button><button id="exp-photo-close" type="button">返回探索 · E</button></div></div></section>
  <section id="exp-photo-card" class="exp-photo-overlay" role="dialog" aria-modal="true" aria-labelledby="exp-card-heading" hidden><div class="exp-panel exp-photo-panel exp-postcard exp-completion-card">
    <header class="exp-completion-heading"><div><span class="exp-page-label">夜景取景委托</span><h2 id="exp-card-heading">本次委托已完成</h2><p id="exp-card-commission" class="exp-completion-commission">把山城夜景寄给远方</p></div><span class="exp-completion-stamp" aria-hidden="true">完成</span></header>
    <div class="exp-completion-layout"><figure class="exp-completion-art"><img id="exp-card-image" alt="桥、江水与木楼同框的游戏内夜景纪念卡"/><figcaption>桥、江水与木楼，留在同一幅画里。</figcaption></figure><section class="exp-completion-summary" aria-label="旅程收获"><p>桥连着两岸，木楼留着灯。你找到的这一刻，已经留在旅程里。</p><dl class="exp-completion-facts"><div><dt>已收旅行纪念</dt><dd id="exp-card-memento-count">0/3 · 全部选做</dd></div><div><dt>旅程称号</dt><dd id="exp-card-memento-title">尚未获得 · 选做奖励</dd></div></dl><p class="exp-completion-optional">无需返回游客处交付。纸质纪念物全部选做。</p></section></div>
    <footer class="exp-completion-footer"><div class="exp-photo-actions exp-completion-actions"><button id="exp-card-close" class="exp-primary" type="button">继续探索</button><button id="exp-card-title" type="button">返回标题</button><button id="exp-card-restart" type="button">重新开始</button></div><small>照水岭已开放，从江岸东侧渡口乘船。</small></footer>
  </div></section>
  <section id="exp-title-screen" class="exp-title-screen" role="dialog" aria-modal="true" aria-labelledby="exp-title-name" hidden>
    <div class="exp-title-copy"><div class="exp-title-content">
      <div class="exp-title-ornament" aria-hidden="true"><span class="exp-title-lantern"></span></div>
      <h1 id="exp-title-name" aria-label="坎坡之间"><span>坎坡</span><span>之间</span></h1>
      <p class="exp-title-description">一路下坡，去看江边亮灯。</p>
      <div class="exp-title-actions">
        <button id="exp-begin" class="exp-primary" type="button">开始冒险</button>
        <div class="exp-title-secondary"><button id="exp-instructions" type="button">操作说明</button><button id="exp-title-restart" type="button">重新开始</button></div>
      </div>
      <p id="exp-title-status" role="status"></p>
      <p id="exp-archive-notice" hidden></p>
    </div></div>
  </section>
  <section id="exp-intro" class="exp-intro" role="dialog" aria-modal="true" aria-labelledby="exp-intro-heading" hidden>
    <div class="exp-intro-story">
      <h2 id="exp-intro-heading">灯亮之前</h2>
      <p>你在天擦黑时到了山城。下头是江，上头的街还在收摊。一个来拍夜景的人托你在沧白路碰头，他想把今晚的灯寄给远方的家人。</p>
      <p class="exp-intro-goal">从广场往右沿步行街走，到沧白路栏边找那位游客。</p>
      <div class="exp-intro-actions">
        <button id="exp-intro-start" class="exp-primary" type="button">沿街出发</button>
        <button id="exp-intro-back" type="button">返回标题</button>
      </div>
    </div>
  </section>
  <section id="exp-menu" class="exp-shade" role="dialog" aria-modal="true" aria-labelledby="exp-menu-title" hidden><div class="exp-panel exp-menu-panel"><span class="exp-page-label">旅途中</span><h1 id="exp-menu-title">歇一会儿</h1><p>这一刻先停下，发现留在旅程里。</p><div class="exp-menu-actions"><button id="exp-resume" class="exp-primary" type="button">继续探索</button><button id="exp-menu-journal" type="button">旅程记录</button><button id="exp-weather" type="button">天气 · 夕照</button><button id="exp-menu-help" type="button">操作说明</button><button id="exp-title" type="button">返回标题</button><button id="exp-restart" type="button">重新开始</button></div></div></section>
  <section id="exp-notes" class="exp-shade exp-journal" role="dialog" aria-modal="true" aria-labelledby="exp-journal-title" hidden><div class="exp-journal-book">
    <header><div><span class="exp-page-label">把发现写下来</span><h1 id="exp-journal-title">旅程手账</h1></div><button id="exp-notes-close" type="button">收起手账</button></header>
    <section class="exp-tracking" aria-labelledby="exp-track-heading">
      <h2 id="exp-track-heading">跟踪任务</h2>
      <div class="exp-track-options">
        <button id="exp-track-main" type="button">主线 · 山城夜景</button>
        <button id="exp-track-bookmark" type="button">选做 · 吊脚楼书签</button>
        <button id="exp-track-sketch" type="button">选做 · 竹椅茶歇速写</button>
        <button id="exp-track-postcard" type="button">选做 · 江桥夜色明信片</button>
        <button id="exp-track-none" type="button">自由探索</button>
      </div>
      <p>选定任务后，沿地面的灯点走，或点「顺路前往」。到门口停下，由你决定怎么走。</p>
    </section>
    <div class="exp-journal-pages"><section><span id="exp-quest-status" class="exp-status-label"></span><h2 id="exp-quest-title"></h2><p id="exp-quest-text"></p><h2>已知线索与随身物件</h2><div id="exp-discoveries"></div></section><section><h2>取景记录</h2><p id="exp-notes-requirement"></p><ul id="exp-notes-list"></ul><div class="exp-journal-card"><p id="exp-journal-card-status"></p><button id="exp-card-reopen" type="button" hidden>重看纪念卡</button></div></section></div>
    <section class="exp-mementos" aria-labelledby="exp-mementos-title"><div class="exp-mementos-heading"><h2 id="exp-mementos-title">旅行纪念</h2><p id="exp-memento-count"></p></div><p id="exp-memento-empty"></p><div id="exp-memento-list"></div><div id="exp-memento-award" role="status" hidden><h3></h3><p></p></div></section>
  </div></section>
  <section id="exp-instructions-panel" class="exp-shade" role="dialog" aria-modal="true" aria-labelledby="exp-instructions-title" hidden><div class="exp-panel exp-instructions-panel"><span class="exp-page-label">出发前看看</span><h1 id="exp-instructions-title">怎么走，怎么看</h1><dl><dt>电脑</dt><dd>WASD／方向键行走，按住 Shift 慢行。靠近门口、人物或物件，按 E／空格主动交互；再次按下会确认对话按钮所示的行动。Esc 暂停。</dd><dt>触屏</dt><dd>请横着拿手机。轻推左下摇杆慢行，推远快走。用右下按钮交互。</dd><dt>旅程</dt><dd>在旅程手账选择跟踪任务。自动保存后，下次从安全地点继续。</dd></dl><button id="exp-onboarding-replay" type="button" hidden>重看广场教学</button><button id="exp-instructions-close" class="exp-primary" type="button">知道了</button></div></section>
  <section id="exp-confirm" class="exp-shade" role="dialog" aria-modal="true" aria-labelledby="exp-confirm-title" hidden><div class="exp-panel exp-menu-panel"><h1 id="exp-confirm-title">重新出发？</h1><p>将清空当前试玩进度与本地记录，从解放碑开始。历史档案与其他数据保留。</p><div class="exp-menu-actions"><button id="exp-cancel-restart" class="exp-primary" type="button">保留旅程</button><button id="exp-confirm-restart" type="button">确认重新开始</button></div><p id="exp-restart-status" role="status"></p></div></section>
  <p id="exp-error" role="alert" hidden></p>`;

export function renderExplorationJournal(root:HTMLElement,s:ExplorationSnapshot):void {
  const get=(id:string)=>root.querySelector<HTMLElement>(`#${id}`)!;
  const model=projectExplorationJournal(s);
  get('exp-quest-title').textContent=model.quest.title;
  get('exp-quest-text').textContent=`${model.quest.text}\n当前方向：${model.direction}`;
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
  get('exp-memento-count').textContent=`${model.mementos.length}/3 · 全部选做`;
  get('exp-memento-empty').textContent=model.mementos.length?'这里只留下已经收好的图案与文字。':'尚未发现纪念物。它们不会成为主线的门槛。';
  const souvenirs=get('exp-memento-list');souvenirs.replaceChildren();
  for(const m of model.mementos){const item=document.createElement('article'),image=document.createElement('img'),title=document.createElement('h3'),body=document.createElement('p');item.dataset.memento=m.id;image.src=mementoImageUrl(m.id);image.alt=m.title+'原创图案';title.textContent=m.title;body.textContent=m.text;item.append(image,title,body);souvenirs.append(item);}
  get('exp-memento-award').hidden=!model.mementoTitle;
  get('exp-memento-award').querySelector('h3')!.textContent=model.mementoTitle??'';
  get('exp-memento-award').querySelector('p')!.textContent=model.mementoTitle?MEMENTO_COMPLETION.story:'';
}
