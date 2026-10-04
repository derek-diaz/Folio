import { useEffect, useRef, useState } from 'react';
import type { MenuAction, MenuState } from '../platform/menu';

// The desktop uses OS menus. This equivalent keeps browser development usable.
export function BrowserMenu({ onAction, state }: { onAction: (action: MenuAction) => void; state: MenuState }) {
  const [opened, setOpened] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const groups: { name: string; items: { id: MenuAction; label: string; shortcut?: string; enabled?: boolean }[] }[] = [
    { name: 'File', items: [
      { id: 'open', label: 'Open…', shortcut: 'Ctrl+O' },
      { id: 'close', label: 'Close Tab', shortcut: 'Ctrl+W', enabled: state.document },
      { id: 'print', label: 'Print…', shortcut: 'Ctrl+P', enabled: state.print },
    ] },
    { name: 'View', items: [
      { id: 'find', label: 'Find in Document…', shortcut: 'Ctrl+F', enabled: state.find },
      { id: 'zoom-in', label: 'Zoom In', shortcut: 'Ctrl++', enabled: state.zoom },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: 'Ctrl+−', enabled: state.zoom },
      { id: 'actual-size', label: 'Actual Size', shortcut: 'Ctrl+0', enabled: state.zoom },
      { id: 'fit', label: state.fitWindow ? 'Fit to Window' : 'Fit Width', enabled: state.fit },
      { id: 'fit-page', label: 'Fit Page', enabled: state.fitPage },
      { id: 'appearance', label: 'Appearance…', shortcut: 'Ctrl+,' },
    ] },
    { name: 'Help', items: [{ id: 'about', label: 'About Folio', shortcut: 'F1' }] },
  ];
  const close = (restore = false) => {
    if (restore && opened !== null) root.current?.querySelectorAll<HTMLButtonElement>('.menu-trigger')[opened]?.focus();
    setOpened(null);
  };
  useEffect(() => {
    if (opened === null) return;
    root.current?.querySelector<HTMLButtonElement>('[role=menu] button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpened(null); };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [opened]);
  return <div className="browser-menubar" role="menubar" aria-label="Application menu" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpened(null); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (event.key === 'Tab') close();
    if (opened !== null && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setOpened((opened + (event.key === 'ArrowRight' ? 1 : groups.length - 1)) % groups.length); }
  }}>
    {groups.map((group, index) => <div className="menu-group" key={group.name}>
      <button className="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded={opened === index} onClick={() => setOpened(opened === index ? null : index)} onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); setOpened(index); }
        if (opened === null && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); root.current?.querySelectorAll<HTMLButtonElement>('.menu-trigger')[(index + (event.key === 'ArrowRight' ? 1 : groups.length - 1)) % groups.length]?.focus(); }
      }}>{group.name}</button>
      {opened === index && <div className="menu-popup" role="menu" aria-label={group.name} onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        items[next]?.focus();
      }}>{group.items.map(item => <button role="menuitem" key={item.id} disabled={item.enabled === false} onMouseDown={event => event.preventDefault()} onClick={() => { close(true); onAction(item.id); }}><span>{item.label}</span><span className="menu-shortcut">{item.shortcut}</span></button>)}</div>}
    </div>)}
  </div>;
}
