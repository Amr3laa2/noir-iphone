/**
 * App-startup wiring for the Xtream API client.
 *
 * Connects the data layer (cache + accounts + settings + watch history) to the
 * pure `XtreamClient`. Kept separate from `XtreamClient` itself so the client
 * stays fully unit-testable with fakes; this module just supplies the concrete
 * dependencies on device.
 */
import { getDataLayer } from '../db';
import { XtreamClient } from './xtream';

/** Settings key holding a user-chosen global metadata TTL (seconds). */
const TTL_SETTING_KEY = 'metadata_ttl_seconds';

let singleton: Promise<XtreamClient> | null = null;

export function getXtreamClient(): Promise<XtreamClient> {
  if (!singleton) {
    singleton = (async () => {
      const data = await getDataLayer();
      return new XtreamClient({
        accounts: data.accounts,
        cache: data.cache,
        getTtlOverride: () => data.settings.getNumber(TTL_SETTING_KEY),
        getWatchHistory: () => data.history.continueWatching(),
      });
    })();
  }
  return singleton;
}
