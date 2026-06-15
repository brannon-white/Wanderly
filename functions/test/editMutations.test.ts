import { describe, it, expect } from "vitest";
import { applyMutations, type ItineraryMutation } from "../src/itineraryGeneration";
import { getAllDays } from "../src/itinerarySchemas";
import { activity, itinerary } from "./fixtures";

function names(it: ReturnType<typeof itinerary>, dayIndex = 0): string[] {
  return getAllDays(it)[dayIndex].activities.map((a) => a.name);
}

describe("applyMutations", () => {
  it("replaces an activity in place", () => {
    const it = itinerary([[activity({ name: "Old" }), activity({ name: "Keep" })]]);
    const muts: ItineraryMutation[] = [
      { op: "replace_activity", dayIndex: 0, activityIndex: 0, activity: activity({ name: "New" }) },
    ];
    expect(names(applyMutations(it, muts))).toEqual(["New", "Keep"]);
  });

  it("preserves verified trail data when a replacement re-emits the same trail without it", () => {
    const it = itinerary([[
      activity({ name: "Eagle Creek Trail", category: "adventure", trailDistanceMiles: 6.1, trailDifficulty: "hard", trailDurationHours: 4 }),
    ]]);
    // The model returns the same trail (same name) but as a plain AI activity.
    const muts: ItineraryMutation[] = [
      { op: "replace_activity", dayIndex: 0, activityIndex: 0, activity: activity({ name: "Eagle Creek Trail", category: "adventure", time: "10:00 AM - 02:00 PM" }) },
    ];
    const out = getAllDays(applyMutations(it, muts))[0].activities[0];
    expect(out.trailDistanceMiles).toBe(6.1);
    expect(out.trailDifficulty).toBe("hard");
    expect(out.trailDurationHours).toBe(4);
    expect(out.time).toBe("10:00 AM - 02:00 PM"); // the new time still applies
  });

  it("does NOT carry trail data onto a genuinely different replacement venue", () => {
    const it = itinerary([[
      activity({ name: "Eagle Creek Trail", category: "adventure", trailDistanceMiles: 6.1, trailDifficulty: "hard", trailDurationHours: 4 }),
    ]]);
    const muts: ItineraryMutation[] = [
      { op: "replace_activity", dayIndex: 0, activityIndex: 0, activity: activity({ name: "Downtown Art Museum", category: "culture" }) },
    ];
    const out = getAllDays(applyMutations(it, muts))[0].activities[0];
    expect(out.trailDistanceMiles).toBeUndefined();
  });

  it("removes an activity", () => {
    const it = itinerary([[activity({ name: "A" }), activity({ name: "B" }), activity({ name: "C" })]]);
    const muts: ItineraryMutation[] = [{ op: "remove_activity", dayIndex: 0, activityIndex: 1 }];
    expect(names(applyMutations(it, muts))).toEqual(["A", "C"]);
  });

  it("reorders a day and never drops activities missing from newOrder", () => {
    const it = itinerary([[activity({ name: "A" }), activity({ name: "B" }), activity({ name: "C" })]]);
    // newOrder only mentions indices 2 and 0 — index 1 must be appended, not lost.
    const muts: ItineraryMutation[] = [{ op: "reorder_day", dayIndex: 0, newOrder: [2, 0] }];
    expect(names(applyMutations(it, muts))).toEqual(["C", "A", "B"]);
  });

  it("composes multiple mutations on the same day", () => {
    const it = itinerary([[activity({ name: "A" }), activity({ name: "B" })]]);
    const muts: ItineraryMutation[] = [
      { op: "replace_activity", dayIndex: 0, activityIndex: 0, activity: activity({ name: "A2" }) },
      { op: "remove_activity", dayIndex: 0, activityIndex: 1 },
    ];
    expect(names(applyMutations(it, muts))).toEqual(["A2"]);
  });

  it("drops mutations targeting a different day when scopeDayIndex is set (issue #2)", () => {
    const it = itinerary([
      [activity({ name: "D1-A" }), activity({ name: "D1-B" })],
      [activity({ name: "D2-A" }), activity({ name: "D2-B" })],
    ]);
    const muts: ItineraryMutation[] = [
      { op: "replace_activity", dayIndex: 0, activityIndex: 0, activity: activity({ name: "INTRUDER" }) },
      { op: "replace_activity", dayIndex: 1, activityIndex: 0, activity: activity({ name: "D2-A-NEW" }) },
    ];
    const out = applyMutations(it, muts, { scopeDayIndex: 1 });
    expect(names(out, 0)).toEqual(["D1-A", "D1-B"]);          // untouched
    expect(names(out, 1)).toEqual(["D2-A-NEW", "D2-B"]);      // only scoped day changed
  });

  it("force-scopes a misattributed mutation onto the viewed day instead of dropping it (chips/pills)", () => {
    // A "we're tired" chip while viewing day 1: the model emits the mutation for
    // day 0. editItineraryWithLanguage(forceScopeToDay) rewrites dayIndex to the
    // viewed day before applyMutations, so the action lands on day 1 (not a no-op).
    const it = itinerary([
      [activity({ name: "D1-A" }), activity({ name: "D1-B" })],
      [activity({ name: "D2-A" }), activity({ name: "D2-B" })],
    ]);
    const viewedDay = 1;
    const fromModel: ItineraryMutation[] = [
      { op: "remove_activity", dayIndex: 0, activityIndex: 1 },
    ];
    const dayScoped = fromModel.map((m) => ({ ...m, dayIndex: viewedDay }));
    const out = applyMutations(it, dayScoped, { scopeDayIndex: viewedDay });
    expect(names(out, 0)).toEqual(["D1-A", "D1-B"]);   // untouched
    expect(names(out, 1)).toEqual(["D2-A"]);           // viewed day changed
  });

  it("honours locked activity indices (optimize day)", () => {
    const it = itinerary([[activity({ name: "Locked" }), activity({ name: "Free" })]]);
    const muts: ItineraryMutation[] = [
      { op: "replace_activity", dayIndex: 0, activityIndex: 0, activity: activity({ name: "ShouldNotApply" }) },
      { op: "replace_activity", dayIndex: 0, activityIndex: 1, activity: activity({ name: "Applied" }) },
    ];
    const out = applyMutations(it, muts, { lockedActivityIndices: [0] });
    expect(names(out)).toEqual(["Locked", "Applied"]);
  });

  it("ignores mutations with out-of-range indices", () => {
    const it = itinerary([[activity({ name: "A" })]]);
    const muts: ItineraryMutation[] = [
      { op: "replace_activity", dayIndex: 0, activityIndex: 9, activity: activity({ name: "Nope" }) },
      { op: "remove_activity", dayIndex: 5, activityIndex: 0 },
    ];
    expect(names(applyMutations(it, muts))).toEqual(["A"]);
  });
});
