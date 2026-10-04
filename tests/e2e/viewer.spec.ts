import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import metadata from '../../package.json' with { type: 'json' };
const fixture = (file: string) => path.resolve('tests/fixtures', file);
const open = async (page: Page, file: string) => { await page.locator('input[type=file]').setInputFiles(fixture(file)); };

test.beforeEach(async ({ page }) => { await page.goto('/'); });
test('text, tabs, literal search, zoom and close shortcuts', async ({ page }) => {
  await open(page, 'text/reading.txt');
  await expect(page.getByText('FIELD NOTES')).toBeVisible();
  await page.keyboard.press('Control+f');
  await page.getByRole('textbox', { name: 'Find in document' }).fill('document');
  await expect(page.locator('.search-count')).toHaveText('1 of 2');
  await page.getByRole('button', { name: 'Next result' }).click();
  await expect(page.locator('.search-count')).toHaveText('2 of 2');
  await page.keyboard.press('Control+=');
  await expect(page.getByTitle('Actual size (Ctrl+0)')).toHaveText('110%');
  await open(page, 'markdown/reading.md');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await page.keyboard.press('Control+Shift+Tab');
  await expect(page.getByRole('tab', { selected: true })).toContainText('reading.txt');
  await expect(page.getByTitle('Actual size (Ctrl+0)')).toHaveText('110%');
  await page.keyboard.press('Control+w');
  await expect(page.getByRole('tab', { selected: true })).toContainText('reading.md');
  await page.keyboard.press('Control+w');
  await expect(page.getByRole('region', { name: 'Open a document' })).toBeVisible();
});
test('GFM is readable and never fetches document resources or executes scripts', async ({ page }) => {
  const remote: string[] = [];
  page.on('request', request => { if (request.url().startsWith('https://example.com')) remote.push(request.url()); });
  await open(page, 'markdown/reading.md');
  await expect(page.getByRole('heading', { name: 'A quieter way to read' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('.prose input[type=checkbox]')).toHaveCount(3);
  await expect(page.locator('.prose script, .prose iframe')).toHaveCount(0);
  await expect(page.locator('.blocked-image')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__documentScriptRan)).toBeUndefined();
  expect(remote).toEqual([]);
  await page.screenshot({ path: 'output/playwright/markdown-dark.png', fullPage: true });
});
test('DOCX renders headings, inline styles, tables and embedded images', async ({ page }) => {
  await open(page, 'docx/reading.docx');
  await expect(page.getByRole('heading', { name: 'A quieter way to read' })).toBeVisible();
  await expect(page.locator('.prose strong')).toHaveText('bold words');
  await expect(page.locator('.prose u')).toHaveText('underlined italics');
  await expect(page.locator('.prose table')).toBeVisible();
  await expect(page.locator('.prose img')).toBeVisible();
  await page.keyboard.press('Control+f'); await page.getByRole('textbox', { name: 'Find in document' }).fill('document');
  await expect(page.locator('.search-count')).toHaveText('1 of 2');
  await page.screenshot({ path: 'output/playwright/docx.png' });
});
test('PDF paints both pages, exposes selectable text and navigates search', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, 'pdf/reading.pdf');
  await expect(page.locator('.textLayer').first()).toContainText('Folio PDF fixture');
  await expect(page.getByLabel('Page number')).toHaveValue('1');
  await page.setViewportSize({ width: 620, height: 780 });
  await expect.poll(() => page.locator('.pdf-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByLabel('Next page', { exact: true }).click();
  await expect(page.getByLabel('Page number')).toHaveValue('2');
  await page.keyboard.press('Control+f'); await page.getByRole('textbox', { name: 'Find in document' }).fill('document');
  await expect(page.locator('.search-count')).toHaveText('1 of 2');
  await page.getByRole('button', { name: 'Next result' }).click();
  await expect(page.getByLabel('Page number')).toHaveValue('2');
  await expect(page.locator('.textLayer mark.current')).toHaveCount(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'output/playwright/pdf.png' });
});
test('CSV parses quoted values and virtualizes a large file', async ({ page }) => {
  await open(page, 'csv/reading.csv');
  await expect(page.getByRole('cell', { name: 'Read, then think', exact: true })).toBeVisible();
  const csv = 'Name;Value\n' + Array.from({ length: 50000 }, (_, i) => `Row ${i};Value ${i}`).join('\n');
  await page.locator('input[type=file]').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('.status-metadata')).toContainText('50,000 rows');
  expect(await page.getByRole('row').count()).toBeLessThan(100);
  await page.keyboard.press('Control+f'); await page.getByRole('textbox', { name: 'Find in document' }).fill('Value 49999');
  await expect(page.locator('.search-count')).toHaveText('1 of 1');
  await expect(page.getByRole('cell', { name: 'Value 49999', exact: true })).toBeVisible();
});
test('images use contextual controls and malformed documents fail gracefully', async ({ page }) => {
  await open(page, 'images/safe.svg');
  await expect(page.getByRole('img', { name: 'safe.svg' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Viewing mode: Fit to window' })).toBeVisible();
  await page.setViewportSize({ width: 620, height: 420 });
  await expect.poll(() => page.locator('.image-scroll').evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
  await expect(page.getByLabel('Page number')).toHaveCount(0);
  await expect(page.getByLabel('Find in document (Ctrl+F)')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-broken') });
  await expect(page.getByText('Folio couldn’t open this file.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('PDF fitting follows viewport size, preserves the current page and survives tab switches', async ({ page }) => {
  await open(page, 'pdf/reading.pdf');
  await expect(page.locator('.textLayer').first()).toContainText('Folio PDF fixture');
  await expect(page.getByRole('button', { name: 'Viewing mode: Fit width' })).toBeVisible();
  await expect(page.locator('.status-metadata')).toContainText('PDF · 2 pages');
  await expect(page.locator('.status-bar')).not.toContainText('Read-only');
  const completePageFits = () => page.locator('.pdf-scroll').evaluate(area => {
    const number = (document.querySelector('[aria-label="Page number"]') as HTMLInputElement).value;
    const sheet = area.querySelector(`[data-page="${number}"]`)!.getBoundingClientRect();
    const bounds = area.getBoundingClientRect();
    return sheet.top >= bounds.top && sheet.bottom <= bounds.bottom && sheet.width <= area.clientWidth;
  });
  expect(await completePageFits()).toBe(false);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByLabel('Page number')).toHaveValue('2');
  await page.getByRole('button', { name: 'Viewing mode: Fit width' }).click();
  await page.getByRole('menuitemradio', { name: 'Fit page', exact: true }).click();
  await expect.poll(completePageFits).toBe(true);
  for (const dimensions of [{ width: 1100, height: 600 }, { width: 620, height: 420 }]) {
    await page.setViewportSize(dimensions);
    await expect.poll(completePageFits).toBe(true);
    await expect(page.getByLabel('Page number')).toHaveValue('2');
  }
  const fitZoom = await page.locator('.zoom-value').innerText();
  await open(page, 'docx/reading.docx');
  await expect(page.locator('.prose h1')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Viewing mode/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'reading.pdf' }).click();
  await expect(page.getByRole('button', { name: 'Viewing mode: Fit page' })).toBeVisible();
  await expect(page.getByLabel('Page number')).toHaveValue('2');
  await expect.poll(completePageFits).toBe(true);
  await expect(page.locator('.zoom-value')).toHaveText(fitZoom);
  await page.getByRole('button', { name: 'Zoom in (Ctrl++)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Viewing mode: View', exact: true })).toBeVisible();
  const manualZoom = await page.locator('.zoom-value').innerText();
  await page.getByRole('tab', { name: 'reading.docx' }).click();
  await page.getByRole('tab', { name: 'reading.pdf' }).click();
  await expect(page.locator('.zoom-value')).toHaveText(manualZoom);
  await expect(page.getByRole('button', { name: 'Viewing mode: View', exact: true })).toBeVisible();
  await page.getByTitle('Actual size (Ctrl+0)').click();
  await expect.poll(() => page.locator('.pdf-page').first().evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(816);
});

test('toolbar groups remain readable and keyboard accessible at wide and narrow sizes', async ({ page }, testInfo) => {
  await open(page, 'pdf/reading.pdf');
  await expect(page.locator('.textLayer').first()).toContainText('Folio PDF fixture');
  for (const theme of ['dark', 'light']) {
    await page.keyboard.press('Control+,');
    await page.getByRole('radio', { name: theme === 'dark' ? /^Dark/ : /^Light/ }).check();
    await page.getByRole('button', { name: 'Done' }).click();
    for (const width of [1280, 620]) {
      await page.setViewportSize({ width, height: 720 });
      await expect.poll(() => page.locator('.toolbar').evaluate(toolbar => {
        const start = toolbar.querySelector('.toolbar-start')!.getBoundingClientRect();
        const center = toolbar.querySelector('.toolbar-view')!.getBoundingClientRect();
        const end = toolbar.querySelector('.document-actions')!.getBoundingClientRect();
        return toolbar.scrollWidth <= toolbar.clientWidth && start.right < center.left && center.right < end.left;
      })).toBe(true);
      const contrast = await page.locator('.toolbar').evaluate(toolbar => {
        const enabled = getComputedStyle(toolbar.querySelector('[aria-label="Find in document (Ctrl+F)"]')!);
        const disabled = getComputedStyle(toolbar.querySelector('[aria-label="Previous page"]')!);
        return { enabled: enabled.color, disabled: disabled.color, size: parseFloat(enabled.height) };
      });
      expect(contrast.enabled).not.toBe(contrast.disabled);
      expect(contrast.size).toBeGreaterThanOrEqual(34);
      await page.screenshot({ path: `output/playwright/usability-${theme}-${width}-${testInfo.project.name}.png` });
    }
  }
  await page.getByRole('button', { name: 'More document actions: More' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Print…' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'More document actions: More' })).toBeFocused();
  await page.getByRole('button', { name: 'Viewing mode: Fit width' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'Fit width' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Viewing mode: Fit page' })).toBeFocused();
  expect(await page.locator(':focus').evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid');
});

test('image fit exposes its actual scale and text retains its own viewing state', async ({ page }) => {
  await open(page, 'images/safe.svg');
  await expect(page.getByRole('img', { name: 'safe.svg' })).toBeVisible();
  await page.setViewportSize({ width: 620, height: 420 });
  await expect.poll(() => page.getByRole('img', { name: 'safe.svg' }).evaluate(element => {
    const rendered = Math.round(element.getBoundingClientRect().width / (element as HTMLImageElement).naturalWidth * 100);
    return rendered < 100 && rendered === Number.parseInt(document.querySelector('.zoom-value')!.textContent!);
  })).toBe(true);
  await page.getByRole('button', { name: 'Viewing mode: Fit to window' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Fit page', exact: true })).toHaveCount(0);
  await page.getByRole('menuitemradio', { name: 'Actual size (100%)' }).click();
  await expect(page.locator('.zoom-value')).toHaveText('100%');
  await expect.poll(() => page.getByRole('img', { name: 'safe.svg' }).evaluate(element => element.getBoundingClientRect().width)).toBe(640);
  await open(page, 'text/reading.txt');
  await expect(page.getByText('FIELD NOTES')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Viewing mode/ })).toHaveCount(0);
  await page.keyboard.press('Control+=');
  await expect(page.locator('.status-metadata')).toContainText('Text · UTF-8');
  await page.getByRole('tab', { name: 'safe.svg' }).click();
  await expect(page.locator('.zoom-value')).toHaveText('100%');
  await expect(page.getByRole('button', { name: 'Viewing mode: View', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'reading.txt' }).click();
  await expect(page.locator('.zoom-value')).toHaveText('110%');
});

test('printing prepares the whole document, including offscreen PDF pages', async ({ page }) => {
  await page.evaluate(() => {
    window.print = () => {
      const root = document.querySelector('#print-root');
      (window as unknown as Record<string, unknown>).__printed = { text: root?.textContent, images: root?.querySelectorAll('img').length };
    };
  });
  await open(page, 'text/reading.txt');
  await expect(page.getByText('FIELD NOTES')).toBeVisible();
  await page.getByRole('button', { name: 'Print (Ctrl+P)' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: { text: string } }).__printed?.text)).toContain('Unicode belongs here too');
  await open(page, 'pdf/reading.pdf');
  await expect(page.locator('.textLayer').first()).toContainText('Folio PDF fixture');
  await page.getByRole('button', { name: 'Print (Ctrl+P)' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: { images: number } }).__printed?.images)).toBe(2);
});

test('large text stays virtualized and finds content near the end', async ({ page }) => {
  const text = Array.from({ length: 60000 }, (_, i) => `Line ${i}: Read a little, think a little.`).join('\n');
  await page.locator('input[type=file]').setInputFiles({ name: 'long.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.locator('.status-metadata')).toContainText('60,000 lines');
  await expect(page.locator('.status-bar')).not.toContainText('Virtualized');
  expect(await page.locator('.text-line').count()).toBeLessThan(100);
  await page.keyboard.press('Control+f'); await page.getByRole('textbox', { name: 'Find in document' }).fill('Line 59999:');
  await expect(page.locator('.search-count')).toHaveText('1 of 1');
  await expect(page.getByText('Line 59999:', { exact: true })).toBeVisible();
});

test('menus open documents and route actions to the active renderer', async ({ page }) => {
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Close Tab' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Print…' })).toBeDisabled();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Open…' }).click();
  await (await picker).setFiles(fixture('text/reading.txt'));
  await expect(page.getByText('FIELD NOTES')).toBeVisible();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Zoom In' }).click();
  await expect(page.getByTitle('Actual size (Ctrl+0)')).toHaveText('110%');
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Find in Document…' }).click();
  await expect(page.getByRole('textbox', { name: 'Find in document' })).toBeFocused();
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Close Tab' }).click();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await open(page, 'csv/reading.csv');
  await expect(page.getByRole('cell', { name: 'Read, then think', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Print…' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'File', exact: true })).toBeFocused();
});

test('appearance overrides the OS, persists, and follows live system changes when selected', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await open(page, 'markdown/reading.md');
  await expect(page.getByRole('heading', { name: 'A quieter way to read' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Appearance…' }).click();
  await expect(page.getByRole('radio', { name: /^Dark/ })).toBeChecked();
  await page.screenshot({ path: 'output/playwright/appearance-dark.png' });
  await page.getByRole('radio', { name: /^Light/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.screenshot({ path: 'output/playwright/markdown-light.png' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('region', { name: 'Open a document' })).toBeVisible();
  await page.keyboard.press('Control+,');
  await page.getByRole('radio', { name: /^System/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radio', { name: /^Dark/ }).check();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--text').trim())).toBe('#000');
});

test('About identifies the release and creator, traps focus, and protects the document underneath', async ({ page }) => {
  await open(page, 'text/reading.txt');
  await expect(page.getByText('FIELD NOTES')).toBeVisible();
  await page.getByRole('menuitem', { name: 'Help', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const about = page.getByRole('dialog', { name: 'About Folio' });
  await expect(about).toBeVisible();
  await expect(about).toContainText(metadata.version);
  await expect(about).toContainText('Tabierto');
  await expect(about).toContainText('Derek Diaz Correa');
  await page.screenshot({ path: 'output/playwright/about-dark.png' });
  await page.keyboard.press('Control+w');
  await page.keyboard.press('Tab');
  expect(await about.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(about).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('menuitem', { name: 'Help', exact: true })).toBeFocused();
});
