import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Places nearby search the cohesion swap depends on, so the test stays
// offline and deterministic.
vi.mock("../src/orchestration/placesRetrieval", () => ({
  searchNearbyForActivity: vi.fn(),
}));

import { enforceDayGeographicCohesion } from "../src/orchestration/placeResolution";
import { searchNearbyForActivity } from "../src/orchestration/placesRetrieval";
import type { PlaceCandidate } from "../src/orchestration/types";
import { activity, itinerary } from "./fixtures";

const mockedSearch = vi.mocked(searchNearbyForActivity);

function candidate(partial: Partial<PlaceCandidate> & { placeId: string; name: string }): PlaceCandidate {
  return {
    address: "1 Main St",
    coordinates: { lat: 40.0, lng: -73.0 },
    rating: 4.4,
    reviewCount: 250,
    priceLevel: 2,
    types: [],
    category: "attraction",
    ...partial,
  };
}

beforeEach(() => mockedSearch.mockReset());

describe("enforceDayGeographicCohesion", () => {
  it("swaps an activity that sits in another town for one near the day's cluster", async () => {
    mockedSearch.mockResolvedValue([candidate({ placeId: "places/local", name: "Local Spot" })]);
    // Three activities cluster around (40, -73); a fourth is ~300 km away.
    const it = itinerary([[
      activity({ name: "A", placeId: "p/a", coordinates: { latitude: 40.00, longitude: -73.00 } }),
      activity({ name: "B", placeId: "p/b", coordinates: { latitude: 40.01, longitude: -73.01 } }),
      activity({ name: "C", placeId: "p/c", coordinates: { latitude: 40.02, longitude: -73.02 } }),
      activity({ name: "Outlier", placeId: "p/far", category: "attraction", coordinates: { latitude: 42.7, longitude: -73.0 } }),
    ]]);

    const { itinerary: out, movedCount } = await enforceDayGeographicCohesion(it, "key");
    expect(movedCount).toBe(1);
    const names = out.stops[0].days[0].activities.map((a) => a.name);
    expect(names).toEqual(["A", "B", "C", "Local Spot"]);
    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it("leaves a geographically tight day untouched and never calls Places", async () => {
    const it = itinerary([[
      activity({ name: "A", coordinates: { latitude: 40.00, longitude: -73.00 } }),
      activity({ name: "B", coordinates: { latitude: 40.01, longitude: -73.00 } }),
      activity({ name: "C", coordinates: { latitude: 40.02, longitude: -73.01 } }),
    ]]);
    const { movedCount } = await enforceDayGeographicCohesion(it, "key");
    expect(movedCount).toBe(0);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("skips drive days (they legitimately span cities)", async () => {
    const it = itinerary([[
      activity({ name: "Start", coordinates: { latitude: 40.0, longitude: -73.0 } }),
      activity({ name: "Mid", coordinates: { latitude: 41.0, longitude: -73.0 } }),
      activity({ name: "End", coordinates: { latitude: 42.5, longitude: -73.0 } }),
    ]]);
    it.stops[0].days[0].isDriveDay = true;
    const { movedCount } = await enforceDayGeographicCohesion(it, "key");
    expect(movedCount).toBe(0);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("keeps the original outlier when Places offers no usable nearby venue", async () => {
    mockedSearch.mockResolvedValue([]);
    const it = itinerary([[
      activity({ name: "A", coordinates: { latitude: 40.00, longitude: -73.00 } }),
      activity({ name: "B", coordinates: { latitude: 40.01, longitude: -73.01 } }),
      activity({ name: "C", coordinates: { latitude: 40.02, longitude: -73.02 } }),
      activity({ name: "Outlier", coordinates: { latitude: 42.7, longitude: -73.0 } }),
    ]]);
    const { itinerary: out, movedCount } = await enforceDayGeographicCohesion(it, "key");
    expect(movedCount).toBe(0);
    expect(out.stops[0].days[0].activities.map((a) => a.name)).toContain("Outlier");
  });
});
