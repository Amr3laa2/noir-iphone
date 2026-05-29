/**
 * Pure playback helpers — no React, no native modules — so the resume/seek/
 * progress logic is unit-testable on Node. The native player component and the
 * player screen consume these.
 */

/** Don't bother resuming a title watched for less than this (seconds). */
export const MIN_RESUME_SECONDS = 30;
/** Treat a title as "finished" past this fraction (so we restart it instead). */
export const FINISHED_FRACTION = 0.95;
/** Throttle watch-history writes to at most one per this interval (ms). */
export const PERSIST_INTERVAL_MS = 5_000;

/** Formats seconds as `H:MM:SS` (or `M:SS` under an hour). */
export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Whether a stored position is worth resuming from: far enough in to matter,
 * but not effectively finished.
 */
export function shouldResume(position: number, duration: number): boolean {
  if (position < MIN_RESUME_SECONDS) return false;
  if (duration > 0 && position >= duration * FINISHED_FRACTION) return false;
  return true;
}

/**
 * Converts a resume position (seconds) to the 0–1 fraction the VLC `seek` prop
 * expects. Clamped to [0, 1); returns 0 when duration is unknown.
 */
export function resumeFraction(position: number, duration: number): number {
  if (duration <= 0 || position <= 0) return 0;
  const f = position / duration;
  return f >= 1 ? 0 : Math.min(Math.max(f, 0), 0.999);
}

/** Clamps a 0–1 progress fraction to a valid seek target. */
export function clampSeek(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(Math.max(fraction, 0), 1);
}

export interface ProgressEvent {
  /** Milliseconds elapsed. */
  currentTime: number;
  /** Total duration in milliseconds (0/unknown for live). */
  duration: number;
}

export interface PlaybackProgress {
  positionSeconds: number;
  durationSeconds: number;
  /** 0–1 fraction, 0 when duration unknown. */
  fraction: number;
  remainingLabel: string;
  positionLabel: string;
}

/** Normalises a native progress event (ms) into seconds + display labels. */
export function toProgress(e: ProgressEvent): PlaybackProgress {
  const positionSeconds = Math.max(0, e.currentTime / 1000);
  const durationSeconds = Math.max(0, e.duration / 1000);
  const fraction = durationSeconds > 0 ? Math.min(positionSeconds / durationSeconds, 1) : 0;
  const remaining = durationSeconds > 0 ? Math.max(0, durationSeconds - positionSeconds) : 0;
  return {
    positionSeconds,
    durationSeconds,
    fraction,
    positionLabel: formatTime(positionSeconds),
    remainingLabel: durationSeconds > 0 ? `-${formatTime(remaining)}` : 'LIVE',
  };
}

/** Whether enough time has passed since `lastSavedAt` to persist again. */
export function shouldPersist(lastSavedAt: number, now: number): boolean {
  return now - lastSavedAt >= PERSIST_INTERVAL_MS;
}
