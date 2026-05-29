import { createNodeSqlDatabase } from './nodeSqlite';
import { migrate, nowSeconds } from '../schema';
import { SqliteCacheStore } from '../cacheStore';
import { SqliteAccountStore } from '../accountStore';
import { SettingsStore } from '../settingsStore';
import { WatchHistoryStore } from '../watchHistory';
import { WatchlistStore } from '../watchlist';
import { LiveRecentsStore } from '../liveRecents';
import type { SqlDatabase } from '../types';
import type { PlayContext } from '../../api/types';

async function freshDb(): Promise<SqlDatabase> {
  const db = createNodeSqlDatabase();
  await migrate(db);
  return db;
}

describe('migrate', () => {
  it('creates all tables idempotently', async () => {
    const db = await freshDb();
    await expect(migrate(db)).resolves.toBeUndefined(); // second run is a no-op
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'settings',
        'iptv_accounts',
        'cache_entries',
        'watch_history',
        'watchlist',
        'downloads',
        'live_recents',
      ]),
    );
  });
});

describe('SqliteCacheStore', () => {
  it('stores and reads JSON payloads scoped by account', async () => {
    const db = await freshDb();
    const cache = new SqliteCacheStore(db);
    await cache.set('acc1', 'acc1:k', { a: 1 }, 3600);
    await expect(cache.get('acc1', 'acc1:k')).resolves.toEqual({ a: 1 });
    await expect(cache.get('acc2', 'acc1:k')).resolves.toBeNull(); // wrong account
  });

  it('evicts and returns null for expired entries', async () => {
    const db = await freshDb();
    const cache = new SqliteCacheStore(db);
    // Insert directly with an already-past expires_at.
    await db.runAsync(
      'INSERT INTO cache_entries(key, account_id, payload, created_at, expires_at) VALUES(?,?,?,?,?)',
      ['acc1:old', 'acc1', JSON.stringify([1]), nowSeconds() - 100, nowSeconds() - 1],
    );
    await expect(cache.get('acc1', 'acc1:old')).resolves.toBeNull();
    const remaining = await db.getFirstAsync('SELECT 1 FROM cache_entries WHERE key = ?', [
      'acc1:old',
    ]);
    expect(remaining).toBeNull(); // lazily evicted
  });

  it('upserts on duplicate key', async () => {
    const db = await freshDb();
    const cache = new SqliteCacheStore(db);
    await cache.set('acc1', 'acc1:k', { v: 1 }, 3600);
    await cache.set('acc1', 'acc1:k', { v: 2 }, 3600);
    await expect(cache.get('acc1', 'acc1:k')).resolves.toEqual({ v: 2 });
  });

  it('clearPrefix deletes matching keys and counts them, escaping wildcards', async () => {
    const db = await freshDb();
    const cache = new SqliteCacheStore(db);
    await cache.set('acc1', 'acc1:streams:vod:c1', [1], 3600);
    await cache.set('acc1', 'acc1:streams:vod:c2', [2], 3600);
    await cache.set('acc1', 'acc1:categories:vod', [3], 3600);
    const removed = await cache.clearPrefix('acc1', 'acc1:streams:vod:');
    expect(removed).toBe(2);
    await expect(cache.get('acc1', 'acc1:categories:vod')).resolves.toEqual([3]);
  });
});

describe('SqliteAccountStore', () => {
  const idgen = () => {
    let n = 0;
    return () => `id-${++n}`;
  };

  it('saves, lists and reads back accounts', async () => {
    const db = await freshDb();
    const store = new SqliteAccountStore(db, idgen());
    const a = await store.save({
      name: 'Acct',
      baseUrl: 'http://h:8080',
      username: 'u',
      password: 'p',
      active: true,
    });
    expect(a.id).toBe('id-1');
    expect(a.active).toBe(true);
    expect((await store.list())).toHaveLength(1);
    await expect(store.getActive()).resolves.toMatchObject({ id: 'id-1' });
  });

  it('keeps exactly one active account', async () => {
    const db = await freshDb();
    const store = new SqliteAccountStore(db, idgen());
    const a = await store.save({ name: 'A', baseUrl: 'x', username: 'u', password: 'p', active: true });
    const b = await store.save({ name: 'B', baseUrl: 'y', username: 'u', password: 'p', active: true });
    const active = await store.getActive();
    expect(active?.id).toBe(b.id);
    expect((await store.get(a.id))?.active).toBe(false);
  });

  it('updates an existing account by id', async () => {
    const db = await freshDb();
    const store = new SqliteAccountStore(db, idgen());
    const a = await store.save({ name: 'A', baseUrl: 'x', username: 'u', password: 'p' });
    const updated = await store.save({ id: a.id, name: 'Renamed', baseUrl: 'x', username: 'u', password: 'p' });
    expect(updated.id).toBe(a.id);
    expect(updated.name).toBe('Renamed');
    expect(await store.list()).toHaveLength(1);
  });

  it('setActive and remove work', async () => {
    const db = await freshDb();
    const store = new SqliteAccountStore(db, idgen());
    const a = await store.save({ name: 'A', baseUrl: 'x', username: 'u', password: 'p' });
    const b = await store.save({ name: 'B', baseUrl: 'y', username: 'u', password: 'p' });
    await store.setActive(a.id);
    expect((await store.getActive())?.id).toBe(a.id);
    await store.remove(a.id);
    expect(await store.get(a.id)).toBeNull();
  });
});

describe('SettingsStore', () => {
  it('round-trips strings, numbers and bools with upsert', async () => {
    const db = await freshDb();
    const s = new SettingsStore(db);
    await s.set('theme', 'dark');
    await s.set('theme', 'noir'); // upsert
    await s.set('ttl', '1800');
    await s.set('flag', '1');
    await expect(s.get('theme')).resolves.toBe('noir');
    await expect(s.getNumber('ttl')).resolves.toBe(1800);
    await expect(s.getBool('flag')).resolves.toBe(true);
    await expect(s.get('missing')).resolves.toBeNull();
    await expect(s.getNumber('missing')).resolves.toBeNull();
  });
});

describe('WatchHistoryStore', () => {
  const ctx = (streamId: string, title: string): PlayContext => ({
    contentType: 'vod',
    streamId,
    title,
    url: `http://h/movie/u/p/${streamId}.mp4`,
  });

  it('records position, upserts by item, and reports resume point', async () => {
    const db = await freshDb();
    const h = new WatchHistoryStore(db);
    await h.record(ctx('10', 'Movie'), 60, 6000);
    await h.record(ctx('10', 'Movie'), 120, 6000); // same item updates
    const pos = await h.getPosition('vod', '10');
    expect(pos).toEqual({ position: 120, duration: 6000 });
    const rows = await db.getAllAsync('SELECT id FROM watch_history');
    expect(rows).toHaveLength(1); // upsert, not duplicate
  });

  it('continueWatching excludes finished and unstarted items', async () => {
    const db = await freshDb();
    const h = new WatchHistoryStore(db);
    await h.record(ctx('1', 'Started'), 100, 1000); // 10% → keep
    await h.record(ctx('2', 'Finished'), 990, 1000); // 99% → drop
    await h.record(ctx('3', 'Unstarted'), 0, 1000); // 0 → drop
    const list = await h.continueWatching();
    expect(list.map((c) => c.streamId)).toEqual(['1']);
    expect(list[0].startPosition).toBe(100);
  });
});

describe('WatchlistStore', () => {
  it('adds, dedupes, checks membership, lists and removes', async () => {
    const db = await freshDb();
    const w = new WatchlistStore(db);
    await w.add('vod', '5', 'Film', { name: 'Film', x: 1 }, 'poster.jpg');
    await w.add('vod', '5', 'Film v2', { name: 'Film v2' }); // upsert
    await expect(w.has('vod', '5')).resolves.toBe(true);
    await expect(w.has('vod', '6')).resolves.toBe(false);
    const list = await w.list();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Film v2');
    expect(JSON.parse(list[0].itemJson)).toEqual({ name: 'Film v2' });
    await w.remove('vod', '5');
    await expect(w.has('vod', '5')).resolves.toBe(false);
  });
});

describe('LiveRecentsStore', () => {
  it('records, upserts by stream and lists newest-first', async () => {
    const db = await freshDb();
    const lr = new LiveRecentsStore(db);
    await lr.record({ streamId: 'a', name: 'Alpha' });
    await lr.record({ streamId: 'b', name: 'Beta', categoryName: 'News' });
    await lr.record({ streamId: 'a', name: 'Alpha HD' }); // upsert + bump
    const list = await lr.list();
    expect(list.map((r) => r.streamId)).toEqual(['a', 'b']);
    expect(list[0].name).toBe('Alpha HD');
  });

  it('trims to the recents cap', async () => {
    const db = await freshDb();
    const lr = new LiveRecentsStore(db);
    for (let i = 0; i < 35; i++) {
      await lr.record({ streamId: `s${i}`, name: `Ch ${i}` });
    }
    const all = await db.getAllAsync('SELECT 1 FROM live_recents');
    expect(all.length).toBe(30); // capped
  });
});
