import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname,join,relative,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {identifyBrowser,parseBrowserSelection,resolveBrowserExecutable} from './browser-selection.mjs';

const args=process.argv.slice(2);
if(!args.includes('--production')||args.some(a=>a!=='--production'&&a!=='--gesture-only'&&!a.startsWith('--browser=')))throw new Error('Use --production --browser=chrome');
const selection=resolveBrowserExecutable(parseBrowserSelection(args));
assert.equal(selection.id,'chrome');
const dir=resolve('test-results/exp-05a',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:'EXP-05A',scope:args.includes('--gesture-only')?'photo-close-owned-gesture-short-probe':'district-skeleton-real-keyboard-touch-migration-and-completion',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],networkErrors:[],cleanup:{},hashes:{},protectedHashes:{},actualDist:{},historicalFailures:[],
  limitations:['True Android Chrome and iOS Safari were not available.','The completion card closes the existing Demo route; it does not prove a full 30-45 minute chapter.','Final art, culture review and real-device H5 acceptance remain separate.']};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const changedFiles=['tests/exploration-skeleton.test.mjs','tests/exp-02c-browser.mjs','tests/exp-03b-browser.mjs','tests/exp-03c-browser.mjs','src/core/exploration-prologue.ts','src/core/exploration-mementos.ts','src/core/progress.ts','src/rendering/phaser/exploration-city-art.ts','src/core/exploration-district.ts','src/rendering/phaser/exploration-district-art.ts','src/platform/web/exploration.ts','src/platform/web/exploration-ui.ts','src/platform/web/exploration-ui.css','tests/exp-05a-browser.mjs','src/core/exploration.ts','src/core/exploration-content.ts','src/core/exploration-photo.ts','src/platform/web/exploration-storage.ts','src/rendering/phaser/exploration.ts'];
for(const file of changedFiles)report.hashes[file]=await sha(file);
const protectedFiles=['src/core/exploration.ts','src/core/exploration-photo.ts','src/core/exploration-mementos.ts','src/core/exploration-content.ts',
  'src/rendering/phaser/exploration.ts','src/rendering/phaser/exploration-photo-art.ts','src/platform/web/exploration-input.ts',
  'src/platform/web/exploration-storage.ts','src/platform/web/visibility.ts','src/platform/web/main.ts','package.json'];
for(const file of protectedFiles)report.protectedHashes[file]=await sha(file);

const dist=resolve('dist');
const entry='dist/index.html',html=await readFile(entry,'utf8');
report.actualDist.entry=entry;report.actualDist.entrySha256=await sha(entry);
report.actualDist.assets=[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match=>'dist/'+match[1].replace(/^\//,''));
for(const asset of report.actualDist.assets)report.actualDist.assetsSha256??={},report.actualDist.assetsSha256[asset]=await sha(asset);

const probe4199=async()=>{
  try{const response=await fetch('http://127.0.0.1:4199/',{signal:AbortSignal.timeout(2500)});return{status:response.status,url:'http://127.0.0.1:4199/'};}
  catch(error){return{status:0,error:String(error)};}
};
let localServer;
const probe=await probe4199();
let base;
if(probe.status===200)base=probe.url;
else {
  localServer=createServer(async(req,res)=>{
    const path=resolve(dist,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
    if(relative(dist,path).startsWith('..')){res.writeHead(403).end();return;}
    try{res.writeHead(200,{'content-type':{'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(path)]??'application/octet-stream','cache-control':'no-store'}).end(await readFile(path));}
    catch{res.writeHead(404).end();}
  });
  await new Promise(done=>localServer.listen(0,'127.0.0.1',done));
  base=`http://127.0.0.1:${localServer.address().port}/`;
}
report.origin={url:base,probe4199:probe,mode:probe.status===200?'external-4199':'test-owned-fallback',pid:Number(process.env.EXP_03C_SERVICE_PID||0)||undefined};

let browser,active,nativeProcess,nativeBrowser;
const contexts=[];
const state=page=>page.locator('#exp-root').evaluate(e=>{const g=document.querySelector('#exp-stage').dataset;return{...e.dataset,x:Number(e.dataset.x),y:Number(e.dataset.y),tick:Number(e.dataset.tick),tokens:Number(e.dataset.tokens),cameraX:Number(g.cameraX),cameraY:Number(g.cameraY),mapObjects:Number(g.mapObjects),zoom:Number(g.zoom)};});
const wait=async(page,predicate,arg)=>page.waitForFunction(predicate,arg,{timeout:20000,polling:'raf'});
const shot=async(page,name)=>{const path=join(dir,`${name}.png`);await page.screenshot({path});report.screenshots.push(path);return path;};
const key=async(page,code)=>{report.timeline.push({event:'key',code,at:new Date().toISOString()});await page.keyboard.press(code);};
const fitCanvas=async page=>{
  await wait(page,()=>{
    const parent=document.querySelector('#exp-stage').getBoundingClientRect(),canvas=document.querySelector('#exp-stage canvas').getBoundingClientRect();
    const scale=Math.min(parent.width/1100,parent.height/650);
    return Math.abs(canvas.width-1100*scale)<2&&Math.abs(canvas.height-650*scale)<2&&canvas.x>=parent.x-1&&canvas.y>=parent.y-1&&canvas.right<=parent.right+1&&canvas.bottom<=parent.bottom+1;
  });
};
async function loaded(page){await wait(page,()=>document.querySelector('#exp-root')?.dataset.ready==='true');await page.waitForLoadState('networkidle');}
async function newPage(options={}){
  const context=await browser.newContext(options);contexts.push(context);const page=await context.newPage();active=page;
  page.on('pageerror',error=>report.pageErrors.push(String(error)));
  page.on('requestfailed',request=>report.networkErrors.push({url:request.url(),error:request.failure()}));
  page.on('response',response=>{if(response.status()>=400)report.networkErrors.push({url:response.url(),status:response.status()});});
  await page.addInitScript(()=>{
    const originalAdd=EventTarget.prototype.addEventListener;
    const originalSet=Storage.prototype.setItem;
    window.__expSignals=[];window.__storageMutations=[];window.__visibility=[];window.__pointerEvents=[];
    EventTarget.prototype.addEventListener=function(type,listener,options){if(options?.signal)window.__expSignals.push({type,signal:options.signal});return originalAdd.call(this,type,listener,options);};
    Storage.prototype.setItem=function(key,value){window.__storageMutations.push({key,at:performance.now()});return originalSet.call(this,key,value);};
    document.addEventListener('visibilitychange',()=>window.__visibility.push({state:document.visibilityState,focus:document.hasFocus(),at:performance.now()}));
    for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','click'])document.addEventListener(type,event=>window.__pointerEvents.push({type,pointerId:event.pointerId,target:event.target.id,trusted:event.isTrusted}),true);
  });
  return page;
}
const touchPorts=new WeakMap();
async function touchPort(page){
 const cdp=await page.context().newCDPSession(page),point=(x,y)=>({id:17,x,y,radiusX:5,radiusY:5,force:1});
 const dispatch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 touchPorts.set(page,{axis:async(coordinate,target,positive)=>{
  const b=await page.locator('#exp-stick').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  await dispatch('touchStart',[point(x,y)]);await dispatch('touchMove',[point(x+(coordinate==='x'?(positive?32:-32):0),y+(coordinate==='y'?(positive?32:-32):0))]);
  try{await wait(page,({coordinate,target,positive})=>{const d=document.querySelector('#exp-root').dataset;return positive?Number(d[coordinate])>=target-3:Number(d[coordinate])<=target+3;},{coordinate,target,positive});}
  finally{await dispatch('touchEnd',[]);}
 }});
}

async function axis(page,coordinate,target){
  const current=await state(page),positive=target>current[coordinate];
  if(Math.abs(target-current[coordinate])<5)return;
  if(touchPorts.has(page)){await touchPorts.get(page).axis(coordinate,target,positive);return;}
  const code=coordinate==='x'?(positive?'KeyD':'KeyA'):(positive?'KeyS':'KeyW');
  await page.keyboard.down(code);
  try{await wait(page,({coordinate,target,positive})=>{const data=document.querySelector('#exp-root').dataset;return positive?Number(data[coordinate])>=target-3:Number(data[coordinate])<=target+3;},{coordinate,target,positive});}
  finally{await page.keyboard.up(code);}
}
async function walk(page,x,y){await axis(page,'x',x);await axis(page,'y',y);report.timeline.push({event:'walk',x,y,state:await state(page)});}
async function interact(page,target){assert.equal((await state(page)).target,target);if(touchPorts.has(page))await page.locator('#exp-interact').tap();else await key(page,'KeyE');await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));}
async function closeDialogue(page){await page.locator('#exp-close').click();await wait(page,()=>document.querySelector('#exp-root').dataset.dialogue==='false');}
async function front(page){
  await walk(page,1250,790);await walk(page,1250,580);await interact(page,'service-door');await walk(page,280,540);await walk(page,280,330);await interact(page,'service-guide');await closeDialogue(page);await walk(page,280,540);await walk(page,540,540);await interact(page,'service-exit');await walk(page,1250,650);await walk(page,2150,650);await walk(page,3060,650);await walk(page,3060,900);
  await interact(page,'city-to-entry');assert.equal((await state(page)).map,'entry');
  await walk(page,1100,850);await walk(page,1100,800);await interact(page,'visitor');assert.equal((await state(page)).accepted,'false');await closeDialogue(page);assert.equal((await state(page)).accepted,'true');
  await walk(page,1180,800);await walk(page,1180,850);await walk(page,2040,850);await walk(page,2040,780);await interact(page,'entry-to-core');assert.equal((await state(page)).map,'upper');
}
async function originalCoreRoute(page){
  await walk(page,880,690);await walk(page,880,580);await interact(page,'guide-door');
  await walk(page,340,540);await walk(page,340,325);await interact(page,'note');await closeDialogue(page);
  await walk(page,340,540);await walk(page,540,540);await interact(page,'guide-exit');
  await walk(page,880,650);await walk(page,1010,650);await walk(page,1010,1160);await walk(page,1660,1160);await interact(page,'tea-door');await walk(page,540,540);await interact(page,'tea-exit');await walk(page,1010,1160);await walk(page,1010,650);await walk(page,2300,650);await walk(page,2300,580);await interact(page,'workshop-door');
  await walk(page,760,540);await walk(page,760,430);await interact(page,'plaque');await closeDialogue(page);
  await walk(page,760,540);await walk(page,540,540);await interact(page,'workshop-exit');
  await walk(page,2300,650);await walk(page,2700,650);await walk(page,2700,750);await interact(page,'gate');await closeDialogue(page);
  await walk(page,3060,750);await interact(page,'east-down');await skeletonMiddle(page);await walk(page,3000,1200);await interact(page,'middle-east-lower');assert.equal((await state(page)).map,'lower');
}
async function reviewCard(page,action='click'){
  if((await state(page)).view!=='journal')await page.locator('#exp-notes-toggle')[action]();
  await page.locator('#exp-card-reopen')[action]();
  await wait(page,()=>document.querySelector('#exp-root').dataset.cardOpen==='true');
}
function completedFixture(mementoCount){
  assert.ok(mementoCount===1||mementoCount===3);
  const mementoIds=['collection.exp03b.stilt-bookmark','collection.exp03b.bamboo-sketch','collection.exp03b.river-postcard'];
  const collections=['collection.exp02a.river-clasp',...mementoIds.slice(0,mementoCount)];
  const goals=['goal.exp02a.photo-request','goal.exp02a.river-route-note','goal.exp02a.east-passage-open','goal.exp02a.lower-view-found','goal.exp02b.night-postcard.photographed'];
  const rewards=['reward.exp02b.night-postcard'];
  if(mementoCount===3){goals.push('goal.exp03b.three-mementos');rewards.push('reward.exp03b.city-light-keeper');}
  return{schemaVersion:1,contentVersion:'exp03b-city-mementos-1',safe:'overlook',
    progress:{collections,goals,rewards,effects:[{id:'effect.exp02a.east-passage-open',expectedActive:true}],counts:{collections:collections.length,goals:goals.length,rewards:rewards.length,effects:1}},
    observedSites:['eaves','window','river'],photo:{cardId:'card.exp02b.night-for-faraway',siteId:'river'}};
}

async function skeletonMiddle(page){
 const right=await state(page);assert.equal(right.map,'middle');assert.ok(right.cameraX>1800);await shot(page,'S02-middle-east');
 await walk(page,3000,500);await walk(page,2100,500);await walk(page,1000,500);await walk(page,1000,520);await interact(page,'middle-court');assert.equal((await state(page)).pending,'');await closeDialogue(page);await walk(page,900,520);await walk(page,900,1100);await walk(page,2200,1100);await interact(page,'middle-outer');await closeDialogue(page);await walk(page,3000,1100);await walk(page,3000,1200);await shot(page,'S02-middle-outer');assert.ok((await state(page)).cameraY>700);
 const counts=[];for(let n=0;n<10;n++){await interact(page,'middle-east-lower');counts.push((await state(page)).mapObjects);await interact(page,'east-up');assert.equal((await state(page)).mapObjects,right.mapObjects);}assert.equal(new Set(counts).size,1);
 await walk(page,3000,500);await walk(page,400,500);await walk(page,400,450);const left=await state(page);assert.ok(left.cameraX<30);await shot(page,'S02-middle-west');await page.reload();await loaded(page);await page.locator('#exp-begin').click();assert.equal((await state(page)).safe,'middleEastLower');
 record('S01 S02 S05 real keyboard inner/outer routes, optional observations, camera XY, ten map round trips and current middle save reload',{right,left,counts});
}
async function skeletonTouch(){
 for(const size of [{width:844,height:390},{width:667,height:375}]){
 const page=await newPage({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:1});const fixture={...completedFixture(3),contentVersion:'exp05a-district-skeleton-1',safe:'middleEastLower'};
 await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp05a.save.v1'))localStorage.setItem('pokan.exp05a.save.v1',raw);},JSON.stringify(fixture));await page.goto(base);await loaded(page);await page.locator('#exp-begin').tap();await touchPort(page);await walk(page,2800,1200);await shot(page,`S05-touch-middle-${size.width}`);await walk(page,3000,1250);await interact(page,'middle-east-lower');await walk(page,1100,650);await walk(page,1100,1120);await walk(page,1700,1120);await interact(page,'riverfront-down');await walk(page,900,650);await walk(page,900,1050);await walk(page,1910,1050);await shot(page,`S05-touch-D-${size.width}`);await page.reload();await loaded(page);await page.locator('#exp-begin').tap();assert.equal((await state(page)).safe,'riverArrival');await walk(page,900,650);await walk(page,900,1050);await walk(page,1950,1050);await interact(page,'view');await page.locator('#exp-photo-close').tap();assert.equal((await state(page)).safe,'riverView');await page.reload();await loaded(page);await page.locator('#exp-begin').tap();assert.equal((await state(page)).safe,'riverView');
 const cdp=await page.context().newCDPSession(page),b=await page.locator('#exp-stick').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,pt=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1}),send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 await send('touchStart',[pt(1,x,y)]);await send('touchMove',[pt(1,x-32,y)]);const ib=await page.locator('#exp-interact').boundingBox();await send('touchStart',[pt(1,x-32,y),pt(2,ib.x+ib.width/2,ib.y+ib.height/2)]);await send('touchCancel',[]);assert.equal(JSON.parse((await state(page)).input).pointers,0);if((await state(page)).preview)await page.locator('#exp-photo-close').tap();
 await send('touchStart',[pt(3,x,y)]);await send('touchMove',[pt(3,x-32,y)]);await page.setViewportSize({width:390,height:844});await fitCanvas(page);assert.equal(JSON.parse((await state(page)).input).pointers,0);await send('touchCancel',[]);await page.setViewportSize(size);await fitCanvas(page);await shot(page,`S05-touch-rotate-${size.width}`);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await wait(page,()=>document.querySelector('#exp-stage').dataset.mapObjects==='0');assert.equal(await page.locator('canvas').count(),0);await page.close();
 }
 record('S04 S05 new-map current anchors reload, native joystick/tap paths, multi-pointer cancellation, rotation and disposal in both touch viewports',{fixture:'inline completed current save; not a fresh gameplay route'});
}

async function photoCloseProbe(){
 for(const size of [{width:844,height:390},{width:667,height:375}]){
 const page=await newPage({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const fixture={...completedFixture(3),contentVersion:'exp05a-district-skeleton-1',safe:'riverView'};
 await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp05a.save.v1'))localStorage.setItem('pokan.exp05a.save.v1',raw);},JSON.stringify(fixture));
 await page.goto(base);await loaded(page);await page.locator('#exp-begin').tap();const before=await state(page),cdp=await page.context().newCDPSession(page);
 const start=async(selector,id=55)=>{const b=await page.locator(selector).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id,x:b.x+b.width/2,y:b.y+b.height/2,radiusX:5,radiusY:5,force:1}]});};
 const end=async()=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));};
 await start('#exp-interact');await wait(page,()=>document.querySelector('#exp-root').dataset.preview==='river');const first=(await state(page)).previewId;await shot(page,`gesture-${size.width}-pressed`);await end();assert.equal((await state(page)).previewId,first);await shot(page,`gesture-${size.width}-released`);
 await page.locator('#exp-photo-close').tap();assert.equal((await state(page)).preview,'');
 await page.keyboard.press('KeyE');await wait(page,()=>document.querySelector('#exp-root').dataset.preview==='river');await page.locator('#exp-photo-close').focus();await page.keyboard.press('Enter');assert.equal((await state(page)).preview,'');
 await page.keyboard.press('KeyE');const old=(await state(page)).previewId;await start('#exp-photo-close');await page.keyboard.press('KeyE');assert.equal((await state(page)).preview,'');await page.keyboard.press('KeyE');const current=(await state(page)).previewId;assert.notEqual(current,old);await end();assert.equal((await state(page)).previewId,current);
 await start('#exp-photo-close');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await state(page)).previewId,current);
 await start('#exp-photo-close');await page.setViewportSize({width:390,height:844});await fitCanvas(page);await end();assert.equal((await state(page)).previewId,current);await page.setViewportSize(size);await fitCanvas(page);await page.locator('#exp-photo-close').tap();assert.equal((await state(page)).preview,'');assert.equal((await state(page)).progress,before.progress);
 const events=await page.evaluate(()=>window.__pointerEvents);report.timeline.push({event:'photo-close-probe',size,events,before,after:await state(page)});record(`photo-close ${size.width}: opening touch preserved, next own tap closes, keyboard works, stale/cancel/resize rejected, rewards unchanged`);await page.close();
 }
}

async function dimensions(page,ids){
  return page.evaluate(ids=>ids.map(id=>{const element=document.getElementById(id),rect=element.getBoundingClientRect(),style=getComputedStyle(element);return{id,x:rect.x,y:rect.y,width:rect.width,height:rect.height,fontSize:parseFloat(style.fontSize),visible:!!element.getClientRects().length,inside:rect.x>=-1&&rect.y>=-1&&rect.right<=innerWidth+1&&rect.bottom<=innerHeight+1};}),ids);
}

try{
  browser=await chromium.launch({executablePath:selection.executablePath,headless:true});
  if(args.includes('--gesture-only')){await photoCloseProbe();}else{
  const page=await newPage({viewport:{width:1280,height:720}}),cdp=await page.context().newCDPSession(page);
  report.browser.actual=identifyBrowser(await cdp.send('Browser.getVersion'));
  await page.goto(base);await loaded(page);
  let current=await state(page);
  assert.equal(current.view,'title');assert.equal(current.tokens,1);assert.equal(current.tick,0);assert.equal(await page.title(),'坡坎之间');
  await shot(page,'01-title-root');
  await page.locator('#exp-begin').click();await wait(page,()=>document.querySelector('#exp-root').dataset.view==='play');
  const initialRuntime=await state(page);
  await front(page);await originalCoreRoute(page);
  report.timeline.push({event:'real-main-route-ready-for-comparison',state:await state(page)});
  await walk(page,2180,650);await walk(page,2180,680);await interact(page,'photo-eaves');
  assert.equal((await state(page)).preview,'eaves');await page.locator('#exp-shutter').click();
  assert.match(await page.locator('#exp-photo-feedback').textContent(),/桥面/);assert.equal((await state(page)).photographed,'false');assert.equal((await state(page)).cardOpen,'false');
  await shot(page,'02-wrong-eaves');await page.locator('#exp-photo-close').click();
  await walk(page,2180,650);await walk(page,900,650);await interact(page,'window');
  assert.equal((await state(page)).preview,'window');await page.locator('#exp-shutter').click();
  assert.match(await page.locator('#exp-photo-feedback').textContent(),/木楼/);assert.equal((await state(page)).photographed,'false');assert.equal((await state(page)).cardOpen,'false');
  await shot(page,'03-wrong-window');await page.locator('#exp-photo-close').click();
  await walk(page,1100,650);await walk(page,1100,1120);await walk(page,1700,1120);await interact(page,'riverfront-down');await walk(page,900,650);await walk(page,900,1050);await walk(page,1950,1050);await interact(page,'view');
  assert.equal((await state(page)).preview,'river');await page.locator('#exp-shutter').click();
  await wait(page,()=>document.querySelector('#exp-root').dataset.cardOpen==='true');
  const captured=await state(page);
  assert.equal(captured.photographed,'true');assert.equal(captured.tokens,1);assert.equal(JSON.parse(captured.progress).counts.rewards,1);
  assert.equal(await page.locator('#exp-card-heading').textContent(),'本次委托已完成');
  assert.equal(await page.locator('#exp-card-commission').textContent(),'把山城夜景寄给远方');
  assert.equal(await page.locator('#exp-card-memento-count').textContent(),'0/3 · 全部选做');
  assert.equal(await page.locator('#exp-card-memento-title').textContent(),'尚未获得 · 选做奖励');
  assert.ok(!(await page.locator('#exp-photo-card').textContent()).includes('山城拾光者'));
  await page.locator('#exp-card-image').evaluate(image=>image.decode());await shot(page,'04-zero-mementos-completion');
  record('F01 real keyboard route from title reaches an explicit zero-memento completion only after the correct river shutter');

  const frozenTick=captured.tick;await page.waitForTimeout(180);assert.equal((await state(page)).tick,frozenTick);
  await page.keyboard.down('KeyD');await page.waitForTimeout(120);assert.equal((await state(page)).x,captured.x);assert.equal((await state(page)).tick,frozenTick);await page.keyboard.up('KeyD');
  await page.locator('#exp-card-close').click();assert.equal((await state(page)).cardOpen,'false');
  assert.equal((await state(page)).runtimeId,captured.runtimeId);assert.equal((await state(page)).x,captured.x);assert.equal((await state(page)).progress,captured.progress);
  await page.waitForTimeout(120);assert.ok((await state(page)).tick>frozenTick);
  await interact(page,'view');await page.locator('#exp-shutter').click();await wait(page,()=>document.querySelector('#exp-root').dataset.cardOpen==='true');
  assert.equal(JSON.parse((await state(page)).progress).counts.rewards,1);assert.equal((await state(page)).progress,captured.progress);
  record('F01 continuing keeps the same runtime/location/progress and a repeated shutter cannot add a second photo reward');

  const completedProgress=(await state(page)).progress;
  await page.locator('#exp-card-title').click();
  let titled=await state(page);
  assert.equal(titled.view,'title');assert.equal(titled.runtimeId,captured.runtimeId);assert.equal(titled.progress,completedProgress);assert.equal(titled.x,captured.x);assert.equal(titled.tokens,1);
  await page.locator('#exp-begin').click();assert.equal((await state(page)).runtimeId,captured.runtimeId);assert.equal((await state(page)).progress,completedProgress);
  await reviewCard(page);assert.equal((await state(page)).cardOpen,'true');
  record('F02 card to title preserves the same runtime and journey; begin returns without resuming the card automatically');

  await page.locator('#exp-card-close').click();await page.reload();await loaded(page);
  let restored=await state(page);
  assert.equal(restored.view,'title');assert.equal(restored.cardOpen,'false');assert.equal(restored.progress,completedProgress);assert.equal(restored.tokens,1);
  await page.locator('#exp-begin').click();await reviewCard(page);
  assert.equal((await state(page)).progress,completedProgress);assert.equal((await state(page)).runtimeId,restored.runtimeId);
  record('F02 completed save reloads from title/journal only; reopening does not force the card or reissue a reward');

  await page.evaluate(()=>{window.__storageMutations=[];});
  const beforeConfirmRaw=await page.evaluate(()=>localStorage.getItem('pokan.exp05a.save.v1'));
  await page.locator('#exp-card-restart').click();
  assert.equal((await state(page)).view,'confirm');assert.equal((await state(page)).cardOpen,'true');assert.equal((await state(page)).tokens,2);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pokan.exp05a.save.v1')),beforeConfirmRaw);
  assert.deepEqual(await page.evaluate(()=>window.__storageMutations),[]);
  await key(page,'KeyE');
  assert.equal((await state(page)).view,'confirm');assert.equal((await state(page)).cardOpen,'true');assert.equal((await state(page)).tokens,2);
  await page.locator('#exp-cancel-restart').click();
  assert.equal((await state(page)).view,'completion');assert.equal((await state(page)).cardOpen,'true');assert.equal((await state(page)).tokens,1);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'exp-card-restart');
  await page.locator('#exp-card-restart').click();await page.keyboard.press('Escape');
  assert.equal((await state(page)).view,'completion');assert.equal((await state(page)).cardOpen,'true');assert.equal((await state(page)).tokens,1);
  record('F02 restart confirmation preserves the completion card owner; click and Escape cancel return to the card before any storage write');

  await page.locator('#exp-card-restart').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'exp-card-close');
  await page.locator('#exp-card-close').focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'exp-card-restart');
  await page.locator('#exp-card-close').focus();await page.keyboard.press('Space');
  await wait(page,()=>document.querySelector('#exp-root').dataset.cardOpen==='false');
  assert.equal((await state(page)).runtimeId,restored.runtimeId);
  await reviewCard(page);
  record('F02 Tab stays within the completion card, Space activates a real button and Continue only closes the photo owner');

  for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:844,height:390},{width:667,height:375},{width:390,height:844}]){
    await page.setViewportSize(size);await fitCanvas(page);
    if((await state(page)).cardOpen!=='true')await reviewCard(page);
    await page.locator('#exp-card-image').evaluate(image=>image.decode());
    const boxes=await dimensions(page,['exp-card-close','exp-card-title','exp-card-restart']);
    assert.ok(boxes.every(box=>box.visible&&box.inside&&box.height>=48),JSON.stringify({size,boxes}));
    const fonts=await page.locator('.exp-completion-summary p,.exp-completion-facts dt,.exp-completion-facts dd,.exp-completion-art figcaption').evaluateAll(elements=>elements.map(element=>parseFloat(getComputedStyle(element).fontSize)));
    assert.ok(fonts.every(font=>font>=14),JSON.stringify({size,fonts}));
    const imageRatio=await page.locator('#exp-card-image').evaluate(image=>{const rect=image.getBoundingClientRect();return rect.width/rect.height;});
    assert.ok(Math.abs(imageRatio-1.8)<.06,JSON.stringify({size,imageRatio}));
    await shot(page,`05-completion-${size.width}x${size.height}`);
    report.timeline.push({event:'completion-layout',size,boxes,fonts,imageRatio});
    await page.locator('#exp-card-close').click();assert.equal((await state(page)).cardOpen,'false');
  }
  await page.setViewportSize({width:1280,height:720});await fitCanvas(page);await reviewCard(page);
  report.layers.desktopChrome='PASS';
  record('F04 five desktop/mobile viewports keep 14px+ completion text, 48px+ actions, an unstretched card and reachable navigation');

  for(const count of [1,3]){
    const fixture=completedFixture(count),fixturePage=await newPage({viewport:{width:1280,height:720}});
    await fixturePage.addInitScript(raw=>{localStorage.setItem('pokan.exp03b.save.v1',raw);},JSON.stringify(fixture));
    await fixturePage.goto(base);await loaded(fixturePage);await fixturePage.locator('#exp-begin').click();await reviewCard(fixturePage);
    assert.equal(await fixturePage.locator('#exp-card-memento-count').textContent(),`${count}/3 · 全部选做`);
    assert.equal(await fixturePage.locator('#exp-card-memento-title').textContent(),count===3?'山城拾光者':'尚未获得 · 选做奖励');
    if(count===1)assert.ok(!(await fixturePage.locator('#exp-photo-card').textContent()).includes('山城拾光者'));
    await fixturePage.locator('#exp-card-image').evaluate(image=>image.decode());await shot(fixturePage,`06-fixture-${count}-mementos`);
    report.timeline.push({event:'readonly-summary-fixture',count,state:await state(fixturePage)});
    await fixturePage.close();
  }
  record('F04 read-only snapshots render 0/1/3 selected souvenirs and reveal the title only when its existing goal/reward is present',{zeroFromActualRoute:true,oneAndThreeFromInlineFixtures:true});

  const touch=await newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await touch.addInitScript(raw=>{localStorage.setItem('pokan.exp03b.save.v1',raw);},JSON.stringify(completedFixture(3)));
  await touch.goto(base);await loaded(touch);const touchRuntime=(await state(touch)).runtimeId;
  await touch.locator('#exp-begin').tap();await touch.locator('#exp-notes-toggle').tap();await touch.locator('#exp-card-reopen').tap();
  await touch.locator('#exp-card-image').evaluate(image=>image.decode());await shot(touch,'07-touch-completion-844x390');
  await touch.locator('#exp-card-restart').tap();assert.equal((await state(touch)).tokens,2);await touch.locator('#exp-cancel-restart').tap();
  assert.equal((await state(touch)).view,'completion');assert.equal((await state(touch)).tokens,1);
  await touch.locator('#exp-card-close').tap();assert.equal((await state(touch)).runtimeId,touchRuntime);
  await touch.locator('#exp-notes-toggle').tap();await touch.locator('#exp-card-reopen').tap();await touch.locator('#exp-card-title').tap();
  assert.equal((await state(touch)).view,'title');assert.equal((await state(touch)).runtimeId,touchRuntime);assert.equal((await state(touch)).tokens,1);
  await shot(touch,'08-touch-card-to-title');await touch.locator('#exp-begin').tap();assert.equal((await state(touch)).runtimeId,touchRuntime);
  await touch.setViewportSize({width:667,height:375});await fitCanvas(touch);await touch.locator('#exp-notes-toggle').tap();await touch.locator('#exp-card-reopen').tap();
  await shot(touch,'09-touch-completion-667x375');await touch.locator('#exp-card-close').tap();
  await touch.setViewportSize({width:390,height:844});await fitCanvas(touch);await touch.locator('#exp-notes-toggle').tap();await touch.locator('#exp-card-reopen').tap();
  const touchBoxes=await dimensions(touch,['exp-card-close','exp-card-title','exp-card-restart']);assert.ok(touchBoxes.every(box=>box.inside&&box.height>=48));
  await shot(touch,'10-touch-completion-390x844');await touch.locator('#exp-card-close').tap();
  report.layers.touchEmulation='PASS';report.layers.androidChrome='NOT RUN';report.layers.iosSafari='NOT RUN';
  record('F04 native-touch-style taps complete cancel, Continue and title paths in three viewports; real phones remain NOT RUN');

  await skeletonTouch();
  const profile=join(dir,'native-completion-profile');await mkdir(profile);
  nativeProcess=spawn(selection.executablePath,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe']});
  report.nativeChrome={pid:nativeProcess.pid,profile};let stderr='';nativeProcess.stderr.setEncoding('utf8');
  const endpoint=await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(new Error('CDP unavailable '+stderr)),15000);nativeProcess.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);done(match[1]);}});nativeProcess.once('exit',code=>{clearTimeout(timer);fail(new Error('Native Chrome exited '+code));});});
  nativeBrowser=await chromium.connectOverCDP(endpoint,{noDefaults:true});const nativeContext=nativeBrowser.contexts()[0],nativePage=nativeContext.pages()[0];active=nativePage;
  await nativePage.addInitScript(raw=>{localStorage.setItem('pokan.exp03b.save.v1',raw);window.__visibility=[];document.addEventListener('visibilitychange',()=>window.__visibility.push({state:document.visibilityState,tokens:document.querySelector('#exp-root')?.dataset.tokens}));},JSON.stringify(completedFixture(1)));
  await nativePage.goto(base);await loaded(nativePage);await nativePage.bringToFront();await nativePage.locator('#exp-begin').click();await reviewCard(nativePage);
  const nativePaused=await state(nativePage);assert.equal(nativePaused.tokens,1);
  await nativePage.locator('#exp-card-restart').click();assert.equal((await state(nativePage)).tokens,2);await nativePage.keyboard.press('KeyE');
  assert.equal((await state(nativePage)).view,'confirm');assert.equal((await state(nativePage)).tokens,2);await nativePage.locator('#exp-cancel-restart').click();
  assert.equal((await state(nativePage)).tokens,1);
  await nativePage.locator('#exp-card-restart').click();let confirmBeforeHidden=await state(nativePage);assert.equal(confirmBeforeHidden.tokens,2);const progressBeforeHiddenCancel=confirmBeforeHidden.progress;
  let background=await nativeContext.newPage();await background.goto('about:blank');await background.bringToFront();
  await wait(nativePage,()=>document.visibilityState==='hidden');let hidden=await state(nativePage);assert.equal(hidden.cardOpen,'false');assert.equal(hidden.tick,confirmBeforeHidden.tick);assert.ok(hidden.tokens>=1);
  await nativePage.bringToFront();await wait(nativePage,()=>document.visibilityState==='visible');assert.equal((await state(nativePage)).view,'confirm');assert.equal((await state(nativePage)).tokens,1);
  await nativePage.keyboard.press('Escape');
  assert.equal((await state(nativePage)).view,'completion');assert.equal((await state(nativePage)).cardOpen,'true');assert.equal((await state(nativePage)).tokens,1);assert.equal((await state(nativePage)).progress,progressBeforeHiddenCancel);assert.equal(await nativePage.evaluate(()=>document.activeElement?.id),'exp-card-restart');await background.close();
  await nativePage.locator('#exp-card-restart').click();confirmBeforeHidden=await state(nativePage);background=await nativeContext.newPage();await background.goto('about:blank');await background.bringToFront();
  await wait(nativePage,()=>document.visibilityState==='hidden');hidden=await state(nativePage);assert.equal(hidden.cardOpen,'false');assert.equal(hidden.tick,confirmBeforeHidden.tick);
  await nativePage.bringToFront();await wait(nativePage,()=>document.visibilityState==='visible');assert.equal((await state(nativePage)).view,'confirm');assert.equal((await state(nativePage)).tokens,1);
  await nativePage.locator('#exp-cancel-restart').click();
  assert.equal((await state(nativePage)).view,'completion');assert.equal((await state(nativePage)).cardOpen,'true');assert.equal((await state(nativePage)).tokens,1);assert.equal((await state(nativePage)).progress,progressBeforeHiddenCancel);assert.equal(await nativePage.evaluate(()=>document.activeElement?.id),'exp-card-restart');await background.close();
  await nativePage.bringToFront();await nativePage.locator('#exp-card-close').click();await reviewCard(nativePage);const cardBeforeHidden=await state(nativePage);
  background=await nativeContext.newPage();await background.goto('about:blank');await background.bringToFront();
  await wait(nativePage,()=>document.visibilityState==='hidden');hidden=await state(nativePage);assert.equal(hidden.cardOpen,'false');assert.equal(hidden.tick,cardBeforeHidden.tick);
  await nativePage.bringToFront();await wait(nativePage,()=>document.visibilityState==='visible');assert.equal((await state(nativePage)).tokens,0);await background.close();
  await reviewCard(nativePage);await nativePage.locator('#exp-card-title').click();const titleBeforeHidden=await state(nativePage);assert.equal(titleBeforeHidden.tokens,1);
  const secondBackground=await nativeContext.newPage();await secondBackground.goto('about:blank');await secondBackground.bringToFront();await wait(nativePage,()=>document.visibilityState==='hidden');
  const titleHidden=await state(nativePage);assert.equal(titleHidden.tokens,2);assert.equal(titleHidden.tick,titleBeforeHidden.tick);
  await nativePage.bringToFront();await wait(nativePage,()=>document.visibilityState==='visible');assert.equal((await state(nativePage)).tokens,1);assert.equal((await state(nativePage)).tick,titleBeforeHidden.tick);await secondBackground.close();
  report.visibility=await nativePage.evaluate(()=>window.__visibility);
  record('F03 card/confirm/title and native hidden keep accurate independent owner counts; hidden confirmation cancels restore the same completion card, owner, focus and progress',{events:report.visibility});

  const historicalBefore=await page.evaluate(()=>{localStorage.setItem('pokan.exp02c.save.v1','historical-bytes-retained');localStorage.setItem('other-data','other-bytes-retained');return{pokan:localStorage.getItem('pokan.exp02c.save.v1'),other:localStorage.getItem('other-data')};});
  await page.locator('#exp-card-restart').click();assert.equal((await state(page)).view,'confirm');
  await page.locator('#exp-confirm-restart').click();await loaded(page);
  const fresh=await state(page);assert.equal(fresh.view,'title');assert.equal(fresh.tokens,1);assert.equal(fresh.map,'plaza');assert.equal(fresh.accepted,'false');assert.equal(fresh.photographed,'false');
  const persistent=await page.evaluate(()=>({pokan:localStorage.getItem('pokan.exp02c.save.v1'),other:localStorage.getItem('other-data'),fresh:JSON.parse(localStorage.getItem('pokan.exp05a.save.v1'))}));
  assert.equal(persistent.pokan,historicalBefore.pokan);assert.equal(persistent.other,historicalBefore.other);assert.equal(persistent.fresh.safe,'chapterStart');assert.equal(persistent.fresh.progress.goals.length,0);assert.equal(persistent.fresh.progress.collections.length,0);
  record('F02 confirmed restart reuses the existing storage method, writes blank A and leaves historical/other keys byte-for-byte intact');

  await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await wait(touch,()=>document.querySelector('#exp-root').dataset.disposed==='true'&&document.querySelector('#exp-stage').dataset.mapObjects==='0');
  assert.equal(await touch.locator('#exp-stage canvas').count(),0);assert.equal(await touch.locator('#exp-card-image').getAttribute('src'),null);
  const signals=await touch.evaluate(()=>window.__expSignals.map(signal=>({type:signal.type,aborted:signal.signal.aborted})));
  assert.ok(signals.length>10&&signals.every(signal=>signal.aborted));await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  record('F03 repeated pagehide disposes once, removes the completion image reference, canvas and host listeners',{signals});

  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.networkErrors,[]);report.cleanup.thirdParty='Phaser document-scope visibility handlers reclaim with page teardown; host-owned AbortSignals checked separately.';
  report.cleanup.externalService=probe.status===200?'LEFT RUNNING / not stopped':'NOT APPLICABLE';
  record('F05 zero unexpected page/network errors; current source and same-origin dist fingerprints recorded');
  }
}catch(error){
  report.failure={message:String(error),stack:error.stack};
  if(active&&!active.isClosed()){try{await shot(active,'FAIL');if(await active.locator('#exp-root').count())report.failureState=await state(active);report.failurePointerEvents=await active.evaluate(()=>window.__pointerEvents??[]);}catch(evidenceError){report.failureEvidenceError=String(evidenceError);}}
  console.error(error);
}finally{
  for(const context of contexts){try{await context.close();}catch(error){report.cleanup.contextError=String(error);}}
  report.cleanup.contexts=report.cleanup.contextError?'FAIL':'PASS';
  try{await browser?.close();report.cleanup.browser='PASS';}catch(error){report.cleanup.browser='FAIL';report.cleanup.browserError=String(error);}
  if(nativeBrowser){try{const session=await nativeBrowser.newBrowserCDPSession();await session.send('Browser.close');}catch{}await nativeBrowser.close().catch(()=>{});}
  if(nativeProcess){
    if(nativeProcess.exitCode===null)await new Promise(done=>{const timer=setTimeout(done,2000);nativeProcess.once('exit',()=>{clearTimeout(timer);done();});});
    if(nativeProcess.exitCode===null){nativeProcess.kill();await new Promise(done=>nativeProcess.once('exit',done));}
    report.cleanup.nativeChrome=nativeProcess.exitCode!==null||nativeProcess.signalCode!==null?'PASS':'FAIL';report.cleanup.nativeChromePid=nativeProcess.pid;
  }
  if(localServer)await new Promise(done=>localServer.close(done));
  report.cleanup.ownedServer=localServer?'PASS':'NOT OWNED';
  report.finishedAt=new Date().toISOString();
  report.status=report.failure||Object.values(report.cleanup).includes('FAIL')?'FAIL':'PASS';
  await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));
  const digest=await sha(join(dir,'report.json'));await writeFile(join(dir,'report.sha256'),digest);
  report.reportSha256=digest;
  console.log(report.status,'EXP-05A',dir,digest);
  if(report.status==='FAIL')process.exitCode=1;
}
