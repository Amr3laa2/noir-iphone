/**
 * Lightweight session store (zustand).
 *
 * Holds a monotonically-increasing `accountVersion` that screens depend on so
 * that saving / switching / removing an account forces every data hook to
 * re-fetch. The actual account data lives in SQLite (the source of truth); this
 * store is just the "something changed, reload" signal.
 */
import { create } from 'zustand';

interface SessionState {
  /** Bumped whenever the active account changes. */
  accountVersion: number;
  /** Call after saving/activating/removing an account. */
  bumpAccount: () => void;
}

export const useSession = create<SessionState>((set) => ({
  accountVersion: 0,
  bumpAccount: () => set((s) => ({ accountVersion: s.accountVersion + 1 })),
}));
