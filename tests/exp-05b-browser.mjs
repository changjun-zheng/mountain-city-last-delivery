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
if(!args.includes('--production')||args.some(a=>a!=='--production'&&a!=='--probe-only'&&a!=='--dialogue-only'&&a!=='--interaction-only'&&!a.startsWith('--browser=')))throw new Error('Use --production --browser=chrome');
const selection=resolveBrowserExecutable(parseBrowserSelection(args));
assert.equal(selection.id,'chrome');
const dir=resolve('test-results/exp-05b',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const report={task:'EXP-05B',scope:args.includes('--interaction-only')?'native-menu-cancel-and-visibility':args.includes('--dialogue-only')?'ordinary-dialogue-close-short-ownership':args.includes('--probe-only')?'building-floors-short-native-input':'building-floors-fresh-keyboard-main-and-focused-touch',startedAt:new Date().toISOString(),
  command:[process.execPath,...process.argv.slice(1)],head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  browser:{...selection},layers:{desktopChrome:'NOT RUN',touchEmulation:'NOT RUN',androidChrome:'NOT RUN',iosSafari:'NOT RUN',directionReview:'NOT RUN'},
  checks:[],timeline:[],screenshots:[],pageErrors:[],networkErrors:[],cleanup:{},hashes:{},protectedHashes:{},actualDist:{},historicalFailures:[],
  limitations:['True Android Chrome and iOS Safari were not available.','The completion card closes the existing Demo route; it does not prove a full 30-45 minute chapter.','Final art, culture review and real-device H5 acceptance remain separate.']};
const record=(name,details={})=>{report.checks.push({name,status:'PASS',...details});console.log('PASS',name);};
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function hashTree(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await hashTree(p);else report.hashes[relative(process.cwd(),p).replaceAll('\\','/')]=await sha(p);}}
await hashTree('src');
for(const e of await readdir('tests'))if(/^(exploration.*\.mjs|exp-0[235].*-browser\.mjs)$/.test(e))report.hashes['tests/'+e]=await sha('tests/'+e);
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
async function restore(page,safe,touch=false){const before=await state(page);await page.reload();await loaded(page);await page.locator('#exp-begin')[touch?'tap':'click']();assert.equal((await state(page)).safe,safe);assert.equal((await state(page)).progress,before.progress);}
async function seeded(safe,size){const page=await newPage({viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:1});await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp05b.save.v1'))localStorage.setItem('pokan.exp05b.save.v1',raw);},JSON.stringify({...emptyExplorationSave(),safe}));await page.goto(base);await loaded(page);await page.locator('#exp-begin').tap();await touchPort(page);return page;}
async function probeFloors(){
 for(const size of [{width:844,height:390},{width:667,height:375}]){
  const guide=await seeded('guideRoom',size);await shot(guide,`guide1-${size.width}`);await runBrowserFloorRoute(guide,'guideUp',walk,interact);assert.equal((await state(guide)).accepted,'false');await shot(guide,`guide2-${size.width}`);await restore(guide,'guideStair2',true);
  await walk(guide,950,700);await walk(guide,950,350);await interact(guide,'note');assert.equal((await state(guide)).clue,'false');await guide.keyboard.press('Escape');await guide.locator('#exp-resume').tap();assert.equal((await state(guide)).clue,'false');await interact(guide,'note');await guide.locator('#exp-close').tap();assert.equal((await state(guide)).clue,'true');await runBrowserFloorRoute(guide,'guideBack',walk,interact);await restore(guide,'guideStair1',true);await walk(guide,820,540);await walk(guide,540,540);await interact(guide,'guide-exit');assert.equal((await state(guide)).safe,'guideDoor');await guide.close();
  const page=await seeded('workshopRoom',size);await shot(page,`workshop1-${size.width}`);await walk(page,250,540);await interact(page,'workshop-up-2');await shot(page,`workshop2-${size.width}`);await restore(page,'workshopStair2Down',true);await walk(page,1080,700);await interact(page,'workshop-up-3');await restore(page,'workshopStair3',true);await walk(page,760,700);await walk(page,760,430);await interact(page,'plaque');await page.keyboard.press('Escape');await page.locator('#exp-resume').tap();assert.equal((await state(page)).item,'false');await interact(page,'plaque');await page.locator('#exp-close').tap();assert.equal((await state(page)).item,'true');assert.equal((await state(page)).accepted,'false');await shot(page,`workshop3-${size.width}`);
  const progress=(await state(page)).progress;await walk(page,760,700);await walk(page,1050,700);await walk(page,1050,350);await interact(page,'building-wrong-box');assert.equal((await state(page)).pending,'');await page.locator('#exp-close').tap();assert.equal((await state(page)).progress,progress);await walk(page,1050,700);await walk(page,250,700);await interact(page,'workshop-down-2');await restore(page,'workshopStair2Up',true);
  const counts=[];for(let n=0;n<10;n++){await interact(page,'workshop-up-3');counts.push((await state(page)).mapObjects);await interact(page,'workshop-down-2');}assert.equal(new Set(counts).size,1);await walk(page,250,700);await interact(page,'workshop-down-1');await restore(page,'workshopStair1',true);await walk(page,250,540);await walk(page,540,540);await interact(page,'workshop-exit');assert.equal((await state(page)).safe,'workshopDoor');
  const cdp=await page.context().newCDPSession(page),b=await page.locator('#exp-stick').boundingBox(),point=(x,y)=>({id:71,x,y,radiusX:5,radiusY:5,force:1});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(b.x+b.width/2,b.y+b.height/2)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(b.x+b.width/2+30,b.y+b.height/2)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(JSON.parse((await state(page)).input).pointers,0);await page.setViewportSize({width:390,height:844});await fitCanvas(page);assert.equal(JSON.parse((await state(page)).input).pointers,0);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await wait(page,()=>document.querySelector('#exp-stage').dataset.mapObjects==='0');assert.equal(await page.locator('canvas').count(),0);assert.ok(await page.evaluate(()=>window.__expSignals.every(s=>s.signal.aborted)));await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await page.close();
  record(`B03 B04 B05 B06 ${size.width}: native joystick stairs, cancel/collect, six anchors reload, original exits, ten round trips, cancellation/rotation/disposal`,{fixture:'inline empty current saves at original 1F room anchors; not a fresh A-to-D playthrough',counts});
 }
 report.layers.touchEmulation='PASS';
}
async function dialogueProbe(){
 for(const size of [{width:844,height:390},{width:667,height:375}]){
  const page=await seeded('guideStair2',size);await walk(page,950,700);await walk(page,950,350);const cdp=await page.context().newCDPSession(page);
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

async function menuCancelProbe(){
 for(const size of [{width:844,height:390},{width:667,height:375}]){
  for(const [safe,target,field,points] of [['guideStair2','note','clue',[[950,700],[950,350]]],['workshopStair3','plaque','item',[[760,700],[760,430]]]]){
   const page=await seeded(safe,size);for(const point of points)await walk(page,...point);const before=(await state(page)).progress;await interact(page,target);assert.equal((await state(page))[field],'false');await page.locator('#exp-menu-button').tap();assert.equal((await state(page)).view,'menu');assert.equal((await state(page)).dialogue,'false');assert.equal((await state(page)).pending,'');assert.equal((await state(page)).progress,before);await page.locator('#exp-resume').tap();await interact(page,target);await page.locator('#exp-close').tap();assert.equal((await state(page))[field],'true');assert.equal((await state(page)).accepted,'false');await shot(page,`native-cancel-${target}-${size.width}`);await page.close();
  }
  record(`B05 ${size.width}: native touch menu/resume cancels both ordinary clue and item; next explicit completion grants normally`,{fixture:'inline empty current floor anchors; no keyboard used in this scenario'});
 }
 report.layers.touchEmulation='PASS';report.mainRoute='NOT RUN';
}

async function nativeFloorHidden(){
 const profile=join(dir,'native-floor-profile');await mkdir(profile);nativeProcess=spawn(selection.executablePath,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true});report.nativeChrome={pid:nativeProcess.pid,profile};let stderr='';nativeProcess.stderr.setEncoding('utf8');const endpoint=await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(new Error(stderr)),15000);nativeProcess.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);done(match[1]);}});});nativeBrowser=await chromium.connectOverCDP(endpoint,{noDefaults:true});const context=nativeBrowser.contexts()[0],page=context.pages()[0];active=page;page.on('pageerror',e=>report.pageErrors.push(String(e)));page.on('requestfailed',r=>report.networkErrors.push({url:r.url(),error:r.failure()}));page.on('response',r=>{if(r.status()>=400)report.networkErrors.push({url:r.url(),status:r.status()});});
 await page.addInitScript(raw=>{if(!localStorage.getItem('pokan.exp05b.save.v1'))localStorage.setItem('pokan.exp05b.save.v1',raw);window.__floorVisibility=[];document.addEventListener('visibilitychange',()=>window.__floorVisibility.push({hidden:document.hidden,tokens:document.querySelector('#exp-root')?.dataset.tokens}));},JSON.stringify({...emptyExplorationSave(),safe:'workshopStair3'}));await page.goto(base);await loaded(page);await page.bringToFront();await page.locator('#exp-begin').click();await page.keyboard.down('KeyD');await wait(page,()=>Number(document.querySelector('#exp-root').dataset.x)>265);await page.keyboard.up('KeyD');await page.locator('#exp-menu-button').click();const paused=await state(page),bg=await context.newPage();await bg.goto('about:blank');await bg.bringToFront();await wait(page,()=>document.hidden);assert.equal((await state(page)).tokens,2);assert.equal((await state(page)).tick,paused.tick);await page.bringToFront();await wait(page,()=>!document.hidden);assert.equal((await state(page)).tokens,1);assert.equal(JSON.parse((await state(page)).input).keys.length,0);await page.locator('#exp-resume').click();assert.equal((await state(page)).tokens,0);assert.equal((await state(page)).accepted,'false');await shot(page,'native-workshop3');report.visibility=await page.evaluate(()=>window.__floorVisibility);await bg.close();record('B05 actual native Chrome hidden and menu have independent owners in new 3F before any quest',{events:report.visibility});
}
async function mainRoute(page){
 await page.goto(base);await loaded(page);assert.equal((await state(page)).view,'title');assert.equal((await state(page)).map,'plaza');await shot(page,'main-title');await page.locator('#exp-begin').click();const started=Date.now(),runtime=(await state(page)).runtimeId;
 await walk(page,1250,790);await walk(page,1250,650);await walk(page,3060,650);await walk(page,3060,900);await walk(page,3120,900);await interact(page,'city-to-entry');await walk(page,1100,850);await walk(page,1100,800);await interact(page,'visitor');await closeDialogue(page);await walk(page,2040,800);await walk(page,2040,780);await interact(page,'entry-to-core');
 await walk(page,880,690);await walk(page,880,580);await interact(page,'guide-door');await shot(page,'main-guide1');await walk(page,820,540);await page.keyboard.down('KeyE');await wait(page,()=>document.querySelector('#exp-root').dataset.map==='guide2');await page.waitForTimeout(120);assert.equal((await state(page)).map,'guide2');await page.keyboard.up('KeyE');await walk(page,950,700);await walk(page,950,350);await shot(page,'main-guide2');await interact(page,'note');await closeDialogue(page);assert.equal((await state(page)).clue,'true');await runBrowserFloorRoute(page,'guideBack',walk,interact);await interact(page,'guide-exit');
 await walk(page,880,650);await walk(page,2300,650);await walk(page,2300,580);await interact(page,'workshop-door');await shot(page,'main-workshop1');await walk(page,320,540);await walk(page,320,460);const beforeSign=(await state(page)).progress;await interact(page,'building-floor-sign');await closeDialogue(page);assert.equal((await state(page)).progress,beforeSign);await walk(page,320,540);await walk(page,250,540);await interact(page,'workshop-up-2');await walk(page,700,700);await walk(page,700,330);await shot(page,'main-workshop2');await interact(page,'building-tool-pattern');await closeDialogue(page);await walk(page,700,700);await walk(page,1080,700);await interact(page,'workshop-up-3');await walk(page,1050,700);await walk(page,1050,350);await interact(page,'building-wrong-box');await closeDialogue(page);assert.equal((await state(page)).item,'false');await walk(page,1050,700);await walk(page,680,700);await walk(page,680,415);assert.equal((await state(page)).target,'');await page.keyboard.press('KeyE');assert.equal((await state(page)).item,'false');assert.equal((await state(page)).pending,'');await walk(page,680,540);await walk(page,760,540);await walk(page,760,430);await shot(page,'main-workshop3');await interact(page,'plaque');await closeDialogue(page);assert.equal((await state(page)).item,'true');await runBrowserFloorRoute(page,'workshopBack',walk,interact);await interact(page,'workshop-exit');
 record('B01 B02 B03 fresh A through B and both actual multi-floor buildings; unique original clue/item, optional observations and in-range blocked screen',{runtime,automatedElapsedMs:Date.now()-started});
 await walk(page,2300,650);await walk(page,2700,650);await walk(page,2700,750);await interact(page,'gate');await closeDialogue(page);await walk(page,3060,750);await interact(page,'east-down');await walk(page,3000,1200);await interact(page,'middle-east-lower');await walk(page,2180,650);await walk(page,2180,680);await interact(page,'photo-eaves');await page.locator('#exp-shutter').click();assert.equal((await state(page)).photographed,'false');await page.locator('#exp-photo-close').click();await walk(page,2180,650);await walk(page,900,650);await interact(page,'window');await page.locator('#exp-shutter').click();assert.equal((await state(page)).photographed,'false');await page.locator('#exp-photo-close').click();
 await walk(page,1100,650);await walk(page,1100,1120);await walk(page,1700,1120);await interact(page,'riverfront-down');await walk(page,900,650);await walk(page,900,1050);await walk(page,1950,1050);await interact(page,'view');await page.locator('#exp-shutter').click();assert.equal((await state(page)).cardOpen,'true');assert.equal((await state(page)).photographed,'true');assert.equal((await state(page)).runtimeId,runtime);assert.deepEqual(JSON.parse((await state(page)).mementos),[]);assert.equal(JSON.parse((await state(page)).progress).counts.rewards,1);await shot(page,'main-D-completion');const progress=(await state(page)).progress;await page.locator('#exp-card-close').click();await interact(page,'view');await page.locator('#exp-shutter').click();assert.equal((await state(page)).progress,progress);await page.locator('#exp-card-title').click();assert.equal((await state(page)).view,'title');await page.locator('#exp-begin').click();assert.equal((await state(page)).runtimeId,runtime);await page.reload();await loaded(page);assert.equal((await state(page)).safe,'riverView');assert.equal((await state(page)).progress,progress);await page.locator('#exp-begin').click();await page.locator('#exp-notes-toggle').click();await page.locator('#exp-card-reopen').click();await page.locator('#exp-card-restart').click();await page.locator('#exp-cancel-restart').click();assert.equal((await state(page)).view,'completion');
 report.automationTiming={actualRootToCompletionWithChecksMs:Date.now()-started,note:'Scripted input with validation, not first-player chapter duration.'};record('B05 B06 actual keyboard new game completes original gate, district and D photo with zero optional mementos and one reward; replay/title/reload/cancel preserve it');
}
try{
 browser=await chromium.launch({executablePath:selection.executablePath,headless:true});const identityPage=await newPage();const identity=await identityPage.context().newCDPSession(identityPage);report.browser.actual=identifyBrowser(await identity.send('Browser.getVersion'));await identityPage.close();
 if(args.includes('--interaction-only')){await menuCancelProbe();await nativeFloorHidden();}
 else if(args.includes('--dialogue-only')){await dialogueProbe();}
 else if(args.includes('--probe-only')){await probeFloors();await nativeFloorHidden();report.mainRoute='NOT RUN';}
 else{const page=await newPage({viewport:{width:1280,height:720}});await mainRoute(page);report.layers.desktopChrome='PASS';report.touchAndNativeEvidence='Separate --probe-only run; see delivery manifest';}
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.networkErrors,[]);record('B06 zero unexpected page/network errors and current execution fingerprints');
}catch(error){report.failure={message:String(error),stack:error.stack};console.error(error);if(active&&!active.isClosed()){try{await shot(active,'FAIL');report.failureState=await state(active);report.failurePointerEvents=await active.evaluate(()=>window.__pointerEvents??[]);}catch(e){report.evidenceError=String(e);}}}
finally{
 for(const c of contexts){try{await c.close();}catch(e){report.cleanup.contextError=String(e);}}report.cleanup.contexts=report.cleanup.contextError?'FAIL':'PASS';try{await browser?.close();report.cleanup.browser='PASS';}catch(e){report.cleanup.browser='FAIL';report.cleanup.error=String(e);}
 if(nativeBrowser){try{const session=await nativeBrowser.newBrowserCDPSession();await session.send('Browser.close');}catch{}await nativeBrowser.close().catch(()=>{});}if(nativeProcess){if(nativeProcess.exitCode===null)await new Promise(done=>{const timer=setTimeout(done,2000);nativeProcess.once('exit',()=>{clearTimeout(timer);done();});});if(nativeProcess.exitCode===null){nativeProcess.kill();await new Promise(done=>nativeProcess.once('exit',done));}report.cleanup.nativeChrome=nativeProcess.exitCode!==null||nativeProcess.signalCode!==null?'PASS':'FAIL';}
 if(localServer)await new Promise(done=>localServer.close(done));report.cleanup.server=localServer?'PASS':'EXTERNAL 4199 PRESERVED';report.cleanup.thirdParty='Phaser document-scope handlers reclaimed by page teardown; own AbortSignals checked separately.';report.finishedAt=new Date().toISOString();report.status=report.failure||Object.values(report.cleanup).includes('FAIL')?'FAIL':'PASS';await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));await writeFile(join(dir,'script-source.mjs'),await readFile('tests/exp-05b-browser.mjs'));await writeFile(join(dir,'report.sha256'),await sha(join(dir,'report.json')));console.log(report.status,report.task,dir);if(report.status==='FAIL')process.exitCode=1;
}
