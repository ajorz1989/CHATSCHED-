// A small, dependency-free stand-in for the caching/dedup layer a library
// like React Query or SWR would normally provide — see useQuery.ts's own
// header comment for why this is hand-rolled rather than a new npm
// dependency. This file is the actual cache engine; useQuery.ts is the
// thin React-hook wrapper around it.
//
// Two problems this solves, both real and observed in this codebase
// today, not hypothetical:
//   1. Every one of the ~95 useEffect-based data-fetching call sites
//      fires its own independent network request, even when two
//      components mount on the same page wanting the exact same data —
//      e.g. usePublishers() has 14 separate consumers, several of which
//      can render together (a marketing-suite tool alongside the main
//      page content). Two components calling the same query at once
//      currently means two identical requests.
//   2. Nothing is cached across navigation — leave Browse and come back a
//      few seconds later, and it refetches the entire publisher list from
//      scratch every time, even though nothing could plausibly have
//      changed in that window.
//
// A module-level Map is the actual cache — deliberately not React state,
// so it survives component unmount/remount (navigating away and back)
// and is shared across every component in the tree without a Context
// provider. Components subscribe to a key and re-render when it changes,
// the same subscribe/notify shape React itself uses internally for
// external stores (this is intentionally close to what
// useSyncExternalStore is for, kept a level simpler here since nothing in
// this app needs concurrent-rendering tearing protection).

interface CacheEntry<T> {
  data: T | undefined;
  error: Error | undefined;
  timestamp: number; // 0 = never successfully fetched
  promise: Promise<T> | undefined; // in-flight request, for dedup
  subscribers: Set<() => void>;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getEntry<T>(key: string): CacheEntry<T> {
  let entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    entry = { data: undefined, error: undefined, timestamp: 0, promise: undefined, subscribers: new Set() };
    cache.set(key, entry as CacheEntry<unknown>);
  }
  return entry;
}

function notify(key: string): void {
  cache.get(key)?.subscribers.forEach((fn) => fn());
}

/** Registers a callback to run whenever `key`'s cached data, error, or loading state changes. Returns an unsubscribe function — call it on unmount. */
export function subscribe(key: string, callback: () => void): () => void {
  const entry = getEntry(key);
  entry.subscribers.add(callback);
  return () => {
    entry.subscribers.delete(callback);
  };
}

export function getSnapshot<T>(key: string): { data: T | undefined; error: Error | undefined; timestamp: number } {
  const entry = getEntry<T>(key);
  return { data: entry.data, error: entry.error, timestamp: entry.timestamp };
}

/**
 * Ensures `key` has data no older than `staleTimeMs`, fetching via
 * `fetcher` if needed. Concurrent calls to the same key while a fetch is
 * already in flight piggyback on that one request rather than starting a
 * second — this is the dedup half of the module. Always updates the
 * cache and notifies subscribers on completion; callers read the result
 * via getSnapshot/subscribe (or useQuery), not this function's return
 * value, so every subscribed component updates together.
 */
export async function fetchDeduped<T>(key: string, fetcher: () => Promise<T>, staleTimeMs: number): Promise<void> {
  const entry = getEntry<T>(key);
  const isFresh = entry.timestamp > 0 && Date.now() - entry.timestamp < staleTimeMs;
  if (isFresh) return;

  if (entry.promise) {
    await entry.promise.catch(() => {}); // someone else's fetch is already in flight — wait for it, don't start another
    return;
  }

  const promise = fetcher();
  entry.promise = promise;
  try {
    const data = await promise;
    entry.data = data;
    entry.error = undefined;
    entry.timestamp = Date.now();
  } catch (err) {
    entry.error = err instanceof Error ? err : new Error(String(err));
  } finally {
    entry.promise = undefined;
    notify(key);
  }
}

/** Marks `key` as stale so the next read refetches, and notifies current subscribers so a refetch can kick off immediately rather than waiting for the next natural read. Call this after a mutation that should be reflected immediately (see usePublishers.ts's invalidatePublishersCache for the pattern). */
export function invalidate(key: string): void {
  const entry = cache.get(key);
  if (entry) {
    entry.timestamp = 0;
    notify(key);
  }
}
