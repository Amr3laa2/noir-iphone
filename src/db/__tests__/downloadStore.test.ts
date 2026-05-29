import { createNodeSqlDatabase } from './nodeSqlite';
import { migrate } from '../schema';
import { DownloadsStore, downloadId } from '../downloadStore';
import type { SqlDatabase } from '../types';
import type { PlayContext } from '../../api/types';

async function freshStore(): Promise<{ db: SqlDatabase; store: DownloadsStore }> {
  const db = createNodeSqlDatabase();
  await migrate(db);
  return { db, store: new DownloadsStore(db) };
}

const ctx = (over: Partial<PlayContext> = {}): PlayContext => ({
  contentType: 'vod',
  streamId: '42',
  title: 'The Movie',
  poster: 'http://host/p.jpg',
  url: 'http://host/movie/u/p/42.mkv',
  ...over,
});

describe('DownloadsStore', () => {
  it('enqueues a queued download keyed by content/stream id', async () => {
    const { store } = await freshStore();
    const id = await store.enqueue(ctx(), 'task-1');
    expect(id).toBe(downloadId('vod', '42'));

    const rec = await store.get(id);
    expect(rec).not.toBeNull();
    expect(rec!.status).toBe('queued');
    expect(rec!.taskId).toBe('task-1');
    expect(rec!.progress).toBe(0);
    expect(rec!.context.url).toBe(ctx().url);
  });

  it('re-enqueue resets an existing row (retry path)', async () => {
    const { store } = await freshStore();
    const id = await store.enqueue(ctx(), 'task-1');
    await store.markError(id, 'boom');
    expect((await store.get(id))!.status).toBe('error');

    await store.enqueue(ctx(), 'task-2');
    const rec = await store.get(id);
    expect(rec!.status).toBe('queued');
    expect(rec!.error).toBeUndefined();
    expect(rec!.taskId).toBe('task-2');
    // Only one row for the same item.
    expect((await store.list()).length).toBe(1);
  });

  it('updates progress and derives the fraction', async () => {
    const { store } = await freshStore();
    const id = await store.enqueue(ctx(), 't');
    await store.updateProgress(id, 500, 1000);
    const rec = await store.get(id);
    expect(rec!.status).toBe('downloading');
    expect(rec!.progress).toBe(0.5);
    expect(rec!.downloadedBytes).toBe(500);
    expect(rec!.totalBytes).toBe(1000);
  });

  it('marks done and exposes availability', async () => {
    const { store } = await freshStore();
    const id = await store.enqueue(ctx(), 't');
    await store.markDone(id, '/docs/downloads/vod_42.mkv', 2048);

    const rec = await store.get(id);
    expect(rec!.status).toBe('done');
    expect(rec!.progress).toBe(1);
    expect(rec!.outputPath).toBe('/docs/downloads/vod_42.mkv');
    expect(rec!.taskId).toBeUndefined();

    const avail = await store.availability('vod', '42');
    expect(avail).toEqual({ downloaded: true, outputPath: '/docs/downloads/vod_42.mkv' });

    const listed = await store.listCompleted();
    expect(listed.map((r) => r.id)).toEqual([id]);
  });

  it('reports not-downloaded for unknown or unfinished items', async () => {
    const { store } = await freshStore();
    expect(await store.availability('vod', 'nope')).toEqual({ downloaded: false });
    const id = await store.enqueue(ctx(), 't');
    await store.updateProgress(id, 1, 2);
    expect(await store.availability('vod', '42')).toEqual({ downloaded: false });
  });

  it('increments retry count on repeated errors', async () => {
    const { store } = await freshStore();
    const id = await store.enqueue(ctx(), 't');
    await store.markError(id, 'one');
    await store.markError(id, 'two');
    const rec = await store.get(id);
    expect(rec!.retryCount).toBe(2);
    expect(rec!.error).toBe('two');
    expect(rec!.lastErrorAt).toBeGreaterThan(0);
  });

  it('removes a download', async () => {
    const { store } = await freshStore();
    const id = await store.enqueue(ctx(), 't');
    await store.remove(id);
    expect(await store.get(id)).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it('looks up by native task id', async () => {
    const { store } = await freshStore();
    const id = await store.enqueue(ctx(), 'task-xyz');
    const rec = await store.getByTaskId('task-xyz');
    expect(rec!.id).toBe(id);
  });
});
