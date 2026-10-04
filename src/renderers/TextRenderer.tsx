import { useEffect, useImperativeHandle, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { RendererProps } from '../core/types';
import { printContent } from '../platform/print';
import { useParsed } from './shared/parse';
import { MarkedText } from './shared/MarkedText';
import { useRowSearch } from './shared/useRowSearch';

export default function TextRenderer(props: RendererProps) {
  const result = useParsed('text', props);
  return result ? <TextView {...props} text={result.text ?? ''} lines={result.lines ?? []} encoding={result.notice} /> : null;
}
function TextView({ text, lines, encoding, document: file, zoom, query, matchIndex, onState, ref }: RendererProps & { text: string; lines: string[]; encoding: string }) {
  const scroll = useRef<HTMLDivElement>(null);
  const large = text.length > 200000 || lines.length > 3000;
  const { hits, searching } = useRowSearch(lines, query);
  const rowHeight = 26 * zoom;
  const virtual = useVirtualizer({ count: large ? lines.length : 0, getScrollElement: () => scroll.current, estimateSize: () => rowHeight, overscan: 15 });
  useEffect(() => { virtual.measure(); }, [rowHeight, virtual]);
  useEffect(() => { onState({ matches: hits.length, searching, searchQuery: query, metadata: `${encoding.replace(/^utf/i, 'UTF')} · ${lines.length.toLocaleString()} ${lines.length === 1 ? 'line' : 'lines'}`, notice: query ? 'Results count matching lines' : '' }); }, [hits, searching, onState, lines.length, query, encoding]);
  const selected = hits[matchIndex]?.row;
  useEffect(() => {
    if (selected === undefined) return;
    if (large) virtual.scrollToIndex(selected, { align: 'center' });
    else scroll.current?.querySelector(`[data-line="${selected}"]`)?.scrollIntoView({ block: 'center' });
  }, [selected, large, virtual]);
  useImperativeHandle(ref, () => ({ print: async () => {
    if (text.length > 2 * 1024 * 1024) throw new Error('Printing is limited to 2 MB of text. Use Open With for this file.');
    const pre = window.document.createElement('pre');
    pre.className = 'print-text'; pre.textContent = text;
    await printContent(pre, file.name);
  } }), [text, file.name]);
  return <div className={`document-scroll text-scroll ${large ? 'virtual-text' : ''}`} ref={scroll} tabIndex={0} aria-label="Text document" style={{ fontSize: 16 * zoom }}>
    {large ? <div style={{ height: virtual.getTotalSize(), minWidth: '100%', position: 'relative' }}>
      {virtual.getVirtualItems().map(row => <div className="text-line virtual-line" key={row.key} style={{ position: 'absolute', top: 0, transform: `translateY(${row.start}px)`, height: rowHeight, lineHeight: `${rowHeight}px` }}><MarkedText text={lines[row.index]} query={query} active={selected === row.index} /></div>)}
    </div> : <div className="reading-sheet plain-text">{lines.map((line, i) => <div className="text-line" data-line={i} key={i}><MarkedText text={line || '\u00a0'} query={query} active={selected === i} /></div>)}</div>}
  </div>;
}
