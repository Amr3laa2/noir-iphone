/**
 * Download orchestration.
 *
 * Sits between the React UI and two collaborators:
 *   - `DownloadsStore` — the persisted source of truth (SQLite).
 *   - `NativeDownloader` — the NSURLSession-backed engine, injected behind an
 *     interface so this logic is unit-testable on Node with a fake.
 *
 * The on-device task identifier is the same string as the download row id
 * (`contentType:streamId`), which keeps task↔row mapping trivial and makes
 * re-downloads idempotent.
 */
import type { PlayContext } from '../api/types';
import { DownloadsStore, downloadId, type DownloadRecord } from '../db/downloadStore';
import { downloadDestination } from './paths';

/** Callbacks the engine invokes for a single task. */
export interface NativeDownloadHandlers {
  onBegin?: (totalBytes: number) => void;
  onProgress: (downloadedBytes: number, totalBytes: number) => void;
  onDone: (location: string, totalBytes: number) => void;
  onError: (message: string) => void;
}

export interface NativeStartOptions {
  id: string;
  url: string;
  destination: string;
  headers?: Record<string, string>;
}

/** Restored task state reported on app launch. */
export interface RestoredTask {
  id: string;
  state: 'DOWNLOADING' | 'PAUSED' | 'DONE' | 'FAILED' | 'STOPPED' | 'PENDING';
}

/**
 * Engine abstraction. The real implementation wraps
 * `@kesha-antonov/react-native-background-downloader` + `expo-file-system`.
 */
export interface NativeDownloader {
  readonly documentsDir: string;
  /** Ensure the downloads directory exists. */
  prepare(): Promise<void>;
  start(opts: NativeStartOptions, handlers: NativeDownloadHandlers): void;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  /**
   * Re-attach to tasks that survived an app restart (background completion).
   * `handlersFor` supplies the callbacks for each live task id.
   */
  restore(
    handlersFor: (id: string) => NativeDownloadHandlers,
  ): Promise<RestoredTask[]>;
  deleteFile(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
}

type Listener = () => void;

export class DownloadManager {
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly store: DownloadsStore,
    private readonly native: NativeDownloader,
  ) {}

  /** Subscribe to "something changed" notifications; returns an unsubscribe fn. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  list(): Promise<DownloadRecord[]> {
    return this.store.list();
  }

  availability(contentType: string, streamId: string) {
    return this.store.availability(contentType, streamId);
  }

  /** Queue (or restart) an offline download for a playable item. */
  async enqueue(ctx: PlayContext, ext?: string): Promise<string> {
    const id = downloadId(ctx.contentType, ctx.streamId);
    const destination = downloadDestination(
      this.native.documentsDir,
      ctx.contentType,
      ctx.streamId,
      ext,
    );
    await this.native.prepare();
    await this.store.enqueue(ctx, id);
    this.native.start({ id, url: ctx.url, destination }, this.handlersFor(id));
    this.notify();
    return id;
  }

  async pause(id: string): Promise<void> {
    await this.native.pause(id);
    await this.store.setStatus(id, 'paused');
    this.notify();
  }

  async resume(id: string): Promise<void> {
    await this.native.resume(id);
    await this.store.setStatus(id, 'downloading');
    this.notify();
  }

  /** Cancel/delete a download and remove any partial or finished file. */
  async remove(id: string): Promise<void> {
    const rec = await this.store.get(id);
    try {
      await this.native.stop(id);
    } catch {
      // Task may already be gone; deletion proceeds regardless.
    }
    if (rec?.outputPath) {
      try {
        await this.native.deleteFile(rec.outputPath);
      } catch {
        // File may not exist; ignore.
      }
    }
    await this.store.remove(id);
    this.notify();
  }

  /**
   * Reconcile persisted downloads with live native tasks on app launch.
   * Live tasks get their handlers re-attached; rows that claimed to be in
   * flight but have no surviving task are flagged as errored so the user can
   * retry. Finished files that vanished are also flagged.
   */
  async restore(): Promise<void> {
    const restored = await this.native.restore((id) => this.handlersFor(id));
    const liveIds = new Set(restored.map((t) => t.id));

    const rows = await this.store.list();
    for (const row of rows) {
      if (row.status === 'done') {
        if (row.outputPath && !(await this.native.fileExists(row.outputPath))) {
          await this.store.markError(row.id, 'Downloaded file is missing.');
        }
        continue;
      }
      if (
        (row.status === 'downloading' || row.status === 'queued') &&
        !liveIds.has(row.id)
      ) {
        await this.store.markError(row.id, 'Download was interrupted.');
      }
    }
    this.notify();
  }

  /** Build the persistence callbacks for one task id. */
  private handlersFor(id: string): NativeDownloadHandlers {
    return {
      onProgress: (downloaded, total) => {
        void this.store.updateProgress(id, downloaded, total).then(() => this.notify());
      },
      onDone: (location, total) => {
        void this.store.markDone(id, location, total).then(() => this.notify());
      },
      onError: (message) => {
        void this.store.markError(id, message).then(() => this.notify());
      },
    };
  }
}
