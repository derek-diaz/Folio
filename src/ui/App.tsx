import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDocuments } from '../core/useDocuments';
import { native } from '../platform/files';
import { Tabs } from './Tabs';
import { EmptyState } from './EmptyState';
import { DocumentWorkspace, type WorkspaceHandle } from './DocumentWorkspace';
import { Icon } from './Icon';
import type { ViewSession } from '../core/viewSession';
import { useTheme } from '../core/theme';
import { emptyMenuState, useNativeMenu, type MenuAction } from '../platform/menu';
import { BrowserMenu } from './BrowserMenu';
import { AppearanceDialog } from './AppearanceDialog';
import { AboutDialog } from './AboutDialog';

export function App() {
  const docs = useDocuments();
  const { theme, setTheme } = useTheme(docs.reportError);
  const [dialog, setDialog] = useState<'appearance' | 'about' | null>(null);
  const [documentMenu, setDocumentMenu] = useState(emptyMenuState);
  const workspace = useRef<WorkspaceHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  const sessions = useRef(new Map<string, ViewSession>());
  const open = useCallback(() => { if (native) void docs.open(); else input.current?.click(); }, [docs.open]);
  const active = docs.tabs.find(tab => tab.id === docs.activeId);
  const action = useCallback((action: MenuAction) => {
    if (dialog) return;
    if (action === 'open') open();
    else if (action === 'close') { if (docs.activeId) docs.close(docs.activeId); }
    else if (action === 'appearance' || action === 'about') setDialog(action);
    else workspace.current?.run(action);
  }, [dialog, open, docs.activeId, docs.close]);
  const menuState = { ...(active ? documentMenu : emptyMenuState), document: Boolean(active), modal: Boolean(dialog) };
  useNativeMenu(action, menuState, docs.reportError);
  if (active && !sessions.current.has(active.id)) sessions.current.set(active.id, {});
  useEffect(() => { for (const id of sessions.current.keys()) if (!docs.tabs.some(tab => tab.id === id)) sessions.current.delete(id); }, [docs.tabs]);
  useEffect(() => { window.document.title = active ? `${active.name} — Folio` : 'Folio'; }, [active]);
  useLayoutEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (dialog) return;
      if (!native && event.key === 'F1') { event.preventDefault(); setDialog('about'); return; }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (!native && event.key.toLowerCase() === 'o') { event.preventDefault(); open(); }
      if (!native && event.key.toLowerCase() === 'w') { event.preventDefault(); if (docs.activeId) docs.close(docs.activeId); }
      if (!native && event.key === ',') { event.preventDefault(); setDialog('appearance'); }
      if (event.key === 'Tab') { event.preventDefault(); docs.cycle(event.shiftKey ? -1 : 1); }
      if (event.key.toLowerCase() === 's') event.preventDefault();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [dialog, open, docs.activeId, docs.close, docs.cycle]);
  return <div className="app" onDragOver={event => { event.preventDefault(); if (!native && event.dataTransfer.types.includes('Files')) docs.setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) docs.setDragging(false); }} onDrop={event => {
    event.preventDefault(); docs.setDragging(false);
    if (!native) void docs.openBrowser(Array.from(event.dataTransfer.files));
  }}>
    <input className="file-input" ref={input} type="file" multiple aria-label="Choose documents" onChange={event => { void docs.openBrowser(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
    {!native && <BrowserMenu onAction={action} state={menuState} />}
    {docs.tabs.length > 0 && <Tabs tabs={docs.tabs} activeId={docs.activeId} onSelect={docs.select} onClose={docs.close} onOpen={open} />}
    {docs.error && <div className="app-alert" role="alert"><Icon name="warning" /><span>{docs.error}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => docs.setError('')}><Icon name="close" /></button></div>}
    {active ? <DocumentWorkspace key={active.id} ref={workspace} document={active} session={sessions.current.get(active.id)!} onOpen={open} reportError={docs.reportError} onMenuState={setDocumentMenu} /> : <EmptyState recents={docs.recents} onOpen={open} onRecent={path => void docs.openRecent(path)} onRemove={path => void docs.removeRecent(path)} />}
    {docs.opening && <div className="opening-indicator" role="status">Opening file…</div>}
    {docs.dragging && <div className="drop-overlay"><Icon name="open" width="36" height="36" /><span>Drop to open</span></div>}
    {dialog === 'appearance' && <AppearanceDialog theme={theme} onTheme={setTheme} onClose={() => setDialog(null)} />}
    {dialog === 'about' && <AboutDialog onClose={() => setDialog(null)} />}
  </div>;
}
