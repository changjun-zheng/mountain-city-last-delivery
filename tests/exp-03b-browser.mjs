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
const dir=resolve('test-results/exp-03b',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:'EXP-03B',scope:args.includes('--preview-only')?'memento-display-stage':'optional-mementos-title-migration-real-input',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],networkErrors:[],cleanup:{},hashes:{},historicalFocusFailure:'Retained; old long focus suite NOT RUN'};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function hashTree(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await hashTree(p);else report.hashes[relative(process.cwd(),p).replaceAll('\\','/')]=await sha(p);}}
const files=['src/core/exploration-mementos.ts','src/rendering/phaser/exploration-memento-art.ts','src/rendering/phaser/assets/exp-03b/bookmark.svg','src/rendering/phaser/assets/exp-03b/sketch.svg','src/rendering/phaser/assets/exp-03b/postcard.svg','src/rendering/phaser/assets/exp-03b/ASSET_SOURCES.md','tests/exploration-mementos.test.mjs','tests/exp-03b-browser.mjs','index.html','src/platform/web/exploration-journal.ts','src/platform/web/exploration-ui.ts','src/platform/web/exploration-ui.css','tests/exploration-journal.test.mjs','tests/exp-03a-browser.mjs','src/core/exploration-prologue.ts','src/rendering/phaser/exploration-city-art.ts','src/core/progress.ts','src/core/exploration.ts','src/core/exploration-content.ts','src/core/exploration-photo.ts','src/rendering/phaser/exploration-photo-art.ts','src/platform/web/main.ts','src/platform/web/style.css','src/rendering/phaser/exploration.ts','src/platform/web/exploration.ts','src/platform/web/exploration-input.ts','src/platform/web/exploration-storage.ts','tests/exploration-prologue.test.mjs','tests/exploration.test.mjs','tests/exploration-district.test.mjs','tests/exploration-photo.test.mjs','tests/exp-02c-browser.mjs','src/rendering/phaser/assets/exp-02c/ASSET_SOURCES.md'];
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
report.url=base;
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



async function front(p,{refresh=false,optional=true,touch=false}={}){
 assert.equal((await state(p)).map,'plaza');assert.equal((await state(p)).zoom,1);await shot(p,touch?'touch-a-plaza':'01-a-plaza');
 if(optional){
  await walk(p,470,1000);await walk(p,740,1000);await hold(p,'KeyW',450);assert.ok((await state(p)).y>=971,'Physical base blocks northward approach');
  await walk(p,900,1000);await walk(p,900,790);await walk(p,1250,790);await walk(p,1250,580);await interact(p,'service-door');assert.equal((await state(p)).map,'service');
  if(refresh){const id=(await state(p)).runtimeId;await p.reload();await loaded(p);assert.notEqual((await state(p)).runtimeId,id);assert.equal((await state(p)).map,'service');}
  await walk(p,280,540);await walk(p,280,330);await interact(p,'service-guide');await shot(p,'02-a-service');await close(p);await walk(p,280,540);await walk(p,540,540);await interact(p,'service-exit');assert.equal((await state(p)).map,'plaza');
  if(refresh){await p.reload();await loaded(p);assert.equal((await state(p)).map,'plaza');assert.ok(Math.abs((await state(p)).x-1250)<1);}
  await walk(p,1250,650);
 }else{await walk(p,1250,790);await walk(p,1250,650);}
 await walk(p,2150,650);await shot(p,touch?'touch-a-commercial':'03-a-commercial');await walk(p,3060,650);await walk(p,3060,900);await shot(p,touch?'touch-a-alley':'04-a-alley');await walk(p,3120,900);await interact(p,'city-to-entry');assert.equal((await state(p)).map,'entry');
 if(refresh){await p.reload();await loaded(p);assert.equal((await state(p)).map,'entry');assert.ok(Math.abs((await state(p)).x-200)<1);}
 await walk(p,1100,850);await walk(p,1100,800);await interact(p,'visitor');assert.equal((await state(p)).accepted,'false');await close(p);assert.equal((await state(p)).accepted,'true');await walk(p,1180,800);await walk(p,1180,920);await shot(p,touch?'touch-b-entry':'05-b-entry');
 await walk(p,1180,850);await walk(p,2040,850);await walk(p,2040,780);await interact(p,'entry-to-core');assert.equal((await state(p)).map,'upper');await shot(p,touch?'touch-c-seam':'06-c-seam');
}


const count=async p=>JSON.parse((await state(p)).mementos).length;
async function inspect(p,id){await interact(p,'memento-'+id);assert.equal((await state(p)).dialogue,'true');await p.locator('#exp-memento-image').evaluate(i=>i.decode());}
async function journal(p,n,name,tap=false){await p.locator('#exp-notes-toggle')[tap?'tap':'click']();assert.equal(await p.locator('#exp-memento-list article').count(),n);assert.match(await p.locator('#exp-memento-count').textContent(),new RegExp(n+'/3'));await p.locator('#exp-memento-count').scrollIntoViewIfNeeded();await p.locator('#exp-memento-list img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await shot(p,name);await p.locator('#exp-notes-close')[tap?'tap':'click']();}
try{
 browser=await chromium.launch({executablePath:selection.executablePath,headless:true});
 const p=await newPage({viewport:{width:1280,height:720}}),cdp=await p.context().newCDPSession(p);report.browser.actual=identifyBrowser(await cdp.send('Browser.getVersion'));await p.goto(base);await loaded(p);await p.locator('#exp-begin').click();await journal(p,0,'00-empty-mementos');await front(p,{optional:false});
 await walk(p,880,690);await walk(p,880,580);await interact(p,'guide-door');await walk(p,340,540);await walk(p,340,325);await interact(p,'note');await close(p);await walk(p,340,540);await walk(p,780,540);await walk(p,780,470);assert.equal(await count(p),0);await shot(p,'01-bookmark-world');await inspect(p,'bookmark');assert.equal(await count(p),0);await shot(p,'02-bookmark-inspection');
 if(args.includes('--preview-only')){record('M01 M04 physical bookmark approach and original picture preview; no automatic collection');report.phase='preview-only';report.notRun=['M01 explicit completion/cancel','M02 three items/title','M03 saves','M04 native touch','M05 regression','M06 full cleanup'];}
 else{
  await p.locator('#exp-memento-cancel').click();assert.equal(await count(p),0);await inspect(p,'bookmark');await p.keyboard.press('Escape');assert.equal(await count(p),0);await p.locator('#exp-title').click();await p.locator('#exp-begin').click();assert.equal(await count(p),0);await inspect(p,'bookmark');
  const oldInspection=(await state(p)).mementoInspection,button=await p.locator('#exp-close').boundingBox();await p.mouse.move(button.x+button.width/2,button.y+button.height/2);await p.mouse.down();await p.keyboard.press('Escape');await p.keyboard.press('Escape');await inspect(p,'bookmark');assert.notEqual((await state(p)).mementoInspection,oldInspection);const clicks=await p.evaluate(()=>window.__pointerEvents.filter(e=>e.type==='click'&&e.target==='exp-close'&&e.trusted).length);await p.mouse.up();await wait(p,n=>window.__pointerEvents.filter(e=>e.type==='click'&&e.target==='exp-close'&&e.trusted).length>n,clicks);assert.equal(await count(p),0);await p.locator('#exp-close').click();assert.equal(await count(p),1);assert.equal(JSON.parse((await state(p)).progress).counts.rewards,0);await shot(p,'03-bookmark-owned');await journal(p,1,'04-one-memento');
  await p.reload();await loaded(p);assert.equal((await state(p)).view,'title');assert.equal(await count(p),1);await p.locator('#exp-begin').click();assert.equal(await p.locator('#exp-memento-feedback').textContent(),'');await walk(p,780,540);await walk(p,780,470);const once=(await state(p)).progress;await inspect(p,'bookmark');assert.equal((await state(p)).pending,'');await close(p);assert.equal((await state(p)).progress,once);record('M01 real bookmark cancel/menu/title/stale mouse close/revisit and refresh; first explicit completion only');
  await walk(p,780,540);await walk(p,540,540);await interact(p,'guide-exit');await walk(p,880,650);await walk(p,1010,650);await walk(p,1010,1160);await walk(p,1660,1160);await interact(p,'tea-door');const touchFixture=await p.evaluate(()=>localStorage.getItem('pokan.exp03b.save.v1'));await walk(p,300,540);await walk(p,300,520);await inspect(p,'sketch');assert.equal(await count(p),1);await shot(p,'05-sketch-inspection');await p.keyboard.press('KeyE');assert.equal(await count(p),2);await journal(p,2,'06-two-mementos');await p.reload();await loaded(p);await p.locator('#exp-begin').click();assert.equal(await count(p),2);assert.equal((await state(p)).mementoTitle,'');
  await walk(p,540,540);await interact(p,'tea-exit');await walk(p,1010,1160);await walk(p,1010,650);await walk(p,2300,650);await walk(p,2300,580);await interact(p,'workshop-door');await walk(p,760,540);await walk(p,760,430);await interact(p,'plaque');await close(p);assert.equal(await count(p),2);await walk(p,760,540);await walk(p,540,540);await interact(p,'workshop-exit');await walk(p,2300,650);await walk(p,2700,650);await walk(p,2700,750);await interact(p,'gate');await close(p);await walk(p,3060,750);await interact(p,'east-down');await walk(p,1100,650);await walk(p,1100,1030);await walk(p,470,1030);await walk(p,470,900);await shot(p,'07-postcard-world');await inspect(p,'postcard');await shot(p,'08-postcard-inspection');await close(p);assert.equal(await count(p),3);assert.equal((await state(p)).mementoTitle,'山城拾光者');assert.equal(JSON.parse((await state(p)).progress).counts.rewards,1);assert.equal((await state(p)).photographed,'false');assert.match(await p.locator('#exp-memento-feedback').textContent(),/山城拾光者/);await journal(p,3,'09-three-mementos-title');
  await walk(p,470,1030);await walk(p,1100,1030);await walk(p,1100,1120);await walk(p,1700,1120);await interact(p,'view');await p.locator('#exp-shutter').click();assert.equal((await state(p)).photographed,'true');assert.equal(JSON.parse((await state(p)).progress).counts.rewards,2);await shot(p,'10-photo-independent');await p.locator('#exp-card-close').click();const complete=(await state(p)).progress;await p.reload();await loaded(p);await p.locator('#exp-begin').click();assert.equal((await state(p)).progress,complete);assert.equal(await count(p),3);assert.equal(await p.locator('#exp-memento-feedback').textContent(),'');record('M02 M03 actual root A B C main chain plus three optional paper items, 0/1/2/3 saves, one title and separate photo reward');
  for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:844,height:390},{width:667,height:375},{width:390,height:844}]){await p.setViewportSize(size);await fitCanvas(p);await p.locator('#exp-notes-toggle').click();await p.locator('#exp-memento-award').scrollIntoViewIfNeeded();await p.locator('#exp-memento-list img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));assert.equal(await p.locator('#exp-memento-list img').count(),3);const boxes=await p.locator('#exp-notes-close').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,h:r.height,bottom:r.bottom,right:r.right,font:parseFloat(getComputedStyle(el).fontSize)};});assert.ok(boxes.x>=0&&boxes.y>=0&&boxes.h>=48&&boxes.bottom<=size.height&&boxes.right<=size.width);const fonts=await p.locator('.exp-mementos p').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));assert.ok(fonts.every(v=>v>=14));await shot(p,'collection-'+size.width+'x'+size.height);await p.locator('#exp-notes-close').click();report.timeline.push({event:'memento-layout',size,boxes,fonts});}report.layers.desktopChrome='PASS';record('M04 five collection layouts keep artwork/text legible and sticky close visible at 48 CSS pixels');

  // Inline compatibility fixtures captured once from a real historical zero-collection route.
  const oldCFixtures={"source":"test-results/exp-02c/run-2026-11-20T01-22-01-452Z/report.json","sha256":"a421e42d588ea81279c028bbb53c3ba7b33c258a45df219e4c96dac87e66b417","cases":[{"name":"unaccepted","save":{"schemaVersion":1,"contentVersion":"exp02c-prologue-1","safe":"chapterStart","progress":{"collections":[],"goals":[],"rewards":[],"effects":[],"counts":{"collections":0,"goals":0,"rewards":0,"effects":0}},"observedSites":[],"photo":null}},{"name":"open","save":{"schemaVersion":1,"contentVersion":"exp02c-prologue-1","safe":"workshopDoor","progress":{"collections":["collection.exp02a.river-clasp"],"goals":["goal.exp02a.photo-request","goal.exp02a.river-route-note","goal.exp02a.east-passage-open"],"rewards":[],"effects":[{"id":"effect.exp02a.east-passage-open","expectedActive":true}],"counts":{"collections":1,"goals":3,"rewards":0,"effects":1}},"observedSites":[],"photo":null}},{"name":"photographed","save":{"schemaVersion":1,"contentVersion":"exp02c-prologue-1","safe":"overlook","progress":{"collections":["collection.exp02a.river-clasp"],"goals":["goal.exp02a.photo-request","goal.exp02a.river-route-note","goal.exp02a.east-passage-open","goal.exp02a.lower-view-found","goal.exp02b.night-postcard.photographed"],"rewards":["reward.exp02b.night-postcard"],"effects":[{"id":"effect.exp02a.east-passage-open","expectedActive":true}],"counts":{"collections":1,"goals":5,"rewards":1,"effects":1}},"observedSites":["eaves","window","river"],"photo":{"cardId":"card.exp02b.night-for-faraway","siteId":"river"}}}]};report.oldCFixtureSource={source:oldCFixtures.source,sha256:oldCFixtures.sha256,scope:'historical save compatibility only, not new blank gameplay'};
  for(const fixture of oldCFixtures.cases){const page=await newPage({viewport:{width:1280,height:720}}),raw=JSON.stringify(fixture.save);await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp02c.save.v1'))localStorage.setItem('pokan.exp02c.save.v1',raw);localStorage.setItem('other-memento.fixture','keep');},raw);await page.goto(base);await loaded(page);assert.equal(await page.locator('#exp-begin').textContent(),'继续旅程');await page.locator('#exp-begin').click();assert.equal((await state(page)).safe,fixture.save.safe);assert.deepEqual(JSON.parse((await state(page)).progress),fixture.save.progress);assert.equal(await count(page),0);assert.equal((await state(page)).mementoTitle,'');assert.equal(await page.evaluate(()=>localStorage.getItem('pokan.exp02c.save.v1')),raw);await page.reload();await loaded(page);assert.deepEqual(JSON.parse((await state(page)).progress),fixture.save.progress);if(fixture.name==='photographed'){await page.locator('#exp-title-restart').click();await page.locator('#exp-confirm-restart').click();await loaded(page);await page.reload();await loaded(page);assert.equal((await state(page)).photographed,'false');assert.equal(await count(page),0);assert.equal((await state(page)).safe,'chapterStart');assert.equal(await page.evaluate(()=>localStorage.getItem('pokan.exp02c.save.v1')),raw);assert.equal(await page.evaluate(()=>localStorage.getItem('other-memento.fixture')),'keep');}await page.close();}
  record('M03 actual old C unaccepted/open/photographed fixtures preserve safe/progress/observations/card and no new collection; explicit restart cannot reimport');

  report.actualTouchFixture={source:'This run actual keyboard route: guide bookmark owned, teaRoom entered before sketch',scope:'isolated saved compatibility/input fixture; not a blank main-chain run'};
  // Native hidden while a new pending keepsake is open must cancel, not collect.
  const profile=join(dir,'native-memento-profile');await mkdir(profile);nativeProcess=spawn(selection.executablePath,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe']});let stderr='';nativeProcess.stderr.setEncoding('utf8');const endpoint=await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(new Error('CDP unavailable '+stderr)),15000);nativeProcess.stderr.on('data',chunk=>{stderr+=chunk;const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);done(m[1]);}});});nativeBrowser=await chromium.connectOverCDP(endpoint,{noDefaults:true});const nc=nativeBrowser.contexts()[0],np=nc.pages()[0];active=np;np.on('pageerror',e=>report.pageErrors.push(String(e)));await np.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp03b.save.v1'))localStorage.setItem('pokan.exp03b.save.v1',raw);},touchFixture);await np.goto(base);await loaded(np);await np.bringToFront();await np.locator('#exp-begin').click();await walk(np,300,540);await walk(np,300,520);await inspect(np,'sketch');const bg=await nc.newPage();await bg.goto('about:blank');await bg.bringToFront();await wait(np,()=>document.visibilityState==='hidden');assert.equal((await state(np)).dialogue,'false');assert.equal(await count(np),1);assert.equal((await state(np)).tokens,1);await np.bringToFront();await wait(np,()=>document.visibilityState==='visible');assert.equal((await state(np)).tokens,0);await bg.close();record('M01 M05 native hidden cancels new collectible pending without granting or leaking owner');
  const touch=await newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1}),tc=await touch.context().newCDPSession(touch);await touch.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp03b.save.v1'))localStorage.setItem('pokan.exp03b.save.v1',raw);},touchFixture);await touch.goto(base);await loaded(touch);await touch.locator('#exp-begin').tap();
  const point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1}),dispatch=(type,points)=>tc.send('Input.dispatchTouchEvent',{type,touchPoints:points}),stick=async()=>{const b=await touch.locator('#exp-stick').boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};const touchAxis=async(coordinate,target)=>{const b=await stick(),positive=target>(await state(touch))[coordinate];await dispatch('touchStart',[point(1,b.x,b.y)]);await dispatch('touchMove',[point(1,b.x+(coordinate==='x'?(positive?32:-32):0),b.y+(coordinate==='y'?(positive?32:-32):0))]);try{await wait(touch,({coordinate,target,positive})=>positive?Number(document.querySelector('#exp-root').dataset[coordinate])>=target-3:Number(document.querySelector('#exp-root').dataset[coordinate])<=target+3,{coordinate,target,positive});}finally{await dispatch('touchEnd',[]);}};
  await touchAxis('x',300);await touchAxis('y',520);const b=await stick(),ib=await touch.locator('#exp-interact').boundingBox();await dispatch('touchStart',[point(1,b.x,b.y)]);await dispatch('touchMove',[point(1,b.x+32,b.y)]);await dispatch('touchStart',[point(1,b.x+32,b.y),point(2,ib.x+ib.width/2,ib.y+ib.height/2)]);await wait(touch,()=>document.querySelector('#exp-root').dataset.dialogue==='true');assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchEnd',[]);assert.equal(await count(touch),1);await touch.locator('#exp-memento-image').evaluate(i=>i.decode());await shot(touch,'touch-two-finger-inspection');await touch.locator('#exp-close').tap();assert.equal(await count(touch),2);
  for(const size of [{width:844,height:390},{width:667,height:375},{width:390,height:844}]){await touch.setViewportSize(size);await fitCanvas(touch);await touch.locator('#exp-notes-toggle').tap();const book=touch.locator('.exp-journal-book');const box=await book.boundingBox();await dispatch('touchStart',[point(7,box.x+box.width/2,box.y+box.height-35)]);await dispatch('touchMove',[point(7,box.x+box.width/2,box.y+90)]);await dispatch('touchEnd',[]);await wait(touch,()=>document.querySelector('.exp-journal-book').scrollTop>0);await shot(touch,'touch-collection-'+size.width+'x'+size.height);const closeBox=await touch.locator('#exp-notes-close').boundingBox();assert.ok(closeBox.y>=0&&closeBox.y+closeBox.height<=size.height&&closeBox.height>=48);await touch.locator('#exp-notes-close').tap();assert.equal(await count(touch),2);}report.layers.touchEmulation='PASS';record('M04 native two-pointer collection and actual notebook scrolling/closing in three touch viewports');
  await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await wait(touch,()=>document.querySelector('#exp-root').dataset.disposed==='true'&&document.querySelector('#exp-stage').dataset.mapObjects==='0');assert.equal(await touch.locator('#exp-stage canvas').count(),0);assert.equal(await touch.locator('#exp-memento-image').getAttribute('src'),null);assert.equal(await touch.locator('#exp-memento-list img[src]').count(),0);assert.equal(await touch.evaluate(()=>window.__expSignals.every(s=>s.signal.aborted)),true);await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));record('M06 new image references and own listeners/canvas dispose cleanly',{probe:'synthetic pagehide; native hidden separately checked'});
  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.networkErrors,[]);record('M06 no unexpected page or network errors');
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
  console.log(report.status,'EXP-03B',dir);if(report.status==='FAIL')process.exitCode=1;
}
