import * as logger from "firebase-functions/logger";
import { type PlaceCandidate, type SearchQuery, type PlaceCategory } from "./types";

const PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
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
  regularOpeningHours?: { openNow?: boolean };
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

async function searchPlaces(
  query: SearchQuery,
  apiKey: string
): Promise<PlaceCandidate[]> {
  try {
    const response = await fetch(PLACES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query.query,
        languageCode: "en",
        maxResultCount: 10,
      }),
    });

    if (!response.ok) {
      logger.warn("Google Places API non-OK response", {
        status: response.status,
        query: query.query,
      });
      return [];
    }

    const data = await response.json() as { places?: GooglePlaceResult[] };

    return (data.places ?? [])
      .filter((p): p is GooglePlaceResult & { location: NonNullable<GooglePlaceResult["location"]>; displayName: NonNullable<GooglePlaceResult["displayName"]> } =>
        Boolean(p.location && p.displayName)
      )
      .map((p) => ({
        placeId: p.id,
        name: p.displayName.text,
        address: p.formattedAddress ?? "",
        coordinates: {
          lat: p.location.latitude,
          lng: p.location.longitude,
        },
        rating: p.rating ?? 0,
        reviewCount: p.userRatingCount ?? 0,
        priceLevel: priceLevelToNumber(p.priceLevel),
        types: p.types ?? [],
        category: query.category as PlaceCategory,
        openNow: p.regularOpeningHours?.openNow,
        neighborhood: query.neighborhood,
      }));
  } catch (error) {
    logger.warn("Google Places search failed", { query: query.query, error });
    return [];
  }
}

export async function fetchRecommendations(
  queries: SearchQuery[],
  apiKey: string
): Promise<PlaceCandidate[]> {
  const seen = new Set<string>();
  const allPlaces: PlaceCandidate[] = [];

  // Batch searches 5 at a time to avoid overwhelming the API
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

  logger.info("Google Places retrieval complete", {
    queriesRun: queries.length,
    uniquePlacesFound: allPlaces.length,
  });

  return allPlaces;
}
