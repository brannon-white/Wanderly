import { describe, it, expect } from "vitest";
import { enforceVerifiedPlaces } from "../src/orchestration/placeResolution";
import type { StopPool, PlaceCandidate, StopCandidatePool } from "../src/orchestration/types";
import { activity, itinerary } from "./fixtures";

function candidate(partial: Partial<PlaceCandidate> & { placeId: string; name: string }): PlaceCandidate {
  return {
    address: "123 St",
    coordinates: { lat: 45, lng: -122 },
    rating: 4.5,
    reviewCount: 100,
    priceLevel: 2,
    types: [],
    category: "restaurant",
    ...partial,
  };
}

function pool(partial: Partial<StopCandidatePool> = {}): StopPool {
  return {
    location: "Portland, Oregon",
    nightCount: 1,
    stopIndex: 0,
    isFirstStop: true,
    isLastStop: true,
    trails: [],
    candidates: {
      breakfast: partial.breakfast ?? [],
      food: partial.food ?? [],
      nightlife: partial.nightlife ?? [],
      attractions: partial.attractions ?? [],
      scenic: partial.scenic ?? [],
    },
  };
}

describe("enforceVerifiedPlaces", () => {
  it("keeps verified activities (placeId or trail data) untouched", () => {
    const it = itinerary([[
      activity({ name: "Real Cafe", category: "food", placeId: "places/abc" }),
      activity({ name: "Big Trail", category: "adventure", trailDistanceMiles: 5 }),
    ]]);
    const { itinerary: out, replacedCount, droppedCount } = enforceVerifiedPlaces(it, [pool()]);
    expect(replacedCount).toBe(0);
    expect(droppedCount).toBe(0);
    expect(out.stops[0].days[0].activities.map((a) => a.name)).toEqual(["Real Cafe", "Big Trail"]);
  });

  it("replaces an unverified activity with an unused same-category pool venue", () => {
    const it = itinerary([[
      activity({ name: "Hallucinated Bistro", category: "food", coordinates: { latitude: 1, longitude: 2 } }),
    ]]);
    const p = pool({ food: [candidate({ placeId: "places/food1", name: "Pool Diner", editorialSummary: "Tasty" })] });

    const { itinerary: out, replacedCount, droppedCount } = enforceVerifiedPlaces(it, [p]);
    expect(replacedCount).toBe(1);
    expect(droppedCount).toBe(0);
    const a = out.stops[0].days[0].activities[0];
    expect(a.name).toBe("Pool Diner");
    expect(a.placeId).toBe("places/food1");
    expect(a.coordinates).toEqual({ latitude: 45, longitude: -122 });
    expect(a.mapUrl).toContain("query_place_id=places/food1");
    expect(a.description).toBe("Tasty");
  });

  it("drops an unverified activity when the pool is exhausted", () => {
    const it = itinerary([[
      activity({ name: "Invented Overlook", category: "nature" }),
    ]]);
    const { itinerary: out, replacedCount, droppedCount } = enforceVerifiedPlaces(it, [pool()]);
    expect(replacedCount).toBe(0);
    expect(droppedCount).toBe(1);
    expect(out.stops[0].days[0].activities).toHaveLength(0);
  });

  it("never reuses a pool venue already on the trip or just substituted", () => {
    const it = itinerary([[
      activity({ name: "Pool Diner", category: "food", placeId: "places/food1" }), // already used
      activity({ name: "Fake Eatery", category: "food" }),                          // needs replacement
      activity({ name: "Another Fake", category: "food" }),                         // needs replacement
    ]]);
    const p = pool({
      food: [
        candidate({ placeId: "places/food1", name: "Pool Diner" }),   // taken
        candidate({ placeId: "places/food2", name: "Second Diner" }), // first sub
      ],
    });
    const { itinerary: out, replacedCount, droppedCount } = enforceVerifiedPlaces(it, [p]);
    const names = out.stops[0].days[0].activities.map((a) => a.name);
    expect(names).toContain("Pool Diner");
    expect(names).toContain("Second Diner");
    expect(replacedCount).toBe(1); // only one spare venue
    expect(droppedCount).toBe(1);  // the other unverified one is dropped
    // no duplicate placeIds
    const ids = out.stops[0].days[0].activities.map((a) => a.placeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
