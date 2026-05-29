/**
 * Pure URL builders for the Xtream Codes API.
 *
 * Ported 1:1 from the desktop `iptv.rs` (`api_url` / `stream_url`). No network,
 * no state — just string construction, so this is fully unit-testable on Node.
 */
import type { IptvAccount, Section } from './types';

/** Account-shaped subset needed for URL building (keeps tests light). */
export type UrlAccount = Pick<IptvAccount, 'baseUrl' | 'username' | 'password'>;

const trimTrailingSlash = (s: string): string => s.replace(/\/+$/, '');

/**
 * Builds a `player_api.php` URL with credentials and optional extra params.
 * `params` is a pre-built query fragment like "action=get_vod_streams".
 */
export function apiUrl(account: UrlAccount, params = ''): string {
  const base = trimTrailingSlash(account.baseUrl);
  const url =
    `${base}/player_api.php` +
    `?username=${encodeURIComponent(account.username)}` +
    `&password=${encodeURIComponent(account.password)}`;
  return params ? `${url}&${params}` : url;
}

/**
 * Builds a direct stream URL for live / movie / series playback.
 * Mirrors the desktop path layout: /{live|movie|series}/{user}/{pass}/{id}.{ext}
 */
export function streamUrl(
  account: UrlAccount,
  section: Section,
  id: string,
  ext: string,
): string {
  const base = trimTrailingSlash(account.baseUrl);
  const seg = section === 'live' ? 'live' : section === 'series' ? 'series' : 'movie';
  return `${base}/${seg}/${account.username}/${account.password}/${id}.${ext}`;
}

/** Maps a section to its Xtream "get categories" action. */
export function categoriesAction(section: Section): string {
  switch (section) {
    case 'live':
      return 'get_live_categories';
    case 'vod':
      return 'get_vod_categories';
    case 'series':
      return 'get_series_categories';
  }
}

/** Maps a section to its Xtream "get streams" action. */
export function streamsAction(section: Section): string {
  switch (section) {
    case 'live':
      return 'get_live_streams';
    case 'vod':
      return 'get_vod_streams';
    case 'series':
      return 'get_series';
  }
}
