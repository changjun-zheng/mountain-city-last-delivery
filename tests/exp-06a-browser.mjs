import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P,EXP02B_PROGRESS_CONTENT as Q} from '../src/core/progress.ts';
import {PHOTO_METADATA} from '../src/core/exploration-photo.ts';
import {emptyExplorationSave,validateExplorationSave,migrateExp05ASave,migrateExp05BSave} from '../src/core/exploration.ts';
import {EXP05A_CONTENT_VERSION,EXP05B_CONTENT_VERSION} from '../src/core/exploration-content.ts';
import {MEMENTOS,MEMENTO_COMPLETION} from '../src/core/exploration-mementos.ts';
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
const modes=['--route03-only','--route03-mobile-only','--route02-only','--route02-mobile-only','--route-only','--load-baseline','--load-only','--help-only','--help-baseline','--probe-only','--spatial-only','--spatial-lower-only','--journey-only','--style-02a','--resize-only','--pause-only','--pause-multitouch-only','--save-only','--collection-only','--viewport-only','--photo-frame-only','--photo-frame-baseline'];
modes.push('--street-sign-only');
modes.push('--workshop-art-only');
modes.push('--start-only');
modes.push('--entry-art-only');
if(!args.includes('--production')||args.some(a=>a!=='--production'&&a!=='--panel-style'&&a!=='--wayfind'&&!modes.includes(a)&&!a.startsWith('--browser='))||args.filter(a=>modes.includes(a)).length>1)throw new Error('Use --production --browser=chrome with at most one mode');
const entryArtAcceptance=args.includes('--entry-art-only');
const startAcceptance=args.includes('--start-only');
const streetSignAcceptance=args.includes('--street-sign-only');
const workshopArtAcceptance=args.includes('--workshop-art-only');
const wayfindAcceptance=args.includes('--wayfind');
const route03Acceptance=args.includes('--route03-only')||args.includes('--route03-mobile-only');
const route02Acceptance=args.includes('--route02-only')||args.includes('--route02-mobile-only');
const routeAcceptance=args.includes('--route-only');
const loadAcceptance=args.includes('--load-only')||args.includes('--load-baseline');
const helpAcceptance=args.includes('--help-only')||args.includes('--help-baseline');
const styleAcceptance=args.includes('--style-02a');
const resizeAcceptance=args.includes('--resize-only');
const pauseAcceptance=args.includes('--pause-only')||args.includes('--pause-multitouch-only');
const saveAcceptance=args.includes('--save-only');
const collectionAcceptance=args.includes('--collection-only');
const viewportAcceptance=args.includes('--viewport-only');
const photoFrameBaseline=args.includes('--photo-frame-baseline');
const photoFrameAcceptance=photoFrameBaseline||args.includes('--photo-frame-only');
const selection=resolveBrowserExecutable(parseBrowserSelection(args));
assert.equal(selection.id,'chrome');
const dir=resolve('test-results',entryArtAcceptance?'art-03':startAcceptance?'start-01':workshopArtAcceptance?'art-01':streetSignAcceptance?'story-02':wayfindAcceptance?'wayfind-01':route03Acceptance?'route-03':route02Acceptance?'route-02':routeAcceptance?'route-01':loadAcceptance?'load-01':helpAcceptance?'help-01':photoFrameAcceptance?'photo-ui-01':viewportAcceptance?'viewport-01':collectionAcceptance?'collection-01':saveAcceptance?'save-01':pauseAcceptance?'pause-01':resizeAcceptance?'resize-01':styleAcceptance?'style-02a':'exp-06a',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:styleAcceptance?'STYLE-02A':args.includes('--journey-only')?'RIVER-JOURNEY-01':'EXP-06A',scope:styleAcceptance?'fresh-guided-A-to-D-keyboard-and-landscape-touch':args.includes('--journey-only')?'fresh-opening-and-ferry-keyboard-touch':args.includes('--spatial-lower-only')?'spatial-H1-fixture-look':args.includes('--spatial-only')?'spatial-first-look-keyboard':args.includes('--probe-only')?'c-district-touch-native-and-owned-gestures':'c-district-fresh-A-to-D-keyboard',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],consoleErrors:[],networkErrors:[],cleanup:{},hashes:{},protectedHashes:{},actualDist:{},historicalFailures:[],
  limitations:['True Android Chrome and iOS Safari were not available.','The completion card closes the existing Demo route; it does not prove a full 30-45 minute chapter.','Final art, culture review and real-device H5 acceptance remain separate.']};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
if(entryArtAcceptance){report.task='ART-03';report.scope='fresh opening to entry overlook, original rail blocker, east porch upper round-trip and refresh; no seeded storage or auto-follow';}
if(startAcceptance){report.task='START-01';report.scope='empty isolated archive; opening lesson to visitor acceptance, map round-trip and reload; native keyboard/CDP touch, no auto-follow';}
if(resizeAcceptance){report.task='RESIZE-01';report.scope='dynamic-canvas-and-held-touch-rotation; fresh-start plus separately labelled river fixture';}
if(pauseAcceptance){report.task='PAUSE-01';report.scope=args.includes('--pause-multitouch-only')?'additional held-stick plus second-finger menu diagnostic':'nested-pause-journal-help-title; fresh starts and separately labelled river photo fixture';}
if(saveAcceptance){report.task='SAVE-01';report.scope='isolated archive corruption, storage faults and explicit restart; fixture injection separate from real UI input';}
if(collectionAcceptance){report.task='COLLECTION-01';report.scope='three optional souvenir routes using journal navigation and physical keyboard/CDP joystick; legal unlocked fixture only at start';}
if(viewportAcceptance){report.task='VIEWPORT-01';report.scope='fresh title/lesson/visitor to upper guide, short-landscape west-stair return; screenshot and screen-boundary review';}
if(photoFrameAcceptance){report.task='PHOTO-UI-01';report.scope=photoFrameBaseline?'old geometry measurement only; new frame ratio acceptance NOT RUN':'legal tea fixture, physical walk to failed window view, uncropped frame and usable feedback/actions';}
if(helpAcceptance){report.task='HELP-01';report.scope=args.includes('--help-baseline')?'ordinary-entry pre-fix geometry reproduction':'fresh title and pause help, device instructions and replay without archive change';}
if(loadAcceptance){report.task='LOAD-01';report.scope='JS-started scene image latch and explicit 404, isolated contexts; fresh success and legal nonempty archive recovery';report.injectedErrors=[];report.preFixDefects=[];}
if(routeAcceptance){report.task='ROUTE-01';report.scope='accepted-only legal cArrival fixture; manual explicit keyboard/CDP joystick route, no follow or runtime progress writes';}
if(route02Acceptance){report.task='ROUTE-02';report.scope='equipped closed-gate cWood3Door fixture; explicit real keyboard/CDP steps to 2F, middle gate, east lower stair, return and reload; read-only viewport diagnostics enabled';}
if(streetSignAcceptance){report.task='STORY-02';report.scope='ordinary production entry; legal equipped but closed cGuideH3 fixture; native keyboard / trusted CDP joystick, no follow or runtime writes; upper sign, real gate confirmation, upper sign, lower and reload, upper sign again';}
if(workshopArtAcceptance){report.task='ART-01';report.scope='ordinary production entry; legal cWood3Door clue/no-clasp fixture; same-standpoint workshop 3F/2F route with native keyboard or trusted CDP, real screen/table collisions, pickup, stair return, middle exit and reload; visual quality reviewed separately';}
if(route03Acceptance){report.task='ROUTE-03';report.scope='legal open-gate unphotographed middle-east fixture; real input down east stairs, southeast riverside stairs, riverfront and return; ordinary entry';}
if(wayfindAcceptance){assert.ok(route03Acceptance,'Use --wayfind with a ROUTE-03 mode');report.task='WAYFIND-01';report.scope='ordinary production entry; ROUTE-03 real east landing/riverside route plus held-input water blocker; drawing only';}
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
const shot=async(page,name)=>{if(args.includes('--panel-style'))await panelPalette(page,name);const path=join(dir,`${name}.png`);await page.screenshot({path});report.screenshots.push(path);return path;};
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

async function follow(page,id,touch,activate){
 const before=await state(page);
 assert.equal(before.routeTarget,id);
 if(before.target!==id || Number(before.routePoints)>0){
  if(activate)await activate('exp-auto-walk');else await page.locator('#exp-auto-walk')[touch?'tap':'click']();
  await wait(page,id=>{const s=document.querySelector('#exp-root').dataset;return s.target===id&&s.autoWalk==='false';},id);
 }
 assert.equal((await state(page)).dialogue,'false');
}

async function dialogueLabel(page,label,touch){
 const expected=label+(touch?'':' · E'),button=page.locator('#exp-close');
 assert.equal(await button.innerText(),expected);assert.equal(await button.textContent(),expected);
 await page.locator('#exp-dialogue').getByRole('button',{name:expected,exact:true}).waitFor({state:'visible'});
 const snapshot=await button.evaluate(e=>{const b=e.getBoundingClientRect();return{height:b.height,top:b.top,bottom:b.bottom,focus:document.activeElement.id,coarse:matchMedia('(pointer:coarse)').matches};});
 assert.equal(snapshot.coarse,touch);assert.equal(snapshot.focus,'exp-close');assert.ok(snapshot.height>=48&&snapshot.top>=0&&snapshot.bottom<=page.viewportSize().height);
 report.timeline.push({event:'UI-04 visible and accessible dialogue label',expected,touch,...snapshot});return{expected,...snapshot};
}
async function completeTutorial(page,press,touch=false){
 assert.equal((await state(page)).onboarding,'approach');
 assert.equal(await page.locator('#exp-auto-walk').isVisible(),false);
 await walk(page,900,875);
 await interact(page,'city-monument');
 await dialogueLabel(page,'收起',touch);
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
async function workshopArtProbe(){
 const p=new InMemoryRunProgress('exp03b');p.completeGoal(P.accepted);p.completeGoal(P.clue);
 const save={...emptyExplorationSave(),safe:'cWood3Door',progress:p.snapshot};assert.ok(validateExplorationSave(save));
 for(const [size,touch]of [[{width:667,height:375},true],[{width:844,height:390},true],[{width:1280,height:760},false]]){
  const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
  await page.addInitScript(({key,save})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(save));},{key:'pokan.exp06a.save.v1',save});
  const press=id=>touch?page.locator('#'+id).tap():keyboardActivate(page,id);
  await page.goto(base);await loaded(page);await press('exp-begin');if(touch)await touchPort(page);await fitCanvas(page);
  const start=await state(page);assert.equal(start.map,'workshop3');assert.equal(start.item,'false');await shot(page,`${size.width}-3f-door`);
  const hold=async(dx,dy,ms)=>{
   if(touch){const raw=await rawTouch(page,95),b=await page.locator('#exp-stick').boundingBox(),c={x:b.x+b.width/2,y:b.y+b.height/2};await raw.start(c);await raw.move({x:c.x+dx*32,y:c.y+dy*32});await page.waitForTimeout(ms);await raw.end();}
   else{const key=dx>0?'KeyD':dx<0?'KeyA':dy>0?'KeyS':'KeyW';await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
  };
  await walk(page,1080,350);await interact(page,'building-wrong-box');await press('exp-close');assert.equal((await state(page)).progress,start.progress);
  await walk(page,1080,650);await walk(page,680,650);await walk(page,684,415);const rejected=await state(page);
  assert.ok(Math.hypot(rejected.x-742,rejected.y-415)<=64);assert.notEqual(rejected.target,'plaque');assert.equal(await page.locator('#exp-interact').isDisabled(),true);if(!touch)await key(page,'KeyE');assert.equal((await state(page)).dialogue,'false');assert.equal((await state(page)).progress,start.progress);
  await hold(1,0,400);const thinBlock=await state(page);assert.ok(thinBlock.x<=688.1&&thinBlock.x>=684,JSON.stringify(thinBlock));await shot(page,`${size.width}-3f-screen-blocked`);
  await walk(page,688,520);await walk(page,770,520);await walk(page,770,455);await shot(page,`${size.width}-3f-cabinet-before`);await interact(page,'plaque');await press('exp-close');
  const collected=await state(page);assert.equal(collected.item,'true');assert.equal(JSON.parse(collected.progress).counts.collections,1);assert.equal(JSON.parse(collected.progress).counts.rewards,0);await shot(page,`${size.width}-3f-cabinet-after`);
  await interact(page,'plaque');await press('exp-close');assert.equal((await state(page)).progress,collected.progress);
  await walk(page,840,455);await hold(1,0,400);const longBlock=await state(page);assert.ok(longBlock.x<=888.1&&longBlock.x>=884,JSON.stringify(longBlock));await shot(page,`${size.width}-3f-long-screen-blocked`);
  await walk(page,840,650);await shot(page,`${size.width}-3f-screen-end`);await walk(page,620,700);await shot(page,`${size.width}-3f-stair-approach`);await walk(page,250,700);await shot(page,`${size.width}-3f-stair-front`);await interact(page,'workshop-down-2');
  const arrival=await state(page);assert.equal(arrival.map,'workshop2');assert.equal(arrival.safe,'cWoodStair2Up');assert.equal(arrival.progress,collected.progress);await shot(page,`${size.width}-2f-east-arrival`);
  await walk(page,900,700);await walk(page,900,630);await hold(0,-1,400);const tableBlock=await state(page);assert.ok(tableBlock.y>=601.9&&tableBlock.y<=606,JSON.stringify(tableBlock));await shot(page,`${size.width}-2f-table-blocked`);
  await walk(page,1080,700);await shot(page,`${size.width}-2f-upstairs`);await interact(page,'workshop-up-3');assert.equal((await state(page)).map,'workshop3');assert.equal((await state(page)).progress,collected.progress);await shot(page,`${size.width}-3f-return`);await interact(page,'workshop-down-2');
  await walk(page,1140,700);await walk(page,1140,430);await shot(page,`${size.width}-2f-street-door`);await interact(page,'workshop-middle-exit');assert.equal((await state(page)).map,'middle');await shot(page,`${size.width}-middle-exit`);await restore(page,'cWoodH2',touch);assert.equal((await state(page)).progress,collected.progress);assert.equal((await state(page)).item,'true');
  await interact(page,'workshop-middle-door');await walk(page,1140,700);await walk(page,250,700);await shot(page,`${size.width}-2f-west-stairs`);await interact(page,'workshop-down-1');assert.equal((await state(page)).map,'workshop');await shot(page,`${size.width}-1f-regression`);await interact(page,'workshop-up-2');assert.equal((await state(page)).map,'workshop2');assert.equal((await state(page)).progress,collected.progress);
  record(`ART-01 ${size.width} true screen/table blocks, around-end pickup once, 3F/2F and 1F paired stairs, street exit and reload preserve clasp`,{fixture:save,method:touch?'trusted CDP joystick and taps':'native keyboard and focused controls',start,rejected,thinBlock,longBlock,collected,arrival,tableBlock,final:await state(page),autoWalk:'NOT USED',visualReview:'Separate screenshots; functional PASS is not visual approval'});
  await page.close();
 }
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

async function streetSignProbe(){
 const p=new InMemoryRunProgress('exp03b');p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);
 const save={...emptyExplorationSave(),safe:'cGuideH3',progress:p.snapshot};assert.ok(validateExplorationSave(save));
 const prefix='岔口路牌：上街临导览2F与木作3F；两端外阶和导览楼都能到中街。中街市集可穿行，';
 for(const [size,touch]of [[{width:1280,height:760},false],[{width:667,height:375},true]]){
  const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
  await page.addInitScript(({key,save})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(save));},{key:'pokan.exp06a.save.v1',save});
  const press=id=>touch?page.locator('#'+id).tap():keyboardActivate(page,id);
  await page.goto(base);await loaded(page);await press('exp-begin');if(touch)await touchPort(page);await fitCanvas(page);
  const initial=await state(page);assert.equal(initial.safe,'cGuideH3');assert.equal(initial.unlocked,'false');await shot(page,`${size.width}-start`);
  const inspect=async(open,phase)=>{
   await walk(page,1100,650);const before=await state(page),rawBefore=await page.evaluate(()=>localStorage.getItem('pokan.exp06a.save.v1'));
   assert.equal(before.target,'street-sign');assert.equal(before.autoWalk,'false');await interact(page,'street-sign');
   await wait(page,()=>document.activeElement?.id==='exp-close');const text=await page.locator('#exp-dialogue-text').innerText();
   assert.ok(text.startsWith(prefix));if(open){assert.match(text,/下街已开放.*两端外阶.*木作1F/);assert.doesNotMatch(text,/下街仍有江纹封道/);}else assert.equal(text,prefix+'下街仍有江纹封道。');
   const during=await state(page);assert.equal(during.pending,'');assert.equal(during.progress,before.progress);await shot(page,`${size.width}-sign-${phase}`);
   await press('exp-close');await page.locator('#exp-dialogue').waitFor({state:'hidden'});const after=await state(page);
   assert.equal(after.progress,before.progress);assert.equal(after.revision,before.revision);assert.equal(after.tokens,0);assert.equal(after.item,'true');
   assert.equal(await page.evaluate(()=>localStorage.getItem('pokan.exp06a.save.v1')),rawBefore);
   return {before,during,after,text,archiveUnchanged:true};
  };
  const closed=await inspect(false,'closed');
  await walk(page,2000,650);await walk(page,2000,950);await interact(page,'east-down');assert.equal((await state(page)).map,'middle');
  await walk(page,2000,950);await walk(page,1930,950);await shot(page,`${size.width}-gate-front`);await interact(page,'gate');
  assert.equal((await state(page)).pending,'unlocked');await shot(page,`${size.width}-gate-confirm`);await press('exp-close');await wait(page,()=>document.querySelector('#exp-root').dataset.unlocked==='true');
  const opened=await state(page);assert.equal(opened.item,'true');assert.deepEqual(JSON.parse(opened.progress).collections,JSON.parse(initial.progress).collections);assert.equal(JSON.parse(opened.progress).counts.rewards,0);await shot(page,`${size.width}-gate-open`);
  const returnUpper=async()=>{await walk(page,2000,950);await walk(page,2000,450);await interact(page,'middle-east-upper');assert.equal((await state(page)).map,'upper');await walk(page,2000,650);};
  await returnUpper();const open=await inspect(true,'open');assert.equal(open.after.progress,opened.progress);
  await walk(page,2000,650);await walk(page,2000,950);await interact(page,'east-down');await walk(page,2000,1020);await interact(page,'middle-east-lower');
  const lower=await state(page);assert.equal(lower.map,'lower');assert.equal(lower.safe,'cLowerEast');assert.equal(lower.progress,opened.progress);await shot(page,`${size.width}-lower`);
  const archiveBeforeReload=await page.evaluate(()=>localStorage.getItem('pokan.exp06a.save.v1'));await restore(page,'cLowerEast',touch);
  const restored=await state(page);assert.equal(restored.unlocked,'true');assert.equal(restored.item,'true');assert.equal(restored.progress,opened.progress);assert.equal(await page.evaluate(()=>localStorage.getItem('pokan.exp06a.save.v1')),archiveBeforeReload);await shot(page,`${size.width}-lower-reloaded`);
  await interact(page,'east-up');await returnUpper();const reloaded=await inspect(true,'after-reload');assert.equal(reloaded.text,open.text);assert.equal(reloaded.after.progress,opened.progress);
  const pointers=await page.evaluate(()=>window.__pointerEvents??[]);if(touch){assert.ok(pointers.some(e=>e.trusted&&e.target==='exp-stick'));assert.ok(pointers.some(e=>e.trusted&&e.type==='click'&&e.button==='exp-close'));}
  record(`STORY-02 ${size.width} closed/open/reloaded sign agrees with real gate, lower is reachable and clasp/inspection archive remain intact`,{fixture:save,method:touch?'trusted CDP joystick and touch controls':'native keyboard and focused Enter buttons',closed,opened,open,lower,restored,reloaded,trustedPointerEvents:touch?pointers.filter(e=>e.trusted).length:'NOT USED'});
  await page.close();
 }
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

async function route03Probe(){
 const save=fixture('cMiddleDownEast');assert.ok(validateExplorationSave(save));
 const sizes=args.includes('--route03-mobile-only')?[[{width:667,height:375},true]]:[[{width:844,height:390},true],[{width:1280,height:760},false]];
 for(const [size,touch]of sizes){
  const page=await currentPage(save,size,touch);await fitCanvas(page);const initial=await state(page);
  assert.equal(initial.map,'middle');assert.equal(initial.unlocked,'true');assert.equal(initial.photographed,'false');
  await interact(page,'middle-east-lower');const landed=await state(page);assert.equal(landed.map,'lower');assert.equal(landed.target,'east-up');assert.match(await page.locator('#exp-objective').innerText(),/下街东南端「沿江石阶」.*江岸/);assert.match(await page.locator('#exp-prompt').innerText(),/沿东阶返回中街/);await shot(page,`${size.width}-lower-east-arrival`);
  await walk(page,2000,950);await shot(page,`${size.width}-lower-southeast-approach`);await walk(page,2000,1050);await walk(page,1950,1050);assert.equal((await state(page)).target,'riverfront-down');assert.equal((await page.locator('#exp-prompt').innerText()).replace(/^E\s*/,''),'沿江石阶到渡口');await shot(page,`${size.width}-riverside-stairs-front`);
  if(wayfindAcceptance){
   if(touch){const raw=await rawTouch(page,63),b=await page.locator('#exp-stick').boundingBox(),c={x:b.x+b.width/2,y:b.y+b.height/2};await raw.start(c);await raw.move({...c,y:c.y+32});await page.waitForTimeout(1000);await raw.end();}
   else{await page.keyboard.down('KeyS');await page.waitForTimeout(1000);await page.keyboard.up('KeyS');}
   const blocked=await state(page);assert.equal(blocked.map,'lower');assert.ok(blocked.y<=1148.01&&blocked.y>=1145,JSON.stringify(blocked));assert.equal(blocked.photographed,'false');assert.equal(blocked.progress,initial.progress);await shot(page,`${size.width}-dry-landing-water-blocked`);
   record(`WAYFIND-01 ${size.width} real held input stops on dry bank at continuous water blocker`,{blocked,method:touch?'trusted CDP held joystick':'native held KeyS'});await walk(page,1950,1050);
  }
  await interact(page,'riverfront-down');
  const river=await state(page);assert.equal(river.map,'riverfront');assert.equal(river.safe,'riverArrival');assert.equal(river.photographed,'false');assert.equal(river.preview,'');assert.equal(river.progress,initial.progress);await shot(page,`${size.width}-riverfront-arrival`);
  await interact(page,'riverfront-up');assert.equal((await state(page)).map,'lower');assert.equal((await state(page)).safe,'cLowerRiver');await shot(page,`${size.width}-lower-return`);await walk(page,2000,1050);await walk(page,2000,650);assert.equal((await state(page)).target,'east-up');await shot(page,`${size.width}-east-stair-return`);await interact(page,'east-up');assert.equal((await state(page)).map,'middle');await restore(page,'cMiddleDownEast',touch);const restored=await state(page);assert.equal(restored.progress,initial.progress);assert.equal(restored.photographed,'false');assert.equal(restored.unlocked,'true');assert.equal(JSON.parse(restored.progress).counts.rewards,0);await shot(page,`${size.width}-middle-reloaded`);
  record(`ROUTE-03 ${size.width} east landing distinguishes return stair; named riverside stair reaches riverfront and returns/reloads without photo`,{fixture:save,method:touch?'trusted CDP joystick and taps':'native keyboard',autoWalk:'NOT USED',initial,landed,river,restored});await page.close();
 }
 report.layers.touchEmulation='PASS';if(!args.includes('--route03-mobile-only'))report.layers.desktopChrome='PASS';
}
async function interactionSign(page,id,size,name){
 const evidence=await page.evaluate(id=>{const view=JSON.parse(document.querySelector('#exp-stage').dataset.routeView),box=e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom};};return{label:view.labels[id],player:view.player,controls:['.exp-location','.exp-hud nav','#exp-stick','#exp-interact','#exp-prompt','#exp-gate-feedback'].map(s=>document.querySelector(s)).filter(e=>e.getBoundingClientRect().height>0).map(e=>({id:e.id||e.className,box:box(e)}))};},id);
 report.timeline.push({event:'NAV-02 actual sign/actor/control bounds',name,size,evidence});
 const b=evidence.label.box;assert.ok(b.left>=4&&b.top>=4&&b.right<=size.width-4&&b.bottom<=size.height-4,JSON.stringify(evidence));const separate=(a,c)=>a.right<=c.left||c.right<=a.left||a.bottom<=c.top||c.bottom<=a.top;assert.ok(separate(b,evidence.player),JSON.stringify(evidence));for(const c of evidence.controls)assert.ok(separate(b,c.box),JSON.stringify(evidence));return evidence;
}
async function woodCue(page,id,size,name){
 const evidence=await page.evaluate(id=>{
  const box=e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
  const view=JSON.parse(document.querySelector('#exp-stage').dataset.routeView);
  return{label:view.labels[id],player:view.player,controls:['.exp-location','.exp-hud nav','#exp-stick','#exp-interact','#exp-prompt'].map(s=>document.querySelector(s)).filter(e=>e.getBoundingClientRect().height>0).map(e=>({id:e.id||e.className,box:box(e)}))};
 },id);await shot(page,name);report.timeline.push({event:'ROUTE-02 real cue bounds',size,name,evidence});
 const b=evidence.label.box;assert.ok(b.left>=4&&b.top>=4&&b.right<=size.width-4&&b.bottom<=size.height-4,JSON.stringify(evidence));
 const separate=(a,c)=>a.right<=c.left||c.right<=a.left||a.bottom<=c.top||c.bottom<=a.top;
 for(const c of evidence.controls)assert.ok(separate(b,c.box),JSON.stringify(evidence));assert.ok(separate(b,evidence.player),JSON.stringify(evidence));
 assert.ok(Number.parseFloat(evidence.label.fontSize)>=20);return evidence;
}
async function route02Probe(){
 const p=new InMemoryRunProgress('exp03b');p.completeGoal(P.accepted);p.completeGoal(P.clue);p.recordCollection(P.item);const save={...emptyExplorationSave(),safe:'cWood3Door',progress:p.snapshot};assert.ok(validateExplorationSave(save));
 const sizes=args.includes('--route02-mobile-only')?[[{width:667,height:375},true]]:[[{width:1280,height:760},false],[{width:844,height:390},true]];
 for(const [size,touch]of sizes){
  const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
  await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp06a.save.v1'))localStorage.setItem('pokan.exp06a.save.v1',raw);},JSON.stringify(save));await page.goto(base+'?viewport-diagnostics=1');await loaded(page);const press=id=>touch?page.locator('#'+id).tap():keyboardActivate(page,id);await press('exp-begin');if(touch)await touchPort(page);await fitCanvas(page);
  const start=await state(page);assert.match(await page.locator('#exp-objective').innerText(),/3F左侧楼梯下2F/);await shot(page,`${size.width}-wood3-entry`);
  await walk(page,620,700);const far=await woodCue(page,'viewport-wood-down-sign',size,`${size.width}-wood3-stair-approach`);await walk(page,285,700);const near=await woodCue(page,'viewport-wood-down-sign',size,`${size.width}-wood3-stair-front`);assert.equal(near.label.text,'下2F · 工具整理');assert.match(await page.locator('#exp-prompt').innerText(),/下2F · 工具整理/);await interact(page,'workshop-down-2');
  assert.equal((await state(page)).map,'workshop2');assert.match(await page.locator('#exp-objective').innerText(),/2F右上临街门出中街.*江纹栈门/);const arrival=await woodCue(page,'viewport-wood-street-sign',size,`${size.width}-wood2-arrival`);
  await walk(page,1140,700);await walk(page,1140,430);const door=await woodCue(page,'viewport-wood-street-sign',size,`${size.width}-wood2-street-door`);assert.match(await page.locator('#exp-prompt').innerText(),/从2F出中街/);await interact(page,'workshop-middle-exit');assert.equal((await state(page)).map,'middle');assert.equal((await state(page)).safe,'cWoodH2');await shot(page,`${size.width}-middle-wood-front`);
  await walk(page,1620,820);await walk(page,1930,820);await walk(page,1930,950);await interactionSign(page,'viewport-gate-sign',size,'gate-closed');await shot(page,`${size.width}-gate-front`);const before=await state(page);assert.equal(before.unlocked,'false');await interact(page,'gate');assert.match(await page.locator('#exp-dialogue-text').innerText(),/水波纹与门扣吻合/);await shot(page,`${size.width}-gate-dialogue`);await press('exp-close');const open=await state(page);assert.equal(open.unlocked,'true');assert.equal(JSON.parse(open.progress).collections.filter(id=>id===P.item).length,1);await page.locator('#exp-gate-feedback').waitFor({state:'visible'});await wait(page,()=>JSON.parse(document.querySelector('#exp-stage').dataset.routeView??'{}').labels?.['viewport-gate-sign']?.text.includes('已开路'));await interactionSign(page,'viewport-gate-sign',size,'gate-open');await shot(page,`${size.width}-gate-open`);
  await walk(page,2000,950);await walk(page,2000,1020);await interact(page,'middle-east-lower');const lower=await state(page);assert.equal(lower.map,'lower');assert.equal(lower.unlocked,'true');await shot(page,`${size.width}-east-lower-arrival`);await interact(page,'east-up');const back=await state(page);assert.equal(back.map,'middle');assert.equal(back.safe,'cMiddleDownEast');assert.equal(back.progress,open.progress);await shot(page,`${size.width}-east-return`);await restore(page,'cMiddleDownEast',touch);const restored=await state(page);assert.equal(restored.progress,open.progress);assert.equal(restored.unlocked,'true');assert.equal(restored.item,'true');assert.equal(JSON.parse(restored.progress).counts.rewards,0);await shot(page,`${size.width}-reload`);
  record(`ROUTE-02 ${size.width} active-floor cues clear, gate opens once, east stair return and reload keep clasp`,{fixture:save,method:touch?'trusted CDP joystick and taps':'native keyboard',autoWalk:'NOT USED',diagnostics:'existing query-gated read-only scene objects and camera',far,near,arrival,door,start,open,lower,restored});await page.close();
 }
 report.layers.touchEmulation='PASS';if(!args.includes('--route02-mobile-only'))report.layers.desktopChrome='PASS';
}
async function routeProbe(){
 const p=new InMemoryRunProgress('exp03b');p.completeGoal(P.accepted);const save={...emptyExplorationSave(),safe:'cArrival',progress:p.snapshot};assert.ok(validateExplorationSave(save));
 for(const [size,touch] of [[{width:1280,height:760},false],[{width:844,height:390},true],[{width:667,height:375},true]]){
  const page=await currentPage(save,size,touch),press=id=>touch?page.locator('#'+id).tap():keyboardActivate(page,id);
  await fitCanvas(page);const start=await state(page);assert.equal(start.map,'upper');assert.equal(JSON.parse(start.progress).counts.goals,1);
  const capture=async name=>{await shot(page,`route-${size.width}-${name}`);report.timeline.push({event:'ROUTE-01 real standing view',name,size,state:await state(page),visible:await page.evaluate(()=>Object.fromEntries(['exp-objective','exp-prompt','exp-dialogue-text'].map(id=>[id,document.getElementById(id).innerText])))});};
  await walk(page,710,690);await walk(page,710,575);await capture('guide-door');await interact(page,'guide-door');assert.equal((await state(page)).map,'guide2');assert.match(await page.locator('#exp-objective').innerText(),/2F东侧纹样展柜/);await capture('guide-entry');
  await walk(page,950,700);await walk(page,950,395);await capture('guide-cabinet');assert.match(await page.locator('#exp-prompt').innerText(),/纹样展柜/);await interact(page,'note');await capture('guide-dialogue');assert.match(await page.locator('#exp-dialogue-text').innerText(),/两道水波.*不是三角山尖/);await press('exp-close');
  const informed=await state(page);assert.ok(JSON.parse(informed.progress).goals.includes(P.clue));assert.equal(JSON.parse(informed.progress).collections.length,0);
  await walk(page,950,700);await walk(page,1100,700);await interact(page,'guide-upper-exit');assert.equal((await state(page)).map,'upper');assert.equal((await state(page)).safe,'cGuideH3');await capture('guide-return');
  await walk(page,710,690);await walk(page,1620,690);await walk(page,1620,575);await capture('wood-door');await interact(page,'workshop-upper-door');assert.equal((await state(page)).map,'workshop3');assert.match(await page.locator('#exp-objective').innerText(),/长屏风下端向左绕.*水波门扣柜/);await capture('wood-entry');
  await walk(page,1050,700);await walk(page,1050,350);await capture('wrong-box');const wrongBefore=await state(page);await interact(page,'building-wrong-box');assert.equal((await state(page)).pending,'');assert.match(await page.locator('#exp-dialogue-text').innerText(),/三角山纹.*不是水波门扣/);await capture('wrong-dialogue');await press('exp-close');assert.equal((await state(page)).progress,wrongBefore.progress);
  await walk(page,1050,640);await walk(page,760,640);await capture('screen-lower-way');await walk(page,760,430);await capture('water-cabinet');const before=await state(page);await interact(page,'plaque');await capture('clasp-dialogue');assert.equal((await state(page)).pending,'item');
  await press('exp-close');const acquired=await state(page);assert.equal(JSON.parse(acquired.progress).collections.filter(id=>id===P.item).length,1);assert.equal(JSON.parse(acquired.progress).counts.rewards,0);assert.equal(acquired.unlocked,'false');await capture('clasp-taken');
  await interact(page,'plaque');await press('exp-close');assert.equal((await state(page)).progress,acquired.progress);
  await walk(page,760,700);await walk(page,1080,700);await interact(page,'workshop-upper-exit');assert.equal((await state(page)).map,'upper');assert.equal((await state(page)).safe,'cWoodH3');await capture('wood-return');await restore(page,'cWoodH3',touch);assert.equal((await state(page)).progress,acquired.progress);await capture('reload');
  record(`ROUTE-01 ${size.width} explicit guide-return-wood route, wrong object no progress, take once and reload`,{fixture:save,method:touch?'trusted CDP joystick and taps':'real keyboard',autoWalk:'NOT USED',start,informed,acquired,restored:await state(page)});await page.close();
 }
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}
async function panelPalette(page,name){
 const palette=await page.evaluate(()=>{
  const ids=['exp-instructions-panel','exp-confirm','exp-dialogue','exp-photo','exp-photo-card'];
  return ids.map(id=>document.getElementById(id)).filter(e=>!e.hidden&&e.getBoundingClientRect().height>0).map(root=>{
   const panel=root.querySelector('.exp-panel')||root,style=getComputedStyle(panel);
   return{id:root.id,background:style.backgroundColor,gradient:style.backgroundImage,border:style.borderColor,text:style.color,buttons:[...root.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height>0).map(e=>{
    const s=getComputedStyle(e),r=e.getBoundingClientRect();return{id:e.id,text:s.color,background:s.backgroundColor,gradient:s.backgroundImage,border:s.borderColor,outline:s.outlineColor,focusVisible:e.matches(':focus-visible'),hovered:e.matches(':hover'),disabled:e.disabled,opacity:s.opacity,height:r.height};
   })};
  });
 });
 const luminance=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const rgb=text=>text.match(/[\d.]+/g).map(Number);
 const contrast=(a,b)=>{const x=luminance(rgb(a)),y=luminance(rgb(b));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 for(const panel of palette){
  const dark=['exp-instructions-panel','exp-confirm'].includes(panel.id);
  assert.equal(panel.text,dark?'rgb(242, 232, 213)':'rgb(38, 49, 47)');
  assert.equal(panel.background,dark?'rgba(0, 0, 0, 0)':'rgb(242, 232, 213)');
  if(dark)assert.match(panel.gradient,/rgb\(18, 34, 36\)/);
  for(const b of panel.buttons){
   assert.ok(b.height>=48,JSON.stringify(b));
   if(!b.disabled){const backgrounds=b.gradient==='none'?[b.background]:b.gradient.match(/rgb\([^)]+\)/g);for(const background of backgrounds)assert.ok(contrast(b.text,background)>=4.5,JSON.stringify(b));}
   if(['exp-instructions-close','exp-cancel-restart','exp-close','exp-shutter','exp-card-close'].includes(b.id)&&!b.disabled)assert.equal(b.gradient,b.hovered?'linear-gradient(rgb(247, 220, 142), rgb(227, 186, 78))':'linear-gradient(rgb(240, 207, 116), rgb(217, 173, 63))',JSON.stringify(b));
   if(b.id==='exp-confirm-restart')assert.equal(b.background,b.hovered?'rgb(149, 75, 66)':'rgb(129, 62, 56)');
   if(b.focusVisible)assert.equal(b.outline,dark?'rgb(232, 195, 90)':'rgb(53, 102, 92)');
  }
 }
 if(palette.length)report.timeline.push({event:'STYLE-UI-01 actual panel palette and >=4.5 button text contrast',name,palette});
}
async function loadProbe(){
 const asset=(await readdir('dist/assets')).find(n=>/^ridge-landing-.*\.webp$/.test(n));assert.ok(asset);report.injectedAsset={asset,sha256:await sha('dist/assets/'+asset)};
 for(const [size,touch] of [[{width:1280,height:760},false],[{width:667,height:375},true]]){
  const press=async(page,id)=>touch?page.locator('#'+id).tap():keyboardActivate(page,id);
  for(const failure of [false,true]){
   const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
   if(failure){
    page.removeAllListeners('console');page.removeAllListeners('response');
    page.on('console',message=>{if(message.type()==='error'){const text=message.text();if(/Failed to load resource.*404|Exploration startup failed.*Ferry artwork unavailable/.test(text))report.injectedErrors.push({kind:'console',size,text});else report.consoleErrors.push(text);}});
    page.on('response',response=>{if(response.status()>=400){const item={url:response.url(),status:response.status()};if(response.url().endsWith('/'+asset)&&response.status()===404)report.injectedErrors.push({kind:'response',size,...item});else report.networkErrors.push(item);}});
   }
   const saved=JSON.stringify(fixture('cGuideH2'));if(failure)await page.addInitScript(value=>{if(!sessionStorage.getItem('load01-seeded')){localStorage.setItem('pokan.exp06a.save.v1',value);sessionStorage.setItem('load01-seeded','1');}},saved);
   let release,seen;const arrived=new Promise(r=>seen=r),latch=new Promise(r=>release=r);
   await page.route('**/'+asset,async route=>{seen();await latch;if(failure)await route.fulfill({status:404,contentType:'text/plain',body:'LOAD-01 intentional image failure'});else await route.continue();});
   await page.goto(base,{waitUntil:'domcontentloaded'});await arrived;await frames(page);
   const pending=await state(page),ui=await page.evaluate(()=>({loading:!document.querySelector('#exp-loading').hidden,titleInert:document.querySelector('#exp-title-screen').inert,disabled:document.querySelector('#exp-begin').disabled}));
   assert.equal(ui.loading,true);assert.equal(ui.titleInert,true);assert.equal(ui.disabled,true);assert.notEqual(pending.ready,'true');
   await page.keyboard.down('KeyD');await frames(page);assert.equal((await state(page)).tick,pending.tick);await shot(page,`load-${size.width}-${failure?'failure':'success'}-pending`);release();
   if(!failure){
    await loaded(page);await page.keyboard.up('KeyD');await fitCanvas(page);await press(page,'exp-begin');await settleIntro(page);await press(page,'exp-intro-start');await press(page,'exp-onboarding-skip');
    if(touch)await touchPort(page);const before=await state(page);await axis(page,'x',before.x+24);assert.ok((await state(page)).tick>before.tick);
    await shot(page,`load-${size.width}-released-play`);record(`LOAD-01 ${size.width} real image held: loading visible, title inert, tick frozen; release starts and moves`,{pending,ui});
   }else{
    await wait(page,()=>document.querySelector('#exp-root').dataset.disposed==='true');await frames(page,12);
    const failed=await page.evaluate(()=>{const error=document.querySelector('#exp-error'),r=error.getBoundingClientRect();return{errorHidden:error.hidden,text:error.textContent,focus:document.activeElement.id,errorInert:error.inert,topmost:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#exp-error')?.id,loading:!document.querySelector('#exp-loading').hidden,canvas:document.querySelectorAll('#exp-stage canvas').length,titleHidden:document.querySelector('#exp-title-screen').hidden,bindings:document.querySelector('#exp-root').dataset.hostBindings,stage:{...document.querySelector('#exp-stage').dataset},archive:localStorage.getItem('pokan.exp06a.save.v1'),signals:window.__expSignals.filter(s=>!s.signal.aborted).map(s=>s.type)};});
    report.timeline.push({event:'LOAD-01 failed scene actual UI',size,failed});await shot(page,`load-${size.width}-error`);
    if(args.includes('--load-baseline')){report.preFixDefects.push({size,focus:failed.focus,titleHidden:failed.titleHidden,resizeObservers:failed.stage.resizeObservers,mapObjects:failed.stage.mapObjects});}else{assert.equal(failed.topmost,'exp-error');assert.equal(failed.focus,'exp-error');assert.equal(failed.errorInert,false);assert.equal(failed.loading,false);assert.equal(failed.canvas,0);assert.equal(failed.bindings,'0');assert.deepEqual(failed.signals,[]);assert.equal(failed.archive,saved);assert.equal(failed.titleHidden,true);assert.equal(failed.stage.resizeObservers,'0');assert.equal(failed.stage.mapObjects,'0');}
    await page.keyboard.up('KeyD');await key(page,'KeyE');assert.equal((await state(page)).disposed,'true');assert.equal(await page.evaluate(()=>localStorage.getItem('pokan.exp06a.save.v1')),saved);
    await page.unrouteAll();await page.reload();await loaded(page);await fitCanvas(page);await press(page,'exp-begin');const restored=await state(page);assert.equal(restored.view,'play');assert.equal(restored.safe,'cGuideH2');assert.equal(restored.progress,JSON.stringify(fixture('cGuideH2').progress));assert.equal(await page.evaluate(()=>localStorage.getItem('pokan.exp06a.save.v1')),saved);
    await shot(page,`load-${size.width}-recovered`);record(`LOAD-01 ${size.width} ${args.includes('--load-baseline')?'pre-fix failure observed and refresh recovered':'intentional 404 visible/focused, resources/input disposed; original archive and refreshed continuation preserved'}`,{failed,restored});
   }
   await page.close();
  }
 }
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
 assert.deepEqual(report.preFixDefects,[],'Pre-fix startup failure defects retained');
}
async function helpLayout(page,size,touch,context){
 const layout=await page.locator('#exp-instructions-panel').evaluate(root=>{
  const box=e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
  return {title:box(root.querySelector('h1')),details:box(root.querySelector('dl')),buttons:[...root.querySelectorAll('button')].filter(e=>!e.hidden).map(e=>({id:e.id,...box(e)})),text:root.innerText,keyboardVisible:[...root.querySelectorAll('dt')].some(e=>e.textContent==='电脑'&&getComputedStyle(e).display!=='none')};
 });
 await shot(page,`help-${size.width}-${context}`);report.timeline.push({event:'HELP-01 layout',size,touch,context,layout});
 if(args.includes('--help-baseline')){record(`HELP-01 ${size.width} ${context} old geometry captured`,{layout,newAcceptance:'NOT RUN'});return;}
 for(const b of [layout.title,layout.details,...layout.buttons])assert.ok(b.top>=0&&b.bottom<=size.height&&b.left>=0&&b.right<=size.width,JSON.stringify(layout));
 for(const b of layout.buttons)assert.ok(b.height>=48,JSON.stringify(layout));
 assert.equal(layout.keyboardVisible,!touch);record(`HELP-01 ${size.width} ${context} title/device text/actions visible`,{layout});
}
async function helpProbe(){
 for(const [size,touch] of [[{width:1280,height:760},false],[{width:844,height:390},true],[{width:667,height:375},true]]){
  const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
  const press=async id=>touch?page.locator('#'+id).tap():keyboardActivate(page,id);
  await page.goto(base);await loaded(page);await fitCanvas(page);const title=await state(page);
  await press('exp-instructions');await pausedAt(page,'help',2,'exp-instructions-close',title);await helpLayout(page,size,touch,'title');
  await press('exp-instructions-close');await pausedAt(page,'title',1,'exp-instructions',title);
  await press('exp-begin');await settleIntro(page);await press('exp-intro-start');await press('exp-onboarding-skip');
  await press('exp-menu-button');const parent=await pausedAt(page,'menu',1,'exp-resume');
  await press('exp-menu-help');await pausedAt(page,'help',2,'exp-instructions-close',parent);await helpLayout(page,size,touch,'pause');
  await press('exp-instructions-close');await pausedAt(page,'menu',1,'exp-menu-help',parent);
  await press('exp-menu-help');const before=await state(page),archive=await page.evaluate(()=>JSON.stringify({...localStorage}));
  await press('exp-onboarding-replay');const after=await state(page);assert.equal(after.view,'play');assert.equal(after.tokens,0);assert.equal(after.progress,before.progress);assert.equal(after.runtimeId,before.runtimeId);assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),archive);
  assert.equal(after.onboarding,'approach');await press('exp-onboarding-skip');
  if(touch)await touchPort(page);const start=await state(page);await axis(page,'x',start.x+20);assert.ok((await state(page)).tick>start.tick);
  record(`HELP-01 ${size.width} title/pause focus and replay preserve progress/archive; new movement works`);await page.close();
 }
}
async function pauseGridLayout(page,size){
 const layout=await page.locator('#exp-menu').evaluate(menu=>{
  const box=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  return{primary:box(menu.querySelector('#exp-resume')),grid:box(menu.querySelector('.exp-menu-grid')),secondary:[...menu.querySelectorAll('.exp-menu-grid button')].map(box),restart:box(menu.querySelector('#exp-restart')),panel:box(menu.querySelector('.exp-menu-panel')),parentColumns:getComputedStyle(menu.querySelector('.exp-pause-actions')).gridTemplateColumns};
 });
 report.timeline.push({event:'UI-03 menu geometry',size,layout});await shot(page,`ui03-${size.width}-menu`);
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1,JSON.stringify(layout));
 close(layout.grid.left,layout.primary.left);close(layout.grid.right,layout.primary.right);
 const [a,b,c,d]=layout.secondary;for(const button of [b,c,d])close(button.width,a.width);
 close(a.top,b.top);close(c.top,d.top);close(a.left,c.left);close(b.right,d.right);close(a.left,layout.primary.left);close(b.right,layout.primary.right);
 const buttons=[layout.primary,...layout.secondary,layout.restart];
 for(const b of buttons)assert.ok(b.height>=48&&b.top>=0&&b.bottom<=size.height&&b.left>=0&&b.right<=size.width,JSON.stringify(layout));
 for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){
  const a=buttons[i],b=buttons[j];assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,JSON.stringify(layout));
 }
 assert.ok(layout.panel.top>=0&&layout.panel.bottom<=size.height);
 record(`UI-03 ${size.width} primary and two equal secondary columns align; all controls 48px and nonoverlapping`,layout);
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
 await pauseGridLayout(page,size);
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
 await press('exp-menu-button');
 const oldWeather=await page.locator('#exp-weather').textContent();await press('exp-weather');
 assert.equal((await state(page)).view,'play');assert.equal((await state(page)).tokens,0);assert.notEqual(await page.locator('#exp-weather').textContent(),oldWeather);
 await press('exp-menu-button');const restartParent=await pausedAt(page,'menu',1,'exp-resume');await press('exp-restart');
 await pausedAt(page,'confirm',2,'exp-cancel-restart',restartParent);
 const confirmLayout=await page.locator('#exp-confirm').evaluate(panel=>[...panel.querySelectorAll('.exp-menu-actions button')].map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};}));
 for(const b of confirmLayout)assert.ok(b.height>=48&&b.top>=0&&b.bottom<=size.height&&b.left>=0&&b.right<=size.width);
 if(touch){assert.ok(Math.abs(confirmLayout[0].top-confirmLayout[1].top)<1);assert.ok(Math.abs(confirmLayout[0].width-confirmLayout[1].width)<1);assert.ok(confirmLayout[0].right<confirmLayout[1].left);}
 await shot(page,`ui03-${size.width}-restart-confirm`);await press('exp-cancel-restart');await pausedAt(page,'menu',1,'exp-restart',restartParent);
 record(`UI-03 ${size.width} weather works and restart cancel restores focus; short landscape confirmation keeps two columns`,{confirmLayout,touch});
 const beforeTitle=await state(page);await press('exp-title');
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

async function collectionRoute(size,touch){
 const save=fixture('cGuideH2',false);assert.ok(validateExplorationSave(save));assert.equal(save.progress.counts.collections,1);assert.equal(save.progress.counts.rewards,0);assert.equal(save.photo,null);
 const page=await currentPage(save,size,touch),press=archivePress(page,touch);await fitCanvas(page);
 const start=await state(page);assert.deepEqual(JSON.parse(start.mementos),[]);assert.equal(start.photographed,'false');
 const track=async id=>{await press('exp-notes-toggle');assert.equal(await page.locator('#exp-track-'+id).isDisabled(),false);await press('exp-track-'+id);assert.equal((await state(page)).trackedTask,id);};
 const go=async id=>{await follow(page,id,touch,press);const before=await state(page);await interact(page,id);report.timeline.push({event:'COLLECTION-01 active doorway/stair',target:id,before,after:await state(page)});};
 const journal=async name=>{
  await press('exp-notes-toggle');const s=await state(page);
  for(const m of MEMENTOS)assert.equal(await page.locator('#exp-track-'+m.id).isDisabled(),JSON.parse(s.mementos).includes(m.id));
  assert.equal(await page.locator('#exp-memento-list article').count(),JSON.parse(s.mementos).length);
  await shot(page,`${size.width}-${name}-journal`);return s;
 };
 let expectedCount=1;
 const collect=async(m,positions)=>{
  assert.equal((await state(page)).routeTarget,m.targetId);
  for(const [x,y] of positions)await walk(page,x,y);
  await follow(page,m.targetId,touch,press);await shot(page,`${size.width}-${m.id}-room`);
  await interact(page,m.targetId);const inspected=await state(page);
  assert.equal(inspected.pending,m.targetId);assert.ok(inspected.mementoInspection.startsWith(inspected.runtimeId+':memento:'));assert.match(inspected.mementoInspection,/:memento:\d+$/);assert.equal(inspected.tokens,1);assert.ok((await page.locator('#exp-dialogue-text').innerText()).includes(m.name));
  assert.equal(await page.locator('#exp-memento-cancel').isVisible(),true);assert.match(await page.locator('#exp-close').innerText(),/收进纪念册/);
  const collectLabel=await dialogueLabel(page,'收进纪念册',touch);
  await shot(page,`${size.width}-${m.id}-inspection`);await press('exp-memento-cancel');
  const cancelled=await state(page);for(const key of ['runtimeId','progress','observations','photographed','safe','revision'])assert.equal(cancelled[key],inspected[key]);
  assert.equal(cancelled.dialogue,'false');assert.equal(cancelled.pending,'');
  await interact(page,m.targetId);assert.notEqual((await state(page)).mementoInspection,inspected.mementoInspection);
  await press('exp-close');const collected=await state(page),p=JSON.parse(collected.progress);expectedCount++;
  assert.equal(p.counts.collections,expectedCount);assert.equal(p.collections.filter(id=>id===m.collectionId).length,1);
  assert.equal(JSON.parse(collected.mementos).length,expectedCount-1);assert.equal(collected.photographed,'false');
  assert.equal(p.counts.rewards,expectedCount===4?1:0);
  await interact(page,m.targetId);assert.equal((await state(page)).pending,'');assert.equal(await page.locator('#exp-memento-cancel').isVisible(),false);
  assert.match(await page.locator('#exp-dialogue-text').innerText(),/已经收好/);const ownedLabel=await dialogueLabel(page,'收起',touch);await shot(page,`${size.width}-${m.id}-owned-inspection`);await press('exp-close');
  assert.equal((await state(page)).progress,collected.progress);
  record(`COLLECTION-01 ${size.width} ${m.id} physical approach, cancel unchanged, collect once and repeat without reward`,{fixture:'initial unlocked cGuideH2 only; subsequent route is real UI input',positions,inspected,cancelled,collected,labels:{collect:collectLabel,owned:ownedLabel}});
 };
 await track('bookmark');await go('guide-middle-door');assert.equal((await state(page)).map,'guide');
 await collect(MEMENTOS[0],[[780,540],[780,470]]);
 const first=await journal('first-owned');await press('exp-notes-close');await restore(page,first.safe,touch);
 const firstRestored=await state(page);assert.notEqual(firstRestored.runtimeId,first.runtimeId);assert.equal(firstRestored.progress,first.progress);assert.deepEqual(JSON.parse(firstRestored.mementos),['bookmark']);assert.equal(firstRestored.trackedTask,'main');
 record(`COLLECTION-01 ${size.width} first souvenir refresh restores collection and resets tracking to main`,{before:first,after:firstRestored});
 await track('sketch');await go('guide-exit');const stair=(await state(page)).routeTarget;assert.ok(['middle-west-lower','middle-east-lower'].includes(stair));
 await go(stair);assert.equal((await state(page)).map,'lower');await go('tea-door');assert.equal((await state(page)).map,'tea');
 await collect(MEMENTOS[1],[[300,540],[300,520]]);
 await track('postcard');await go('tea-exit');await go('lantern-door');assert.equal((await state(page)).map,'lantern');
 await collect(MEMENTOS[2],[[650,650],[650,400],[850,400]]);
 const all=await journal('all-owned'),progress=JSON.parse(all.progress);
 assert.equal(progress.counts.collections,4);assert.deepEqual(new Set(progress.collections),new Set([P.item,...MEMENTOS.map(m=>m.collectionId)]));
 assert.equal(progress.goals.filter(id=>id===MEMENTO_COMPLETION.goal).length,1);assert.deepEqual(progress.rewards,[MEMENTO_COMPLETION.reward]);assert.equal(all.mementoTitle,MEMENTO_COMPLETION.title);
 assert.match(await page.locator('#exp-memento-count').innerText(),/3\/3/);assert.equal(await page.locator('#exp-memento-award h3').textContent(),MEMENTO_COMPLETION.title);
 await page.locator('#exp-memento-award').scrollIntoViewIfNeeded();await shot(page,`${size.width}-unique-title`);
 await press('exp-track-none');assert.equal((await state(page)).trackedTask,'none');assert.equal((await state(page)).routeTarget,'');assert.equal((await state(page)).routePoints,'0');assert.equal(await page.locator('#exp-auto-walk').isVisible(),false);
 await restore(page,all.safe,touch);const final=await state(page);assert.equal(final.progress,all.progress);assert.equal(final.trackedTask,'main');assert.deepEqual(JSON.parse(final.mementos),MEMENTOS.map(m=>m.id));assert.equal(final.photographed,'false');
 const archive=await page.evaluate(()=>JSON.parse(localStorage.getItem('pokan.exp06a.save.v1')));assert.equal(archive.photo,null);assert.deepEqual(archive.observedSites,[]);assert.ok(validateExplorationSave(archive));
 await journal('reloaded-all-owned');await page.locator('#exp-memento-award').scrollIntoViewIfNeeded();await shot(page,`${size.width}-reloaded-unique-title`);await press('exp-track-none');
 assert.equal((await state(page)).routeTarget,'');assert.equal((await state(page)).routePoints,'0');
 record(`COLLECTION-01 ${size.width} all three restore, four total collections, unique title/reward, no photo and free exploration clears route`,{start,stair,all,final,archive,inputLayer:touch?'Chrome CDP joystick plus touch journal navigation':'native keyboard plus journal navigation'});await page.close();
}
async function collectionProbe(){
 for(const [size,touch] of [[{width:1280,height:760},false],[{width:844,height:390},true],[{width:667,height:375},true]])await collectionRoute(size,touch);
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

async function entryArtProbe(){
 for(const [size,touch] of [[{width:667,height:375},true],[{width:844,height:390},true],[{width:1280,height:760},false]]){
  const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1}),press=archivePress(page,touch);
  await page.goto(base);await loaded(page);assert.equal((await state(page)).hasJourney,'false');await press('exp-begin');await settleIntro(page);await press('exp-intro-start');if(touch)await touchPort(page);
  await completeTutorial(page,press,touch);await walk(page,1250,790);await walk(page,1250,650);await walk(page,3120,650);await walk(page,3120,900);await interact(page,'city-to-entry');
  const capture=async name=>{await fitCanvas(page);await frames(page,2);const s=await state(page),view=await page.locator('#exp-stage').evaluate(e=>({x:Number(e.dataset.cameraX),y:Number(e.dataset.cameraY),width:Number(e.dataset.viewportWidth),height:Number(e.dataset.viewportHeight),zoom:Number(e.dataset.zoom)}));report.timeline.push({event:'ART-03 actual standing frame',name,size,state:s,view});await shot(page,`${size.width}-${name}`);if(name==='overlook-front'||name==='overlook-revisited'){assert.ok(view.y+view.height/view.zoom>=1275,'overlook includes lower shoreline and bridge footing');assert.ok((s.y-view.y)*view.zoom>90,'look down preserves player above-foot room');}return s;};
  await capture('entry-arrival');await walk(page,1100,850);await walk(page,1100,800);await capture('visitor-overlap-existing');
  await interact(page,'visitor');assert.equal((await state(page)).accepted,'false');await press('exp-close');assert.equal((await state(page)).accepted,'true');
  const progress=(await state(page)).progress;await walk(page,1180,800);await walk(page,1180,920);const front=await capture('overlook-front');
  await interact(page,'entry-view');assert.match(await page.locator('#exp-dialogue').innerText(),/木楼|江桥/);await capture('overlook-investigation');assert.equal((await state(page)).progress,progress);await press('exp-close');
  if(touch){const b=await page.locator('#exp-stick').boundingBox(),center={x:b.x+b.width/2,y:b.y+b.height/2},raw=await rawTouch(page,83);await raw.start(center);await raw.move({...center,y:center.y+32});await frames(page,90);await raw.end();}
  else{await page.keyboard.down('KeyS');await frames(page,90);await page.keyboard.up('KeyS');}
  const blocked=await capture('rail-blocked');assert.ok(blocked.y>960&&blocked.y<=968,'original rail stops foot centre on dry side');assert.equal(blocked.progress,progress);assert.equal(blocked.map,'entry');
  await walk(page,1180,920);await walk(page,2040,920);await walk(page,2040,780);await capture('east-porch');await interact(page,'entry-to-core');assert.equal((await state(page)).map,'upper');await capture('upper-arrival');
  await walk(page,190,690);await interact(page,'core-to-entry');assert.equal((await state(page)).map,'entry');const back=await capture('porch-return');assert.equal(back.progress,progress);assert.equal(back.runtimeId,front.runtimeId);
  await restore(page,back.safe,touch);assert.equal((await state(page)).accepted,'true');if(touch)await touchPort(page);await capture('return-reloaded');
  await walk(page,1180,780);await walk(page,1180,920);await capture('overlook-revisited');assert.equal((await state(page)).progress,progress);
  record(`ART-03 ${size.width} fresh street, active overlook, original rail, east porch upper round-trip and refresh`,{fixture:'empty isolated localStorage; full route native keyboard/CDP joystick, no auto-follow or runtime state writes',front,blocked,back,visitorOverlap:'existing player/visitor overlap recorded separately; not changed by ART-03'});await page.close();
 }
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

async function startProbe(){
 for(const [size,touch] of [[{width:667,height:375},true],[{width:844,height:390},true],[{width:1280,height:760},false]]){
  const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1}),press=archivePress(page,touch);
  await page.goto(base);await loaded(page);assert.equal((await state(page)).hasJourney,'false');
  await shot(page,`${size.width}-title`);await press('exp-begin');await settleIntro(page);await shot(page,`${size.width}-intro`);await press('exp-intro-start');if(touch)await touchPort(page);
  const blank=(await state(page)).progress;
  const capture=async phase=>{
   await frames(page,2);const evidence=await page.evaluate(()=>{
    const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
    const goal=document.querySelector('#exp-objective'),card=document.querySelector('#exp-onboarding'),title=card.querySelector('h2');
    const range=document.createRange();range.selectNodeContents(title);const goalRange=document.createRange();goalRange.selectNodeContents(goal);
    return{goal:{text:goal.textContent,lines:goalRange.getClientRects().length,visible:!!goal.getClientRects().length&&getComputedStyle(goal).visibility!=='hidden',box:box(goal)},card:{visible:!card.hidden,box:box(card),title:title.textContent,lines:range.getClientRects().length,clipped:title.scrollWidth>title.clientWidth},place:box(document.querySelector('.exp-location')),stick:box(document.querySelector('#exp-stick')),interact:box(document.querySelector('#exp-interact')),state:{...document.querySelector('#exp-root').dataset}};
   });await shot(page,`${size.width}-${phase}`);report.timeline.push({event:'START-01 screen',phase,size,evidence});
   assert.equal(evidence.goal.visible,true);if(touch&&['plaza','entry'].includes(evidence.state.map)){assert.equal(evidence.goal.lines,1,'short landscape main goal remains one line');}
   if(touch&&evidence.card.visible){assert.equal(evidence.card.lines,1);assert.equal(evidence.card.clipped,false);const a=evidence.card.box,b=evidence.place;assert.ok(a.x>=b.right+4||a.y>=b.bottom+4||a.bottom+4<=b.y);assert.ok(a.right<=size.width&&a.bottom<=size.height);}
   return evidence;
  };
  await capture('plaza');await walk(page,900,875);await interact(page,'city-monument');await capture('monument-dialogue');
  assert.equal((await state(page)).progress,blank);await press('exp-close');
  const closed=await capture('after-investigation');assert.equal(closed.goal.visible,true,'main goal must remain readable during onboarding');assert.match(closed.goal.text,/沧白路/);
  if(touch){assert.equal(closed.card.lines,1);assert.equal(closed.card.clipped,false);assert.doesNotMatch(closed.card.title,/WASD|E|空格/);}
  await press('exp-onboarding-skip');assert.equal((await state(page)).onboarding,'done');assert.equal((await state(page)).progress,blank);
  const skipped=await capture('lesson-dismissed');assert.equal(skipped.goal.visible,true);
  await walk(page,1250,790);await walk(page,1250,650);await walk(page,3120,650);await walk(page,3120,900);await capture('alley-front');await interact(page,'city-to-entry');
  assert.equal((await state(page)).map,'entry');assert.equal((await state(page)).accepted,'false');
  const arrival=await capture('entry-arrival');assert.match(arrival.goal.text,/东侧栏杆/);
  await walk(page,140,850);await interact(page,'entry-to-city');assert.equal((await state(page)).map,'plaza');assert.equal((await state(page)).progress,blank);
  await walk(page,3120,900);await interact(page,'city-to-entry');await walk(page,1100,850);await walk(page,1100,800);await interact(page,'visitor');await dialogueLabel(page,'接受委托',touch);
  const offered=await capture('request-offered');assert.equal(offered.state.accepted,'false');assert.equal(offered.state.progress,blank);
  if(touch)await press('exp-menu-button');else await key(page,'Escape');assert.equal((await state(page)).accepted,'false');await press('exp-resume');assert.equal((await state(page)).dialogue,'false');
  await interact(page,'visitor');assert.equal((await state(page)).accepted,'false');await press('exp-close');
  const accepted=await capture('request-accepted');assert.equal(accepted.state.accepted,'true');assert.match(accepted.goal.text,/东侧门廊/);
  await restore(page,accepted.state.safe,touch);const reloaded=await capture('accepted-reloaded');assert.equal(reloaded.goal.text,accepted.goal.text);if(touch)await touchPort(page);
  await walk(page,2040,800);await walk(page,2040,780);await capture('east-porch');await interact(page,'entry-to-core');
  assert.equal((await state(page)).map,'upper');assert.match(await page.locator('#exp-objective').innerText(),/导览楼2F/);assert.equal((await state(page)).progress,accepted.state.progress);await capture('upper-arrival');
  record(`START-01 ${size.width} new opening, investigation, persistent goal, actual alley round-trip, explicit request, reload and upper entry`,{fixture:'new context with no seeded storage; all route movement native keyboard or CDP joystick; no auto-follow',closed,arrival,offered,accepted,reloaded});await page.close();
  const skipPage=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1}),skipPress=archivePress(skipPage,touch);
  await skipPage.goto(base);await loaded(skipPage);await skipPress('exp-begin');await settleIntro(skipPage);await skipPress('exp-intro-start');await skipPress('exp-onboarding-skip');
  const skip=await state(skipPage);assert.equal(skip.onboarding,'done');assert.equal(skip.accepted,'false');assert.equal(skip.progress,blank);assert.match(await skipPage.locator('#exp-objective').innerText(),/沧白路/);await shot(skipPage,`${size.width}-skip-before-investigation`);await skipPage.close();
  record(`START-01 ${size.width} skip before investigation retains main route without accepting request`,{state:skip});
 }
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

async function viewportProbe(){
 const violations=[];
 const spawns=[];
 const diagnosticUrl=new URL(base);diagnosticUrl.searchParams.set('viewport-diagnostics','1');
 report.viewportDiagnostics={enabledUrl:diagnosticUrl.href,ordinaryUrl:base,ordinaryScope:'fresh-start framing smoke only; full route uses diagnostics'};
 const gap=8;
 const inspect=async(page,size,phase,roles)=>{
  await fitCanvas(page);await frames(page,2);
  const evidence=await page.evaluate(()=>{
   const stage=document.querySelector('#exp-stage'),root=document.querySelector('#exp-root');
   const controls=['.exp-location','.exp-hud nav','#exp-stick','#exp-interact','#exp-onboarding','#exp-prompt'].map(selector=>{
    const e=root.querySelector(selector),b=e.getBoundingClientRect();return{selector,left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};
   }).filter(b=>b.width>0&&b.height>0);
   return{url:location.href,view:JSON.parse(stage.dataset.routeView),controls,cameraX:Number(stage.dataset.cameraX),cameraY:Number(stage.dataset.cameraY),cameraWidth:Number(stage.dataset.viewportWidth),cameraHeight:Number(stage.dataset.viewportHeight),position:{x:Number(root.dataset.x),y:Number(root.dataset.y)}};
  });
  const boxes={player:evidence.view.player,ring:evidence.view.ring,hint:evidence.view.hint?.box,...Object.fromEntries(Object.entries(evidence.view.labels).map(([name,v])=>[name,v.box]))};
  const failures=[];
  for(const name of roles){
   const b=boxes[name];if(!b){failures.push(name+' missing');continue;}
   if(b.left<gap||b.top<gap||b.right>size.width-gap||b.bottom>size.height-gap)failures.push(name+' outside 8px viewport margin');
   for(const c of evidence.controls)if(!(b.right+gap<=c.left||c.right+gap<=b.left||b.bottom+gap<=c.top||c.bottom+gap<=b.top))failures.push(name+' within 8px of '+c.selector);
  }
  for(const [name,label] of Object.entries(evidence.view.labels)){
   if(name==='viewport-guide-sign'||name==='viewport-west-sign')assert.equal(label.fontSize,'16px');
   if(!evidence.view.shortTouch&&label.home){assert.equal(label.world.x+label.world.width/2,label.home.x);assert.ok(Math.abs(label.world.y+label.world.height/2-label.home.y)<.01);}
  }
  report.timeline.push({event:'VIEWPORT-01 screen criteria',size,phase,gap,roles,failures,evidence});
  await shot(page,`${size.width}-${phase}`);
  violations.push(...failures.map(reason=>({size,phase,reason})));
  return evidence;
 };
 for(const [size,touch] of [[{width:1280,height:760},false],[{width:667,height:375},true],[{width:844,height:390},true]]){
  const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1}),press=archivePress(page,touch);
  await page.goto(diagnosticUrl.href);await loaded(page);assert.equal((await state(page)).hasJourney,'false');await press('exp-begin');await settleIntro(page);await press('exp-intro-start');if(touch)await touchPort(page);
  const spawn=await inspect(page,size,'plaza-spawn',['player','ring','hint','viewport-monument-body','viewport-monument-name']);
  spawns.push({size,touch,spawn});
  if(!touch){assert.equal(spawn.cameraX,0);assert.ok(Math.abs(spawn.cameraY-(790-spawn.cameraHeight*.58))<.01);}
  await walk(page,900,875);await inspect(page,size,'plaza-approach',['player','ring','viewport-monument-body','viewport-monument-name']);
  await interact(page,'city-monument');await dialogueLabel(page,'收起',touch);await press('exp-close');assert.equal((await state(page)).onboarding,'continue');await press('exp-onboarding-skip');
  await follow(page,'city-to-entry',touch,press);await interact(page,'city-to-entry');await follow(page,'visitor',touch,press);await interact(page,'visitor');await press('exp-close');
  await follow(page,'entry-to-core',touch,press);await interact(page,'entry-to-core');
  const beforeStairs=await state(page);assert.equal(beforeStairs.map,'upper');assert.equal(beforeStairs.unlocked,'false');
  const upper=await inspect(page,size,'upper-entry',['player','viewport-guide-sign','viewport-west-sign']);
  if(!touch){assert.equal(upper.cameraX,0);assert.ok(Math.abs(upper.cameraY-(690-upper.cameraHeight*.58))<.01);}
  const crossings=[];
  if(touch){
   await walk(page,250,690);await walk(page,250,920);await inspect(page,size,'west-upper-approach',['player','viewport-west-sign']);
   for(const [direction,map] of [[1,'middle'],[-1,'upper']]){
    const b=await page.locator('#exp-stick').boundingBox(),center={x:b.x+b.width/2,y:b.y+b.height/2},raw=await rawTouch(page,77);
    await page.evaluate(()=>window.__viewportCross=[]);await raw.start(center);await raw.move({...center,y:center.y+direction*32});
    try{await wait(page,map=>{
     const d=document.querySelector('#exp-root').dataset,g=document.querySelector('#exp-stage').dataset;
     window.__viewportCross.push({map:d.map,x:Number(d.x),y:Number(d.y),cameraX:Number(g.cameraX),cameraY:Number(g.cameraY)});return d.map===map;
    },map);}finally{await raw.end();}
    await wait(page,()=>[...document.querySelectorAll('#exp-stage > div')].every(e=>!e.style.backgroundImage));
    const samples=await page.evaluate(()=>window.__viewportCross),lastOld=samples.filter(s=>s.map!==map).at(-1),firstNew=samples.find(s=>s.map===map);
    assert.ok(lastOld&&firstNew);assert.ok(Math.abs(firstNew.x-lastOld.x)<5);
    assert.ok(Math.abs((firstNew.y-(map==='middle'?410:990))-(lastOld.y-(map==='middle'?990:410)))<15);
    assert.ok(Math.abs((firstNew.y-firstNew.cameraY)-(lastOld.y-lastOld.cameraY))<8);
    const s=await state(page);assert.equal(s.runtimeId,beforeStairs.runtimeId);assert.equal(s.progress,beforeStairs.progress);assert.equal(s.unlocked,'false');
    crossings.push({direction,map,samples,state:s});await inspect(page,size,map==='middle'?'west-middle-landing':'west-upper-return',['player','viewport-west-sign']);
   }
  }
  await follow(page,'guide-door',touch,press);await inspect(page,size,'guide-approach',['player','viewport-guide-sign']);await interact(page,'guide-door');assert.equal((await state(page)).map,'guide2');
  await shot(page,`${size.width}-guide2-active-entry`);
  record(`VIEWPORT-01 ${size.width} fresh lesson/visitor/upper guide interactions and ${touch?'same-bank west stairs round-trip':'unchanged desktop camera and sign anchors'}`,{fixture:'fresh empty storage; native keyboard/CDP joystick and journal navigation; no state writes',spawn,upper,crossings});await page.close();
 }
 report.viewportViolations=violations;assert.deepEqual(violations,[]);
 for(const {size,touch,spawn} of spawns){
  const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1}),press=archivePress(page,touch);
  await page.goto(base);await loaded(page);await press('exp-begin');await settleIntro(page);await press('exp-intro-start');await fitCanvas(page);await frames(page,2);
  assert.equal(await page.locator('#exp-stage').getAttribute('data-route-view'),null);
  const s=await state(page);assert.equal(s.x,spawn.position.x);assert.equal(s.y,spawn.position.y);assert.ok(Math.abs(s.cameraX-spawn.cameraX)<.01);assert.ok(Math.abs(s.cameraY-spawn.cameraY)<.01);
  await shot(page,`${size.width}-ordinary-entry-no-diagnostics`);
  record(`VIEWPORT-01 ${size.width} ordinary entry has matching spawn framing and no diagnostic JSON`,{url:page.url(),scope:'startup smoke only; other route checks use diagnostic query',state:s});await page.close();
 }
 report.layers.desktopChrome='PASS';report.layers.touchEmulation='PASS';
}

async function photoFrame(page,size,site,phase,enforce=true){
 await page.locator('#exp-photo-image').evaluate(e=>e.decode());
 const m=await page.locator('#exp-photo').evaluate(panel=>{
  const box=e=>{const b=e.getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
  const img=panel.querySelector('#exp-photo-image'),css=getComputedStyle(img),b=box(img);
  const inset={x:parseFloat(css.borderLeftWidth)+parseFloat(css.paddingLeft),y:parseFloat(css.borderTopWidth)+parseFloat(css.paddingTop),w:parseFloat(css.borderLeftWidth)+parseFloat(css.borderRightWidth)+parseFloat(css.paddingLeft)+parseFloat(css.paddingRight),h:parseFloat(css.borderTopWidth)+parseFloat(css.borderBottomWidth)+parseFloat(css.paddingTop)+parseFloat(css.paddingBottom)};
  const content={left:b.left+inset.x,top:b.top+inset.y,width:b.width-inset.w,height:b.height-inset.h},ratio=img.naturalWidth/img.naturalHeight;
  const effectiveWidth=Math.min(content.width,content.height*ratio),effectiveHeight=effectiveWidth/ratio;
  const feedback=panel.querySelector('#exp-photo-feedback');
  return{image:b,content,natural:{width:img.naturalWidth,height:img.naturalHeight},effective:{width:effectiveWidth,height:effectiveHeight},css:{objectFit:css.objectFit,objectPosition:css.objectPosition,width:css.width,height:css.height,flex:css.flex,aspectRatio:css.aspectRatio,maxHeight:css.maxHeight},panel:box(panel.querySelector('.exp-photo-panel')),instructions:box(panel.querySelector('#exp-photo-instructions')),requirement:box(panel.querySelector('#exp-photo-requirement')),feedback:{...box(feedback),text:feedback.textContent},controls:['exp-shutter','exp-photo-menu','exp-photo-close'].map(id=>({id,...box(panel.querySelector('#'+id))}))};
 });
 assert.deepEqual(m.natural,{width:900,height:500});assert.equal(m.css.objectFit,'contain');assert.equal(m.css.objectPosition,'50% 50%');
 for(const b of m.controls)assert.ok(b.height>=48&&b.top>=0&&b.bottom<=size.height&&b.left>=0&&b.right<=size.width,JSON.stringify(m));
 assert.ok(m.image.height>0&&m.image.top>=m.requirement.bottom&&m.image.bottom<=m.instructions.top,JSON.stringify(m));
 assert.ok(m.instructions.bottom<=m.controls[0].top&&m.feedback.bottom<=m.controls[0].top,JSON.stringify(m));
 if(m.feedback.text.trim())assert.ok(m.feedback.height>0&&m.feedback.top>=m.instructions.bottom&&m.feedback.bottom<=size.height,JSON.stringify(m));
 if(enforce&&size.height<=540){
  assert.ok(Math.abs(m.content.width/m.content.height-1.8)<.01,JSON.stringify(m));
  assert.ok(Math.abs(m.effective.width-m.content.width)<1&&Math.abs(m.effective.height-m.content.height)<1,JSON.stringify(m));
  assert.ok(Math.abs(m.image.left+m.image.width/2-(m.panel.left+m.panel.width/2))<1,JSON.stringify(m));
 }
 const src=await page.locator('#exp-photo-image').getAttribute('src');
 const evidence={event:'PHOTO-UI-01 frame',size,site,phase,enforce,srcSha256:createHash('sha256').update(src).digest('hex'),...m};report.timeline.push(evidence);
 return evidence;
}
async function photoFrameProbe(){
 if(photoFrameBaseline){
  for(const [size,touch] of [[{width:1280,height:760},false],[{width:667,height:375},true],[{width:844,height:390},true]]){
   const save=fixture('riverView');assert.ok(validateExplorationSave(save));const page=await currentPage(save,size,touch);await interact(page,'view');
   const geometry=await photoFrame(page,size,'river','empty',false);await shot(page,`${size.width}-before-river-preview`);
   record(`PHOTO-UI-01 ${size.width} old river geometry measured only; new frame ratio NOT RUN`,geometry);await page.close();
  }
 }
 for(const size of [{width:667,height:375},{width:844,height:390}]){
  const save=fixture('cTeaRoom');assert.ok(validateExplorationSave(save));const page=await currentPage(save,size,true);
  await walk(page,800,540);await walk(page,800,330);assert.equal((await state(page)).target,'window');await shot(page,`${size.width}-window-open-world`);await interact(page,'window');
  const empty=await photoFrame(page,size,'window','empty',!photoFrameBaseline),inspected=await state(page);await shot(page,`${size.width}-window-preview`);
  await page.locator('#exp-shutter').tap();const failed=await state(page),feedback=await photoFrame(page,size,'window','feedback',!photoFrameBaseline);
  assert.equal(failed.previewId,inspected.previewId);assert.equal(failed.progress,inspected.progress);assert.equal(failed.photographed,'false');assert.equal(failed.cardOpen,'false');assert.equal(JSON.parse(failed.progress).counts.rewards,0);assert.match(feedback.feedback.text,/木楼/);
  await shot(page,`${size.width}-window-failure-feedback`);await page.locator('#exp-photo-close').tap();assert.equal((await state(page)).preview,'');assert.equal((await state(page)).progress,failed.progress);
  await interact(page,'window');await page.locator('#exp-photo-menu').tap();assert.equal((await state(page)).view,'menu');assert.equal((await state(page)).preview,'');await page.locator('#exp-resume').tap();assert.equal((await state(page)).tokens,0);
  record(`PHOTO-UI-01 ${size.width} window mismatch keeps photo/reward empty; feedback readable and shutter/return/menu usable`,{fixture:'legal inline cTeaRoom unlocked save; real CDP joystick to window; not fresh main route',baselineOnly:photoFrameBaseline,empty,feedback,inspected,failed});await page.close();
 }
 report.layers.touchEmulation='PASS';if(photoFrameBaseline)report.layers.desktopChrome='PASS';
}

async function styleRoute(size,touch){
 const page=await newPage({viewport:size,isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
 const press=id=>page.locator(`#${id}`)[touch?'tap':'click']();
 const capture=name=>shot(page,`${size.width}x${size.height}-${name}`);
 await page.goto(base+'?viewport-diagnostics=1');await loaded(page);
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
 await completeTutorial(page,press,touch);

 const steps=[
  ['city-to-entry','entry'],['visitor','visitor',true],['entry-to-core','upper'],
  ['guide-door','guide-room'],['note','guide-note',true],['guide-upper-exit'],
  ['workshop-upper-door','workshop-room'],['plaque','plaque',true],['workshop-upper-exit'],
  ['east-down','middle'],['gate','gate',true],['middle-east-lower','lower'],['riverfront-down','river'],
 ];
 for(const [target,screen,confirm] of steps){
  await follow(page,target,touch);
  await interact(page,target);
  if(confirm){
   const labels={visitor:'接受委托',note:'记下导览',plaque:'带上导扣',gate:'转动导扣，开门'};
   await dialogueLabel(page,labels[target],touch);await capture(target+'-dialogue');await press('exp-close');
  }
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
 assert.equal((await state(page)).target,'view');await interactionSign(page,'viewport-photo-sign',size,'photo-before-preview');await capture('view-open-world');report.timeline.push({event:'PHOTO-UI-01 actual view before interaction',size,state:await state(page)});
 await interact(page,'view');
 const frame=await photoFrame(page,size,'river','empty');record(`PHOTO-UI-01 ${size.width} full river illustration frame and 48px controls`,frame);
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
 if(entryArtAcceptance)await entryArtProbe();
 else if(startAcceptance)await startProbe();
 else if(workshopArtAcceptance)await workshopArtProbe();
 else if(streetSignAcceptance)await streetSignProbe();
 else if(route03Acceptance)await route03Probe();
 else if(route02Acceptance)await route02Probe();
 else if(routeAcceptance)await routeProbe();
 else if(loadAcceptance)await loadProbe();
 else if(helpAcceptance)await helpProbe();
 else if(photoFrameAcceptance)await photoFrameProbe();
 else if(viewportAcceptance)await viewportProbe();
 else if(collectionAcceptance)await collectionProbe();
 else if(saveAcceptance)await saveProbe();
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
