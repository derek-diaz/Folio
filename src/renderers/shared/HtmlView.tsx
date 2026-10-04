import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { RendererProps } from '../../core/types';
import { openExternal } from '../../platform/files';
import { printContent } from '../../platform/print';
import { focusDomMatch, highlightDom } from './domSearch';
import { sanitizeHtml } from './sanitize';

export function HtmlView({ html, ...props }: RendererProps & { html: string }) {
  const { document: file, zoom, query, matchIndex, onState, onError, ref } = props;
  const content = useRef<HTMLDivElement>(null);
  const safeHtml = useMemo(() => sanitizeHtml(html), [html]);
  useEffect(() => {
    if (!content.current) return;
    content.current.innerHTML = safeHtml;
    const matches = highlightDom(content.current, query);
    onState({ matches, searching: false, searchQuery: query });
    focusDomMatch(content.current, 0);
  }, [safeHtml, query, onState]);
  useEffect(() => { if (content.current) focusDomMatch(content.current, matchIndex); }, [matchIndex]);
  useImperativeHandle(ref, () => ({ print: async () => {
    const node = window.document.createElement('article');
    node.innerHTML = safeHtml;
    await printContent(node, file.name);
  } }), [safeHtml, file.name]);
  return <div className="document-scroll" tabIndex={0} aria-label="Document content">
    <article className="reading-sheet prose" style={{ fontSize: `${16 * zoom}px` }} ref={content} onClick={event => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a');
      if (!link) return;
      event.preventDefault();
      const href = link.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#')) {
        const target = Array.from(content.current?.querySelectorAll('[id]') ?? []).find(element => element.id === href.slice(1));
        target?.scrollIntoView({ block: 'center' });
      } else void openExternal(href).catch(onError);
    }} onAuxClick={event => event.preventDefault()} />
  </div>;
}
