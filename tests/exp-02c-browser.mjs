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
const dir=resolve('test-results/exp-02c',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:'EXP-02C',scope:args.includes('--preview-only')?'production-city-preview-stage':'production-prologue-quest-migration-input-regression',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],cleanup:{},hashes:{},historicalFocusFailure:'Retained; old long focus suite NOT RUN'};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function hashTree(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await hashTree(p);else report.hashes[relative(process.cwd(),p).replaceAll('\\','/')]=await sha(p);}}
const files=['src/core/exploration-district.ts','src/rendering/phaser/exploration-district-art.ts','src/core/exploration-mementos.ts','src/rendering/phaser/exploration-memento-art.ts','src/rendering/phaser/assets/exp-03b/bookmark.svg','src/rendering/phaser/assets/exp-03b/sketch.svg','src/rendering/phaser/assets/exp-03b/postcard.svg','src/rendering/phaser/assets/exp-03b/ASSET_SOURCES.md','tests/exploration-mementos.test.mjs','index.html','src/platform/web/exploration-ui.ts','src/platform/web/exploration-journal.ts','src/platform/web/exploration-ui.css','tests/exploration-journal.test.mjs','src/core/exploration-prologue.ts','src/rendering/phaser/exploration-city-art.ts','src/core/progress.ts','src/core/exploration.ts','src/core/exploration-content.ts','src/core/exploration-photo.ts','src/rendering/phaser/exploration-photo-art.ts','src/platform/web/main.ts','src/platform/web/style.css','src/rendering/phaser/exploration.ts','src/platform/web/exploration.ts','src/platform/web/exploration-input.ts','src/platform/web/exploration-storage.ts','tests/exploration-prologue.test.mjs','tests/exploration.test.mjs','tests/exploration-district.test.mjs','tests/exploration-photo.test.mjs','tests/exp-02c-browser.mjs','src/rendering/phaser/assets/exp-02c/ASSET_SOURCES.md'];
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
async function reviewCard(page,touch=false){const action=touch?'tap':'click';if((await state(page)).view!=='journal')await page.locator('#exp-notes-toggle')[action]();await page.locator('#exp-card-reopen')[action]();}
async function originalChain(p){  await walk(p,880,690);await walk(p,880,580);await interact(p,'guide-door');await walk(p,340,540);await walk(p,340,325);await interact(p,'note');await close(p);await walk(p,340,540);await walk(p,540,540);await interact(p,'guide-exit');
  await walk(p,880,650);await walk(p,2300,650);await walk(p,2300,580);await interact(p,'workshop-door');await walk(p,760,540);await walk(p,760,430);await interact(p,'plaque');await close(p);await walk(p,760,540);await walk(p,540,540);await interact(p,'workshop-exit');
  await walk(p,2300,650);await walk(p,2700,650);await walk(p,2700,750);await interact(p,'gate');await close(p);await walk(p,3060,750);await interact(p,'east-down');await walk(p,3000,1200);await interact(p,'middle-east-lower');
}
async function migrationChecks(empty,opened,photo){
 const entries=[['unaccepted',empty],['opened',opened],['photographed',photo]];
 for(const [stage,value]of entries){
  const legacy={...value,contentVersion:'exp02b-photo-quest-1'},raw=JSON.stringify(legacy),p=await newPage({viewport:{width:1280,height:720}});
  await p.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp02b.save.v1'))localStorage.setItem('pokan.exp02b.save.v1',raw);},raw);
  await p.goto(report.url);await loaded(p);let s=await state(p);assert.equal(s.safe,value.safe);assert.deepEqual(JSON.parse(s.progress),value.progress);assert.match(await p.locator('#exp-archive-notice').textContent(),/已沿用街区进度/);assert.equal(await p.evaluate(()=>localStorage.getItem('pokan.exp02b.save.v1')),raw);
  if(stage==='unaccepted'){
   assert.match(await p.locator('#exp-objective').textContent(),/返回沧白路入口/);await walk(p,175,690);await interact(p,'core-to-entry');await walk(p,1140,780);await walk(p,1140,800);await interact(p,'visitor');assert.equal((await state(p)).accepted,'false');await p.keyboard.press('Escape');await p.locator('#exp-resume').click();assert.equal((await state(p)).accepted,'false');await interact(p,'visitor');await close(p);assert.equal((await state(p)).accepted,'true');
  }else if(stage==='photographed'){
   assert.equal(s.photographed,'true');assert.equal(JSON.parse(s.progress).counts.rewards,1);await reviewCard(p);await shot(p,'legacy-b-card');await p.locator('#exp-card-close').click();await p.reload();await loaded(p);assert.equal((await state(p)).progress,s.progress);
  }else{assert.equal(s.unlocked,'true');assert.equal(s.photographed,'false');}
  report.timeline.push({event:'legacy-b-import',stage,state:await state(p)});await p.close();
 }
 record('C04 three historical B stages retain exact anchors/progress/card; unaccepted C returns to single B visitor');
}

try{
 browser=await chromium.launch({executablePath:selection.executablePath,headless:true});
 const p=await newPage({viewport:{width:1280,height:720}});const cdp=await p.context().newCDPSession(p);report.browser.actual=identifyBrowser(await cdp.send('Browser.getVersion'));
 await p.goto(report.url);await loaded(p);
 const blank=await p.evaluate(()=>JSON.parse(localStorage.getItem('pokan.exp05a.save.v1')));const oldEmpty={...blank,safe:'arrival'};
 await front(p,{refresh:true});record('C01 C04 fresh A, physical monument, three positions, B, service and refresh');
 const loopId=(await state(p)).runtimeId;
 for(let i=0;i<3;i++){
  await walk(p,175,690);await interact(p,'core-to-entry');await walk(p,140,780);await walk(p,140,850);await interact(p,'entry-to-city');await walk(p,3120,900);
  await p.keyboard.down('KeyE');await wait(p,()=>document.querySelector('#exp-root').dataset.map==='entry');await p.keyboard.down('KeyE');await p.waitForTimeout(150);assert.equal((await state(p)).map,'entry');assert.equal(JSON.parse((await state(p)).input).pointers,0);await p.keyboard.up('KeyE');
  await walk(p,1100,850);await walk(p,1100,800);const before=(await state(p)).progress;await interact(p,'visitor');await close(p);assert.equal((await state(p)).progress,before);
  await walk(p,2040,800);await walk(p,2040,780);await interact(p,'entry-to-core');assert.equal((await state(p)).runtimeId,loopId);assert.equal(await p.locator('#exp-stage canvas').count(),1);
 }
 record('C02 three A B C round trips, same runtime/canvas, held key suppression and no repeated quest');
 await originalChain(p);const oldOpen={...await p.evaluate(()=>JSON.parse(localStorage.getItem('pokan.exp05a.save.v1'))),safe:'eastLower'};
 // A second blank context uses only native touch joystick/taps for A -> B -> C
 // and the original clue/item/gate/photo chain, with no fixture or state writes.
 const freshTouch=await newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});await freshTouch.goto(report.url);await loaded(freshTouch);await touchPort(freshTouch);await front(freshTouch,{optional:false,touch:true});await originalChain(freshTouch);
 await walk(freshTouch,1100,650);await walk(freshTouch,1100,1120);await walk(freshTouch,1700,1120);await interact(freshTouch,'riverfront-down');await walk(freshTouch,900,650);await walk(freshTouch,900,1050);await walk(freshTouch,1950,1050);await interact(freshTouch,'view');await freshTouch.locator('#exp-shutter').tap();assert.equal((await state(freshTouch)).photographed,'true');assert.equal(JSON.parse((await state(freshTouch)).progress).counts.rewards,1);await shot(freshTouch,'touch-fresh-postcard');await freshTouch.locator('#exp-card-close').tap();await fitCanvas(freshTouch);
 assert.deepEqual(JSON.parse((await state(freshTouch)).mementos),[]);
 record('C05 blank native touch A B C original rooms gate and explicit photo; service is optional');
 active=p;
  const previews=[];
  const preview=async(target,site,name)=>{await interact(p,target);assert.equal((await state(p)).preview,site);await p.locator('#exp-photo-image').evaluate(img=>img.decode());await shot(p,name);previews.push({site,state:await state(p),image:await p.locator('#exp-photo-image').getAttribute('src')});};
  const closeView=async()=>{await p.locator('#exp-photo-close').click();assert.equal((await state(p)).preview,'');};
  await walk(p,2180,650);await walk(p,2180,680);await preview('photo-eaves','eaves','01-eaves-preview');if(!args.includes('--preview-only')){await p.locator('#exp-shutter').click();assert.match(await p.locator('#exp-photo-feedback').textContent(),/桥面/);assert.equal((await state(p)).photographed,'false');assert.equal(JSON.parse((await state(p)).progress).counts.rewards,0);}await closeView();assert.deepEqual(JSON.parse((await state(p)).observations),['eaves']);assert.ok(!(await p.locator('#exp-notes-list').textContent()).includes('花窗望江'));
  await walk(p,2180,650);await walk(p,900,650);await preview('window','window','02-window-preview');if(!args.includes('--preview-only')){await p.locator('#exp-shutter').click();assert.match(await p.locator('#exp-photo-feedback').textContent(),/木楼/);assert.equal((await state(p)).photographed,'false');}await closeView();
  await walk(p,1100,650);await walk(p,1100,1120);await walk(p,1700,1120);await interact(p,'riverfront-down');await walk(p,900,650);await walk(p,900,1050);await walk(p,1950,1050);await preview('view','river','03-river-preview');await closeView();
  assert.equal(new Set(previews.map(p=>p.image)).size,3);report.previews=previews.map(({image,...p})=>p);record('P01 three native keyboard approaches and visibly distinct previews',{sites:previews.map(p=>p.site)});
  if(args.includes('--preview-only')){report.layers.desktopChrome='PASS';report.phase='preview-only';report.notRun=['P02 active shutter','P03 card','P04 migration and restart','P05 touch and lifecycle','P06 full regression'];}
  else {
    // This valid legacy fixture comes from the actual keyboard route above,
    // before photographing. Only the historical key is seeded in new contexts.
    const beforePhoto=await state(p);assert.equal(beforePhoto.completed,'true');assert.equal(beforePhoto.photographed,'false');
    const oldArchive=JSON.stringify({schemaVersion:1,contentVersion:'exp02a-core-district-1',safe:'overlook',progress:JSON.parse(beforePhoto.progress)});
    await interact(p,'view');const staleGesturePreview=(await state(p)).previewId;
    const shutterBox=await p.locator('#exp-shutter').boundingBox();await p.mouse.move(shutterBox.x+shutterBox.width/2,shutterBox.y+shutterBox.height/2);await p.mouse.down();
    await p.keyboard.press('Escape');await p.keyboard.press('Escape');await interact(p,'view');assert.notEqual((await state(p)).previewId,staleGesturePreview);
    const clicksBefore=await p.evaluate(()=>window.__pointerEvents.filter(e=>e.type==='click'&&e.target==='exp-shutter'&&e.trusted).length);
    await p.mouse.up();await wait(p,n=>window.__pointerEvents.filter(e=>e.type==='click'&&e.target==='exp-shutter'&&e.trusted).length>n,clicksBefore);
    assert.equal((await state(p)).photographed,'false');assert.equal(JSON.parse((await state(p)).progress).counts.rewards,0);await p.locator('#exp-photo-close').click();
    record('P02 native stale shutter gesture cannot capture a newly opened preview',{staleGesturePreview});
    for(let i=0;i<3;i++){
      await p.keyboard.down('KeyE');await wait(p,()=>!!document.querySelector('#exp-root').dataset.preview);await p.keyboard.down('KeyE');await p.waitForTimeout(80);assert.equal((await state(p)).photographed,'false');assert.equal((await state(p)).tokens,1);await p.keyboard.up('KeyE');await p.keyboard.press('KeyE');assert.equal((await state(p)).preview,'');assert.equal((await state(p)).tokens,0);
    }
    await interact(p,'view');await p.setViewportSize({width:1000,height:700});await fitCanvas(p);assert.equal((await state(p)).photographed,'false');await p.setViewportSize({width:1280,height:720});await fitCanvas(p);
    await p.keyboard.press('Escape');assert.equal((await state(p)).preview,'');assert.equal((await state(p)).photographed,'false');await p.locator('#exp-resume').click();
    await interact(p,'view');const captureId=(await state(p)).previewId;await p.locator('#exp-shutter').click();await wait(p,()=>document.querySelector('#exp-root').dataset.cardOpen==='true');
    await p.locator('#exp-card-image').evaluate(img=>img.decode());await shot(p,'04-postcard');assert.equal((await state(p)).photographed,'true');const captured=await state(p);assert.equal(JSON.parse(captured.progress).counts.rewards,1);assert.deepEqual(JSON.parse(captured.mementos),[]);
    await p.keyboard.press('KeyE');assert.equal((await state(p)).cardOpen,'false');await reviewCard(p);await p.locator('#exp-card-close').click();assert.equal((await state(p)).progress,captured.progress);
    await p.reload();await loaded(p);const restored=await state(p);assert.notEqual(restored.runtimeId,captured.runtimeId);assert.equal(restored.progress,captured.progress);assert.equal(restored.photographed,'true');assert.equal(restored.cardOpen,'false');assert.deepEqual(JSON.parse(restored.observations),['eaves','window','river']);
    await reviewCard(p);await shot(p,'05-postcard-restored');await p.locator('#exp-card-close').click();
    await walk(p,900,1050);await walk(p,900,650);await walk(p,350,650);await interact(p,'riverfront-up');await walk(p,1100,1120);await walk(p,430,1120);await walk(p,430,1060);await interact(p,'west-up');await walk(p,400,450);await interact(p,'middle-west-upper');await walk(p,1010,1150);await walk(p,1010,650);await walk(p,880,650);await walk(p,880,580);await interact(p,'guide-door');await interact(p,'guide-exit');assert.equal((await state(p)).progress,captured.progress);
    await migrationChecks(oldEmpty,oldOpen,await p.evaluate(()=>JSON.parse(localStorage.getItem('pokan.exp05a.save.v1'))));active=p;
    record('P02 P03 explicit shutter, wrong-view feedback, held/menu/resize cancellation, one reward, replay and refresh',{captureId,before:captured.runtimeId,after:restored.runtimeId});report.layers.desktopChrome='PASS';
    // Raw ordinary Chrome gives native hidden/visible events; focus combinations
    // are recorded separately rather than inferred from hidden.
    const profile=join(dir,'native-chrome-profile');await mkdir(profile);nativeProcess=spawn(selection.executablePath,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe']});report.nativeChrome={pid:nativeProcess.pid,profile};let stderr='';nativeProcess.stderr.setEncoding('utf8');
    const endpoint=await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(new Error('Native Chrome CDP unavailable '+stderr)),15000);nativeProcess.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);done(match[1]);}});nativeProcess.once('exit',code=>{clearTimeout(timer);fail(new Error('Native Chrome exited '+code));});});
    nativeBrowser=await chromium.connectOverCDP(endpoint,{noDefaults:true});const nc=nativeBrowser.contexts()[0],np=nc.pages()[0];active=np;
    await np.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp02a.save.v1'))localStorage.setItem('pokan.exp02a.save.v1',raw);window.__visibility=[];document.addEventListener('visibilitychange',()=>window.__visibility.push({state:document.visibilityState,focus:document.hasFocus(),tokens:document.querySelector('#exp-root')?.dataset.tokens}));},oldArchive);
    await np.goto(report.url);await loaded(np);await np.bringToFront();await interact(np,'riverfront-down');await walk(np,900,650);await walk(np,900,1050);await walk(np,1950,1050);await interact(np,'view');await np.keyboard.press('Escape');const paused=await state(np),bg=await nc.newPage();await bg.goto('about:blank');await bg.bringToFront();await np.waitForFunction(()=>document.visibilityState==='hidden',undefined,{timeout:10000,polling:100});assert.equal((await state(np)).tokens,2);assert.equal((await state(np)).tick,paused.tick);assert.equal((await state(np)).photographed,'false');
    await np.bringToFront();await wait(np,()=>document.visibilityState==='visible');assert.equal((await state(np)).tokens,1);await np.locator('#exp-resume').click();await interact(np,'view');await bg.bringToFront();await np.waitForFunction(()=>document.visibilityState==='hidden',undefined,{timeout:10000,polling:100});assert.equal((await state(np)).tokens,1);assert.equal((await state(np)).preview,'');await np.bringToFront();await wait(np,()=>document.visibilityState==='visible');assert.equal((await state(np)).tokens,0);assert.equal((await state(np)).photographed,'false');report.visibility=await np.evaluate(()=>window.__visibility);await bg.close();record('P05 native hidden cancels preview; hidden and menu own independent pause tokens',{events:report.visibility});
    const touch=await newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});const tc=await touch.context().newCDPSession(touch);
    await touch.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp02a.save.v1'))localStorage.setItem('pokan.exp02a.save.v1',raw);if(!localStorage.getItem('pokan.exp01.save.v1'))localStorage.setItem('pokan.exp01.save.v1','retained courtyard archive');localStorage.setItem('other-game.fixture','keep');},oldArchive);
    await touch.goto(report.url);await loaded(touch);assert.equal((await state(touch)).completed,'true');assert.equal((await state(touch)).photographed,'false');assert.deepEqual(JSON.parse((await state(touch)).observations),[]);assert.match(await touch.locator('#exp-archive-notice').textContent(),/已沿用街区进度/);
    await touchPort(touch);await interact(touch,'riverfront-down');await walk(touch,900,650);await walk(touch,900,1050);await walk(touch,1910,1050);
    const dispatch=(type,points)=>tc.send('Input.dispatchTouchEvent',{type,touchPoints:points}),point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1});const b=await touch.locator('#exp-stick').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,ib=await touch.locator('#exp-interact').boundingBox();
    await dispatch('touchStart',[point(1,x,y)]);await dispatch('touchMove',[point(1,x+32,y)]);await wait(touch,()=>Number(document.querySelector('#exp-root').dataset.x)>=1930);await dispatch('touchStart',[point(1,x+32,y),point(2,ib.x+ib.width/2,ib.y+ib.height/2)]);await wait(touch,()=>document.querySelector('#exp-root').dataset.preview==='river');assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchEnd',[]);await touch.locator('#exp-photo-image').evaluate(img=>img.decode());await shot(touch,'06-touch-direct-preview');
    await touch.locator('#exp-photo-menu').tap();assert.equal((await state(touch)).photographed,'false');await touch.locator('#exp-resume').tap();await touch.locator('#exp-interact').tap();await touch.locator('#exp-shutter').tap();assert.equal((await state(touch)).cardOpen,'true');assert.deepEqual(JSON.parse((await state(touch)).observations),['river']);await touch.locator('#exp-card-image').evaluate(img=>img.decode());await shot(touch,'07-touch-postcard');
    const cardBounds=await touch.locator('#exp-card-close').boundingBox();assert.ok(cardBounds.x>=0&&cardBounds.y>=0&&cardBounds.x+cardBounds.width<=844&&cardBounds.y+cardBounds.height<=390);
    const touchProgress=(await state(touch)).progress;await touch.locator('#exp-card-close').tap();await touch.reload();await loaded(touch);assert.equal((await state(touch)).progress,touchProgress);assert.equal((await state(touch)).photographed,'true');assert.equal(await touch.evaluate(()=>localStorage.getItem('pokan.exp02a.save.v1')),oldArchive);await reviewCard(touch,true);await touch.locator('#exp-card-close').tap();
    record('P03 P04 P05 valid old archive imports, first correct view succeeds with native multi-pointer and one reconstructed card',{legacyFixtureFromActualKeyboardRoute:true,cardBounds});
    await dispatch('touchStart',[point(3,x,y)]);await dispatch('touchMove',[point(3,x,y+32)]);await touch.keyboard.down('KeyD');await dispatch('touchCancel',[]);assert.equal(JSON.parse((await state(touch)).input).pointers,0);assert.ok(JSON.parse((await state(touch)).input).x>0);await touch.keyboard.up('KeyD');
    await dispatch('touchStart',[point(4,x,y)]);await dispatch('touchMove',[point(4,x+32,y)]);const releasedPointer=await touch.locator('#exp-stick').evaluate(el=>{const e=window.__pointerEvents.findLast(e=>e.type==='gotpointercapture'&&e.target==='exp-stick');if(!e||!el.hasPointerCapture(e.pointerId))throw new Error('No native capture');el.releasePointerCapture(e.pointerId);return e.pointerId;});await dispatch('touchMove',[point(4,x+31,y)]);await wait(touch,id=>window.__pointerEvents.some(e=>e.type==='lostpointercapture'&&e.pointerId===id&&e.trusted),releasedPointer);assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchEnd',[]);
    await dispatch('touchStart',[point(5,x,y)]);await dispatch('touchMove',[point(5,x+32,y)]);await touch.setViewportSize({width:390,height:844});await fitCanvas(touch);assert.equal(JSON.parse((await state(touch)).input).pointers,0);await dispatch('touchCancel',[]);await reviewCard(touch,true);await wait(touch,()=>document.querySelector('#exp-root').dataset.cardOpen==='true');await shot(touch,'08-touch-portrait-card');await touch.locator('#exp-card-close').tap();await touch.setViewportSize({width:844,height:390});await fitCanvas(touch);assert.equal((await state(touch)).progress,touchProgress);
    await touch.locator('#exp-menu-button').tap();await touch.locator('#exp-restart').tap();await touch.locator('#exp-confirm-restart').tap();await loaded(touch);assert.equal((await state(touch)).map,'plaza');assert.equal((await state(touch)).accepted,'false');assert.equal((await state(touch)).photographed,'false');assert.equal(await touch.evaluate(()=>localStorage.getItem('pokan.exp02a.save.v1')),oldArchive);assert.equal(await touch.evaluate(()=>localStorage.getItem('other-game.fixture')),'keep');
    await touch.reload();await loaded(touch);assert.equal((await state(touch)).accepted,'false');assert.equal((await state(touch)).unlocked,'false');assert.equal((await state(touch)).photographed,'false');assert.ok(await touch.evaluate(()=>JSON.parse(localStorage.getItem('pokan.exp05a.save.v1')).progress.goals.length===0));record('P04 P05 explicit new game remains blank after refresh; old keys and unrelated data preserved, cancel/capture/rotation clean');report.layers.touchEmulation='PASS';
  // Dispatched pagehide is an explicit disposal probe, separate from native visibility above.
  await touch.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await wait(touch,()=>document.querySelector('#exp-root').dataset.disposed==='true'&&document.querySelector('#exp-stage').dataset.mapObjects==='0');
  assert.equal(await touch.locator('#exp-stage canvas').count(),0);assert.equal(await touch.locator('#exp-photo-image').getAttribute('src'),null);assert.equal(await touch.locator('#exp-card-image').getAttribute('src'),null);
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
  const old=await newPage({viewport:{width:1280,height:720}});await old.goto(base+'?scene=first-level');
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
  console.log(report.status,'EXP-02C',dir);if(report.status==='FAIL')process.exitCode=1;
}
