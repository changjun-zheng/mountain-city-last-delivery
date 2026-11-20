import assert from 'node:assert/strict';
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
const dir=resolve('test-results/exp-01',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:'EXP-01',scope:'production-exploration-street-room-item-gate-save-input-cleanup',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],cleanup:{},hashes:{},historicalFocusFailure:'Retained; old long focus suite NOT RUN'};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function hashTree(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await hashTree(p);else report.hashes[relative(process.cwd(),p).replaceAll('\\','/')]=await sha(p);}}
const files=['src/core/progress.ts','src/core/exploration.ts','src/core/exploration-content.ts','src/platform/web/main.ts','src/platform/web/style.css','src/rendering/phaser/exploration.ts','src/platform/web/exploration.ts','src/platform/web/exploration-input.ts','src/platform/web/exploration-storage.ts','tests/exploration.test.mjs','tests/exp-01-browser.mjs','src/rendering/phaser/assets/exp-01/ASSET_SOURCES.md'];
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
const state=page=>page.locator('#exp-root').evaluate(e=>({...e.dataset,x:Number(e.dataset.x),y:Number(e.dataset.y),tick:Number(e.dataset.tick),tokens:Number(e.dataset.tokens)}));
const wait=async(page,predicate,arg)=>page.waitForFunction(predicate,arg,{timeout:8000,polling:'raf'});
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
  browser=await chromium.launch({executablePath:selection.executablePath,headless:true});
  const p=await newPage({viewport:{width:1280,height:720}});
  const cdp=await p.context().newCDPSession(p);report.browser.actual=identifyBrowser(await cdp.send('Browser.getVersion'));
  await p.goto(report.url);await loaded(p);
  assert.equal(await p.locator('#game canvas').count(),0);assert.equal(await p.locator('#exp-stage canvas').count(),1);
  await shot(p,'01-street-first');record('E01 isolated new entry and original street artwork');
  // Measure real keyboard motion over simulation ticks, then restore by walking.
  const directions=[];
  for(const [keys,dx,dy] of [[['ArrowRight'],1,0],[['ArrowLeft'],-1,0],[['ArrowDown'],0,1],[['ArrowUp'],0,-1],[['KeyD','KeyS'],1,1],[['KeyA','KeyS'],-1,1],[['KeyD','KeyW'],1,-1],[['KeyA','KeyW'],-1,-1]]){
    await walk(p,300,450);
    for(const code of keys)await p.keyboard.down(code);
    const started=await state(p);await wait(p,t=>Number(document.querySelector('#exp-root').dataset.tick)>=t+3,started.tick);
    const a=await state(p);await wait(p,t=>Number(document.querySelector('#exp-root').dataset.tick)>=t+5,a.tick);const b=await state(p);
    for(const code of keys)await p.keyboard.up(code);
    const speed=Math.hypot(b.x-a.x,b.y-a.y)/(b.tick-a.tick);
    directions.push({keys,dx:b.x-a.x,dy:b.y-a.y,speed,ticks:b.tick-a.tick});
    assert.ok(dx===0?Math.abs(b.x-a.x)<.01:Math.sign(b.x-a.x)===dx);
    assert.ok(dy===0?Math.abs(b.y-a.y)<.01:Math.sign(b.y-a.y)===dy);
    assert.ok(Math.abs(speed-3.5)<.01,JSON.stringify(directions.at(-1)));
  }
  record('E01 all eight real keyboard directions and equal diagonal speed',{directions});
  await walk(p,240,450);await interact(p,'visitor');await shot(p,'02-visitor');await close(p);
  await walk(p,540,450);await hold(p,'KeyW',900);assert.ok((await state(p)).y>=374);record('E01 hut foot collision and door approach');
  await interact(p,'door');assert.equal((await state(p)).map,'room');const id=(await state(p)).runtimeId;
  await shot(p,'03-room');
  await walk(p,745,350);await interact(p,'plaque');assert.equal((await state(p)).item,'false');await close(p);
  await walk(p,745,440);await walk(p,345,350);await interact(p,'note');await close(p);
  await walk(p,345,440);await walk(p,745,350);await interact(p,'plaque');await shot(p,'04-item');await close(p);
  const itemProgress=(await state(p)).progress;
  await interact(p,'plaque');await close(p);assert.equal((await state(p)).progress,itemProgress);
  await walk(p,745,450);await walk(p,540,535);await interact(p,'exit');
  for(let i=0;i<3;i++){
    await interact(p,'door');await interact(p,'exit');assert.equal((await state(p)).runtimeId,id);
    assert.equal(await p.locator('#exp-stage canvas').count(),1);assert.equal((await state(p)).inputBindings,'1');
  }
  assert.ok(Math.abs((await state(p)).x-540)<1);assert.ok(Math.abs((await state(p)).y-395)<1);
  record('E02 room observation, item, idempotence and three round trips',{runtimeId:id});
  await walk(p,800,450);await hold(p,'KeyD',600);assert.ok((await state(p)).x<=843);
  await interact(p,'gate');await close(p);assert.equal((await state(p)).unlocked,'true');
  await walk(p,985,450);await interact(p,'view');await shot(p,'05-open-view');await close(p);
  const completed=await state(p);await p.reload();await loaded(p);const restored=await state(p);
  assert.notEqual(restored.runtimeId,id);assert.equal(restored.progress,completed.progress);assert.equal(restored.completed,'true');assert.equal(restored.x,975);assert.equal(restored.y,470);
  await shot(p,'06-restored');record('E03 locked barrier, real crossing, refresh with new runtime at safe point',{before:id,after:restored.runtimeId});
  // Reopen on the same origin using the same real browser storage context.
  const reopen=await p.context().newPage();active=reopen;await reopen.goto(report.url);await loaded(reopen);assert.equal((await state(reopen)).completed,'true');await reopen.close();active=p;await p.bringToFront();
  // Alias release and pause clear held motion; no queued movement on resume.
  await walk(p,760,460);await p.keyboard.down('KeyA');await p.keyboard.down('ArrowLeft');await p.keyboard.up('KeyA');const alias=await state(p);await p.waitForTimeout(150);assert.ok((await state(p)).x<alias.x-10);await p.keyboard.up('ArrowLeft');
  await p.keyboard.down('KeyD');await p.locator('#exp-menu-button').click();const paused=await state(p);await p.waitForTimeout(150);assert.equal((await state(p)).tick,paused.tick);
  await p.locator('#exp-title').click();assert.equal((await state(p)).runtimeId,restored.runtimeId);await p.locator('#exp-resume').click();
  const resume=await state(p);await p.waitForTimeout(180);assert.equal((await state(p)).x,resume.x);await p.keyboard.up('KeyD');
  record('E04 keyboard aliases, pause/title preserve runtime and suppress held input');
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
  await np.waitForFunction(()=>document.visibilityState==='hidden',undefined,{timeout:8000,polling:100});
  const hidden=await state(np);assert.equal(hidden.tokens,2);assert.equal(hidden.tick,menuState.tick);
  await np.bringToFront();await wait(np,()=>document.visibilityState==='visible');
  assert.equal((await state(np)).tokens,1);assert.equal((await state(np)).tick,menuState.tick);
  await np.locator('#exp-resume').click();const visResume=await state(np);await np.waitForTimeout(120);assert.ok((await state(np)).tick-visResume.tick<10);assert.equal((await state(np)).x,visResume.x);await np.keyboard.up('KeyD');
  report.visibility=await np.evaluate(()=>window.__visibility);assert.ok(report.visibility.some(v=>v.state==='hidden'));
  record('E04 native lifecycle hidden plus independent menu owner',{hidden,events:report.visibility});
  await bg.close();active=p;
  report.layers.desktopChrome='PASS';

  const touch=await newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const tc=await touch.context().newCDPSession(touch);
  await touch.goto(report.url);await loaded(touch);await shot(touch,'07-touch-street');
  const box=await touch.locator('#exp-stick').boundingBox();const center={x:box.x+box.width/2,y:box.y+box.height/2};
  const button=await touch.locator('#exp-interact').boundingBox();
  const dispatch=(type,points)=>tc.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1});
  await dispatch('touchStart',[point(1,center.x,center.y)]);await dispatch('touchMove',[point(1,center.x+32,center.y)]);
  await wait(touch,()=>Number(document.querySelector('#exp-root').dataset.x)>=215);
  await dispatch('touchStart',[point(1,center.x+32,center.y),point(2,button.x+button.width/2,button.y+button.height/2)]);
  await wait(touch,()=>document.querySelector('#exp-root').dataset.dialogue==='true');
  assert.equal((await state(touch)).accepted,'true');assert.equal(JSON.parse((await state(touch)).input).pointers,0);
  await dispatch('touchEnd',[]);await touch.locator('#exp-close').click();record('E04 native multi-touch move plus interact and dialogue source cleanup');
  // Real pointer capture loss, cancel and mixed keyboard/joystick ownership.
  await dispatch('touchStart',[point(3,center.x,center.y)]);await dispatch('touchMove',[point(3,center.x,center.y+32)]);
  await touch.keyboard.down('KeyD');const mixed=await state(touch);assert.equal(JSON.parse(mixed.input).pointers,1);
  await dispatch('touchCancel',[]);const afterCancel=JSON.parse((await state(touch)).input);assert.equal(afterCancel.pointers,0);assert.ok(afterCancel.x>0);await touch.keyboard.up('KeyD');
  await dispatch('touchStart',[point(4,center.x,center.y)]);await dispatch('touchMove',[point(4,center.x+32,center.y)]);
  const releasedCapture=await touch.locator('#exp-stick').evaluate(el=>{
    const event=window.__pointerEvents.findLast(e=>e.type==='gotpointercapture'&&e.target==='exp-stick');
    if(!event||!el.hasPointerCapture(event.pointerId))throw new Error('No native stick capture available');
    el.releasePointerCapture(event.pointerId);return event.pointerId;
  });
  // The browser processes pending capture changes at the next pointer event.
  await dispatch('touchMove',[point(4,center.x+31,center.y)]);
  await touch.waitForTimeout(50);assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchEnd',[]);
  await dispatch('touchStart',[point(5,center.x,center.y)]);await dispatch('touchMove',[point(5,center.x+32,center.y)]);
  await touch.setViewportSize({width:390,height:844});await touch.waitForTimeout(100);assert.equal(JSON.parse((await state(touch)).input).pointers,0);
  await dispatch('touchEnd',[]);const portraitCanvas=await fitCanvas(touch);await shot(touch,'08-portrait');await touch.setViewportSize({width:844,height:390});const landscapeCanvas=await fitCanvas(touch);
  const boxes=await touch.locator('#exp-menu-button, #exp-stick, #exp-interact').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  assert.ok(boxes.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=844&&b.y+b.h<=390));
  const pointerEvents=await touch.evaluate(()=>window.__pointerEvents);
  assert.ok(pointerEvents.some(e=>e.type==='lostpointercapture'&&e.pointerId===releasedCapture&&e.trusted));
  record('E04 touch cancel, lost capture, mixed sources, resize and control bounds',{boxes,pointerEvents,portraitCanvas,landscapeCanvas});
  // Complete the same route using native touch Pointer Events, with no keyboard.
  let touchId=30;
  const touchAxis=async(coordinate,target)=>{
    const s=await state(touch),positive=target>s[coordinate];if(Math.abs(target-s[coordinate])<5)return;
    const box=await touch.locator('#exp-stick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,id=touchId++;
    await dispatch('touchStart',[point(id,x,y)]);
    await dispatch('touchMove',[point(id,x+(coordinate==='x'?(positive?32:-32):0),y+(coordinate==='y'?(positive?32:-32):0))]);
    try{await wait(touch,({coordinate,target,positive})=>{const s=document.querySelector('#exp-root').dataset;return positive?Number(s[coordinate])>=target-3:Number(s[coordinate])<=target+3;},{coordinate,target,positive});}
    finally{await dispatch('touchEnd',[]);}
  };
  const touchWalk=async(x,y)=>{await touchAxis('x',x);await touchAxis('y',y);report.timeline.push({event:'native-touch-walk',x,y,state:await state(touch)});};
  const touchInteract=async target=>{
    assert.equal((await state(touch)).target,target);
    const b=await touch.locator('#exp-interact').boundingBox();await dispatch('touchStart',[point(touchId++,b.x+b.width/2,b.y+b.height/2)]);await dispatch('touchEnd',[]);
  };
  const touchClose=async()=>{await touch.locator('#exp-close').tap();};
  await touchWalk(540,400);await touchInteract('door');await shot(touch,'10-touch-room');
  await touchWalk(345,440);await touchWalk(345,350);await touchInteract('note');await touchClose();
  await touchWalk(345,440);await touchWalk(745,350);await touchInteract('plaque');await touchClose();
  await touchWalk(745,450);await touchWalk(540,535);await touchInteract('exit');
  await touchWalk(805,450);await touchInteract('gate');await touchClose();await touchWalk(985,450);await touchInteract('view');await touchClose();
  const touchComplete=await state(touch);await touch.reload();await loaded(touch);const touchRestored=await state(touch);
  assert.notEqual(touchRestored.runtimeId,touchComplete.runtimeId);assert.equal(touchRestored.progress,touchComplete.progress);assert.equal(touchRestored.completed,'true');
  await shot(touch,'11-touch-restored');record('E02 E03 full native touch route and refresh',{before:touchComplete.runtimeId,after:touchRestored.runtimeId});report.layers.touchEmulation='PASS';

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
  console.log(report.status,'EXP-01',dir);if(report.status==='FAIL')process.exitCode=1;
}
