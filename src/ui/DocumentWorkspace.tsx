import { Component, Suspense, lazy, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { initialViewState, type DocumentFile, type FitMode, type RendererHandle, type ViewState } from '../core/types';
import { rendererFor } from '../core/registry';
import { clampZoom } from '../core/tabs';
import { cycleIndex } from '../core/search';
import { formatSize } from '../core/recent';
import { native, openWith } from '../platform/files';
import { Toolbar } from './Toolbar';
import { SearchBar } from './SearchBar';
import { ErrorState } from './ErrorState';
import type { ViewSession } from '../core/viewSession';
import { emptyMenuState, type DocumentAction, type DocumentMenuState } from '../platform/menu';

export interface WorkspaceHandle { run: (action: DocumentAction) => void }

class RendererBoundary extends Component<{ children: ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function DocumentWorkspace({ document, session, onOpen, reportError, ref, onMenuState }: { document: DocumentFile; session: ViewSession; onOpen: () => void; reportError: (error: unknown) => void; ref?: Ref<WorkspaceHandle>; onMenuState: (state: DocumentMenuState) => void }) {
  const definition = rendererFor(document.detection.format);
  const Renderer = useMemo(() => definition ? lazy(definition.load) : null, [definition]);
  const [view, setView] = useState<ViewState>(initialViewState);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(session.zoom ?? 1);
  const [fit, setFit] = useState<FitMode>(session.fit === undefined ? definition?.capabilities.fit || null : session.fit);
  const [searchOpen, setSearchOpen] = useState(session.searchOpen ?? false);
  const [focusKey, setFocusKey] = useState(0);
  const [inputQuery, setInputQuery] = useState(session.query ?? '');
  const [query, setQuery] = useState(session.query ?? '');
  const [matchIndex, setMatchIndex] = useState(session.matchIndex ?? 0);
  const [printBusy, setPrintBusy] = useState(false);
  const handle = useRef<RendererHandle>(null);
  const area = useRef<HTMLDivElement>(null);
  const restoreScroll = useRef({ top: session.scrollTop ?? 0, left: session.scrollLeft ?? 0 });
  useEffect(() => { Object.assign(session, { zoom, fit, query, searchOpen, matchIndex }); }, [session, zoom, fit, query, searchOpen, matchIndex]);
  useEffect(() => {
    if (view.busy) return;
    const frame = requestAnimationFrame(() => area.current?.querySelector('.document-scroll')?.scrollTo(restoreScroll.current));
    return () => cancelAnimationFrame(frame);
  }, [view.busy]);
  const updateState = useCallback((state: Partial<ViewState>) => setView(view => {
    if (Object.entries(state).every(([key, value]) => view[key as keyof ViewState] === value)) return view;
    return { ...view, ...state };
  }), []);
  const rendererError = useCallback((error: unknown) => { setError(error instanceof Error ? error.message : String(error)); setView(view => ({ ...view, busy: false })); }, []);
  const changeZoom = useCallback((value: number) => { setFit(null); setZoom(clampZoom(value)); }, []);
  const displayedZoom = fit ? view.effectiveZoom ?? zoom : zoom;
  const showSearch = useCallback(() => {
    const selection = window.getSelection();
    if (selection?.anchorNode && selection.focusNode && area.current?.contains(selection.anchorNode) && area.current.contains(selection.focusNode)) {
      const text = selection.toString().trim();
      if (text && text.length <= 250) setInputQuery(text);
    }
    setSearchOpen(true); setFocusKey(value => value + 1);
  }, []);
  const closeSearch = useCallback(() => {
    setSearchOpen(false); setInputQuery(''); setQuery(''); setMatchIndex(0);
    requestAnimationFrame(() => area.current?.querySelector<HTMLElement>('.document-scroll')?.focus({ preventScroll: true }));
  }, []);
  const searchPending = Boolean(inputQuery) && (inputQuery !== query || view.busy || view.searching || view.searchQuery !== query);
  const stepSearch = useCallback((delta: number) => {
    if (!query || searchPending) return;
    setMatchIndex(index => cycleIndex(index, delta, view.matches));
  }, [query, searchPending, view.matches]);
  const handoff = useCallback(() => { void openWith(document.id).catch(reportError); }, [document.id, reportError]);
  const print = useCallback(async () => {
    if (!handle.current || printBusy || view.busy) return;
    setPrintBusy(true);
    try { await handle.current.print(); } catch (error) { reportError(error); }
    finally { setPrintBusy(false); updateState({ notice: '' }); }
  }, [printBusy, reportError, view.busy, updateState]);
  useEffect(() => { const timer = setTimeout(() => { if (inputQuery !== query) { setQuery(inputQuery); setMatchIndex(0); } }, 160); return () => clearTimeout(timer); }, [inputQuery, query]);
  const failed = error || !Renderer;
  const canOpenWith = native && Boolean(document.path);
  const caps = failed ? undefined : definition?.capabilities;
  useEffect(() => {
    onMenuState({ find: Boolean(caps?.search), print: Boolean(caps?.print && !view.busy && !printBusy), openWith: canOpenWith, zoom: Boolean(caps?.zoom), fit: Boolean(caps?.fit), fitPage: Boolean(caps?.fitPage), fitWindow: caps?.fit === 'window' });
    return () => onMenuState(emptyMenuState);
  }, [caps, canOpenWith, view.busy, printBusy, onMenuState]);
  useImperativeHandle(ref, () => ({ run(action) {
    if (action === 'find' && caps?.search) showSearch();
    if (action === 'print' && caps?.print) void print();
    if (action === 'open-with' && canOpenWith) handoff();
    if (action === 'zoom-in' && caps?.zoom) changeZoom(displayedZoom + 0.1);
    if (action === 'zoom-out' && caps?.zoom) changeZoom(displayedZoom - 0.1);
    if (action === 'actual-size' && caps?.zoom) changeZoom(1);
    if (action === 'fit' && caps?.fit) setFit(caps.fit);
    if (action === 'fit-page' && caps?.fitPage) setFit('page');
  } }), [caps, canOpenWith, showSearch, print, handoff, changeZoom, displayedZoom]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || window.document.querySelector('dialog[open]')) return;
      if (event.key === 'F3' && !event.ctrlKey && !event.metaKey && !event.altKey && caps?.search) {
        event.preventDefault();
        if (!searchOpen) showSearch(); else stepSearch(event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === 'Escape' && searchOpen) { event.preventDefault(); closeSearch(); return; }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      // Desktop shortcuts are dispatched by the native menu. Ctrl++ is an alias
      // for its Ctrl+= accelerator, since keyboard layouts differ.
      if (!native && key === 'f' && caps?.search) { event.preventDefault(); showSearch(); }
      if (!native && key === 'p') { event.preventDefault(); if (caps?.print) void print(); }
      if ((!native || key === '+') && caps?.zoom && ['+', '=', '-', '0'].includes(key)) { event.preventDefault(); changeZoom(key === '0' ? 1 : displayedZoom + (key === '-' ? -0.1 : 0.1)); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [caps, print, showSearch, changeZoom, displayedZoom, searchOpen, closeSearch, stepSearch]);
  const formatLabel = document.detection.format === 'image' ? ({ 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/gif': 'GIF', 'image/svg+xml': 'SVG' }[document.detection.mime] ?? 'Image') : definition?.label ?? document.detection.format.toUpperCase();
  const metadata = [formatLabel, !failed && view.pages > 0 ? `${view.pages.toLocaleString()} ${view.pages === 1 ? 'page' : 'pages'}` : '', !failed ? view.metadata : '', formatSize(document.size)].filter(Boolean).join(' · ');
  return <section className="document-workspace" id="document-panel" role="tabpanel" aria-labelledby={`tab-${document.id}`}>
    <Toolbar capabilities={failed ? undefined : definition?.capabilities} state={view} zoom={displayedZoom} fit={fit} canOpenWith={canOpenWith} printBusy={printBusy} onOpen={onOpen} onPage={page => handle.current?.goToPage?.(page)} onZoom={changeZoom} onFit={setFit} onSearch={showSearch} onPrint={() => void print()} onOpenWith={handoff} />
    {searchOpen && !failed && <SearchBar query={inputQuery} count={view.matches} index={matchIndex} pending={searchPending} focusKey={focusKey} onQuery={setInputQuery} onStep={stepSearch} onClose={closeSearch} />}
    <div className="viewer-area" ref={area} onScrollCapture={event => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('document-scroll')) { session.scrollTop = target.scrollTop; session.scrollLeft = target.scrollLeft; }
    }}>
      {failed ? <ErrorState document={document} error={error || document.detection.reason || 'No renderer is available for this file.'} onRetry={() => { setError(''); setView(initialViewState); setRevision(value => value + 1); }} onOpenWith={canOpenWith ? handoff : undefined} /> : <>
        <RendererBoundary key={revision} onError={rendererError}>
          <Suspense fallback={<div className="loading-state" role="status">Opening document…</div>}>
            <Renderer document={document} ref={handle} zoom={zoom} fit={fit} query={query} matchIndex={matchIndex} onState={updateState} onError={rendererError} />
          </Suspense>
        </RendererBoundary>
        {view.busy && <div className="loading-overlay" role="status">Opening {document.name}…</div>}
      </>}
    </div>
    <footer className="status-bar"><span className="status-metadata" title={metadata}>{metadata}</span>{view.notice && !failed && <span className="status-notice" title={view.notice}>{view.notice}</span>}</footer>
  </section>;
}
