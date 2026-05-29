/**
 * "My list" bookmarks, backed by the `watchlist` table. One row per
 * (contentType, streamId); re-adding refreshes the stored item snapshot.
 */
import type { WatchlistItem, XtreamItem } from '../api/types';
import type { SqlDatabase } from './types';
import { nowSeconds } from './schema';

interface WatchlistRow {
  id: string;
  content_type: string;
  stream_id: string;
  title: string;
  poster: string | null;
  item_json: string;
  added_at: number;
}

const fromRow = (r: WatchlistRow): WatchlistItem => ({
  id: r.id,
  contentType: r.content_type,
  streamId: r.stream_id,
  title: r.title,
  poster: r.poster ?? undefined,
  itemJson: r.item_json,
  addedAt: r.added_at,
});

const rowId = (contentType: string, streamId: string): string =>
  `${contentType}:${streamId}`;

export class WatchlistStore {
  constructor(private readonly db: SqlDatabase) {}

  async add(
    contentType: string,
    streamId: string,
    title: string,
    item: XtreamItem,
    poster?: string,
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO watchlist(id, content_type, stream_id, title, poster, item_json, added_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         poster = excluded.poster,
         item_json = excluded.item_json,
         added_at = excluded.added_at`,
      [
        rowId(contentType, streamId),
        contentType,
        streamId,
        title,
        poster ?? null,
        JSON.stringify(item),
        nowSeconds(),
      ],
    );
  }

  async remove(contentType: string, streamId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM watchlist WHERE id = ?', [
      rowId(contentType, streamId),
    ]);
  }

  async has(contentType: string, streamId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ one: number }>(
      'SELECT 1 AS one FROM watchlist WHERE id = ?',
      [rowId(contentType, streamId)],
    );
    return row !== null;
  }

  async list(): Promise<WatchlistItem[]> {
    const rows = await this.db.getAllAsync<WatchlistRow>(
      'SELECT * FROM watchlist ORDER BY added_at DESC',
    );
    return rows.map(fromRow);
  }
}
