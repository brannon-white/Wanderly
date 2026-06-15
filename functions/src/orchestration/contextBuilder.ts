import * as logger from "firebase-functions/logger";
import {
  type PlaceCandidate,
  type PlaceCategory,
  type StopCandidatePool,
  type StopPool,
  type OsmHike,
} from "./types";
import { isJunkVenue } from "./placeQuality";

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "places.editorialSummary",
  "places.regularOpeningHours",
].join(",");

interface GooglePlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  editorialSummary?: { text: string };
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
}

function priceLevelToNumber(priceLevel?: string): number {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[priceLevel ?? ""] ?? 2;
}

function inferCategory(types: string[]): PlaceCategory {
  if (types.some((t) => ["restaurant", "cafe", "bakery", "food"].some((r) => t.includes(r)))) return "restaurant";
  if (types.some((t) => t.includes("museum") || t.includes("art_gallery"))) return "museum";
  if (types.some((t) => t.includes("park") || t.includes("natural_feature"))) return "park";
  if (types.some((t) => t.includes("night_club") || t.includes("bar"))) return "nightlife";
  if (types.some((t) => t.includes("spa"))) return "wellness";
  return "attraction";
}

function compactHours(weekdayDescriptions?: string[]): string | undefined {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return undefined;
  // Strip the day name prefix (e.g. "Monday: 8:00 AM – 10:00 PM") and join with semicolons
  // to keep the string short for the prompt. Return first 4 days only to stay compact.
  return weekdayDescriptions.slice(0, 4).map((d) => d.replace(/^[^:]+:\s*/, "")).join(" | ");
}

function toPlaceCandidate(p: GooglePlaceResult & {
  location: NonNullable<GooglePlaceResult["location"]>;
  displayName: NonNullable<GooglePlaceResult["displayName"]>;
}, categoryHint?: PlaceCategory): PlaceCandidate {
  const types = p.types ?? [];
  return {
    placeId: p.id,
    name: p.displayName.text,
    address: p.formattedAddress ?? "",
    coordinates: { lat: p.location.latitude, lng: p.location.longitude },
    rating: p.rating ?? 0,
    reviewCount: p.userRatingCount ?? 0,
    priceLevel: priceLevelToNumber(p.priceLevel),
    types,
    category: categoryHint ?? inferCategory(types),
    editorialSummary: p.editorialSummary?.text,
    openingHours: compactHours(p.regularOpeningHours?.weekdayDescriptions),
  };
}

function filterValid(places: GooglePlaceResult[]): Array<GooglePlaceResult & {
  location: NonNullable<GooglePlaceResult["location"]>;
  displayName: NonNullable<GooglePlaceResult["displayName"]>;
}> {
  return places.filter(
    (p): p is GooglePlaceResult & { location: NonNullable<GooglePlaceResult["location"]>; displayName: NonNullable<GooglePlaceResult["displayName"]> } =>
      Boolean(p.location && p.displayName)
  );
}

// ─── Geocode stop location ────────────────────────────────────────────────────

async function geocodeStop(
  location: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: location, languageCode: "en", maxResultCount: 1 }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { places?: GooglePlaceResult[] };
    const first = filterValid(data.places ?? [])[0];
    return first ? { lat: first.location.latitude, lng: first.location.longitude } : null;
  } catch {
    return null;
  }
}

// ─── Broad pool fetch — 5 category fetches in parallel per stop ───────────────

async function searchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
  apiKey: string,
  radiusMeters: number,
  categoryHint: PlaceCategory,
  maxResults: number,
): Promise<PlaceCandidate[]> {
  try {
    const response = await fetch(NEARBY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: maxResults,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
        },
        languageCode: "en",
      }),
    });

    if (!response.ok) return [];

    const data = await response.json() as { places?: GooglePlaceResult[] };
    return filterValid(data.places ?? [])
      .filter((p) => !isJunkVenue(p.types))
      .map((p) => toPlaceCandidate(p, categoryHint))
      .sort((a, b) => b.rating - a.rating);
  } catch {
    return [];
  }
}

async function buildStopCandidatePool(
  centerLat: number,
  centerLng: number,
  apiKey: string,
  isNationalPark: boolean,
  nightCount: number,
): Promise<StopCandidatePool> {
  // Pool size scales with how many days the planner needs to fill from it.
  const perBucket = Math.max(15, Math.min(30, 8 + nightCount * 4));
  const radius = isNationalPark ? 25000 : 4000;
  const eveningRadius = isNationalPark ? 30000 : 5000;

  const [breakfast, food, nightlife, attractions, scenic] = await Promise.all([
    searchNearby(centerLat, centerLng,
      ["cafe", "bakery", "breakfast_restaurant"],
      apiKey, radius, "cafe", perBucket),
    searchNearby(centerLat, centerLng,
      ["restaurant"],
      apiKey, radius, "restaurant", perBucket),
    searchNearby(centerLat, centerLng,
      ["bar", "night_club", "ice_cream_shop"],
      apiKey, eveningRadius, "nightlife", Math.max(8, Math.round(perBucket * 0.6))),
    searchNearby(centerLat, centerLng,
      ["museum", "art_gallery", "tourist_attraction", "historical_landmark", "market"],
      apiKey, radius, "attraction", perBucket),
    searchNearby(centerLat, centerLng,
      ["park", "tourist_attraction"],
      apiKey, radius, "park", Math.max(8, Math.round(perBucket * 0.6))),
  ]);

  // Cross-category dedup — a venue can only appear in one pool.
  // Priority: meals & nightlife (time-locked uses) before attractions/scenic.
  const claimed = new Set<string>();
  const claim = (places: PlaceCandidate[]): PlaceCandidate[] => {
    const out: PlaceCandidate[] = [];
    for (const p of places) {
      if (claimed.has(p.placeId)) continue;
      claimed.add(p.placeId);
      out.push(p);
    }
    return out;
  };

  return {
    breakfast: claim(breakfast),
    food: claim(food),
    nightlife: claim(nightlife),
    attractions: claim(attractions),
    scenic: claim(scenic),
  };
}

// ─── Main export — build a StopPool per stop ──────────────────────────────────

export interface StopPlan {
  location: string;
  region?: string;
  nightCount: number;
}

export async function buildStopPools(
  stops: StopPlan[],
  apiKey: string,
  isNationalPark: boolean,
  trailsByStopIndex: OsmHike[][],
): Promise<StopPool[]> {
  const total = stops.length;
  const results: StopPool[] = [];

  // Geocode + fetch pools in parallel across all stops
  const stopWork = await Promise.all(
    stops.map(async (stop, idx) => {
      const center = await geocodeStop(stop.location, apiKey);
      if (!center) {
        logger.warn("Context builder: geocode failed", { stop: stop.location });
        return null;
      }
      const candidates = await buildStopCandidatePool(
        center.lat, center.lng, apiKey, isNationalPark, stop.nightCount,
      );
      logger.info("Context builder: stop pool fetched", {
        stop: stop.location,
        breakfast: candidates.breakfast.length,
        food: candidates.food.length,
        nightlife: candidates.nightlife.length,
        attractions: candidates.attractions.length,
        scenic: candidates.scenic.length,
      });
      return { idx, center, candidates };
    })
  );

  for (let i = 0; i < total; i++) {
    const work = stopWork[i];
    const stop = stops[i];
    results.push({
      location: stop.location,
      region: stop.region,
      nightCount: stop.nightCount,
      stopIndex: i,
      isFirstStop: i === 0,
      isLastStop: i === total - 1,
      candidates: work?.candidates ?? {
        breakfast: [], food: [], nightlife: [], attractions: [], scenic: [],
      },
      trails: trailsByStopIndex[i] ?? [],
    });
  }

  return results;
}

// Re-export geocodeStop so the pipeline can grab a center for the OSM trail fetch.
export { geocodeStop };
