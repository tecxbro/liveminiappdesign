"""Optional offline browser checks. Requires Python playwright + a Chromium executable.

The real Node host serves the fixture HTML to Python over loopback. Layout rendering
uses the shipped HTML/CSS with assets inlined, so it needs no browser network access.
Client refresh tests execute the shipped client code with a stubbed fetch boundary.
This is NOT Spectrum or physical-device verification.
"""
import base64
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
if not CHROMIUM:
    raise SystemExit('Set CHROMIUM_PATH to a Chromium executable.')
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
proc = subprocess.Popen(['node', 'scripts/preview.mjs'], cwd=ROOT,
    env={**os.environ, 'PORT': str(port)}, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
base = f'http://127.0.0.1:{port}'

def get(path):
    return urlopen(base + path, timeout=5).read().decode()

try:
    for _ in range(80):
        try:
            get('/health'); break
        except Exception:
            if proc.poll() is not None:
                raise RuntimeError(proc.stderr.read().decode())
            time.sleep(.05)
    css = (ROOT/'public/card.css').read_text()
    def html_for(name):
        html = get('/demo/' + name)
        html = html.replace('<link rel="stylesheet" href="/card.css">', '<style>' + css + '</style>')
        html = html.replace('<script type="module" src="/card-client.mjs"></script>', '')
        for asset in ['study', 'hands']:
            data = base64.b64encode((ROOT/f'public/assets/{asset}.png').read_bytes()).decode()
            html = html.replace(f'src="/assets/{asset}.png"', f'src="data:image/png;base64,{data}"')
        return html
    results = {'layout': [], 'client': [], 'notes': [
        'Offline browser layout; shipped assets inlined without visual modification.',
        'Client code evaluated with synthetic capability/query and stubbed fetch; no external network.',
        'No iMessage or hosted Redis verification.',
    ]}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=['--no-sandbox'])
        for width, height in [(300, 240), (300, 300), (390, 390)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            for name in ['research', 'checks', 'stages', 'waiting', 'complete', 'unknown']:
                page.set_content(html_for(name), wait_until='load')
                result = page.evaluate('''() => {
                    const card = document.querySelector('.task-card');
                    const footer = document.querySelector('.freshness').getBoundingClientRect();
                    const summary = document.querySelector('.summary').getBoundingClientRect();
                    return { footerBottom: footer.bottom, cardBottom: card.getBoundingClientRect().bottom,
                      summaryHeight: summary.height, scrollWidth: document.documentElement.scrollWidth,
                      buttons: document.querySelectorAll('button,form').length,
                      background: getComputedStyle(card).backgroundColor };
                }''')
                assert result['footerBottom'] <= height
                assert result['cardBottom'] <= height
                assert result['summaryHeight'] >= 48
                assert result['scrollWidth'] <= width
                assert result['buttons'] == 0
                assert result['background'] == 'rgb(7, 21, 42)'
                results['layout'].append({'template': name, 'viewport': [width, height], 'pass': True})
            page.close()
        page = browser.new_page(viewport={'width': 300, 'height': 300})
        page.set_content(html_for('research'))
        page.evaluate('''() => {
          window.currentFixture = JSON.parse(document.querySelector('#card-data').textContent);
          currentFixture.content.header = 'none';
          window.nextFixture = structuredClone(currentFixture);
          nextFixture.revision = 2; nextFixture.content.progress.completed = 28;
          window.fetches = [];
          window.fetch = async (url, options) => {
            fetches.push({url, options});
            if (window.failFetch) throw new Error('offline');
            return new Response(JSON.stringify(nextFixture), {status: 200});
          };
        }''')
        renderer = re.sub(r'^export ', '', (ROOT/'public/card-template.mjs').read_text(), flags=re.M)
        client = (ROOT/'public/card-client.mjs').read_text()
        client = client.replace("import { renderCard } from '/card-template.mjs';", '')
        client = client.replace('new URLSearchParams(location.search)', "new URLSearchParams('?k=synthetic-read-key')")
        page.add_script_tag(content='(() => {\n' + renderer + '\n' + client + '\n})();')
        page.evaluate("dispatchEvent(new Event('pageshow'))")
        page.wait_for_function("document.querySelector('.count').textContent === '28 / 50'")
        assert page.locator('.dot[data-fill="full"]').count() == 28
        results['client'].append({'check': 'new revision updates text and exact dot count', 'pass': True})
        request = page.evaluate('fetches[0]')
        assert request['options']['credentials'] == 'omit'
        assert request['options']['headers']['Authorization'] == 'Bearer synthetic-read-key'
        results['client'].append({'check': 'read request uses only read capability', 'pass': True})
        page.evaluate("nextFixture.revision=1; nextFixture.content.progress.completed=3; dispatchEvent(new Event('pageshow'))")
        page.wait_for_timeout(30)
        assert page.locator('.count').inner_text() == '28 / 50'
        results['client'].append({'check': 'older response cannot regress progress', 'pass': True})
        page.evaluate("window.failFetch=true; dispatchEvent(new Event('pageshow'))")
        page.wait_for_function("document.querySelector('.refresh-note').textContent === 'Updates delayed'")
        assert page.locator('.status').evaluate('(e)=>e.textContent') == 'In progress'
        results['client'].append({'check': 'network failure means delayed updates, not task failure', 'pass': True})
        page.evaluate('''() => {
          failFetch=false; nextFixture.revision=3; nextFixture.content.status='completed';
          nextFixture.content.stages.forEach(s=>s.state='done'); nextFixture.content.progress.completed=50;
          nextFixture.content.detail={title:'Complete',subtitle:'Report delivered in chat'};
          dispatchEvent(new Event('pageshow'));
        }''')
        page.wait_for_function("document.querySelector('.status').textContent === 'Complete'")
        assert page.locator('button,form').count() == 0
        results['client'].append({'check': 'final state uses read-only completion view', 'pass': True})
        page.set_content(html_for('stages'))
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('.activity-ring').evaluate('(e)=>getComputedStyle(e).animationName') == 'none'
        results['client'].append({'check': 'reduced motion suppresses indeterminate animation', 'pass': True})
        results['browser'] = browser.version
        browser.close()
    (ROOT/'evidence/browser-checks.json').write_text(json.dumps(results, indent=2) + '\n')
    print(f"{len(results['layout'])} layout cases and {len(results['client'])} client checks passed.")
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
