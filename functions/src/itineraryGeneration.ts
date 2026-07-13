import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";

import { MODEL_NAME, FAST_MODEL_NAME, PROMPT_VERSION, ACTIVITY_TOOL_INPUT_SCHEMA } from "./constants";
import {
  generateItineraryRequestSchema,
  generatedItinerarySchema,
  getAllDays,
  mapAllDays,
  updateDayByIndex,
  type GenerateItineraryRequest,
  type GeneratedItinerary,
} from "./itinerarySchemas";

import {
  planStops, planItinerary, expandSeededItinerary, repairDay, parseAffectedDayNumbers,
  type SeedDay,
} from "./orchestration/tripPlanning";
import { scoreCandidatePool } from "./orchestration/candidateScoring";
import { buildStopPools, geocodeStop } from "./orchestration/contextBuilder";
import { validateItinerary } from "./orchestration/validation";
import { enrichTransportTimes, enrichDriveLegs } from "./orchestration/directions";
import { enrichWithImages } from "./orchestration/imageEnrichment";
import { searchNearbyForActivity } from "./orchestration/placesRetrieval";
import { reconcileItineraryPlaces, resolveActivityPlaces, enforceVerifiedPlaces, enforceDayGeographicCohesion } from "./orchestration/placeResolution";
import { shapeDriveDays } from "./orchestration/driveDayShaping";
import { fetchHikingTrails } from "./orchestration/trailDiscovery";
import { type OsmHike, type StopPool } from "./orchestration/types";

export { MODEL_NAME, PROMPT_VERSION };

// ─── Repair-pass budgeting ───────────────────────────────────────────────────
// The HTTP function is capped at 540s. After validation we still have to
// reconcile Places coords, enrich transport times, fetch images, and save —
// budget ~90s for that, so repair work must stop by ~450s of wall-clock time.
const REPAIR_DEADLINE_MS = 450_000;
// Re-validate after fixing the flagged days; a second pass catches stragglers.
const MAX_REPAIR_ATTEMPTS = 2;

// ─── Map a global (cross-stop) day index to its stop's location ──────────────
// Days are a flat sequence across all stops. Several single-day flows need the
// city/area a given global day belongs to so the LLM generates venues for the
// day's actual anchor city, not the trip-level destinationName (which is the
// first/overall city). Falls back to destinationName when stops are absent.
export function stopLocationForDayIndex(
  itinerary: GeneratedItinerary,
  dayIndex: number
): string {
  let cumulative = 0;
  for (const stop of itinerary.stops ?? []) {
    if (dayIndex < cumulative + stop.days.length) return stop.location;
    cumulative += stop.days.length;
  }
  return itinerary.destinationName;
}

// ─── Stamp OSM trail data onto matched hiking activities ─────────────────────

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(trail|path|loop|route|hike|trek|walk|national park|state park)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stampOsmTrailData(
  itinerary: GeneratedItinerary,
  osmHikes: import("./orchestration/types").OsmHike[]
): GeneratedItinerary {
  if (osmHikes.length === 0) return itinerary;

  return mapAllDays(itinerary, (day) => {
    const activities = day.activities.map((activity) => {
      const cat = (activity.category ?? "").toLowerCase();
      if (cat !== "adventure" && cat !== "nature") return activity;

      const normActivity = normalizeForMatch(activity.name);
      if (normActivity.length < 4) return activity;

      const match = osmHikes.find((hike) => {
        const normHike = normalizeForMatch(hike.name);
        return (
          normHike.length >= 4 &&
          (normActivity === normHike ||
            normActivity.includes(normHike) ||
            normHike.includes(normActivity))
        );
      });

      if (!match) return activity;

      return {
        ...activity,
        name: match.name,
        trailDistanceMiles: match.distanceMiles,
        trailDifficulty: match.difficulty,
        trailDurationHours: match.estimatedDurationHours,
      };
    });
    return { ...day, activities };
  });
}

// ─── Main orchestration pipeline ────────────────────────────────────────────

/**
 * Repair only the days validation flagged, in place, on the raw planner output.
 * Each day is a small focused Sonnet call (see repairDay); we stop early if the
 * shared wall-clock budget runs out so the caller ships best-effort rather than
 * letting the function time out. Returns the same (mutated) raw object.
 */
async function repairFlaggedDays(
  raw: Record<string, unknown>,
  dayNumbers: number[],
  fatalIssues: string[],
  input: GenerateItineraryRequest,
  pools: StopPool[],
  startedAt: number,
): Promise<Record<string, unknown>> {
  const stops = Array.isArray(raw.stops) ? (raw.stops as Array<Record<string, unknown>>) : [];

  // Map each global day index → (stopIndex, localIndex), in the same stop→day order
  // validation walks, so "Day N" lines line up with pools[stopIndex].
  const dayLocations: Array<{ stopIndex: number; localIndex: number }> = [];
  stops.forEach((stop, stopIndex) => {
    const days = Array.isArray(stop.days) ? stop.days : [];
    days.forEach((_d, localIndex) => dayLocations.push({ stopIndex, localIndex }));
  });

  const venueNamesIn = (day: Record<string, unknown>): string[] =>
    (Array.isArray(day.activities) ? (day.activities as Array<Record<string, unknown>>) : [])
      .map((a) => a.name)
      .filter((n): n is string => typeof n === "string");

  const allVenueNames = (): string[] => {
    const names: string[] = [];
    for (const stop of stops) {
      const days = Array.isArray(stop.days) ? (stop.days as Array<Record<string, unknown>>) : [];
      for (const day of days) names.push(...venueNamesIn(day));
    }
    return names;
  };

  for (const dayNumber of dayNumbers) {
    if (Date.now() - startedAt > REPAIR_DEADLINE_MS) {
      logger.warn("Pipeline: repair budget hit mid-pass — stopping", { stoppedBeforeDay: dayNumber });
      break;
    }
    const loc = dayLocations[dayNumber - 1];
    if (!loc) continue;
    const pool = pools[loc.stopIndex];
    if (!pool) continue;

    const days = stops[loc.stopIndex].days as Array<Record<string, unknown>>;
    const badDay = days[loc.localIndex];
    if (!badDay) continue;

    const dayIssues = fatalIssues.filter((s) => s.startsWith(`Day ${dayNumber}:`));
    const ownNames = new Set(venueNamesIn(badDay));
    const usedVenues = [...new Set(allVenueNames())].filter((n) => !ownNames.has(n));

    days[loc.localIndex] = await repairDay(badDay, dayNumber, dayIssues, input, pool, usedVenues);
  }

  return raw;
}

export async function generateItineraryFlow(
  input: GenerateItineraryRequest,
  googlePlacesApiKey?: string,
  seedDays?: SeedDay[],
): Promise<GeneratedItinerary> {
  generateItineraryRequestSchema.parse(input);
  const startedAt = Date.now();

  const durationDays = (() => {
    if (input.startDate && input.endDate) {
      const ms = new Date(input.endDate).getTime() - new Date(input.startDate).getTime();
      return Math.max(1, Math.round(ms / 86_400_000));
    }
    return 3;
  })();

  const tripType = input.tripType ?? "hub";
  const isNationalPark = input.destinationType === "national_park";

  // Step 1: Decide stops. Hub trips skip the LLM call (one stop = destination).
  logger.info("Pipeline: planning stops", { destination: input.destinationName, tripType });
  const stops = await planStops(input, durationDays);

  // Step 2: Fetch OSM trails per stop (parallel) + broad Places candidate pool per stop (parallel).
  let pools: import("./orchestration/types").StopPool[] = stops.map((s, i) => ({
    location: s.location,
    region: s.region,
    nightCount: s.nightCount,
    stopIndex: i,
    isFirstStop: i === 0,
    isLastStop: i === stops.length - 1,
    candidates: { breakfast: [], food: [], nightlife: [], attractions: [], scenic: [] },
    trails: [],
  }));

  if (googlePlacesApiKey) {
    try {
      logger.info("Pipeline: fetching candidate pools + trails per stop");

      // OSM trails need stop coordinates — geocode in parallel with pool fetch.
      const trailsByStopIndex: OsmHike[][] = await Promise.all(
        stops.map(async (s) => {
          const center = await geocodeStop(s.location, googlePlacesApiKey);
          if (!center) return [];
          try {
            return await fetchHikingTrails(center.lat, center.lng);
          } catch {
            return [];
          }
        })
      );

      pools = await buildStopPools(stops, googlePlacesApiKey, isNationalPark, trailsByStopIndex);

      // Re-rank candidate pools by taste profile before passing to the LLM
      if (input.tasteProfile) {
        pools = pools.map((pool) => ({
          ...pool,
          candidates: scoreCandidatePool(pool.candidates, input.tasteProfile, pool.nightCount),
        }));
      }

      logger.info("Pipeline: pools ready", {
        stops: pools.map((p) => `${p.location}: ${
          p.candidates.breakfast.length + p.candidates.food.length +
          p.candidates.nightlife.length + p.candidates.attractions.length +
          p.candidates.scenic.length
        } venues, ${p.trails.length} trails`),
      });
    } catch (error) {
      logger.warn("Pipeline: context building failed, continuing without Places data", { error });
    }
  }

  // Step 3: ONE Sonnet call produces the full itinerary. When seeded from a prebuilt
  // trip, expand its activities instead of planning from scratch.
  const hasSeed = Array.isArray(seedDays) && seedDays.length > 0;
  logger.info("Pipeline: planning itinerary (single Sonnet call)", { seeded: hasSeed });
  let rawItinerary = hasSeed
    ? await expandSeededItinerary(input, pools, durationDays, seedDays as SeedDay[])
    : await planItinerary(input, pools, durationDays);

  const finaliseAndStamp = (raw: Record<string, unknown>): GeneratedItinerary => {
    const parsed = generatedItinerarySchema.parse({
      ...raw,
      destinationId: input.destinationId,
      destinationName: (raw.destinationName as string) || input.destinationName,
      country: (raw.country as string) || input.country,
      budget: input.budget,
      interests: input.interests,
      travelerType: input.party,
      startDate: input.startDate,
      endDate: input.endDate,
      source: "ai_generated",
      tripType,
      model: MODEL_NAME,
      promptVersion: PROMPT_VERSION,
      isActive: true,
    });

    const allTrails = pools.flatMap((p) => p.trails);
    const stamped = stampOsmTrailData(parsed, allTrails);
    // Deterministic trip structure: mark the travel day at each non-final stop and
    // guarantee a real arrival-city dinner. Runs before validation so a complete
    // drive day never triggers an AI repair pass for a "missing dinner".
    return shapeDriveDays(stamped, pools);
  };

  // Step 4: Validate; on fatal failures, repair ONLY the flagged days. Each day is
  // a small focused Sonnet call, and we stop once the wall-clock budget is spent so
  // a slow multi-stop trip ships best-effort instead of hitting the function timeout.
  let withTrailData = finaliseAndStamp(rawItinerary);
  let { itinerary: validated, result } = validateItinerary(withTrailData);

  let repairAttempt = 0;
  while (!result.isValid && repairAttempt < MAX_REPAIR_ATTEMPTS) {
    if (Date.now() - startedAt > REPAIR_DEADLINE_MS) {
      logger.warn("Pipeline: repair budget exhausted — shipping best-effort", {
        elapsedMs: Date.now() - startedAt,
        remainingFatal: result.fatalIssues,
      });
      break;
    }

    const affectedDays = parseAffectedDayNumbers(result.fatalIssues); // 1-based global
    if (affectedDays.length === 0) break; // fatal issue not tied to a specific day

    logger.warn("Pipeline: validation failed — day-scoped repair pass", {
      attempt: repairAttempt + 1,
      affectedDays,
      fatalIssues: result.fatalIssues,
    });

    try {
      rawItinerary = await repairFlaggedDays(
        rawItinerary, affectedDays, result.fatalIssues, input, pools, startedAt,
      );
    } catch (error) {
      logger.warn("Pipeline: day-scoped repair failed — shipping current best", { error });
      break;
    }

    withTrailData = finaliseAndStamp(rawItinerary);
    ({ itinerary: validated, result } = validateItinerary(withTrailData));
    repairAttempt++;
  }

  if (!result.isValid) {
    logger.warn("Pipeline: shipping best-effort after repair", { remainingFatal: result.fatalIssues });
  } else if (result.issues.length > 0) {
    logger.info("Pipeline: validation passed with minor issues", { issues: result.issues });
  }

  // Step 5: Snap activities to real Google Places (accurate coords + placeId), then
  // enrich transport times with real Google Routes API data using those coords.
  let withTransportTimes = validated;
  if (googlePlacesApiKey) {
    try {
      logger.info("Pipeline: reconciling activity coordinates with Google Places");
      validated = await reconcileItineraryPlaces(validated, googlePlacesApiKey);
    } catch (error) {
      logger.warn("Pipeline: place reconciliation failed, keeping AI coords", { error });
    }
    // Hard gate: drop/replace any activity we couldn't verify against a real Place
    // or trail, so an AI-hallucinated location never reaches the user.
    try {
      const gated = enforceVerifiedPlaces(validated, pools);
      validated = gated.itinerary;
    } catch (error) {
      logger.warn("Pipeline: verified-places gate failed, keeping reconciled itinerary", { error });
    }
    // Pull any cross-city outlier back into its day's cluster so no single day has
    // activities in different towns hours apart.
    try {
      const cohesive = await enforceDayGeographicCohesion(validated, googlePlacesApiKey);
      validated = cohesive.itinerary;
    } catch (error) {
      logger.warn("Pipeline: day cohesion enforcement failed, keeping itinerary", { error });
    }
    try {
      logger.info("Pipeline: enriching transport times");
      withTransportTimes = await enrichTransportTimes(validated, googlePlacesApiKey);
    } catch (error) {
      logger.warn("Pipeline: transport enrichment failed, using estimates", { error });
      withTransportTimes = validated;
    }
    // Fill route metrics (duration/distance/polyline) onto drive days for the commute card.
    try {
      withTransportTimes = await enrichDriveLegs(withTransportTimes, googlePlacesApiKey);
    } catch (error) {
      logger.warn("Pipeline: drive-leg enrichment failed, keeping skeleton", { error });
    }
  }

  // Step 6: Pre-fetch images before push notification fires
  try {
    logger.info("Pipeline: pre-fetching images");
    return await enrichWithImages(withTransportTimes);
  } catch (error) {
    logger.warn("Pipeline: image enrichment failed, client will fetch on open", { error });
    return withTransportTimes;
  }
}

// ─── Partial regeneration: single activity ──────────────────────────────────

export interface RegenerateActivityInput {
  itinerary: GeneratedItinerary;
  dayIndex: number;
  activityIndex: number;
  reason?: string;
}

export async function regenerateActivity(
  input: RegenerateActivityInput
): Promise<GeneratedItinerary> {
  const { itinerary, dayIndex, activityIndex, reason } = input;
  const days = getAllDays(itinerary);
  const day = days[dayIndex];

  if (!day) throw new Error(`Day ${dayIndex} not found in itinerary`);

  const activity = day.activities[activityIndex];
  if (!activity) throw new Error(`Activity ${activityIndex} not found in day ${dayIndex}`);

  const prevActivity = activityIndex > 0 ? day.activities[activityIndex - 1] : null;
  const nextActivity = activityIndex < day.activities.length - 1
    ? day.activities[activityIndex + 1]
    : null;

  const existingVenues = days
    .flatMap((d) => d.activities.map((a) => a.name))
    .filter((n) => n !== activity.name)
    .join(", ");

  // Determine the stop location for this day
  const stopLocation = stopLocationForDayIndex(itinerary, dayIndex);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are replacing a single activity in a travel itinerary. Return only the replacement activity.

TRIP CONTEXT:
- Destination: ${stopLocation}${itinerary.country ? `, ${itinerary.country}` : ""}
- Budget: ${itinerary.budget ?? "moderate"}
- Day ${dayIndex + 1} theme: ${day.title ?? day.label}

ACTIVITY TO REPLACE:
- Name: ${activity.name}
- Type: ${activity.category}
- Time slot: ${activity.time}
${reason ? `- Reason for replacement: ${reason}` : ""}

CONTEXT AROUND THIS SLOT:
${prevActivity ? `- Previous activity ends at: ${prevActivity.time.split(" - ")[1]} at ${prevActivity.name}` : "- This is the first activity of the day"}
${nextActivity ? `- Next activity starts at: ${nextActivity.time.split(" - ")[0]} at ${nextActivity.name}` : "- This is the last activity of the day"}

RULES:
1. Keep the same time slot (${activity.time}) and same category (${activity.category}) unless the reason requests otherwise
2. Do NOT reuse any of these existing venues: ${existingVenues}
3. Use a real, well-known establishment in ${stopLocation}
4. Set transport to travel from this activity to: ${nextActivity?.name ?? "end of day"} (empty array if last)
5. Coordinates must be real (accurate lat/lng for ${stopLocation})`;

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: 1024,
    tools: [{
      name: "replace_activity",
      description: "Return a single replacement activity",
      input_schema: ACTIVITY_TOOL_INPUT_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "replace_activity" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Activity regeneration failed: no structured output");
  }

  const newActivity = toolBlock.input as typeof activity;

  const newDay = {
    ...day,
    activities: day.activities.map((a, ai) => (ai === activityIndex ? newActivity : a)),
  };

  return updateDayByIndex(itinerary, dayIndex, newDay);
}

// ─── Partial regeneration: full day ─────────────────────────────────────────

export interface RegenerateDayInput {
  itinerary: GeneratedItinerary;
  dayIndex: number;
  modifications?: {
    budget?: string;
    theme?: string;
    excludePlaces?: string[];
  };
  googlePlacesApiKey?: string;
}

export async function regenerateDay(input: RegenerateDayInput): Promise<GeneratedItinerary> {
  const { itinerary, dayIndex, modifications } = input;
  const days = getAllDays(itinerary);
  const day = days[dayIndex];

  if (!day) throw new Error(`Day ${dayIndex} not found in itinerary`);

  const existingVenues = days
    .flatMap((d, di) => (di !== dayIndex ? d.activities.map((a) => a.name) : []))
    .join(", ");

  const excludePlaces = [
    ...existingVenues.split(", "),
    ...(modifications?.excludePlaces ?? []),
  ].filter(Boolean);

  const budget = modifications?.budget ?? itinerary.budget ?? "moderate";
  const theme = modifications?.theme ?? day.title ?? day.label;

  // Find stop location for this day
  const stopLocation = stopLocationForDayIndex(itinerary, dayIndex);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are regenerating a single day in a travel itinerary.

TRIP CONTEXT:
- Destination: ${stopLocation}${itinerary.country ? `, ${itinerary.country}` : ""}
- Budget: ${budget}
- Interests: ${itinerary.interests?.join(", ") ?? "general sightseeing"}
- Day ${dayIndex + 1} theme: ${theme}

DO NOT USE any of these venues (used on other days): ${excludePlaces.join(", ")}

SLOT GRID — fill EVERY required slot. The day must run from 08:00 until at least 20:30.

  08:00–09:30  BREAKFAST   ★ required — café / bakery
  09:30–12:00  MORNING     ★ required — major activity or anchor experience
  12:00–14:00  LUNCH       ★ required — restaurant or café
  14:00–17:00  AFTERNOON   ★ required — museum / gallery / neighbourhood walk / scenic stop
  17:00–18:30  LATE AFTERNOON ◆ recommended — sunset spot, brewery, coffee, dessert
  18:30–20:30  DINNER      ★ required — full-service restaurant
  20:30–22:30  EVENING     ◆ recommended — bar, live music, dessert, night walk

RULES:
1. Minimum 6 activities. Day must end no earlier than 8:30 PM.
2. Specific named places only — no vague entries.
3. Realistic timing with transit between activities. No time overlaps.
4. Format times as "09:00 AM - 10:30 AM".
5. Realistic durations: breakfast 45–60 min, lunch 60–75 min, dinner 75–90 min, major attraction 2–3 hrs.
6. transport array describes how to reach the NEXT activity. Last activity = empty array.
7. Set category to "food" for all meals, "adventure" for hikes/trails, "nightlife" for bars.
8. Google Maps URLs: https://www.google.com/maps/search/?api=1&query=Place+Name+City
9. Use real coordinates for ${stopLocation}.
10. ALL activities must be in ${stopLocation} and within ~15 km of each other (a single city/area). Do NOT place activities in different towns on the same day.
11. At most ONE hike/trail for the whole day — vary the rest (culture, food, scenic, leisure). Never schedule multiple trails in one day.
12. Never put two meals back-to-back; separate every "food" activity from the next with a non-food activity.`;

  const DAY_SCHEMA = {
    type: "object" as const,
    required: ["label", "title", "activities"],
    properties: {
      label: { type: "string" },
      title: { type: "string" },
      isDriveDay: { type: "boolean" },
      activities: {
        type: "array",
        minItems: 6,
        items: ACTIVITY_TOOL_INPUT_SCHEMA,
      },
    },
  };

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: 4096,
    tools: [{
      name: "replace_day",
      description: "Return a complete replacement day",
      input_schema: DAY_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "replace_day" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Day regeneration failed: no structured output");
  }

  const newDay = toolBlock.input as typeof day;
  return updateDayByIndex(itinerary, dayIndex, newDay);
}

// ─── Specific type inference for replacement relevance ──────────────────────

function inferSpecificType(name: string, category: string): string {
  const n = name.toLowerCase();
  if (category === "food") {
    if (/coffee|café|cafe|espresso|latte|cappuccino/i.test(n)) return "coffee shop or café";
    if (/bar|pub|brewery|tavern|taproom/i.test(n)) return "bar or brewery";
    if (/bakery|pastry|boulangerie|patisserie/i.test(n)) return "bakery or pastry shop";
    if (/ramen|sushi|noodle|pho|udon/i.test(n)) return "noodle or Asian restaurant";
    if (/pizza|trattoria|osteria/i.test(n)) return "Italian restaurant";
    if (/taco|burrito|cantina/i.test(n)) return "Mexican restaurant";
    return "restaurant";
  }
  if (category === "culture" || category === "attraction" || category === "museum") {
    if (/museum/i.test(n)) return "museum";
    if (/gallery/i.test(n)) return "art gallery";
    if (/theater|theatre/i.test(n)) return "theater";
    if (/cathedral|church|temple|mosque/i.test(n)) return "historic religious site";
    return "cultural attraction or landmark";
  }
  if (category === "adventure" || category === "nature") {
    if (/trail|hike|trek/i.test(n)) return "hiking trail";
    if (/beach/i.test(n)) return "beach";
    if (/park/i.test(n)) return "park or garden";
    if (/waterfall/i.test(n)) return "waterfall or natural feature";
    return "outdoor activity";
  }
  if (category === "nightlife") return "bar or nightlife venue";
  if (category === "wellness") return "spa or wellness center";
  if (category === "shopping") return "market or shopping spot";
  return category;
}

function nearbyTypesForActivity(name: string, category: string): string[] | undefined {
  if (category !== "food") return undefined;
  if (/coffee|café|cafe|espresso/i.test(name)) return ["cafe"];
  if (/bar|pub|brewery|tavern/i.test(name)) return ["bar", "night_club"];
  if (/bakery|pastry/i.test(name)) return ["bakery"];
  return undefined;
}

// ─── Get suggested replacements for a single activity ───────────────────────

export interface GetSuggestedReplacementsInput {
  itinerary: GeneratedItinerary;
  dayIndex: number;
  activityIndex: number;
  reason?: string;
  count?: number;
  googlePlacesApiKey?: string;
}

export async function getSuggestedReplacements(
  input: GetSuggestedReplacementsInput
): Promise<GeneratedItinerary["stops"][number]["days"][number]["activities"]> {
  const { itinerary, dayIndex, activityIndex, reason, count = 3, googlePlacesApiKey } = input;
  const days = getAllDays(itinerary);
  const day = days[dayIndex];
  if (!day) throw new Error(`Day ${dayIndex} not found in itinerary`);
  const activity = day.activities[activityIndex];
  if (!activity) throw new Error(`Activity ${activityIndex} not found in day ${dayIndex}`);

  const prevActivity = activityIndex > 0 ? day.activities[activityIndex - 1] : null;
  const nextActivity = activityIndex < day.activities.length - 1
    ? day.activities[activityIndex + 1]
    : null;

  const existingVenues = days
    .flatMap((d) => d.activities.map((a) => a.name))
    .join(", ");

  // Find stop location for this day
  const stopLocation = stopLocationForDayIndex(itinerary, dayIndex);

  const specificType = inferSpecificType(activity.name, activity.category ?? "");
  const isLocationAware = (reason === "similar_nearby" || reason === "hidden_gem" || reason === "cheaper") && activity.coordinates;
  let nearbyContext = "";

  if (isLocationAware && googlePlacesApiKey && activity.coordinates) {
    try {
      let nearby = await searchNearbyForActivity(
        activity.coordinates.latitude,
        activity.coordinates.longitude,
        activity.category ?? "attraction",
        googlePlacesApiKey,
        {
          hiddenGemMode: reason === "hidden_gem",
          radiusMeters: reason === "hidden_gem" ? 2000 : 1500,
          typesOverride: nearbyTypesForActivity(activity.name, activity.category ?? ""),
        }
      );

      // For cheaper: filter to low-price venues only (free or inexpensive)
      if (reason === "cheaper") {
        nearby = nearby.filter((p) => p.priceLevel <= 2);
      }

      const filtered = nearby
        .filter((p) => !existingVenues.toLowerCase().includes(p.name.toLowerCase()))
        .slice(0, 12);

      if (filtered.length > 0) {
        nearbyContext = `\nREAL NEARBY PLACES FROM GOOGLE (use these as your primary source):\n` +
          filtered.map((p, i) =>
            `${i + 1}. ${p.name} — rating ${p.rating}/5 (${p.reviewCount} reviews), ${p.address}`
          ).join("\n") +
          `\nFormat the best ${count} of these as complete activities. Only use places from this list.`;
      }
    } catch {
      // Falls through to AI-only path
    }
  }

  const reasonInstructions: Record<string, string> = {
    cheaper: "Prioritize FREE or low-cost options. Each candidate must cost less than the original.",
    similar_nearby: "Each candidate must be the same category and geographically close to the original coordinates.",
    more_relaxing: "Prioritize wellness, parks, cafes, or low-intensity cultural experiences.",
    more_popular: "Prioritize highly-rated, well-known attractions with strong review counts.",
    hidden_gem: "Prioritize lesser-known places with fewer than 800 reviews but high ratings — spots locals love that tourists miss.",
  };

  const reasonHint = reason && reasonInstructions[reason]
    ? `\nSPECIAL REQUIREMENT: ${reasonInstructions[reason]}`
    : reason ? `\nReason for replacement: ${reason}` : "";

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const CANDIDATES_SCHEMA = {
    type: "object" as const,
    required: ["candidates"],
    properties: {
      candidates: {
        type: "array",
        description: `Exactly ${count} distinct replacement activity options`,
        minItems: count,
        maxItems: count,
        items: ACTIVITY_TOOL_INPUT_SCHEMA,
      },
    },
  };

  const prompt = `You are suggesting ${count} distinct replacement activities for a travel itinerary. Return exactly ${count} different options.

TRIP CONTEXT:
- Location: ${stopLocation}${itinerary.country ? `, ${itinerary.country}` : ""}
- Budget: ${itinerary.budget ?? "moderate"}
- Day ${dayIndex + 1} theme: ${day.title ?? day.label}

ACTIVITY TO REPLACE:
- Name: ${activity.name}
- Specific type: ${specificType}
- Category: ${activity.category}
- Time slot: ${activity.time}
${reasonHint}

CONTEXT AROUND THIS SLOT:
${prevActivity ? `- Previous activity: ${prevActivity.name} (ends ${prevActivity.time.split(" - ")[1]})` : "- This is the first activity of the day"}
${nextActivity ? `- Next activity: ${nextActivity.name} (starts ${nextActivity.time.split(" - ")[0]})` : "- This is the last activity of the day"}

${nearbyContext}
RULES:
1. Each candidate must keep the same time slot (${activity.time})
2. CATEGORY MATCH — CRITICAL: every candidate must be the same specific type as the original.
   "${activity.name}" is a ${specificType}. Only suggest ${specificType}s as replacements.
   Do NOT suggest a restaurant if replacing a coffee shop. Do NOT suggest a museum if replacing a bar.
3. Do NOT reuse any of these existing venues: ${existingVenues}
4. All ${count} candidates must be different from each other
5. ${nearbyContext ? "Use the real nearby places listed above" : `Use real, well-known establishments in ${stopLocation}`}
6. Set transport to travel from the candidate to: ${nextActivity?.name ?? "end of day"} (empty array if last)
7. Image field: set to empty string`;

  const response = await client.messages.create({
    // Fast model, same as editItineraryWithLanguage/optimizeDay: this is a
    // user-facing interactive path, and the task (format the best ${count} of a
    // supplied real-places list) doesn't need the heavyweight model. Candidates
    // are still snapped to verified Google Places below.
    model: FAST_MODEL_NAME,
    max_tokens: 2048,
    tools: [{
      name: "suggest_replacements",
      description: `Return ${count} distinct replacement activity options`,
      input_schema: CANDIDATES_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "suggest_replacements" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("getSuggestedReplacements failed: no structured output");
  }

  const { candidates } = toolBlock.input as { candidates: GeneratedItinerary["stops"][number]["days"][number]["activities"] };

  // Snap each candidate to its real Google Place so the preview coordinates,
  // placeId, and map URL are correct before the user picks one.
  if (googlePlacesApiKey) {
    const { activities: resolved } = await resolveActivityPlaces(candidates, stopLocation, googlePlacesApiKey);
    return resolved;
  }
  return candidates;
}

// ─── Edit itinerary via natural language ────────────────────────────────────

export type ItineraryMutation =
  | { op: "replace_activity"; dayIndex: number; activityIndex: number; activity: GeneratedItinerary["stops"][number]["days"][number]["activities"][number] }
  | { op: "remove_activity"; dayIndex: number; activityIndex: number }
  | { op: "reorder_day"; dayIndex: number; newOrder: number[] };

export interface EditItineraryWithLanguageInput {
  itinerary: GeneratedItinerary;
  message: string;
  // The day the user is currently viewing. When set, mutations are clamped to
  // this day so a request that says "today" can't churn unrelated days.
  dayIndex?: number;
  // When true (pill/chip-originated requests that always mean "this day"),
  // every mutation is force-scoped onto dayIndex rather than dropped if the
  // model misattributes it to another day — so the action can't silently no-op.
  forceScopeToDay?: boolean;
}

export interface ApplyMutationsOptions {
  // Drop any mutation that targets a different global day index.
  scopeDayIndex?: number;
  // Activity indices (within scopeDayIndex's day) that must not be replaced or
  // removed — used by optimizeDay to honour locked activities.
  lockedActivityIndices?: number[];
}

// Pure reducer: apply a list of mutations to an itinerary. Extracted from the
// edit/optimize flows so the mutation semantics are unit-testable without the
// LLM. reorder never drops activities — indices missing from newOrder are
// appended in their original order.
export function applyMutations(
  itinerary: GeneratedItinerary,
  mutations: ItineraryMutation[],
  options: ApplyMutationsOptions = {}
): GeneratedItinerary {
  const { scopeDayIndex, lockedActivityIndices = [] } = options;
  const locked = new Set(lockedActivityIndices);
  let result = itinerary;

  for (const mutation of mutations) {
    if (scopeDayIndex !== undefined && mutation.dayIndex !== scopeDayIndex) continue;

    const day = getAllDays(result)[mutation.dayIndex];
    if (!day) continue;

    if (mutation.op === "replace_activity") {
      const { activityIndex, activity } = mutation;
      if (locked.has(activityIndex)) continue;
      const old = day.activities[activityIndex];
      if (!old) continue;
      // Preserve verified trail data when the replacement is really the same trail
      // (same normalized name) but came back without the OSM/Waymark metadata — e.g.
      // a schedule/edit pass that re-emitted the trail as a plain AI activity. Without
      // this the trail silently loses its distance / difficulty / duration.
      let merged = activity;
      if (old.trailDistanceMiles != null && activity.trailDistanceMiles == null &&
          normalizeForMatch(old.name) === normalizeForMatch(activity.name ?? "")) {
        merged = {
          ...activity,
          trailDistanceMiles: old.trailDistanceMiles,
          trailDifficulty: old.trailDifficulty,
          trailDurationHours: old.trailDurationHours,
        };
      }
      result = updateDayByIndex(result, mutation.dayIndex, {
        ...day,
        activities: day.activities.map((a, ai) => (ai === activityIndex ? merged : a)),
      });
    } else if (mutation.op === "remove_activity") {
      const { activityIndex } = mutation;
      if (locked.has(activityIndex)) continue;
      result = updateDayByIndex(result, mutation.dayIndex, {
        ...day,
        activities: day.activities.filter((_, i) => i !== activityIndex),
      });
    } else if (mutation.op === "reorder_day") {
      const original = day.activities;
      const safeOrder = mutation.newOrder.filter((i) => i >= 0 && i < original.length);
      const missing = original.map((_, i) => i).filter((i) => !safeOrder.includes(i));
      result = updateDayByIndex(result, mutation.dayIndex, {
        ...day,
        activities: [...safeOrder, ...missing].map((i) => original[i]),
      });
    }
  }

  return result;
}

export async function editItineraryWithLanguage(
  input: EditItineraryWithLanguageInput
): Promise<GeneratedItinerary> {
  const { itinerary, message, dayIndex, forceScopeToDay } = input;
  const days = getAllDays(itinerary);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const MUTATIONS_SCHEMA = {
    type: "object" as const,
    required: ["mutations"],
    properties: {
      mutations: {
        type: "array",
        description: "Ordered list of mutations to apply to the itinerary",
        items: {
          type: "object",
          required: ["op"],
          properties: {
            op: { type: "string", enum: ["replace_activity", "remove_activity", "reorder_day"] },
            dayIndex: { type: "number" },
            activityIndex: { type: "number" },
            activity: ACTIVITY_TOOL_INPUT_SCHEMA,
            newOrder: { type: "array", items: { type: "number" } },
          },
        },
      },
    },
  };

  // Build summary with stop context
  const stopBoundaries: number[] = [];
  let cumulative = 0;
  for (const stop of itinerary.stops) {
    stopBoundaries.push(cumulative);
    cumulative += stop.days.length;
  }

  const itinerarySummary = days.map((day, di) => {
    let stopIdx = 0;
    for (let si = stopBoundaries.length - 1; si >= 0; si--) {
      if (di >= stopBoundaries[si]) { stopIdx = si; break; }
    }
    const stop = itinerary.stops[stopIdx];
    return `Day ${di + 1} [${stop?.location ?? itinerary.destinationName}] (${day.title ?? day.label}):\n` +
      day.activities.map((a, ai) => `  [${di},${ai}] ${a.time} — ${a.name} (${a.category ?? "general"})`).join("\n");
  }).join("\n\n");

  const viewingStopLocation = dayIndex !== undefined
    ? stopLocationForDayIndex(itinerary, dayIndex)
    : undefined;

  const viewingDayHint = dayIndex !== undefined
    ? `\nThe user is currently viewing Day ${dayIndex + 1}, which is in ${viewingStopLocation}.` +
      (forceScopeToDay
        ? ` This request applies ONLY to Day ${dayIndex + 1} (dayIndex ${dayIndex}). Every mutation MUST use dayIndex ${dayIndex} — do not touch any other day.`
        : ` Unless the request clearly refers to other days or the whole trip, only mutate Day ${dayIndex + 1} (dayIndex ${dayIndex}).`) +
      ` Any replace_activity for this day MUST be a real venue in ${viewingStopLocation}, NOT in ${itinerary.destinationName} or any other stop.`
    : "";

  const prompt = `You are an AI travel assistant helping a user modify their itinerary through natural language.

ITINERARY: ${itinerary.destinationName}${itinerary.country ? `, ${itinerary.country}` : ""}
Budget: ${itinerary.budget ?? "moderate"}
Trip type: ${itinerary.tripType ?? "hub"}

CURRENT SCHEDULE (each day is tagged with its city/area in [brackets]):
${itinerarySummary}

USER REQUEST: "${message}"
${viewingDayHint}
Analyze the request and return the minimal set of mutations needed.
- dayIndex uses global 0-based numbering across all stops
- For replace_activity, generate a real replacement in the SAME city/area shown in [brackets] for that day
- Only mutate what is necessary — preserve the rest of the itinerary`;

  const response = await client.messages.create({
    model: FAST_MODEL_NAME,
    max_tokens: 2048,
    tools: [{
      name: "edit_itinerary",
      description: "Return structured mutations to apply to the itinerary",
      input_schema: MUTATIONS_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "edit_itinerary" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("editItineraryWithLanguage failed: no structured output");
  }

  const { mutations } = toolBlock.input as { mutations: ItineraryMutation[] };

  // Pill/chip requests always mean "the day I'm viewing". Force every mutation
  // onto that day (mirroring optimizeDay) so a misattributed dayIndex can't make
  // the action silently no-op. Free-text edits keep day-scoped dropping so the
  // model may legitimately reference other days the user named.
  if (forceScopeToDay && dayIndex !== undefined) {
    const dayScoped = mutations.map((m) => ({ ...m, dayIndex }));
    return applyMutations(itinerary, dayScoped, { scopeDayIndex: dayIndex });
  }

  return applyMutations(itinerary, mutations, { scopeDayIndex: dayIndex });
}

// ─── Optimize a single day ───────────────────────────────────────────────────

export type OptimizeDayMode =
  | "minimize_walking"
  | "minimize_cost"
  | "relax_mode"
  | "maximize_sightseeing"
  | "foodie_mode";

export interface OptimizeDayInput {
  itinerary: GeneratedItinerary;
  dayIndex: number;
  mode: OptimizeDayMode;
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

function nearestNeighborOrder(
  activities: GeneratedItinerary["stops"][number]["days"][number]["activities"]
): number[] {
  const withCoords = activities.map((a, i) => ({ i, coords: a.coordinates }));
  if (withCoords.every((a) => !a.coords)) return activities.map((_, i) => i);

  const visited = new Set<number>();
  const order: number[] = [];
  let current = 0;
  visited.add(0);
  order.push(0);

  while (order.length < activities.length) {
    const currentCoords = activities[current].coordinates;
    let bestDist = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < activities.length; i++) {
      if (visited.has(i)) continue;
      const coords = activities[i].coordinates;
      const dist = currentCoords && coords
        ? haversineKm(currentCoords.latitude, currentCoords.longitude, coords.latitude, coords.longitude)
        : Infinity;
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }

    if (bestIdx === -1) {
      const remaining = activities.map((_, i) => i).find((i) => !visited.has(i));
      if (remaining === undefined) break;
      bestIdx = remaining;
    }

    visited.add(bestIdx);
    order.push(bestIdx);
    current = bestIdx;
  }

  return order;
}

export async function optimizeDay(
  input: OptimizeDayInput
): Promise<GeneratedItinerary> {
  const { itinerary, dayIndex, mode } = input;
  const days = getAllDays(itinerary);
  const day = days[dayIndex];
  if (!day) throw new Error(`Day ${dayIndex} not found in itinerary`);

  const lockedActivities = day.activities
    .map((a, i) => ({ i, locked: a.locked ?? false }))
    .filter(({ locked }) => locked)
    .map(({ i }) => i);

  if (mode === "minimize_walking") {
    // Meals must stay in their time-based positions — only reorder non-meal activities.
    // Extract non-meal activities, run nearest-neighbor on them, then slot them back.
    const mealIndices = new Set(
      day.activities.map((a, i) => ({ i, isFood: a.category === "food" }))
        .filter(({ isFood }) => isFood)
        .map(({ i }) => i)
    );
    const nonMealActivities = day.activities.filter((_, i) => !mealIndices.has(i));
    const nonMealOrder = nearestNeighborOrder(nonMealActivities);
    const reorderedNonMeals = nonMealOrder.map((i) => nonMealActivities[i]);

    let nonMealCursor = 0;
    const rebuilt = day.activities.map((a, i) =>
      mealIndices.has(i) ? a : reorderedNonMeals[nonMealCursor++]
    );
    // Only return early if the reorder actually changed the order. Otherwise the
    // day was already nearest-neighbor ordered and the user would see no effect —
    // fall through to the LLM path below to swap the most-distant outlier instead.
    const changed = nonMealOrder.some((srcIdx, i) => srcIdx !== i);
    if (changed) {
      return updateDayByIndex(itinerary, dayIndex, { ...day, activities: rebuilt });
    }
  }

  // Find stop location for this day
  const stopLocation = stopLocationForDayIndex(itinerary, dayIndex);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const modeInstructions: Record<string, string> = {
    minimize_walking: "The day is already in the most walkable order, so reduce walking further by replacing the single activity that is farthest from the others with a real alternative closer to the rest of the day's stops. Keep all meals. Use replace_activity only.",
    minimize_cost: "Replace expensive activities with free or cheap alternatives. Keep all meals. Use replace_activity only.",
    relax_mode: "Replace back-to-back high-energy activities with cafes, parks, or leisurely experiences. Optionally use remove_activity to cut one rushed stop. Keep all meals.",
    maximize_sightseeing: "Upgrade EVERY non-meal slot that is not already a top-tier sight into a top-rated landmark, museum, gallery, or cultural site. Go through the activities in order and emit a replace_activity for each one that is a casual walk, shopping, generic stop, or minor attraction — typically 2–4 replacements, not just one. KEEP ALL MEALS unchanged. Use replace_activity only — NEVER use remove_activity. The goal is more and better sights across the whole day, not a single swap.",
    foodie_mode: "Replace non-food activities with notable restaurants, local markets, or famous food experiences. Keep at least 2 non-food activities per day.",
  };

  const activityList = day.activities.map((a, i) =>
    `[${i}] ${a.time} — ${a.name} (${a.category ?? "general"}, cost: ${a.cost ?? "?"})${lockedActivities.includes(i) ? " 🔒 LOCKED" : ""}`
  ).join("\n");

  const OPTIMIZE_SCHEMA = {
    type: "object" as const,
    required: ["mutations"],
    properties: {
      mutations: {
        type: "array",
        items: {
          type: "object",
          required: ["op"],
          properties: {
            op: { type: "string", enum: ["replace_activity", "remove_activity", "reorder_day"] },
            dayIndex: { type: "number" },
            activityIndex: { type: "number" },
            activity: ACTIVITY_TOOL_INPUT_SCHEMA,
            newOrder: { type: "array", items: { type: "number" } },
          },
        },
      },
    },
  };

  const modeGuard = mode === "maximize_sightseeing"
    ? "\n⚠️ CRITICAL: Do NOT use remove_activity. Replace EVERY non-meal slot that isn't already a major sight — return multiple replace_activity mutations (one per upgraded slot), not just one."
    : mode === "relax_mode"
    ? "\n⚠️ Remove at most 1 activity. Prefer replace_activity over remove_activity."
    : "";

  const prompt = `Optimize day ${dayIndex + 1} of a travel itinerary.

LOCATION: ${stopLocation}${itinerary.country ? `, ${itinerary.country}` : ""}
OPTIMIZATION MODE: ${mode.replace(/_/g, " ").toUpperCase()}
GOAL: ${modeInstructions[mode] ?? mode}${modeGuard}

CURRENT DAY ACTIVITIES:
${activityList}

RULES:
- Do NOT modify LOCKED activities (marked with 🔒)
- Locked activity indices: [${lockedActivities.join(", ")}]
- Use reorder_day for reordering. Use replace_activity to swap in a new activity. Use remove_activity to delete.
- Any replacement MUST be a real venue in ${stopLocation}, within ~15 km of the other activities — never another city.
- All operations reference dayIndex: ${dayIndex}
- Return only the mutations needed to achieve the goal`;

  const response = await client.messages.create({
    model: FAST_MODEL_NAME,
    max_tokens: 2048,
    tools: [{
      name: "optimize_day",
      description: "Return mutations to optimize the day",
      input_schema: OPTIMIZE_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "optimize_day" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("optimizeDay failed: no structured output");
  }

  const { mutations } = toolBlock.input as { mutations: ItineraryMutation[] };

  // The model is instructed that every op targets this day; force dayIndex so an
  // omitted/incorrect value can't redirect a mutation elsewhere.
  const dayScoped = mutations.map((m) => ({ ...m, dayIndex }));

  return applyMutations(itinerary, dayScoped, {
    scopeDayIndex: dayIndex,
    lockedActivityIndices: lockedActivities,
  });
}
