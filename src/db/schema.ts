/**
 * Database schema + migrations, ported from the desktop `db.rs`.
 *
 * The mobile app drops the desktop-only download engine columns that are
 * specific to aria2 (gid, connections, speed/eta strings); mobile downloads run
 * through NSURLSession via react-native-background-downloader, which tracks its
 * own task identifiers. The remaining tables match the desktop 1:1 so the data
 * model and queries stay familiar.
 */
import type { SqlDatabase } from './types';

/** Unix epoch seconds, matching the desktop `db::now()`. */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS iptv_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cache_entries (
  key TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_history (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  title TEXT NOT NULL,
  poster TEXT,
  position REAL NOT NULL DEFAULT 0,
  duration REAL NOT NULL DEFAULT 0,
  play_context_json TEXT NOT NULL,
  watched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  title TEXT NOT NULL,
  poster TEXT,
  item_json TEXT NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  output_path TEXT,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  downloaded_bytes INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  task_id TEXT,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error_at INTEGER,
  play_context_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS live_recents (
  stream_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stream_icon TEXT,
  category_id TEXT,
  category_name TEXT,
  watched_at INTEGER NOT NULL
);
`;

const INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_downloads_ct_sid_status
  ON downloads(content_type, stream_id, status);
CREATE INDEX IF NOT EXISTS idx_downloads_task
  ON downloads(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_downloads_status
  ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_watch_history_ct_sid
  ON watch_history(content_type, stream_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_account_key_expires
  ON cache_entries(account_id, key, expires_at);
CREATE INDEX IF NOT EXISTS idx_live_recents_watched
  ON live_recents(watched_at DESC);
`;

/**
 * Creates tables + indexes if absent. Idempotent: safe to run on every launch.
 * Foreign keys are enabled; WAL is left to the platform default (expo-sqlite
 * enables WAL on device; in-memory test engines ignore it).
 */
export async function migrate(db: SqlDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(INDEX_SQL);
}
