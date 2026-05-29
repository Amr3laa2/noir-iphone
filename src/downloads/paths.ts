/**
 * Pure helpers for naming downloaded files.
 *
 * Kept free of native imports so the naming/sanitising rules are unit-tested on
 * Node. The download manager combines `downloadFileName` with the platform
 * documents directory to produce the on-disk destination.
 */

/** Strips a leading dot and lowercases; falls back to mp4 for empty input. */
export function normalizeExtension(ext?: string): string {
  const cleaned = (ext ?? '').trim().replace(/^\.+/, '').toLowerCase();
  // Guard against query strings or junk sneaking in via the stream extension.
  const safe = cleaned.replace(/[^a-z0-9]/g, '');
  return safe || 'mp4';
}

/**
 * Deterministic, collision-free file name for a download. We key on
 * content type + stream id (not the human title, which can contain anything)
 * so the same item always maps to the same file and re-downloads overwrite
 * cleanly.
 */
export function downloadFileName(
  contentType: string,
  streamId: string,
  ext?: string,
): string {
  const slug = `${contentType}_${streamId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${slug}.${normalizeExtension(ext)}`;
}

/** Joins a directory and file name with exactly one separator. */
export function joinPath(dir: string, name: string): string {
  return `${dir.replace(/\/+$/, '')}/${name.replace(/^\/+/, '')}`;
}

/** Full on-disk destination for a download within the given documents dir. */
export function downloadDestination(
  documentsDir: string,
  contentType: string,
  streamId: string,
  ext?: string,
): string {
  return joinPath(joinPath(documentsDir, 'downloads'), downloadFileName(contentType, streamId, ext));
}
