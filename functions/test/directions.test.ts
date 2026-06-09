import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enrichTransportTimes, enrichDayTransportTimes, computeDriveLeg, enrichDriveLegs } from "../src/orchestration/directions";
import { activity, itinerary } from "./fixtures";
import type { GeneratedItinerary } from "../src/itinerarySchemas";

function computeRoutesResponse(durationSecs: number, distanceMeters: number, polyline = "abc") {
  return {
    ok: true,
    json: async () => ({ routes: [{ duration: `${durationSecs}s`, distanceMeters, polyline: { encodedPolyline: polyline } }] }),
  };
}

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

  it("falls back to a distance estimate (never the model's guess) when Google routes nothing", async () => {
    // Empty matrix → no duration for the leg. The two spots are ~2.7 km apart, so the
    // leg must become a real estimate, NOT the hallucinated "99 hr" the model wrote.
    vi.stubGlobal("fetch", vi.fn(async () => routeMatrix({}) as any));

    const it = itinerary([[
      activity({ name: "A", coordinates: { latitude: 35.00, longitude: -85.00 }, transport: [{ mode: "car", time: "99 hr" }] }),
      activity({ name: "B", coordinates: { latitude: 35.00, longitude: -85.03 }, transport: [] }),
    ]]);

    const out = await enrichDayTransportTimes(it, 0, "KEY");
    const leg = out.stops[0].days[0].activities[0].transport[0];
    expect(leg.time).not.toBe("99 hr");
    expect(leg.time).toMatch(/min|hr/);
    expect(leg.mode).toBe("car"); // ~2.7 km → driving
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

describe("computeDriveLeg", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("parses duration, distance (miles), and polyline from a computeRoutes response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        routes: [{ duration: "9900s", distanceMeters: 228530, polyline: { encodedPolyline: "abc123" } }],
      }),
    }) as any));

    const leg = await computeDriveLeg(1, 1, 2, 2, "KEY");
    expect(leg).not.toBeNull();
    expect(leg!.durationText).toBe("2 hr 45 min");
    expect(leg!.distanceText).toBe("142 mi"); // 228530 m ≈ 142 mi
    expect(leg!.encodedPolyline).toBe("abc123");
  });

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, text: async () => "denied" }) as any));
    expect(await computeDriveLeg(1, 1, 2, 2, "KEY")).toBeNull();
  });

  it("uses one-decimal miles under 10 mi", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ routes: [{ duration: "600s", distanceMeters: 8047, polyline: { encodedPolyline: "x" } }] }),
    }) as any));
    const leg = await computeDriveLeg(1, 1, 2, 2, "KEY");
    expect(leg!.distanceText).toBe("5.0 mi"); // 8047 m ≈ 5.0 mi
  });
});

describe("enrichDriveLegs", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  // 2-stop route trip: stop A (2 days, last day is the drive day) → stop B (1 day).
  function routeTrip(): GeneratedItinerary {
    return {
      id: "t", title: "T", subtitle: "S", destinationId: "d", destinationName: "A City",
      heroImage: "", source: "ai_generated", tripType: "route",
      stops: [
        {
          stopIndex: 0, location: "A City",
          overnightAnchor: { location: "A City", overnightType: "unknown" },
          days: [
            { label: "Day 1", activities: [activity({ name: "A1", coordinates: { latitude: 35.0, longitude: -85.3 } })] },
            {
              label: "Day 2", isDriveDay: true,
              activities: [
                activity({ name: "A2", time: "9:00 AM - 11:00 AM", coordinates: { latitude: 35.05, longitude: -85.31 } }),
                activity({ name: "A3", time: "1:00 PM - 2:00 PM", coordinates: { latitude: 35.06, longitude: -85.30 } }),
              ],
            },
          ],
        },
        {
          stopIndex: 1, location: "B City",
          overnightAnchor: { location: "B City", overnightType: "unknown" },
          days: [
            { label: "Day 3", activities: [activity({ name: "B1", time: "8:00 AM - 9:00 AM", coordinates: { latitude: 35.72, longitude: -83.50 } })] },
          ],
        },
      ],
    };
  }

  it("computes a boundary jump (whole drive day in the departing city, arrival next day)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => computeRoutesResponse(9900, 228530, "poly!") as any));

    const out = await enrichDriveLegs(routeTrip(), "KEY");
    const drive = out.stops[0].days[1].drive!;
    expect(drive.fromLocation).toBe("A City");
    expect(drive.toLocation).toBe("B City");
    expect(drive.durationText).toBe("2 hr 45 min");
    expect(drive.distanceText).toBe("142 mi");
    expect(drive.encodedPolyline).toBe("poly!");
    // Biggest gap is A3 → B1 (the day boundary): leave = end of A3 (2:00 PM); arrive +2h45m.
    expect(drive.departTime).toBe("2:00 PM");
    expect(drive.arriveTime).toBe("4:45 PM");
    expect(drive.afterActivityId).toBe(out.stops[0].days[1].activities[1].id); // A3
  });

  it("calls the route API with the inter-city endpoints, not two same-city activities", async () => {
    const fetchMock = vi.fn(async () => computeRoutesResponse(3600, 100000) as any);
    vi.stubGlobal("fetch", fetchMock);

    await enrichDriveLegs(routeTrip(), "KEY");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.origin.location.latLng.latitude).toBeCloseTo(35.06); // A3 (last of drive day)
    expect(body.destination.location.latLng.latitude).toBeCloseTo(35.72); // B1 (first of next stop)
  });

  it("finds a MID-DAY jump when arrival-city activities sit later the same day", async () => {
    // Drive day: 2 activities in city A, then 2 already in city B; next stop also in B.
    const trip: GeneratedItinerary = {
      id: "t", title: "T", subtitle: "S", destinationId: "d", destinationName: "A City",
      heroImage: "", source: "ai_generated", tripType: "route",
      stops: [
        {
          stopIndex: 0, location: "A City",
          overnightAnchor: { location: "A City", overnightType: "unknown" },
          days: [
            {
              label: "Day 1", isDriveDay: true,
              activities: [
                activity({ name: "A-morning", time: "8:00 AM - 9:00 AM", coordinates: { latitude: 35.06, longitude: -85.29 } }),
                activity({ name: "A-noon", time: "9:15 AM - 10:30 AM", coordinates: { latitude: 35.02, longitude: -85.29 } }),
                activity({ name: "B-lunch", time: "11:45 AM - 1:00 PM", coordinates: { latitude: 35.24, longitude: -85.83 } }),
                activity({ name: "B-dinner", time: "7:00 PM - 8:30 PM", coordinates: { latitude: 35.23, longitude: -85.82 } }),
              ],
            },
          ],
        },
        {
          stopIndex: 1, location: "B City",
          overnightAnchor: { location: "B City", overnightType: "unknown" },
          days: [{ label: "Day 2", activities: [activity({ name: "B-bfast", coordinates: { latitude: 35.24, longitude: -85.84 } })] }],
        },
      ],
    };
    const fetchMock = vi.fn(async () => computeRoutesResponse(2700, 80000, "p") as any);
    vi.stubGlobal("fetch", fetchMock);

    const out = await enrichDriveLegs(trip, "KEY");
    const drive = out.stops[0].days[0].drive!;
    // The jump is A-noon → B-lunch (mid-day), not the last activity.
    expect(drive.afterActivityId).toBe(out.stops[0].days[0].activities[1].id); // A-noon
    expect(drive.departTime).toBe("10:30 AM");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.origin.location.latLng.latitude).toBeCloseTo(35.02);   // A-noon
    expect(body.destination.location.latLng.latitude).toBeCloseTo(35.24); // B-lunch
  });

  it("does not touch the final stop (no drive after the last city)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => computeRoutesResponse(3600, 100000) as any));
    const out = await enrichDriveLegs(routeTrip(), "KEY");
    expect(out.stops[1].days[0].drive).toBeUndefined();
  });
});
