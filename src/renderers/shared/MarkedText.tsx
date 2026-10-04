import { Fragment } from 'react';
import { findMatches } from '../../core/search';

export function MarkedText({ text, query, active = false }: { text: string; query: string; active?: boolean }) {
  const matches = findMatches(text, query, 1000);
  let previous = 0;
  return <>{matches.map((match, index) => {
    const prefix = text.slice(previous, match.start);
    previous = match.end;
    return <Fragment key={index}>{prefix}<mark className={active ? 'current' : undefined}>{text.slice(match.start, match.end)}</mark></Fragment>;
  })}{text.slice(previous)}</>;
}
