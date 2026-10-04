import type { RecentFile } from './types';
export const RECENT_LIMIT = 12;
export function cleanRecents(value: unknown): RecentFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RecentFile => typeof item?.path === 'string' && typeof item?.name === 'string' && typeof item?.openedAt === 'number' && Number.isFinite(item.openedAt))
    .sort((a, b) => b.openedAt - a.openedAt).filter((item, i, all) => all.findIndex(other => other.path === item.path) === i).slice(0, RECENT_LIMIT);
}
export function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
