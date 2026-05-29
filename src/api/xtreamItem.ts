/**
 * Safe field accessors for loosely-typed Xtream items.
 *
 * Xtream providers are wildly inconsistent about field names and types (ids
 * arrive as numbers or strings; posters live under `stream_icon`, `cover`,
 * `cover_big`, or `movie_image`). These pure helpers normalise that mess so
 * screens can render without sprinkling `as` casts everywhere. Pure + fully
 * unit-testable on Node.
 */
import type { Section, XtreamItem } from './types';

const str = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v.length ? v : undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
};

const firstStr = (item: XtreamItem, keys: string[]): string | undefined => {
  for (const k of keys) {
    const s = str(item[k]);
    if (s !== undefined) return s;
  }
  return undefined;
};

/** Display name/title, falling back across the common field names. */
export function itemName(item: XtreamItem): string {
  return firstStr(item, ['name', 'title', 'stream_display_name']) ?? 'Untitled';
}

/**
 * The provider id for an item, depending on section:
 * series use `series_id`; live/vod use `stream_id` (then `id`).
 */
export function itemId(item: XtreamItem, section: Section): string | undefined {
  if (section === 'series') {
    return firstStr(item, ['series_id', 'id']);
  }
  return firstStr(item, ['stream_id', 'id']);
}

/** Poster/cover artwork URL, across the many provider conventions. */
export function itemPoster(item: XtreamItem): string | undefined {
  return firstStr(item, [
    'stream_icon',
    'cover',
    'cover_big',
    'movie_image',
    'poster',
    'icon',
  ]);
}

/** Category id as a string, if present. */
export function itemCategoryId(item: XtreamItem): string | undefined {
  return firstStr(item, ['category_id']);
}

/**
 * File extension for building a VOD/series stream URL. Defaults to `mp4` when
 * the provider omits `container_extension`.
 */
export function itemExtension(item: XtreamItem): string {
  return firstStr(item, ['container_extension', 'ext']) ?? 'mp4';
}

/** Rating as a 0–10 number when parseable, else undefined. */
export function itemRating(item: XtreamItem): number | undefined {
  const raw = firstStr(item, ['rating', 'rating_5based']);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
