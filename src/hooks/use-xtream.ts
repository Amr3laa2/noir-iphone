/**
 * Data hooks that bridge screens to the singleton `XtreamClient` and data
 * layer. Each re-runs when the active account changes (via `accountVersion`).
 */
import { useCallback } from 'react';

import { getXtreamClient } from '@/api/client';
import { getDataLayer } from '@/db';
import type {
  HomePayload,
  IptvAccount,
  Section,
  XtreamItem,
} from '@/api/types';
import { useSession } from '@/state/session';
import { useAsync, type AsyncState } from './use-async';

export function useActiveAccount(): AsyncState<IptvAccount | null> {
  const version = useSession((s) => s.accountVersion);
  return useAsync(async () => {
    const data = await getDataLayer();
    return data.accounts.getActive();
  }, [version]);
}

export function useHome(): AsyncState<HomePayload> {
  const version = useSession((s) => s.accountVersion);
  return useAsync(async () => {
    const client = await getXtreamClient();
    return client.getHome();
  }, [version]);
}

export function useCategories(section: Section): AsyncState<XtreamItem[]> {
  const version = useSession((s) => s.accountVersion);
  return useAsync(async () => {
    const client = await getXtreamClient();
    return client.getCategories(section);
  }, [version, section]);
}

export function useStreams(
  section: Section,
  categoryId?: string,
  query?: string,
): AsyncState<XtreamItem[]> {
  const version = useSession((s) => s.accountVersion);
  return useAsync(async () => {
    const client = await getXtreamClient();
    return client.getStreams(section, categoryId, query);
  }, [version, section, categoryId, query]);
}

/** Imperative search across all sections (used by the search screen). */
export function useSearch() {
  return useCallback(async (query: string) => {
    const client = await getXtreamClient();
    return client.searchContent(query);
  }, []);
}
