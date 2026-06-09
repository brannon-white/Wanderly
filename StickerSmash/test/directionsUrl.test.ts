import { describe, it, expect } from "vitest";
import { buildDirectionsUrlFor, type DirectionsLocation } from "../services/directionsUrl";

const jordans: DirectionsLocation = {
  name: "Jordan's Bakery",
  placeId: "PLACE_FROM",
  coordinates: { latitude: 45.5, longitude: -122.6 },
};
const powells: DirectionsLocation = {
  name: "Powell's Books",
  placeId: "PLACE_TO",
  coordinates: { latitude: 45.52, longitude: -122.68 },
};

describe("buildDirectionsUrlFor — Android (Google Maps)", () => {
  it("uses place names (not raw coords) as origin/destination — the core fix for issue #1", () => {
    const url = buildDirectionsUrlFor("android", jordans, powells, "walk");
    expect(url).toContain("origin=Jordan");
    expect(url).toContain("destination=Powell");
    // Must NOT fall back to the hallucinated coordinates when a name exists.
    expect(url).not.toContain("45.5");
  });

  it("includes place_id when available so Maps opens the exact venue", () => {
    const url = buildDirectionsUrlFor("android", jordans, powells, "walk");
    expect(url).toContain("origin_place_id=PLACE_FROM");
    expect(url).toContain("destination_place_id=PLACE_TO");
  });

  it("maps transport modes to Google travelmode values", () => {
    expect(buildDirectionsUrlFor("android", jordans, powells, "walk")).toContain("travelmode=walking");
    expect(buildDirectionsUrlFor("android", jordans, powells, "car")).toContain("travelmode=driving");
    expect(buildDirectionsUrlFor("android", jordans, powells, "train")).toContain("travelmode=transit");
    expect(buildDirectionsUrlFor("android", jordans, powells, "bicycle")).toContain("travelmode=bicycling");
  });

  it("falls back to coordinates only when no name is present", () => {
    const noName: DirectionsLocation = { name: "", coordinates: { latitude: 10, longitude: 20 } };
    const url = buildDirectionsUrlFor("android", noName, powells, "walk");
    expect(url).toContain("origin=10%2C20");
  });

  it("city-qualifies the name query so a same-named venue elsewhere can't win (issue: wrong state)", () => {
    const orchids: DirectionsLocation = { name: "Orchids Lounge", locationContext: "Nashville, TN" };
    const url = buildDirectionsUrlFor("android", orchids, powells, "walk");
    // Encoded "Orchids Lounge, Nashville, TN"
    expect(url).toContain("Orchids+Lounge%2C+Nashville%2C+TN");
  });

  it("does not double up when the name already includes the context city", () => {
    const loc: DirectionsLocation = { name: "Nashville Farmers Market", locationContext: "Nashville, TN" };
    const url = buildDirectionsUrlFor("android", loc, powells, "walk");
    expect(url).not.toContain("Nashville+Farmers+Market%2C+Nashville");
  });

  it("place_id still takes precedence regardless of context", () => {
    const orchids: DirectionsLocation = { name: "Orchids Lounge", placeId: "PLACE_X", locationContext: "Nashville, TN" };
    const url = buildDirectionsUrlFor("android", orchids, powells, "walk");
    expect(url).toContain("origin_place_id=PLACE_X");
  });
});

describe("buildDirectionsUrlFor — iOS (Apple Maps)", () => {
  it("uses the place name and the right dirflg", () => {
    const url = buildDirectionsUrlFor("ios", jordans, powells, "walk");
    expect(url.startsWith("maps://")).toBe(true);
    expect(url).toContain("saddr=Jordan");
    expect(url).toContain("daddr=Powell");
    expect(url).toContain("dirflg=w");
  });

  it("maps drive/transit to Apple dirflg values", () => {
    expect(buildDirectionsUrlFor("ios", jordans, powells, "car")).toContain("dirflg=d");
    expect(buildDirectionsUrlFor("ios", jordans, powells, "bus")).toContain("dirflg=r");
  });
});
