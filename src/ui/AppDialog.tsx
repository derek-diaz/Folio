import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function AppDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  return <dialog className="app-dialog" ref={dialog} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="dialog-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}><Icon name="close" /></button></header>
    {children}
    <footer className="dialog-footer"><button className="primary-button" autoFocus onClick={onClose}>Done</button></footer>
  </dialog>;
}
