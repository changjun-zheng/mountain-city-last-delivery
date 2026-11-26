import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';
import {PHOTO_METADATA} from '../src/core/exploration-photo.ts';
import {emptyExplorationSave,validateExplorationSave,migrateExp05ASave,migrateExp05BSave} from '../src/core/exploration.ts';
import {EXP05A_CONTENT_VERSION,EXP05B_CONTENT_VERSION} from '../src/core/exploration-content.ts';
import {runBrowserFloorRoute} from './exploration-floor-routes.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname,join,relative,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {identifyBrowser,parseBrowserSelection,resolveBrowserExecutable} from './browser-selection.mjs';

const args=process.argv.slice(2);
const modes=['--probe-only','--spatial-only','--spatial-lower-only','--journey-only','--style-02a','--resize-only','--pause-only','--pause-multitouch-only','--save-only'];
if(!args.includes('--production')||args.some(a=>a!=='--production'&&!modes.includes(a)&&!a.startsWith('--browser='))||args.filter(a=>modes.includes(a)).length>1)throw new Error('Use --production --browser=chrome with at most one mode');
const styleAcceptance=args.includes('--style-02a');
const resizeAcceptance=args.includes('--resize-only');
const pauseAcceptance=args.includes('--pause-only')||args.includes('--pause-multitouch-only');
const saveAcceptance=args.includes('--save-only');
const selection=resolveBrowserExecutable(parseBrowserSelection(args));
assert.equal(selection.id,'chrome');
const dir=resolve('test-results',saveAcceptance?'save-01':pauseAcceptance?'pause-01':resizeAcceptance?'resize-01':styleAcceptance?'style-02a':'exp-06a',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:styleAcceptance?'STYLE-02A':args.includes('--journey-only')?'RIVER-JOURNEY-01':'EXP-06A',scope:styleAcceptance?'fresh-guided-A-to-D-keyboard-and-landscape-touch':args.includes('--journey-only')?'fresh-opening-and-ferry-keyboard-touch':args.includes('--spatial-lower-only')?'spatial-H1-fixture-look':args.includes('--spatial-only')?'spatial-first-look-keyboard':args.includes('--probe-only')?'c-district-touch-native-and-owned-gestures':'c-district-fresh-A-to-D-keyboard',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],consoleErrors:[],networkErrors:[],cleanup:{},hashes:{},protectedHashes:{},actualDist:{},historicalFailures:[],
  limitations:['True Android Chrome and iOS Safari were not available.','The completion card closes the existing Demo route; it does not prove a full 30-45 minute chapter.','Final art, culture review and real-device H5 acceptance remain separate.']};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
if(resizeAcceptance){report.task='RESIZE-01';report.scope='dynamic-canvas-and-held-touch-rotation; fresh-start plus separately labelled river fixture';}
if(pauseAcceptance){report.task='PAUSE-01';report.scope=args.includes('--pause-multitouch-only')?'additional held-stick plus second-finger menu diagnostic':'nested-pause-journal-help-title; fresh starts and separately labelled river photo fixture';}
if(saveAcceptance){report.task='SAVE-01';report.scope='isolated archive corruption, storage faults and explicit restart; fixture injection separate from real UI input';}
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function hashTree(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await hashTree(p);else report.hashes[relative(process.cwd(),p).replaceAll('\\','/')]=await sha(p);}}
await hashTree('src');
for(const e of await readdir('tests'))if(/^(exploration.*\.mjs|exp-0[2356].*-browser\.mjs)$/.test(e))report.hashes['tests/'+e]=await sha('tests/'+e);
for(const file of ['package.json','package-lock.json','index.html'])report.hashes[file]=await sha(file);
report.fingerprintMeaning='Current version hashes only; unchanged-versus-HEAD protection is recorded independently.';

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

let browser,active,nativeProcess,nativeBrowser,headlessProcess;
const contexts=[];
const state=page=>page.locator('#exp-root').evaluate(e=>{const g=document.querySelector('#exp-stage').dataset;return{...e.dataset,x:Number(e.dataset.x),y:Number(e.dataset.y),tick:Number(e.dataset.tick),tokens:Number(e.dataset.tokens),cameraX:Number(g.cameraX),cameraY:Number(g.cameraY),mapObjects:Number(g.mapObjects),zoom:Number(g.zoom)};});
const wait=async(page,predicate,arg)=>page.waitForFunction(predicate,arg,{timeout:20000,polling:'raf'});
const shot=async(page,name)=>{const path=join(dir,`${name}.png`);await page.screenshot({path});report.screenshots.push(path);return path;};
const key=async(page,code)=>{report.timeline.push({event:'key',code,at:new Date().toISOString()});await page.keyboard.press(code);};
const fitCanvas=async page=>{
  const sample=await page.evaluate(async()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   let previous='',stable=0;
   for(let frame=0;frame<180;frame++){
    await new Promise(requestAnimationFrame);
    const stage=document.querySelector('#exp-stage'),canvas=stage.querySelector('canvas');
    if(!canvas)continue;
    const s={viewport:{width:innerWidth,height:innerHeight},stage:rect(stage),canvas:rect(canvas),backing:{width:canvas.width,height:canvas.height},dpr:devicePixelRatio,layout:stage.dataset.layout};
    const h=s.stage.width<s.stage.height?1000:Math.max(520,Math.min(760,s.stage.height));
    const fitted=Math.abs(s.canvas.x-s.stage.x)<2&&Math.abs(s.canvas.y-s.stage.y)<2&&Math.abs(s.canvas.width-s.stage.width)<2&&Math.abs(s.canvas.height-s.stage.height)<2&&s.backing.height===h&&s.backing.width===Math.round(h*s.stage.width/s.stage.height);
    const key=JSON.stringify(s);stable=fitted&&key===previous?stable+1:fitted?1:0;previous=key;
    if(stable>=2)return{...s,stableFrames:stable};
   }
   throw Error('Dynamic canvas did not fit and stabilize for two frames: '+previous);
  });
  report.timeline.push({event:'dynamic-canvas',sample});
  assert.ok(Math.abs(sample.canvas.width/sample.canvas.height-sample.backing.width/sample.backing.height)<.01);
  return sample;
};
async function loaded(page){await wait(page,()=>document.querySelector('#exp-root')?.dataset.ready==='true');await page.waitForLoadState('networkidle');}
async function newPage(options={}){
  const context=await browser.newContext(options);contexts.push(context);const page=await context.newPage();active=page;
  page.on('pageerror',error=>report.pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('requestfailed',request=>report.networkErrors.push({url:request.url(),error:request.failure()}));
  page.on('response',response=>{if(response.status()>=400)report.networkErrors.push({url:response.url(),status:response.status()});});
  await page.addInitScript(()=>{
    const originalAdd=EventTarget.prototype.addEventListener;
    const originalSet=Storage.prototype.setItem;
    window.__expSignals=[];window.__storageMutations=[];window.__visibility=[];window.__pointerEvents=[];
    EventTarget.prototype.addEventListener=function(type,listener,options){if(options?.signal)window.__expSignals.push({type,signal:options.signal});return originalAdd.call(this,type,listener,options);};
    Storage.prototype.setItem=function(key,value){window.__storageMutations.push({key,at:performance.now()});return originalSet.call(this,key,value);};
    document.addEventListener('visibilitychange',()=>window.__visibility.push({state:document.visibilityState,focus:document.hasFocus(),at:performance.now()}));
    for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','click'])document.addEventListener(type,event=>window.__pointerEvents.push({type,pointerId:event.pointerId,target:event.target.id,button:event.target.closest?.('button')?.id,x:event.clientX,y:event.clientY,isPrimary:event.isPrimary,trusted:event.isTrusted}),true);
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
async function restore(page,safe,touch=false){const before=await state(page);await page.reload();await loaded(page);await page.locator('#exp-begin')[touch?'tap':'click']();assert.equal((await state(page)).safe,safe);assert.equal((await state(page)).progress,before.progress);}
async function seeded(safe,size){const page=await newPage({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:1});await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp06a.save.v1'))localStorage.setItem('pokan.exp06a.save.v1',raw);},JSON.stringify({...emptyExplorationSave(),safe}));await page.goto(base);await loaded(page);await page.locator('#exp-begin').tap();await touchPort(page);return page;}

function fixture(safe,photo=false){const p=new InMemoryRunProgress('exp03b');p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);p.completeGoal(P.unlocked);if(photo){p.completeGoal(P.completed);p.completeGoal(Q.photographed);}return {...emptyExplorationSave(),safe,progress:p.snapshot,observedSites:photo?['river']:[],photo:photo?PHOTO_METADATA:null};}
async function currentPage(save,size={width:1280,height:760},touch=false){const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp06a.save.v1'))localStorage.setItem('pokan.exp06a.save.v1',raw);},JSON.stringify(save));await page.goto(base);await loaded(page);await page.locator('#exp-begin')[touch?'tap':'click']();if(touch)await touchPort(page);return page;}
async function walkRoute(page,steps){for(const step of steps){if(Array.isArray(step))await walk(page,...step);else await interact(page,step);}}
const G2_DOWN=[[950,700],[300,700],'guide-down',[820,540],[540,540],'guide-exit'];
const W3_ITEM=[[760,700],[760,430]];
const W3_DOWN=[[760,700],[250,700],'workshop-down-2'];
async function spatialFirst(){
 const page=await currentPage({...emptyExplorationSave(),safe:'cGuideH3'});await walk(page,710,760);await shot(page,'spatial-upper-guide-two-storeys');await walk(page,710,560);
 await walkRoute(page,[[450,560],[450,240],[1300,240],[1300,650],[710,650],[710,560],'guide-door']);
 await shot(page,'spatial-guide2-upper-door');await walkRoute(page,G2_DOWN);assert.equal((await state(page)).safe,'cGuideH2');
 await walkRoute(page,[[450,560],[450,300]]);await shot(page,'spatial-middle-same-guide-and-upper-storey');
 await walkRoute(page,[[450,600],[810,600],[810,740],'market-west-door',[1080,600],'market-east-exit']);assert.equal((await state(page)).safe,'cMarketEast');await shot(page,'spatial-market-east-corner');
 record('C01 C06 early spatial keyboard: back/front lane with slope corners, guide2 to guide1/middle, same marked facade at adjacent heights, market west to east',{fixture:'inline blank current C upper safe; no accepted/unlocked; not fresh A run'});await page.close();
}
async function spatialLower(){
 const page=await currentPage(fixture('cWoodH1'));await walkRoute(page,[[1350,570],[1350,300]]);await shot(page,'spatial-lower-wood-continuous-storeys-and-piers');record('C06 lower street real keyboard H1 review point with wood three-storey side/front and under-deck piers',{fixture:'inline unlocked H1 doorway, then normal keyboard to x1350 y300',state:await state(page)});await page.close();
}
async function touchBuildings(){
 for(const size of [{width:844,height:390},{width:667,height:375}]){
  const page=await currentPage({...emptyExplorationSave(),safe:'cGuideH3'},size,true);const runtime=(await state(page)).runtimeId;await shot(page,`upper-guide-${size.width}`);
  await interact(page,'guide-door');await shot(page,`guide2-${size.width}`);await walkRoute(page,[[950,700],[950,350]]);await interact(page,'note');assert.equal((await state(page)).clue,'false');await page.locator('#exp-menu-button').tap();assert.equal((await state(page)).pending,'');await page.locator('#exp-resume').tap();assert.equal((await state(page)).clue,'false');await interact(page,'note');await page.locator('#exp-close').tap();assert.equal((await state(page)).clue,'true');
  await walkRoute(page,G2_DOWN);assert.equal((await state(page)).safe,'cGuideH2');await shot(page,`middle-guide-${size.width}`);await restore(page,'cGuideH2',true);
  await walkRoute(page,[[1620,560],'workshop-middle-door']);await shot(page,`workshop2-${size.width}`);await walkRoute(page,[[1100,700],[1080,700],'workshop-up-3']);await walkRoute(page,W3_ITEM);await shot(page,`workshop3-${size.width}`);await interact(page,'plaque');await page.locator('#exp-menu-button').tap();await page.locator('#exp-resume').tap();assert.equal((await state(page)).item,'false');await interact(page,'plaque');await page.locator('#exp-close').tap();assert.equal((await state(page)).item,'true');
  await walkRoute(page,[[760,700],[1080,700],'workshop-upper-exit']);assert.equal((await state(page)).safe,'cWoodH3');await shot(page,`upper-wood-${size.width}`);await interact(page,'workshop-upper-door');await walkRoute(page,[[250,700],'workshop-down-2',[250,700],'workshop-down-1',[250,540],[540,540]]);await shot(page,`workshop1-closed-${size.width}`);await interact(page,'workshop-exit');await page.locator('#exp-close').tap();assert.equal((await state(page)).map,'workshop');assert.equal((await state(page)).unlocked,'false');
  await walkRoute(page,[[250,540],'workshop-up-2',[1100,700],[1100,400],'workshop-middle-exit']);await walkRoute(page,[[1290,600],[1290,740],'market-east-door']);await shot(page,`market-${size.width}`);await walkRoute(page,[[220,600],'market-west-exit']);assert.equal((await state(page)).safe,'cMarketWest');
  const counts=[];for(let n=0;n<10;n++){await interact(page,'market-west-door');counts.push((await state(page)).mapObjects);await interact(page,'market-west-exit');}assert.equal(new Set(counts).size,1);
  const cdp=await page.context().newCDPSession(page),b=await page.locator('#exp-stick').boundingBox(),point={id:71,x:b.x+b.width/2,y:b.y+b.height/2,radiusX:5,radiusY:5,force:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+30}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(JSON.parse((await state(page)).input).pointers,0);await page.setViewportSize({width:390,height:844});await fitCanvas(page);assert.equal(JSON.parse((await state(page)).input).pointers,0);await page.setViewportSize(size);await fitCanvas(page);
  record(`C01 C02 C05 ${size.width} real joystick crosses guide H3/H2, wood H2/H3/H1, denies H1 exit, market two doors, cancel/normal, reload, ten doors and rotation`,{fixture:'inline empty current upper safe, all movement by native touch emulation; refresh creates new runtime',counts,runtime});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await wait(page,()=>document.querySelector('#exp-stage').dataset.mapObjects==='0');assert.equal(await page.locator('canvas').count(),0);assert.ok(await page.evaluate(()=>window.__expSignals.every(s=>s.signal.aborted)));await page.close();
  const lower=await currentPage(fixture('cTeaH1'),size,true);await shot(lower,`tea-front-${size.width}`);await interact(lower,'tea-door');await shot(lower,`tea-interior-${size.width}`);await walkRoute(lower,[[800,540],[800,330],'window']);await lower.locator('#exp-photo-close').tap();await walkRoute(lower,[[800,540],[540,540],'tea-exit',[680,650],[850,650],[850,1050],[1130,1050],[1130,1010],'lantern-door']);await shot(lower,`lantern-interior-${size.width}`);await walkRoute(lower,[[650,650],[650,400],[850,400],'memento-postcard']);await lower.locator('#exp-memento-cancel').tap();assert.equal(JSON.parse((await state(lower)).mementos).length,0);await interact(lower,'memento-postcard');await lower.locator('#exp-close').tap();assert.equal(JSON.parse((await state(lower)).mementos).length,1);await walkRoute(lower,[[650,400],[650,600],[220,600],'lantern-exit']);await shot(lower,`lantern-front-${size.width}`);record(`C03 C05 ${size.width} unlocked lower fixture: tea window, lantern real paper cancel/collect, matching doorway return`,{fixture:'inline open progress at current H1 tea safe; not full phone main route'});await lower.close();
 }
 report.layers.touchEmulation='PASS';
}
async function dialogueProbe(){
 for(const size of [{width:844,height:390},{width:667,height:375}]){
  const page=await seeded('cGuideStair2',size);await walk(page,950,700);await walk(page,950,350);const cdp=await page.context().newCDPSession(page);
  const start=async selector=>{const b=await page.locator(selector).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:81,x:b.x+b.width/2,y:b.y+b.height/2,radiusX:5,radiusY:5,force:1}]});};
  const end=async()=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));};
  await start('#exp-interact');await wait(page,()=>document.querySelector('#exp-root').dataset.dialogue==='true');const originalText=await page.locator('#exp-dialogue-text').textContent();await shot(page,`dialogue-${size.width}-pressed`);await end();assert.equal((await state(page)).dialogue,'true');assert.equal((await state(page)).clue,'false');
  await start('#exp-close');await page.keyboard.press('Escape');assert.equal((await state(page)).view,'menu');assert.equal((await state(page)).clue,'false');await page.keyboard.press('Escape');await page.keyboard.press('KeyE');assert.equal(await page.locator('#exp-dialogue-text').textContent(),originalText);await end();assert.equal((await state(page)).dialogue,'true');assert.equal((await state(page)).clue,'false');
  await start('#exp-close');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await state(page)).dialogue,'true');await start('#exp-close');await page.setViewportSize({width:390,height:844});await fitCanvas(page);await end();assert.equal((await state(page)).clue,'false');assert.equal((await state(page)).dialogue,'true');await page.setViewportSize(size);await fitCanvas(page);
  await page.locator('#exp-close').tap();assert.equal((await state(page)).clue,'true');assert.equal((await state(page)).dialogue,'false');const done=(await state(page)).progress;await interact(page,'note');await page.locator('#exp-close').focus();await page.keyboard.press('Enter');assert.equal((await state(page)).dialogue,'false');await interact(page,'note');await page.keyboard.press('KeyE');assert.equal((await state(page)).dialogue,'false');assert.equal((await state(page)).progress,done);
  await runBrowserFloorRoute(page,'guideBack',walk,interact);await walk(page,780,540);await walk(page,780,470);await interact(page,'memento-bookmark');assert.equal(JSON.parse((await state(page)).mementos).length,0);await page.locator('#exp-memento-cancel').tap();assert.equal(JSON.parse((await state(page)).mementos).length,0);await interact(page,'memento-bookmark');await page.locator('#exp-close').tap();assert.equal(JSON.parse((await state(page)).mementos).length,1);const collected=(await state(page)).progress;await interact(page,'memento-bookmark');await page.locator('#exp-close').tap();assert.equal((await state(page)).progress,collected);
  const events=await page.evaluate(()=>window.__pointerEvents);report.timeline.push({event:'ordinary-close-ownership',size,events});await shot(page,`dialogue-${size.width}-finished`);record(`ordinary close ${size.width}: opening release cannot submit; same-text generation/cancel/resize reject; active touch and keyboard commit once; memento guard retained`,{fixture:'inline empty save at guide2 stair; not fresh main route'});await page.close();
 }
 report.layers.touchEmulation='PASS';report.mainRoute='NOT RUN';
}

async function photoCloseProbe(){
 for(const size of [{width:844,height:390},{width:667,height:375}]){
 const page=await newPage({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const saved=fixture('riverView',true);
 await page.addInitScript(raw=>localStorage.setItem('pokan.exp06a.save.v1',raw),JSON.stringify(saved));
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

async function nativeFloorHidden(){
 const profile=join(dir,'native-floor-profile');await mkdir(profile);nativeProcess=spawn(selection.executablePath,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true});report.nativeChrome={pid:nativeProcess.pid,profile};let stderr='';nativeProcess.stderr.setEncoding('utf8');const endpoint=await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(new Error(stderr)),15000);nativeProcess.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);done(match[1]);}});});nativeBrowser=await chromium.connectOverCDP(endpoint,{noDefaults:true});const context=nativeBrowser.contexts()[0],page=context.pages()[0];active=page;page.on('pageerror',e=>report.pageErrors.push(String(e)));page.on('requestfailed',r=>report.networkErrors.push({url:r.url(),error:r.failure()}));page.on('response',r=>{if(r.status()>=400)report.networkErrors.push({url:r.url(),status:r.status()});});
 await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp06a.save.v1'))localStorage.setItem('pokan.exp06a.save.v1',raw);window.__floorVisibility=[];document.addEventListener('visibilitychange',()=>window.__floorVisibility.push({hidden:document.hidden,tokens:document.querySelector('#exp-root')?.dataset.tokens}));},JSON.stringify({...emptyExplorationSave(),safe:'cWoodStair3'}));await page.goto(base);await loaded(page);await page.bringToFront();await page.locator('#exp-begin').click();await page.keyboard.down('KeyD');await wait(page,()=>Number(document.querySelector('#exp-root').dataset.x)>265);await page.keyboard.up('KeyD');await page.locator('#exp-menu-button').click();const paused=await state(page),bg=await context.newPage();await bg.goto('about:blank');await bg.bringToFront();await wait(page,()=>document.hidden);assert.equal((await state(page)).tokens,2);assert.equal((await state(page)).tick,paused.tick);await page.bringToFront();await wait(page,()=>!document.hidden);assert.equal((await state(page)).tokens,1);assert.equal(JSON.parse((await state(page)).input).keys.length,0);await page.locator('#exp-resume').click();assert.equal((await state(page)).tokens,0);assert.equal((await state(page)).accepted,'false');await shot(page,'native-workshop3');report.visibility=await page.evaluate(()=>window.__floorVisibility);await bg.close();record('C05 actual native Chrome hidden and menu have independent owners in new 3F before any quest',{events:report.visibility});
}

async function mainRoute(page){
 await page.goto(base);await loaded(page);assert.equal((await state(page)).view,'title');assert.equal((await state(page)).map,'plaza');
 await page.locator('#exp-begin').click();
 assert.equal((await state(page)).view,'intro');assert.equal((await state(page)).tokens,1);
 assert.match(await page.locator('#exp-intro').innerText(),/沧白路栏边/);
 await page.locator('#exp-intro-start').click();
 assert.equal((await state(page)).view,'play');
 const runtime=(await state(page)).runtimeId,started=Date.now();
 await walkRoute(page,[[1250,790],[1250,650],[3060,650],[3060,900],[3120,900],'city-to-entry',[1100,850],[1100,800],'visitor']);await closeDialogue(page);await walkRoute(page,[[2000,800],[2000,780],'entry-to-core']);
 await walkRoute(page,[[710,690],[710,560],'guide-door',[950,700],[950,350],'note']);await closeDialogue(page);await shot(page,'main-guide2');await walkRoute(page,G2_DOWN);assert.equal((await state(page)).safe,'cGuideH2');await shot(page,'main-middle-guide');
 await walkRoute(page,[[810,560],[810,740],'market-west-door',[1080,600],'market-east-exit',[1290,600],[1620,600],[1620,570],'workshop-middle-door',[1100,700],[1080,700],'workshop-up-3']);
 await walkRoute(page,[[680,700],[680,415]]);assert.equal((await state(page)).target,'');await key(page,'KeyE');assert.equal((await state(page)).item,'false');await walkRoute(page,[[680,540],[760,540],[760,430],'plaque']);await closeDialogue(page);await shot(page,'main-wood3');await walkRoute(page,[[760,700],[1080,700],'workshop-upper-exit']);await shot(page,'main-upper-wood');
 await walkRoute(page,[[2000,570],[2000,950],'east-down',[2000,990],[1930,990],'gate']);await closeDialogue(page);assert.equal((await state(page)).unlocked,'true');
 await walkRoute(page,[[1930,650],[1620,650],[1620,570],'workshop-middle-door',[1100,700],[250,700],'workshop-down-1',[250,540],[540,540],'workshop-exit']);assert.equal((await state(page)).safe,'cWoodH1');await shot(page,'main-lower-wood');
 await walkRoute(page,[[680,570],'tea-door',[800,540],[800,330],'window']);await page.locator('#exp-shutter').click();assert.equal((await state(page)).photographed,'false');await page.locator('#exp-photo-close').click();await walkRoute(page,[[800,540],[540,540],'tea-exit',[680,650],[850,650],[850,1050],[1350,1050],'photo-eaves']);await page.locator('#exp-shutter').click();assert.equal((await state(page)).photographed,'false');await page.locator('#exp-photo-close').click();
 await walkRoute(page,[[1950,1050],'riverfront-down',[900,650],[900,1050],[1950,1050],'view']);await page.locator('#exp-shutter').click();assert.equal((await state(page)).cardOpen,'true');assert.equal((await state(page)).photographed,'true');assert.equal((await state(page)).runtimeId,runtime);assert.deepEqual(JSON.parse((await state(page)).mementos),[]);assert.equal(JSON.parse((await state(page)).progress).counts.rewards,1);await shot(page,'main-D-completion');const before=(await state(page)).progress;await page.locator('#exp-card-close').click();await interact(page,'view');await page.locator('#exp-shutter').click();assert.equal((await state(page)).progress,before);await page.locator('#exp-card-title').click();await page.locator('#exp-begin').click();assert.equal((await state(page)).runtimeId,runtime);await page.reload();await loaded(page);assert.equal((await state(page)).safe,'riverView');assert.equal((await state(page)).progress,before);await page.locator('#exp-begin').click();
 report.automationTiming={actualRootToCompletionWithChecksMs:Date.now()-started,note:'Scripted real keyboard route with assertions, not first-player chapter duration.'};record('C01 C02 C03 C05 blank A title to B, guide H3/H2, market two doors, wood H2/H3 and H3 exit, original middle gate, wood1 H1, wrong views and original D shutter once',{runtime,optionalMementos:0});report.layers.desktopChrome='PASS';
 await rideAcross(page,1280,false);
}

async function follow(page,id,touch){
 const before=await state(page);
 assert.equal(before.routeTarget,id);
 if(before.target!==id || Number(before.routePoints)>0){
  await page.locator('#exp-auto-walk')[touch?'tap':'click']();
  await wait(page,id=>{const s=document.querySelector('#exp-root').dataset;return s.target===id&&s.autoWalk==='false';},id);
 }
 assert.equal((await state(page)).dialogue,'false');
}

async function completeTutorial(page,press){
 assert.equal((await state(page)).onboarding,'approach');
 assert.equal(await page.locator('#exp-auto-walk').isVisible(),false);
 await walk(page,900,875);
 await interact(page,'city-monument');
 await press('exp-close');
 assert.equal((await state(page)).onboarding,'continue');
 await press('exp-onboarding-skip');
 assert.equal((await state(page)).onboarding,'done');
}

const frames=(page,count=8)=>page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);},count);
async function rotationState(page){return page.evaluate(()=>{
 const root=document.querySelector('#exp-root'),notice=document.querySelector('#exp-orientation');
 const rect=notice.getBoundingClientRect(),focus=document.activeElement;
 const knob=getComputedStyle(document.querySelector('#exp-knob')).transform,matrix=new DOMMatrix(knob==='none'?undefined:knob);
 return{noticeVisible:!notice.hidden,noticeBounds:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},focus:focus.id,
  focusVisible:!!focus.getClientRects().length&&!focus.closest('[hidden],[inert]'),titleInert:document.querySelector('#exp-title-screen').inert,
  content:[...root.children].filter(e=>e!==notice).map(e=>({id:e.id,inert:e.inert})),input:JSON.parse(root.dataset.input),knob,knobMatrix:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]};
 });}
function assertEmptyInput(s){assert.deepEqual(s.input,{x:0,y:0,interact:false,keys:[],pointers:0});assert.deepEqual(s.knobMatrix,[1,0,0,1,0,0]);}
async function assertRotationLock(page,tokens){
 await page.locator('#exp-orientation').waitFor({state:'visible'});
 const layout=await fitCanvas(page),ui=await rotationState(page),s=await state(page);
 report.timeline.push({event:'rotation-locked',ui,state:s,layout});
 assert.equal(ui.titleInert,true);assert.ok(ui.content.every(e=>e.inert));assert.equal(ui.focus,'exp-orientation');assert.equal(ui.focusVisible,true);assertEmptyInput(ui);
 assert.equal(s.tokens,tokens);assert.equal(s.paused,'true');
 await frames(page);assert.equal((await state(page)).tick,s.tick);
 return{s,ui,layout};
}
async function freshPlay(page,touch){
 const press=id=>page.locator('#'+id)[touch?'tap':'click']();
 await press('exp-begin');await press('exp-intro-start');await press('exp-onboarding-skip');
 assert.equal((await state(page)).view,'play');
}
async function resizeStartup(size){
 const portrait={width:size.height,height:size.width};
 const page=await newPage({viewport:portrait,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await page.goto(base);await loaded(page);await shot(page,`startup-${size.width}-portrait-ready`);
 const locked=await assertRotationLock(page,2);
 await page.keyboard.press('Tab');await page.keyboard.press('Enter');
 const begin=await page.locator('#exp-begin').boundingBox();await page.touchscreen.tap(begin.x+begin.width/2,begin.y+begin.height/2);
 assert.equal((await state(page)).view,'title');assert.equal((await rotationState(page)).focus,'exp-orientation');
 await page.setViewportSize(size);const layout=await fitCanvas(page);
 assert.equal((await rotationState(page)).noticeVisible,false);assert.equal((await rotationState(page)).titleInert,false);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'exp-begin');
 await freshPlay(page,true);await shot(page,`startup-${size.width}-landscape-play`);
 record(`RESIZE-01 ${size.width} portrait ready keeps title inert, visible focus and normal landscape start`,{fixture:'fresh empty storage',locked,layout});await page.close();
}
async function resizeDesktop(){
 const page=await newPage({viewport:{width:1280,height:760}});await page.goto(base);await loaded(page);await freshPlay(page,false);
 await axis(page,'x',(await state(page)).x+25);const baseline=await state(page),layouts=[];
 for(const size of [{width:1280,height:760},{width:980,height:620},{width:640,height:780},{width:1280,height:760}]){
  await page.setViewportSize(size);layouts.push(await fitCanvas(page));
  const s=await state(page);for(const name of ['runtimeId','map','progress'])assert.equal(s[name],baseline[name]);
  assert.equal((await rotationState(page)).noticeVisible,false);
  await shot(page,`desktop-${size.width}x${size.height}`);
 }
 await axis(page,'x',(await state(page)).x+25);
 record('RESIZE-01 desktop dynamic canvas and keyboard continuation',{fixture:'fresh title/intro start',layouts});await page.close();
}
async function rawTouch(page,id){
 const cdp=await page.context().newCDPSession(page);
 const send=async(type,point)=>{report.timeline.push({event:'cdp-touch-dispatch',type,id,point});await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{id,...point,radiusX:5,radiusY:5,force:1}]:[]});};
 return{start:p=>send('touchStart',p),move:p=>send('touchMove',p),end:()=>send('touchEnd')};
}
async function resizeHeldStick(size){
 const page=await newPage({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:size.width===844?2:1});
 await page.goto(base);await loaded(page);await freshPlay(page,true);await fitCanvas(page);
 const touch=await rawTouch(page,71),b=await page.locator('#exp-stick').boundingBox(),center={x:b.x+b.width/2,y:b.y+b.height/2},drag={x:center.x+32,y:center.y};
 const start=await state(page);await touch.start(center);await touch.move(drag);
 await wait(page,x=>Number(document.querySelector('#exp-root').dataset.x)>x+18,start.x);
 assert.equal((await rotationState(page)).input.pointers,1);
 report.timeline.push({event:'resize-with-active-stick-before-any-end',state:await state(page)});
 await page.setViewportSize({width:size.height,height:size.width});
 const locked=await assertRotationLock(page,1);await shot(page,`stick-${size.width}-held-portrait`);
 await page.keyboard.press('Escape');assert.equal((await state(page)).view,'play');
 await page.setViewportSize(size);const layout=await fitCanvas(page),restored=await state(page);
 assert.equal((await rotationState(page)).noticeVisible,false);assert.equal(restored.tokens,0);
 for(const name of ['runtimeId','map','progress'])assert.equal(restored[name],start[name]);
 await touch.move(drag);await touch.end();await frames(page);
 const afterTail=await state(page);assert.equal(afterTail.x,restored.x);assert.equal(afterTail.y,restored.y);assertEmptyInput(await rotationState(page));
 await touch.start(center);await touch.move(drag);await wait(page,x=>Number(document.querySelector('#exp-root').dataset.x)>x+18,afterTail.x);await touch.end();
 await shot(page,`stick-${size.width}-restored-new-gesture`);
 record(`RESIZE-01 ${size.width} held joystick rotation clears input, freezes tick, rejects old tail and accepts new gesture`,{fixture:'fresh title/intro start',locked,layout,restored,afterTail});await page.close();
}
async function resizeHeldPreview(size){
 const page=await currentPage(fixture('riverView'),size,true);
 // Settle the existing location discovery via a normal preview return first.
 await interact(page,'view');await page.locator('#exp-photo-close').tap();await frames(page);
 assert.equal((await state(page)).completed,'true');
 await interact(page,'view');await wait(page,()=>document.activeElement.id==='exp-photo-close');
 const baseline=await state(page),touch=await rawTouch(page,81),b=await page.locator('#exp-photo-close').boundingBox(),point={x:b.x+b.width/2,y:b.y+b.height/2};
 assert.equal(baseline.photographed,'false');assert.equal(JSON.parse(baseline.progress).counts.rewards,0);
 await touch.start(point);report.timeline.push({event:'resize-with-photo-close-held-before-any-end',state:await state(page)});
 await page.setViewportSize({width:size.height,height:size.width});const locked=await assertRotationLock(page,2);
 await shot(page,`preview-${size.width}-held-portrait`);
 await page.setViewportSize(size);const layout=await fitCanvas(page);
 await touch.end();await frames(page);const tail=await state(page);
 for(const name of ['runtimeId','previewId','progress','photographed','cardOpen'])assert.equal(tail[name],baseline[name]);
 assert.equal(tail.tokens,1);assert.equal((await rotationState(page)).focus,'exp-photo-close');
 await shot(page,`preview-${size.width}-restored-old-release`);
 await page.locator('#exp-photo-close').tap();assert.equal((await state(page)).preview,'');assert.equal((await state(page)).progress,baseline.progress);assert.equal((await state(page)).photographed,'false');
 record(`RESIZE-01 ${size.width} held preview return rotation preserves preview and rejects old release; fresh tap returns`,{fixture:'legal inline riverView save with accepted/clue/item/unlocked; discovery settled before baseline; not fresh route',baseline,locked,layout,tail});await page.close();
}
async function resizeProbe(){
 for(const size of [{width:844,height:390},{width:667,height:375}])await resizeStartup(size);
 await resizeDesktop();report.layers.desktopChrome='PASS';
 for(const size of [{width:844,height:390},{width:667,height:375}]){await resizeHeldStick(size);await resizeHeldPreview(size);}
 report.layers.touchEmulation='PASS';
}

async function settleIntro(page){
 await page.locator('.exp-intro-story').evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})));});
 await frames(page,2);
}
async function keyboardActivate(page,id){
 for(let i=0;i<30;i++){
  if(await page.evaluate(id=>document.activeElement.id===id,id)){await page.keyboard.press('Enter');return;}
  await page.keyboard.press('Tab');
 }
 throw Error('Keyboard could not reach '+id);
}
async function pausedAt(page,view,tokens,focus,baseline){
 const s=await state(page);assert.equal(s.view,view);assert.equal(s.tokens,tokens);assert.equal(s.paused,'true');
 if(focus)assert.equal(await page.evaluate(()=>document.activeElement.id),focus);
 await frames(page);const next=await state(page);assert.equal(next.tick,s.tick);
 if(baseline)for(const name of ['runtimeId','map','progress','tick'])assert.equal(s[name],baseline[name]);
 return s;
}
async function pauseRoute(size,touch,withHeldMenu=false){
 const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
 let held;
 const cdp=touch?await page.context().newCDPSession(page):undefined;
 const point=(id,p)=>({id,...p,radiusX:5,radiusY:5,force:1});
 const dispatch=async(type,points)=>{report.timeline.push({event:'pause-cdp-touch',type,points});await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});};
 const press=async id=>{
  if(!touch)return keyboardActivate(page,id);
  if(!held)return page.locator('#'+id).tap();
  const b=await page.locator('#'+id).boundingBox(),p=point(92,{x:b.x+b.width/2,y:b.y+b.height/2});
  report.timeline.push({event:'secondary-touch-hit',id,box:b,point:p,hit:await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.id,p)});
  await dispatch('touchStart',[held,p]);await dispatch('touchEnd',[p]);await frames(page,2);
 };
 await page.goto(base);await loaded(page);await fitCanvas(page);
 const initial=await state(page);
 await press('exp-instructions');await pausedAt(page,'help',2,'exp-instructions-close',initial);
 await shot(page,`pause-${size.width}-title-help`);await press('exp-instructions-close');
 await pausedAt(page,'title',1,'exp-instructions',initial);
 await press('exp-begin');await settleIntro(page);await shot(page,`pause-${size.width}-intro-settled`);
 await press('exp-intro-start');await press('exp-onboarding-skip');
 const start=await state(page);
 if(touch){
  const b=await page.locator('#exp-stick').boundingBox(),center=point(91,{x:b.x+b.width/2,y:b.y+b.height/2});held={...center,x:center.x+32};
  await dispatch('touchStart',[center]);await dispatch('touchMove',[held]);
 }else await page.keyboard.down('KeyD');
 await wait(page,x=>Number(document.querySelector('#exp-root').dataset.x)>x+18,start.x);
 if(touch&&!withHeldMenu){await dispatch('touchEnd',[]);held=undefined;}
 if(touch)await press('exp-menu-button');else await page.keyboard.press('Escape');
 const parent=await pausedAt(page,'menu',1,'exp-resume');assertEmptyInput(await rotationState(page));
 if(touch&&withHeldMenu){await dispatch('touchEnd',[]);held=undefined;await pausedAt(page,'menu',1,'exp-resume',parent);}
 const ownerCounts=[1];
 for(const [open,view,close] of [['exp-menu-journal','journal','exp-notes-close'],['exp-menu-help','help','exp-instructions-close']]){
  await press(open);await pausedAt(page,view,2,close,parent);ownerCounts.push(2);
  await shot(page,`pause-${size.width}-${view}`);
  if(touch&&view==='journal'){
   await page.setViewportSize({width:size.height,height:size.width});await assertRotationLock(page,3);ownerCounts.push(3);
   await shot(page,`pause-${size.width}-journal-portrait`);await page.setViewportSize(size);await fitCanvas(page);
   await pausedAt(page,view,2,close,parent);ownerCounts.push(2);
  }
  if(!touch)await page.keyboard.down('KeyD'); // Repeated held key cannot restart movement in a child.
  await frames(page);assert.equal((await state(page)).tick,parent.tick);
  if(!touch&&view==='journal')await page.keyboard.press('Escape');else await press(close);
  await pausedAt(page,'menu',1,open,parent);ownerCounts.push(1);
 }
 await shot(page,`pause-${size.width}-returned-parent`);await press('exp-resume');ownerCounts.push(0);
 const resumed=await state(page);assert.equal(resumed.tokens,0);assert.equal(resumed.view,'play');
 if(touch&&held){await dispatch('touchMove',[held]);await dispatch('touchEnd',[]);held=undefined;}else if(!touch){await page.keyboard.down('KeyD');await page.keyboard.up('KeyD');}
 await frames(page);const tail=await state(page);assert.equal(tail.x,resumed.x);assert.equal(tail.y,resumed.y);assertEmptyInput(await rotationState(page));
 if(touch)await touchPort(page);
 await axis(page,'x',tail.x+25);assert.ok((await state(page)).tick>parent.tick);
 await press('exp-menu-button');const beforeTitle=await state(page);await press('exp-title');
 await pausedAt(page,'title',1,'exp-begin');
 assert.equal((await state(page)).runtimeId,beforeTitle.runtimeId);assert.equal((await state(page)).progress,beforeTitle.progress);
 await press('exp-begin');const continued=await state(page);assert.equal(continued.view,'play');assert.equal(continued.tokens,0);
 assert.equal(continued.runtimeId,beforeTitle.runtimeId);assert.equal(continued.progress,beforeTitle.progress);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'exp-root');
 await shot(page,`pause-${size.width}-continued`);
 record(`PAUSE-01 ${size.width} title help, nested journal/help, input clear and title continuation`,{fixture:'fresh empty storage; normal title/intro start',parent,ownerCounts,continued,pointerEvents:touch?await page.evaluate(()=>window.__pointerEvents):undefined});
 if(touch&&!withHeldMenu){
  const raw=await rawTouch(page,95),b=await page.locator('#exp-stick').boundingBox(),center={x:b.x+b.width/2,y:b.y+b.height/2},drag={x:center.x+32,y:center.y},initial=await state(page);
  await raw.start(center);await raw.move(drag);await wait(page,x=>Number(document.querySelector('#exp-root').dataset.x)>x+18,initial.x);
  await page.keyboard.press('Escape');await keyboardActivate(page,'exp-menu-journal');const child=await pausedAt(page,'journal',2,'exp-notes-close');
  await page.keyboard.press('Escape');await pausedAt(page,'menu',1,'exp-menu-journal',child);await keyboardActivate(page,'exp-resume');
  const resumed=await state(page);await raw.move({...drag,x:drag.x+12});await raw.end();await frames(page);
  const tail=await state(page);assert.equal(tail.x,resumed.x);assert.equal(tail.y,resumed.y);assertEmptyInput(await rotationState(page));
  await axis(page,'x',tail.x+25);
  record(`PAUSE-01 ${size.width} retained touch tail after nested panel is inert; new gesture moves`,{fixture:'additional mixed-input diagnostic on same fresh journey; native keyboard switches panels while CDP joystick remains held',child,resumed,tail});
 }
 await page.close();
}
async function pausePhoto(size,touch){
 const page=await currentPage(fixture('riverView'),size,touch);
 const press=id=>touch?page.locator('#'+id).tap():keyboardActivate(page,id);
 await interact(page,'view');await press('exp-photo-close');await frames(page);assert.equal((await state(page)).completed,'true');
 const baseline=await state(page);await interact(page,'view');await press('exp-photo-menu');
 const menu=await pausedAt(page,'menu',1,'exp-resume');assert.equal(menu.preview,'');assert.equal(menu.photographed,'false');assert.equal(menu.progress,baseline.progress);
 await shot(page,`photo-${size.width}-pause-without-preview`);await press('exp-resume');assert.equal((await state(page)).preview,'');
 await interact(page,'view');await press('exp-shutter');const captured=await state(page);
 assert.equal(captured.cardOpen,'true');assert.equal(captured.tokens,1);assert.equal(captured.photographed,'true');assert.equal(JSON.parse(captured.progress).counts.rewards,1);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'exp-card-close');await shot(page,`photo-${size.width}-completion`);
 await press('exp-card-close');assert.equal((await state(page)).view,'play');assert.equal((await state(page)).tokens,0);
 await interact(page,'view');await press('exp-shutter');assert.equal((await state(page)).progress,captured.progress);
 await press('exp-card-title');await pausedAt(page,'title',1,'exp-begin');assert.equal((await state(page)).progress,captured.progress);
 await press('exp-begin');assert.equal((await state(page)).runtimeId,captured.runtimeId);assert.equal((await state(page)).progress,captured.progress);assert.equal((await state(page)).tokens,0);
 await shot(page,`photo-${size.width}-continued`);
 record(`PAUSE-01 ${size.width} preview to pause cancels without photo, new shutter, completion continue/title and reward idempotency`,{fixture:'legal inline riverView accepted/clue/item/unlocked save; normal discovery return before baseline; not fresh route',baseline,menu,captured});await page.close();
}
async function pauseSecondaryTouch(size){
 const page=await newPage({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:1});await page.goto(base);await loaded(page);await freshPlay(page,true);
 const cdp=await page.context().newCDPSession(page),events=[];
 const point=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5,force:1});
 const send=async(type,points)=>{events.push({type,points});await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});};
 const b=await page.locator('#exp-stick').boundingBox(),center=point(91,b.x+b.width/2,b.y+b.height/2),hold={...center,x:center.x+32};
 const m=await page.locator('#exp-menu-button').boundingBox(),button=point(92,m.x+m.width/2,m.y+m.height/2),outside={...button,x:button.x-90};
 const hit=await page.evaluate(p=>({id:document.elementFromPoint(p.x,p.y)?.closest('button')?.id}),button);assert.equal(hit.id,'exp-menu-button');
 const start=async()=>{const s=await state(page);await send('touchStart',[center]);await send('touchMove',[hold]);await wait(page,x=>Number(document.querySelector('#exp-root').dataset.x)>x+12,s.x);await send('touchStart',[hold,button]);};
 await start();await send('touchMove',[hold,outside]);await send('touchEnd',[outside]);await frames(page);assert.equal((await state(page)).view,'play');assert.equal((await state(page)).tokens,0);await send('touchEnd',[]);
 await start();await send('touchCancel',[]);await frames(page);assert.equal((await state(page)).view,'play');assert.equal((await state(page)).tokens,0);
 await start();await page.setViewportSize({width:size.height,height:size.width});await assertRotationLock(page,1);await page.setViewportSize(size);await fitCanvas(page);await send('touchEnd',[button]);await send('touchEnd',[]);await frames(page);assert.equal((await state(page)).view,'play');assert.equal((await state(page)).tokens,0);
 await start();await shot(page,`secondary-${size.width}-two-fingers-down`);await send('touchEnd',[button]);
  const menu=await pausedAt(page,'menu',1,'exp-resume');await send('touchEnd',[]);await pausedAt(page,'menu',1,'exp-resume',menu);
 assertEmptyInput(await rotationState(page));await shot(page,`secondary-${size.width}-menu-once`);
 const pointers=await page.evaluate(()=>window.__pointerEvents);
 const releases=pointers.filter(e=>e.type==='pointerup'&&e.button==='exp-menu-button'&&e.isPrimary===false);
 assert.ok(releases.some(e=>e.trusted&&e.x===button.x&&e.y===button.y));
  // CDP rejects releasing an already-ended touch. Separately inject duplicate UI
  // events only to test the host guard; real opening above remains trusted CDP.
  await page.evaluate(({id,x,y})=>{
   const button=document.querySelector('#exp-menu-button'),init={bubbles:true,pointerType:'touch',isPrimary:false,pointerId:id,clientX:x,clientY:y};
   button.dispatchEvent(new PointerEvent('pointerup',init));
   button.dispatchEvent(new PointerEvent('click',{...init,detail:1}));
  },{id:releases.at(-1).pointerId,x:button.x,y:button.y});
  await pausedAt(page,'menu',1,'exp-resume',menu);
 await page.locator('#exp-resume').tap();assert.equal((await state(page)).tokens,0);await touchPort(page);await axis(page,'x',(await state(page)).x+25);
  record(`PAUSE-01 ${size.width} secondary touch pauses once; outside, cancel, rotation and repeated release are inert`,{fixture:'fresh normal title/intro; CDP simultaneous joystick and pause finger',duplicateEventLayer:'Supplementary synthetic pointerup and late click on same ended pointer; CDP forbids a second native touchEnd',menuBounds:m,button,hit,events,pointers,menu});await page.close();
}
async function pauseMouse(){
 const page=await newPage({viewport:{width:1280,height:760}});await page.goto(base);await loaded(page);await freshPlay(page,false);
 await page.locator('#exp-menu-button').click();const parent=await pausedAt(page,'menu',1,'exp-resume');
 await page.locator('#exp-menu-help').click();await pausedAt(page,'help',2,'exp-instructions-close',parent);
 await page.locator('#exp-instructions-close').click();await pausedAt(page,'menu',1,'exp-menu-help',parent);
 await page.locator('#exp-resume').click();assert.equal((await state(page)).tokens,0);
 record('PAUSE-01 original mouse click menu and nested help path retained');await page.close();
}
async function pauseProbe(){
 for(const [size,touch] of [[{width:1280,height:760},false],[{width:844,height:390},true],[{width:667,height:375},true]]){
  await pauseRoute(size,touch);await pausePhoto(size,touch);
 }
 await pauseMouse();
 for(const size of [{width:844,height:390},{width:667,height:375}])await pauseSecondaryTouch(size);
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

const ARCHIVE_CURRENT='pokan.exp06a.save.v1',ARCHIVE_05B='pokan.exp05b.save.v1',ARCHIVE_05A='pokan.exp05a.save.v1',ARCHIVE_OTHER='save01.unrelated';
function archiveFixture(current){
 const oldB={...fixture('guideDoor'),contentVersion:EXP05B_CONTENT_VERSION},oldA={...fixture('guideDoor'),contentVersion:EXP05A_CONTENT_VERSION};
 assert.ok(migrateExp05BSave(oldB));assert.ok(migrateExp05ASave(oldA));
 return{[ARCHIVE_CURRENT]:current,[ARCHIVE_05B]:JSON.stringify(oldB,null,2),[ARCHIVE_05A]:JSON.stringify(oldA),
  'pokan.exp01.save.v1':'historical courtyard bytes\r\nretain', [ARCHIVE_OTHER]:'unrelated bytes · 保留\n'};
}
async function archivePage(records,fault,touch=false){
 const page=await newPage({viewport:touch?{width:667,height:375}:{width:1280,height:760},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
 await page.addInitScript(({records,fault,sentinel,current})=>{
  const storage=window.localStorage,get=Storage.prototype.getItem,set=Storage.prototype.setItem;
  if(get.call(storage,sentinel)===null)for(const [key,value] of Object.entries(records))if(value!==null)set.call(storage,key,value);
  window.__archiveReads=[];window.__archiveWrites=[];window.__archiveGetterThrows=0;
  window.__archiveSnapshot=()=>Object.fromEntries(Object.keys(records).map(key=>[key,get.call(storage,key)]));
  Storage.prototype.getItem=function(key){if(this===storage)window.__archiveReads.push(key);return get.call(this,key);};
  Storage.prototype.setItem=function(key,value){
   const entry={key,value,outcome:'attempt'};if(this===storage)window.__archiveWrites.push(entry);
   if(this===storage&&fault==='write'&&key===current){entry.outcome='injected-rejection';throw new DOMException('SAVE-01 current-key write injection','QuotaExceededError');}
   const result=set.call(this,key,value);entry.outcome='saved';return result;
  };
  if(fault==='getter')Object.defineProperty(window,'localStorage',{configurable:true,get(){window.__archiveGetterThrows++;throw new DOMException('SAVE-01 getter injection','SecurityError');}});
 },{records,fault,sentinel:ARCHIVE_OTHER,current:ARCHIVE_CURRENT});
 await page.goto(base);await loaded(page);await fitCanvas(page);if(touch)await touchPort(page);return page;
}
const archiveBytes=page=>page.evaluate(()=>window.__archiveSnapshot());
const archiveLogs=page=>page.evaluate(()=>({reads:window.__archiveReads,writes:window.__archiveWrites,getterThrows:window.__archiveGetterThrows}));
const archivePress=(page,touch)=>id=>touch?page.locator('#'+id).tap():keyboardActivate(page,id);
async function archiveFreshJourney(page,touch){
 const press=archivePress(page,touch);await press('exp-begin');await settleIntro(page);await press('exp-intro-start');await press('exp-onboarding-skip');
 const before=await state(page);await follow(page,'city-to-entry',touch);await interact(page,'city-to-entry');
 await follow(page,'visitor',touch);await interact(page,'visitor');await press('exp-close');
 const after=await state(page);assert.ok(Number(after.revision)>Number(before.revision));assert.notEqual(after.safe,before.safe);assert.equal(after.accepted,'true');assert.equal(after.clue,'false');return{before,after};
}
async function archiveBlocked(kind,touch){
 const records=archiveFixture(kind==='json'?'{broken-current-json':kind==='future'?JSON.stringify({...emptyExplorationSave(),schemaVersion:999}):null);
 if(kind==='history')records[ARCHIVE_05B]=JSON.stringify({...JSON.parse(records[ARCHIVE_05B]),safe:'not-a-valid-historical-safe'});
 const page=await archivePage(records,undefined,touch),initial=await state(page),bytes=await archiveBytes(page);
 assert.equal(initial.hasJourney,'false');assert.equal(initial.accepted,'false');assert.equal(initial.safe,'chapterStart');
 assert.match(await page.locator('#exp-title-status').innerText(),/未保存.*原.*保留/);
 await shot(page,`blocked-${kind}-title`);
 const journey=await archiveFreshJourney(page,touch);
 assert.match(await page.locator('#exp-save').innerText(),/本次未保存/);
 assert.deepEqual(await archiveBytes(page),bytes);
 const logs=await archiveLogs(page);assert.deepEqual(logs.writes,[]);
 assert.deepEqual(logs.reads,kind==='history'?[ARCHIVE_CURRENT,ARCHIVE_05B]:[ARCHIVE_CURRENT]);
 await shot(page,`blocked-${kind}-after-real-save-boundaries`);
 record(`SAVE-01 ${kind} blocks fallback and preserves bytes after real map/discovery save boundaries`,{fixture:'isolated initial raw records; older 05B/05A fixtures prevalidated in Node; actual UI keyboard/touch route',touch,records,initial,journey,logs,bytes});await page.close();
}
async function archiveFailedConfirm(page,touch,source,name){
 const press=archivePress(page,touch),baseline=await state(page);
 await press(source==='title'?'exp-title-restart':'exp-restart');
 assert.equal((await state(page)).view,'confirm');assert.equal(await page.evaluate(()=>document.activeElement.id),'exp-cancel-restart');
 await press('exp-confirm-restart');await frames(page);
 const failed=await state(page);assert.equal(failed.view,'confirm');assert.equal(failed.tokens,2);
 for(const key of ['runtimeId','progress','safe','photographed','revision'])assert.equal(failed[key],baseline[key]);
 assert.match(await page.locator('#exp-restart-status').innerText(),/无法写入新局.*未重新开始/);
 await shot(page,`${name}-${source}-restart-rejected`);await press('exp-cancel-restart');
 assert.equal((await state(page)).view,source==='title'?'title':'menu');
 assert.equal(await page.evaluate(()=>document.activeElement.id),source==='title'?'exp-title-restart':'exp-restart');
 assert.equal(await page.locator('#exp-restart-status').textContent(),'');
 return{baseline,failed};
}
async function archiveFault(fault,touch){
 const value=fixture('riverView',true);assert.ok(validateExplorationSave(value));
 const records=archiveFixture(JSON.stringify(value,null,2)),page=await archivePage(records,fault,touch),bytes=await archiveBytes(page),press=archivePress(page,touch);
 const initial=await state(page);
 if(fault==='getter'){assert.equal(initial.hasJourney,'false');assert.match(await page.locator('#exp-title-status').innerText(),/不可读取/);}
 else{assert.equal(initial.hasJourney,'true');assert.equal(initial.photographed,'true');assert.equal(initial.progress,JSON.stringify(value.progress));}
 const titleFailure=await archiveFailedConfirm(page,touch,'title',fault);
 let journey;
 if(fault==='getter')journey=await archiveFreshJourney(page,touch);
 else{
  await press('exp-begin');const before=await state(page);await interact(page,'view');await press('exp-photo-close');
  const after=await state(page);assert.ok(Number(after.revision)>Number(before.revision));journey={before,after};
 }
 assert.match(await page.locator('#exp-save').innerText(),/本次未保存/);
 await press('exp-menu-button');const gameFailure=await archiveFailedConfirm(page,touch,'play',fault);
 assert.match(await page.locator('#exp-menu-save').innerText(),/本次未保存/);
 assert.deepEqual(await archiveBytes(page),bytes);
 const logs=await archiveLogs(page);
 if(fault==='getter'){assert.ok(logs.getterThrows>0);assert.deepEqual(logs.reads,[]);assert.deepEqual(logs.writes,[]);}
 else{assert.ok(logs.writes.length>=3);assert.ok(logs.writes.every(e=>e.key===ARCHIVE_CURRENT&&e.outcome==='injected-rejection'));}
 await press('exp-resume');assert.equal((await state(page)).tokens,0);assert.match(await page.locator('#exp-save').innerText(),/本次未保存/);
 record(`SAVE-01 ${fault} injection keeps play usable and title/game restart failure in confirmation without archive loss`,{faultLayer:'isolated harness injection; not real browser permissions or quota acceptance',touch,records,initial,titleFailure,journey,gameFailure,logs,bytes});await page.close();
}
async function archiveRestart(source,touch){
 const value=fixture('riverView',true);assert.ok(validateExplorationSave(value));
 const records=archiveFixture(JSON.stringify(value,null,2)),page=await archivePage(records,undefined,touch),press=archivePress(page,touch);
 if(source==='play'){await press('exp-begin');await press('exp-menu-button');}
 const baseline=await state(page),bytes=await archiveBytes(page),opener=source==='title'?'exp-title-restart':'exp-restart';
 await press(opener);assert.equal((await state(page)).view,'confirm');assert.equal(await page.evaluate(()=>document.activeElement.id),'exp-cancel-restart');
 if(touch)await press('exp-cancel-restart');else await page.keyboard.press('Escape');
 assert.equal((await state(page)).view,source==='title'?'title':'menu');assert.equal(await page.evaluate(()=>document.activeElement.id),opener);
 assert.equal((await state(page)).runtimeId,baseline.runtimeId);assert.equal((await state(page)).progress,baseline.progress);assert.deepEqual(await archiveBytes(page),bytes);
 await shot(page,`restart-${touch?'touch':'keyboard'}-${source}-cancel`);
 await press(opener);await Promise.all([page.waitForEvent('domcontentloaded'),press('exp-confirm-restart')]);await loaded(page);
 const fresh=await state(page),after=await archiveBytes(page),empty=emptyExplorationSave();
 assert.notEqual(fresh.runtimeId,baseline.runtimeId);assert.equal(fresh.safe,'chapterStart');assert.equal(fresh.map,'plaza');assert.equal(fresh.progress,JSON.stringify(empty.progress));assert.equal(fresh.photographed,'false');
 assert.deepEqual(JSON.parse(after[ARCHIVE_CURRENT]),empty);assert.deepEqual(Object.keys(JSON.parse(after[ARCHIVE_CURRENT])).sort(),Object.keys(empty).sort());
 for(const key of Object.keys(records).filter(k=>k!==ARCHIVE_CURRENT))assert.equal(after[key],bytes[key]);
 assert.deepEqual((await archiveLogs(page)).reads,[ARCHIVE_CURRENT]);
 await page.reload();await loaded(page);const refreshed=await state(page);assert.equal(refreshed.safe,'chapterStart');assert.equal(refreshed.progress,JSON.stringify(empty.progress));assert.deepEqual(await archiveBytes(page),after);assert.deepEqual((await archiveLogs(page)).reads,[ARCHIVE_CURRENT]);
 await shot(page,`restart-${touch?'touch':'keyboard'}-${source}-fresh-reloaded`);
 await press('exp-begin');assert.equal((await state(page)).view,'play');assert.equal((await state(page)).photographed,'false');assert.equal((await state(page)).progress,JSON.stringify(empty.progress));
 if(touch)await touchPort(page);await axis(page,'x',(await state(page)).x+15);
 const final=await archiveBytes(page);for(const key of Object.keys(records).filter(k=>k!==ARCHIVE_CURRENT))assert.equal(final[key],bytes[key]);
 assert.ok((await archiveLogs(page)).writes.every(e=>e.key===ARCHIVE_CURRENT&&e.outcome==='saved'));
 record(`SAVE-01 ${touch?'touch':'keyboard'} ${source} nonempty restart cancel focus, confirm only current and reload does not remigrate`,{fixture:'isolated valid nonempty photographed current save plus valid historical records and unrelated bytes; no runtime mutation',baseline,bytes,fresh,refreshed,after,final,logs:await archiveLogs(page)});await page.close();
}
async function saveProbe(){
 await archiveBlocked('json',false);await archiveBlocked('future',true);await archiveBlocked('history',false);
 await archiveFault('getter',false);await archiveFault('write',true);
 for(const touch of [false,true])for(const source of ['title','play'])await archiveRestart(source,touch);
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

async function styleRoute(size,touch){
 const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
 const press=id=>page.locator(`#${id}`)[touch?'tap':'click']();
 const capture=name=>shot(page,`${size.width}x${size.height}-${name}`);
 await page.goto(base);await loaded(page);
 assert.equal((await state(page)).view,'title');
 assert.equal((await state(page)).hasJourney,'false');
 assert.equal((await state(page)).safe,'chapterStart');
 assert.match(await page.locator('#exp-begin').innerText(),/开始冒险/);
 if(touch)await touchPort(page);
 await capture('title');
 await press('exp-begin');
 assert.equal((await state(page)).view,'intro');
 assert.match(await page.locator('#exp-intro').innerText(),/沧白路栏边/);
 await settleIntro(page);await capture('intro');
 await press('exp-intro-start');
 const started=Date.now();
 await capture('plaza');
 await completeTutorial(page,press);

 const steps=[
  ['city-to-entry','entry'],['visitor','visitor',true],['entry-to-core','upper'],
  ['guide-door','guide-room'],['note','guide-note',true],['guide-upper-exit'],
  ['workshop-upper-door','workshop-room'],['plaque','plaque',true],['workshop-upper-exit'],
  ['east-down','middle'],['gate','gate',true],['middle-east-lower','lower'],['riverfront-down','river'],
 ];
 for(const [target,screen,confirm] of steps){
  await follow(page,target,touch);
  await interact(page,target);
  if(confirm)await press('exp-close');
  if(target==='gate'){
   await page.locator('#exp-gate-feedback').waitFor({state:'visible'});
   const feedback=await page.locator('#exp-gate-feedback').evaluate(e=>{
    const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const range=document.createRange();range.selectNodeContents(e.querySelector('span'));
    return{box:rect(e),card:rect(document.querySelector('.exp-location')),nav:rect(document.querySelector('.exp-hud nav')),
     span:rect(e.querySelector('span')),textLines:range.getClientRects().length,text:e.innerText,
     role:e.getAttribute('role'),pointerEvents:getComputedStyle(e).pointerEvents};
   });
   assert.equal(feedback.role,'status');assert.equal(feedback.pointerEvents,'none');
   assert.equal(feedback.text,'江纹栈门已开\n两端外阶与木作1F门，现在可以通行。');
   assert.equal(await page.locator('#exp-auto-walk').isVisible(),true);
   if(touch){
    assert.ok(Math.abs(feedback.box.y-feedback.card.bottom-6)<1,JSON.stringify(feedback));
    assert.ok(Math.abs(feedback.box.x-feedback.card.x)<1);
    assert.equal(feedback.textLines,1);
    assert.ok(feedback.span.right<=feedback.box.right-8);
    assert.ok(feedback.box.bottom<size.height);
    assert.ok(feedback.box.right<feedback.nav.x);
   }else{
    assert.ok(Math.abs(feedback.box.y-130)<1);
    assert.ok(Math.abs(feedback.box.x+feedback.box.width/2-size.width/2)<1);
   }
   record(`NAV-01 ${size.width}x${size.height} gate feedback`,feedback);
  }
  if(screen)await capture(screen);
 }
 await follow(page,'view',touch);
 await interact(page,'view');
 await wait(page,()=>document.activeElement?.id==='exp-photo-close');
 const previewLayout=await page.locator('#exp-photo').evaluate(panel=>{
  const box=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
  const shutter=panel.querySelector('#exp-shutter'),close=panel.querySelector('#exp-photo-close');
  return{coarse:matchMedia('(pointer:coarse)').matches,instructions:panel.querySelector('#exp-photo-instructions').innerText,
   focus:document.activeElement.id,image:box(panel.querySelector('#exp-photo-image')),requirement:box(panel.querySelector('#exp-photo-requirement')),
   controls:[shutter,panel.querySelector('#exp-photo-menu'),close].map(box),
   shutterBackground:getComputedStyle(shutter).background,closeBackground:getComputedStyle(close).background};
 });
 assert.equal(previewLayout.coarse,touch);assert.equal(previewLayout.focus,'exp-photo-close');
 assert.notEqual(previewLayout.shutterBackground,previewLayout.closeBackground);
 assert.match(previewLayout.instructions,/拍摄这一刻/);
 if(touch){
  assert.doesNotMatch(previewLayout.instructions,/E|空格/);
  assert.match(previewLayout.instructions,/返回探索/);
  await page.getByRole('button',{name:'返回探索',exact:true}).waitFor({state:'visible'});
 }else{
  assert.match(previewLayout.instructions,/E／空格/);
  await page.getByRole('button',{name:'返回探索 · E',exact:true}).waitFor({state:'visible'});
 }
 for(const box of previewLayout.controls)assert.ok(box.height>=48&&box.top>=0&&box.bottom<=size.height&&box.left>=0&&box.right<=size.width,JSON.stringify(previewLayout));
 assert.ok(previewLayout.image.height>0&&previewLayout.image.top>=previewLayout.requirement.bottom&&previewLayout.image.bottom<=previewLayout.controls[0].top,JSON.stringify(previewLayout));
 await capture('photo-preview');
 const unshot=await state(page);
 assert.equal(unshot.photographed,'false');assert.equal(JSON.parse(unshot.progress).counts.rewards,0);
 // Closing the existing view commits the original location-found goal, not a photo.
 const foundProgress=JSON.parse(unshot.progress);
 if(!foundProgress.goals.includes(P.completed)){foundProgress.goals.push(P.completed);foundProgress.counts.goals++;}
 for(const action of touch?['touch-return']:['KeyE','Space']){
  if(touch)await press('exp-photo-close');else await key(page,action);
  await page.locator('#exp-photo').waitFor({state:'hidden'});
  const returned=await state(page);
  assert.equal(returned.photographed,'false');assert.equal(returned.cardOpen,'false');assert.deepEqual(JSON.parse(returned.progress),foundProgress);
  await interact(page,'view');
  await wait(page,()=>document.activeElement?.id==='exp-photo-close');
 }
 record(`UI-02 ${size.width}x${size.height} preview hints, focus and return without photo`,{previewLayout,returnActions:touch?['trusted touch return']:['native KeyE','native Space'],fixture:'fresh A route; no seeded save'});
 await press('exp-shutter');
 const completed=await state(page);
 assert.equal(completed.cardOpen,'true');
 assert.equal(completed.photographed,'true');
 assert.equal(completed.safe,'riverView');
 assert.equal(JSON.parse(completed.progress).counts.rewards,1);
 const scriptedDurationMs=Date.now()-started;
 const completionLayout=await page.locator('#exp-photo-card').evaluate(card=>{
  const box=selector=>{
   const {top,bottom,height}=card.querySelector(selector).getBoundingClientRect();
   return {top,bottom,height};
  };
  return {image:box('#exp-card-image'),footer:box('.exp-completion-footer'),note:box('.exp-completion-footer small'),panel:box('.exp-completion-card'),
   buttons:['#exp-card-close','#exp-card-title','#exp-card-restart'].map(box)};
 });
 assert.ok(completionLayout.image.height>=100&&completionLayout.image.top>=0&&
  completionLayout.image.bottom<=completionLayout.footer.top,JSON.stringify(completionLayout));
 assert.ok(completionLayout.note.bottom<=completionLayout.panel.bottom,JSON.stringify(completionLayout));
 for(const button of completionLayout.buttons)assert.ok(button.height>=48&&button.bottom<=completionLayout.panel.bottom,JSON.stringify(button));
 await capture('completion');
 await press('exp-card-title');
 assert.equal((await state(page)).view,'title');
 await press('exp-begin');
 assert.equal((await state(page)).view,'play');
 assert.equal((await state(page)).runtimeId,completed.runtimeId);
 await restore(page,'riverView',touch);
 const resumed=await state(page);
 assert.equal(resumed.view,'play');
 assert.equal(resumed.photographed,'true');
 assert.notEqual(resumed.runtimeId,completed.runtimeId);
 await capture('resumed');
 record(`${size.width}x${size.height} fresh tutorial, guided commission, photo, title and reload`,{
  device:touch?'Chrome touch emulation':'desktop Chrome keyboard',scriptedDurationMs,newPlayerDuration:'NOT RUN',completionLayout,
 });
 await page.close();
}

async function rideAcross(page,width,touch){
 const press=async id=>page.locator(`#${id}`)[touch?'tap':'click']();
 await follow(page,'ferry-out',touch);
 await shot(page,`dock-${width}`);
 await interact(page,'ferry-out');
 assert.equal((await state(page)).pending,'ferry-out');
 await press('exp-close');
 assert.equal((await state(page)).map,'riverfront');
 await wait(page,()=>Number(document.querySelector('#exp-root').dataset.ferryFraction)>.24);
 await shot(page,`ferry-${width}`);
 await press('exp-menu-button');
 const fraction=(await state(page)).ferryFraction;
 await page.waitForTimeout(180);
 assert.equal((await state(page)).ferryFraction,fraction);
 await press('exp-resume');
 await wait(page,()=>document.querySelector('#exp-root').dataset.map==='ridge');
 assert.equal((await state(page)).safe,'ridgeDock');
 await shot(page,`arrival-${width}`);
 await press('exp-menu-button');await press('exp-weather');
 assert.equal((await state(page)).weather,'rain');
 await wait(page,()=>Number(document.querySelector('#exp-stage').dataset.wetness)>.95);
 await shot(page,`rain-${width}`);
 await follow(page,'ridge-lookout',touch);
 await shot(page,`lookout-${width}`);
 await interact(page,'ridge-lookout');await press('exp-close');
 await restore(page,'ridgeLookout',touch);
 await press('exp-notes-toggle');await press('exp-track-bookmark');
 await follow(page,'ferry-back',touch);
 await interact(page,'ferry-back');await press('exp-close');
 await wait(page,()=>document.querySelector('#exp-root').dataset.map==='riverfront');
 await restore(page,'riverDock',touch);
 record(`${width} docks, paused ferry, ridge uphill, two light states, landmark and return/reload`,{touch});
}

async function journeyProbe(){
 const page=await newPage({viewport:{width:1280,height:760}});
 await page.goto(base);await loaded(page);await shot(page,'title');
 await page.locator('#exp-begin').click();await shot(page,'intro');
 await page.locator('#exp-intro-start').click();
 await completeTutorial(page,id=>page.locator(`#${id}`).click());
 await page.locator('#exp-auto-walk').click();
 await wait(page,()=>document.querySelector('#exp-root').dataset.autoWalk==='true');
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyD');
 await wait(page,()=>document.querySelector('#exp-stage').dataset.gait==='slow');
 assert.equal((await state(page)).autoWalk,'false');
 await page.keyboard.up('ShiftLeft');
 await wait(page,()=>document.querySelector('#exp-stage').dataset.gait==='brisk');
 await page.keyboard.up('KeyD');
 await page.locator('#exp-notes-toggle').click();
 assert.equal(await page.locator('#exp-track-sketch').isDisabled(),true);
 await shot(page,'journal');
 await page.locator('#exp-track-none').click();assert.equal((await state(page)).routePoints,'0');
 await page.locator('#exp-notes-toggle').click();await page.locator('#exp-track-main').click();
 await follow(page,'city-to-entry',false);await interact(page,'city-to-entry');
 await follow(page,'visitor',false);await interact(page,'visitor');await closeDialogue(page);
 assert.equal((await state(page)).accepted,'true');
 await shot(page,'entry');await page.close();
 record('Fresh opening, optional main tracking, disabled locked task, manual cancel and distinct slow/brisk motion');
 const locked=await currentPage(fixture('riverView'));
 await walk(locked,2180,1102);await interact(locked,'ferry-out');
 assert.equal((await state(locked)).pending,'');
 assert.match(await locked.locator('#exp-dialogue-text').innerText(),/等你拍好/);
 await closeDialogue(locked);assert.equal((await state(locked)).ferry,'');
 await shot(locked,'locked-dock');await locked.close();
 record('Locked crossing stays on the near bank before the photograph');
 for(const size of [{width:844,height:390},{width:667,height:375}]){
  const touchPage=await currentPage(fixture('riverView',true),size,true);
  await touchPage.locator('#exp-auto-walk').tap();
  const start=(await state(touchPage)).x;
  await axis(touchPage,'x',start-28);
  assert.equal((await state(touchPage)).autoWalk,'false');
  await rideAcross(touchPage,size.width,true);
  await touchPage.close();
 }
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

async function startChrome(){
 const profile=join(dir,'chrome-profile');await mkdir(profile);
 headlessProcess=spawn(selection.executablePath,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true});
 const endpoint=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Chrome CDP endpoint did not become available')),15000);
  let stderr='';
  headlessProcess.once('exit',code=>{clearTimeout(timer);reject(new Error(`Chrome exited before CDP attached (${code})`));});
  headlessProcess.once('error',error=>{clearTimeout(timer);reject(error);});
  headlessProcess.stderr.on('data',chunk=>{
   stderr=(stderr+String(chunk)).slice(-4096);
   const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
   if(match){clearTimeout(timer);resolve(match[1]);}
  });
 });
 return chromium.connectOverCDP(endpoint,{noDefaults:true});
}
try{
 browser=await startChrome();
 browser.on('disconnected',()=>report.timeline.push({event:'browser-disconnected',at:new Date().toISOString()}));
 headlessProcess.on('exit',(code,signal)=>report.timeline.push({event:'chrome-exit',code,signal,at:new Date().toISOString()}));
 browser.on('context',context=>{context.on('close',()=>report.timeline.push({event:'context-close',at:new Date().toISOString()}));context.on('page',page=>{page.on('close',()=>report.timeline.push({event:'page-close',at:new Date().toISOString()}));page.on('crash',()=>report.timeline.push({event:'page-crash',at:new Date().toISOString()}));});});
 const identityPage=await newPage();const identity=await identityPage.context().newCDPSession(identityPage);report.browser.actual=identifyBrowser(await identity.send('Browser.getVersion'));await identityPage.close();
 if(saveAcceptance)await saveProbe();
 else if(args.includes('--pause-multitouch-only')){for(const size of [{width:844,height:390},{width:667,height:375}])await pauseSecondaryTouch(size);report.layers.touchEmulation='PASS';}
 else if(pauseAcceptance)await pauseProbe();
 else if(resizeAcceptance)await resizeProbe();
 else if(styleAcceptance){
  await styleRoute({width:1280,height:760},false);report.layers.desktopChrome='PASS';
  for(const size of [{width:844,height:390},{width:667,height:375}])await styleRoute(size,true);
  report.layers.touchEmulation='PASS';
 }
 else if(args.includes('--journey-only'))await journeyProbe();
 else if(args.includes('--spatial-lower-only'))await spatialLower();
 else if(args.includes('--spatial-only'))await spatialFirst();
 else if(args.includes('--probe-only')){await touchBuildings();await dialogueProbe();await photoCloseProbe();await nativeFloorHidden();report.mainRoute='NOT RUN';}
 else{const page=await newPage({viewport:{width:1280,height:760}});await mainRoute(page);}
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.networkErrors,[]);record('C06 zero unexpected page, console or network errors and current execution fingerprints');
}catch(error){report.failure={message:String(error),stack:error.stack};console.error(error);if(active&&!active.isClosed()){try{await shot(active,'FAIL');report.failureState=await state(active);report.failurePointerEvents=await active.evaluate(()=>window.__pointerEvents??[]);}catch(e){report.evidenceError=String(e);}}}
finally{
 for(const c of contexts){try{await c.close();}catch(e){report.cleanup.contextError=String(e);}}report.cleanup.contexts=report.cleanup.contextError?'FAIL':'PASS';
 try{if(browser){const session=await browser.newBrowserCDPSession();await session.send('Browser.close');await browser.close();}report.cleanup.browser='PASS';}catch(e){report.cleanup.browser='FAIL';report.cleanup.error=String(e);}
 if(headlessProcess&&headlessProcess.exitCode===null&&headlessProcess.signalCode===null){
  await new Promise(resolve=>{const timer=setTimeout(resolve,1500);headlessProcess.once('exit',()=>{clearTimeout(timer);resolve();});});
  if(headlessProcess.exitCode===null&&headlessProcess.signalCode===null)headlessProcess.kill();
 }
 if(nativeBrowser){try{const session=await nativeBrowser.newBrowserCDPSession();await session.send('Browser.close');}catch{}await nativeBrowser.close().catch(()=>{});}if(nativeProcess){if(nativeProcess.exitCode===null)await new Promise(done=>{const timer=setTimeout(done,2000);nativeProcess.once('exit',()=>{clearTimeout(timer);done();});});if(nativeProcess.exitCode===null){nativeProcess.kill();await new Promise(done=>nativeProcess.once('exit',done));}report.cleanup.nativeChrome=nativeProcess.exitCode!==null||nativeProcess.signalCode!==null?'PASS':'FAIL';}
 if(localServer)await new Promise(done=>localServer.close(done));report.cleanup.server=localServer?'PASS':'EXTERNAL 4199 PRESERVED';report.cleanup.thirdParty='Phaser document-scope handlers reclaimed by page teardown; own AbortSignals checked separately.';report.finishedAt=new Date().toISOString();report.status=report.failure||Object.values(report.cleanup).includes('FAIL')?'FAIL':'PASS';await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));await writeFile(join(dir,'script-source.mjs'),await readFile('tests/exp-06a-browser.mjs'));await writeFile(join(dir,'report.sha256'),await sha(join(dir,'report.json')));console.log(report.status,report.task,dir);if(report.status==='FAIL')process.exitCode=1;
}
