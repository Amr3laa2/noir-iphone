/**
 * Persistent, TTL-aware metadata cache backed by the `cache_entries` table.
 *
 * Implements the `CacheStore` interface consumed by `XtreamClient`. Payloads
 * are stored as JSON text; reads transparently drop expired rows so callers
 * never see stale data. Ported from the desktop `get_cached` / `cache.rs`.
 */
import type { CacheStore } from '../api/xtream';
import type { SqlDatabase } from './types';
import { nowSeconds } from './schema';

interface CacheRow {
  payload: string;
  expires_at: number;
}

export class SqliteCacheStore implements CacheStore {
  constructor(private readonly db: SqlDatabase) {}

  async get(accountId: string, key: string): Promise<unknown | null> {
    const row = await this.db.getFirstAsync<CacheRow>(
      'SELECT payload, expires_at FROM cache_entries WHERE key = ? AND account_id = ?',
      [key, accountId],
    );
    if (!row) return null;
    if (row.expires_at <= nowSeconds()) {
      // Lazily evict the expired entry so the table self-cleans on read.
      await this.db.runAsync('DELETE FROM cache_entries WHERE key = ?', [key]);
      return null;
    }
    try {
      return JSON.parse(row.payload) as unknown;
    } catch {
      return null;
    }
  }

  async set(
    accountId: string,
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    const created = nowSeconds();
    const expires = created + Math.max(0, Math.floor(ttlSeconds));
    await this.db.runAsync(
      `INSERT INTO cache_entries(key, account_id, payload, created_at, expires_at)
       VALUES(?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         account_id = excluded.account_id,
         payload    = excluded.payload,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at`,
      [key, accountId, JSON.stringify(value), created, expires],
    );
  }

  async clearPrefix(accountId: string, prefix: string): Promise<number> {
    // Escape LIKE wildcards in the prefix so keys containing % or _ match
    // literally; ESCAPE '\\' opts into backslash-escaping.
    const escaped = prefix.replace(/[\\%_]/g, (c) => `\\${c}`);
    const res = await this.db.runAsync(
      "DELETE FROM cache_entries WHERE account_id = ? AND key LIKE ? ESCAPE '\\'",
      [accountId, `${escaped}%`],
    );
    return res.changes;
  }
}
