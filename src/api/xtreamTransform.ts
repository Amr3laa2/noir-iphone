/**
 * Pure transforms over Xtream stream lists.
 *
 * Ported from the desktop `iptv.rs` query-filter, pagination, and home-feed
 * sorting logic. No network or state — fully unit-testable on Node.
 */
import type { XtreamItem } from './types';

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

const itemName = (item: XtreamItem): string =>
  asString(item.name) || asString(item.title);

/** Numeric epoch from a stringified field (Xtream stores these as strings). */
const numField = (item: XtreamItem, key: string): number => {
  const raw = item[key];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** Case-insensitive substring filter on name/title. Mirrors desktop retain(). */
export function filterByQuery(items: XtreamItem[], query?: string): XtreamItem[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => itemName(item).toLowerCase().includes(q));
}

/** Slices [offset, offset+limit). Mirrors desktop saturating pagination. */
export function paginate(
  items: XtreamItem[],
  limit?: number,
  offset?: number,
): XtreamItem[] {
  const off = offset ?? 0;
  if (limit === undefined && off <= 0) return items;
  const start = Math.min(off, items.length);
  const end =
    limit === undefined ? items.length : Math.min(start + limit, items.length);
  return items.slice(start, end);
}

/** Newest-first by `added` (movies). Returns a new array. */
export function sortRecentMovies(items: XtreamItem[]): XtreamItem[] {
  return [...items].sort((a, b) => numField(b, 'added') - numField(a, 'added'));
}

/** Newest-first by `last_modified` (fallback `added`) for series. New array. */
export function sortRecentSeries(items: XtreamItem[]): XtreamItem[] {
  const key = (item: XtreamItem) =>
    item.last_modified !== undefined
      ? numField(item, 'last_modified')
      : numField(item, 'added');
  return [...items].sort((a, b) => key(b) - key(a));
}
