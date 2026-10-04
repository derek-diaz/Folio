import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { DocumentFile, RecentFile } from './types';
import { activeAfterClose, nextTabId } from './tabs';
import * as files from '../platform/files';

export function useDocuments() {
  const [tabs, setTabs] = useState<DocumentFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [dragging, setDragging] = useState(false);
  const currentTabs = useRef(tabs);
  const queue = useRef(Promise.resolve());
  const reportError = useCallback((error: unknown) => setError(error instanceof Error ? error.message : String(error)), []);
  const refreshRecents = useCallback(() => files.listRecents().then(setRecents).catch(reportError), [reportError]);
  const add = useCallback((document: DocumentFile) => {
    const existing = currentTabs.current.find(tab => document.path ? tab.path === document.path : tab.id === document.id);
    if (existing) { setActiveId(existing.id); void files.releaseFile(document.id).catch(reportError); return; }
    if (currentTabs.current.length >= 64) { void files.releaseFile(document.id); throw new Error('Close a document before opening more (64 tab limit).'); }
    if (currentTabs.current.reduce((size, tab) => size + tab.bytes.byteLength, 0) + document.bytes.byteLength > 256 * 1024 * 1024) {
      void files.releaseFile(document.id); throw new Error('Close a document to free memory (256 MB of open files limit).');
    }
    currentTabs.current = [...currentTabs.current, document];
    setTabs(currentTabs.current); setActiveId(document.id);
  }, [reportError]);
  const enqueue = useCallback((operation: () => Promise<void>) => {
    queue.current = queue.current.then(async () => {
      setOpening(true);
      try { await operation(); } catch (error) { reportError(error); }
      finally { setOpening(false); await refreshRecents(); }
    });
    return queue.current;
  }, [refreshRecents, reportError]);
  const acceptBatch = useCallback(async (batch: files.OpenBatch) => {
    const errors = [...batch.errors];
    for (const descriptor of batch.files) {
      try { add(await files.readNative(descriptor)); }
      catch (error) { errors.push(`${descriptor.name}: ${String(error)}`); await files.releaseFile(descriptor.id); }
    }
    if (errors.length) setError(errors.join('\n'));
  }, [add]);
  const open = useCallback(() => enqueue(async () => acceptBatch(await files.chooseFiles())), [enqueue, acceptBatch]);
  const openRecent = useCallback((path: string) => enqueue(async () => acceptBatch(await files.openRecent(path))), [enqueue, acceptBatch]);
  const openBrowser = useCallback((browserFiles: File[]) => enqueue(async () => {
    const errors: string[] = [];
    for (const file of browserFiles) { try { add(await files.readBrowser(file)); } catch (error) { errors.push(String(error)); } }
    if (errors.length) setError(errors.join('\n'));
  }), [add, enqueue]);
  const close = useCallback((id: string) => {
    const ids = currentTabs.current.map(tab => tab.id);
    setActiveId(active => activeAfterClose(ids, active, id));
    currentTabs.current = currentTabs.current.filter(tab => tab.id !== id); setTabs(currentTabs.current);
    void files.releaseFile(id).catch(reportError);
  }, [reportError]);
  const cycle = useCallback((direction: number) => setActiveId(active => nextTabId(currentTabs.current.map(tab => tab.id), active, direction)), []);
  const removeRecent = useCallback(async (path: string | null) => {
    try { await files.forgetRecent(path); await refreshRecents(); } catch (error) { reportError(error); }
  }, [refreshRecents, reportError]);
  useEffect(() => {
    if (!files.native) return;
    let disposed = false;
    const subscriptions: (() => void)[] = [];
    const register = async () => {
      const pending = await Promise.all([
        files.watchFiles(() => { void enqueue(async () => acceptBatch(await files.takePending())); }),
        files.watchDrag(setDragging),
        listen<string>('native-error', event => reportError(event.payload)),
      ]);
      if (disposed) { pending.forEach(unlisten => unlisten()); return; }
      subscriptions.push(...pending);
      // Subscribe before draining the queue so a second instance cannot race startup.
      void enqueue(async () => acceptBatch(await files.takePending()));
    };
    void register().catch(reportError);
    return () => { disposed = true; subscriptions.forEach(unlisten => unlisten()); };
  }, [enqueue, acceptBatch, reportError]);
  return { tabs, activeId, recents, error, opening, dragging, setDragging, setError, reportError, open, openBrowser, openRecent, removeRecent, close, cycle, select: setActiveId };
}
