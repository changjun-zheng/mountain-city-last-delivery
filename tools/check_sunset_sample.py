"""Isolated local-browser checks. Never uses the user's browser profile or save."""
import argparse
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://127.0.0.1:4199/')
parser.add_argument('--phase', choices=['before', 'after', 'after-production'], default='before')
args = parser.parse_args()
OUT = ROOT / 'test-results' / 'sunset-sample' / args.phase
OUT.mkdir(parents=True, exist_ok=True)
fixture = json.loads(subprocess.check_output([
    'node', '--experimental-strip-types', '--input-type=module', '-e',
    "import {emptyExplorationSave} from './src/core/exploration.ts'; console.log(JSON.stringify(emptyExplorationSave()));"
], cwd=ROOT, text=True))
exe = next(p for p in [
    Path('C:/Program Files/Google/Chrome/Application/chrome.exe'),
    Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'),
] if p.exists())
report = {'phase': args.phase, 'base': args.base, 'fixture': 'Isolated empty current save at cGuideH3; not a fresh A-to-D run.',
          'checks': [], 'pageErrors': [], 'networkErrors': [], 'screenshots': [], 'realDevices': 'NOT RUN'}

def state(page):
    return page.locator('#exp-root').evaluate('(e) => ({...e.dataset, x:+e.dataset.x, y:+e.dataset.y, tick:+e.dataset.tick})')

def wait(page, expression, arg=None):
    return page.wait_for_function(expression, arg=arg, timeout=15000, polling='raf')

def axis(page, name, value):
    current = state(page)[name]
    if abs(value-current) < 4:
        return
    positive = value > current
    key = ('d' if positive else 'a') if name == 'x' else ('s' if positive else 'w')
    page.keyboard.down(key)
    try:
        wait(page, '([n,v,p]) => p ? +document.querySelector("#exp-root").dataset[n] >= v-3 : +document.querySelector("#exp-root").dataset[n] <= v+3', [name,value,positive])
    finally:
        page.keyboard.up(key)

def walk(page, x, y):
    axis(page, 'x', x)
    axis(page, 'y', y)

def interact(page, target, touch=False):
    assert state(page)['target'] == target, (target, state(page))
    if touch:
        page.locator('#exp-interact').tap()
    else:
        page.keyboard.press('e')
    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')

def shot(page, name):
    path = OUT / (name + '.png')
    page.screenshot(path=str(path))
    report['screenshots'].append(str(path.relative_to(ROOT)))

def check(name, details=None):
    report['checks'].append({'name': name, 'status': 'PASS', 'details': details})
    print('PASS', name, flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=str(exe), headless=True)
    try:
        def opened(safe='cGuideH3', mobile=False, size=None):
            context = browser.new_context(viewport=size or {'width':1280,'height':720}, is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
            page = context.new_page()
            page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
            page.on('requestfailed', lambda r: report['networkErrors'].append({'url':r.url,'failure':r.failure}))
            page.on('response', lambda r: report['networkErrors'].append({'url':r.url,'status':r.status}) if r.status >= 400 else None)
            save = {**fixture, 'safe':safe}
            page.add_init_script('if (!localStorage.getItem("pokan.exp06a.save.v1")) localStorage.setItem("pokan.exp06a.save.v1", '+json.dumps(json.dumps(save))+');')
            page.goto(args.base, wait_until='networkidle')
            wait(page, 'document.querySelector("#exp-root")?.dataset.ready === "true"')
            page.locator('#exp-begin').tap() if mobile else page.locator('#exp-begin').click()
            wait(page, 'document.querySelector("#exp-root")?.dataset.view === "play"')
            return context, page

        context, page = opened()
        shot(page, 'upper-door-desktop')
        walk(page, 1100, 670)
        shot(page, 'upper-street-desktop')
        walk(page, 710, 560)
        interact(page, 'guide-door')
        assert state(page)['map'] == 'guide2'
        shot(page, 'guide2-door-desktop')
        walk(page, 950, 700)
        walk(page, 950, 370)
        shot(page, 'guide2-reading-desktop')
        if args.phase != 'before':
            interact(page, 'note')
            assert state(page)['dialogue'] == 'true'
            page.locator('#exp-close').click()
            assert state(page)['clue'] == 'true'
            check('Existing note interaction and progress retained')
            walk(page, 950, 700)
            walk(page, 300, 700)
            interact(page, 'guide-down')
            assert state(page)['map'] == 'guide'
            check('Original 2F to 1F route retained; 1F artwork unchanged')
            walk(page, 820, 540)
            interact(page, 'guide-up')
            assert state(page)['map'] == 'guide2'
            walk(page, 1100, 700)
            interact(page, 'guide-upper-exit')
            assert state(page)['map'] == 'upper'
            assert abs(state(page)['x']-710) < 4 and abs(state(page)['y']-560) < 4
            check('Enter and return to matching upper-street doorway')
            page.keyboard.down('w')
            page.wait_for_timeout(700)
            page.keyboard.up('w')
            assert 531 <= state(page)['y'] <= 537, state(page)
            shot(page, 'upper-collision-desktop')
            check('Visible facade blocks feet at original y=532 collision line')
            walk(page, 710, 560)
            object_counts = []
            for _ in range(4):
                interact(page, 'guide-door')
                object_counts.append(page.locator('#exp-stage').get_attribute('data-map-objects'))
                interact(page, 'guide-upper-exit')
            assert len(set(object_counts)) == 1, object_counts
            check('Repeated entry leaves stable map object count', object_counts)
            before = state(page)
            page.locator('#exp-menu-button').click()
            paused = state(page)
            page.wait_for_timeout(250)
            assert state(page)['tick'] == paused['tick']
            page.locator('#exp-resume').click()
            check('Pause still freezes simulation')
            page.reload(wait_until='networkidle')
            wait(page, 'document.querySelector("#exp-root")?.dataset.ready === "true"')
            page.locator('#exp-begin').click()
            assert state(page)['map'] == 'upper' and state(page)['clue'] == before['clue']
            check('Current save reload retains location and clue')
        context.close()
        for size in [{'width':844,'height':390}, {'width':390,'height':844}]:
            context, page = opened(mobile=True, size=size)
            shot(page, f'upper-{size["width"]}x{size["height"]}')
            interact(page, 'guide-door', touch=True)
            assert state(page)['map'] == 'guide2'
            shot(page, f'guide2-{size["width"]}x{size["height"]}')
            if args.phase != 'before':
                interact(page, 'guide-upper-exit', touch=True)
                assert state(page)['map'] == 'upper'
                box = page.locator('#exp-stick').bounding_box()
                cdp = context.new_cdp_session(page)
                point = {'id':17,'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'radiusX':5,'radiusY':5,'force':1}
                x0 = state(page)['x']
                cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[point]})
                cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{**point,'x':point['x']+32}]})
                try:
                    wait(page, '(x) => +document.querySelector("#exp-root").dataset.x > x+24', x0)
                finally:
                    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                check(f'{size["width"]}x{size["height"]} emulated touch entry/exit and joystick movement')
                fit = page.locator('#exp-stage canvas').evaluate('(e) => {const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && r.left>=-1 && r.right<=innerWidth+1;}')
                assert fit
            context.close()
        assert not report['pageErrors'] and not report['networkErrors'], report
        check('No page exceptions or failed HTTP/asset requests')
    except Exception as error:
        report['failure'] = str(error)
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
        browser.close()
