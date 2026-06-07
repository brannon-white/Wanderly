import { describe, it, expect } from "vitest";
import { extractSeedDays } from "../src/orchestration/tripPlanning";

// extractSeedDays turns a prebuilt itinerary Firestore doc into the per-day seed the
// generation pipeline expands. It must flatten stops→days, keep only the prompt-
// relevant fields, and degrade gracefully on malformed input (so a bad seed falls
// back to a normal generation instead of throwing).
describe("extractSeedDays", () => {
  it("flattens stops→days→activities into per-day seeds", () => {
    const doc = {
      stops: [
        {
          days: [
            {
              label: "Day 1",
              title: "Arrival",
              activities: [
                { name: "Breakfast Cafe", category: "food", time: "08:00 AM - 09:00 AM", description: "Cozy" },
                { name: "Museum", category: "culture", time: "10:00 AM - 12:00 PM" },
              ],
            },
            { label: "Day 2", title: "Coast", activities: [{ name: "Beach", category: "nature" }] },
          ],
        },
      ],
    };

    const seed = extractSeedDays(doc);
    expect(seed).toHaveLength(2);
    expect(seed[0].title).toBe("Arrival");
    expect(seed[0].activities).toEqual([
      { name: "Breakfast Cafe", category: "food", time: "08:00 AM - 09:00 AM", description: "Cozy" },
      { name: "Museum", category: "culture", time: "10:00 AM - 12:00 PM", description: undefined },
    ]);
    expect(seed[1].activities).toHaveLength(1);
  });

  it("flattens across multiple stops in order", () => {
    const doc = {
      stops: [
        { days: [{ label: "Day 1", activities: [{ name: "A" }] }] },
        { days: [{ label: "Day 2", activities: [{ name: "B" }] }] },
      ],
    };
    const seed = extractSeedDays(doc);
    expect(seed.map((d) => d.activities[0].name)).toEqual(["A", "B"]);
  });

  it("returns [] for missing / malformed docs", () => {
    expect(extractSeedDays(undefined)).toEqual([]);
    expect(extractSeedDays(null)).toEqual([]);
    expect(extractSeedDays({})).toEqual([]);
    expect(extractSeedDays({ stops: "nope" } as any)).toEqual([]);
  });

  it("tolerates days with no activities array", () => {
    const seed = extractSeedDays({ stops: [{ days: [{ label: "Day 1" }] }] });
    expect(seed).toEqual([{ label: "Day 1", title: undefined, activities: [] }]);
  });
});
