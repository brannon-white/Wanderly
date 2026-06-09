import { describe, it, expect } from "vitest";
import { analyzeDay } from "../utils/itineraryInsights";
import type { ItineraryActivity } from "../types/itinerary";

function act(partial: Partial<ItineraryActivity> & { name: string }): ItineraryActivity {
  return {
    id: partial.id ?? partial.name,
    time: "09:00 AM - 10:00 AM",
    image: "",
    transport: [{ mode: "walk", time: "5 min" }],
    ...partial,
  };
}

describe("analyzeDay — walking warnings", () => {
  it("does NOT warn about a long gap we'd actually drive (no walk/drive contradiction)", () => {
    // ~3.3 km apart → past the 1.2 km walk cap, so the recommended mode is driving.
    // We must not warn about a 'walk' the user isn't being told to take.
    const insights = analyzeDay([
      act({ name: "A", coordinates: { latitude: 45.50, longitude: -122.68 } }),
      act({ name: "B", coordinates: { latitude: 45.53, longitude: -122.68 } }),
    ]);
    expect(insights.find((i) => i.actionType === "reduce_walking" && i.afterIndex === 0)).toBeFalsy();
  });

  it("does not flag a long leg when the transport is motorized", () => {
    const insights = analyzeDay([
      act({ name: "A", coordinates: { latitude: 45.50, longitude: -122.68 }, transport: [{ mode: "car", time: "10 min" }] }),
      act({ name: "B", coordinates: { latitude: 45.53, longitude: -122.68 } }),
    ]);
    expect(insights.find((i) => i.afterIndex === 0 && i.actionType === "reduce_walking")).toBeFalsy();
  });

  it("does not flag short walks", () => {
    const insights = analyzeDay([
      act({ name: "A", coordinates: { latitude: 45.500, longitude: -122.680 } }),
      act({ name: "B", coordinates: { latitude: 45.502, longitude: -122.680 } }), // ~0.2 km
    ]);
    expect(insights.find((i) => i.actionType === "reduce_walking")).toBeFalsy();
  });
});

describe("analyzeDay — tight schedule", () => {
  it("flags when travel time can't fit the gap between consecutive activities", () => {
    const insights = analyzeDay([
      // ends 10:00, needs 40 min travel, next starts 10:10 → impossible
      act({ name: "A", time: "09:00 AM - 10:00 AM", coordinates: { latitude: 1, longitude: 1 }, transport: [{ mode: "walk", time: "40 min" }] }),
      act({ name: "B", time: "10:10 AM - 11:00 AM", coordinates: { latitude: 1, longitude: 1 } }),
    ]);
    expect(insights.find((i) => i.actionType === "rework_schedule")).toBeTruthy();
  });
});
