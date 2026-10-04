"""Exercise the actual WebKitGTK/Tauri binary through the official tauri-driver.
Run inside dbus-run-session + xvfb-run; requires tauri-driver, WebKitWebDriver, and xdotool.
"""
import base64
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[2]
binary = root / 'src-tauri/target/release/folio'
# Keep the app on the same Xvfb display as xdotool, even on WSLg/Wayland hosts.
os.environ['GDK_BACKEND'] = 'x11'
driver = subprocess.Popen([str(Path.home() / '.cargo/bin/tauri-driver'), '--port', '4444'], stdout=subprocess.DEVNULL)
session = None

def request(method, route, data=None):
    encoded = json.dumps(data).encode() if data is not None else None
    with urlopen(Request('http://127.0.0.1:4444' + route, data=encoded, method=method, headers={'Content-Type': 'application/json'}), timeout=40) as response:
        return json.load(response)['value']

def execute(script):
    return request('POST', f'/session/{session}/execute/sync', {'script': script, 'args': []})

def wait_for(script, message):
    for _ in range(100):
        if execute(script):
            return
        time.sleep(.1)
    raise AssertionError(message + '\n' + str(execute('return document.body.innerText')))

try:
    for _ in range(50):
        try:
            request('GET', '/status')
            break
        except Exception:
            time.sleep(.1)
    result = request('POST', '/session', {'capabilities': {'alwaysMatch': {'tauri:options': {
        'application': str(binary), 'args': [str(root / 'tests/fixtures/markdown/reading.md')]
    }}}})
    session = result['sessionId']
    wait_for("return document.querySelector('.prose h1')?.textContent === 'A quieter way to read'", 'Markdown did not render')
    window = subprocess.check_output(['xdotool', 'search', '--sync', '--onlyvisible', '--name', 'Folio$'], text=True, timeout=10).splitlines()[0]
    subprocess.run(['xdotool', 'windowfocus', '--sync', window], check=True)
    subprocess.run(['xdotool', 'key', '--clearmodifiers', 'ctrl+comma'], check=True)
    wait_for("return document.querySelector('dialog[open] h2')?.textContent === 'Appearance'", 'Native Appearance accelerator failed')
    execute("document.querySelector('input[value=light]').click()")
    wait_for("return document.documentElement.dataset.theme === 'light'", 'Light theme failed')
    execute("document.querySelector('input[value=dark]').click()")
    wait_for("return document.documentElement.dataset.theme === 'dark'", 'Dark theme failed')
    execute("document.querySelector('dialog .dialog-footer button').click()")
    wait_for("return !document.querySelector('dialog')", 'Appearance did not close')
    subprocess.run(['xdotool', 'key', '--clearmodifiers', 'F1'], check=True)
    wait_for("return document.querySelector('dialog[open]')?.textContent.includes('Derek Diaz Correa')", 'Native About accelerator failed')
    assert execute("return document.querySelector('dialog').textContent.includes('Tabierto')")
    execute("document.querySelector('dialog .dialog-footer button').click()")
    wait_for("return !document.querySelector('dialog')", 'About did not close')
    subprocess.run(['xdotool', 'key', '--clearmodifiers', 'ctrl+f'], check=True)
    wait_for("return !!document.querySelector('.search-bar')", 'Native Find accelerator failed')
    execute("document.querySelector('[aria-label=\"Close search\"]').click()")
    assert execute("return document.querySelectorAll('.prose script, .prose iframe, .prose img[src^=https]').length") == 0
    for file in ['docx/reading.docx', 'pdf/reading.pdf', 'csv/reading.csv', 'images/safe.svg']:
        subprocess.run([str(binary), str(root / 'tests/fixtures' / file)], check=True, timeout=10)
        name = json.dumps(file.split('/')[-1])
        wait_for(f"return document.querySelector('[aria-selected=true]')?.textContent.includes({name})", 'Single-instance opening failed')
        if file.startswith('docx'):
            wait_for("return document.querySelector('.prose h1')?.textContent === 'A quieter way to read'", 'DOCX did not render')
        elif file.startswith('pdf'):
            wait_for("return document.querySelector('.textLayer')?.textContent.includes('Folio PDF fixture')", 'PDF text layer did not render')
            assert execute("return document.querySelector('.pdf-page canvas')?.width > 0")
            print('Native display metrics:', execute('return {dpr: devicePixelRatio, cssWidth: innerWidth, cssHeight: innerHeight}'))
            execute("document.querySelector('[aria-label=\"Viewing mode: Fit width\"]').click()")
            execute("Array.from(document.querySelectorAll('[role=menuitemradio]')).find(item => item.textContent === 'Fit page').click()")
            fit_check = "const area = document.querySelector('.pdf-scroll'); const page = area.querySelector('.pdf-page').getBoundingClientRect(); const bounds = area.getBoundingClientRect(); return page.top >= bounds.top && page.bottom <= bounds.bottom && page.width <= area.clientWidth"
            wait_for(fit_check, 'Fit page does not fit the complete page')
            subprocess.run(['xdotool', 'windowsize', '--sync', window, '700', '620'], check=True)
            wait_for('return innerWidth < 760', 'Native window did not resize')
            wait_for(fit_check, 'Fit page did not respond to resizing')
            assert execute("const bar = document.querySelector('.toolbar'); return bar.scrollWidth <= bar.clientWidth")
            execute("document.querySelector('[aria-label=\"More document actions: More\"]').focus()")
            subprocess.run(['xdotool', 'key', '--clearmodifiers', 'Down'], check=True)
            wait_for("return document.activeElement?.textContent === 'Print…'", 'Overflow menu focus failed')
            subprocess.run(['xdotool', 'key', '--clearmodifiers', 'Down'], check=True)
            wait_for("return document.activeElement?.textContent === 'Open With…'", 'Open With keyboard access failed')
            subprocess.run(['xdotool', 'key', '--clearmodifiers', 'Escape'], check=True)
            wait_for("return document.activeElement?.getAttribute('aria-label') === 'More document actions: More'", 'Overflow focus did not return')
            output = root / 'output/playwright'
            output.mkdir(parents=True, exist_ok=True)
            (output / 'linux-usability-narrow.png').write_bytes(base64.b64decode(request('GET', f'/session/{session}/screenshot')))
            subprocess.run(['xdotool', 'windowsize', '--sync', window, '1100', '780'], check=True)
            wait_for('return innerWidth > 1000', 'Native window did not expand')
            wait_for(fit_check, 'Fit page did not respond to expanding')
            (output / 'linux-usability-wide.png').write_bytes(base64.b64decode(request('GET', f'/session/{session}/screenshot')))
        elif file.startswith('csv'):
            wait_for("return document.querySelector('.csv-table')?.textContent.includes('Read, then think')", 'CSV did not render')
        else:
            wait_for("return document.querySelector('.image-document')?.naturalWidth === 640", 'SVG did not render')
    assert execute("return document.querySelectorAll('[role=tab]').length") == 5
    output = root / 'output/playwright'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'linux-native.png').write_bytes(base64.b64decode(request('GET', f'/session/{session}/screenshot')))
    print('Linux native smoke passed: native Appearance/About/Find accelerators, theme switching, fit page, actual window resizing, keyboard overflow including Open With, WebKitGTK rendering, CLI/single instance, Markdown, DOCX, PDF, CSV, SVG.')
finally:
    if session:
        request('DELETE', f'/session/{session}')
    driver.terminate()
    driver.wait(timeout=5)
