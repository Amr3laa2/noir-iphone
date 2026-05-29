/**
 * Recently-tuned live channels, backed by `live_recents`.
 *
 * Live streams have no resumable position, so this is just an ordered list of
 * "channels I watched recently", capped at LIVE_RECENTS_CAP rows. Ported from
 * the desktop live-recents commands.
 */
import type { LiveRecent, LiveRecentInput } from '../api/types';
import type { SqlDatabase } from './types';
import { nowSeconds } from './schema';

const LIVE_RECENTS_CAP = 30;

interface LiveRecentRow {
  stream_id: string;
  name: string;
  stream_icon: string | null;
  category_id: string | null;
  category_name: string | null;
  watched_at: number;
}

const fromRow = (r: LiveRecentRow): LiveRecent => ({
  streamId: r.stream_id,
  name: r.name,
  streamIcon: r.stream_icon ?? undefined,
  categoryId: r.category_id ?? undefined,
  categoryName: r.category_name ?? undefined,
  watchedAt: r.watched_at,
});

export class LiveRecentsStore {
  constructor(private readonly db: SqlDatabase) {}

  /** Records a tune-in (upsert by stream_id), then trims to the cap. */
  async record(input: LiveRecentInput): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO live_recents(stream_id, name, stream_icon, category_id, category_name, watched_at)
       VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(stream_id) DO UPDATE SET
         name = excluded.name,
         stream_icon = excluded.stream_icon,
         category_id = excluded.category_id,
         category_name = excluded.category_name,
         watched_at = excluded.watched_at`,
      [
        input.streamId,
        input.name,
        input.streamIcon ?? null,
        input.categoryId ?? null,
        input.categoryName ?? null,
        nowSeconds(),
      ],
    );
    await this.trim();
  }

  async list(limit = LIVE_RECENTS_CAP): Promise<LiveRecent[]> {
    const rows = await this.db.getAllAsync<LiveRecentRow>(
      'SELECT * FROM live_recents ORDER BY watched_at DESC LIMIT ?',
      [limit],
    );
    return rows.map(fromRow);
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM live_recents', []);
  }

  /** Keeps only the newest LIVE_RECENTS_CAP rows. */
  private async trim(): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM live_recents
       WHERE stream_id NOT IN (
         SELECT stream_id FROM live_recents ORDER BY watched_at DESC LIMIT ?
       )`,
      [LIVE_RECENTS_CAP],
    );
  }
}
