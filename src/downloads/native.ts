/**
 * Concrete `NativeDownloader` backed by
 * `@kesha-antonov/react-native-background-downloader` (NSURLSession) plus
 * `expo-file-system` for file existence/deletion.
 *
 * This is the only download module that imports native code, mirroring the
 * `db/index.ts` boundary: all orchestration logic lives in `manager.ts` against
 * the `NativeDownloader` interface and is unit-tested with a fake.
 */
import {
  completeHandler,
  createDownloadTask,
  directories,
  getExistingDownloadTasks,
  setConfig,
  type DownloadTask,
} from '@kesha-antonov/react-native-background-downloader';
import { Directory, File } from 'expo-file-system';

import type {
  NativeDownloader,
  NativeDownloadHandlers,
  NativeStartOptions,
  RestoredTask,
} from './manager';

/** Ensure a plain path is a `file://` URI for expo-file-system. */
function toUri(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path.startsWith('/') ? '' : '/'}${path}`;
}

export class BackgroundDownloaderNative implements NativeDownloader {
  private readonly tasks = new Map<string, DownloadTask>();
  private configured = false;

  get documentsDir(): string {
    return directories.documents;
  }

  private ensureConfigured(): void {
    if (this.configured) return;
    this.configured = true;
    // Report progress about once a second; allow downloads on cellular so the
    // user can grab content on the go (the whole point of the app).
    setConfig({ progressInterval: 1000, allowsCellularAccess: true });
  }

  async prepare(): Promise<void> {
    this.ensureConfigured();
    const dir = new Directory(toUri(`${this.documentsDir}/downloads`));
    if (!dir.exists) dir.create({ intermediates: true });
  }

  start(opts: NativeStartOptions, handlers: NativeDownloadHandlers): void {
    this.ensureConfigured();
    const task = createDownloadTask({
      id: opts.id,
      url: opts.url,
      destination: opts.destination,
      headers: opts.headers,
      metadata: { id: opts.id },
    });
    this.attach(task, handlers);
    this.tasks.set(opts.id, task);
    task.start();
  }

  private attach(task: DownloadTask, handlers: NativeDownloadHandlers): void {
    task
      .begin(({ expectedBytes }) => handlers.onBegin?.(expectedBytes))
      .progress(({ bytesDownloaded, bytesTotal }) =>
        handlers.onProgress(bytesDownloaded, bytesTotal),
      )
      .done(({ location, bytesTotal }) => {
        handlers.onDone(location, bytesTotal);
        // Required on iOS background sessions to release the system handler.
        completeHandler(task.id);
      })
      .error(({ error }) => {
        handlers.onError(error);
        completeHandler(task.id);
      });
  }

  async pause(id: string): Promise<void> {
    await this.tasks.get(id)?.pause();
  }

  async resume(id: string): Promise<void> {
    await this.tasks.get(id)?.resume();
  }

  async stop(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      await task.stop();
      this.tasks.delete(id);
    }
  }

  async restore(
    handlersFor: (id: string) => NativeDownloadHandlers,
  ): Promise<RestoredTask[]> {
    this.ensureConfigured();
    const existing = await getExistingDownloadTasks();
    const out: RestoredTask[] = [];
    for (const task of existing) {
      this.attach(task, handlersFor(task.id));
      this.tasks.set(task.id, task);
      out.push({ id: task.id, state: task.state });
    }
    return out;
  }

  async deleteFile(path: string): Promise<void> {
    const file = new File(toUri(path));
    if (file.exists) file.delete();
  }

  async fileExists(path: string): Promise<boolean> {
    return new File(toUri(path)).exists;
  }
}
