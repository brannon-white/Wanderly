import { describe, it, expect } from "vitest";
import { validateItinerary } from "../src/orchestration/validation";
import { activity, itinerary } from "./fixtures";

describe("validateItinerary — back-to-back meals", () => {
  it("removes a second restaurant scheduled right after another in the same city", () => {
    const it = itinerary([[
      activity({ name: "Lunch Spot", category: "food", time: "12:00 PM - 1:00 PM", coordinates: { latitude: 35.0, longitude: -85.3 } }),
      // Same area (≈ a few hundred metres) → genuine "eat, then eat again" bug.
      activity({ name: "Another Restaurant", category: "food", time: "1:15 PM - 2:15 PM", coordinates: { latitude: 35.001, longitude: -85.301 } }),
    ]]);

    const { itinerary: out, result } = validateItinerary(it);
    const names = out.stops[0].days[0].activities.map((a) => a.name);
    expect(names).toContain("Lunch Spot");
    expect(names).not.toContain("Another Restaurant");
    expect(result.issues.some((i) => /back-to-back restaurant/i.test(i))).toBe(true);
  });

  it("keeps a departure-city meal followed by an arrival-city meal far away (drive day)", () => {
    const it = itinerary([[
      activity({ name: "Departure Lunch", category: "food", time: "12:00 PM - 1:00 PM", coordinates: { latitude: 35.0, longitude: -85.3 } }),
      // ~200 km away — a different city across a drive. Legitimately adjacent in the list.
      activity({ name: "Arrival Dinner", category: "food", time: "6:00 PM - 7:30 PM", coordinates: { latitude: 35.72, longitude: -83.5 } }),
    ]]);

    const names = validateItinerary(it).itinerary.stops[0].days[0].activities.map((a) => a.name);
    expect(names).toContain("Departure Lunch");
    expect(names).toContain("Arrival Dinner");
  });

  it("does not drop a meal when a non-food activity separates the two", () => {
    const it = itinerary([[
      activity({ name: "Breakfast", category: "food", time: "8:00 AM - 9:00 AM", coordinates: { latitude: 35.0, longitude: -85.3 } }),
      activity({ name: "Museum", category: "culture", time: "9:30 AM - 11:30 AM", coordinates: { latitude: 35.001, longitude: -85.301 } }),
      activity({ name: "Lunch", category: "food", time: "12:00 PM - 1:00 PM", coordinates: { latitude: 35.002, longitude: -85.302 } }),
    ]]);

    const names = validateItinerary(it).itinerary.stops[0].days[0].activities.map((a) => a.name);
    expect(names).toEqual(["Breakfast", "Museum", "Lunch"]);
  });
});
