/**
 * Parsers for the `get_vod_info` / `get_series_info` responses.
 *
 * These payloads are deeply nested and provider-inconsistent, so parsing lives
 * here as pure functions (unit-tested on Node) and the detail screen just
 * renders the normalised result.
 */
import type { XtreamItem } from './types';

const asRecord = (v: unknown): XtreamItem => (v && typeof v === 'object' ? (v as XtreamItem) : {});

const str = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v.length ? v : undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
};

const pick = (obj: XtreamItem, keys: string[]): string | undefined => {
  for (const k of keys) {
    const s = str(obj[k]);
    if (s !== undefined) return s;
  }
  return undefined;
};

export interface VodDetail {
  title: string;
  plot?: string;
  poster?: string;
  extension: string;
  genre?: string;
  releaseDate?: string;
  rating?: string;
  durationSeconds?: number;
}

export function parseVodInfo(raw: unknown, fallbackTitle = 'Movie'): VodDetail {
  const root = asRecord(raw);
  const info = asRecord(root.info);
  const movie = asRecord(root.movie_data);
  return {
    title: pick(movie, ['name']) ?? pick(info, ['name']) ?? fallbackTitle,
    plot: pick(info, ['plot', 'description']),
    poster: pick(info, ['movie_image', 'cover_big', 'cover']),
    extension: pick(movie, ['container_extension']) ?? 'mp4',
    genre: pick(info, ['genre']),
    releaseDate: pick(info, ['releasedate', 'release_date']),
    rating: pick(info, ['rating']),
    durationSeconds: parseDuration(pick(info, ['duration_secs', 'duration'])),
  };
}

export interface Episode {
  id: string;
  title: string;
  extension: string;
  season: string;
  episodeNum?: string;
}

export interface SeriesDetail {
  title: string;
  plot?: string;
  poster?: string;
  genre?: string;
  seasons: { season: string; episodes: Episode[] }[];
}

export function parseSeriesInfo(raw: unknown, fallbackTitle = 'Series'): SeriesDetail {
  const root = asRecord(raw);
  const info = asRecord(root.info);
  const episodesObj = asRecord(root.episodes);

  const seasons: { season: string; episodes: Episode[] }[] = [];
  // Episodes are keyed by season number ("1", "2", ...) → array of episodes.
  const seasonKeys = Object.keys(episodesObj).sort((a, b) => Number(a) - Number(b));
  for (const key of seasonKeys) {
    const list = episodesObj[key];
    if (!Array.isArray(list)) continue;
    const episodes: Episode[] = [];
    for (const epRaw of list) {
      const ep = asRecord(epRaw);
      const id = pick(ep, ['id', 'stream_id']);
      if (!id) continue;
      episodes.push({
        id,
        title: pick(ep, ['title']) ?? `Episode ${pick(ep, ['episode_num']) ?? ''}`.trim(),
        extension: pick(ep, ['container_extension']) ?? 'mp4',
        season: key,
        episodeNum: pick(ep, ['episode_num']),
      });
    }
    if (episodes.length) seasons.push({ season: key, episodes });
  }

  return {
    title: pick(info, ['name', 'title']) ?? fallbackTitle,
    plot: pick(info, ['plot', 'description']),
    poster: pick(info, ['cover', 'cover_big', 'movie_image']),
    genre: pick(info, ['genre']),
    seasons,
  };
}

function parseDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  // Either seconds ("5400") or "HH:MM:SS".
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(':').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return undefined;
}
