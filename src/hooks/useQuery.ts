import { useCallback, useEffect, useState } from "react";
import { fetchDeduped, getSnapshot, subscribe, invalidate } from "../lib/queryCache";

/**
 * Minimal, dependency-free stand-in for react-query's/SWR's useQuery.
 *
 * Why hand-rolled instead of adding @tanstack/react-query: this sandbox
 * has no network access to run `npm install`, which means there's no way
 * to correctly regenerate package-lock.json's exact dependency tree and
 * integrity hashes for a new package by hand — hand-editing package.json
 * alone without a matching lockfile entry would leave `npm ci` broken for
 * anyone who actually pulls this. A small in-house module I can write and
 * verify completely, with zero new dependency-tree risk, was the safer
 * call here. If a real npm install ever happens in this repo, migrating
 * from this to react-query later is a reasonable follow-up — the
 * `{ data, loading, error, refetch }` shape below was deliberately kept
 * close to it so that migration would be mechanical, not a rewrite.
 *
 * `key`: the cache key. Pass `null` to skip fetching entirely (e.g. while
 * a required id/config value isn't available yet) — mirrors react-query's
 * own `enabled` pattern via a nullable key instead of a separate flag.
 *
 * `fetcher`: expected to be effectively deterministic for a given `key`,
 * same assumption react-query itself documents — this hook does not
 * retrigger a fetch just because `fetcher`'s identity changed between
 * renders (a fresh inline arrow function every render is normal and
 * shouldn't cause a refetch loop); only a `key` change or an explicit
 * `refetch()` call does.
 */
export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: { staleTimeMs?: number }
): { data: T | undefined; loading: boolean; error: Error | undefined; refetch: () => void } {
  const staleTimeMs = options?.staleTimeMs ?? 60_000;
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!key) return;
    const unsubscribe = subscribe(key, () => forceRender((n) => n + 1));
    fetchDeduped(key, fetcher, staleTimeMs);
    return unsubscribe;
    // Deliberately [key, staleTimeMs] only — see the fetcher-identity note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, staleTimeMs]);

  const snapshot = key ? getSnapshot<T>(key) : { data: undefined, error: undefined, timestamp: 0 };
  // Cached-but-stale data is shown immediately while a background refetch
  // runs (stale-while-revalidate) — loading only reflects "no data at
  // all yet", not "currently revalidating", so returning users never see
  // a loading flash for data that's already on screen.
  const loading = key !== null && snapshot.timestamp === 0 && !snapshot.error;

  const refetch = useCallback(() => {
    if (!key) return;
    invalidate(key);
    fetchDeduped(key, fetcher, staleTimeMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, staleTimeMs]);

  return { data: snapshot.data, loading, error: snapshot.error, refetch };
}
