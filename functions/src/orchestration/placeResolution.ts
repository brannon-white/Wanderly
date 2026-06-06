import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary, getAllDays, updateDayByIndex } from "../itinerarySchemas";

// Snaps AI-generated activities to the real Google Place they describe.
//
// The trip planner gives the LLM real place *names* but it invents the lat/lng.
// Those hallucinated coordinates are what make "Directions" open a random/wrong
// address and make transport-time + walking-distance estimates garbage. Here we
// resolve each activity's name against Google Places Text Search and snap the
// real coordinates, place id, and a place-id-anchored map URL back onto it.

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
].join(",");

export interface ResolvedPlace {
  placeId: string;
  coordinates: { latitude: number; longitude: number };
  mapUrl: string;
  address: string;
}

interface TextSearchPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
}

// Normalize a venue name to a comparable token set: lowercase, strip accents,
// drop punctuation and generic filler words that don't help identity matching.
const FILLER = new Set([
  "the", "a", "an", "of", "and", "at", "in", "on", "de", "la", "le", "el",
  "restaurant", "cafe", "café", "bar", "museum", "park", "trail", "hotel",
]);

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/['’`]/g, "")         // possessives: "jordan's" → "jordans"
    .replace(/[^a-z0-9\s]/g, " ")  // also drops combining accents after NFD
    .split(/\s+/)
    .filter((t) => t.length > 1 && !FILLER.has(t));  // drop single-char noise
}

// Jaccard-style overlap of the activity name tokens against the Google result
// name. We only require that the activity's distinctive tokens are mostly
// present in the result — Google often appends extra context ("… - Downtown").
export function nameMatchScore(activityName: string, placeName: string): number {
  const a = tokenize(activityName);
  const b = new Set(tokenize(placeName));
  if (a.length === 0 || b.size === 0) return 0;
  const hits = a.filter((t) => b.has(t)).length;
  return hits / a.length;
}

const MATCH_THRESHOLD = 0.5;

export async function findPlaceByText(
  name: string,
  locationBias: string,
  apiKey: string
): Promise<ResolvedPlace | null> {
  const query = locationBias ? `${name}, ${locationBias}` : name;
  let data: { places?: TextSearchPlace[] };
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
      logger.warn("placeResolution text search non-OK", { status: response.status, query });
      return null;
    }
    data = await response.json() as { places?: TextSearchPlace[] };
  } catch (error) {
    logger.warn("placeResolution text search failed", { query, error });
    return null;
  }

  const candidates = (data.places ?? []).filter(
    (p): p is TextSearchPlace & { location: NonNullable<TextSearchPlace["location"]>; displayName: NonNullable<TextSearchPlace["displayName"]> } =>
      Boolean(p.id && p.location && p.displayName?.text)
  );
  if (candidates.length === 0) return null;

  // Pick the best name match among the returned candidates; bail if even the
  // best is weak (e.g. natural landmarks Google doesn't index keep AI coords).
  let best: typeof candidates[number] | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = nameMatchScore(name, c.displayName.text);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (!best || bestScore < MATCH_THRESHOLD) return null;

  return {
    placeId: best.id,
    coordinates: { latitude: best.location.latitude, longitude: best.location.longitude },
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(best.displayName.text)}&query_place_id=${best.id}`,
    address: best.formattedAddress ?? "",
  };
}

type Activity = GeneratedItinerary["stops"][number]["days"][number]["activities"][number];

// Resolve a list of activities against Google Places, snapping coords/placeId/mapUrl
// onto each that matches. Activities that already have a placeId or that don't match
// are returned unchanged. `cache` de-dupes repeated names across calls.
export async function resolveActivityPlaces(
  activities: Activity[],
  location: string,
  apiKey: string,
  cache: Map<string, ResolvedPlace | null> = new Map()
): Promise<{ activities: Activity[]; resolvedCount: number }> {
  let resolvedCount = 0;
  const resolved = await Promise.all(
    activities.map(async (activity) => {
      if (activity.placeId) return activity;            // already verified
      if (!activity.name) return activity;

      const cacheKey = `${activity.name}|${location}`;
      let match = cache.get(cacheKey);
      if (match === undefined) {
        match = await findPlaceByText(activity.name, location, apiKey);
        cache.set(cacheKey, match);
      }
      if (!match) return activity;                      // weak/no match → keep AI coords

      resolvedCount++;
      return {
        ...activity,
        coordinates: match.coordinates,
        placeId: match.placeId,
        mapUrl: match.mapUrl,
      };
    })
  );
  return { activities: resolved, resolvedCount };
}

// Walks the whole itinerary and resolves every activity that doesn't already
// have a placeId. Incremental by design: persisted activities keep their placeId
// and are skipped, so after a single edit only the new/changed activities are
// looked up. Per-run cache de-dupes repeated names within one itinerary.
export async function reconcileItineraryPlaces(
  itinerary: GeneratedItinerary,
  apiKey: string | undefined
): Promise<GeneratedItinerary> {
  if (!apiKey) return itinerary;

  const cache = new Map<string, ResolvedPlace | null>();
  const days = getAllDays(itinerary);

  // Map each global day index to its stop location (for the location bias).
  const dayLocations: string[] = [];
  for (const stop of itinerary.stops) {
    for (let i = 0; i < stop.days.length; i++) dayLocations.push(stop.location);
  }

  let result = itinerary;
  let resolvedCount = 0;

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const location = dayLocations[di] ?? itinerary.destinationName;
    const { activities, resolvedCount: n } = await resolveActivityPlaces(day.activities, location, apiKey, cache);
    resolvedCount += n;
    result = updateDayByIndex(result, di, { ...day, activities });
  }

  logger.info("placeResolution complete", { resolvedCount, totalDays: days.length });
  return result;
}
