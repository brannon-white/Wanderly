import { describe, it, expect } from "vitest";
import { decodePolyline, regionForPoints } from "../utils/polyline";

describe("decodePolyline", () => {
  it("decodes the canonical Google example polyline", () => {
    // From Google's polyline algorithm docs: "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});

describe("regionForPoints", () => {
  it("returns a center + padded deltas covering all points", () => {
    const region = regionForPoints([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 43.252, longitude: -126.453 },
    ])!;
    expect(region.latitude).toBeCloseTo(40.876, 2);
    expect(region.longitude).toBeCloseTo(-123.3265, 2);
    expect(region.latitudeDelta).toBeGreaterThan(43.252 - 38.5);
    expect(region.longitudeDelta).toBeGreaterThan(126.453 - 120.2);
  });

  it("returns null for no points", () => {
    expect(regionForPoints([])).toBeNull();
  });
});
