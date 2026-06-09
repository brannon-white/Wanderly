// Decodes a Google "encoded polyline" string into lat/lng points.
// Standard algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
// Used to draw the inter-city route line on the drive-day map preview.
export function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  if (!encoded) return [];
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

// Region (center + deltas) that fits all the given points, with a little padding.
export function regionForPoints(
  points: { latitude: number; longitude: number }[],
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null {
  if (points.length === 0) return null;
  let minLat = points[0].latitude, maxLat = points[0].latitude;
  let minLng = points[0].longitude, maxLng = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  const latPad = Math.max((maxLat - minLat) * 0.3, 0.05);
  const lngPad = Math.max((maxLng - minLng) * 0.3, 0.05);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) + latPad,
    longitudeDelta: (maxLng - minLng) + lngPad,
  };
}
