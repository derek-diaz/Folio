import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface ToolbarMenuItem { label: string; action: () => void; checked?: boolean; disabled?: boolean }

export function ToolbarMenu({ label, name, items, className = '' }: { label: string; name: string; items: ToolbarMenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<'first' | 'last'>('first');
  const id = useId();
  const close = (restore = false) => { setOpen(false); if (restore) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const buttons = root.current?.querySelectorAll<HTMLButtonElement>('[role=menu] button:not(:disabled)');
    buttons?.[first.current === 'last' ? buttons.length - 1 : 0]?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const resize = () => { setOpen(false); };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, [open]);
  return <div className={`toolbar-menu ${className}`} ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
  }}>
    <button ref={trigger} className="toolbar-menu-trigger" title={name} aria-label={`${name}: ${label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { first.current = 'first'; setOpen(value => !value); }} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); first.current = event.key === 'ArrowUp' ? 'last' : 'first'; setOpen(true); }
    }}>{label}<Icon name="down" width="12" height="12" /></button>
    {open && <div className="menu-popup toolbar-popup" id={id} role="menu" aria-label={name} onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons[next]?.focus();
    }}>{items.map(item => <button key={item.label} role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} disabled={item.disabled} onMouseDown={event => event.preventDefault()} onClick={() => { close(true); item.action(); }}><span>{item.label}</span>{item.checked && <span aria-hidden="true">✓</span>}</button>)}</div>}
  </div>;
}
