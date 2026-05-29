/**
 * Test-only adapter: wraps Node's built-in `node:sqlite` (DatabaseSync) in the
 * async `SqlDatabase` interface the repositories depend on. This lets the data
 * layer be exercised against a real SQLite engine on Windows/CI — the same SQL
 * that runs through expo-sqlite on device — without any native modules.
 *
 * Not shipped in the app bundle; only imported from tests.
 */
import { DatabaseSync } from 'node:sqlite';
import type { SqlDatabase, SqlRunResult } from '../types';

export function createNodeSqlDatabase(): SqlDatabase {
  const db = new DatabaseSync(':memory:');
  return {
    async runAsync(sql: string, params: unknown[] = []): Promise<SqlRunResult> {
      const result = db.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getFirstAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
      const row = db.prepare(sql).get(...(params as never[]));
      return (row as T | undefined) ?? null;
    },
    async getAllAsync<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    async execAsync(sql: string): Promise<void> {
      db.exec(sql);
    },
  };
}
