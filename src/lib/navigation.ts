/**
 * Centralised route builders so screens don't hand-format paths.
 */
import type { Section } from '@/api/types';

export interface PlayerParams {
  section: Section;
  id: string;
  ext: string;
  title: string;
  poster?: string;
  /** Resume position in seconds. */
  start?: number;
  /**
   * Direct local file path for offline playback. When present the player uses
   * it verbatim instead of resolving a remote stream URL from the account.
   */
  src?: string;
}

export const routes = {
  details: (section: Section, id: string) =>
    `/details/${section}/${encodeURIComponent(id)}` as const,
  search: () => '/search' as const,
  settings: () => '/settings' as const,
  account: () => '/account' as const,
  player: (p: PlayerParams) => ({
    pathname: '/player' as const,
    params: {
      section: p.section,
      id: p.id,
      ext: p.ext,
      title: p.title,
      poster: p.poster ?? '',
      start: String(p.start ?? 0),
      src: p.src ?? '',
    },
  }),
};
