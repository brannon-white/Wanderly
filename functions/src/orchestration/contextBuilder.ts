import * as logger from "firebase-functions/logger";
import { type PlaceCandidate, type PlaceCategory, type TripArchetype, type DayContext, type DaySupportingPlaces, type OsmHike } from "./types";

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

// ─── Anchor Discovery ─────────────────────────────────────────────────────────
// Find ONE high-quality anchor place for a day using a targeted text search.

async function findAnchor(query: string, apiKey: string): Promise<PlaceCandidate | null> {
  try {
    const response = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, languageCode: "en", maxResultCount: 5 }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.warn("Anchor search non-OK", { status: response.status, query, body: body.slice(0, 200) });
      return null;
    }

    const data = await response.json() as { places?: GooglePlaceResult[] };
    const valid = filterValid(data.places ?? []);
    if (valid.length === 0) return null;

    // Prefer highest-rated with meaningful review count
    const best = valid
      .filter((p) => (p.userRatingCount ?? 0) > 10)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
      ?? valid[0];

    return toPlaceCandidate(best);
  } catch (error) {
    logger.warn("Anchor search failed", { query, error });
    return null;
  }
}

// ─── Geographic Expansion ─────────────────────────────────────────────────────
// Given anchor coordinates, find supporting places nearby via category-specific searches.

async function searchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
  apiKey: string,
  radiusMeters: number,
  categoryHint: PlaceCategory,
  maxResults = 6
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
      .map((p) => toPlaceCandidate(p, categoryHint))
      .sort((a, b) => b.rating - a.rating);
  } catch {
    return [];
  }
}

async function expandAroundAnchor(
  anchorLat: number,
  anchorLng: number,
  apiKey: string,
  isNationalPark: boolean
): Promise<DaySupportingPlaces> {
  // National parks: meals/activities are in gateway towns, which can be 15-25km from the trailhead.
  // Cities: everything should be walkable or a short ride.
  const mealRadius = isNationalPark ? 20000 : 2500;
  const activityRadius = isNationalPark ? 8000 : 2500;
  // Evening/nightlife is usually town-based even for park trips
  const eveningRadius = isNationalPark ? 25000 : 3000;

  const [
    breakfast,
    lunch,
    dinner,
    morning,
    afternoon,
    lateAfternoon,
    evening,
  ] = await Promise.all([
    searchNearby(anchorLat, anchorLng, ["cafe", "bakery", "breakfast_restaurant"], apiKey, mealRadius, "cafe", 8),
    searchNearby(anchorLat, anchorLng, ["restaurant", "cafe"], apiKey, mealRadius, "restaurant", 8),
    searchNearby(anchorLat, anchorLng, ["restaurant"], apiKey, mealRadius, "restaurant", 8),
    // Morning activities: parks, gardens, markets, museums (museums often open ~10am)
    searchNearby(
      anchorLat, anchorLng,
      ["park", "tourist_attraction", "historical_landmark", "market"],
      apiKey, activityRadius, "attraction", 8
    ),
    // Afternoon activities: museums, galleries, broader attractions
    searchNearby(
      anchorLat, anchorLng,
      ["museum", "art_gallery", "tourist_attraction", "historical_landmark"],
      apiKey, activityRadius, "attraction", 8
    ),
    // Late afternoon / golden hour: scenic spots, breweries, coffee, dessert
    searchNearby(
      anchorLat, anchorLng,
      ["tourist_attraction", "park", "cafe"],
      apiKey, activityRadius, "attraction", 8
    ),
    // Evening: bars, live music, dessert, distilleries
    searchNearby(
      anchorLat, anchorLng,
      ["bar", "night_club", "ice_cream_shop"],
      apiKey, eveningRadius, "nightlife", 8
    ),
  ]);

  // Cross-slot dedup so the same venue isn't offered for multiple slots.
  // Priority order = meals first (anchor of the eating schedule), then activities by time.
  const claimed = new Set<string>();
  const pick = (places: PlaceCandidate[], limit: number): PlaceCandidate[] => {
    const out: PlaceCandidate[] = [];
    for (const p of places) {
      if (claimed.has(p.placeId)) continue;
      claimed.add(p.placeId);
      out.push(p);
      if (out.length >= limit) break;
    }
    return out;
  };

  return {
    breakfast: pick(breakfast, 4),
    lunch: pick(lunch, 4),
    dinner: pick(dinner, 4),
    morning: pick(morning, 4),
    afternoon: pick(afternoon, 4),
    late_afternoon: pick(lateAfternoon, 4),
    evening: pick(evening, 4),
  };
}

const EMPTY_SUPPORTING: DaySupportingPlaces = {
  breakfast: [],
  morning: [],
  lunch: [],
  afternoon: [],
  late_afternoon: [],
  dinner: [],
  evening: [],
};

// ─── Main export ──────────────────────────────────────────────────────────────

export async function buildDayContexts(
  archetype: TripArchetype,
  osmHikesByStop: OsmHike[][],
  apiKey: string,
  isNationalPark: boolean
): Promise<DayContext[][]> {
  const allContexts: DayContext[][] = [];

  for (let stopIndex = 0; stopIndex < archetype.stops.length; stopIndex++) {
    const stop = archetype.stops[stopIndex];
    const stopOsmHikes = osmHikesByStop[stopIndex] ?? [];
    const stopContexts: DayContext[] = [];

    // Discover anchors for all days in this stop in parallel
    logger.info("Context builder: discovering anchors", {
      stop: stop.location,
      days: stop.days.length,
      queries: stop.days.map((d) => d.anchorQuery),
    });

    const anchors = await Promise.all(
      stop.days.map((day) => findAnchor(day.anchorQuery, apiKey))
    );

    // Geographic expansion: run in parallel for all days in the stop
    const expansions = await Promise.all(
      anchors.map((anchor) =>
        anchor
          ? expandAroundAnchor(anchor.coordinates.lat, anchor.coordinates.lng, apiKey, isNationalPark)
          : Promise.resolve(EMPTY_SUPPORTING)
      )
    );

    logger.info("Context builder: stop complete", {
      stop: stop.location,
      anchorsFound: anchors.filter(Boolean).length,
      anchorNames: anchors.map((a) => a?.name ?? "null"),
    });

    for (let dayIdx = 0; dayIdx < stop.days.length; dayIdx++) {
      stopContexts.push({
        skeleton: stop.days[dayIdx],
        stopLocation: stop.location,
        stopIndex,
        dayIndexInStop: dayIdx,
        anchor: anchors[dayIdx],
        supporting: expansions[dayIdx],
        osmHikes: stopOsmHikes,
      });
    }

    allContexts.push(stopContexts);
  }

  return allContexts;
}
