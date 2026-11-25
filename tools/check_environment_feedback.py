"""ENV-FEEDBACK-01: isolated valid-save fixtures and real keyboard/touch input."""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:4199/')
args = parser.parse_args()
OUT = ROOT / 'test-results/environment-feedback-01' / datetime.now(timezone.utc).strftime('ui-%Y%m%dT%H%M%SZ')
OUT.mkdir(parents=True, exist_ok=True)
fixtures = json.loads(subprocess.check_output(['node', '--experimental-strip-types', '--input-type=module', '-e', """
import {emptyExplorationSave} from './src/core/exploration.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P} from './src/core/progress.ts';
const states={};
for(const [name,flags] of Object.entries({accepted:['accepted'],clue:['accepted','clue'],equipped:['accepted','clue','item'],opened:['accepted','clue','item','unlocked']})){
 const p=new InMemoryRunProgress('exp03b');for(const f of flags)f==='item'?p.recordCollection(P.item):p.completeGoal(P[f]);
 states[name]={...emptyExplorationSave(),progress:p.snapshot};
}console.log(JSON.stringify(states));
"""], cwd=ROOT).decode('utf-8'))
exe = next(p for p in [Path.home() / 'AppData/Local/Google/Chrome/Application/chrome.exe', Path('C:/Program Files/Google/Chrome/Application/chrome.exe')] if p.exists())
report = {'task':'ENV-FEEDBACK-01','base':args.base,'checks':[],'screenshots':[],'pageErrors':[],'networkErrors':[], 'realDevice':'NOT RUN','subjectiveSound':'NOT RUN','ownerArt':'NOT RUN','fixture':'Separate contexts, validated existing safety points; no runtime writes/teleports.', 'sourceHashes':{}}
for folder in ['src','tests']:
    for f in (ROOT / folder).rglob('*'):
        if f.is_file() and f.suffix in ['.ts','.css','.mjs']:
            report['sourceHashes'][str(f.relative_to(ROOT)).replace('\\','/')] = hashlib.sha256(f.read_bytes()).hexdigest()
for f in ['tools/check_environment_feedback.py','dist/index.html']:
    report['sourceHashes'][f] = hashlib.sha256((ROOT / f).read_bytes()).hexdigest()

def state(page):
    return page.locator('#exp-root').evaluate('(e)=>({...e.dataset,x:+e.dataset.x,y:+e.dataset.y})')
def stage(page):
    return page.locator('#exp-stage').evaluate('(e)=>({...e.dataset})')
def wait(page, expression, arg=None):
    page.wait_for_function(expression, arg=arg, polling='raf', timeout=20000)
def settle(page):
    page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
def check(name):
    report['checks'].append({'name':name,'status':'PASS'})
    print('PASS', name, flush=True)
def shot(page,name):
    path=OUT/(name+'.png');page.screenshot(path=str(path));report['screenshots'].append(str(path.relative_to(ROOT)))
def fits(page,selector):
    element=page.locator(selector);element.scroll_into_view_if_needed()
    assert element.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>=40&&r.x>=-1&&r.right<=innerWidth+1&&r.y>=-1&&r.bottom<=innerHeight+1;}'),selector

audio_probe="""(()=>{
 window.__gateAudio={created:0,oscillators:0,closed:0};const Native=window.AudioContext;
 if(Native)window.AudioContext=class extends Native {
  constructor(...args){super(...args);window.__gateAudio.created++;}
  createOscillator(){window.__gateAudio.oscillators++;return super.createOscillator();}
  close(){window.__gateAudio.closed++;return super.close();}
 };
})();"""
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=str(exe),headless=True)
    report['browser']={'executable':str(exe),'version':browser.version}
    try:
        for width,height,mobile in [(1280,760,False),(844,390,True),(667,375,True)]:
            size=f'{width}x{height}';contexts=[]
            def action(page,selector):
                page.locator(selector).tap() if mobile else page.locator(selector).click()
                settle(page)
            def opened(safe,progress,reduce=False,broken=False):
                context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1,reduced_motion='reduce' if reduce else 'no-preference')
                contexts.append(context);page=context.new_page()
                page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
                page.on('requestfailed',lambda r:report['networkErrors'].append({'url':r.url,'failure':r.failure}))
                page.on('response',lambda r:report['networkErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
                save={**fixtures[progress],'safe':safe}
                page.add_init_script('if(!localStorage.getItem("pokan.exp06a.save.v1"))localStorage.setItem("pokan.exp06a.save.v1",'+json.dumps(json.dumps(save))+');')
                page.add_init_script('window.AudioContext=class {constructor(){throw Error("audio unavailable probe");}};' if broken else audio_probe)
                page.goto(args.base,wait_until='networkidle');wait(page,'document.querySelector("#exp-root")?.dataset.ready==="true"')
                action(page,'#exp-begin');assert state(page)['safe']==safe,state(page)
                return page
            def interact(page,target):
                assert state(page)['target']==target,(target,state(page))
                if mobile: action(page,'#exp-interact')
                else: page.keyboard.press('e');settle(page)
            def walk(page,x,y):
                for axis,value in [('x',x),('y',y)]:
                    current=state(page)[axis]
                    if abs(value-current)<4:continue
                    positive=value>current;key=('d' if positive else 'a') if axis=='x' else ('s' if positive else 'w')
                    if mobile:
                        box=page.locator('#exp-stick').bounding_box();point={'id':17,'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'radiusX':5,'radiusY':5,'force':1}
                        cdp=page.context.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
                        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{**point,axis:point[axis]+(32 if positive else -32)}]})
                    else:page.keyboard.down(key)
                    try:wait(page,'([n,v,p])=>p ? +document.querySelector("#exp-root").dataset[n]>=v-3 : +document.querySelector("#exp-root").dataset[n]<=v+3',[axis,value,positive])
                    finally:
                        if mobile:cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});cdp.detach()
                        else:page.keyboard.up(key)
                    settle(page)
            def figure(page,word):
                assert page.locator('#exp-investigation').is_visible()
                wait(page,'(()=>{const i=document.querySelector("#exp-investigation-image");return i.complete&&i.naturalWidth>0;})()')
                assert word in page.locator('#exp-investigation-title').inner_text()
                assert page.locator('#exp-investigation-image').bounding_box()['width']>=280
                fits(page,'#exp-close')
            try:
                page=opened('cGuideH3','accepted');shot(page,size+'-guide-door')
                interact(page,'guide-door');walk(page,950,700);walk(page,950,350);interact(page,'note')
                figure(page,'纹样');before=state(page)['progress'];shot(page,size+'-guide-comparison')
                page.keyboard.press('Escape');settle(page)
                assert state(page)['clue']=='false' and state(page)['progress']==before
                action(page,'#exp-resume');interact(page,'note');action(page,'#exp-close');assert state(page)['clue']=='true'
                walk(page,950,700);walk(page,300,700);shot(page,size+'-guide-stairs');interact(page,'guide-down')
                assert state(page)['map']=='guide';check(size+' guide diagram, cancel/confirm and signed stairs retain their original connection')
                page=opened('cWood3Door','accepted');walk(page,760,700);walk(page,760,430);interact(page,'plaque');figure(page,'导扣')
                assert '先看清纹样' in page.locator('#exp-investigation-caption').inner_text()
                shot(page,size+'-clasp');action(page,'#exp-close');assert state(page)['item']=='true' and state(page)['clue']=='false'
                interact(page,'plaque');figure(page,'随身');action(page,'#exp-close')
                check(size+' item-first comparison is visual, repeated inspection stays read-only')
                page=opened('cMiddleGate','clue');interact(page,'gate');figure(page,'比对')
                assert '还需要' in page.locator('#exp-investigation-caption').inner_text()
                action(page,'#exp-close');assert state(page)['unlocked']=='false' and state(page)['gateSound']=='idle'
                assert stage(page)['gateOpening']=='0';check(size+' missing clasp cannot unlock or play sound')
                page=opened('cMiddleGate','equipped');shot(page,size+'-gate-closed');interact(page,'gate');figure(page,'比对');shot(page,size+'-gate-comparison')
                before=state(page)['progress'];page.keyboard.press('Escape');settle(page)
                assert state(page)['progress']==before and state(page)['unlocked']=='false' and state(page)['gateSound']=='idle'
                action(page,'#exp-resume');interact(page,'gate');action(page,'#exp-close')
                assert state(page)['unlocked']=='true';assert page.locator('#exp-gate-feedback').is_visible()
                opening=float(stage(page)['gateOpening']);assert 0<=opening<1,opening
                page.keyboard.press('Escape');settle(page);frozen=stage(page)['gateOpening'];tick=state(page)['tick']
                # Real-time wait here tests that the paused simulation does not advance the rail.
                page.wait_for_timeout(350)
                assert stage(page)['gateOpening']==frozen and state(page)['tick']==tick
                action(page,'#exp-resume');wait(page,'document.querySelector("#exp-stage").dataset.gateOpening==="1"')
                wait(page,'window.__gateAudio.closed===1')
                assert page.evaluate('window.__gateAudio')=={'created':1,'oscillators':2,'closed':1}
                assert state(page)['gateSound']=='scheduled';shot(page,size+'-gate-open')
                count=(stage(page)['mapObjects'],stage(page)['sceneObjects']);saved=state(page)['progress']
                for _ in range(2):interact(page,'gate');action(page,'#exp-close')
                assert state(page)['progress']==saved and page.evaluate('window.__gateAudio.created')==1
                for _ in range(2):
                    walk(page,2000,990);walk(page,2000,1050);interact(page,'middle-east-lower');assert state(page)['map']=='lower'
                    walk(page,2000,610);interact(page,'east-up');assert state(page)['map']=='middle'
                    assert stage(page)['gateOpening']=='1' and stage(page)['gateAnimating']=='false'
                    assert (stage(page)['mapObjects'],stage(page)['sceneObjects'])==count
                page.reload(wait_until='networkidle');wait(page,'document.querySelector("#exp-root")?.dataset.ready==="true"');action(page,'#exp-begin')
                assert state(page)['unlocked']=='true' and stage(page)['gateOpening']=='1' and state(page)['gateSound']=='idle'
                assert not page.locator('#exp-gate-feedback').is_visible() and page.evaluate('window.__gateAudio.created')==0
                check(size+' cancel silent; commit animates once, pauses, opens real route; repeated travel/reload stable with no replay')
                if not mobile:
                    page=opened('cMiddleGate','equipped',reduce=True,broken=True);interact(page,'gate');action(page,'#exp-close')
                    assert state(page)['unlocked']=='true' and stage(page)['gateOpening']=='1' and stage(page)['gateAnimating']=='false'
                    assert state(page)['gateSound']=='unavailable';check('Reduced motion shows final state immediately; unavailable audio never blocks unlock')
                    page=opened('cWood1Door','equipped');shot(page,'workshop-1f-locked');interact(page,'workshop-exit')
                    assert state(page)['map']=='workshop' and not page.locator('#exp-investigation').is_visible()
                    action(page,'#exp-close');check('Wood 1F sealed door remains sealed; unrelated dialogue has no comparison panel')
            finally:
                for context in contexts:context.close()
        assert not report['pageErrors'] and not report['networkErrors'],report
        check('All contexts: no page/network errors; user browser saves and original 4199 server untouched')
    except Exception as e:
        report['failure']=repr(e)
        if 'page' in locals() and not page.is_closed():report['lastState']=state(page)
        raise
    finally:
        browser.close();report['cleanup']='Owned contexts/browser closed; external server preserved'
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(str(OUT),flush=True)
