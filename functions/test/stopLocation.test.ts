import { describe, it, expect } from "vitest";
import { stopLocationForDayIndex } from "../src/itineraryGeneration";
import { activity } from "./fixtures";
import type { GeneratedItinerary } from "../src/itinerarySchemas";

// A multi-stop road trip: stop 0 has 2 days, stop 1 has 3 days, stop 2 has 1 day.
// Global day indices therefore map: 0-1 → stop0, 2-4 → stop1, 5 → stop2.
function roadTrip(): GeneratedItinerary {
  const day = (n: string) => ({ label: n, title: n, activities: [activity({ name: n })] });
  const stop = (i: number, location: string, n: number) => ({
    stopIndex: i,
    location,
    overnightAnchor: { location, overnightType: "unknown" as const },
    days: Array.from({ length: n }, (_, d) => day(`${location}-${d}`)),
  });
  return {
    id: "rt",
    title: "Road Trip",
    subtitle: "",
    destinationId: "d",
    destinationName: "San Francisco", // trip-level name = first/overall city
    heroImage: "",
    source: "ai_generated",
    tripType: "route",
    stops: [stop(0, "San Francisco", 2), stop(1, "Las Vegas", 3), stop(2, "Zion", 1)],
  };
}

describe("stopLocationForDayIndex", () => {
  const it_ = roadTrip();

  it("maps each global day index to its own stop's location", () => {
    expect(stopLocationForDayIndex(it_, 0)).toBe("San Francisco");
    expect(stopLocationForDayIndex(it_, 1)).toBe("San Francisco");
    expect(stopLocationForDayIndex(it_, 2)).toBe("Las Vegas");
    expect(stopLocationForDayIndex(it_, 4)).toBe("Las Vegas");
    expect(stopLocationForDayIndex(it_, 5)).toBe("Zion");
  });

  it("does not collapse later days onto the first/overall city", () => {
    // The bug class: refinements on a non-first stop resolving to destinationName.
    expect(stopLocationForDayIndex(it_, 3)).not.toBe(it_.destinationName);
  });

  it("falls back to destinationName for an out-of-range index", () => {
    expect(stopLocationForDayIndex(it_, 99)).toBe("San Francisco");
  });
});
