import type { SVGProps } from 'react';
const paths = {
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
  image: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1 M3 16l5-5 4 4 3-3 6 6 M16 7h.01',
  table: 'M3 4h18v16H3z M3 9h18 M9 9v11 M15 9v11 M3 14h18',
  open: 'M3 7V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v1 M3 9h19l-3 11H2z',
  close: 'M6 6l12 12 M18 6L6 18',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  fit: 'M3 4v16 M21 4v16 M8 8l-4 4 4 4 M16 8l4 4-4 4 M4 12h16',
  print: 'M6 9V3h12v6 M6 18H3V9h18v9h-3 M6 14h12v8H6z M17 11h1',
  external: 'M14 3h7v7 M21 3l-11 11 M10 3H3v18h18v-7',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  warning: 'M12 3L1 21h22z M12 9v5 M12 17h.01',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z',
};
export type IconName = keyof typeof paths;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
