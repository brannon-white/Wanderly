import { type RankedPlace, type PlaceCluster } from "./types";

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const val =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
}

function centroid(places: RankedPlace[]): { lat: number; lng: number } {
  const lat = places.reduce((s, p) => s + p.coordinates.lat, 0) / places.length;
  const lng = places.reduce((s, p) => s + p.coordinates.lng, 0) / places.length;
  return { lat, lng };
}

function kMeans(places: RankedPlace[], k: number, iterations = 15): RankedPlace[][] {
  if (places.length <= k) {
    return places.map((p) => [p]);
  }

  // Seed centers using spread-out high-scoring places
  const step = Math.max(1, Math.floor(places.length / k));
  let centers = places
    .filter((_, i) => i % step === 0)
    .slice(0, k)
    .map((p) => ({ ...p.coordinates }));

  let clusters: RankedPlace[][] = [];

  for (let iter = 0; iter < iterations; iter++) {
    clusters = Array.from({ length: centers.length }, () => [] as RankedPlace[]);

    for (const place of places) {
      let minDist = Infinity;
      let closest = 0;
      for (let j = 0; j < centers.length; j++) {
        const d = haversineKm(place.coordinates, centers[j]);
        if (d < minDist) {
          minDist = d;
          closest = j;
        }
      }
      clusters[closest].push(place);
    }

    // Recompute centers; keep old center if cluster is empty
    centers = clusters.map((cl, j) =>
      cl.length > 0 ? centroid(cl) : centers[j]
    );
  }

  return clusters.filter((c) => c.length > 0);
}

export function clusterRecommendations(
  ranked: RankedPlace[],
  numDays: number,
  dayThemes: string[]
): PlaceCluster[] {
  if (ranked.length === 0) return [];

  const clusters = kMeans(ranked, numDays);

  // Sort clusters roughly west-to-east (longitude ascending) so day order feels geographic
  const sorted = clusters
    .map((places) => ({ places, center: centroid(places) }))
    .sort((a, b) => a.center.lng - b.center.lng);

  return sorted.map(({ places, center }, i) => ({
    dayIndex: i,
    // Give Claude the top 14 per cluster to choose from
    places: places.slice(0, 14),
    centerLat: center.lat,
    centerLng: center.lng,
    neighborhood: dayThemes[i],
  }));
}
