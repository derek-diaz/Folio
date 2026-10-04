import { useEffect, useRef } from 'react';
import type { DocumentFile } from '../core/types';
import { Icon } from './Icon';
import { DocumentIcon } from './DocumentIcon';

export function Tabs({ tabs, activeId, onSelect, onClose, onOpen }: { tabs: DocumentFile[]; activeId: string | null; onSelect: (id: string) => void; onClose: (id: string) => void; onOpen: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const close = (id: string) => {
    const tab = root.current?.querySelector(`[id="tab-${id}"]`)?.parentElement;
    const restoreFocus = tab?.contains(document.activeElement);
    onClose(id);
    if (restoreFocus) requestAnimationFrame(() => {
      const active = root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (active) active.focus();
      else if (openButton.current) openButton.current.focus();
      else document.querySelector<HTMLButtonElement>('.empty-actions button')?.focus();
    });
  };
  useEffect(() => { root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }, [activeId]);
  return <header className="tab-strip">
    <div className="tabs" role="tablist" aria-label="Open documents" ref={root}>
      {tabs.map((tab, index) => <div className={`tab ${tab.id === activeId ? 'active' : ''}`} key={tab.id} onMouseDown={event => { if (event.button === 1) event.preventDefault(); }} onAuxClick={event => { if (event.button === 1) { event.preventDefault(); close(tab.id); } }}>
        <button role="tab" id={`tab-${tab.id}`} aria-selected={tab.id === activeId} aria-controls="document-panel" tabIndex={tab.id === activeId ? 0 : -1} title={tab.path ?? tab.name} onClick={() => onSelect(tab.id)} onKeyDown={event => {
          let next = index;
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = tabs.length - 1;
          else if (event.key === 'Delete') { event.preventDefault(); close(tab.id); return; }
          else return;
          event.preventDefault(); onSelect(tabs[next].id);
          root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}><DocumentIcon name={tab.name} size={15} /><span>{tab.name}</span></button>
        <button className="tab-close" tabIndex={tab.id === activeId ? 0 : -1} aria-label={`Close ${tab.name}`} title="Close tab (Ctrl+W)" onClick={() => close(tab.id)}><Icon name="close" width="13" height="13" /></button>
      </div>)}
    </div>
    <button className="icon-button new-tab" ref={openButton} aria-label="Open file" title="Open file (Ctrl+O)" onClick={onOpen}><Icon name="plus" /></button>
  </header>;
}
