import { describe, it, expect } from "vitest";
import {
  isOriginStop,
  anchorOriginFirst,
  normalizeNights,
  paceGuidance,
} from "../src/orchestration/tripPlanning";
import type { StopPlan } from "../src/orchestration/contextBuilder";

// A multi-stop road trip the user starts from a city must OPEN in that city and
// fan outward. These pure helpers are the enforcement behind that guarantee, so the
// planner can never hand back the Chattanooga→Knoxville-first mess that prompted this.

describe("isOriginStop", () => {
  it("matches on the bare city token regardless of state suffix", () => {
    expect(isOriginStop("Chattanooga, TN", "Chattanooga")).toBe(true);
    expect(isOriginStop("Chattanooga", "Chattanooga, Tennessee")).toBe(true);
    expect(isOriginStop("chattanooga, tennessee", "Chattanooga")).toBe(true);
  });

  it("does not match a different city", () => {
    expect(isOriginStop("Knoxville, TN", "Chattanooga")).toBe(false);
  });
});

describe("anchorOriginFirst", () => {
  it("moves the origin to the front when the model buried it at the end", () => {
    const stops: StopPlan[] = [
      { location: "Knoxville, TN", nightCount: 4 },
      { location: "Chattanooga, TN", nightCount: 1 },
    ];
    const out = anchorOriginFirst(stops, "Chattanooga");
    expect(out.map((s) => s.location)).toEqual(["Chattanooga, TN", "Knoxville, TN"]);
  });

  it("prepends the origin when it is missing entirely", () => {
    const stops: StopPlan[] = [
      { location: "Knoxville, TN", nightCount: 2 },
      { location: "Gatlinburg, TN", nightCount: 2 },
    ];
    const out = anchorOriginFirst(stops, "Chattanooga");
    expect(out[0].location).toBe("Chattanooga");
    expect(out.length).toBe(3);
  });

  it("leaves the route untouched when the origin is already first", () => {
    const stops: StopPlan[] = [
      { location: "Chattanooga, TN", nightCount: 2 },
      { location: "Knoxville, TN", nightCount: 2 },
    ];
    expect(anchorOriginFirst(stops, "Chattanooga")).toEqual(stops);
  });
});

describe("normalizeNights", () => {
  it("makes nights sum to the trip duration by padding the last stop", () => {
    const stops: StopPlan[] = [
      { location: "A", nightCount: 1 },
      { location: "B", nightCount: 1 },
    ];
    const out = normalizeNights(stops, 5);
    expect(out.reduce((n, s) => n + s.nightCount, 0)).toBe(5);
    expect(out[out.length - 1].nightCount).toBe(4);
  });

  it("trims excess nights from the back, never below 1 per stop", () => {
    const stops: StopPlan[] = [
      { location: "A", nightCount: 3 },
      { location: "B", nightCount: 3 },
    ];
    const out = normalizeNights(stops, 3);
    expect(out.reduce((n, s) => n + s.nightCount, 0)).toBe(3);
    expect(out.every((s) => s.nightCount >= 1)).toBe(true);
  });

  it("drops trailing stops when there are more stops than nights", () => {
    const stops: StopPlan[] = [
      { location: "A", nightCount: 1 },
      { location: "B", nightCount: 1 },
      { location: "C", nightCount: 1 },
    ];
    const out = normalizeNights(stops, 2);
    expect(out.map((s) => s.location)).toEqual(["A", "B"]);
    expect(out.reduce((n, s) => n + s.nightCount, 0)).toBe(2);
  });

  it("keeps the origin (first stop) even when the model over-stops a short trip", () => {
    const stops: StopPlan[] = [
      { location: "Chattanooga", nightCount: 1 },
      { location: "Knoxville", nightCount: 1 },
      { location: "Gatlinburg", nightCount: 1 },
    ];
    const out = normalizeNights(stops, 1);
    expect(out.map((s) => s.location)).toEqual(["Chattanooga"]);
    expect(out[0].nightCount).toBe(1);
  });
});

describe("paceGuidance", () => {
  it("every_night targets one stop per night", () => {
    expect(paceGuidance("every_night", 5).targetStops).toBe(5);
  });

  it("every_night caps the stop count at 8 for long trips", () => {
    expect(paceGuidance("every_night", 12).targetStops).toBe(8);
  });

  it("few_stops stays in the 2–3 range", () => {
    expect(paceGuidance("few_stops", 7).targetStops).toBe(3);
    expect(paceGuidance("few_stops", 2).targetStops).toBe(2);
  });

  it("every_few_days plans roughly one stop per 3 nights", () => {
    expect(paceGuidance("every_few_days", 9).targetStops).toBe(3);
  });
});

// End-to-end of the post-processing the way planStops applies it: anchor the origin,
// then normalize nights. This is the exact transform a bad model response goes through.
describe("origin-anchoring + night normalization (combined)", () => {
  it("repairs the real Chattanooga bug: origin-last, wrong pacing → origin-first, balanced", () => {
    const modelOutput: StopPlan[] = [
      { location: "Knoxville, TN", nightCount: 4 },
      { location: "Chattanooga, TN", nightCount: 1 },
    ];
    const out = normalizeNights(anchorOriginFirst(modelOutput, "Chattanooga"), 5);
    expect(out[0].location).toBe("Chattanooga, TN");
    expect(out.reduce((n, s) => n + s.nightCount, 0)).toBe(5);
  });
});
