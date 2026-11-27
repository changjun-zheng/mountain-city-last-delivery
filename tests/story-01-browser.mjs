import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {parseBrowserSelection,resolveBrowserExecutable} from './browser-selection.mjs';
import {emptyExplorationSave,validateExplorationSave} from '../src/core/exploration.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P} from '../src/core/progress.ts';
import {EXP_TARGETS} from '../src/core/exploration-content.ts';
import {EXP_STORAGE_KEY} from '../src/platform/web/exploration-storage.ts';

const origin='http://127.0.0.1:4199/';
const dir=resolve('test-results/story-01',`run-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(dir,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const selection=resolveBrowserExecutable(parseBrowserSelection(process.argv.slice(2)));
assert.equal(selection.id,'chrome');
const report={task:'STORY-01',command:'node tests/story-01-browser.mjs --browser=chrome',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  scope:'ordinary production entry; isolated validated cUpperWest fixtures; real native keyboard walking, investigation, cancellation, closing and reload; no auto-walk or runtime state injection',
  origin,viewport:{width:1280,height:760},fixtures:[],checks:[],timeline:[],screenshots:[],hashes:{},actualDist:{},pageErrors:[],consoleErrors:[],networkErrors:[],cleanup:{},status:'NOT RUN',
  doors:EXP_TARGETS.filter(t=>['wrong-gate','gate'].includes(t.id)),gateConditions:'Existing gate requires accepted request AND clue AND owned clasp AND explicit confirmation; covered by focused core test matrix.',
  limitations:['Real mobile devices NOT RUN','Touch emulation NOT RUN: this card requests native desktop keyboard','Owner experience NOT RUN']};
async function hashTree(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await hashTree(p);else report.hashes[relative(process.cwd(),p).replaceAll('\\','/')]=sha(await readFile(p));}}
await hashTree('src');for(const p of ['tests/story-01-browser.mjs','tests/exploration-district.test.mjs','package.json','package-lock.json'])report.hashes[p]=sha(await readFile(p));
const html=await readFile('dist/index.html','utf8');
for(const p of ['index.html',...[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>m[1].replace(/^\//,''))]){
 const bytes=await readFile('dist/'+p),response=await fetch(origin+p);assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(bytes));report.actualDist['dist/'+p]=sha(bytes);
}
const state=page=>page.locator('#exp-root').evaluate(e=>({...e.dataset,x:Number(e.dataset.x),y:Number(e.dataset.y)}));
const browser=await chromium.launch({executablePath:selection.executablePath,headless:true});report.browser={...selection,version:browser.version()};
let active,context;
async function capture(page,name){const path=join(dir,name+'.png');await page.screenshot({path});report.screenshots.push(path);report.timeline.push({name,state:await state(page)});}
async function axis(page,coordinate,destination){const start=(await state(page))[coordinate],positive=destination>start;if(Math.abs(destination-start)<2)return;
 const key=coordinate==='x'?(positive?'KeyD':'KeyA'):(positive?'KeyS':'KeyW');report.timeline.push({input:'native keyboard',key,coordinate,destination});
 await page.keyboard.down(key);try{await page.waitForFunction(({coordinate,destination,positive})=>{const n=Number(document.querySelector('#exp-root').dataset[coordinate]);return positive?n>=destination:n<=destination;},{coordinate,destination,positive},{timeout:10000,polling:'raf'});}finally{await page.keyboard.up(key);}
}
function assertReply(text,clue,item){assert.match(text,/三角山纹/);assert.match(text,/杂物/);if(item){assert.match(text,/两道水波.*不匹配/);assert.match(text,/导扣仍留在身上/);}else if(clue){assert.match(text,/江纹栈门在中街/);assert.doesNotMatch(text,/身上|导扣仍|导扣.*保留/);}else assert.doesNotMatch(text,/江纹|水波|导扣/);}
try{
 for(const [name,clue,item] of [['unread',false,false],['display-read',true,false],['held',true,true],['held-before-display',false,true]]){
  const progress=new InMemoryRunProgress('exp03b');if(clue||item)progress.completeGoal(P.accepted);if(clue)progress.completeGoal(P.clue);if(item)progress.recordCollection(P.item);
  const fixture={...emptyExplorationSave(),safe:'cUpperWest',progress:progress.snapshot};assert.ok(validateExplorationSave(fixture));report.fixtures.push({name,fixture});
  context=await browser.newContext({viewport:report.viewport});
  await context.addInitScript(({key,fixture})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(fixture));},{key:EXP_STORAGE_KEY,fixture});
  const page=active=await context.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('requestfailed',r=>report.networkErrors.push({url:r.url(),failure:r.failure()}));page.on('response',r=>{if(r.status()>=400)report.networkErrors.push({url:r.url(),status:r.status()});});
  await page.goto(origin);await page.waitForFunction(()=>document.querySelector('#exp-root')?.dataset.ready==='true');await page.keyboard.press('Enter');
  assert.equal((await state(page)).map,'upper');await capture(page,name+'-start');
  // Ascend the existing west stair before crossing left onto its side landing.
  await axis(page,'y',850);await axis(page,'x',140);const before=await state(page);assert.equal(before.target,'wrong-gate');assert.equal(before.autoWalk,'false');await capture(page,name+'-door');
  const archiveBefore=await page.evaluate(key=>localStorage.getItem(key),EXP_STORAGE_KEY);
  let text;
  for(const closeKey of ['Escape','KeyE']){
   await page.keyboard.press('KeyE');await page.locator('#exp-dialogue').waitFor({state:'visible'});text=await page.locator('#exp-dialogue-text').innerText();assertReply(text,clue,item);
   assert.equal((await state(page)).pending,'');assert.equal((await state(page)).progress,before.progress);await capture(page,name+'-inspection-'+closeKey);
   await page.keyboard.press(closeKey);await page.locator('#exp-dialogue').waitFor({state:'hidden'});
   if(closeKey==='Escape'){
    const paused=await state(page);assert.equal(paused.view,'menu');assert.equal(paused.tokens,'1');assert.equal(paused.progress,before.progress);
    await page.keyboard.press('Escape');await page.locator('#exp-menu').waitFor({state:'hidden'});
   }
   const after=await state(page);
   assert.equal(after.progress,before.progress);assert.equal(after.item,before.item);assert.equal(after.unlocked,'false');assert.equal(after.revision,before.revision);assert.equal(after.tokens,'0');assert.equal(after.view,'play');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),EXP_STORAGE_KEY),archiveBefore);
  }
  await capture(page,name+'-closed');await page.reload();await page.waitForFunction(()=>document.querySelector('#exp-root')?.dataset.ready==='true');await page.keyboard.press('Enter');
  const restored=await state(page);assert.equal(restored.progress,before.progress);assert.equal(restored.item,before.item);assert.equal(restored.unlocked,'false');assert.equal(restored.safe,'cUpperWest');assert.equal(await page.evaluate(key=>localStorage.getItem(key),EXP_STORAGE_KEY),archiveBefore);
  await capture(page,name+'-reloaded');report.checks.push({name,status:'PASS',fixture,before,restored,dialogue:text,archiveUnchanged:true,actions:['native W/A walk','E investigate','Escape cancel to pause; Escape resume','E investigate','E close','reload and Enter continue']});
  await context.close();context=undefined;active=undefined;
 }
 for(const k of ['pageErrors','consoleErrors','networkErrors'])assert.equal(report[k].length,0);
 report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error.stack??error);if(active)await capture(active,'failure').catch(()=>{});process.exitCode=1;}
finally{if(context)await context.close();await browser.close();report.cleanup={contexts:'PASS',browser:'PASS',server:'EXTERNAL 4199 PRESERVED'};report.finishedAt=new Date().toISOString();await writeFile(join(dir,'script-source.mjs'),await readFile('tests/story-01-browser.mjs'));await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({dir,status:report.status,checks:report.checks.length,failure:report.failure}));}
