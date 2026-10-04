import { useEffect, useState } from 'react';
import type { RendererProps } from '../../core/types';

export type ParseKind = 'text' | 'markdown' | 'docx' | 'csv';
export interface ParseRequest { kind: ParseKind; bytes: Uint8Array }
export interface ParsedDocument { text?: string; lines?: string[]; html?: string; rows?: string[][]; notice: string }

export function useParsed(kind: ParseKind, { document, onState, onError }: RendererProps) {
  const [result, setResult] = useState<ParsedDocument | null>(null);
  useEffect(() => {
    const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
    const timeout = window.setTimeout(() => { worker.terminate(); onError(new Error('This document took too long to process. Try a smaller file or use Open With.')); }, 30000);
    onState({ busy: true });
    worker.onmessage = (event: MessageEvent<{ result?: ParsedDocument; error?: string }>) => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data.error) onError(new Error(event.data.error));
      else if (event.data.result) { setResult(event.data.result); onState({ busy: false, notice: event.data.result.notice }); }
    };
    worker.onerror = event => { clearTimeout(timeout); worker.terminate(); onError(new Error(event.message || 'The document parser failed.')); };
    const bytes = document.bytes.slice();
    worker.postMessage({ kind, bytes }, [bytes.buffer]);
    return () => { clearTimeout(timeout); worker.terminate(); };
  }, [document, kind, onState, onError]);
  return result;
}
