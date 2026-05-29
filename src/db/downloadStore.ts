/**
 * Offline downloads, backed by the `downloads` table.
 *
 * One row per queued/active/finished download. The row is the source of truth
 * for the offline library UI; the native NSURLSession task (tracked by
 * `task_id`) reports progress that we persist here so the list survives app
 * restarts and background completion. Pure DB logic — no native deps — so it is
 * unit-tested against real SQLite on Node.
 */
import type { PlayContext } from '../api/types';
import type { SqlDatabase } from './types';
import { nowSeconds } from './schema';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'done' | 'error';

export interface DownloadRecord {
  id: string;
  contentType: string;
  streamId: string;
  title: string;
  url: string;
  outputPath?: string;
  status: DownloadStatus;
  /** 0..1 */
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  taskId?: string;
  error?: string;
  retryCount: number;
  lastErrorAt?: number;
  context: PlayContext;
  createdAt: number;
  updatedAt: number;
}

interface DownloadRow {
  id: string;
  content_type: string;
  stream_id: string;
  title: string;
  url: string;
  output_path: string | null;
  status: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  task_id: string | null;
  error: string | null;
  retry_count: number;
  last_error_at: number | null;
  play_context_json: string;
  created_at: number;
  updated_at: number;
}

/** Deterministic row id so re-downloading the same item is idempotent. */
export const downloadId = (contentType: string, streamId: string): string =>
  `${contentType}:${streamId}`;

function fromRow(row: DownloadRow): DownloadRecord {
  let context: PlayContext;
  try {
    context = JSON.parse(row.play_context_json) as PlayContext;
  } catch {
    context = {
      contentType: row.content_type as PlayContext['contentType'],
      streamId: row.stream_id,
      title: row.title,
      url: row.url,
    };
  }
  return {
    id: row.id,
    contentType: row.content_type,
    streamId: row.stream_id,
    title: row.title,
    url: row.url,
    outputPath: row.output_path ?? undefined,
    status: row.status as DownloadStatus,
    progress: row.progress,
    downloadedBytes: row.downloaded_bytes,
    totalBytes: row.total_bytes,
    taskId: row.task_id ?? undefined,
    error: row.error ?? undefined,
    retryCount: row.retry_count,
    lastErrorAt: row.last_error_at ?? undefined,
    context,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DownloadsStore {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Inserts a fresh queued download, or resets an existing row for the same
   * item back to queued (so a failed/removed download can be retried). Returns
   * the row id.
   */
  async enqueue(ctx: PlayContext, taskId: string): Promise<string> {
    const id = downloadId(ctx.contentType, ctx.streamId);
    const now = nowSeconds();
    await this.db.runAsync(
      `INSERT INTO downloads(
         id, content_type, stream_id, title, url, output_path, status, progress,
         downloaded_bytes, total_bytes, task_id, error, retry_count, last_error_at,
         play_context_json, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, NULL, 'queued', 0, 0, 0, ?, NULL, 0, NULL, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         url = excluded.url,
         output_path = NULL,
         status = 'queued',
         progress = 0,
         downloaded_bytes = 0,
         total_bytes = 0,
         task_id = excluded.task_id,
         error = NULL,
         last_error_at = NULL,
         play_context_json = excluded.play_context_json,
         updated_at = excluded.updated_at`,
      [
        id,
        ctx.contentType,
        ctx.streamId,
        ctx.title,
        ctx.url,
        taskId,
        JSON.stringify(ctx),
        now,
        now,
      ],
    );
    return id;
  }

  async get(id: string): Promise<DownloadRecord | null> {
    const row = await this.db.getFirstAsync<DownloadRow>(
      'SELECT * FROM downloads WHERE id = ?',
      [id],
    );
    return row ? fromRow(row) : null;
  }

  async getByTaskId(taskId: string): Promise<DownloadRecord | null> {
    const row = await this.db.getFirstAsync<DownloadRow>(
      'SELECT * FROM downloads WHERE task_id = ?',
      [taskId],
    );
    return row ? fromRow(row) : null;
  }

  /** All downloads, newest first. */
  async list(): Promise<DownloadRecord[]> {
    const rows = await this.db.getAllAsync<DownloadRow>(
      'SELECT * FROM downloads ORDER BY created_at DESC',
      [],
    );
    return rows.map(fromRow);
  }

  /** Completed downloads available for offline playback, newest first. */
  async listCompleted(): Promise<DownloadRecord[]> {
    const rows = await this.db.getAllAsync<DownloadRow>(
      "SELECT * FROM downloads WHERE status = 'done' ORDER BY updated_at DESC",
      [],
    );
    return rows.map(fromRow);
  }

  /** Throttled progress update from the native task. */
  async updateProgress(
    id: string,
    downloadedBytes: number,
    totalBytes: number,
  ): Promise<void> {
    const progress = totalBytes > 0 ? Math.min(downloadedBytes / totalBytes, 1) : 0;
    await this.db.runAsync(
      `UPDATE downloads
       SET status = 'downloading', progress = ?, downloaded_bytes = ?, total_bytes = ?, updated_at = ?
       WHERE id = ?`,
      [progress, downloadedBytes, totalBytes, nowSeconds(), id],
    );
  }

  async setStatus(id: string, status: DownloadStatus): Promise<void> {
    await this.db.runAsync(
      'UPDATE downloads SET status = ?, updated_at = ? WHERE id = ?',
      [status, nowSeconds(), id],
    );
  }

  async setTaskId(id: string, taskId: string | null): Promise<void> {
    await this.db.runAsync(
      'UPDATE downloads SET task_id = ?, updated_at = ? WHERE id = ?',
      [taskId, nowSeconds(), id],
    );
  }

  /** Marks a download complete and records where the file landed. */
  async markDone(id: string, outputPath: string, totalBytes: number): Promise<void> {
    await this.db.runAsync(
      `UPDATE downloads
       SET status = 'done', progress = 1, output_path = ?, downloaded_bytes = ?,
           total_bytes = ?, task_id = NULL, error = NULL, updated_at = ?
       WHERE id = ?`,
      [outputPath, totalBytes, totalBytes, nowSeconds(), id],
    );
  }

  async markError(id: string, error: string): Promise<void> {
    const now = nowSeconds();
    await this.db.runAsync(
      `UPDATE downloads
       SET status = 'error', error = ?, task_id = NULL,
           retry_count = retry_count + 1, last_error_at = ?, updated_at = ?
       WHERE id = ?`,
      [error, now, now, id],
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM downloads WHERE id = ?', [id]);
  }

  /** Whether a finished offline copy exists for an item. */
  async availability(
    contentType: string,
    streamId: string,
  ): Promise<{ downloaded: boolean; outputPath?: string }> {
    const rec = await this.get(downloadId(contentType, streamId));
    if (rec && rec.status === 'done' && rec.outputPath) {
      return { downloaded: true, outputPath: rec.outputPath };
    }
    return { downloaded: false };
  }
}
