import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  nameMatchScore,
  findPlaceByText,
  resolveActivityPlaces,
  reconcileItineraryPlaces,
} from "../src/orchestration/placeResolution";
import { activity, itinerary } from "./fixtures";

// Helper: a fake Places Text Search response for a single place.
function placesResponse(places: Array<{ id: string; name: string; lat: number; lng: number; address?: string }>) {
  return {
    ok: true,
    json: async () => ({
      places: places.map((p) => ({
        id: p.id,
        displayName: { text: p.name },
        location: { latitude: p.lat, longitude: p.lng },
        formattedAddress: p.address ?? "123 Test St",
      })),
    }),
  };
}

describe("nameMatchScore", () => {
  it("matches identical names", () => {
    expect(nameMatchScore("Powell's Books", "Powell's Books")).toBe(1);
  });

  it("matches across possessive/apostrophe differences", () => {
    // The hallucinated-address bug fix hinges on this: 'Jordan's Bakery' must
    // match Google's 'Jordans Bakery'.
    expect(nameMatchScore("Jordan's Bakery", "Jordans Bakery")).toBe(1);
  });

  it("tolerates extra context Google appends", () => {
    expect(nameMatchScore("Blue Star Donuts", "Blue Star Donuts - Downtown")).toBe(1);
  });

  it("scores unrelated names near zero", () => {
    expect(nameMatchScore("Seljalandsfoss Waterfall", "Joe's Diner")).toBeLessThan(0.5);
  });
});

describe("findPlaceByText", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns the best-matching place with coords, placeId and a place_id map URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      placesResponse([{ id: "PLACE_123", name: "Jordans Bakery", lat: 45.52, lng: -122.68 }])
    ));

    const res = await findPlaceByText("Jordan's Bakery", "Portland, Oregon", "KEY");
    expect(res).not.toBeNull();
    expect(res!.placeId).toBe("PLACE_123");
    expect(res!.coordinates).toEqual({ latitude: 45.52, longitude: -122.68 });
    expect(res!.mapUrl).toContain("query_place_id=PLACE_123");
  });

  it("returns null when even the best candidate is a weak match (keeps AI coords)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      placesResponse([{ id: "X", name: "Random Tourist Shop", lat: 1, lng: 1 }])
    ));
    const res = await findPlaceByText("Seljalandsfoss Waterfall", "Iceland", "KEY");
    expect(res).toBeNull();
  });

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, text: async () => "" })));
    const res = await findPlaceByText("Anything", "Anywhere", "KEY");
    expect(res).toBeNull();
  });
});

describe("reconcileItineraryPlaces", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("snaps coords/placeId/mapUrl onto matched activities", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      const name: string = body.textQuery;
      if (name.startsWith("Jordans Bakery")) {
        return placesResponse([{ id: "P1", name: "Jordans Bakery", lat: 45.5, lng: -122.6 }]) as any;
      }
      return placesResponse([{ id: "P2", name: "Powells City of Books", lat: 45.52, lng: -122.68 }]) as any;
    });
    vi.stubGlobal("fetch", fetchMock);

    const it = itinerary([[
      activity({ name: "Jordans Bakery", coordinates: { latitude: 0, longitude: 0 } }),
      activity({ name: "Powells City of Books", coordinates: { latitude: 0, longitude: 0 } }),
    ]]);

    const out = await reconcileItineraryPlaces(it, "KEY");
    const acts = out.stops[0].days[0].activities;
    expect(acts[0].placeId).toBe("P1");
    expect(acts[0].coordinates).toEqual({ latitude: 45.5, longitude: -122.6 });
    expect(acts[1].placeId).toBe("P2");
  });

  it("leaves unmatched activities untouched (natural landmarks keep AI coords)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      placesResponse([{ id: "Z", name: "Unrelated Gift Shop", lat: 9, lng: 9 }])
    ));
    const it = itinerary([[
      activity({ name: "Seljalandsfoss Waterfall", coordinates: { latitude: 63.6, longitude: -19.9 } }),
    ]]);
    const out = await reconcileItineraryPlaces(it, "KEY");
    const a = out.stops[0].days[0].activities[0];
    expect(a.placeId).toBeUndefined();
    expect(a.coordinates).toEqual({ latitude: 63.6, longitude: -19.9 });
  });

  it("is incremental: never re-queries an activity that already has a placeId", async () => {
    const fetchMock = vi.fn(async () =>
      placesResponse([{ id: "NEW", name: "New Spot", lat: 1, lng: 1 }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const it = itinerary([[
      activity({ name: "Already Verified", placeId: "EXISTING", coordinates: { latitude: 5, longitude: 5 } }),
      activity({ name: "New Spot", coordinates: { latitude: 0, longitude: 0 } }),
    ]]);

    const out = await reconcileItineraryPlaces(it, "KEY");
    // Only the un-verified activity triggers a lookup.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.stops[0].days[0].activities[0].placeId).toBe("EXISTING");
    expect(out.stops[0].days[0].activities[1].placeId).toBe("NEW");
  });

  it("no-ops without an API key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const it = itinerary([[activity({ name: "Anywhere" })]]);
    const out = await reconcileItineraryPlaces(it, undefined);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out).toBe(it);
  });
});

describe("resolveActivityPlaces", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("reports how many activities it resolved", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      placesResponse([{ id: "C1", name: "Cafe Match", lat: 2, lng: 2 }])
    ));
    const { activities, resolvedCount } = await resolveActivityPlaces(
      [activity({ name: "Cafe Match" }), activity({ name: "Cafe Match", placeId: "ALREADY" })],
      "Portland, Oregon",
      "KEY"
    );
    expect(resolvedCount).toBe(1);
    expect(activities[0].placeId).toBe("C1");
    expect(activities[1].placeId).toBe("ALREADY");
  });
});
