import { useEffect, useState } from 'react';
import { MAX_MATCHES } from '../../core/search';

export interface RowHit { row: number; column: number }
const noHits: RowHit[] = [];
// Yield between short batches so typing, closing a tab and scrolling stay usable.
// Parsed rows already live in the renderer; a second worker would duplicate them.
export function useRowSearch(rows: readonly (string | string[])[], query: string) {
  const [result, setResult] = useState({ query: '', hits: noHits, searching: false });
  useEffect(() => {
    let cancelled = false;
    setResult({ query, hits: noHits, searching: Boolean(query) });
    if (!query) return;
    void (async () => {
      const found: RowHit[] = [];
      const needle = query.toLocaleLowerCase();
      let deadline = performance.now() + 8;
      for (let row = 0; row < rows.length; row++) {
        const cells = typeof rows[row] === 'string' ? [rows[row] as string] : rows[row] as string[];
        for (let column = 0; column < cells.length; column++) {
          if (cells[column].toLocaleLowerCase().includes(needle)) found.push({ row, column });
          if (found.length >= MAX_MATCHES) break;
        }
        if (found.length >= MAX_MATCHES) break;
        if (performance.now() > deadline) {
          await new Promise(resolve => setTimeout(resolve, 0));
          if (cancelled) return;
          deadline = performance.now() + 8;
        }
      }
      if (!cancelled) setResult({ query, hits: found, searching: false });
    })();
    return () => { cancelled = true; };
  }, [rows, query]);
  return result.query === query ? result : { query, hits: noHits, searching: Boolean(query) };
}
