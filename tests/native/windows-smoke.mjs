import { chromium, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

if (process.platform !== 'win32') throw new Error('This check uses WebView2 and must run on Windows.');
const binary = path.resolve('src-tauri/target/release/folio.exe');
const fixture = file => path.resolve('tests/fixtures', file);
const env = { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-address=127.0.0.1 --remote-debugging-port=9224' };
const child = spawn(binary, [fixture('markdown/reading.md'), fixture('text/reading.txt')], { env, windowsHide: true, stdio: 'ignore' });
const menu = action => JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('tests/native/windows-menu.ps1'), '-ProcessId', String(child.pid), ...(action ? ['-Action', action] : [])], { encoding: 'utf8', windowsHide: true }));
const windowCommand = (...args) => JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('tests/native/windows-menu.ps1'), '-ProcessId', String(child.pid), ...args], { encoding: 'utf8', windowsHide: true }));
let browser;
let page;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9224'); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert(browser, 'Folio did not expose the test WebView2 session');
  page = browser.contexts()[0].pages()[0];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByText('FIELD NOTES', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tab').count(), 2, 'CLI files should open as tabs');
  assert.deepEqual([...new Set(menu().map(item => item.group))], ['File', 'View', 'Help']);
  menu('Appearance…');
  await page.getByRole('dialog', { name: 'Appearance' }).waitFor();
  await page.getByRole('radio', { name: /^Light/ }).check();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('radio', { name: /^Dark/ }).check();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.screenshot({ path: 'output/playwright/windows-appearance.png' });
  await page.getByRole('button', { name: 'Done' }).click();
  menu('About Folio');
  await page.getByRole('dialog', { name: 'About Folio' }).waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /Tabierto[\s\S]*Derek Diaz Correa/);
  await page.screenshot({ path: 'output/playwright/windows-about.png' });
  await page.getByRole('button', { name: 'Done' }).click();
  menu('Zoom In');
  await page.waitForFunction(() => document.querySelector('.zoom-value')?.textContent === '110%');
  menu('Find in Document…');
  await page.getByRole('textbox', { name: 'Find in document' }).waitFor();
  await page.getByRole('button', { name: 'Close search' }).click();
  const second = spawn(binary, [fixture('docx/reading.docx'), fixture('pdf/reading.pdf')], { windowsHide: true, stdio: 'ignore' });
  await new Promise((resolve, reject) => { second.on('exit', resolve); second.on('error', reject); });
  await page.locator('.textLayer').first().getByText('Folio PDF fixture', { exact: true }).waitFor();
  assert.equal(await page.getByRole('tab').count(), 4, 'Second invocation must reuse the first window');
  console.log('Native display metrics:', windowCommand('-Metrics'), await page.evaluate(() => ({ dpr: devicePixelRatio, cssWidth: innerWidth, cssHeight: innerHeight })));
  menu('Fit Page');
  await expect(page.getByRole('button', { name: 'Viewing mode: Fit page' })).toBeVisible();
  const pageFits = () => page.locator('.pdf-scroll').evaluate(area => {
    const sheet = area.querySelector('.pdf-page').getBoundingClientRect();
    const bounds = area.getBoundingClientRect();
    return sheet.top >= bounds.top && sheet.bottom <= bounds.bottom && sheet.width <= area.clientWidth;
  });
  await expect.poll(pageFits).toBe(true);
  windowCommand('-Width', '700', '-Height', '620');
  await page.waitForFunction(() => innerWidth < 760);
  await expect.poll(pageFits).toBe(true);
  await expect.poll(() => page.locator('.toolbar').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'More document actions: More' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Print…' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Open With…' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'More document actions: More' })).toBeFocused();
  await page.screenshot({ path: 'output/playwright/windows-usability-narrow.png' });
  windowCommand('-Width', '1140', '-Height', '820');
  await page.waitForFunction(() => innerWidth > 1000);
  await expect.poll(pageFits).toBe(true);
  await page.screenshot({ path: 'output/playwright/windows-usability-wide.png' });
  await page.getByRole('tab', { name: 'reading.docx' }).click();
  await page.getByRole('heading', { name: 'A quieter way to read' }).waitFor();
  await page.getByRole('tab', { name: 'reading.md' }).click();
  await page.getByRole('heading', { name: 'A quieter way to read' }).waitFor();
  const denied = await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const results = [];
    for (const [command, args] of [
      ['read_document', { id: '../../ungranted.txt' }],
      ['open_recent', { path: 'C:\\ungranted.txt' }],
      ['open_external', { url: 'javascript:alert(1)' }],
      ['plugin:dialog|save', { options: {} }],
      ['set_app_theme', { theme: 'arbitrary' }],
    ]) {
      try { await invoke(command, args); results.push(false); } catch { results.push(true); }
    }
    return results;
  });
  assert.deepEqual(denied, [true, true, true, true, true]);
  // Wry's Windows print implementation invokes window.print(). Stub that final
  // browser call, preserving Folio's real native IPC path without a printer job.
  await page.evaluate(() => {
    window.print = () => {
      window.__folioPrintContent = document.querySelector('#print-root')?.textContent;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await page.getByRole('button', { name: 'Print (Ctrl+P)' }).click();
  await page.waitForFunction(() => window.__folioPrintContent?.includes('A quieter way to read'));
  await mkdir('output/playwright', { recursive: true });
  await page.screenshot({ path: 'output/playwright/windows-native.png' });
  assert.deepEqual(errors, []);
  console.log('Windows native smoke passed: OS menus, Appearance/About, zoom/find, fit page, actual window resizing, keyboard overflow including Open With, CLI/single instance, PDF/DOCX/Markdown, restricted IPC, native print preparation.');
} catch (error) {
  if (page) {
    console.log(await page.evaluate(() => ({ text: document.body.innerText, print: document.querySelector('#print-root')?.textContent, fonts: document.fonts.status, visibility: document.visibilityState, dpr: devicePixelRatio, cssWidth: innerWidth, cssHeight: innerHeight, invoke: Object.getOwnPropertyDescriptor(window.__TAURI_INTERNALS__, 'invoke')?.writable })));
    await page.screenshot({ path: 'output/playwright/native-failure.png' });
  }
  throw error;
} finally {
  await browser?.close();
  child.kill();
}
