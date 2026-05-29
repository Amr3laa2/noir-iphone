/**
 * Shared data types for Noir Mobile.
 *
 * Ported from the desktop app's `src/api/commands.ts` so screens, stores,
 * and the data layer all speak the same shapes. These are intentionally
 * framework-agnostic (no React/RN imports) so they can be used from tests.
 */

export type Section = 'live' | 'vod' | 'series';

export type IptvAccount = {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type AccountInput = {
  id?: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  active?: boolean;
};

export type PlayContext = {
  contentType: Section;
  streamId: string;
  title: string;
  poster?: string;
  url: string;
  startPosition?: number;
  origin?: Record<string, unknown>;
  movie?: Record<string, unknown>;
  series?: Record<string, unknown>;
};

export type DownloadStatus =
  | 'queued'
  | 'active'
  | 'downloading'
  | 'paused'
  | 'done'
  | 'error'
  | 'cancelled';

export type Download = {
  id: string;
  contentType: string;
  streamId: string;
  title: string;
  url: string;
  outputPath?: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: string;
  eta?: string;
  engine: string;
  error?: string;
  connections?: number;
  createdAt: number;
  updatedAt: number;
  poster?: string;
  seriesId?: string;
  seriesTitle?: string;
  season?: string;
  episodeNumber?: string;
};

export type DownloadAvailability = {
  downloaded: boolean;
  outputPath?: string;
  missing?: boolean;
  offlineCount?: number;
};

export type WatchPosition = {
  position: number;
  duration: number;
};

export type WatchlistItem = {
  id: string;
  contentType: string;
  streamId: string;
  title: string;
  poster?: string;
  itemJson: string;
  addedAt: number;
};

export type LiveRecent = {
  streamId: string;
  name: string;
  streamIcon?: string;
  categoryId?: string;
  categoryName?: string;
  watchedAt: number;
};

export type LiveRecentInput = {
  streamId: string;
  name: string;
  streamIcon?: string;
  categoryId?: string;
  categoryName?: string;
};

/** A raw Xtream stream/category item — shape varies by provider, so loose. */
export type XtreamItem = Record<string, unknown>;

export type HomePayload = {
  featured: XtreamItem | null;
  continueWatching: PlayContext[];
  recentMovies: XtreamItem[];
  recentSeries: XtreamItem[];
  liveChannels: XtreamItem[];
  account: { id: string; name: string };
};
