import { cacheGet, cacheSet } from '@/utils/cache';

export interface LocationResult {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  flag: string;
  imageUrl: string | null;
  destinationType: 'city' | 'national_park';
}

export interface SearchedDestination {
  id: string;
  name: string;
  country: string;
  flag: string;
  imageUrl: string;
  gallery: string[];
  destinationType: 'city' | 'national_park';
}

function toFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

const PLACE_TYPES = new Set([
  'city', 'town', 'village', 'municipality', 'suburb', 'borough',
]);

async function fetchLocations(query: string): Promise<LocationResult[]> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&addressdetails=1&limit=10&accept-language=en`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'WanderlyTravelApp/1.0' },
  });
  const data: any[] = await res.json();

  const results: LocationResult[] = [];
  const seen = new Set<string>();

  for (const item of data) {
    const addr = item.address;
    if (!addr?.country || !addr?.country_code) continue;

    const isNationalPark =
      (item.class === 'boundary' && item.type === 'national_park') ||
      (item.class === 'leisure' && item.type === 'nature_reserve' && Number(item.importance ?? 0) > 0.4);

    const isPlace = item.class === 'place' && PLACE_TYPES.has(item.type);
    const isBoundary = item.class === 'boundary' &&
      (item.type === 'administrative' || item.type === 'national_park');
    const isLeisurePark = item.class === 'leisure' && item.type === 'nature_reserve';

    if (!isPlace && !isBoundary && !isLeisurePark) continue;

    const cityName =
      addr.city || addr.town || addr.village || addr.municipality || item.name;
    if (!cityName) continue;

    // Replace spaces with hyphens so multi-word park names produce valid slugs
    const key = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${addr.country_code.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const destinationType: 'city' | 'national_park' =
      (isNationalPark || isLeisurePark) ? 'national_park' : 'city';

    results.push({
      id: key,
      name: cityName,
      country: addr.country,
      countryCode: addr.country_code.toUpperCase(),
      flag: toFlag(addr.country_code),
      imageUrl: null,
      destinationType,
    });

    if (results.length === 6) break;
  }

  return results;
}

export async function searchLocations(query: string): Promise<LocationResult[]> {
  const key = `search:${query.trim().toLowerCase()}`;
  const cached = await cacheGet<LocationResult[]>(key);
  if (cached) return cached;

  const results = await fetchLocations(query);
  if (results.length) await cacheSet(key, results, 1);
  return results;
}
