/**
 * App-startup wiring for the data layer.
 *
 * This is the one module that touches native code (`expo-sqlite`,
 * `expo-crypto`). It opens the real on-device database, runs migrations once,
 * and constructs the repository singletons against it. Everything it builds is
 * defined in sibling modules that depend only on the `SqlDatabase` interface,
 * so the logic stays unit-tested on Node while this file supplies the concrete
 * platform implementation.
 */
import * as Crypto from 'expo-crypto';
import {
  openDatabaseAsync,
  type SQLiteDatabase,
  type SQLiteBindParams,
} from 'expo-sqlite';

import type { SqlDatabase } from './types';
import { migrate } from './schema';
import { SqliteCacheStore } from './cacheStore';
import { SqliteAccountStore } from './accountStore';
import { SettingsStore } from './settingsStore';
import { WatchHistoryStore } from './watchHistory';
import { WatchlistStore } from './watchlist';
import { LiveRecentsStore } from './liveRecents';
import { DownloadsStore } from './downloadStore';

const DB_NAME = 'noir.db';

/** Adapts an expo-sqlite database to our `SqlDatabase` interface. */
function adapt(db: SQLiteDatabase): SqlDatabase {
  return {
    runAsync: (sql, params = []) =>
      db
        .runAsync(sql, params as SQLiteBindParams)
        .then((r) => ({ lastInsertRowId: r.lastInsertRowId, changes: r.changes })),
    getFirstAsync: <T,>(sql: string, params: unknown[] = []) =>
      db.getFirstAsync<T>(sql, params as SQLiteBindParams).then((r) => r ?? null),
    getAllAsync: <T,>(sql: string, params: unknown[] = []) =>
      db.getAllAsync<T>(sql, params as SQLiteBindParams),
    execAsync: (sql) => db.execAsync(sql),
  };
}

export interface DataLayer {
  db: SqlDatabase;
  cache: SqliteCacheStore;
  accounts: SqliteAccountStore;
  settings: SettingsStore;
  history: WatchHistoryStore;
  watchlist: WatchlistStore;
  liveRecents: LiveRecentsStore;
  downloads: DownloadsStore;
}

let singleton: Promise<DataLayer> | null = null;

/** Opens (once) and returns the fully-wired data layer. */
export function getDataLayer(): Promise<DataLayer> {
  if (!singleton) {
    singleton = (async () => {
      const native = await openDatabaseAsync(DB_NAME);
      const db = adapt(native);
      await migrate(db);
      return {
        db,
        cache: new SqliteCacheStore(db),
        accounts: new SqliteAccountStore(db, () => Crypto.randomUUID()),
        settings: new SettingsStore(db),
        history: new WatchHistoryStore(db),
        watchlist: new WatchlistStore(db),
        liveRecents: new LiveRecentsStore(db),
        downloads: new DownloadsStore(db),
      };
    })();
  }
  return singleton;
}
