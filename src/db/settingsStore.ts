/**
 * Key/value settings backed by the `settings` table. Ported from `settings.rs`.
 * Values are stored as text; typed accessors parse on read.
 */
import type { SqlDatabase } from './types';
import { nowSeconds } from './schema';

export class SettingsStore {
  constructor(private readonly db: SqlDatabase) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO settings(key, value, updated_at) VALUES(?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, nowSeconds()],
    );
  }

  async getNumber(key: string): Promise<number | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  async getBool(key: string): Promise<boolean | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    return raw === '1' || raw === 'true';
  }

  async remove(key: string): Promise<void> {
    await this.db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
  }
}
