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
if(!args.includes('--production')||args.some(a=>a!=='--production'&&!a.startsWith('--browser=')))throw new Error('Use --production --browser=chrome');
const selection=resolveBrowserExecutable(parseBrowserSelection(args));
assert.equal(selection.id,'chrome');
const dir=resolve('test-results/exp-02a',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:'EXP-02A',scope:'production-two-level-district-three-interiors-camera-route-save-input-cleanup',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],cleanup:{},hashes:{},historicalFocusFailure:'Retained; old long focus suite NOT RUN'};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function hashTree(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await hashTree(p);else report.hashes[relative(process.cwd(),p).replaceAll('\\','/')]=await sha(p);}}
const files=['src/core/progress.ts','src/core/exploration.ts','src/core/exploration-content.ts','src/platform/web/main.ts','src/platform/web/style.css','src/rendering/phaser/exploration.ts','src/platform/web/exploration.ts','src/platform/web/exploration-input.ts','src/platform/web/exploration-storage.ts','tests/exploration.test.mjs','tests/exploration-district.test.mjs','tests/exp-02a-browser.mjs','src/rendering/phaser/assets/exp-02a/ASSET_SOURCES.md'];
for(const file of files)report.hashes[file]=await sha(file);await hashTree(resolve('dist'));
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
  const code=coordinate==='x'?(positive?'KeyD':'KeyA'):(positive?'KeyS':'KeyW');
  await page.keyboard.down(code);
  try{await wait(page,({coordinate,target,positive})=>{const d=document.querySelector('#exp-root').dataset;return positive?Number(d[coordinate])>=target-3:Number(d[coordinate])<=target+3;},{coordinate,target,positive});}
  finally{await page.keyboard.up(code);}
}
async function walk(page,x,y){await axis(page,'x',x);await axis(page,'y',y);report.timeline.push({event:'walk',x,y,state:await state(page)});}
async function interact(page,target){assert.equal((await state(page)).target,target);await key(page,'KeyE');}
async function close(page){await page.locator('#exp-close').click();await wait(page,()=>document.querySelector('#exp-root').dataset.dialogue==='false');}
async function loaded(page){await wait(page,()=>document.querySelector('#exp-root')?.dataset.ready==='true');await page.waitForLoadState('networkidle');}
async function newPage(options={}){
  const c=await browser.newContext(options);contexts.push(c);const p=await c.newPage();active=p;
  p.on('pageerror',error=>report.pageErrors.push(String(error)));
  await p.addInitScript(()=>{
    const original=EventTarget.prototype.addEventListener;
    window.__expSignals=[];window.__visibility=[];window.__pointerEvents=[];
    EventTarget.prototype.addEventListener=function(type,fn,options){if(options?.signal)window.__expSignals.push({type,signal:options.signal});return original.call(this,type,fn,options);};
    document.addEventListener('visibilitychange',()=>window.__visibility.push({state:document.visibilityState,focus:document.hasFocus(),at:performance.now()}));
    for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture'])document.addEventListener(type,e=>window.__pointerEvents.push({type,pointerId:e.pointerId,target:e.target.id,trusted:e.isTrusted}),true);
  });
  return p;
}

try{
  report.maps=EXP_MAPS;report.connections=EXP_TARGETS.filter(t=>t.destination);
  const svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1100" viewBox="0 0 3600 3300"><rect width="3600" height="3300" fill="#244353"/>'];
  for(const [id,offset] of [['upper',100],['lower',1650]]){
    const m=EXP_MAPS[id];svg.push('<g transform="translate(100,'+offset+')"><text x="0" y="-25" fill="#ffe3a0" font-size="52">'+id+' 3300×1300</text><rect width="3300" height="1300" fill="#91a18b"/>');
    for(const wall of m.walls)svg.push('<rect x="'+wall.x+'" y="'+wall.y+'" width="'+wall.w+'" height="'+wall.h+'" fill="#72513d"/>');
    for(const t of EXP_TARGETS.filter(t=>t.map===id))svg.push('<circle cx="'+t.x+'" cy="'+t.y+'" r="18" fill="#ffe3a0"/><text x="'+(t.x+25)+'" y="'+t.y+'" fill="#243d48" font-size="34">'+t.id+'</text>');
    svg.push('</g>');
  }svg.push('</svg>');await writeFile(join(dir,'map-structure.svg'),svg.join(''));
  browser=await chromium.launch({executablePath:selection.executablePath,headless:true});
  const p=await newPage({viewport:{width:1280,height:720}});const cdp=await p.context().newCDPSession(p);report.browser.actual=identifyBrowser(await cdp.send('Browser.getVersion'));
  await p.goto(report.url);await loaded(p);await fitCanvas(p);
  assert.equal(await p.locator('#game canvas').count(),0);assert.equal((await state(p)).zoom,1);await shot(p,'01-upper-west');
  const first=await state(p),hud=await p.locator('.exp-hud').boundingBox();
  await walk(p,350,690);await interact(p,'visitor');assert.equal((await state(p)).accepted,'false');await p.locator('#exp-menu-button').click();assert.equal((await state(p)).accepted,'false');await p.locator('#exp-resume').click();
  await interact(p,'visitor');await close(p);assert.equal((await state(p)).accepted,'true');record('A3 visitor commits only on normal completion; pause cancels pending acceptance');
  const runtimeId=(await state(p)).runtimeId;
  await walk(p,880,690);await walk(p,880,580);await interact(p,'guide-door');await shot(p,'05-guide-room');
  await walk(p,340,540);await walk(p,340,325);await interact(p,'note');await close(p);assert.equal((await state(p)).clue,'true');
  const roomRuntime=(await state(p)).runtimeId;await p.reload();await loaded(p);assert.equal((await state(p)).map,'guide');assert.equal((await state(p)).clue,'true');assert.notEqual((await state(p)).runtimeId,roomRuntime);
  const savedGuide=await state(p);await interact(p,'guide-exit');
  for(let i=0;i<3;i++){await interact(p,'guide-door');await interact(p,'guide-exit');assert.equal((await state(p)).runtimeId,savedGuide.runtimeId);assert.equal((await state(p)).inputBindings,'1');assert.equal(await p.locator('#exp-stage canvas').count(),1);}
  await walk(p,1120,580);await walk(p,1120,270);await shot(p,'13-upper-rear-lane');await walk(p,1900,270);await walk(p,1900,650);await walk(p,2300,650);await walk(p,2300,580);await shot(p,'02-upper-east');
  const far=await state(p);assert.ok(far.cameraX>1500);assert.ok(Math.abs(far.cameraY-first.cameraY)>1);assert.equal(far.zoom,1);assert.deepEqual(await p.locator('.exp-hud').boundingBox(),hud);record('A1 world-scale streets and bounded follow camera; HUD stays in screen coordinates',{first,far});
  await interact(p,'workshop-door');await shot(p,'06-workshop-room');await walk(p,760,540);await walk(p,760,430);await interact(p,'plaque');await close(p);assert.equal((await state(p)).item,'true');
  const itemProgress=(await state(p)).progress;await interact(p,'plaque');await close(p);assert.equal((await state(p)).progress,itemProgress);
  const workshopRuntime=(await state(p)).runtimeId;await p.reload();await loaded(p);assert.equal((await state(p)).map,'workshop');assert.equal((await state(p)).item,'true');assert.notEqual((await state(p)).runtimeId,workshopRuntime);const workshopRestored=await state(p);
  await walk(p,760,540);await walk(p,540,540);await interact(p,'workshop-exit');
  for(let i=0;i<3;i++){await interact(p,'workshop-door');await interact(p,'workshop-exit');assert.equal((await state(p)).runtimeId,workshopRestored.runtimeId);}
  // Southern route around the market block; the tea room is genuinely optional.
  await walk(p,2300,650);await walk(p,1900,650);await walk(p,1900,1160);await walk(p,1660,1160);await interact(p,'tea-door');await shot(p,'07-tea-room');
  await walk(p,545,325);await interact(p,'tea-observe');await close(p);const teaRuntime=(await state(p)).runtimeId;await p.reload();await loaded(p);assert.equal((await state(p)).map,'tea');assert.notEqual((await state(p)).runtimeId,teaRuntime);
  await interact(p,'tea-exit');for(let i=0;i<3;i++){await interact(p,'tea-door');await interact(p,'tea-exit');}
  record('A2 three real interiors, distinct uses, corresponding returns and three rounds each');
  await walk(p,1900,1160);await walk(p,1900,650);await walk(p,2700,650);await walk(p,2700,750);
  await hold(p,'KeyD',500);assert.ok((await state(p)).x<=2738);await shot(p,'08-gate-closed');
  await interact(p,'gate');assert.equal((await state(p)).unlocked,'false');await close(p);assert.equal((await state(p)).unlocked,'true');await shot(p,'09-gate-open');
  await walk(p,3060,750);await interact(p,'east-down');assert.equal((await state(p)).map,'lower');await shot(p,'03-lower-east');
  const lowerRuntime=(await state(p)).runtimeId;await p.reload();await loaded(p);assert.equal((await state(p)).map,'lower');assert.notEqual((await state(p)).runtimeId,lowerRuntime);assert.equal((await state(p)).unlocked,'true');
  await walk(p,2100,650);await walk(p,1780,650);await walk(p,1780,1120);await walk(p,1700,1120);await shot(p,'04-lower-overlook');await interact(p,'view');await close(p);assert.equal((await state(p)).completed,'true');
  // Actual west return connects the two layers into a revisit loop.
  await walk(p,1100,1120);await walk(p,430,1120);await walk(p,430,1060);await interact(p,'west-up');assert.equal((await state(p)).map,'upper');
  const upperRuntime=(await state(p)).runtimeId;await p.reload();await loaded(p);assert.equal((await state(p)).map,'upper');assert.equal((await state(p)).completed,'true');assert.notEqual((await state(p)).runtimeId,upperRuntime);
  await interact(p,'west-down');await walk(p,430,650);await walk(p,1500,650);await walk(p,2100,650);await walk(p,3000,650);await interact(p,'east-up');assert.equal((await state(p)).map,'upper');
  record('A3 A4 real unlock, crossing, both floor links, revisit loop and saves on both outdoor floors');
  await p.locator('#exp-menu-button').click();await p.locator('#exp-title').click();const titleState=await state(p);await p.locator('#exp-resume').click();assert.equal((await state(p)).runtimeId,titleState.runtimeId);
  // Separate ordinary Chrome with CDP noDefaults: Playwright's default focus
  // emulation otherwise keeps pages visible and cannot supply this evidence.
  const profile=join(dir,'native-chrome-profile');await mkdir(profile);
  nativeProcess=spawn(selection.executablePath,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe']});
  report.nativeChrome={pid:nativeProcess.pid,profile};let stderr='';nativeProcess.stderr.setEncoding('utf8');
  const endpoint=await new Promise((done,fail)=>{
    const timer=setTimeout(()=>fail(new Error(`Native Chrome CDP unavailable: ${stderr}`)),15000);
    nativeProcess.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);done(match[1]);}});
    nativeProcess.once('exit',code=>{clearTimeout(timer);fail(new Error(`Native Chrome exited ${code}`));});
  });
  nativeBrowser=await chromium.connectOverCDP(endpoint,{noDefaults:true});
  const nativeContext=nativeBrowser.contexts()[0],np=nativeContext.pages()[0];active=np;
  await np.addInitScript(()=>{window.__visibility=[];document.addEventListener('visibilitychange',()=>window.__visibility.push({state:document.visibilityState,focus:document.hasFocus(),tokens:document.querySelector('#exp-root')?.dataset.tokens,at:performance.now()}));});
  await np.goto(report.url);await loaded(np);await np.bringToFront();
  await np.keyboard.down('KeyD');await np.locator('#exp-menu-button').click();const menuState=await state(np);
  const bg=await nativeContext.newPage();await bg.goto('about:blank');await bg.bringToFront();
  await np.waitForFunction(()=>document.visibilityState==='hidden',undefined,{timeout:20000,polling:100});
  const hidden=await state(np);assert.equal(hidden.tokens,2);assert.equal(hidden.tick,menuState.tick);
  await np.bringToFront();await wait(np,()=>document.visibilityState==='visible');
  assert.equal((await state(np)).tokens,1);assert.equal((await state(np)).tick,menuState.tick);
  await np.locator('#exp-resume').click();const visResume=await state(np);await np.waitForTimeout(120);assert.ok((await state(np)).tick-visResume.tick<10);assert.equal((await state(np)).x,visResume.x);await np.keyboard.up('KeyD');
  report.visibility=await np.evaluate(()=>window.__visibility);assert.ok(report.visibility.some(v=>v.state==='hidden'));
  record('E04 native lifecycle hidden plus independent menu owner',{hidden,events:report.visibility});
  await bg.close();active=p;
  report.layers.desktopChrome='PASS';
  const touch=await newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});const tc=await touch.context().newCDPSession(touch);
  // Old-version fixture in an isolated context only; EXP-02A progress is never
  // injected. All current-version progress below comes from native gameplay.
  const oldArchive=JSON.stringify({schemaVersion:1,contentVersion:'exp01-wooden-court-1',safe:'overlook',progress:{collections:['collection.exp01.passage-plaque'],goals:['goal.exp01.photo-request','goal.exp01.route-note','goal.exp01.passage-open','goal.exp01.view-found'],rewards:[],effects:[{id:'effect.exp01.passage-open',expectedActive:true}],counts:{collections:1,goals:4,rewards:0,effects:1}}});
  await touch.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp01.save.v1'))localStorage.setItem('pokan.exp01.save.v1',raw);},oldArchive);
  await touch.goto(report.url);await loaded(touch);assert.equal((await state(touch)).completed,'false');assert.match(await touch.locator('#exp-archive-notice').textContent(),/旧庭院小样档案保留/);
  const dispatch=(type,points)=>tc.send('Input.dispatchTouchEvent',{type,touchPoints:points});const point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1});let touchId=10;
  const touchAxis=async(coordinate,target)=>{const s=await state(touch),positive=target>s[coordinate];if(Math.abs(target-s[coordinate])<5)return;const b=await touch.locator('#exp-stick').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,id=touchId++;await dispatch('touchStart',[point(id,x,y)]);await dispatch('touchMove',[point(id,x+(coordinate==='x'?(positive?32:-32):0),y+(coordinate==='y'?(positive?32:-32):0))]);try{await wait(touch,({coordinate,target,positive})=>{const s=document.querySelector('#exp-root').dataset;return positive?Number(s[coordinate])>=target-3:Number(s[coordinate])<=target+3;},{coordinate,target,positive});}finally{await dispatch('touchEnd',[]);}};
  const touchWalk=async(x,y)=>{await touchAxis('x',x);await touchAxis('y',y);report.timeline.push({event:'native-touch-walk',x,y,state:await state(touch)});};
  const touchInteract=async target=>{assert.equal((await state(touch)).target,target);const b=await touch.locator('#exp-interact').boundingBox();await dispatch('touchStart',[point(touchId++,b.x+b.width/2,b.y+b.height/2)]);await dispatch('touchEnd',[]);};
  const touchClose=async()=>touch.locator('#exp-close').tap();
  // Native simultaneous movement and world interaction, after scrolling-independent input projection.
  const b=await touch.locator('#exp-stick').boundingBox(),cx=b.x+b.width/2,cy=b.y+b.height/2,ib=await touch.locator('#exp-interact').boundingBox();
  await dispatch('touchStart',[point(1,cx,cy)]);await dispatch('touchMove',[point(1,cx+32,cy)]);await wait(touch,()=>Number(document.querySelector('#exp-root').dataset.x)>=330);
  await dispatch('touchStart',[point(1,cx+32,cy),point(2,ib.x+ib.width/2,ib.y+ib.height/2)]);await wait(touch,()=>document.querySelector('#exp-root').dataset.dialogue==='true');assert.equal((await state(touch)).accepted,'false');assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchEnd',[]);await touchClose();assert.equal((await state(touch)).accepted,'true');
  // Take the item before reading the guide: both investigation orders remain valid.
  await touchWalk(2300,690);await touchWalk(2300,580);await touchInteract('workshop-door');await touchWalk(760,540);await touchWalk(760,430);await touchInteract('plaque');await touchClose();await touchWalk(760,540);await touchWalk(540,540);await touchInteract('workshop-exit');
  await touchWalk(2300,650);await touchWalk(2700,650);await touchWalk(2700,750);await touchInteract('gate');await touchClose();assert.equal((await state(touch)).unlocked,'false');assert.equal((await state(touch)).item,'true');
  await touchWalk(2700,650);await touchWalk(880,650);await touchWalk(880,580);await touchInteract('guide-door');await touchWalk(340,540);await touchWalk(340,325);await touchInteract('note');await touchClose();await touchWalk(340,540);await touchWalk(540,540);await touchInteract('guide-exit');
  await touchWalk(880,650);await touchWalk(2700,650);await touchWalk(2700,750);await touchInteract('gate');await touchClose();await touchWalk(3060,750);await touchInteract('east-down');await shot(touch,'10-touch-lower');
  await touchWalk(2100,650);await touchWalk(1780,650);await touchWalk(1780,1120);await touchWalk(1700,1120);await touchInteract('view');await touchClose();const touchComplete=await state(touch);await touch.reload();await loaded(touch);assert.equal((await state(touch)).progress,touchComplete.progress);assert.notEqual((await state(touch)).runtimeId,touchComplete.runtimeId);
  assert.equal(await touch.evaluate(()=>localStorage.getItem('pokan.exp01.save.v1')),oldArchive);
  record('A4 A5 full native touch route, alternate order, refresh and unchanged old archive',{legacyFixtureOnly:true});
  // Native capture cancellation, alias ownership and rotation cleanup retained from EXP-01.
  const box=await touch.locator('#exp-stick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  await dispatch('touchStart',[point(3,x,y)]);await dispatch('touchMove',[point(3,x,y+32)]);await touch.keyboard.down('KeyD');await dispatch('touchCancel',[]);assert.equal(JSON.parse((await state(touch)).input).pointers,0);assert.ok(JSON.parse((await state(touch)).input).x>0);await touch.keyboard.up('KeyD');
  await dispatch('touchStart',[point(4,x,y)]);await dispatch('touchMove',[point(4,x+32,y)]);await touch.locator('#exp-stick').evaluate(el=>{const e=window.__pointerEvents.findLast(e=>e.type==='gotpointercapture'&&e.target==='exp-stick');if(!e||!el.hasPointerCapture(e.pointerId))throw new Error('No native capture');el.releasePointerCapture(e.pointerId);});await dispatch('touchMove',[point(4,x+31,y)]);assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchEnd',[]);
  await dispatch('touchStart',[point(5,x,y)]);await dispatch('touchMove',[point(5,x+32,y)]);await touch.setViewportSize({width:390,height:844});await fitCanvas(touch);assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchEnd',[]);await shot(touch,'11-touch-portrait');await touch.setViewportSize({width:844,height:390});await fitCanvas(touch);await shot(touch,'12-touch-landscape');
  await touch.locator('#exp-menu-button').tap();const paused=await state(touch);await touch.waitForTimeout(150);assert.equal((await state(touch)).tick,paused.tick);await touch.locator('#exp-resume').tap();assert.equal(JSON.parse((await state(touch)).input).pointers,0);record('A5 native cancel, lost capture, mixed sources, rotation and pause cleanup');report.layers.touchEmulation='PASS';
  // Dispatched pagehide is an explicit disposal probe, separate from native visibility above.
  await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await wait(touch,()=>document.querySelector('#exp-root').dataset.disposed==='true'&&document.querySelector('#exp-stage').dataset.mapObjects==='0');
  assert.equal(await touch.locator('#exp-stage canvas').count(),0);
  assert.equal(await touch.locator('#exp-stage').getAttribute('data-resize-observers'),'0');
  const disposed=await state(touch);await touch.keyboard.press('KeyD');await touch.locator('#exp-menu-button').click();
  await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));assert.equal((await state(touch)).tick,disposed.tick);
  const signals=await touch.evaluate(()=>window.__expSignals.map(s=>({type:s.type,aborted:s.signal.aborted})));
  assert.ok(signals.length>10&&signals.every(s=>s.aborted));record('E05 idempotent disposal, invalidated callbacks, own listeners aborted and canvas removed',{signals,probe:'dispatched pagehide'});
  // Failure after input binding, before Phaser acquisition: adapter resources unwind.
  const fail=await newPage({viewport:{width:1280,height:720}});
  const expectedErrors=[];fail.removeAllListeners('pageerror');fail.on('pageerror',e=>expectedErrors.push(String(e)));
  await fail.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(...args){return document.body?.classList.contains('exp-mode')?null:original.apply(this,args);};
  });
  await fail.goto(report.url);await wait(fail,()=>document.querySelector('#exp-root')?.dataset.disposed==='true');
  assert.equal(await fail.locator('#exp-stage canvas').count(),0);
  assert.equal(await fail.evaluate(()=>window.__expSignals.every(s=>s.signal.aborted)),true);
  assert.equal(await fail.locator('#exp-error').isVisible(),true);record('E05 controlled startup failure unwinds input and visibility bindings',{expectedErrors});

  // The historical default is a real independent page, using its original keys.
  const old=await newPage({viewport:{width:1280,height:720}});await old.goto(base);
  await wait(old,()=>document.querySelector('#diagnostics')?.dataset.mode==='first-level'&&Number(document.querySelector('#diagnostics').dataset.tick)>5);
  assert.equal(await old.locator('#exp-root').count(),0);
  await old.keyboard.down('KeyD');
  await wait(old,()=>Number(document.querySelector('#diagnostics').dataset.x)>1450);
  await old.keyboard.down('Space');await wait(old,()=>Number(document.querySelector('#diagnostics').dataset.x)>1650);await old.keyboard.up('Space');
  await wait(old,()=>{const d=document.querySelector('#diagnostics').dataset;return d.grounded==='true'&&d.support==='b-terrace'&&Number(d.x)>1700;});
  await wait(old,()=>document.querySelector('#diagnostics').dataset.interactionSelected==='first-level-b-npc');await old.keyboard.up('KeyD');
  await key(old,'KeyE');await wait(old,()=>document.querySelector('#diagnostics').dataset.interactionMode==='investigation');await shot(old,'09-legacy-b-dialogue');await key(old,'Escape');
  record('E06 default legacy entry movement jump and B dialogue targeted smoke');
  assert.deepEqual(report.pageErrors,[]);record('E06 no unexpected page errors');
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
  console.log(report.status,'EXP-02A',dir);if(report.status==='FAIL')process.exitCode=1;
}
