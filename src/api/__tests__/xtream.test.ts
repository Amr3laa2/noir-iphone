import { XtreamClient } from '../xtream';
import type { CacheStore, AccountProvider } from '../xtream';
import type { IptvAccount, PlayContext, Section } from '../types';

const ACCOUNT: IptvAccount = {
  id: 'acc1',
  name: 'Test',
  baseUrl: 'http://host:8080',
  username: 'user',
  password: 'pass',
  active: true,
  createdAt: 0,
  updatedAt: 0,
};

/** In-memory cache with TTL ignored (tests assert presence, not expiry). */
class FakeCache implements CacheStore {
  store = new Map<string, unknown>();
  setCalls: Array<{ key: string; ttl: number }> = [];

  private k(accountId: string, key: string) {
    return `${accountId}::${key}`;
  }
  async get(accountId: string, key: string): Promise<unknown | null> {
    const v = this.store.get(this.k(accountId, key));
    return v === undefined ? null : v;
  }
  async set(accountId: string, key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(this.k(accountId, key), value);
    this.setCalls.push({ key, ttl: ttlSeconds });
  }
  async clearPrefix(accountId: string, prefix: string): Promise<number> {
    let n = 0;
    const full = this.k(accountId, '');
    for (const mapKey of [...this.store.keys()]) {
      // mapKey is `${accountId}::${scopedKey}`; compare scopedKey against prefix.
      if (!mapKey.startsWith(full)) continue;
      const scoped = mapKey.slice(full.length);
      if (scoped.startsWith(prefix)) {
        this.store.delete(mapKey);
        n++;
      }
    }
    return n;
  }
}

class FakeAccounts implements AccountProvider {
  constructor(private account: IptvAccount | null) {}
  async getActive(): Promise<IptvAccount | null> {
    return this.account;
  }
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('XtreamClient', () => {
  it('throws when there is no active account', async () => {
    const client = new XtreamClient({
      accounts: new FakeAccounts(null),
      cache: new FakeCache(),
      fetchFn: jest.fn(),
    });
    await expect(client.getCategories('live')).rejects.toThrow(/IPTV account/i);
  });

  it('getCategories fetches on miss then caches (no second fetch)', async () => {
    const cache = new FakeCache();
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse([{ category_id: '1', category_name: 'News' }]));
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache,
      fetchFn,
    });

    const first = await client.getCategories('live');
    expect(first).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const second = await client.getCategories('live');
    expect(second).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1); // served from cache
  });

  it('getCategories returns [] for non-array payloads', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ error: 'nope' }));
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache: new FakeCache(),
      fetchFn,
    });
    await expect(client.getCategories('vod')).resolves.toEqual([]);
  });

  it('throws on non-ok HTTP responses', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(null, false, 502));
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache: new FakeCache(),
      fetchFn,
    });
    await expect(client.getCategories('live')).rejects.toThrow(/HTTP 502/);
  });

  it('getStreams applies category param, query filter and pagination', async () => {
    const payload = [
      { name: 'The Matrix', added: '100' },
      { name: 'Matrix Reloaded', added: '300' },
      { name: 'Inception', added: '200' },
    ];
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(payload));
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache: new FakeCache(),
      fetchFn,
    });

    const matrix = await client.getStreams('vod', 'cat5', 'matrix', 1, 0);
    expect(matrix).toHaveLength(1);
    const url = (fetchFn.mock.calls[0][0] as string);
    expect(url).toContain('category_id=cat5');
  });

  it('getStreams caches per category so different categories fetch separately', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse([{ name: 'A' }]));
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache: new FakeCache(),
      fetchFn,
    });
    await client.getStreams('vod', 'c1');
    await client.getStreams('vod', 'c2');
    await client.getStreams('vod', 'c1'); // cached
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('getStreamCount returns total ignoring pagination', async () => {
    const payload = Array.from({ length: 7 }, (_, i) => ({ name: `n${i}` }));
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(payload));
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache: new FakeCache(),
      fetchFn,
    });
    await expect(client.getStreamCount('live')).resolves.toBe(7);
  });

  it('searchContent aggregates sections and swallows per-section errors', async () => {
    const fetchFn = jest.fn((url: string) => {
      if (url.includes('get_series')) return Promise.reject(new Error('boom'));
      return Promise.resolve(jsonResponse([{ name: 'Match here' }]));
    });
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache: new FakeCache(),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const res = await client.searchContent('match');
    expect(res.live).toHaveLength(1);
    expect(res.movies).toHaveLength(1);
    expect(res.series).toEqual([]); // errored → swallowed
  });

  it('getHome aggregates, sorts, slices and includes continue-watching', async () => {
    const movies = Array.from({ length: 30 }, (_, i) => ({
      name: `Movie ${i}`,
      added: String(i),
    }));
    const series = Array.from({ length: 30 }, (_, i) => ({
      name: `Series ${i}`,
      last_modified: String(i),
    }));
    const live = Array.from({ length: 40 }, (_, i) => ({ name: `Ch ${i}` }));

    const fetchFn = jest.fn((url: string) => {
      if (url.includes('get_vod_streams')) return Promise.resolve(jsonResponse(movies));
      if (url.includes('get_series')) return Promise.resolve(jsonResponse(series));
      return Promise.resolve(jsonResponse(live));
    });

    const history: PlayContext[] = [{ title: 'Resume me' } as unknown as PlayContext];
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache: new FakeCache(),
      fetchFn: fetchFn as unknown as typeof fetch,
      getWatchHistory: async () => history,
    });

    const home = await client.getHome();
    expect(home.recentMovies).toHaveLength(24);
    expect(home.recentSeries).toHaveLength(24);
    expect(home.liveChannels).toHaveLength(18);
    expect(home.featured).toEqual({ name: 'Movie 29', added: '29' });
    expect(home.continueWatching).toBe(history);
    expect(home.account).toEqual({ id: 'acc1', name: 'Test' });
  });

  it('getHome tolerates a missing watch-history provider', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse([]));
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache: new FakeCache(),
      fetchFn,
    });
    const home = await client.getHome();
    expect(home.continueWatching).toEqual([]);
    expect(home.featured).toBeNull();
  });

  it('refreshMetadata clears categories + streams and counts rows', async () => {
    const cache = new FakeCache();
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse([{ name: 'A' }]));
    const client = new XtreamClient({
      accounts: new FakeAccounts(ACCOUNT),
      cache,
      fetchFn,
    });
    await client.getCategories('vod');
    await client.getStreams('vod', 'c1');
    await client.getStreams('vod', 'c2');

    const removed = await client.refreshMetadata('vod');
    expect(removed).toBe(3); // 1 categories + 2 stream caches
  });

  describe('resolveTtl via getTtlOverride', () => {
    it('uses override when >= 900', async () => {
      const cache = new FakeCache();
      const fetchFn = jest.fn().mockResolvedValue(jsonResponse([]));
      const client = new XtreamClient({
        accounts: new FakeAccounts(ACCOUNT),
        cache,
        fetchFn,
        getTtlOverride: () => 1000,
      });
      await client.getCategories('live');
      expect(cache.setCalls[0].ttl).toBe(1000);
    });

    it('ignores override below 900 (keeps per-call fallback)', async () => {
      const cache = new FakeCache();
      const fetchFn = jest.fn().mockResolvedValue(jsonResponse([]));
      const client = new XtreamClient({
        accounts: new FakeAccounts(ACCOUNT),
        cache,
        fetchFn,
        getTtlOverride: () => 60,
      });
      await client.getCategories('live'); // fallback 21600
      expect(cache.setCalls[0].ttl).toBe(21_600);
    });

    it('supports async overrides', async () => {
      const cache = new FakeCache();
      const fetchFn = jest.fn().mockResolvedValue(jsonResponse([]));
      const client = new XtreamClient({
        accounts: new FakeAccounts(ACCOUNT),
        cache,
        fetchFn,
        getTtlOverride: async () => 1500,
      });
      await client.getCategories('live');
      expect(cache.setCalls[0].ttl).toBe(1500);
    });
  });
});
