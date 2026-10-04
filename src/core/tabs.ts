export function nextTabId(ids: string[], current: string | null, delta: number): string | null {
  if (!ids.length) return null;
  const index = Math.max(0, ids.indexOf(current ?? ''));
  return ids[(index + delta + ids.length) % ids.length];
}
export function activeAfterClose(ids: string[], active: string | null, closing: string): string | null {
  if (active !== closing) return active;
  const index = ids.indexOf(closing);
  return ids[index + 1] ?? ids[index - 1] ?? null;
}
export function clampZoom(value: number): number { return Math.min(3, Math.max(0.25, Math.round(value * 100) / 100)); }
