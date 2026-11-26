import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';
import {PHOTO_METADATA} from '../src/core/exploration-photo.ts';
import {emptyExplorationSave} from '../src/core/exploration.ts';
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
const modes=['--probe-only','--spatial-only','--spatial-lower-only','--journey-only','--style-02a'];
if(!args.includes('--production')||args.some(a=>a!=='--production'&&!modes.includes(a)&&!a.startsWith('--browser='))||args.filter(a=>modes.includes(a)).length>1)throw new Error('Use --production --browser=chrome with at most one mode');
const styleAcceptance=args.includes('--style-02a');
const selection=resolveBrowserExecutable(parseBrowserSelection(args));
assert.equal(selection.id,'chrome');
const dir=resolve('test-results',styleAcceptance?'style-02a':'exp-06a',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:styleAcceptance?'STYLE-02A':args.includes('--journey-only')?'RIVER-JOURNEY-01':'EXP-06A',scope:styleAcceptance?'fresh-guided-A-to-D-keyboard-and-landscape-touch':args.includes('--journey-only')?'fresh-opening-and-ferry-keyboard-touch':args.includes('--spatial-lower-only')?'spatial-H1-fixture-look':args.includes('--spatial-only')?'spatial-first-look-keyboard':args.includes('--probe-only')?'c-district-touch-native-and-owned-gestures':'c-district-fresh-A-to-D-keyboard',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],consoleErrors:[],networkErrors:[],cleanup:{},hashes:{},protectedHashes:{},actualDist:{},historicalFailures:[],
  limitations:['True Android Chrome and iOS Safari were not available.','The completion card closes the existing Demo route; it does not prove a full 30-45 minute chapter.','Final art, culture review and real-device H5 acceptance remain separate.']};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
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
 await capture('intro');
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
 await capture('photo-preview');
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
 if(styleAcceptance){
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
