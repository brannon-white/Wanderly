import { cacheGet, cacheSet } from '@/utils/cache';

export interface LocationResult {
  id: string;
  name: string;
  state?: string;
  country: string;
  countryCode: string;
  flag: string;
  imageUrl: string | null;
  destinationType: 'city' | 'national_park' | 'region';
}

export interface SearchedDestination {
  id: string;
  name: string;
  state?: string;
  country: string;
  flag: string;
  imageUrl: string;
  gallery: string[];
  destinationType: 'city' | 'national_park' | 'region';
}

function toFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

// OSM place values we treat as cities/towns (Photon `osm_value`)
const PLACE_TYPES = new Set([
  'city', 'town', 'village', 'municipality', 'suburb', 'borough',
]);

// OSM values (on leisure/boundary keys) we treat as national parks / protected areas
const PARK_VALUES = new Set([
  'national_park', 'nature_reserve', 'protected_area',
]);

// Classify a Photon feature into one of our destination types, or null to skip
// it (streets, houses, shops, golf courses, etc.).
function classify(p: any): 'city' | 'national_park' | 'region' | null {
  const key = p.osm_key;
  const value = p.osm_value;

  if ((key === 'leisure' || key === 'boundary') && PARK_VALUES.has(value)) {
    return 'national_park';
  }
  if (key === 'place' && PLACE_TYPES.has(value)) return 'city';
  if (p.type === 'city') return 'city';
  if (p.type === 'state' || p.type === 'county') return 'region';
  return null;
}

async function fetchLocations(query: string): Promise<LocationResult[]> {
  // Photon (komoot) is an OSM-based geocoder built for typeahead — unlike
  // Nominatim's /search it does prefix matching, so partial names like
  // "olympic nation" surface "Olympic National Park" instead of nothing.
  const url =
    `https://photon.komoot.io/api/` +
    `?q=${encodeURIComponent(query)}` +
    `&limit=15&lang=en`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'WanderlyTravelApp/1.0' },
  });
  const data = await res.json();
  const features: any[] = data?.features ?? [];

  const results: LocationResult[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const p = feature.properties;
    if (!p?.name || !p?.country || !p?.countrycode) continue;

    const destinationType = classify(p);
    if (!destinationType) continue;

    const name: string = p.name;
    const state: string | undefined = p.state || undefined;
    const countryCode: string = p.countrycode.toLowerCase();
    const stateSlug = state ? `-${state.toLowerCase().replace(/\s+/g, '-')}` : '';

    // Replace spaces with hyphens so multi-word park names produce valid slugs
    const id = `${name.toLowerCase().replace(/\s+/g, '-')}${stateSlug}-${countryCode}`;
    if (seen.has(id)) continue;
    seen.add(id);

    results.push({
      id,
      name,
      state,
      country: p.country,
      countryCode: countryCode.toUpperCase(),
      flag: toFlag(countryCode),
      imageUrl: null,
      destinationType,
    });

    if (results.length === 6) break;
  }

  return results;
}

export async function searchLocations(query: string): Promise<LocationResult[]> {
  const key = `search:v3:${query.trim().toLowerCase()}`;
  const cached = await cacheGet<LocationResult[]>(key);
  if (cached) return cached;

  const results = await fetchLocations(query);
  if (results.length) await cacheSet(key, results, 1);
  return results;
}
