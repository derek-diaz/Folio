import { useEffect, useRef } from 'react';
import { MAX_MATCHES } from '../core/search';
import { Icon } from './Icon';

export function SearchBar({ query, count, index, pending, focusKey, onQuery, onStep, onClose }: { query: string; count: number; index: number; pending: boolean; focusKey: number; onQuery: (value: string) => void; onStep: (delta: number) => void; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, [focusKey]);
  return <div className="search-bar" role="search" aria-label="Search document">
    <Icon name="search" width="16" height="16" />
    <input ref={input} aria-label="Find in document" placeholder="Find in document" value={query} maxLength={250} onChange={event => onQuery(event.target.value)} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); if (!pending) onStep(event.shiftKey ? -1 : 1); }
    }} />
    <span className="search-count" role="status" aria-atomic="true">{!query ? '' : pending ? 'Searching…' : count ? `${Math.min(index + 1, count)} of ${count.toLocaleString()}${count >= MAX_MATCHES ? '+' : ''}` : 'No results'}</span>
    <button className="icon-button" disabled={!query || pending || !count} aria-label="Previous result" title="Previous result (Shift+F3)" onClick={() => onStep(-1)}><Icon name="up" /></button>
    <button className="icon-button" disabled={!query || pending || !count} aria-label="Next result" title="Next result (F3)" onClick={() => onStep(1)}><Icon name="down" /></button>
    <button className="icon-button" aria-label="Close search" title="Close search (Esc)" onClick={onClose}><Icon name="close" /></button>
  </div>;
}
