/**
 * Singleton wiring for the download manager.
 *
 * Combines the persisted `DownloadsStore` (from the data layer) with the
 * native NSURLSession engine. Built once and reused so the in-memory task map
 * and subscriber set are shared across screens.
 */
import { getDataLayer } from '../db';
import { DownloadManager } from './manager';
import { BackgroundDownloaderNative } from './native';

let singleton: Promise<DownloadManager> | null = null;

export function getDownloadManager(): Promise<DownloadManager> {
  if (!singleton) {
    singleton = (async () => {
      const data = await getDataLayer();
      const manager = new DownloadManager(data.downloads, new BackgroundDownloaderNative());
      // Reconcile persisted downloads with surviving background tasks.
      await manager.restore();
      return manager;
    })();
  }
  return singleton;
}

export { DownloadManager } from './manager';
export type { NativeDownloader } from './manager';
