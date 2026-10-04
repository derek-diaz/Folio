import { useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { RendererProps } from '../core/types';
import { useParsed } from './shared/parse';
import { MarkedText } from './shared/MarkedText';
import { useRowSearch } from './shared/useRowSearch';

export default function CsvRenderer(props: RendererProps) {
  const result = useParsed('csv', props);
  return result ? <CsvView {...props} rows={result.rows ?? []} /> : null;
}
function CsvView({ rows, zoom, query, matchIndex, onState }: RendererProps & { rows: string[][] }) {
  const scroll = useRef<HTMLDivElement>(null);
  const headers = rows[0] ?? [];
  const columns = useMemo(() => rows.reduce((max, row) => Math.max(max, row.length), headers.length), [rows, headers.length]);
  const height = 36 * zoom;
  const width = 210 * zoom;
  const virtual = useVirtualizer({ count: Math.max(0, rows.length - 1), getScrollElement: () => scroll.current, estimateSize: () => height, overscan: 12, scrollMargin: height });
  const { hits, searching } = useRowSearch(rows, query);
  const selected = hits[matchIndex];
  useEffect(() => { virtual.measure(); }, [height, virtual]);
  useEffect(() => { onState({ matches: hits.length, searching, searchQuery: query, metadata: `${Math.max(0, rows.length - 1).toLocaleString()} rows · ${columns} columns`, notice: query ? 'Results count matching cells' : '' }); }, [hits, searching, onState, rows.length, columns, query]);
  useEffect(() => {
    if (!selected) return;
    if (selected.row === 0) scroll.current?.scrollTo({ top: 0 });
    else virtual.scrollToIndex(selected.row - 1, { align: 'center' });
    scroll.current?.scrollTo({ left: Math.max(0, selected.column * width - width) });
  }, [selected, virtual, width]);
  if (!rows.length) return <div className="empty-document">This table is empty.</div>;
  return <div className="document-scroll csv-scroll" ref={scroll} tabIndex={0} aria-label="Read-only table" style={{ fontSize: 14 * zoom }}>
    <div role="table" aria-rowcount={rows.length} aria-colcount={columns} className="csv-table" style={{ width: columns * width }}>
      <div role="row" className="csv-header" style={{ height }}>{Array.from({ length: columns }, (_, c) => <div role="columnheader" className="csv-cell" key={c} title={headers[c]} style={{ width }}><MarkedText text={headers[c] || `Column ${c + 1}`} query={query} active={selected?.row === 0 && selected.column === c} /></div>)}</div>
      <div role="rowgroup" style={{ height: virtual.getTotalSize(), position: 'relative' }}>
        {virtual.getVirtualItems().map(row => <div role="row" aria-rowindex={row.index + 2} className="csv-row" key={row.key} style={{ position: 'absolute', top: 0, transform: `translateY(${row.start - height}px)`, height }}>
          {Array.from({ length: columns }, (_, c) => <div role="cell" className={`csv-cell ${selected?.row === row.index + 1 && selected.column === c ? 'selected-cell' : ''}`} key={c} style={{ width }} title={rows[row.index + 1][c] ?? ''}><MarkedText text={rows[row.index + 1][c] ?? ''} query={query} /></div>)}
        </div>)}
      </div>
    </div>
  </div>;
}
