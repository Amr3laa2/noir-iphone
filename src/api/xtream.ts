/**
 * Xtream Codes API client — TypeScript port of the desktop `iptv.rs`.
 *
 * Network + cache + account access are injected as interfaces so the whole
 * client is unit-testable on Node with in-memory fakes and a mocked fetch.
 * The concrete wiring (expo-sqlite cache, account store) lives elsewhere and
 * is supplied at app startup.
 */
import type {
  HomePayload,
  IptvAccount,
  PlayContext,
  Section,
  XtreamItem,
} from './types';
import {
  apiUrl,
  categoriesAction,
  streamUrl,
  streamsAction,
} from './xtreamUrls';
import {
  filterByQuery,
  paginate,
  sortRecentMovies,
  sortRecentSeries,
} from './xtreamTransform';

/** Persistent metadata cache, scoped per account. */
export interface CacheStore {
  get(accountId: string, key: string): Promise<unknown | null>;
  set(accountId: string, key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Removes entries whose key starts with `prefix`; returns count removed. */
  clearPrefix(accountId: string, prefix: string): Promise<number>;
}

/** Supplies the currently active IPTV account (or null if none configured). */
export interface AccountProvider {
  getActive(): Promise<IptvAccount | null>;
}

export interface XtreamClientDeps {
  accounts: AccountProvider;
  cache: CacheStore;
  /** Defaults to global fetch; injectable for tests. */
  fetchFn?: typeof fetch;
  /**
   * Optional global metadata-TTL override in seconds. When it returns a value
   * >= 900 it replaces the per-call fallback, matching desktop behaviour.
   */
  getTtlOverride?: () => Promise<number | null> | number | null;
  /** Supplies continue-watching items for the home feed. */
  getWatchHistory?: () => Promise<PlayContext[]>;
}

const NO_ACCOUNT = 'Add and activate an IPTV account in Settings first';

export class XtreamClient {
  private readonly accounts: AccountProvider;
  private readonly cache: CacheStore;
  private readonly fetchFn: typeof fetch;
  private readonly getTtlOverride?: XtreamClientDeps['getTtlOverride'];
  private readonly getWatchHistory?: XtreamClientDeps['getWatchHistory'];

  constructor(deps: XtreamClientDeps) {
    this.accounts = deps.accounts;
    this.cache = deps.cache;
    this.fetchFn = deps.fetchFn ?? fetch;
    this.getTtlOverride = deps.getTtlOverride;
    this.getWatchHistory = deps.getWatchHistory;
  }

  private async active(): Promise<IptvAccount> {
    const account = await this.accounts.getActive();
    if (!account) throw new Error(NO_ACCOUNT);
    return account;
  }

  private async resolveTtl(fallback: number): Promise<number> {
    if (!this.getTtlOverride) return fallback;
    const raw = await this.getTtlOverride();
    return typeof raw === 'number' && raw >= 900 ? raw : fallback;
  }

  /** Cache-first GET against player_api.php, scoped to the account. */
  private async getCached(
    account: IptvAccount,
    key: string,
    params: string,
    ttl: number,
  ): Promise<unknown> {
    const scopedKey = `${account.id}:${key}`;
    const hit = await this.cache.get(account.id, scopedKey);
    if (hit !== null && hit !== undefined) return hit;

    const res = await this.fetchFn(apiUrl(account, params));
    if (!res.ok) {
      throw new Error(`Xtream request failed: HTTP ${res.status}`);
    }
    const value = await res.json();
    await this.cache.set(account.id, scopedKey, value, ttl);
    return value;
  }

  async getCategories(section: Section): Promise<XtreamItem[]> {
    const account = await this.active();
    const value = await this.getCached(
      account,
      `categories:${section}`,
      `action=${categoriesAction(section)}`,
      await this.resolveTtl(21_600),
    );
    return Array.isArray(value) ? (value as XtreamItem[]) : [];
  }

  async getStreams(
    section: Section,
    categoryId?: string,
    query?: string,
    limit?: number,
    offset?: number,
  ): Promise<XtreamItem[]> {
    const account = await this.active();
    const catPart = categoryId && categoryId.length ? categoryId : 'all';
    let params = `action=${streamsAction(section)}`;
    if (categoryId && categoryId.length) {
      params += `&category_id=${encodeURIComponent(categoryId)}`;
    }

    const value = await this.getCached(
      account,
      `streams:${section}:${catPart}`,
      params,
      await this.resolveTtl(86_400),
    );
    let items: XtreamItem[] = Array.isArray(value) ? (value as XtreamItem[]) : [];
    items = filterByQuery(items, query);
    items = paginate(items, limit, offset);
    return items;
  }

  async getStreamCount(
    section: Section,
    categoryId?: string,
    query?: string,
  ): Promise<number> {
    const items = await this.getStreams(section, categoryId, query);
    return items.length;
  }

  async getSeriesInfo(seriesId: string): Promise<unknown> {
    const account = await this.active();
    return this.getCached(
      account,
      `series_info:${seriesId}`,
      `action=get_series_info&series_id=${encodeURIComponent(seriesId)}`,
      await this.resolveTtl(43_200),
    );
  }

  async getVodInfo(vodId: string): Promise<unknown> {
    const account = await this.active();
    return this.getCached(
      account,
      `vod_info:${vodId}`,
      `action=get_vod_info&vod_id=${encodeURIComponent(vodId)}`,
      await this.resolveTtl(86_400),
    );
  }

  async searchContent(query: string): Promise<{
    live: XtreamItem[];
    movies: XtreamItem[];
    series: XtreamItem[];
  }> {
    const safe = async (section: Section) =>
      this.getStreams(section, undefined, query, 60, 0).catch(() => []);
    const [live, movies, series] = await Promise.all([
      safe('live'),
      safe('vod'),
      safe('series'),
    ]);
    return { live, movies, series };
  }

  async getHome(): Promise<HomePayload> {
    const account = await this.active();
    const safe = async (
      section: Section,
      limit?: number,
      offset?: number,
    ) => this.getStreams(section, undefined, undefined, limit, offset).catch(() => []);

    const [movies, series, live] = await Promise.all([
      safe('vod'),
      safe('series'),
      safe('live', 18, 0),
    ]);

    const recentMovies = sortRecentMovies(movies);
    const recentSeries = sortRecentSeries(series);
    const continueWatching = this.getWatchHistory
      ? await this.getWatchHistory().catch(() => [])
      : [];

    return {
      featured: recentMovies[0] ?? null,
      continueWatching,
      recentMovies: recentMovies.slice(0, 24),
      recentSeries: recentSeries.slice(0, 24),
      liveChannels: live.slice(0, 18),
      account: { id: account.id, name: account.name },
    };
  }

  /** Clears cached categories + streams for a section. Returns rows removed. */
  async refreshMetadata(section: Section): Promise<number> {
    const account = await this.active();
    const categories = await this.cache.clearPrefix(
      account.id,
      `${account.id}:categories:${section}`,
    );
    const streams = await this.cache.clearPrefix(
      account.id,
      `${account.id}:streams:${section}:`,
    );
    return categories + streams;
  }

  /** Convenience passthrough for building a playable stream URL. */
  buildStreamUrl(account: IptvAccount, section: Section, id: string, ext: string): string {
    return streamUrl(account, section, id, ext);
  }
}
