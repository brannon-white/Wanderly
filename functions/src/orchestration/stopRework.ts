import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";
import { FAST_MODEL_NAME } from "../constants";
import {
  generatedItinerarySchema,
  type GeneratedItinerary,
  type GenerateItineraryRequest,
  type TripStop,
  type TasteProfile,
} from "../itinerarySchemas";
import { buildStopPools, geocodeStop, type StopPlan } from "./contextBuilder";
import { planItinerary, formatStopPersonalization, stopSelectionGuidance } from "./tripPlanning";
import { fetchHikingTrails } from "./trailDiscovery";
import { type OsmHike } from "./types";
import { relabelDays } from "./driveDayShaping";

// Re-plan and rework an entire city stop on a multi-stop road trip: either REMOVE a
// city (absorbing its days into the previous stop so the trip keeps its length) or
// REPLACE it with a city the user chose. Both reuse the normal generation primitives
// (buildStopPools + planItinerary) for a single stop, then leave drive-day reshaping,
// place reconciliation, and transport enrichment to the caller (the HTTP endpoint).

// Reconstruct the minimal generation request from a saved itinerary. Personalization
// fields (tasteProfile, derivedIntent) are optional and intentionally omitted — a
// re-plan of one stop keeps the trip's destination, interests, budget, and party.
export function requestFromItinerary(it: GeneratedItinerary): GenerateItineraryRequest {
  return {
    destinationId: it.destinationId,
    destinationName: it.destinationName,
    country: it.country,
    party: it.travelerType || "2 travelers",
    startDate: it.startDate ?? null,
    endDate: it.endDate ?? null,
    interests: it.interests ?? [],
    budget: it.budget || "moderate",
    tripType: "route",
  } as GenerateItineraryRequest;
}

// Plan a single stop's days at `location` for `dayCount` days, returning a fully
// parsed TripStop (overnightAnchor + days). Reuses the real planner + Places pools so
// the new stop is as good as a freshly generated one.
async function planSingleStop(
  it: GeneratedItinerary,
  location: string,
  dayCount: number,
  apiKey: string,
): Promise<TripStop> {
  const input = { ...requestFromItinerary(it), destinationName: location };
  const stopPlan: StopPlan = { location, nightCount: dayCount };

  const center = await geocodeStop(location, apiKey);
  let trails: OsmHike[] = [];
  if (center) {
    trails = await fetchHikingTrails(center.lat, center.lng).catch(() => []);
  }
  const pools = await buildStopPools([stopPlan], apiKey, false, [trails]);

  const raw = await planItinerary(input, pools, dayCount);

  // Validate through the real schema so the new stop matches every other stop's shape.
  const parsed = generatedItinerarySchema.parse({
    ...raw,
    id: it.id,
    title: (raw.title as string) || it.title,
    subtitle: (raw.subtitle as string) || it.subtitle,
    destinationId: it.destinationId,
    destinationName: location,
    country: it.country,
    source: "ai_generated",
    tripType: "route",
  });

  const stop = parsed.stops[0];
  if (!stop) throw new Error(`Stop re-plan returned no stop for ${location}`);
  return stop;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Stop = GeneratedItinerary["stops"][number];

// Representative center of a stop's city. Prefers the median of its non-drive days'
// activity coordinates (pure city), then the overnight anchor, then any coordinate.
function stopCenter(stop: Stop): { lat: number; lng: number } | null {
  const cityDays = stop.days.length > 1 ? stop.days.slice(0, -1) : stop.days;
  const coords = cityDays
    .flatMap((d) => d.activities)
    .map((a) => a.coordinates)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (coords.length > 0) {
    return { lat: median(coords.map((c) => c.latitude)), lng: median(coords.map((c) => c.longitude)) };
  }
  const anchor = stop.overnightAnchor?.coordinates;
  if (anchor) return { lat: anchor.latitude, lng: anchor.longitude };
  const any = stop.days.flatMap((d) => d.activities).map((a) => a.coordinates).find(Boolean);
  return any ? { lat: any.latitude, lng: any.longitude } : null;
}

const FOREIGN_CITY_KM = 45;

// After a remove/replace, a drive day can be left holding activities from a city that
// no longer exists on the trip (the model puts mid-drive arrival activities on the
// PREVIOUS stop's drive day). Keep only activities near the drive day's own stop or its
// (current) next stop; drop anything belonging to a now-gone city. Pure + deterministic.
export function pruneStaleDriveDayActivities(it: GeneratedItinerary): GeneratedItinerary {
  if (!it.stops || it.stops.length < 2) return it;

  const stops = it.stops.map((stop, si) => {
    if (si === it.stops.length - 1) return stop; // final stop has no drive day
    const own = stopCenter(stop);
    const next = stopCenter(it.stops[si + 1]);
    if (!own && !next) return stop;

    const lastIdx = stop.days.length - 1;
    const driveDay = stop.days[lastIdx];
    const near = (c: { latitude: number; longitude: number }, ctr: { lat: number; lng: number } | null) =>
      ctr != null && haversineKm(ctr.lat, ctr.lng, c.latitude, c.longitude) <= FOREIGN_CITY_KM;

    const kept = driveDay.activities.filter(
      (a) => !a.coordinates || near(a.coordinates, own) || near(a.coordinates, next),
    );
    // Safety: never empty a day.
    if (kept.length === 0 || kept.length === driveDay.activities.length) return stop;

    const days = stop.days.map((d, di) => (di === lastIdx ? { ...d, activities: kept } : d));
    return { ...stop, days };
  });

  return { ...it, stops };
}

function assertReworkable(it: GeneratedItinerary, stopIndex: number): void {
  if (it.tripType !== "route" || !it.stops || it.stops.length < 2) {
    throw new Error("Stop rework is only available on multi-stop road trips.");
  }
  if (stopIndex < 0 || stopIndex >= it.stops.length) {
    throw new Error("Invalid stop index.");
  }
  if (stopIndex === 0) {
    throw new Error("The starting city can't be removed or replaced.");
  }
}

/**
 * Remove a city stop and absorb its days into the previous stop, regenerating that
 * neighbor at the larger day count so the trip keeps its total length. The previous
 * stop's existing days are replaced with a fresh, longer plan.
 */
export async function removeStop(
  it: GeneratedItinerary,
  stopIndex: number,
  apiKey: string,
): Promise<GeneratedItinerary> {
  assertReworkable(it, stopIndex);

  const removed = it.stops[stopIndex];
  const absorbIdx = stopIndex - 1; // origin is index 0, so this is always >= 0
  const absorb = it.stops[absorbIdx];
  const newDayCount = absorb.days.length + removed.days.length;

  logger.info("removeStop: absorbing days into previous stop", {
    removing: removed.location, into: absorb.location, newDayCount,
  });

  const regenerated = await planSingleStop(it, absorb.location, newDayCount, apiKey);

  const stops = it.stops
    .filter((_, i) => i !== stopIndex)
    .map((s, i) => (i === absorbIdx ? { ...regenerated, location: absorb.location } : s));

  return relabelDays({ ...it, stops });
}

/**
 * Replace a city stop with a user-chosen city, generating its days at the same day
 * count so the trip keeps its length and shape.
 */
export async function replaceStop(
  it: GeneratedItinerary,
  stopIndex: number,
  newLocation: string,
  apiKey: string,
): Promise<GeneratedItinerary> {
  assertReworkable(it, stopIndex);

  const target = newLocation.trim();
  if (!target) throw new Error("A replacement city is required.");

  const cityKey = (s: string) => s.split(",")[0].trim().toLowerCase();
  if (it.stops.some((s, i) => i !== stopIndex && cityKey(s.location) === cityKey(target))) {
    throw new Error(`${target} is already a stop on this trip.`);
  }

  const dayCount = it.stops[stopIndex].days.length;
  logger.info("replaceStop", { from: it.stops[stopIndex].location, to: target, dayCount });

  const newStop = await planSingleStop(it, target, dayCount, apiKey);
  const stops = it.stops.map((s, i) => (i === stopIndex ? { ...newStop, location: target } : s));

  return relabelDays({ ...it, stops });
}

const SUGGEST_SCHEMA = {
  type: "object" as const,
  required: ["cities"],
  properties: {
    cities: {
      type: "array" as const,
      items: { type: "string" as const, description: "A specific city, e.g. \"Chattanooga, TN\"" },
      description: "2-3 alternative cities along the route",
    },
  },
};

/**
 * Suggest 2-3 alternative cities for the stop the user wants to swap out — along the
 * existing route, near the removed city, not duplicating any current stop. Reflects the
 * traveler's taste profile + interests (same selection logic as planStops), so a
 * hidden-gem lover gets offbeat towns and an iconic-leaner gets the popular ones. One
 * cheap Haiku call.
 */
export async function suggestStopAlternatives(
  it: GeneratedItinerary,
  stopIndex: number,
  tasteProfile?: TasteProfile,
): Promise<string[]> {
  assertReworkable(it, stopIndex);

  const route = it.stops.map((s) => s.location);
  const replacing = it.stops[stopIndex].location;
  const before = it.stops[stopIndex - 1]?.location;
  const after = it.stops[stopIndex + 1]?.location;

  // Reuse the planStops personalization so swap suggestions match how the route was
  // originally chosen (interests, vibes, taste scores, hidden-gem vs iconic dial).
  const tasteReq = { ...requestFromItinerary(it), tasteProfile };
  const personalization = formatStopPersonalization(tasteReq);
  const selection = stopSelectionGuidance(tasteReq);

  const prompt = `A traveler is on this road trip route (in order): ${route.join(" → ")}.
They want to replace the stop "${replacing}" with a different city.
${personalization}

${selection}

Suggest 2-3 alternative cities that:
- fit logically into the route between ${before ?? "the start"}${after ? ` and ${after}` : ""} (no big backtracking),
- match the traveler's taste and the selection guidance above,
- are a worthwhile overnight stop with things to do,
- are NOT already on the route above.
Return SPECIFIC cities (e.g. "Asheville, NC"), never whole states or regions.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: FAST_MODEL_NAME,
    max_tokens: 512,
    tools: [{
      name: "suggest_cities",
      description: "Suggest alternative cities for a road-trip stop",
      input_schema: SUGGEST_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "suggest_cities" },
    messages: [{ role: "user", content: prompt }],
  });

  const tool = response.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") return [];
  const raw = tool.input as { cities?: string[] };
  const existing = new Set(route.map((s) => s.split(",")[0].trim().toLowerCase()));
  return (raw.cities ?? [])
    .filter((c) => c && !existing.has(c.split(",")[0].trim().toLowerCase()))
    .slice(0, 3);
}
