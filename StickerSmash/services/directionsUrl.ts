// Pure, platform-agnostic builder for turn-by-turn directions URLs.
// Kept free of any react-native imports so it can be unit-tested directly.
//
// Resolution precedence: place_id > place name > coordinates.
// The AI-generated lat/lng is frequently wrong (it's hallucinated, not from
// Google Places), so opening Maps with raw coords lands on a random address.
// The venue *name* is reliable, and a Google place_id resolves the exact venue,
// so we prefer those and only fall back to coordinates when nothing else exists.

export type DirectionsOS = 'ios' | 'android';

export interface DirectionsLocation {
  name: string;
  placeId?: string;
  coordinates?: { latitude: number; longitude: number };
  // City/state context (e.g. "Nashville, TN") appended to the name query so a
  // same-named venue in another state can't win. Critical when placeId is absent
  // (legacy/prebuilt itineraries, trail/unverified activities).
  locationContext?: string;
}

const TRANSIT_MODES = ['bus', 'train', 'subway', 'metro', 'ferry', 'boat'];

function appleDirFlag(mode: string): string {
  if (mode === 'walk') return 'w';
  if (mode === 'bicycle') return 'b';
  if (TRANSIT_MODES.includes(mode)) return 'r';
  return 'd'; // car, taxi, default
}

function googleTravelMode(mode: string): string {
  if (mode === 'walk') return 'walking';
  if (mode === 'bicycle') return 'bicycling';
  if (TRANSIT_MODES.includes(mode)) return 'transit';
  return 'driving';
}

// Address string used by Apple Maps and as the Google origin/destination query.
// Prefer the human-readable name (city-qualified when we have context); fall back
// to coords only when there's no name.
function addr(loc: DirectionsLocation): string {
  if (loc.name && loc.name.trim()) {
    const name = loc.name.trim();
    const ctx = loc.locationContext?.trim();
    // Don't double up if the name already contains the context city (compare on the
    // city token, e.g. "Nashville" from "Nashville, TN").
    const city = ctx?.split(',')[0]?.trim().toLowerCase();
    const qualified = ctx && city && !name.toLowerCase().includes(city)
      ? `${name}, ${ctx}`
      : name;
    return encodeURIComponent(qualified);
  }
  if (loc.coordinates) return `${loc.coordinates.latitude},${loc.coordinates.longitude}`;
  return '';
}

export function buildDirectionsUrlFor(
  os: DirectionsOS,
  from: DirectionsLocation,
  to: DirectionsLocation,
  transportMode: string,
): string {
  const mode = (transportMode || 'walk').toLowerCase();

  if (os === 'ios') {
    // Apple Maps has no place_id support — name (preferred) or coords.
    const saddr = addr(from);
    const daddr = addr(to);
    return `maps://?saddr=${saddr}&daddr=${daddr}&dirflg=${appleDirFlag(mode)}`;
  }

  // Google Maps Directions API (api=1). place_id resolves the exact venue.
  const params = new URLSearchParams({
    api: '1',
    origin: decodeURIComponent(addr(from)),
    destination: decodeURIComponent(addr(to)),
    travelmode: googleTravelMode(mode),
  });
  if (from.placeId) params.set('origin_place_id', from.placeId);
  if (to.placeId) params.set('destination_place_id', to.placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
