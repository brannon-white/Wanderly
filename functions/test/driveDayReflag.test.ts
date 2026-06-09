import { describe, it, expect } from "vitest";
import { reflagDriveDays, relabelDays } from "../src/orchestration/driveDayShaping";
import type { GeneratedItinerary } from "../src/itinerarySchemas";
import { activity } from "./fixtures";

// A 3-stop route trip: stop A (2 days), stop B (1 day), stop C (1 day).
function routeTrip(): GeneratedItinerary {
  const mk = (label: string, acts = 2) => ({
    label,
    title: label,
    activities: Array.from({ length: acts }, (_, i) =>
      activity({ name: `${label}-${i}`, time: i === 0 ? "9:00 AM - 11:00 AM" : "12:00 PM - 1:30 PM", category: i === acts - 1 ? "food" : "attraction" }),
    ),
  });
  return {
    id: "t", title: "T", subtitle: "S", destinationId: "d", destinationName: "A",
    heroImage: "", source: "ai_generated", tripType: "route",
    stops: [
      { stopIndex: 0, location: "A City", overnightAnchor: { location: "A City", overnightType: "unknown" }, days: [mk("Day 1"), mk("Day 2")] },
      { stopIndex: 1, location: "B City", overnightAnchor: { location: "B City", overnightType: "unknown" }, days: [mk("Day 3")] },
      { stopIndex: 2, location: "C City", overnightAnchor: { location: "C City", overnightType: "unknown" }, days: [mk("Day 4")] },
    ],
  };
}

describe("reflagDriveDays", () => {
  it("marks the last day of every non-final stop as a drive day with a from/to skeleton", () => {
    const out = reflagDriveDays(routeTrip());
    // Stop A: day 0 not a drive, day 1 (last) is the drive to B
    expect(out.stops[0].days[0].isDriveDay).toBeFalsy();
    expect(out.stops[0].days[1].isDriveDay).toBe(true);
    expect(out.stops[0].days[1].drive?.fromLocation).toBe("A City");
    expect(out.stops[0].days[1].drive?.toLocation).toBe("B City");
    // Stop B: its only day is the last → drive to C
    expect(out.stops[1].days[0].isDriveDay).toBe(true);
    expect(out.stops[1].days[0].drive?.toLocation).toBe("C City");
    // Stop C is final → never a drive day
    expect(out.stops[2].days[0].isDriveDay).toBeFalsy();
    expect(out.stops[2].days[0].drive).toBeUndefined();
  });

  it("clears stale drive flags/data on days that are no longer the last of a stop", () => {
    const trip = routeTrip();
    // Pretend an old flag sits on the first day of stop A
    trip.stops[0].days[0].isDriveDay = true;
    trip.stops[0].days[0].drive = { fromLocation: "stale", toLocation: "stale" };
    const out = reflagDriveDays(trip);
    expect(out.stops[0].days[0].isDriveDay).toBe(false);
    expect(out.stops[0].days[0].drive).toBeUndefined();
  });

  it("sets leave time to the end of the drive day's last activity (arrival is next day)", () => {
    const out = reflagDriveDays(routeTrip());
    const drive = out.stops[0].days[1].drive!;
    // Last activity on the drive day is "12:00 PM - 1:30 PM" → leave at 1:30 PM.
    expect(drive.departTime).toBe("1:30 PM");
    // arriveTime is filled later by enrichDriveLegs (needs the API duration), not here.
    expect(drive.arriveTime).toBeUndefined();
  });
});

describe("relabelDays", () => {
  it("renumbers day labels sequentially across all stops and fixes stopIndex", () => {
    // Drop stop B to simulate a removal, then relabel.
    const trip = routeTrip();
    trip.stops = [trip.stops[0], trip.stops[2]];
    const out = relabelDays(trip);
    expect(out.stops.map((s) => s.stopIndex)).toEqual([0, 1]);
    expect(out.stops.flatMap((s) => s.days.map((d) => d.label))).toEqual(["Day 1", "Day 2", "Day 3"]);
  });
});

import { pruneStaleDriveDayActivities } from "../src/orchestration/stopRework";

describe("pruneStaleDriveDayActivities", () => {
  // Stop A drive day holds A-city activities + a stale OLD-city activity; stop B is the
  // (new) arrival city. The stale one (near neither A nor B) should be dropped.
  function trip(): GeneratedItinerary {
    const at = (name: string, lat: number, lng: number) => activity({ name, coordinates: { latitude: lat, longitude: lng } });
    return {
      id: "t", title: "T", subtitle: "S", destinationId: "d", destinationName: "A",
      heroImage: "", source: "ai_generated", tripType: "route",
      stops: [
        {
          stopIndex: 0, location: "A City",
          overnightAnchor: { location: "A City", overnightType: "unknown", coordinates: { latitude: 35.05, longitude: -85.30 } },
          days: [
            { label: "Day 1", activities: [at("A-day1", 35.04, -85.30)] },
            { label: "Day 2", isDriveDay: true, activities: [
              at("A-morning", 35.05, -85.31),     // departing city → keep
              at("OLD-city", 35.24, -85.83),       // stale (Monteagle, swapped out) → drop
              at("B-arrival", 35.95, -83.92),      // new arrival city (near B) → keep
            ] },
          ],
        },
        {
          stopIndex: 1, location: "B City",
          overnightAnchor: { location: "B City", overnightType: "unknown", coordinates: { latitude: 35.96, longitude: -83.92 } },
          days: [{ label: "Day 3", activities: [at("B-day1", 35.96, -83.93)] }],
        },
      ],
    };
  }

  it("drops drive-day activities near neither the own stop nor the next stop", () => {
    const out = pruneStaleDriveDayActivities(trip());
    const names = out.stops[0].days[1].activities.map((a) => a.name);
    expect(names).toContain("A-morning");
    expect(names).toContain("B-arrival");
    expect(names).not.toContain("OLD-city");
  });

  it("leaves a clean trip untouched", () => {
    const t = trip();
    // Remove the stale one so nothing should change.
    t.stops[0].days[1].activities = t.stops[0].days[1].activities.filter((a) => a.name !== "OLD-city");
    const out = pruneStaleDriveDayActivities(t);
    expect(out.stops[0].days[1].activities.map((a) => a.name)).toEqual(["A-morning", "B-arrival"]);
  });
});
