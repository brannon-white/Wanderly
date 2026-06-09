import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary, getAllDays, updateDayByIndex } from "../itinerarySchemas";
import { type StopPool, type StopCandidatePool, type PlaceCandidate } from "./types";
import { searchNearbyForActivity } from "./placesRetrieval";
import { geocodeStop } from "./contextBuilder";

// All of a single day's activities live in one stop city, so a real venue for an
// activity should sit near that stop's center. Google Text Search will happily
// return a same-named venue in another city (a "Joe's Diner" 200 km away), which is
// how a single day ends up with a 2h45m hop to a restaurant. We reject any match
// farther than this from the stop center and fall back to a real nearby pool venue.
const MAX_SNAP_DISTANCE_KM = 60;

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Median is robust to a single far outlier, so the day's "center" stays with the
// majority cluster even when one activity landed in the wrong town.
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

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
  apiKey: string,
  center?: { lat: number; lng: number } | null,
): Promise<ResolvedPlace | null> {
  const query = locationBias ? `${name}, ${locationBias}` : name;
  let data: { places?: TextSearchPlace[] };
  try {
    const body: Record<string, unknown> = { textQuery: query, languageCode: "en", maxResultCount: 5 };
    // Bias Google toward the stop center so same-named venues elsewhere rank lower.
    if (center) {
      body.locationBias = {
        circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 30000 },
      };
    }
    const response = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
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

  // Hard location guard: a name match in the wrong city (e.g. a chain branch 200 km
  // away) would put a multi-hour drive inside a single day. Reject it so the activity
  // stays unverified and gets swapped for a real nearby venue downstream.
  if (center) {
    const distKm = haversineKm(center.lat, center.lng, best.location.latitude, best.location.longitude);
    if (distKm > MAX_SNAP_DISTANCE_KM) {
      logger.info("placeResolution: rejected far match", {
        name, query, distKm: Math.round(distKm), matched: best.displayName.text,
      });
      return null;
    }
  }

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
  cache: Map<string, ResolvedPlace | null> = new Map(),
  center?: { lat: number; lng: number } | null,
): Promise<{ activities: Activity[]; resolvedCount: number }> {
  let resolvedCount = 0;
  const resolved = await Promise.all(
    activities.map(async (activity) => {
      if (activity.placeId) return activity;            // already verified
      if (!activity.name) return activity;

      const cacheKey = `${activity.name}|${location}`;
      let match = cache.get(cacheKey);
      if (match === undefined) {
        match = await findPlaceByText(activity.name, location, apiKey, center);
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

  // Geocode each distinct stop center once. Passed to the snap so a far same-named
  // venue gets rejected instead of dropping a multi-hour drive into a single day.
  const centerByLocation = new Map<string, { lat: number; lng: number } | null>();
  for (const stop of itinerary.stops) {
    if (!centerByLocation.has(stop.location)) {
      centerByLocation.set(stop.location, await geocodeStop(stop.location, apiKey));
    }
  }

  let result = itinerary;
  let resolvedCount = 0;

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const location = dayLocations[di] ?? itinerary.destinationName;
    const center = centerByLocation.get(location) ?? null;
    const { activities, resolvedCount: n } = await resolveActivityPlaces(day.activities, location, apiKey, cache, center);
    resolvedCount += n;
    result = updateDayByIndex(result, di, { ...day, activities });
  }

  logger.info("placeResolution complete", { resolvedCount, totalDays: days.length });
  return result;
}

// ─── Hard gate: no AI-hallucinated locations on the itinerary ─────────────────
//
// After reconciliation, an activity is "verified" only if it carries a real
// Google placeId (matched in resolveActivityPlaces) or OSM trail data (matched in
// stampOsmTrailData). Anything else is a name the model invented that we could not
// confirm against a real source. We never ship those: each is swapped for an
// unused, same-category venue from the stop's candidate pool (which are all real
// Places), and dropped only if the pool has nothing left to offer.

function isVerified(activity: Activity): boolean {
  return Boolean(activity.placeId) || activity.trailDistanceMiles != null;
}

// Snap a real Place candidate onto an activity, keeping its slot (id/time/category)
// but replacing the name/coords/placeId/description with the verified venue's.
function applyVenueToActivity(activity: Activity, venue: PlaceCandidate): Activity {
  // Drop the old place's cost entirely (key omitted, not set to undefined —
  // Firestore rejects undefined values) since it's stale for the new venue.
  const { cost: _staleCost, ...rest } = activity;
  return {
    ...rest,
    name: venue.name,
    coordinates: { latitude: venue.coordinates.lat, longitude: venue.coordinates.lng },
    placeId: venue.placeId,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name)}&query_place_id=${venue.placeId}`,
    description: venue.editorialSummary ?? activity.description ?? "",
    image: "", // cleared so image enrichment fetches the new venue's photo
  };
}

// Ordered candidate buckets to draw a replacement from, by the activity's slot
// category. First non-empty, unused venue wins.
function bucketsForCategory(category: string | undefined): (keyof StopCandidatePool)[] {
  const c = (category ?? "").toLowerCase();
  if (c === "food") return ["food", "breakfast"];
  if (c === "nightlife") return ["nightlife", "food"];
  if (c === "nature" || c === "scenic" || c === "outdoors" || c === "adventure") return ["scenic", "attractions"];
  if (c === "culture" || c === "attraction" || c === "museum") return ["attractions", "scenic"];
  return ["attractions", "food", "scenic", "nightlife", "breakfast"];
}

function pickUnusedVenue(
  pool: StopCandidatePool,
  category: string | undefined,
  usedPlaceIds: Set<string>,
  usedNames: Set<string>,
): PlaceCandidate | null {
  for (const bucket of bucketsForCategory(category)) {
    for (const venue of pool[bucket]) {
      if (!venue.placeId) continue;
      if (usedPlaceIds.has(venue.placeId)) continue;
      if (usedNames.has(venue.name.toLowerCase().trim())) continue;
      return venue;
    }
  }
  return null;
}

type Itinerary = GeneratedItinerary;

/**
 * Replace every unverified activity (no placeId and no trail data) with an unused
 * real venue from the same stop's candidate pool. Drops an activity only when the
 * pool is exhausted for its category. Deterministic — no LLM, no API calls.
 * Run AFTER reconcileItineraryPlaces (so placeIds are populated) and BEFORE
 * transport/image enrichment (so replacements get correct times + photos).
 */
export function enforceVerifiedPlaces(
  itinerary: Itinerary,
  pools: StopPool[],
): { itinerary: Itinerary; replacedCount: number; droppedCount: number } {
  // Seed the "used" sets with every venue already on the trip so replacements
  // never duplicate an existing stop.
  const usedPlaceIds = new Set<string>();
  const usedNames = new Set<string>();
  for (const stop of itinerary.stops) {
    for (const day of stop.days) {
      for (const a of day.activities) {
        if (a.placeId) usedPlaceIds.add(a.placeId);
        if (a.name) usedNames.add(a.name.toLowerCase().trim());
      }
    }
  }

  let replacedCount = 0;
  let droppedCount = 0;

  const stops = itinerary.stops.map((stop, stopIndex) => {
    const pool = pools[stopIndex]?.candidates;
    const days = stop.days.map((day) => {
      const activities: Activity[] = [];
      for (const activity of day.activities) {
        if (isVerified(activity)) {
          activities.push(activity);
          continue;
        }
        const venue = pool ? pickUnusedVenue(pool, activity.category, usedPlaceIds, usedNames) : null;
        if (!venue) {
          droppedCount++;
          continue;
        }
        usedPlaceIds.add(venue.placeId);
        usedNames.add(venue.name.toLowerCase().trim());
        replacedCount++;
        activities.push(applyVenueToActivity(activity, venue));
      }
      return { ...day, activities };
    });
    return { ...stop, days };
  });

  if (replacedCount > 0 || droppedCount > 0) {
    logger.info("Verified-places gate", { replacedCount, droppedCount });
  }
  return { itinerary: { ...itinerary, stops }, replacedCount, droppedCount };
}

/**
 * Pool-free variant for the edit/regenerate endpoints, which don't carry the full
 * candidate pools. For each unverified activity it pulls a real nearby venue of the
 * same category from Google Places (reusing searchNearbyForActivity) and snaps it in;
 * drops the activity only if Places returns nothing usable. `dayIndex` limits the
 * scan (and the Places calls) to a single edited day. Run AFTER reconcileItineraryPlaces.
 */
export async function enforceVerifiedPlacesBySearch(
  itinerary: Itinerary,
  apiKey: string | undefined,
  opts: { dayIndex?: number } = {},
): Promise<{ itinerary: Itinerary; replacedCount: number; droppedCount: number }> {
  if (!apiKey) return { itinerary, replacedCount: 0, droppedCount: 0 };

  const usedPlaceIds = new Set<string>();
  const usedNames = new Set<string>();
  for (const stop of itinerary.stops) {
    for (const day of stop.days) {
      for (const a of day.activities) {
        if (a.placeId) usedPlaceIds.add(a.placeId);
        if (a.name) usedNames.add(a.name.toLowerCase().trim());
      }
    }
  }

  // Per global day index: stop location + a fallback center (overnight anchor) for
  // activities whose own coordinates are missing.
  const dayCenters: Array<{ latitude: number; longitude: number } | undefined> = [];
  for (const stop of itinerary.stops) {
    const anchor = stop.overnightAnchor?.coordinates;
    for (let i = 0; i < stop.days.length; i++) dayCenters.push(anchor);
  }

  const days = getAllDays(itinerary);
  let result = itinerary;
  let replacedCount = 0;
  let droppedCount = 0;

  for (let di = 0; di < days.length; di++) {
    if (opts.dayIndex != null && di !== opts.dayIndex) continue;
    const day = days[di];
    const activities: Activity[] = [];
    for (const activity of day.activities) {
      if (isVerified(activity)) {
        activities.push(activity);
        continue;
      }
      const center = activity.coordinates ?? dayCenters[di];
      if (!center) {
        droppedCount++;
        continue;
      }
      let candidates: PlaceCandidate[] = [];
      try {
        candidates = await searchNearbyForActivity(
          center.latitude, center.longitude, activity.category ?? "attraction", apiKey, { radiusMeters: 3000 },
        );
      } catch {
        candidates = [];
      }
      const venue = candidates.find(
        (v) => v.placeId && !usedPlaceIds.has(v.placeId) && !usedNames.has(v.name.toLowerCase().trim()),
      );
      if (!venue) {
        droppedCount++;
        continue;
      }
      usedPlaceIds.add(venue.placeId);
      usedNames.add(venue.name.toLowerCase().trim());
      replacedCount++;
      activities.push(applyVenueToActivity(activity, venue));
    }
    result = updateDayByIndex(result, di, { ...day, activities });
  }

  if (replacedCount > 0 || droppedCount > 0) {
    logger.info("Verified-places gate (search)", { replacedCount, droppedCount, scope: opts.dayIndex ?? "all" });
  }
  return { itinerary: result, replacedCount, droppedCount };
}

// A day's activities should all sit in one city/area, not be spread across towns
// hours apart. Even after place snapping (which only rejects matches >60 km from
// the stop center) a venue can land in a neighbouring town and produce a
// multi-hour intra-day hop. For each non-drive day this finds activities more than
// COHESION_MAX_KM from the day's median coordinate (the majority cluster) and swaps
// each outlier for a real same-category venue near that cluster center. Keeps the
// original activity if Places offers no usable replacement. Run AFTER reconcile.
const COHESION_MAX_KM = 15;

export async function enforceDayGeographicCohesion(
  itinerary: Itinerary,
  apiKey: string | undefined,
  opts: { dayIndex?: number } = {},
): Promise<{ itinerary: Itinerary; movedCount: number }> {
  if (!apiKey) return { itinerary, movedCount: 0 };

  const usedPlaceIds = new Set<string>();
  const usedNames = new Set<string>();
  for (const stop of itinerary.stops) {
    for (const day of stop.days) {
      for (const a of day.activities) {
        if (a.placeId) usedPlaceIds.add(a.placeId);
        if (a.name) usedNames.add(a.name.toLowerCase().trim());
      }
    }
  }

  const days = getAllDays(itinerary);
  let result = itinerary;
  let movedCount = 0;

  for (let di = 0; di < days.length; di++) {
    if (opts.dayIndex != null && di !== opts.dayIndex) continue;
    const day = days[di];
    if (day.isDriveDay) continue; // drive days legitimately span cities

    const coords = day.activities
      .map((a) => a.coordinates)
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    if (coords.length < 3) continue; // too few points to define a cluster

    const medLat = median(coords.map((c) => c.latitude));
    const medLng = median(coords.map((c) => c.longitude));

    const activities: Activity[] = [];
    for (const activity of day.activities) {
      const c = activity.coordinates;
      if (!c || haversineKm(medLat, medLng, c.latitude, c.longitude) <= COHESION_MAX_KM) {
        activities.push(activity);
        continue;
      }
      let candidates: PlaceCandidate[] = [];
      try {
        candidates = await searchNearbyForActivity(
          medLat, medLng, activity.category ?? "attraction", apiKey, { radiusMeters: 8000 },
        );
      } catch {
        candidates = [];
      }
      const venue = candidates.find(
        (v) => v.placeId && !usedPlaceIds.has(v.placeId) && !usedNames.has(v.name.toLowerCase().trim()),
      );
      if (!venue) {
        activities.push(activity); // no nearby alternative — keep original
        continue;
      }
      usedPlaceIds.add(venue.placeId);
      usedNames.add(venue.name.toLowerCase().trim());
      movedCount++;
      activities.push(applyVenueToActivity(activity, venue));
    }
    result = updateDayByIndex(result, di, { ...day, activities });
  }

  if (movedCount > 0) {
    logger.info("Day cohesion enforcement", { movedCount, scope: opts.dayIndex ?? "all" });
  }
  return { itinerary: result, movedCount };
}
