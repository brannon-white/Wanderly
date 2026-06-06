import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enrichTransportTimes, enrichDayTransportTimes } from "../src/orchestration/directions";
import { activity, itinerary } from "./fixtures";

// Fake Routes computeRouteMatrix response: one element per (i,i) diagonal pair.
// `durations` is keyed by segment index → seconds.
function routeMatrix(durations: Record<number, number>) {
  return {
    ok: true,
    json: async () =>
      Object.entries(durations).map(([i, secs]) => ({
        originIndex: Number(i),
        destinationIndex: Number(i),
        duration: `${secs}s`,
        status: { code: 0 },
      })),
  };
}

describe("enrichDayTransportTimes", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("writes real durations onto each non-final activity's first transport leg", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => routeMatrix({ 0: 300, 1: 600 }) as any));

    const it = itinerary([[
      activity({ name: "A", coordinates: { latitude: 1, longitude: 1 }, transport: [{ mode: "walk", time: "?" }] }),
      activity({ name: "B", coordinates: { latitude: 2, longitude: 2 }, transport: [{ mode: "walk", time: "?" }] }),
      activity({ name: "C", coordinates: { latitude: 3, longitude: 3 }, transport: [] }),
    ]]);

    const out = await enrichDayTransportTimes(it, 0, "KEY");
    const acts = out.stops[0].days[0].activities;
    expect(acts[0].transport[0].time).toBe("5 min");
    expect(acts[1].transport[0].time).toBe("10 min");
    expect(acts[2].transport).toEqual([]); // last activity untouched
  });

  it("skips ferry legs (no Routes lookup) and activities without coordinates", async () => {
    const fetchMock = vi.fn(async () => routeMatrix({ 0: 120 }) as any);
    vi.stubGlobal("fetch", fetchMock);

    const it = itinerary([[
      // ferry leg → skipped
      activity({ name: "A", coordinates: { latitude: 1, longitude: 1 }, transport: [{ mode: "ferry", time: "orig" }] }),
      // missing coords → skipped
      activity({ name: "B", coordinates: undefined, transport: [{ mode: "walk", time: "orig" }] }),
      activity({ name: "C", coordinates: { latitude: 3, longitude: 3 }, transport: [] }),
    ]]);

    const out = await enrichDayTransportTimes(it, 0, "KEY");
    const acts = out.stops[0].days[0].activities;
    expect(acts[0].transport[0].time).toBe("orig");
    expect(acts[1].transport[0].time).toBe("orig");
    // No active segments → no network call at all.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("enrichTransportTimes (all days)", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("enriches each day independently", async () => {
    // Each day has exactly one active segment (index 0).
    vi.stubGlobal("fetch", vi.fn(async () => routeMatrix({ 0: 1800 }) as any));

    const it = itinerary([
      [
        activity({ name: "A", coordinates: { latitude: 1, longitude: 1 }, transport: [{ mode: "walk", time: "?" }] }),
        activity({ name: "B", coordinates: { latitude: 2, longitude: 2 }, transport: [] }),
      ],
      [
        activity({ name: "C", coordinates: { latitude: 5, longitude: 5 }, transport: [{ mode: "car", time: "?" }] }),
        activity({ name: "D", coordinates: { latitude: 6, longitude: 6 }, transport: [] }),
      ],
    ]);

    const out = await enrichTransportTimes(it, "KEY");
    expect(out.stops[0].days[0].activities[0].transport[0].time).toBe("30 min");
    expect(out.stops[0].days[1].activities[0].transport[0].time).toBe("30 min");
  });
});
