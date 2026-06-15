import { describe, it, expect } from "vitest";
import { reflowDaySchedule } from "../src/orchestration/directions";
import { activity, itinerary } from "./fixtures";

function parse(t: string) {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)!;
  const toMin = (h: number, mn: number, ap: string) => {
    let hh = h; if (ap.toUpperCase() === "PM" && h !== 12) hh += 12; if (ap.toUpperCase() === "AM" && h === 12) hh = 0;
    return hh * 60 + mn;
  };
  return {
    start: toMin(+m[1], +m[2], m[3]),
    end: toMin(+m[4], +m[5], m[6]),
  };
}

describe("reflowDaySchedule", () => {
  it("removes overlaps and spaces activities by their transport leg time", () => {
    const it = itinerary([[
      activity({ name: "A", time: "09:00 AM - 11:00 AM", transport: [{ mode: "walk", time: "15 min" }] }),
      // Overlapping with A and far too tight against the trail that follows.
      activity({ name: "B (trail)", category: "adventure", time: "10:30 AM - 02:30 PM", transport: [{ mode: "car", time: "30 min" }] }),
      activity({ name: "C", time: "02:00 PM - 03:00 PM", transport: [] }),
    ]]);

    const out = reflowDaySchedule(it, 0);
    const acts = out.stops[0].days[0].activities;
    const a = parse(acts[0].time), b = parse(acts[1].time), c = parse(acts[2].time);

    // First activity keeps its original 9:00 AM start.
    expect(a.start).toBe(9 * 60);
    // No overlaps, and each gap respects the leg time (15 min, then 30 min).
    expect(b.start).toBe(a.end + 15);
    expect(c.start).toBe(b.end + 30);
    // Content/order is untouched — only the clock changed.
    expect(acts.map((x) => x.name)).toEqual(["A", "B (trail)", "C"]);
  });

  it("preserves every activity's data (e.g. trail metadata) — it only re-times", () => {
    const it = itinerary([[
      activity({ name: "Trailhead", category: "adventure", time: "09:00 AM - 12:00 PM", trailDistanceMiles: 5.2, trailDifficulty: "moderate", trailDurationHours: 3, transport: [{ mode: "walk", time: "10 min" }] }),
      activity({ name: "Lunch", category: "food", time: "11:30 AM - 12:30 PM", transport: [] }),
    ]]);

    const trail = reflowDaySchedule(it, 0).stops[0].days[0].activities[0];
    expect(trail.trailDistanceMiles).toBe(5.2);
    expect(trail.trailDifficulty).toBe("moderate");
    expect(trail.trailDurationHours).toBe(3);
  });
});
