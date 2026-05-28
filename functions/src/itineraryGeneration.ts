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

import { extractIntent } from "./orchestration/intentExtraction";
import { generateTripStrategy } from "./orchestration/tripStrategy";
import { fetchRecommendations, fetchNearbyForClusters, searchNearbyForActivity } from "./orchestration/placesRetrieval";
import { rankRecommendations } from "./orchestration/ranking";
import { clusterForStop } from "./orchestration/clustering";
import { generateDailyPlans } from "./orchestration/dailyPlanning";
import { validateItinerary } from "./orchestration/validation";
import { enrichTransportTimes } from "./orchestration/directions";
import { buildCacheKey, getCachedPlaces, setCachedPlaces } from "./orchestration/placesCache";
import { fetchHikingTrails } from "./orchestration/trailDiscovery";
import { type StopClusters, type RankedPlace } from "./orchestration/types";

export { MODEL_NAME, PROMPT_VERSION };

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

// ─── Merge real Google Places data into Claude-generated output ──────────────

function mergePlaceData(
  itinerary: GeneratedItinerary,
  ranked: RankedPlace[]
): GeneratedItinerary {
  if (ranked.length === 0) return itinerary;

  const byName = new Map(ranked.map((p) => [p.name.toLowerCase(), p]));

  return mapAllDays(itinerary, (day) => {
    const activities = day.activities.map((activity) => {
      const match = byName.get(activity.name.toLowerCase());
      if (!match) return activity;

      const updates: Partial<typeof activity> = {};
      if (match.rating > 0) {
        updates.rating = match.rating;
        updates.reviewCount = match.reviewCount;
      }
      if (match.editorialSummary) {
        updates.description = match.editorialSummary;
      }
      return { ...activity, ...updates };
    });
    return { ...day, activities };
  });
}

// ─── Main orchestration pipeline ────────────────────────────────────────────

export async function generateItineraryFlow(
  input: GenerateItineraryRequest,
  googlePlacesApiKey?: string
): Promise<GeneratedItinerary> {
  generateItineraryRequestSchema.parse(input);

  // Step 1: Extract structured intent
  logger.info("Pipeline: extracting intent", { destination: input.destinationName, tripType: input.tripType });
  const intent = await extractIntent(input);

  // Step 2: Generate trip strategy (now returns stops[])
  logger.info("Pipeline: generating trip strategy", { pace: intent.pace, days: intent.durationDays, tripType: intent.tripType });
  const strategy = await generateTripStrategy(intent);

  logger.info("Pipeline: strategy generated", {
    stopCount: strategy.stops.length,
    stops: strategy.stops.map(s => `${s.location} (${s.nightCount}n)`),
  });

  // Steps 3–5: For each stop, fetch places, rank, cluster, get trails
  const allRanked: RankedPlace[] = [];
  const stopClusters: StopClusters[] = [];

  for (let stopIndex = 0; stopIndex < strategy.stops.length; stopIndex++) {
    const stop = strategy.stops[stopIndex];
    logger.info(`Pipeline: processing stop ${stopIndex + 1}/${strategy.stops.length}`, { location: stop.location });

    let ranked: RankedPlace[] = [];

    if (googlePlacesApiKey && stop.searchQueries.length > 0) {
      const cacheKey = buildCacheKey(stop.location, intent.budget, intent.interests);
      let candidates = await getCachedPlaces(cacheKey);

      if (!candidates) {
        logger.info("Pipeline: cache miss — fetching from Google Places", { stop: stop.location, queryCount: stop.searchQueries.length });
        candidates = await fetchRecommendations(stop.searchQueries, googlePlacesApiKey);
        await setCachedPlaces(cacheKey, candidates);
      } else {
        logger.info("Pipeline: cache hit", { stop: stop.location });
      }

      ranked = rankRecommendations(candidates, intent);
      allRanked.push(...ranked);
      logger.info("Pipeline: ranking complete", { stop: stop.location, candidateCount: candidates.length, rankedCount: ranked.length });
    } else {
      logger.info("Pipeline: skipping Google Places for stop", { stop: stop.location });
    }

    // Cluster into this stop's days
    let clusters = clusterForStop(ranked, stopIndex, stop.nightCount, stop.dayThemes);

    // Nearby search enrichment per cluster
    if (googlePlacesApiKey && clusters.length > 0) {
      clusters = await fetchNearbyForClusters(clusters, googlePlacesApiKey, input.destinationType ?? 'city');
    }

    // Fetch OSM trails for this stop's geographic center
    const clusterCenterLat = clusters.length > 0
      ? clusters.reduce((s, c) => s + c.centerLat, 0) / clusters.length
      : undefined;
    const clusterCenterLng = clusters.length > 0
      ? clusters.reduce((s, c) => s + c.centerLng, 0) / clusters.length
      : undefined;

    const osmHikes = clusterCenterLat !== undefined && clusterCenterLng !== undefined
      ? await fetchHikingTrails(clusterCenterLat, clusterCenterLng)
      : [];

    logger.info("Pipeline: stop processing complete", {
      stop: stop.location,
      clusterCount: clusters.length,
      trailsFound: osmHikes.length,
    });

    stopClusters.push({ stopIndex, stop, clusters, osmHikes });
  }

  // Step 6: Generate all daily plans in one Claude call
  logger.info("Pipeline: generating daily plans");
  const rawItinerary = await generateDailyPlans(stopClusters, intent, strategy);

  // Step 7: Parse with schema
  const parsed = generatedItinerarySchema.parse({
    ...rawItinerary,
    destinationId: input.destinationId,
    destinationName: (rawItinerary.destinationName as string) || input.destinationName,
    country: (rawItinerary.country as string) || input.country,
    budget: input.budget,
    interests: input.interests,
    travelerType: input.party,
    startDate: input.startDate,
    endDate: input.endDate,
    source: "ai_generated",
    tripType: intent.tripType,
    model: MODEL_NAME,
    promptVersion: PROMPT_VERSION,
    isActive: true,
  });

  // Step 7b: Merge real ratings and editorial descriptions from Google Places
  logger.info("Pipeline: merging real place data");
  const withPlaceData = mergePlaceData(parsed, allRanked);

  // Step 8: Validate
  logger.info("Pipeline: validating itinerary");
  const { itinerary: validated, result } = validateItinerary(withPlaceData);

  if (result.issues.length > 0) {
    logger.info("Pipeline: validation issues", { issues: result.issues, repaired: result.repaired });
  }

  // Step 9: Stamp OSM trail data (use all trails from all stops)
  const allOsmHikes = stopClusters.flatMap(sc => sc.osmHikes);
  const withTrailData = stampOsmTrailData(validated, allOsmHikes);

  // Step 10: Enrich transport times with real Google Distance Matrix data
  if (googlePlacesApiKey) {
    try {
      logger.info("Pipeline: enriching transport times");
      return await enrichTransportTimes(withTrailData, googlePlacesApiKey);
    } catch (error) {
      logger.warn("Pipeline: transport enrichment failed, using estimates", { error });
    }
  }

  return withTrailData;
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
  let stopLocation = itinerary.destinationName;
  let cumulative = 0;
  for (const stop of itinerary.stops) {
    if (dayIndex < cumulative + stop.days.length) {
      stopLocation = stop.location;
      break;
    }
    cumulative += stop.days.length;
  }

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
  let stopLocation = itinerary.destinationName;
  let cumulative = 0;
  for (const stop of itinerary.stops) {
    if (dayIndex < cumulative + stop.days.length) {
      stopLocation = stop.location;
      break;
    }
    cumulative += stop.days.length;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are regenerating a single day in a travel itinerary.

TRIP CONTEXT:
- Destination: ${stopLocation}${itinerary.country ? `, ${itinerary.country}` : ""}
- Budget: ${budget}
- Interests: ${itinerary.interests?.join(", ") ?? "general sightseeing"}
- Day ${dayIndex + 1} theme: ${theme}

DO NOT USE any of these venues (used on other days): ${excludePlaces.join(", ")}

RULES:
1. Include breakfast, lunch, AND dinner at real named restaurants in ${stopLocation}
2. Specific named places only — no vague entries
3. Realistic timing with transit between activities
4. Format times as "09:00 AM - 10:30 AM"
5. Transport array for each activity pointing to the next
6. Google Maps URLs: https://www.google.com/maps/search/?api=1&query=Place+Name+City
7. Use real coordinates for ${stopLocation}`;

  const DAY_SCHEMA = {
    type: "object" as const,
    required: ["label", "activities"],
    properties: {
      label: { type: "string" },
      title: { type: "string" },
      isDriveDay: { type: "boolean" },
      activities: {
        type: "array",
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
  let stopLocation = itinerary.destinationName;
  let cumulative = 0;
  for (const stop of itinerary.stops) {
    if (dayIndex < cumulative + stop.days.length) {
      stopLocation = stop.location;
      break;
    }
    cumulative += stop.days.length;
  }

  const isLocationAware = (reason === "similar_nearby" || reason === "hidden_gem") && activity.coordinates;
  let nearbyContext = "";

  if (isLocationAware && googlePlacesApiKey && activity.coordinates) {
    try {
      const nearby = await searchNearbyForActivity(
        activity.coordinates.latitude,
        activity.coordinates.longitude,
        activity.category ?? "attraction",
        googlePlacesApiKey,
        {
          hiddenGemMode: reason === "hidden_gem",
          radiusMeters: reason === "hidden_gem" ? 2000 : 1500,
        }
      );
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
- Type: ${activity.category}
- Time slot: ${activity.time}
${reasonHint}

CONTEXT AROUND THIS SLOT:
${prevActivity ? `- Previous activity: ${prevActivity.name} (ends ${prevActivity.time.split(" - ")[1]})` : "- This is the first activity of the day"}
${nextActivity ? `- Next activity: ${nextActivity.name} (starts ${nextActivity.time.split(" - ")[0]})` : "- This is the last activity of the day"}

${nearbyContext}
RULES:
1. Each candidate must keep the same time slot (${activity.time})
2. Do NOT reuse any of these existing venues: ${existingVenues}
3. All ${count} candidates must be different from each other
4. ${nearbyContext ? "Use the real nearby places listed above" : `Use real, well-known establishments in ${stopLocation}`}
5. Set transport to travel from the candidate to: ${nextActivity?.name ?? "end of day"} (empty array if last)
6. Image field: set to empty string`;

  const response = await client.messages.create({
    model: MODEL_NAME,
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
}

export async function editItineraryWithLanguage(
  input: EditItineraryWithLanguageInput
): Promise<GeneratedItinerary> {
  const { itinerary, message } = input;
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

  const prompt = `You are an AI travel assistant helping a user modify their itinerary through natural language.

ITINERARY: ${itinerary.destinationName}${itinerary.country ? `, ${itinerary.country}` : ""}
Budget: ${itinerary.budget ?? "moderate"}
Trip type: ${itinerary.tripType ?? "hub"}

CURRENT SCHEDULE:
${itinerarySummary}

USER REQUEST: "${message}"

Analyze the request and return the minimal set of mutations needed.
- dayIndex uses global 0-based numbering across all stops
- For replace_activity, generate a real replacement in the same location as the original day
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

  let result = itinerary;
  const currentDays = getAllDays(result);

  for (const mutation of mutations) {
    if (mutation.op === "replace_activity") {
      const { dayIndex, activityIndex, activity } = mutation;
      const day = currentDays[dayIndex];
      if (day?.activities[activityIndex]) {
        const newDay = {
          ...day,
          activities: day.activities.map((a, ai) => (ai === activityIndex ? activity : a)),
        };
        result = updateDayByIndex(result, dayIndex, newDay);
      }
    } else if (mutation.op === "remove_activity") {
      const { dayIndex, activityIndex } = mutation;
      const day = currentDays[dayIndex];
      if (day) {
        const newDay = {
          ...day,
          activities: day.activities.filter((_, i) => i !== activityIndex),
        };
        result = updateDayByIndex(result, dayIndex, newDay);
      }
    } else if (mutation.op === "reorder_day") {
      const { dayIndex, newOrder } = mutation;
      const day = currentDays[dayIndex];
      if (day) {
        const reordered = newOrder
          .filter((i) => i >= 0 && i < day.activities.length)
          .map((i) => day.activities[i]);
        result = updateDayByIndex(result, dayIndex, { ...day, activities: reordered });
      }
    }
  }

  return result;
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
    const newOrder = nearestNeighborOrder(day.activities);
    const reordered = newOrder.map((i) => day.activities[i]);
    return updateDayByIndex(itinerary, dayIndex, { ...day, activities: reordered });
  }

  // Find stop location for this day
  let stopLocation = itinerary.destinationName;
  let cumulative = 0;
  for (const stop of itinerary.stops) {
    if (dayIndex < cumulative + stop.days.length) {
      stopLocation = stop.location;
      break;
    }
    cumulative += stop.days.length;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const modeInstructions: Record<string, string> = {
    minimize_cost: "Reorder and if needed replace expensive activities with free/cheap alternatives.",
    relax_mode: "Remove rushed transitions. Reduce activities if needed. Prioritize cafes, parks, and leisurely experiences.",
    maximize_sightseeing: "Optimize order and timing to visit the maximum number of top-rated attractions efficiently.",
    foodie_mode: "Replace non-food activities with notable food experiences, local markets, or famous restaurants.",
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

  const prompt = `Optimize day ${dayIndex + 1} of a travel itinerary for: ${mode.replace(/_/g, " ")}.

LOCATION: ${stopLocation}${itinerary.country ? `, ${itinerary.country}` : ""}
OPTIMIZATION GOAL: ${modeInstructions[mode] ?? mode}

CURRENT DAY ACTIVITIES:
${activityList}

RULES:
- Do NOT modify LOCKED activities (marked with 🔒)
- Locked activity indices: [${lockedActivities.join(", ")}]
- Use reorder_day for reordering. Use replace_activity to swap. Use remove_activity to delete.
- All operations reference dayIndex: ${dayIndex}
- Return the minimal mutations needed`;

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

  let result = itinerary;

  for (const mutation of mutations) {
    const currentDay = getAllDays(result)[dayIndex];
    if (!currentDay) continue;

    if (mutation.op === "replace_activity") {
      const { activityIndex, activity } = mutation;
      if (lockedActivities.includes(activityIndex)) continue;
      if (currentDay.activities[activityIndex]) {
        result = updateDayByIndex(result, dayIndex, {
          ...currentDay,
          activities: currentDay.activities.map((a, ai) => (ai === activityIndex ? activity : a)),
        });
      }
    } else if (mutation.op === "remove_activity") {
      const { activityIndex } = mutation;
      if (lockedActivities.includes(activityIndex)) continue;
      result = updateDayByIndex(result, dayIndex, {
        ...currentDay,
        activities: currentDay.activities.filter((_, i) => i !== activityIndex),
      });
    } else if (mutation.op === "reorder_day") {
      const { newOrder } = mutation;
      const original = currentDay.activities;
      const safeOrder = newOrder.filter((i) => i >= 0 && i < original.length);
      const missing = original.map((_, i) => i).filter((i) => !safeOrder.includes(i));
      result = updateDayByIndex(result, dayIndex, {
        ...currentDay,
        activities: [...safeOrder, ...missing].map((i) => original[i]),
      });
    }
  }

  return result;
}
