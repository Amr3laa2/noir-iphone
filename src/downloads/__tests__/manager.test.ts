import { createNodeSqlDatabase } from '../../db/__tests__/nodeSqlite';
import { migrate } from '../../db/schema';
import { DownloadsStore } from '../../db/downloadStore';
import { DownloadManager, type NativeDownloader, type NativeDownloadHandlers, type RestoredTask } from '../manager';
import type { PlayContext } from '../../api/types';

const ctx = (over: Partial<PlayContext> = {}): PlayContext => ({
  contentType: 'vod',
  streamId: '7',
  title: 'Movie 7',
  poster: 'http://host/p.jpg',
  url: 'http://host/movie/u/p/7.mp4',
  ...over,
});

/** In-memory fake engine that lets tests drive the download lifecycle. */
class FakeNative implements NativeDownloader {
  documentsDir = '/docs';
  started: { id: string; destination: string }[] = [];
  paused: string[] = [];
  resumed: string[] = [];
  stopped: string[] = [];
  deleted: string[] = [];
  files = new Set<string>();
  handlers = new Map<string, NativeDownloadHandlers>();
  restoredTasks: RestoredTask[] = [];

  async prepare(): Promise<void> {}

  start(opts: { id: string; destination: string }, handlers: NativeDownloadHandlers): void {
    this.started.push({ id: opts.id, destination: opts.destination });
    this.handlers.set(opts.id, handlers);
  }
  async pause(id: string): Promise<void> {
    this.paused.push(id);
  }
  async resume(id: string): Promise<void> {
    this.resumed.push(id);
  }
  async stop(id: string): Promise<void> {
    this.stopped.push(id);
  }
  async restore(handlersFor: (id: string) => NativeDownloadHandlers): Promise<RestoredTask[]> {
    for (const t of this.restoredTasks) this.handlers.set(t.id, handlersFor(t.id));
    return this.restoredTasks;
  }
  async deleteFile(path: string): Promise<void> {
    this.deleted.push(path);
    this.files.delete(path);
  }
  async fileExists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}

async function setup() {
  const db = createNodeSqlDatabase();
  await migrate(db);
  const store = new DownloadsStore(db);
  const native = new FakeNative();
  const manager = new DownloadManager(store, native);
  return { store, native, manager };
}

// Let queued microtasks (handler -> store write -> notify) settle.
const flush = () => new Promise((r) => setImmediate(r));

describe('DownloadManager', () => {
  it('enqueues with a destination under documents/downloads and persists progress', async () => {
    const { manager, native, store } = await setup();
    const id = await manager.enqueue(ctx(), 'mp4');

    expect(native.started).toEqual([{ id, destination: '/docs/downloads/vod_7.mp4' }]);
    expect((await store.get(id))!.status).toBe('queued');

    native.handlers.get(id)!.onProgress(400, 800);
    await flush();
    let rec = await store.get(id);
    expect(rec!.status).toBe('downloading');
    expect(rec!.progress).toBe(0.5);

    native.handlers.get(id)!.onDone('/docs/downloads/vod_7.mp4', 800);
    await flush();
    rec = await store.get(id);
    expect(rec!.status).toBe('done');
    expect(rec!.outputPath).toBe('/docs/downloads/vod_7.mp4');
  });

  it('records errors reported by the engine', async () => {
    const { manager, native, store } = await setup();
    const id = await manager.enqueue(ctx());
    native.handlers.get(id)!.onError('network lost');
    await flush();
    const rec = await store.get(id);
    expect(rec!.status).toBe('error');
    expect(rec!.error).toBe('network lost');
  });

  it('pauses and resumes', async () => {
    const { manager, native, store } = await setup();
    const id = await manager.enqueue(ctx());
    await manager.pause(id);
    expect(native.paused).toEqual([id]);
    expect((await store.get(id))!.status).toBe('paused');

    await manager.resume(id);
    expect(native.resumed).toEqual([id]);
    expect((await store.get(id))!.status).toBe('downloading');
  });

  it('remove stops the task, deletes the file, and drops the row', async () => {
    const { manager, native, store } = await setup();
    const id = await manager.enqueue(ctx(), 'mp4');
    native.handlers.get(id)!.onDone('/docs/downloads/vod_7.mp4', 10);
    await flush();
    native.files.add('/docs/downloads/vod_7.mp4');

    await manager.remove(id);
    expect(native.stopped).toContain(id);
    expect(native.deleted).toContain('/docs/downloads/vod_7.mp4');
    expect(await store.get(id)).toBeNull();
  });

  it('restore flags interrupted downloads and missing files', async () => {
    const { manager, native, store } = await setup();
    // A download that was mid-flight when the app died, with no live task.
    const interrupted = await manager.enqueue(ctx({ streamId: 'a' }), 'mp4');
    native.handlers.get(interrupted)!.onProgress(1, 2);
    await flush();
    // A finished download whose file has since vanished.
    const gone = await manager.enqueue(ctx({ streamId: 'b' }), 'mp4');
    native.handlers.get(gone)!.onDone('/docs/downloads/vod_b.mp4', 5);
    await flush();
    // files set intentionally left empty -> file missing.

    native.restoredTasks = []; // nothing survived
    await manager.restore();

    expect((await store.get(interrupted))!.status).toBe('error');
    expect((await store.get(gone))!.status).toBe('error');
  });

  it('restore keeps live tasks intact', async () => {
    const { manager, native, store } = await setup();
    const id = await manager.enqueue(ctx({ streamId: 'live1' }), 'mp4');
    native.handlers.get(id)!.onProgress(1, 4);
    await flush();

    native.restoredTasks = [{ id, state: 'DOWNLOADING' }];
    await manager.restore();

    expect((await store.get(id))!.status).toBe('downloading');
  });

  it('notifies subscribers on changes', async () => {
    const { manager } = await setup();
    let count = 0;
    const unsub = manager.subscribe(() => {
      count += 1;
    });
    await manager.enqueue(ctx());
    expect(count).toBeGreaterThan(0);
    unsub();
    const before = count;
    await manager.enqueue(ctx({ streamId: 'z' }));
    expect(count).toBe(before);
  });
});
