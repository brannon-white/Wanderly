import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Places nearby search the pool-free gate depends on, so the test stays
// offline and deterministic.
vi.mock("../src/orchestration/placesRetrieval", () => ({
  searchNearbyForActivity: vi.fn(),
}));

import { enforceVerifiedPlacesBySearch } from "../src/orchestration/placeResolution";
import { searchNearbyForActivity } from "../src/orchestration/placesRetrieval";
import type { PlaceCandidate } from "../src/orchestration/types";
import { activity, itinerary } from "./fixtures";

const mockedSearch = vi.mocked(searchNearbyForActivity);

function candidate(partial: Partial<PlaceCandidate> & { placeId: string; name: string }): PlaceCandidate {
  return {
    address: "1 Main St",
    coordinates: { lat: 40, lng: -73 },
    rating: 4.4,
    reviewCount: 250,
    priceLevel: 2,
    types: [],
    category: "restaurant",
    ...partial,
  };
}

beforeEach(() => mockedSearch.mockReset());

describe("enforceVerifiedPlacesBySearch", () => {
  it("no-ops without an API key (never drops on a missing key)", async () => {
    const it = itinerary([[activity({ name: "Mystery Spot" })]]);
    const { itinerary: out, replacedCount, droppedCount } = await enforceVerifiedPlacesBySearch(it, undefined);
    expect(replacedCount).toBe(0);
    expect(droppedCount).toBe(0);
    expect(out.stops[0].days[0].activities).toHaveLength(1);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("leaves verified activities alone and never calls Places for them", async () => {
    const it = itinerary([[activity({ name: "Real Museum", placeId: "places/x" })]]);
    const { replacedCount, droppedCount } = await enforceVerifiedPlacesBySearch(it, "key");
    expect(replacedCount).toBe(0);
    expect(droppedCount).toBe(0);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("replaces an unverified activity with a real nearby venue", async () => {
    mockedSearch.mockResolvedValue([candidate({ placeId: "places/near1", name: "Verified Tavern", editorialSummary: "Cozy" })]);
    const it = itinerary([[
      activity({ name: "Imaginary Pub", category: "food", coordinates: { latitude: 40, longitude: -73 } }),
    ]]);

    const { itinerary: out, replacedCount, droppedCount } = await enforceVerifiedPlacesBySearch(it, "key");
    expect(replacedCount).toBe(1);
    expect(droppedCount).toBe(0);
    const a = out.stops[0].days[0].activities[0];
    expect(a.name).toBe("Verified Tavern");
    expect(a.placeId).toBe("places/near1");
    expect(a.coordinates).toEqual({ latitude: 40, longitude: -73 });
  });

  it("drops an unverified activity when Places returns nothing usable", async () => {
    mockedSearch.mockResolvedValue([]);
    const it = itinerary([[
      activity({ name: "Nowhere Falls", category: "nature", coordinates: { latitude: 1, longitude: 1 } }),
    ]]);
    const { itinerary: out, replacedCount, droppedCount } = await enforceVerifiedPlacesBySearch(it, "key");
    expect(replacedCount).toBe(0);
    expect(droppedCount).toBe(1);
    expect(out.stops[0].days[0].activities).toHaveLength(0);
  });

  it("only gates the targeted day when dayIndex is given", async () => {
    mockedSearch.mockResolvedValue([candidate({ placeId: "places/near2", name: "Real Cafe" })]);
    const it = itinerary([
      [activity({ name: "Fake Day0", category: "food", coordinates: { latitude: 2, longitude: 2 } })],
      [activity({ name: "Fake Day1", category: "food", coordinates: { latitude: 3, longitude: 3 } })],
    ]);

    const { itinerary: out, replacedCount } = await enforceVerifiedPlacesBySearch(it, "key", { dayIndex: 1 });
    expect(replacedCount).toBe(1);
    expect(mockedSearch).toHaveBeenCalledTimes(1);
    // Day 0 untouched (still the unverified placeholder), Day 1 replaced
    expect(out.stops[0].days[0].activities[0].name).toBe("Fake Day0");
    expect(out.stops[0].days[1].activities[0].name).toBe("Real Cafe");
  });
});
