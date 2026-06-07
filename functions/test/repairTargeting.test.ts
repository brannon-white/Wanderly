import { describe, it, expect } from "vitest";
import { parseAffectedDayNumbers } from "../src/orchestration/tripPlanning";

// The day-scoped repair pass only re-plans the days validation actually flagged.
// It finds those days by parsing the "Day N:" prefix off each fatal issue string,
// so this parser is the contract between validation output and repair targeting.
describe("parseAffectedDayNumbers", () => {
  it("extracts distinct day numbers from validation issue strings", () => {
    const issues = [
      "Day 1: missing dinner in the 18:00–21:00 window",
      "Day 3: missing dinner in the 18:00–21:00 window",
      "Day 1: outdoor activity \"X\" starts after 3:00 PM",
      "Day 7: missing breakfast in the 07:30–10:00 window",
    ];
    expect(parseAffectedDayNumbers(issues)).toEqual([1, 3, 7]);
  });

  it("returns sorted, de-duplicated day numbers", () => {
    expect(parseAffectedDayNumbers(["Day 5: a", "Day 2: b", "Day 5: c"])).toEqual([2, 5]);
  });

  it("ignores issues with no day prefix (e.g. trip-level problems)", () => {
    const issues = [
      "Itinerary has no stops",
      "Day 2: missing lunch in the 11:30–14:30 window",
    ];
    expect(parseAffectedDayNumbers(issues)).toEqual([2]);
  });

  it("returns an empty array when nothing is day-scoped", () => {
    expect(parseAffectedDayNumbers([])).toEqual([]);
    expect(parseAffectedDayNumbers(["Some global failure"])).toEqual([]);
  });
});
