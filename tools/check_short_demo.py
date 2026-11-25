"""SHORT-DEMO-01 UI checks with isolated valid-save fixtures, not a fresh A-to-D run."""
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
parser.add_argument('--keyboard-ui', action='store_true', help='Also check modal focus and fine-pointer narrow-window hints')
args = parser.parse_args()
TASK = 'KEYBOARD-UI-01' if args.keyboard_ui else 'SHORT-DEMO-01'
OUT = ROOT / 'test-results' / TASK.lower() / datetime.now(timezone.utc).strftime('ui-%Y%m%dT%H%M%SZ')
OUT.mkdir(parents=True, exist_ok=True)
fixture_code = """
import {emptyExplorationSave,validateExplorationSave} from './src/core/exploration.ts';
import {InMemoryRunProgress,EXP02A_PROGRESS_CONTENT as P} from './src/core/progress.ts';
const states={};
for(const [name,flags] of Object.entries({empty:[],accepted:['accepted'],equipped:['accepted','clue','item'],opened:['accepted','clue','item','unlocked']})){
 const p=new InMemoryRunProgress('exp03b');
 for(const f of flags)f==='item'?p.recordCollection(P.item):p.completeGoal(P[f]);
 states[name]={...emptyExplorationSave(),progress:p.snapshot};
}
console.log(JSON.stringify(states));
"""
fixtures = json.loads(subprocess.check_output(['node', '--experimental-strip-types', '--input-type=module', '-e', fixture_code], cwd=ROOT).decode('utf-8'))
exe = next(p for p in [Path.home() / 'AppData/Local/Google/Chrome/Application/chrome.exe', Path('C:/Program Files/Google/Chrome/Application/chrome.exe')] if p.exists())
report = {'task': TASK, 'base': args.base, 'fixture': 'Valid current saves at named safety points in separate browser contexts; no runtime teleport or progress mutation.', 'checks': [], 'pageErrors': [], 'networkErrors': [], 'screenshots': [], 'realDevices': 'NOT RUN', 'sourceHashes': {}}
for file in ['src/core/exploration.ts', 'src/platform/web/exploration.ts', 'src/platform/web/exploration-ui.ts', 'src/platform/web/exploration-ui.css', 'src/platform/web/exploration-input.ts', 'src/platform/web/exploration-journal.ts', 'tools/check_short_demo.py', 'dist/index.html']:
    report['sourceHashes'][file] = hashlib.sha256((ROOT / file).read_bytes()).hexdigest()

def state(page):
    return page.locator('#exp-root').evaluate('(e)=>({...e.dataset,x:+e.dataset.x,y:+e.dataset.y})')

def wait(page, expression, arg=None):
    page.wait_for_function(expression, arg=arg, timeout=20000, polling='raf')

def settle(page):
    page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')

def check(name):
    report['checks'].append({'name': name, 'status': 'PASS'})
    print('PASS', name, flush=True)

def shot(page, name):
    path = OUT / (name + '.png')
    page.screenshot(path=str(path))
    report['screenshots'].append(str(path.relative_to(ROOT)))

def fits(page, selector):
    element = page.locator(selector)
    element.scroll_into_view_if_needed()
    assert element.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>=40&&r.x>=-1&&r.right<=innerWidth+1&&r.y>=-1&&r.bottom<=innerHeight+1;}'), selector

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=str(exe), headless=True)
    report['browser'] = {'executable': str(exe), 'version': browser.version}
    try:
        for width, height, mobile in [(1280, 760, False), (844, 390, True), (667, 375, True)]:
            size = f'{width}x{height}'
            contexts = []
            def opened(safe, progress):
                context = browser.new_context(viewport={'width':width,'height':height}, is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
                contexts.append(context)
                page = context.new_page()
                page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                page.on('requestfailed', lambda r: report['networkErrors'].append({'url':r.url,'failure':r.failure}))
                page.on('response', lambda r: report['networkErrors'].append({'url':r.url,'status':r.status}) if r.status >= 400 else None)
                save = {**fixtures[progress], 'safe':safe}
                page.add_init_script('if (!localStorage.getItem("pokan.exp06a.save.v1")) localStorage.setItem("pokan.exp06a.save.v1", '+json.dumps(json.dumps(save))+');')
                page.goto(args.base, wait_until='networkidle')
                wait(page, 'document.querySelector("#exp-root")?.dataset.ready === "true"')
                action(page, '#exp-begin')
                wait(page, 'document.querySelector("#exp-root").dataset.view === "play"')
                assert state(page)['safe'] == safe, state(page)
                return page

            def action(page, selector):
                page.locator(selector).tap() if mobile else page.locator(selector).click()
                settle(page)

            def interact(page, target):
                assert state(page)['target'] == target, (target, state(page))
                if mobile:
                    action(page, '#exp-interact')
                else:
                    page.keyboard.press('e')
                    settle(page)

            def walk(page, x, y):
                for axis, value in [('x',x),('y',y)]:
                    current = state(page)[axis]
                    if abs(value-current) < 4:
                        continue
                    positive = value > current
                    key = ('d' if positive else 'a') if axis == 'x' else ('s' if positive else 'w')
                    if mobile:
                        box = page.locator('#exp-stick').bounding_box()
                        point = {'id':17,'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'radiusX':5,'radiusY':5,'force':1}
                        cdp = page.context.new_cdp_session(page)
                        cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[point]})
                        offset = 32 if positive else -32
                        cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{**point,axis:point[axis]+offset}]})
                    else:
                        page.keyboard.down(key)
                    try:
                        wait(page, '([n,v,p])=>p ? +document.querySelector("#exp-root").dataset[n]>=v-3 : +document.querySelector("#exp-root").dataset[n]<=v+3', [axis,value,positive])
                    finally:
                        if mobile:
                            cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                            cdp.detach()
                        else:
                            page.keyboard.up(key)
                    settle(page)

            try:
                page = opened('entryFromCity', 'empty')
                walk(page, 1100, 850)
                walk(page, 1100, 800)
                interact(page, 'visitor')
                assert page.locator('#exp-close').inner_text() == '接受委托 · E'
                if args.keyboard_ui:
                    shot(page, size+'-focus-open')
                    assert page.evaluate('document.activeElement.id') == 'exp-close', 'Dialogue focus remained behind the panel'
                    for key in ['Tab', 'Shift+Tab']:
                        page.keyboard.press(key)
                        assert page.evaluate('document.activeElement.id') == 'exp-close'
                    assert state(page)['accepted'] == 'false'
                assert '不必折返找我' in page.locator('#exp-dialogue-text').inner_text()
                fits(page, '#exp-close')
                shot(page, size+'-accept')
                page.keyboard.press('Escape')
                assert state(page)['accepted'] == 'false'
                if args.keyboard_ui:
                    assert page.evaluate('document.activeElement.id') == 'exp-resume'
                action(page, '#exp-resume')
                interact(page, 'visitor')
                if args.keyboard_ui and not mobile:
                    page.keyboard.press('Enter'); settle(page)
                else:
                    action(page, '#exp-close')
                assert state(page)['accepted'] == 'true'
                if args.keyboard_ui:
                    assert page.evaluate('document.activeElement.getClientRects().length>0')
                    assert not page.evaluate('document.querySelector("#exp-dialogue").contains(document.activeElement)')
                check(size+' explicit accept action; cancel preserves state; confirm commits')

                page = opened('cGuideH3', 'accepted')
                before = state(page)['progress']
                action(page, '#exp-notes-toggle')
                old_direction = page.locator('#exp-quest-text').inner_text()
                assert '导览楼2F' in old_direction and '木作楼3F' in old_direction
                action(page, '#exp-notes-close')
                interact(page, 'guide-door')
                assert state(page)['map'] == 'guide2'
                assert '2F东侧阅览桌' in page.locator('#exp-objective').inner_text()
                action(page, '#exp-notes-toggle')
                new_direction = page.locator('#exp-quest-text').inner_text()
                assert old_direction != new_direction and '2F东侧阅览桌' in new_direction
                assert state(page)['progress'] == before
                shot(page, size+'-notebook')
                action(page, '#exp-notes-close')
                walk(page, 950, 700)
                walk(page, 950, 350)
                interact(page, 'note')
                assert page.locator('#exp-close').inner_text() == '记下导览 · E'
                fits(page, '#exp-close')
                shot(page, size+'-note')
                if args.keyboard_ui:
                    assert page.evaluate('document.activeElement.id') == 'exp-close'
                if args.keyboard_ui and not mobile:
                    page.keyboard.press('Escape'); action(page, '#exp-resume')
                    page.keyboard.down('Space'); settle(page)
                    assert state(page)['dialogue'] == 'true' and state(page)['clue'] == 'false'
                    page.keyboard.down('Space'); settle(page)
                    page.keyboard.up('Space'); settle(page)
                    assert state(page)['clue'] == 'false', 'Opening Space release/repeat must not submit'
                    page.keyboard.press('Space'); settle(page)
                else:
                    action(page, '#exp-close')
                assert state(page)['clue'] == 'true'
                interact(page, 'note')
                assert page.locator('#exp-close').inner_text() == '收起 · E'
                action(page, '#exp-close')
                check(size+' map-aware HUD and notebook refresh without progress changes; note action and repeat')

                page = opened('cWood3Door', 'accepted')
                walk(page, 760, 700)
                walk(page, 760, 430)
                interact(page, 'plaque')
                assert page.locator('#exp-close').inner_text() == '带上导扣 · E'
                fits(page, '#exp-close')
                action(page, '#exp-close')
                assert state(page)['item'] == 'true' and state(page)['clue'] == 'false'
                assert '查看楼层与纹样导览' in page.locator('#exp-objective').inner_text()
                check(size+' item-first remains legal and guidance requests missing clue')

                page = opened('cMiddleGate', 'equipped')
                interact(page, 'gate')
                assert page.locator('#exp-close').inner_text() == '转动导扣，开门 · E'
                fits(page, '#exp-close')
                shot(page, size+'-gate')
                action(page, '#exp-close')
                assert state(page)['unlocked'] == 'true'
                check(size+' gate confirmation has explicit action and retains original unlock')

                page = opened('riverView', 'opened')
                interact(page, 'view')
                assert 'E／空格只返回探索，不会拍摄' in page.locator('#exp-photo').inner_text()
                assert state(page)['photographed'] == 'false'
                if args.keyboard_ui:
                    assert page.evaluate('document.activeElement.id') == 'exp-photo-close'
                    page.keyboard.press('Tab')
                    assert page.evaluate('document.activeElement.id') == 'exp-shutter'
                    page.keyboard.press('Shift+Tab')
                    assert page.evaluate('document.activeElement.id') == 'exp-photo-close'
                    if not mobile:
                        page.keyboard.press('Enter'); settle(page)
                        assert state(page)['preview'] == '' and state(page)['photographed'] == 'false'
                        interact(page, 'view')
                page.keyboard.press('e')
                settle(page)
                assert state(page)['preview'] == '' and state(page)['photographed'] == 'false'
                assert '拍摄这一刻' in page.locator('#exp-objective').inner_text()
                interact(page, 'view')
                fits(page, '#exp-shutter')
                image = page.locator('#exp-photo-image').bounding_box()
                assert image and image['width'] > 100 and image['height'] > 60, image
                shot(page, size+'-shutter')
                if args.keyboard_ui and not mobile:
                    page.keyboard.press('Tab')
                    assert page.evaluate('document.activeElement.id') == 'exp-shutter'
                    page.keyboard.press('Enter'); settle(page)
                else:
                    action(page, '#exp-shutter')
                assert state(page)['photographed'] == 'true' and state(page)['cardOpen'] == 'true'
                assert '无需返回游客处交付' in page.locator('#exp-photo-card').inner_text()
                fits(page, '#exp-card-close')
                shot(page, size+'-completed')
                action(page, '#exp-card-close')
                assert '无需返程交付' in page.locator('#exp-objective').inner_text()
                page.reload(wait_until='networkidle')
                wait(page, 'document.querySelector("#exp-root")?.dataset.ready === "true"')
                action(page, '#exp-begin')
                assert state(page)['photographed'] == 'true'
                check(size+' preview/E does not photograph; visible shutter completes; card and reload retain result')

                if args.keyboard_ui:
                    page = opened('cGuide1Door', 'empty')
                    walk(page, 780, 540); walk(page, 780, 490)
                    interact(page, 'memento-bookmark')
                    assert page.evaluate('document.activeElement.id') == 'exp-close'
                    page.keyboard.press('Tab')
                    assert page.evaluate('document.activeElement.id') == 'exp-memento-cancel'
                    settle(page)
                    assert page.evaluate('document.activeElement.id') == 'exp-memento-cancel', 'Frames must not steal focus'
                    page.keyboard.press('Shift+Tab')
                    assert page.evaluate('document.activeElement.id') == 'exp-close'
                    page.keyboard.press('Tab')
                    if mobile: action(page, '#exp-memento-cancel')
                    else: page.keyboard.press('Enter'); settle(page)
                    assert state(page)['mementos'] == '[]' and state(page)['dialogue'] == 'false'
                    interact(page, 'memento-bookmark')
                    if mobile: action(page, '#exp-close')
                    else: page.keyboard.press('Enter'); settle(page)
                    assert json.loads(state(page)['mementos']) == ['bookmark']
                    interact(page, 'memento-bookmark')
                    assert page.locator('#exp-memento-cancel').is_hidden()
                    page.keyboard.press('Tab')
                    assert page.evaluate('document.activeElement.id') == 'exp-close'
                    action(page, '#exp-close')
                    check(size+' modal entry/restoration, Tab loop, native activation, memento cancel/collect/repeat')

                    page = opened('chapterStart', 'empty')
                    if mobile:
                        assert page.locator('#exp-help').is_hidden()
                        assert page.locator('#exp-stick').is_visible()
                        check(size+' coarse-pointer controls unchanged; no keyboard hint overlap')
                    else:
                        walk(page, 900, 790); walk(page, 900, 880)
                        assert state(page)['target'] == 'city-monument'
                        for w,h in [(1280,760),(855,652),(667,375),(390,844)]:
                            page.set_viewport_size({'width':w,'height':h}); settle(page)
                            assert page.locator('#exp-help').is_visible()
                            assert page.locator('#exp-stick').is_hidden()
                            assert page.evaluate('''()=>{
                              const h=document.querySelector('#exp-help').getBoundingClientRect(),p=document.querySelector('#exp-prompt').getBoundingClientRect();
                              return h.left>=0&&h.right<=innerWidth&&h.top>=0&&h.bottom<=innerHeight&&p.bottom<=h.top;
                            }'''), 'Keyboard help and interaction prompt must fit without overlap'
                            shot(page, f'{w}x{h}-keyboard-hints')
                            action(page, '#exp-menu-button')
                            assert page.locator('#exp-help').is_hidden()
                            action(page, '#exp-resume')
                        check('Four fine-pointer sizes retain keyboard hints without overlap; menu still hides hints')
            finally:
                for context in contexts:
                    context.close()
        assert not report['pageErrors'] and not report['networkErrors'], report
        check('No page or asset errors in all isolated desktop/touch contexts')
    except Exception as error:
        report['failure'] = repr(error)
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
        browser.close()
        print(str(OUT), flush=True)
