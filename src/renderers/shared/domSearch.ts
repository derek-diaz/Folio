import { findMatches } from '../../core/search';

export function clearHighlights(root: HTMLElement) {
  root.querySelectorAll('mark[data-match]').forEach(mark => mark.replaceWith(...Array.from(mark.childNodes)));
  root.normalize();
}
export function highlightDom(root: HTMLElement, query: string): number {
  clearHighlights(root);
  if (!query) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number }[] = [];
  let text = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    nodes.push({ node, start: text.length });
    text += node.data;
  }
  const matches = findMatches(text, query);
  // A match may cross inline formatting boundaries; every fragment shares an index.
  let firstMatch = 0;
  for (const { node, start } of nodes) {
    const end = start + node.length;
    while (firstMatch < matches.length && matches[firstMatch].end <= start) firstMatch++;
    const intersections: { start: number; end: number; index: number }[] = [];
    for (let index = firstMatch; index < matches.length && matches[index].start < end; index++) {
      const match = matches[index];
      intersections.push({ start: Math.max(start, match.start) - start, end: Math.min(end, match.end) - start, index });
    }
    for (const match of intersections.reverse()) {
      const part = node.splitText(match.start);
      part.splitText(match.end - match.start);
      const mark = document.createElement('mark');
      mark.dataset.match = String(match.index);
      part.replaceWith(mark);
      mark.append(part);
    }
  }
  return matches.length;
}
export function focusDomMatch(root: HTMLElement, index: number, scroll = true) {
  root.querySelectorAll('mark.current').forEach(mark => mark.classList.remove('current'));
  const marks = root.querySelectorAll<HTMLElement>(`mark[data-match="${index}"]`);
  marks.forEach(mark => mark.classList.add('current'));
  if (scroll) marks[0]?.scrollIntoView({ block: 'center', inline: 'nearest' });
}
