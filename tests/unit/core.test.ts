import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { detectFile, decodeText } from '../../src/core/detect';
import { rendererFor, supports, renderers } from '../../src/core/registry';
import { cleanRecents } from '../../src/core/recent';
import { activeAfterClose, nextTabId, clampZoom } from '../../src/core/tabs';
import { cycleIndex, findMatches } from '../../src/core/search';

const bytes = (text: string) => new TextEncoder().encode(text);
describe('file detection', () => {
  it('uses signatures over misleading filenames', () => {
    expect(detectFile('report.txt', readFileSync('tests/fixtures/pdf/reading.pdf')).format).toBe('pdf');
    expect(detectFile('picture.pdf', readFileSync('tests/fixtures/images/folio.png')).mime).toBe('image/png');
    expect(detectFile('unknown.bin', readFileSync('tests/fixtures/docx/reading.docx')).format).toBe('docx');
  });
  it('rejects executables, binary data and old office containers disguised as text', () => {
    for (const data of [bytes('MZanything'), new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), new Uint8Array([1, 0, 2, 3])]) expect(detectFile('file.txt', data).format).toBe('unknown');
  });
  it('recognizes text hints, GFM, CSV, RTF, SVG and empty text', () => {
    expect(detectFile('readme.md', bytes('# Hello')).format).toBe('markdown');
    expect(detectFile('table.dat', bytes('a,b\n1,2'), 'text/csv').format).toBe('csv');
    expect(detectFile('old.rtf', bytes('{\\rtf1 hello}')).format).toBe('rtf');
    expect(detectFile('img.txt', bytes('<?xml version="1.0"?><svg />')).mime).toBe('image/svg+xml');
    expect(detectFile('empty.txt', new Uint8Array()).format).toBe('text');
  });
  it('decodes UTF-8, BOM UTF-16 and a conservative legacy fallback', () => {
    expect(decodeText(bytes('café')).text).toBe('café');
    expect(decodeText(new Uint8Array([0xff, 0xfe, 65, 0, 66, 0])).text).toBe('AB');
    expect(decodeText(new Uint8Array([0xfe, 0xff, 0, 65, 0, 66])).text).toBe('AB');
    expect(decodeText(new Uint8Array([99, 97, 102, 233])).text).toBe('café');
  });
  it('rejects traversal, macros and truncated ZIPs before DOCX conversion', async () => {
    const zip = new JSZip(); zip.file('[Content_Types].xml', 'x'); zip.file('word/document.xml', 'x'); zip.file('../outside', 'x');
    const malicious = await zip.generateAsync({ type: 'uint8array' });
    expect(detectFile('bad.docx', malicious).reason).toMatch(/Unsafe/);
    zip.remove('../outside'); zip.remove('../'); zip.file('word/vbaProject.bin', 'x');
    expect(detectFile('bad.docx', await zip.generateAsync({ type: 'uint8array' })).reason).toMatch(/Macro/);
    expect(detectFile('broken.docx', new Uint8Array([0x50, 0x4b, 3, 4])).format).toBe('unknown');
  });
});
describe('renderer negotiation', () => {
  it('keeps unavailable formats out of the registry and contextual controls out of unrelated views', () => {
    expect(rendererFor('rtf')).toBeUndefined(); expect(rendererFor('unknown')).toBeUndefined();
    expect(supports('image', 'search')).toBe(false); expect(supports('image', 'pagination')).toBe(false);
    expect(supports('text', 'pagination')).toBe(false); expect(supports('pdf', 'pagination')).toBe(true);
    expect(supports('csv', 'print')).toBe(false);
    expect(new Set(renderers.map(renderer => renderer.id)).size).toBe(renderers.length);
  });
});
describe('application utilities', () => {
  it('validates, orders, deduplicates and bounds recent files', () => {
    expect(cleanRecents(null)).toEqual([]);
    const recent = cleanRecents([{ path: 'a', name: 'a', openedAt: 1 }, { path: 'a', name: 'a', openedAt: 3 }, { bad: 'data' }, { path: 'b', name: 'b', openedAt: 2 }]);
    expect(recent.map(file => file.path)).toEqual(['a', 'b']);
    expect(cleanRecents(Array.from({ length: 30 }, (_, i) => ({ path: String(i), name: 'n', openedAt: i })))).toHaveLength(12);
  });
  it('chooses neighboring tabs after close and wraps keyboard navigation', () => {
    expect(activeAfterClose(['a', 'b', 'c'], 'b', 'b')).toBe('c');
    expect(activeAfterClose(['a', 'b', 'c'], 'c', 'c')).toBe('b');
    expect(activeAfterClose(['a'], 'a', 'a')).toBeNull();
    expect(activeAfterClose(['a', 'b'], 'b', 'a')).toBe('b');
    expect(nextTabId(['a', 'b'], 'a', -1)).toBe('b'); expect(nextTabId([], null, 1)).toBeNull();
    expect(clampZoom(9)).toBe(3); expect(clampZoom(-9)).toBe(.25);
  });
  it('searches literal text, preserves offsets and caps results', () => {
    expect(findMatches('a.b A.B', 'a.b')).toEqual([{ start: 0, end: 3 }, { start: 4, end: 7 }]);
    expect(findMatches('İ AB', 'ab')).toEqual([{ start: 2, end: 4 }]);
    expect(findMatches('aaaaa', 'a', 2)).toHaveLength(2);
    expect(findMatches('abc', '')).toEqual([]); expect(cycleIndex(0, -1, 3)).toBe(2);
  });
});
