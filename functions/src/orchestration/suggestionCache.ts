// In-memory TTL cache + in-flight dedupe for replacement-suggestion requests.
//
// The client preloads suggestions when a day opens and fetches again when the
// user taps an action — without this, the same (itinerary, day, activity,
// reason) tuple can trigger two identical Anthropic + Places calls seconds
// apart. getSuggestedReplacementsHttp runs with minInstances: 1, so a
// per-instance cache catches the vast majority of repeats.
//
// Invalidation: the key includes the itinerary's updatedAt and the target
// activity's name, so any edit that changes the doc (or the activity itself)
// naturally misses the old entry; stale entries age out via TTL.

export class TtlCache<V> {
  private entries = new Map<string, { value: V; expires: number }>();

  constructor(
    private ttlMs: number,
    private maxEntries: number,
    private now: () => number = Date.now,
  ) {}

  get(key: string): V | null {
    const hit = this.entries.get(key);
    if (!hit) return null;
    if (this.now() > hit.expires) {
      this.entries.delete(key);
      return null;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    // Simple FIFO eviction — Map preserves insertion order.
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.delete(key); // re-insert so refreshed keys move to the back
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }
}

export function buildSuggestionKey(params: {
  uid: string;
  itineraryId: string;
  dayIndex: number;
  activityIndex: number;
  reason?: string;
  count?: number;
  activityName?: string;
  updatedAtMs?: number;
}): string {
  const { uid, itineraryId, dayIndex, activityIndex, reason, count, activityName, updatedAtMs } = params;
  return [
    uid,
    itineraryId,
    dayIndex,
    activityIndex,
    reason ?? "",
    count ?? 3,
    (activityName ?? "").toLowerCase(),
    updatedAtMs ?? 0,
  ].join("|");
}

// Concurrent identical requests share one underlying promise, so a preload and
// a user tap racing each other still cost a single LLM call.
export async function withInflightDedupe<V>(
  inflight: Map<string, Promise<V>>,
  key: string,
  fn: () => Promise<V>,
): Promise<V> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
