import { describe, it, expect } from "vitest";
import { optimizeDay } from "../src/itineraryGeneration";
import { activity, itinerary } from "./fixtures";

// minimize_walking is fully deterministic (nearest-neighbor reorder) and never
// calls the LLM, so it can be tested directly. This is the correct behaviour the
// whole-day "Reduce Walking" button now triggers (issue #3).
describe("optimizeDay — minimize_walking", () => {
  it("reorders non-meal stops to cut walking while keeping meals in their slots", async () => {
    const N1 = activity({ name: "N1", coordinates: { latitude: 0, longitude: 0 }, category: "attraction" });
    const N2 = activity({ name: "N2", coordinates: { latitude: 0, longitude: 10 }, category: "attraction" });
    const F  = activity({ name: "Lunch", coordinates: { latitude: 0, longitude: 5 }, category: "food" });
    const N3 = activity({ name: "N3", coordinates: { latitude: 0, longitude: 1 }, category: "attraction" });

    const it = itinerary([[N1, N2, F, N3]]);
    const out = await optimizeDay({ itinerary: it, dayIndex: 0, mode: "minimize_walking" });
    const result = out.stops[0].days[0].activities.map((a) => a.name);

    // Nearest-neighbour from N1: N1 → N3 → N2; the food stop stays at index 2.
    expect(result).toEqual(["N1", "N3", "Lunch", "N2"]);
    expect(out.stops[0].days[0].activities[2].category).toBe("food");
  });

  it("preserves the full set of activities (never drops or duplicates)", async () => {
    const acts = [
      activity({ name: "A", coordinates: { latitude: 1, longitude: 1 } }),
      activity({ name: "B", coordinates: { latitude: 1, longitude: 4 } }),
      activity({ name: "C", coordinates: { latitude: 1, longitude: 2 } }),
    ];
    const it = itinerary([acts]);
    const out = await optimizeDay({ itinerary: it, dayIndex: 0, mode: "minimize_walking" });
    const names = out.stops[0].days[0].activities.map((a) => a.name).sort();
    expect(names).toEqual(["A", "B", "C"]);
  });
});
