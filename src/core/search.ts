export const MAX_MATCHES = 10000;
export interface TextMatch { start: number; end: number }
export function findMatches(text: string, query: string, limit = MAX_MATCHES): TextMatch[] {
  if (!query) return [];
  // RegExp's Unicode case folding preserves source offsets (lowercasing can change length).
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const matches: TextMatch[] = [];
  for (const match of text.matchAll(pattern)) {
    matches.push({ start: match.index!, end: match.index! + match[0].length });
    if (matches.length >= limit) break;
  }
  return matches;
}
export function cycleIndex(index: number, delta: number, count: number): number { return count ? (index + delta + count) % count : 0; }
