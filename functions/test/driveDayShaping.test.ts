import { describe, it, expect } from "vitest";
import { shapeDriveDays } from "../src/orchestration/driveDayShaping";
import type { GeneratedItinerary } from "../src/itinerarySchemas";
import type { StopPool, PlaceCandidate, StopCandidatePool } from "../src/orchestration/types";
import { activity } from "./fixtures";

// Departure city ≈ Portland; arrival city ≈ Bend (~200 km away).
const PORTLAND = { lat: 45.52, lng: -122.68 };
const BEND = { lat: 44.06, lng: -121.31 };

function cand(name: string, c: { lat: number; lng: number }, i: number): PlaceCandidate {
  return {
    placeId: `places/${name}-${i}`,
    name,
    address: "1 Main St",
    coordinates: c,
    rating: 4.5,
    reviewCount: 300,
    priceLevel: 2,
    types: [],
    category: "restaurant",
  };
}

function pool(location: string, center: { lat: number; lng: number }, stopIndex: number, isFirst: boolean, isLast: boolean): StopPool {
  const candidates: StopCandidatePool = {
    breakfast: [cand(`${location}-bfast`, center, 1)],
    food: [cand(`${location}-dinner`, center, 1), cand(`${location}-dinner`, center, 2)],
    nightlife: [],
    attractions: [cand(`${location}-sight`, center, 1)],
    scenic: [],
  };
  return { location, nightCount: 1, stopIndex, isFirstStop: isFirst, isLastStop: isLast, candidates, trails: [] };
}

// Two-stop trip: stop 0 (Portland, 1 day) → stop 1 (Bend, 1 day).
function twoStopTrip(driveDayActivities: any[]): GeneratedItinerary {
  return {
    id: "t", title: "RT", subtitle: "", destinationId: "d", destinationName: "Portland, Oregon",
    heroImage: "", source: "ai_generated", tripType: "route",
    stops: [
      {
        stopIndex: 0, location: "Portland, Oregon",
        overnightAnchor: { location: "Portland, Oregon", overnightType: "unknown" },
        days: [{ label: "Day 1", title: "Day 1", activities: driveDayActivities }],
      },
      {
        stopIndex: 1, location: "Bend, Oregon",
        overnightAnchor: { location: "Bend, Oregon", overnightType: "unknown" },
        days: [{ label: "Day 2", title: "Day 2", activities: [activity({ name: "Bend Morning" })] }],
      },
    ],
  };
}

const pools: StopPool[] = [
  pool("Portland", PORTLAND, 0, true, false),
  pool("Bend", BEND, 1, false, true),
];

describe("shapeDriveDays", () => {
  it("marks the last day of a non-final stop as a drive day and leaves the final stop alone", () => {
    const trip = twoStopTrip([
      activity({ name: "PDX Breakfast", category: "food", coordinates: { latitude: PORTLAND.lat, longitude: PORTLAND.lng } }),
      activity({ name: "PDX Lunch", category: "food", coordinates: { latitude: PORTLAND.lat, longitude: PORTLAND.lng } }),
    ]);
    const out = shapeDriveDays(trip, pools);
    expect(out.stops[0].days[0].isDriveDay).toBe(true);
    expect(out.stops[1].days[0].isDriveDay).toBeFalsy();
  });

  it("appends a real arrival-city dinner when the drive day has none near the destination", () => {
    const trip = twoStopTrip([
      activity({ name: "PDX Breakfast", category: "food", coordinates: { latitude: PORTLAND.lat, longitude: PORTLAND.lng } }),
      activity({ name: "PDX Lunch", category: "food", coordinates: { latitude: PORTLAND.lat, longitude: PORTLAND.lng } }),
    ]);
    const out = shapeDriveDays(trip, pools);
    const acts = out.stops[0].days[0].activities;
    const last = acts[acts.length - 1];
    expect(last.category).toBe("food");
    expect(last.name).toBe("Bend-dinner");
    // Dinner sits in the arrival city, not the departure city.
    expect(last.coordinates?.latitude).toBeCloseTo(BEND.lat, 1);
    // The leg leading into it is marked as the drive.
    expect(acts[acts.length - 2].transport?.[0]?.mode).toBe("car");
  });

  it("does not add a second dinner when the day already ends in the arrival city", () => {
    const trip = twoStopTrip([
      activity({ name: "PDX Breakfast", category: "food", coordinates: { latitude: PORTLAND.lat, longitude: PORTLAND.lng } }),
      activity({ name: "PDX Lunch", category: "food", coordinates: { latitude: PORTLAND.lat, longitude: PORTLAND.lng } }),
      activity({ name: "Bend Dinner", category: "food", coordinates: { latitude: BEND.lat, longitude: BEND.lng } }),
    ]);
    const out = shapeDriveDays(trip, pools);
    const foodCount = out.stops[0].days[0].activities.filter((a) => a.category === "food").length;
    expect(foodCount).toBe(3); // unchanged — already had an arrival-city dinner
  });

  it("is a no-op for single-stop (hub) trips", () => {
    const hub: GeneratedItinerary = {
      id: "h", title: "Hub", subtitle: "", destinationId: "d", destinationName: "Portland",
      heroImage: "", source: "ai_generated", tripType: "hub",
      stops: [{
        stopIndex: 0, location: "Portland",
        overnightAnchor: { location: "Portland", overnightType: "unknown" },
        days: [{ label: "Day 1", title: "Day 1", activities: [activity({ name: "X" })] }],
      }],
    };
    expect(shapeDriveDays(hub, [pools[0]])).toBe(hub);
  });
});
