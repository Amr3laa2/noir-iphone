/**
 * Watch history + resume positions, backed by `watch_history`.
 *
 * One row per (contentType, streamId): re-watching upserts the same id so the
 * resume position and "continue watching" ordering stay current. Ported from
 * the desktop watch-position commands.
 */
import type { PlayContext } from '../api/types';
import type { SqlDatabase } from './types';
import { nowSeconds } from './schema';

/** Below this fraction watched we treat a title as "finished" and hide it. */
const FINISHED_FRACTION = 0.95;

interface HistoryRow {
  position: number;
  duration: number;
  play_context_json: string;
  watched_at: number;
}

const rowId = (contentType: string, streamId: string): string =>
  `${contentType}:${streamId}`;

export class WatchHistoryStore {
  constructor(private readonly db: SqlDatabase) {}

  /** Records (or updates) the resume position for a played item. */
  async record(ctx: PlayContext, position: number, duration: number): Promise<void> {
    const id = rowId(ctx.contentType, ctx.streamId);
    await this.db.runAsync(
      `INSERT INTO watch_history(
         id, content_type, stream_id, title, poster, position, duration, play_context_json, watched_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         poster = excluded.poster,
         position = excluded.position,
         duration = excluded.duration,
         play_context_json = excluded.play_context_json,
         watched_at = excluded.watched_at`,
      [
        id,
        ctx.contentType,
        ctx.streamId,
        ctx.title,
        ctx.poster ?? null,
        position,
        duration,
        JSON.stringify(ctx),
        nowSeconds(),
      ],
    );
  }

  /** Latest resume position for an item, or null if never played. */
  async getPosition(
    contentType: string,
    streamId: string,
  ): Promise<{ position: number; duration: number } | null> {
    const row = await this.db.getFirstAsync<HistoryRow>(
      'SELECT position, duration FROM watch_history WHERE content_type = ? AND stream_id = ?',
      [contentType, streamId],
    );
    return row ? { position: row.position, duration: row.duration } : null;
  }

  /**
   * Continue-watching feed: items with a meaningful resume point (started but
   * not finished), newest first. Feeds `XtreamClient.getHome`.
   */
  async continueWatching(limit = 20): Promise<PlayContext[]> {
    const rows = await this.db.getAllAsync<HistoryRow>(
      `SELECT position, duration, play_context_json, watched_at
       FROM watch_history
       WHERE position > 0 AND (duration <= 0 OR position < duration * ?)
       ORDER BY watched_at DESC
       LIMIT ?`,
      [FINISHED_FRACTION, limit],
    );
    const out: PlayContext[] = [];
    for (const r of rows) {
      try {
        const ctx = JSON.parse(r.play_context_json) as PlayContext;
        ctx.startPosition = r.position;
        out.push(ctx);
      } catch {
        // Skip rows with corrupt JSON rather than failing the whole feed.
      }
    }
    return out;
  }

  async remove(contentType: string, streamId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM watch_history WHERE id = ?', [
      rowId(contentType, streamId),
    ]);
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM watch_history', []);
  }
}
