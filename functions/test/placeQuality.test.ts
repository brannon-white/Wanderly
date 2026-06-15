import { describe, it, expect } from "vitest";
import { isJunkVenue } from "../src/orchestration/placeQuality";

describe("isJunkVenue", () => {
  it("rejects a dollar/discount store with no experience type", () => {
    expect(isJunkVenue(["discount_store", "store", "point_of_interest", "establishment"])).toBe(true);
  });

  it("rejects gas stations, banks, pharmacies, gyms", () => {
    expect(isJunkVenue(["gas_station"])).toBe(true);
    expect(isJunkVenue(["bank", "finance"])).toBe(true);
    expect(isJunkVenue(["pharmacy", "drugstore", "store"])).toBe(true);
    expect(isJunkVenue(["gym", "fitness_center"])).toBe(true);
  });

  it("keeps real attractions, restaurants, parks, and markets", () => {
    expect(isJunkVenue(["tourist_attraction", "point_of_interest"])).toBe(false);
    expect(isJunkVenue(["restaurant", "food"])).toBe(false);
    expect(isJunkVenue(["park"])).toBe(false);
    // A market that is also a "store" is still a real experience.
    expect(isJunkVenue(["market", "store"])).toBe(false);
  });

  it("is permissive when types are missing", () => {
    expect(isJunkVenue(undefined)).toBe(false);
    expect(isJunkVenue([])).toBe(false);
  });
});
