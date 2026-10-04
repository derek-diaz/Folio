import { describe, expect, it } from 'vitest';
import { sanitizeHtml, sanitizeSvg } from '../../src/renderers/shared/sanitize';
import { clearHighlights, highlightDom } from '../../src/renderers/shared/domSearch';

describe('untrusted document HTML', () => {
  it('removes executable content, remote resources and navigation controls', () => {
    const html = sanitizeHtml('<script>alert(1)</script><iframe src="https://example.com"></iframe><img src="https://example.com/a" onerror="alert(1)"><a href="javascript:alert(1)">bad</a><div style="background:url(https://example.com)">hello</div><form action="https://example.com"><input value="x"></form>');
    expect(html).not.toMatch(/<script|<iframe|onerror|javascript:|style=|<form|<input/);
    expect(html).not.toContain('src="https:');
    expect(html).toContain('external or unsupported image');
  });
  it('keeps safe formatting, raster data, inert checkboxes and explicit links', () => {
    const html = sanitizeHtml('<h1>Title</h1><p><strong>Bold</strong> <u>underline</u></p><a href="https://example.com">link</a><input type="checkbox" checked><img src="data:image/png;base64,AAAA" alt="test">');
    expect(html).toContain('<h1>Title</h1>'); expect(html).toContain('<u>underline</u>');
    expect(html).toContain('disabled'); expect(html).toContain('data:image/png;base64,AAAA');
    expect(html).toContain('noreferrer noopener');
  });
  it('removes SVG active content and external URL references', () => {
    const svg = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><foreignObject><p>bad</p></foreignObject><use href="https://example.com/a.svg#b"/><rect fill="url(https://example.com/x)"/><animate attributeName="href" values="javascript:alert(1)"/><circle r="10" fill="red"/></svg>');
    expect(svg).not.toMatch(/script|foreignObject|https:|animate/); expect(svg).toContain('circle');
  });
});
describe('document search DOM', () => {
  it('matches across inline formatting and restores original text when cleared', () => {
    const root = document.createElement('div'); root.innerHTML = '<p>one <strong>doc</strong>ument and another document.</p>';
    expect(highlightDom(root, 'document')).toBe(2);
    expect(root.querySelectorAll('mark[data-match="0"]')).toHaveLength(2);
    expect(root.textContent).toBe('one document and another document.');
    clearHighlights(root); expect(root.querySelectorAll('mark')).toHaveLength(0);
    expect(root.querySelector('strong')?.textContent).toBe('doc');
  });
});
