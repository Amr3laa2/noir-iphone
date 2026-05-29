/**
 * IPTV account persistence backed by the `iptv_accounts` table.
 *
 * Implements `AccountProvider` (consumed by `XtreamClient`) plus full CRUD and
 * active-account switching. The `idgen` dependency is injected so tests run
 * deterministically on Node; the app supplies `expo-crypto`'s randomUUID.
 *
 * Security note: account passwords live in this table in plaintext (as the
 * desktop app does). They are never logged. Stream URLs that embed credentials
 * must be redacted before logging — see the desktop log-scrubbing convention.
 */
import type { AccountProvider } from '../api/xtream';
import type { AccountInput, IptvAccount } from '../api/types';
import type { SqlDatabase } from './types';
import { nowSeconds } from './schema';

interface AccountRow {
  id: string;
  name: string;
  base_url: string;
  username: string;
  password: string;
  active: number;
  created_at: number;
  updated_at: number;
}

const fromRow = (r: AccountRow): IptvAccount => ({
  id: r.id,
  name: r.name,
  baseUrl: r.base_url,
  username: r.username,
  password: r.password,
  active: r.active !== 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SqliteAccountStore implements AccountProvider {
  constructor(
    private readonly db: SqlDatabase,
    private readonly idgen: () => string,
  ) {}

  async getActive(): Promise<IptvAccount | null> {
    const row = await this.db.getFirstAsync<AccountRow>(
      'SELECT * FROM iptv_accounts WHERE active = 1 ORDER BY updated_at DESC LIMIT 1',
    );
    return row ? fromRow(row) : null;
  }

  async list(): Promise<IptvAccount[]> {
    const rows = await this.db.getAllAsync<AccountRow>(
      'SELECT * FROM iptv_accounts ORDER BY created_at ASC',
    );
    return rows.map(fromRow);
  }

  async get(id: string): Promise<IptvAccount | null> {
    const row = await this.db.getFirstAsync<AccountRow>(
      'SELECT * FROM iptv_accounts WHERE id = ?',
      [id],
    );
    return row ? fromRow(row) : null;
  }

  /**
   * Inserts a new account or updates an existing one (when `input.id` matches).
   * If the account is marked active, all other accounts are deactivated so
   * exactly one stays active. Returns the saved account.
   */
  async save(input: AccountInput): Promise<IptvAccount> {
    const now = nowSeconds();
    const id = input.id ?? this.idgen();
    const existing = input.id ? await this.get(input.id) : null;
    const active = input.active ?? existing?.active ?? false;

    if (existing) {
      await this.db.runAsync(
        `UPDATE iptv_accounts
         SET name = ?, base_url = ?, username = ?, password = ?, active = ?, updated_at = ?
         WHERE id = ?`,
        [input.name, input.baseUrl, input.username, input.password, active ? 1 : 0, now, id],
      );
    } else {
      await this.db.runAsync(
        `INSERT INTO iptv_accounts(id, name, base_url, username, password, active, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, input.name, input.baseUrl, input.username, input.password, active ? 1 : 0, now, now],
      );
    }

    if (active) await this.deactivateOthers(id);
    const saved = await this.get(id);
    if (!saved) throw new Error('Account save failed');
    return saved;
  }

  /** Activates one account and deactivates the rest. */
  async setActive(id: string): Promise<void> {
    const now = nowSeconds();
    await this.db.runAsync(
      'UPDATE iptv_accounts SET active = 1, updated_at = ? WHERE id = ?',
      [now, id],
    );
    await this.deactivateOthers(id);
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM iptv_accounts WHERE id = ?', [id]);
  }

  private async deactivateOthers(keepId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE iptv_accounts SET active = 0 WHERE id != ?',
      [keepId],
    );
  }
}
