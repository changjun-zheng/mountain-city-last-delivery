import assert from 'node:assert/strict';
import {EXP_MAPS,EXP_TARGETS} from '../src/core/exploration-content.ts';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, relative } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { identifyBrowser, parseBrowserSelection, resolveBrowserExecutable } from './browser-selection.mjs';

const args=process.argv.slice(2);
if(!args.includes('--production')||args.some(a=>a!=='--production'&&a!=='--preview-only'&&!a.startsWith('--browser=')))throw new Error('Use --production --browser=chrome');
const selection=resolveBrowserExecutable(parseBrowserSelection(args));
assert.equal(selection.id,'chrome');
const dir=resolve('test-results/exp-03a',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:'EXP-03A',scope:args.includes('--preview-only')?'product-ui-preview-stage':'product-entry-journal-pause-responsive',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],networkErrors:[],cleanup:{},hashes:{},historicalFocusFailure:'Retained; old long focus suite NOT RUN'};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function hashTree(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await hashTree(p);else report.hashes[relative(process.cwd(),p).replaceAll('\\','/')]=await sha(p);}}
const files=['src/core/exploration-mementos.ts','src/rendering/phaser/exploration-memento-art.ts','src/rendering/phaser/assets/exp-03b/bookmark.svg','src/rendering/phaser/assets/exp-03b/sketch.svg','src/rendering/phaser/assets/exp-03b/postcard.svg','src/rendering/phaser/assets/exp-03b/ASSET_SOURCES.md','tests/exploration-mementos.test.mjs','index.html','src/platform/web/exploration-journal.ts','src/platform/web/exploration-ui.ts','src/platform/web/exploration-ui.css','tests/exploration-journal.test.mjs','tests/exp-03a-browser.mjs','src/core/exploration-prologue.ts','src/rendering/phaser/exploration-city-art.ts','src/core/progress.ts','src/core/exploration.ts','src/core/exploration-content.ts','src/core/exploration-photo.ts','src/rendering/phaser/exploration-photo-art.ts','src/platform/web/main.ts','src/platform/web/style.css','src/rendering/phaser/exploration.ts','src/platform/web/exploration.ts','src/platform/web/exploration-input.ts','src/platform/web/exploration-storage.ts','tests/exploration-prologue.test.mjs','tests/exploration.test.mjs','tests/exploration-district.test.mjs','tests/exploration-photo.test.mjs','tests/exp-02c-browser.mjs','src/rendering/phaser/assets/exp-02c/ASSET_SOURCES.md'];
for(const file of files)report.hashes[file]=await sha(file);
const entry='dist/index.html',html=await readFile(entry,'utf8');report.hashes[entry]=await sha(entry);const assets=[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>'dist/'+m[1].replace(/^\//,''));for(const asset of assets)report.hashes[asset]=await sha(asset);report.actualDist={entry,assets};
const dist=resolve('dist');
const server=createServer(async(req,res)=>{
  const path=resolve(dist,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(relative(dist,path).startsWith('..')){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'content-type':{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(path)]??'application/octet-stream','cache-control':'no-store'}).end(await readFile(path));}
  catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}/`;
report.url=base+'?scene=exploration-prototype';
let browser,active,nativeProcess,nativeBrowser;
const contexts=[];
const touchPorts=new WeakMap();
const state=page=>page.locator('#exp-root').evaluate(e=>{const g=document.querySelector('#exp-stage').dataset;return {...e.dataset,x:Number(e.dataset.x),y:Number(e.dataset.y),tick:Number(e.dataset.tick),tokens:Number(e.dataset.tokens),cameraX:Number(g.cameraX),cameraY:Number(g.cameraY),mapObjects:Number(g.mapObjects),zoom:Number(g.zoom)};});
const wait=async(page,predicate,arg)=>page.waitForFunction(predicate,arg,{timeout:20000,polling:'raf'});
const shot=async(page,name)=>{const path=join(dir,`${name}.png`);await page.screenshot({path});report.screenshots.push(path);};
const key=async(page,code)=>{report.timeline.push({event:'key',code,at:new Date().toISOString()});await page.keyboard.press(code);};
const hold=async(page,code,ms)=>{await page.keyboard.down(code);await page.waitForTimeout(ms);await page.keyboard.up(code);};
const fitCanvas=async page=>{
  await wait(page,()=>{
    const parent=document.querySelector('#exp-stage').getBoundingClientRect(),canvas=document.querySelector('#exp-stage canvas').getBoundingClientRect();
    const scale=Math.min(parent.width/1100,parent.height/650);
    return Math.abs(canvas.width-1100*scale)<2&&Math.abs(canvas.height-650*scale)<2&&canvas.x>=parent.x-1&&canvas.y>=parent.y-1&&canvas.right<=parent.right+1&&canvas.bottom<=parent.bottom+1;
  });
  return page.locator('#exp-stage canvas').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
};
async function axis(page,coordinate,target){
  const s=await state(page),positive=target>s[coordinate];
  if(Math.abs(target-s[coordinate])<5)return;
  const touch=touchPorts.get(page);
  if(touch){await touch.axis(coordinate,target,positive);return;}
  const code=coordinate==='x'?(positive?'KeyD':'KeyA'):(positive?'KeyS':'KeyW');
  await page.keyboard.down(code);
  try{await wait(page,({coordinate,target,positive})=>{const d=document.querySelector('#exp-root').dataset;return positive?Number(d[coordinate])>=target-3:Number(d[coordinate])<=target+3;},{coordinate,target,positive});}
  finally{await page.keyboard.up(code);}
}
async function walk(page,x,y){await axis(page,'x',x);await axis(page,'y',y);report.timeline.push({event:'walk',x,y,state:await state(page)});}
async function interact(page,target){assert.equal((await state(page)).target,target);if(touchPorts.has(page))await page.locator('#exp-interact').tap();else await key(page,'KeyE');}
async function close(page){if(touchPorts.has(page))await page.locator('#exp-close').tap();else await page.locator('#exp-close').click();await wait(page,()=>document.querySelector('#exp-root').dataset.dialogue==='false');}
async function loaded(page){await wait(page,()=>document.querySelector('#exp-root')?.dataset.ready==='true');await page.waitForLoadState('networkidle');}
async function newPage(options={}){
  const c=await browser.newContext(options);contexts.push(c);const p=await c.newPage();active=p;
  p.on('pageerror',error=>report.pageErrors.push(String(error)));
  p.on('requestfailed',req=>report.networkErrors.push({url:req.url(),error:req.failure()}));
  p.on('response',res=>{if(res.status()>=400)report.networkErrors.push({url:res.url(),status:res.status()});});
  await p.addInitScript(()=>{
    const original=EventTarget.prototype.addEventListener;
    window.__expSignals=[];window.__visibility=[];window.__pointerEvents=[];
    EventTarget.prototype.addEventListener=function(type,fn,options){if(options?.signal)window.__expSignals.push({type,signal:options.signal});return original.call(this,type,fn,options);};
    document.addEventListener('visibilitychange',()=>window.__visibility.push({state:document.visibilityState,focus:document.hasFocus(),at:performance.now()}));
    for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','click'])document.addEventListener(type,e=>window.__pointerEvents.push({type,pointerId:e.pointerId,target:e.target.id,trusted:e.isTrusted}),true);
  });
  return p;
}



async function notebook(p,tap=false){await p.locator('#exp-notes-toggle')[tap?'tap':'click']();assert.equal((await state(p)).view,'journal');}
async function dimensions(p,ids){return p.evaluate(ids=>ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return{id,x:r.x,y:r.y,width:r.width,height:r.height,fontSize:parseFloat(s.fontSize),visible:!!e.getClientRects().length,inside:r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};}),ids);}
try{
 browser=await chromium.launch({executablePath:selection.executablePath,headless:true});
 const p=await newPage({viewport:{width:1280,height:720}}),cdp=await p.context().newCDPSession(p);report.browser.actual=identifyBrowser(await cdp.send('Browser.getVersion'));
 await p.goto(base);await loaded(p);assert.equal(await p.title(),'坡坎之间');let s=await state(p);assert.equal(s.view,'title');assert.equal(s.tokens,1);assert.equal(s.tick,0);const initial=s;assert.match(await p.locator('#exp-title-status').textContent(),/从解放碑出发/);assert.equal(await p.evaluate(()=>localStorage.getItem('pokan.exp03b.save.v1')),null);
 await p.keyboard.down('KeyD');await p.waitForTimeout(180);assert.equal((await state(p)).tick,0);assert.equal((await state(p)).x,initial.x);await p.keyboard.up('KeyD');
 for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:844,height:390},{width:667,height:375},{width:390,height:844}]){
  await p.setViewportSize(size);await fitCanvas(p);await shot(p,'title-'+size.width+'x'+size.height);const boxes=await dimensions(p,['exp-begin','exp-instructions','exp-title-restart']);report.timeline.push({event:'title-layout',size,boxes});assert.ok(boxes.every(b=>b.visible&&b.inside&&b.height>=48));
 }
 await p.setViewportSize({width:1280,height:720});await p.locator('#exp-begin').focus();await p.keyboard.press('Enter');assert.equal((await state(p)).view,'play');await wait(p,()=>Number(document.querySelector('#exp-root').dataset.tick)>2);await shot(p,'hud-1280x720');
 await notebook(p);assert.equal((await state(p)).tokens,1);assert.equal((await state(p)).view,'journal');await shot(p,'journal-empty');await p.locator('#exp-notes-close').click();
 report.layers.desktopChrome='PASS';report.phase=args.includes('--preview-only')?'preview-only':'full';
 record('U01 title truly paused before first frame and keyboard begins same runtime');record('U04 five title layouts keep all primary actions visible and at least 48 CSS pixels');
 if(args.includes('--preview-only'))report.notRun=['U01 valid/bad archive and debug routes','U02 nested UI and native hidden','U03 completed journal and card','U04 touch controls and all UI layouts','U05 separate EXP-02C complete flow','U06 disposal'];
 else{
  assert.equal(initial.runtimeId,(await state(p)).runtimeId);
  await p.keyboard.down('KeyD');await p.waitForTimeout(100);await notebook(p);const held=await state(p);await p.keyboard.up('KeyD');await p.locator('#exp-notes-close').click();await p.waitForTimeout(130);assert.equal((await state(p)).x,held.x);
  const progress=(await state(p)).progress,id=(await state(p)).runtimeId;for(let i=0;i<3;i++){await notebook(p);await p.locator('#exp-notes-close').click();assert.equal((await state(p)).progress,progress);}
  await p.locator('#exp-menu-button').click();await p.locator('#exp-menu-journal').click();assert.equal((await state(p)).tokens,2);await p.locator('#exp-notes-close').click();assert.equal((await state(p)).tokens,1);assert.equal((await state(p)).view,'menu');await shot(p,'pause-desktop');
  const titlePosition=await state(p);await p.locator('#exp-title').click();assert.equal((await state(p)).x,titlePosition.x);assert.equal((await state(p)).y,titlePosition.y);assert.equal((await state(p)).runtimeId,id);assert.equal((await state(p)).tokens,1);assert.equal((await state(p)).progress,progress);await p.locator('#exp-instructions').click();assert.equal((await state(p)).tokens,2);await p.locator('#exp-instructions-close').click();assert.equal((await state(p)).tokens,1);
  await p.locator('#exp-title-restart').click();await p.locator('#exp-cancel-restart').click();assert.equal((await state(p)).runtimeId,id);await p.locator('#exp-begin').focus();await p.keyboard.press('Space');assert.equal((await state(p)).view,'play');assert.equal((await state(p)).runtimeId,id);assert.equal((await state(p)).progress,progress);record('U02 independent menu/journal/title/help tokens, held input cleared, same runtime and progress on return');
  // Captured once from the actual prior route; no runtime dependency on ignored output.
  const compatibilityFixture={"source":"test-results/exp-02c/run-2026-11-19T16-01-52-491Z/report.json","sourceReportSha256":"104f107eb33a7269262ce201685ca48e83ab379c512f55824654ab9753bb7893","extraction":"First timeline state with photographed=true; UI compatibility only, not a blank gameplay route.","save":{"schemaVersion":1,"contentVersion":"exp02c-prologue-1","safe":"overlook","progress":{"collections":["collection.exp02a.river-clasp"],"goals":["goal.exp02a.photo-request","goal.exp02a.river-route-note","goal.exp02a.east-passage-open","goal.exp02a.lower-view-found","goal.exp02b.night-postcard.photographed"],"rewards":["reward.exp02b.night-postcard"],"effects":[{"id":"effect.exp02a.east-passage-open","expectedActive":true}],"counts":{"collections":1,"goals":5,"rewards":1,"effects":1}},"observedSites":["eaves","window","river"],"photo":{"cardId":"card.exp02b.night-for-faraway","siteId":"river"}}};
  const archive=compatibilityFixture.save;report.compatibilityFixture={...compatibilityFixture,save:undefined};
  const saved=await newPage({viewport:{width:1280,height:720}});await saved.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp02c.save.v1'))localStorage.setItem('pokan.exp02c.save.v1',raw);localStorage.setItem('other-ui.fixture','keep');},JSON.stringify(archive));
  await saved.goto(base);await loaded(saved);assert.equal(await saved.locator('#exp-begin').textContent(),'继续旅程');assert.equal((await state(saved)).safe,archive.safe);const savedId=(await state(saved)).runtimeId;await saved.locator('#exp-begin').click();assert.equal((await state(saved)).runtimeId,savedId);assert.equal((await state(saved)).photographed,'true');assert.equal(JSON.parse((await state(saved)).progress).counts.rewards,1);
  for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:844,height:390},{width:667,height:375},{width:390,height:844}]){
   await saved.setViewportSize(size);await fitCanvas(saved);await shot(saved,'hud-'+size.width+'x'+size.height);const hudBoxes=await dimensions(saved,['exp-notes-toggle','exp-menu-button','exp-save']);assert.ok(hudBoxes.every(b=>b.inside));
   await notebook(saved);await shot(saved,'journal-'+size.width+'x'+size.height);const book=await dimensions(saved,['exp-notes-close']);assert.ok(book.every(b=>b.inside&&b.height>=48));
   const mainTexts=await saved.locator('#exp-notes p').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));assert.ok(mainTexts.every(v=>v>=14));
   await saved.locator('#exp-card-reopen').click();await saved.locator('#exp-card-image').evaluate(i=>i.decode());await shot(saved,'card-'+size.width+'x'+size.height);const card=await dimensions(saved,['exp-card-close']);assert.ok(card.every(b=>b.inside&&b.height>=48));await saved.locator('#exp-card-close').click();
   await saved.locator('#exp-menu-button').click();await shot(saved,'pause-'+size.width+'x'+size.height);const menu=await dimensions(saved,['exp-resume','exp-menu-journal','exp-menu-help','exp-title','exp-restart']);assert.ok(menu.every(b=>b.inside&&b.height>=48));await saved.locator('#exp-menu-help').click();await shot(saved,'help-'+size.width+'x'+size.height);await saved.locator('#exp-instructions-close').click();await saved.locator('#exp-resume').click();report.timeline.push({event:'all-panels-layout',size,hudBoxes,book,card,menu,mainTexts});
  }
  const beforeReload=(await state(saved)).progress;await saved.reload();await loaded(saved);assert.equal((await state(saved)).progress,beforeReload);assert.equal((await state(saved)).photographed,'true');await saved.locator('#exp-title-restart').click();await saved.locator('#exp-confirm-restart').click();await loaded(saved);assert.equal((await state(saved)).view,'title');assert.equal((await state(saved)).accepted,'false');assert.equal((await state(saved)).photographed,'false');await saved.reload();await loaded(saved);assert.equal((await state(saved)).map,'plaza');assert.equal((await state(saved)).accepted,'false');assert.equal(await saved.evaluate(()=>localStorage.getItem('other-ui.fixture')),'keep');record('U01 U03 U04 valid continue, known completed journal/card, all five panel sizes, explicit new game and refresh');
  for(const raw of ['{broken',JSON.stringify({...archive,contentVersion:'future'})]){
   const bad=await newPage({viewport:{width:1280,height:720}});await bad.addInitScript(({raw,older})=>{localStorage.setItem('pokan.exp03b.save.v1',raw);localStorage.setItem('pokan.exp02b.save.v1',older);},{raw,older:JSON.stringify({...archive,contentVersion:'exp02b-photo-quest-1'})});await bad.goto(base);await loaded(bad);assert.equal(await bad.locator('#exp-begin').textContent(),'开始冒险');assert.match(await bad.locator('#exp-title-status').textContent(),/原.*保留/);await bad.locator('#exp-begin').click();assert.equal((await state(bad)).photographed,'false');assert.equal(await bad.evaluate(()=>localStorage.getItem('pokan.exp03b.save.v1')),raw);await bad.close();
  }
  const unavailable=await newPage();await unavailable.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Denied test');}}));await unavailable.goto(base);await loaded(unavailable);assert.match(await unavailable.locator('#exp-title-status').textContent(),/原记录保留/);await unavailable.locator('#exp-title-restart').click();await unavailable.locator('#exp-confirm-restart').click();assert.match(await unavailable.locator('#exp-restart-status').textContent(),/无法写入/);assert.equal((await state(unavailable)).view,'confirm');record('U01 damaged/future/unreadable archives show protection and are never silently overwritten');
  const debug=await newPage();for(const mode of ['graybox','diagnostic','first-level']){await debug.goto(base+'?scene='+mode);await wait(debug,m=>document.querySelector('#diagnostics')?.dataset.mode===m,mode);assert.equal(await debug.locator('#exp-root').count(),0);await shot(debug,'debug-'+mode);}await debug.locator('#debug-tools').evaluate(e=>e.open=true);await debug.locator('#scene-select').selectOption('graybox');await wait(debug,()=>document.querySelector('#diagnostics')?.dataset.mode==='graybox');assert.equal(new URL(debug.url()).searchParams.get('scene'),'graybox');record('U01 three explicit debug routes and selector; existing prototype uses the same exploration implementation');

  // Ordinary Chrome has native visibility changes; Playwright's normal contexts
  // deliberately keep their pages visible and cannot prove these owner counts.
  const profile=join(dir,'native-ui-profile');await mkdir(profile);nativeProcess=spawn(selection.executablePath,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe']});let stderr='';nativeProcess.stderr.setEncoding('utf8');
  const endpoint=await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(new Error('Native Chrome CDP unavailable '+stderr)),15000);nativeProcess.stderr.on('data',chunk=>{stderr+=chunk;const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);done(m[1]);}});nativeProcess.once('exit',code=>{clearTimeout(timer);fail(new Error('Native Chrome exited '+code));});});
  nativeBrowser=await chromium.connectOverCDP(endpoint,{noDefaults:true});const nc=nativeBrowser.contexts()[0],np=nc.pages()[0];active=np;np.on('pageerror',error=>report.pageErrors.push(String(error)));np.on('requestfailed',req=>report.networkErrors.push({url:req.url(),error:req.failure()}));
  await np.addInitScript(()=>{window.__visibility=[];document.addEventListener('visibilitychange',()=>window.__visibility.push({state:document.visibilityState,focus:document.hasFocus(),tokens:document.querySelector('#exp-root')?.dataset.tokens}));});
  await np.goto(base);await loaded(np);await np.bringToFront();await wait(np,()=>document.visibilityState==='visible'&&document.querySelector('#exp-root').dataset.tokens==='1');assert.equal((await state(np)).tokens,1);const nativeId=(await state(np)).runtimeId,bg=await nc.newPage();await bg.goto('about:blank');await bg.bringToFront();await wait(np,()=>document.visibilityState==='hidden');assert.equal((await state(np)).tokens,2);assert.equal((await state(np)).tick,0);await np.bringToFront();await wait(np,()=>document.visibilityState==='visible');assert.equal((await state(np)).tokens,1);
  await np.locator('#exp-begin').click();await np.locator('#exp-menu-button').click();await np.locator('#exp-menu-journal').click();assert.equal((await state(np)).tokens,2);const paused=await state(np);await bg.bringToFront();await wait(np,()=>document.visibilityState==='hidden');assert.equal((await state(np)).tokens,3);assert.equal((await state(np)).tick,paused.tick);await np.bringToFront();await wait(np,()=>document.visibilityState==='visible');assert.equal((await state(np)).tokens,2);await np.locator('#exp-notes-close').click();assert.equal((await state(np)).tokens,1);await np.locator('#exp-title').click();assert.equal((await state(np)).runtimeId,nativeId);assert.equal((await state(np)).tokens,1);await np.locator('#exp-begin').click();assert.equal((await state(np)).tokens,0);report.visibility=await np.evaluate(()=>window.__visibility);await bg.close();record('U02 native hidden and title/menu/journal retain independent accurate pause owners',{events:report.visibility});

  const disposedTitle=await newPage({viewport:{width:1280,height:720}});await disposedTitle.goto(base);await loaded(disposedTitle);assert.equal((await state(disposedTitle)).view,'title');assert.equal((await state(disposedTitle)).tokens,1);const titleBefore=await state(disposedTitle);
  await disposedTitle.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await wait(disposedTitle,()=>document.querySelector('#exp-root').dataset.disposed==='true'&&document.querySelector('#exp-stage').dataset.mapObjects==='0');assert.equal((await state(disposedTitle)).tokens,0);assert.equal(await disposedTitle.locator('#exp-stage canvas').count(),0);assert.equal(await disposedTitle.locator('#exp-stage').getAttribute('data-resize-observers'),'0');const titleSignals=await disposedTitle.evaluate(()=>window.__expSignals.map(s=>({type:s.type,aborted:s.signal.aborted})));assert.ok(titleSignals.length>10&&titleSignals.every(s=>s.aborted));await disposedTitle.locator('#exp-begin').click();await disposedTitle.keyboard.press('Escape');await disposedTitle.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal((await state(disposedTitle)).view,'title');assert.equal((await state(disposedTitle)).runtimeId,titleBefore.runtimeId);assert.equal((await state(disposedTitle)).tick,titleBefore.tick);record('U06 initial title-owned pause disposes once and stale start/menu callbacks stay inert',{signals:titleSignals,probe:'synthetic pagehide explicitly labelled; not native browser visibility'});

  const touch=await newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1}),tc=await touch.context().newCDPSession(touch);await touch.goto(base);await loaded(touch);await shot(touch,'touch-title-844x390');const touchId=(await state(touch)).runtimeId;await touch.locator('#exp-begin').tap();assert.equal((await state(touch)).map,'plaza');await notebook(touch,true);await shot(touch,'touch-journal-844x390');await touch.locator('#exp-notes-close').tap();await touch.locator('#exp-menu-button').tap();await shot(touch,'touch-pause-844x390');await touch.locator('#exp-title').tap();assert.equal((await state(touch)).runtimeId,touchId);await touch.setViewportSize({width:667,height:375});await fitCanvas(touch);await shot(touch,'touch-title-667x375');await touch.locator('#exp-begin').tap();assert.equal((await state(touch)).runtimeId,touchId);await shot(touch,'touch-hud-667x375');
  const point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1}),dispatch=(type,points)=>tc.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const stick=async()=>{const b=await touch.locator('#exp-stick').boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const touchAxis=async(coordinate,target)=>{const b=await stick(),positive=target>(await state(touch))[coordinate],end=point(1,b.x+(coordinate==='x'?(positive?32:-32):0),b.y+(coordinate==='y'?(positive?32:-32):0));await dispatch('touchStart',[point(1,b.x,b.y)]);await dispatch('touchMove',[end]);try{await wait(touch,({coordinate,target,positive})=>positive?Number(document.querySelector('#exp-root').dataset[coordinate])>=target-3:Number(document.querySelector('#exp-root').dataset[coordinate])<=target+3,{coordinate,target,positive});}finally{await dispatch('touchEnd',[]);}};
  // Approach from above and keep the held stick aimed toward the target while the second native finger lands.
  await touchAxis('x',900);await touchAxis('y',880);assert.equal((await state(touch)).target,'city-monument');const b=await stick(),ib=await touch.locator('#exp-interact').boundingBox();await dispatch('touchStart',[point(1,b.x,b.y)]);await dispatch('touchMove',[point(1,b.x,b.y+32)]);await dispatch('touchStart',[point(1,b.x,b.y+32),point(2,ib.x+ib.width/2,ib.y+ib.height/2)]);await wait(touch,()=>document.querySelector('#exp-root').dataset.dialogue==='true');assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchEnd',[]);await shot(touch,'touch-native-two-finger-dialogue');await touch.locator('#exp-close').tap();
  const beforeNotes=(await state(touch)).progress;await notebook(touch,true);await shot(touch,'touch-journal');await touch.locator('#exp-notes-close').tap();assert.equal((await state(touch)).progress,beforeNotes);
  await dispatch('touchStart',[point(3,b.x,b.y)]);await dispatch('touchMove',[point(3,b.x+32,b.y)]);await touch.keyboard.press('Escape');assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchCancel',[]);const menuPos=await state(touch);await touch.locator('#exp-resume').tap();await touch.waitForTimeout(120);assert.equal((await state(touch)).x,menuPos.x);
  await dispatch('touchStart',[point(4,b.x,b.y)]);await dispatch('touchMove',[point(4,b.x+32,b.y)]);await touch.setViewportSize({width:390,height:844});await fitCanvas(touch);assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchCancel',[]);assert.equal(await touch.locator('#exp-orientation').isVisible(),true);const portraitBefore=await state(touch);await touchAxis('x',portraitBefore.x+30);assert.ok((await state(touch)).x>portraitBefore.x+20);await shot(touch,'touch-portrait-hud');await notebook(touch,true);await shot(touch,'touch-portrait-journal');assert.ok((await dimensions(touch,['exp-notes-close']))[0].inside);await touch.locator('#exp-notes-close').tap();
  const controlBoxes=await dimensions(touch,['exp-stick','exp-interact','exp-notes-toggle','exp-menu-button']);assert.ok(controlBoxes.every(b=>b.inside));const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;assert.equal(overlaps(controlBoxes[0],controlBoxes[1]),false);for(const control of controlBoxes.slice(0,2))for(const nav of controlBoxes.slice(2))assert.equal(overlaps(control,nav),false);report.controlBoxes=controlBoxes;report.layers.touchEmulation='PASS';record('U04 native blank-root touch start, two-pointer investigation, cancelled movement, portrait input and notebook remain usable');
  await touch.locator('#exp-menu-button').tap();await touch.locator('#exp-title').tap();await touch.locator('#exp-title-restart').tap();await touch.locator('#exp-cancel-restart').tap();assert.equal((await state(touch)).view,'title');await touch.locator('#exp-begin').tap();await notebook(touch,true);
  await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await wait(touch,()=>document.querySelector('#exp-root').dataset.disposed==='true'&&document.querySelector('#exp-stage').dataset.mapObjects==='0');assert.equal(await touch.locator('#exp-stage canvas').count(),0);assert.equal(await touch.locator('#exp-stage').getAttribute('data-resize-observers'),'0');assert.equal(await touch.locator('#exp-photo-image').getAttribute('src'),null);assert.equal(await touch.locator('#exp-card-image').getAttribute('src'),null);const signals=await touch.evaluate(()=>window.__expSignals.map(s=>({type:s.type,aborted:s.signal.aborted})));assert.ok(signals.length>10&&signals.every(s=>s.aborted));await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await touch.keyboard.press('Escape');await touch.locator('#exp-notes-close').click();assert.equal((await state(touch)).tokens,0);record('U06 UI and input AbortSignals, resize observer, canvas, image references and repeated disposal clean',{signals,probe:'explicit pagehide disposal, separate from native hidden above'});
  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.networkErrors,[]);record('U06 zero unexpected page or network failures');

  report.uiFixtures={archive};
 }

}catch(error){
  report.failure={message:String(error),stack:error.stack};
  if(active&&!active.isClosed()){try{await shot(active,'FAIL');if(await active.locator('#exp-root').count())report.failureState=await state(active);report.failurePointerEvents=await active.evaluate(()=>window.__pointerEvents??[]);}catch(e){report.failureEvidenceError=String(e);}}
  console.error(error);
}finally{
  for(const c of contexts){try{await c.close();}catch(e){report.cleanup.contextError=String(e);}}
  report.cleanup.contexts=report.cleanup.contextError?'FAIL':'PASS';
  try{await browser?.close();report.cleanup.browser='PASS';}catch(e){report.cleanup.browser='FAIL';report.cleanup.browserError=String(e);}
  if(nativeBrowser){try{const session=await nativeBrowser.newBrowserCDPSession();await session.send('Browser.close');}catch{}await nativeBrowser.close().catch(()=>{});}
  if(nativeProcess){
    if(nativeProcess.exitCode===null)await new Promise(done=>{const timer=setTimeout(done,2000);nativeProcess.once('exit',()=>{clearTimeout(timer);done();});});
    if(nativeProcess.exitCode===null){nativeProcess.kill();await new Promise(done=>nativeProcess.once('exit',done));}
    report.cleanup.nativeChrome=nativeProcess.exitCode!==null||nativeProcess.signalCode!==null?'PASS':'FAIL';
    report.cleanup.nativeChromePid=nativeProcess.pid;
  }
  await new Promise(done=>server.close(done));report.cleanup.server='PASS';
  report.cleanup.thirdParty='Phaser global internal visibility handlers are not owned by the host; page teardown reclaims document scope. Explicit host AbortSignals and visibility unbinding checked separately.';
  report.finishedAt=new Date().toISOString();report.status=report.failure||Object.values(report.cleanup).includes('FAIL')?'FAIL':'PASS';
  await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));
  await writeFile(join(dir,'report.sha256'),await sha(join(dir,'report.json')));
  console.log(report.status,'EXP-03A',dir);if(report.status==='FAIL')process.exitCode=1;
}
