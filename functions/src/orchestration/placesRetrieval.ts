import * as logger from "firebase-functions/logger";
import { type PlaceCandidate, type SearchQuery, type PlaceCategory, type PlaceCluster } from "./types";

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
  "places.photos",
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
  photos?: Array<{ name: string }>;
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

function toPlaceCandidate(p: GooglePlaceResult, category: PlaceCategory, neighborhood?: string): PlaceCandidate {
  return {
    placeId: p.id,
    name: p.displayName!.text,
    address: p.formattedAddress ?? "",
    coordinates: { lat: p.location!.latitude, lng: p.location!.longitude },
    rating: p.rating ?? 0,
    reviewCount: p.userRatingCount ?? 0,
    priceLevel: priceLevelToNumber(p.priceLevel),
    types: p.types ?? [],
    category,
    neighborhood,
    editorialSummary: p.editorialSummary?.text,
    photoName: p.photos?.[0]?.name,
  };
}

async function searchPlaces(query: SearchQuery, apiKey: string): Promise<PlaceCandidate[]> {
  try {
    const response = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query.query, languageCode: "en", maxResultCount: 10 }),
    });

    if (!response.ok) {
      logger.warn("Places text search non-OK", { status: response.status, query: query.query });
      return [];
    }

    const data = await response.json() as { places?: GooglePlaceResult[] };
    return (data.places ?? [])
      .filter((p): p is GooglePlaceResult & { location: NonNullable<GooglePlaceResult["location"]>; displayName: NonNullable<GooglePlaceResult["displayName"]> } =>
        Boolean(p.location && p.displayName)
      )
      .map((p) => toPlaceCandidate(p, query.category as PlaceCategory, query.neighborhood));
  } catch (error) {
    logger.warn("Places text search failed", { query: query.query, error });
    return [];
  }
}

export async function fetchRecommendations(
  queries: SearchQuery[],
  apiKey: string
): Promise<PlaceCandidate[]> {
  const seen = new Set<string>();
  const allPlaces: PlaceCandidate[] = [];

  const batchSize = 5;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((q) => searchPlaces(q, apiKey)));
    for (const places of results) {
      for (const place of places) {
        if (!seen.has(place.placeId)) {
          seen.add(place.placeId);
          allPlaces.push(place);
        }
      }
    }
  }

  logger.info("Places text search complete", {
    queriesRun: queries.length,
    uniquePlacesFound: allPlaces.length,
  });

  return allPlaces;
}

// ─── Nearby search — supplements each cluster with geographically tight results ─

async function searchNearby(
  lat: number,
  lng: number,
  includedTypes: string[],
  apiKey: string,
  radiusMeters = 1500
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
        maxResultCount: 10,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters },
        },
        languageCode: "en",
      }),
    });

    if (!response.ok) {
      logger.warn("Places nearby search non-OK", { status: response.status, lat, lng });
      return [];
    }

    const data = await response.json() as { places?: GooglePlaceResult[] };
    return (data.places ?? [])
      .filter((p): p is GooglePlaceResult & { location: NonNullable<GooglePlaceResult["location"]>; displayName: NonNullable<GooglePlaceResult["displayName"]> } =>
        Boolean(p.location && p.displayName)
      )
      .map((p) => {
        const category: PlaceCategory = p.types?.some((t) => t.includes("restaurant") || t.includes("cafe") || t.includes("food"))
          ? "restaurant"
          : "attraction";
        return toPlaceCandidate(p, category);
      });
  } catch (error) {
    logger.warn("Places nearby search failed", { lat, lng, error });
    return [];
  }
}

const CATEGORY_TYPES: Record<string, string[]> = {
  food:       ["restaurant", "cafe", "bakery", "bar"],
  restaurant: ["restaurant", "cafe", "bakery", "bar"],
  culture:    ["museum", "art_gallery", "cultural_center", "church", "hindu_temple", "mosque", "synagogue"],
  landmark:   ["tourist_attraction", "historical_landmark", "monument"],
  nature:     ["park", "national_park", "botanical_garden", "beach"],
  shopping:   ["shopping_mall", "market", "store", "department_store"],
  nightlife:  ["night_club", "bar", "casino"],
  wellness:   ["spa", "fitness_center", "yoga_studio"],
  adventure:  ["tourist_attraction", "outdoor_activity", "amusement_park"],
  hotel:      ["lodging", "hotel"],
};

const GENERAL_TYPES = [
  "tourist_attraction", "restaurant", "cafe", "museum", "park",
  "art_gallery", "night_club", "spa", "shopping_mall",
];

export async function searchNearbyForActivity(
  lat: number,
  lng: number,
  category: string,
  apiKey: string,
  options: { hiddenGemMode?: boolean; radiusMeters?: number; typesOverride?: string[] } = {}
): Promise<PlaceCandidate[]> {
  const { hiddenGemMode = false, radiusMeters = 1500, typesOverride } = options;
  const types = hiddenGemMode
    ? GENERAL_TYPES
    : (typesOverride ?? CATEGORY_TYPES[category.toLowerCase()] ?? GENERAL_TYPES);
  const places = await searchNearby(lat, lng, types, apiKey, radiusMeters);

  if (hiddenGemMode) {
    return places
      .filter((p) => p.reviewCount < 800 && p.rating >= 4.0)
      .sort((a, b) => b.rating - a.rating);
  }

  return places.sort((a, b) => b.rating - a.rating);
}

export async function fetchNearbyForClusters(
  clusters: PlaceCluster[],
  apiKey: string,
  destinationType: 'city' | 'national_park' = 'city'
): Promise<PlaceCluster[]> {
  // National parks: gateway towns for restaurants are 6–15 km from park cluster centers,
  // so we widen the radius to 15 km. City trips keep the original 1.5 km.
  const nearbyRadius = destinationType === 'national_park' ? 15000 : 1500;

  const enriched = await Promise.all(
    clusters.map(async (cluster) => {
      const [foodResults, attractionResults] = await Promise.all([
        searchNearby(cluster.centerLat, cluster.centerLng, ["restaurant", "cafe", "bakery"], apiKey, nearbyRadius),
        searchNearby(cluster.centerLat, cluster.centerLng, ["tourist_attraction", "museum", "art_gallery", "park", "night_club"], apiKey, nearbyRadius),
      ]);

      const existingIds = new Set(cluster.places.map((p) => p.placeId));
      const newPlaces = [...foodResults, ...attractionResults]
        .filter((p) => !existingIds.has(p.placeId))
        .map((p) => ({ ...p, score: 0, interestMatch: 0, budgetCompatible: true }));

      return {
        ...cluster,
        places: [...cluster.places, ...newPlaces].slice(0, 16),
      };
    })
  );

  logger.info("Nearby search enrichment complete", {
    clustersEnriched: enriched.length,
  });

  return enriched;
}

