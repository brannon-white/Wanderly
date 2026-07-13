import { describe, it, expect } from "vitest";
import { TtlCache, buildSuggestionKey, withInflightDedupe } from "../src/orchestration/suggestionCache";

describe("TtlCache", () => {
  it("returns a stored value before its TTL and null after", () => {
    let now = 1_000;
    const cache = new TtlCache<string>(500, 10, () => now);
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    now = 1_499;
    expect(cache.get("k")).toBe("v");
    now = 1_501;
    expect(cache.get("k")).toBeNull();
  });

  it("evicts the oldest entry once maxEntries is reached", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // evicts "a"
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("overwriting an existing key does not evict others", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("b", 20);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(20);
  });
});

describe("buildSuggestionKey", () => {
  const base = {
    uid: "u1",
    itineraryId: "it1",
    dayIndex: 0,
    activityIndex: 2,
    reason: "similar_nearby",
    count: 3,
    activityName: "Blue Bottle Coffee",
    updatedAtMs: 1234,
  };

  it("is stable for identical inputs", () => {
    expect(buildSuggestionKey(base)).toBe(buildSuggestionKey({ ...base }));
  });

  it("misses when the itinerary is edited (updatedAt changes)", () => {
    expect(buildSuggestionKey(base)).not.toBe(buildSuggestionKey({ ...base, updatedAtMs: 5678 }));
  });

  it("misses when the target activity changed even at the same position", () => {
    expect(buildSuggestionKey(base)).not.toBe(buildSuggestionKey({ ...base, activityName: "Ritual Coffee" }));
  });

  it("separates users, reasons, and slots", () => {
    expect(buildSuggestionKey(base)).not.toBe(buildSuggestionKey({ ...base, uid: "u2" }));
    expect(buildSuggestionKey(base)).not.toBe(buildSuggestionKey({ ...base, reason: "cheaper" }));
    expect(buildSuggestionKey(base)).not.toBe(buildSuggestionKey({ ...base, activityIndex: 3 }));
  });
});

describe("withInflightDedupe", () => {
  it("concurrent identical requests share one underlying call", async () => {
    const inflight = new Map<string, Promise<string>>();
    let calls = 0;
    const slow = () =>
      new Promise<string>((resolve) => {
        calls += 1;
        setTimeout(() => resolve("result"), 10);
      });

    const [a, b, c] = await Promise.all([
      withInflightDedupe(inflight, "k", slow),
      withInflightDedupe(inflight, "k", slow),
      withInflightDedupe(inflight, "k", slow),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe("result");
    expect(b).toBe("result");
    expect(c).toBe("result");
    expect(inflight.size).toBe(0); // cleaned up after settle
  });

  it("a failed call is not cached — the next request retries", async () => {
    const inflight = new Map<string, Promise<string>>();
    let calls = 0;
    const failOnce = () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("boom")) : Promise.resolve("ok");
    };

    await expect(withInflightDedupe(inflight, "k", failOnce)).rejects.toThrow("boom");
    await expect(withInflightDedupe(inflight, "k", failOnce)).resolves.toBe("ok");
    expect(calls).toBe(2);
  });

  it("different keys do not dedupe against each other", async () => {
    const inflight = new Map<string, Promise<number>>();
    let calls = 0;
    const fn = () => {
      calls += 1;
      return Promise.resolve(calls);
    };
    await Promise.all([
      withInflightDedupe(inflight, "a", fn),
      withInflightDedupe(inflight, "b", fn),
    ]);
    expect(calls).toBe(2);
  });
});
