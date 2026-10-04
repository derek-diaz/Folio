import DOMPurify from 'dompurify';

const tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sup', 'sub', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'a', 'img', 'span', 'div', 'input'];
const rasterData = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i;
export function safeLink(href: string): boolean { return /^(?:https?:\/\/|mailto:|#)/i.test(href); }

export function sanitizeHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'start', 'id', 'type', 'checked', 'disabled'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    SANITIZE_NAMED_PROPS: true,
    RETURN_DOM_FRAGMENT: true,
  });
  clean.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href') ?? '';
    if (!safeLink(href)) { link.removeAttribute('href'); link.title = 'Local and unsafe links are not opened'; }
    else if (href.startsWith('#')) link.setAttribute('href', `#user-content-${href.slice(1)}`);
    else { link.setAttribute('rel', 'noreferrer noopener'); link.title = `${href} (opens in your browser)`; }
  });
  clean.querySelectorAll('img').forEach(img => {
    if (!rasterData.test(img.getAttribute('src') ?? '')) {
      const replacement = document.createElement('span');
      replacement.className = 'blocked-image';
      replacement.textContent = `[${img.alt || 'Image'} · external or unsupported image]`;
      img.replaceWith(replacement);
    }
  });
  clean.querySelectorAll('input').forEach(input => {
    if (input.type !== 'checkbox') input.remove();
    else { input.disabled = true; input.tabIndex = -1; }
  });
  const container = document.createElement('div');
  container.append(clean);
  return container.innerHTML;
}

export function sanitizeSvg(svg: string): string {
  if (svg.length > 8 * 1024 * 1024) throw new Error('This SVG exceeds the 8 MB limit.');
  const clean = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'style', 'image', 'a', 'animate', 'animateMotion', 'animateTransform', 'set'],
    FORBID_ATTR: ['style', 'class'],
    ALLOW_DATA_ATTR: false,
  });
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('This SVG is malformed.');
  doc.querySelectorAll('*').forEach(element => {
    for (const attribute of [...element.attributes]) {
      const value = attribute.value.trim();
      if ((/href$/i.test(attribute.name) && !value.startsWith('#')) || (/url\s*\(/i.test(value) && !/^url\(\s*['"]?#[\w.-]+['"]?\s*\)$/i.test(value))) element.removeAttributeNode(attribute);
    }
  });
  return new XMLSerializer().serializeToString(doc);
}
