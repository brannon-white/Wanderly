import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";

import { MODEL_NAME, FAST_MODEL_NAME, PROMPT_VERSION, ACTIVITY_TOOL_INPUT_SCHEMA } from "./constants";
import {
  generateItineraryRequestSchema,
  generatedItinerarySchema,
  type GenerateItineraryRequest,
  type GeneratedItinerary,
} from "./itinerarySchemas";

import { extractIntent } from "./orchestration/intentExtraction";
import { generateTripStrategy } from "./orchestration/tripStrategy";
import { fetchRecommendations, fetchNearbyForClusters, searchNearbyForActivity } from "./orchestration/placesRetrieval";
import { rankRecommendations } from "./orchestration/ranking";
import { clusterRecommendations } from "./orchestration/clustering";
import { generateDailyPlans } from "./orchestration/dailyPlanning";
import { validateItinerary } from "./orchestration/validation";
import { buildCacheKey, getCachedPlaces, setCachedPlaces } from "./orchestration/placesCache";

export { MODEL_NAME, PROMPT_VERSION };

// ─── Merge real Google Places data into Claude-generated output ──────────────

function mergePlaceData(
  itinerary: GeneratedItinerary,
  ranked: Awaited<ReturnType<typeof rankRecommendations>>
): GeneratedItinerary {
  if (ranked.length === 0) return itinerary;

  const byName = new Map(ranked.map((p) => [p.name.toLowerCase(), p]));

  const days = itinerary.days.map((day) => {
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

  return { ...itinerary, days };
}

// ─── Main orchestration pipeline ────────────────────────────────────────────

export async function generateItineraryFlow(
  input: GenerateItineraryRequest,
  googlePlacesApiKey?: string
): Promise<GeneratedItinerary> {
  generateItineraryRequestSchema.parse(input);

  // Step 1: Extract structured intent from user parameters
  logger.info("Pipeline: extracting intent", { destination: input.destinationName });
  const intent = await extractIntent(input);

  // Step 2: Generate trip strategy (neighborhoods, themes, search queries)
  logger.info("Pipeline: generating trip strategy", { pace: intent.pace, days: intent.durationDays });
  const strategy = await generateTripStrategy(intent);

  // Steps 3 & 4: Fetch real places (with Firestore cache) + rank them
  let ranked: Awaited<ReturnType<typeof rankRecommendations>> = [];
  if (googlePlacesApiKey && strategy.searchQueries.length > 0) {
    const cacheKey = buildCacheKey(intent.destination, intent.budget, intent.interests);
    let candidates = await getCachedPlaces(cacheKey);

    if (!candidates) {
      logger.info("Pipeline: cache miss — fetching from Google Places", {
        queryCount: strategy.searchQueries.length,
      });
      candidates = await fetchRecommendations(strategy.searchQueries, googlePlacesApiKey);
      await setCachedPlaces(cacheKey, candidates);
    } else {
      logger.info("Pipeline: cache hit", { destination: intent.destination });
    }

    ranked = rankRecommendations(candidates, intent);
    logger.info("Pipeline: ranking complete", { candidateCount: candidates.length, rankedCount: ranked.length });
  } else {
    logger.info("Pipeline: skipping Google Places (no API key or no queries)");
  }

  // Step 5: Geographic clustering
  logger.info("Pipeline: clustering recommendations", { numDays: intent.durationDays });
  let clusters = clusterRecommendations(ranked, intent.durationDays, strategy.dayThemes);

  // Step 5b: Nearby search — enrich each cluster with geographically tight results
  if (googlePlacesApiKey && clusters.length > 0) {
    logger.info("Pipeline: nearby search enrichment");
    clusters = await fetchNearbyForClusters(clusters, googlePlacesApiKey);
  }

  // Step 6: Generate structured daily plans using real place data + opening hours
  logger.info("Pipeline: generating daily plans");
  const rawItinerary = await generateDailyPlans(clusters, intent, strategy);

  // Step 7: Parse
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
    model: MODEL_NAME,
    promptVersion: PROMPT_VERSION,
    isActive: true,
  });

  // Step 7b: Merge real ratings and editorial descriptions from Google Places
  logger.info("Pipeline: merging real place data");
  const withPlaceData = mergePlaceData(parsed, ranked);

  // Step 8: Validate
  logger.info("Pipeline: validating itinerary");
  const { itinerary: validated, result } = validateItinerary(withPlaceData);

  if (result.issues.length > 0) {
    logger.info("Pipeline: validation issues", { issues: result.issues, repaired: result.repaired });
  }

  return validated;
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
  const day = itinerary.days[dayIndex];

  if (!day) throw new Error(`Day ${dayIndex} not found in itinerary`);

  const activity = day.activities[activityIndex];
  if (!activity) throw new Error(`Activity ${activityIndex} not found in day ${dayIndex}`);

  const prevActivity = activityIndex > 0 ? day.activities[activityIndex - 1] : null;
  const nextActivity = activityIndex < day.activities.length - 1
    ? day.activities[activityIndex + 1]
    : null;

  const existingVenues = itinerary.days
    .flatMap((d) => d.activities.map((a) => a.name))
    .filter((n) => n !== activity.name)
    .join(", ");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are replacing a single activity in a travel itinerary. Return only the replacement activity.

TRIP CONTEXT:
- Destination: ${itinerary.destinationName}${itinerary.country ? `, ${itinerary.country}` : ""}
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
3. Use a real, well-known establishment
4. Set transport to travel from this activity to: ${nextActivity?.name ?? "end of day"} (empty array if last)
5. Coordinates must be real (accurate lat/lng for ${itinerary.destinationName})`;

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

  const updatedDays = itinerary.days.map((d, di) => {
    if (di !== dayIndex) return d;
    return {
      ...d,
      activities: d.activities.map((a, ai) => (ai === activityIndex ? newActivity : a)),
    };
  });

  return { ...itinerary, days: updatedDays };
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
  const day = itinerary.days[dayIndex];

  if (!day) throw new Error(`Day ${dayIndex} not found in itinerary`);

  const existingVenues = itinerary.days
    .flatMap((d, di) => (di !== dayIndex ? d.activities.map((a) => a.name) : []))
    .join(", ");

  const excludePlaces = [
    ...existingVenues.split(", "),
    ...(modifications?.excludePlaces ?? []),
  ].filter(Boolean);

  const budget = modifications?.budget ?? itinerary.budget ?? "moderate";
  const theme = modifications?.theme ?? day.title ?? day.label;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are regenerating a single day in a travel itinerary.

TRIP CONTEXT:
- Destination: ${itinerary.destinationName}${itinerary.country ? `, ${itinerary.country}` : ""}
- Budget: ${budget}
- Interests: ${itinerary.interests?.join(", ") ?? "general sightseeing"}
- Day ${dayIndex + 1} theme: ${theme}

DO NOT USE any of these venues (used on other days): ${excludePlaces.join(", ")}

RULES — same as full itinerary generation:
1. Include breakfast, lunch, AND dinner at real named restaurants
2. Specific named places only — no vague entries
3. Realistic timing with transit between activities
4. Format times as "09:00 AM - 10:30 AM"
5. Transport array for each activity pointing to the next
6. Google Maps URLs: https://www.google.com/maps/search/?api=1&query=Place+Name+City
7. Use real coordinates for ${itinerary.destinationName}`;

  const DAY_SCHEMA = {
    type: "object" as const,
    required: ["label", "activities"],
    properties: {
      label: { type: "string" },
      title: { type: "string" },
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

  const updatedDays = itinerary.days.map((d, di) => (di === dayIndex ? newDay : d));

  return { ...itinerary, days: updatedDays };
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
): Promise<GeneratedItinerary["days"][number]["activities"]> {
  const { itinerary, dayIndex, activityIndex, reason, count = 3, googlePlacesApiKey } = input;
  const day = itinerary.days[dayIndex];
  if (!day) throw new Error(`Day ${dayIndex} not found in itinerary`);
  const activity = day.activities[activityIndex];
  if (!activity) throw new Error(`Activity ${activityIndex} not found in day ${dayIndex}`);

  const prevActivity = activityIndex > 0 ? day.activities[activityIndex - 1] : null;
  const nextActivity = activityIndex < day.activities.length - 1
    ? day.activities[activityIndex + 1]
    : null;

  const existingVenues = itinerary.days
    .flatMap((d) => d.activities.map((a) => a.name))
    .join(", ");

  // For location-aware reasons, fetch real nearby places from Google Places API
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

  const prompt = `You are suggesting ${count} distinct replacement activities for a travel itinerary. Return exactly ${count} different options for the user to choose from.

TRIP CONTEXT:
- Destination: ${itinerary.destinationName}${itinerary.country ? `, ${itinerary.country}` : ""}
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
4. ${nearbyContext ? "Use the real nearby places listed above — do NOT invent venues" : `Use real, well-known establishments with accurate coordinates for ${itinerary.destinationName}`}
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

  const { candidates } = toolBlock.input as { candidates: GeneratedItinerary["days"][number]["activities"] };
  return candidates;
}

// ─── Edit itinerary via natural language ────────────────────────────────────

export type ItineraryMutation =
  | { op: "replace_activity"; dayIndex: number; activityIndex: number; activity: GeneratedItinerary["days"][number]["activities"][number] }
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

  const itinerarySummary = itinerary.days.map((day, di) =>
    `Day ${di + 1} (${day.title ?? day.label}):\n` +
    day.activities.map((a, ai) => `  [${di},${ai}] ${a.time} — ${a.name} (${a.category ?? "general"})`).join("\n")
  ).join("\n\n");

  const prompt = `You are an AI travel assistant helping a user modify their itinerary through natural language.

ITINERARY: ${itinerary.destinationName}${itinerary.country ? `, ${itinerary.country}` : ""}
Budget: ${itinerary.budget ?? "moderate"}

CURRENT SCHEDULE:
${itinerarySummary}

USER REQUEST: "${message}"

Analyze the request and return the minimal set of mutations needed to fulfill it.
- Use replace_activity to swap an activity for a better fit
- Use remove_activity to delete an activity entirely
- Use reorder_day to change the order of activities within a day
- Only mutate what is necessary — preserve the rest of the itinerary
- For replace_activity, generate a real replacement with accurate coordinates for ${itinerary.destinationName}
- dayIndex and activityIndex are 0-based`;

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

  let result = { ...itinerary, days: itinerary.days.map((d) => ({ ...d, activities: [...d.activities] })) };

  for (const mutation of mutations) {
    if (mutation.op === "replace_activity") {
      const { dayIndex, activityIndex, activity } = mutation;
      if (result.days[dayIndex]?.activities[activityIndex]) {
        result.days[dayIndex].activities[activityIndex] = activity;
      }
    } else if (mutation.op === "remove_activity") {
      const { dayIndex, activityIndex } = mutation;
      if (result.days[dayIndex]) {
        result.days[dayIndex].activities = result.days[dayIndex].activities.filter((_, i) => i !== activityIndex);
      }
    } else if (mutation.op === "reorder_day") {
      const { dayIndex, newOrder } = mutation;
      if (result.days[dayIndex]) {
        const original = result.days[dayIndex].activities;
        result.days[dayIndex].activities = newOrder
          .filter((i) => i >= 0 && i < original.length)
          .map((i) => original[i]);
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
  activities: GeneratedItinerary["days"][number]["activities"]
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
  const day = itinerary.days[dayIndex];
  if (!day) throw new Error(`Day ${dayIndex} not found in itinerary`);

  const lockedActivities = day.activities
    .map((a, i) => ({ i, locked: a.locked ?? false }))
    .filter(({ locked }) => locked)
    .map(({ i }) => i);

  if (mode === "minimize_walking") {
    const newOrder = nearestNeighborOrder(day.activities);
    const reordered = newOrder.map((i) => day.activities[i]);
    const updatedDays = itinerary.days.map((d, di) =>
      di === dayIndex ? { ...d, activities: reordered } : d
    );
    return { ...itinerary, days: updatedDays };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const modeInstructions: Record<string, string> = {
    minimize_cost: "Reorder and if needed replace expensive activities with free/cheap alternatives. Keep total daily spend as low as possible.",
    relax_mode: "Remove rushed transitions. Reduce the number of activities if needed. Prioritize cafes, parks, and leisurely experiences over sights.",
    maximize_sightseeing: "Optimize the order and timing to visit the maximum number of top-rated attractions efficiently.",
    foodie_mode: "Replace non-food activities with notable food experiences, local markets, or famous restaurants. Keep at least breakfast, lunch, and dinner.",
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

DESTINATION: ${itinerary.destinationName}${itinerary.country ? `, ${itinerary.country}` : ""}
OPTIMIZATION GOAL: ${modeInstructions[mode] ?? mode}

CURRENT DAY ACTIVITIES:
${activityList}

RULES:
- Do NOT modify LOCKED activities (marked with 🔒)
- Locked activity indices: [${lockedActivities.join(", ")}]
- Use reorder_day for reordering. Use replace_activity to swap specific activities. Use remove_activity to delete.
- All operations reference dayIndex: ${dayIndex}
- Return the minimal mutations needed to achieve the optimization goal`;

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

  let result = { ...itinerary, days: itinerary.days.map((d) => ({ ...d, activities: [...d.activities] })) };

  for (const mutation of mutations) {
    if (mutation.op === "replace_activity") {
      const { dayIndex: di, activityIndex: ai, activity } = mutation;
      if (lockedActivities.includes(ai)) continue;
      if (result.days[di]?.activities[ai]) {
        result.days[di].activities[ai] = activity;
      }
    } else if (mutation.op === "remove_activity") {
      const { dayIndex: di, activityIndex: ai } = mutation;
      if (lockedActivities.includes(ai)) continue;
      if (result.days[di]) {
        result.days[di].activities = result.days[di].activities.filter((_, i) => i !== ai);
      }
    } else if (mutation.op === "reorder_day") {
      const { dayIndex: di, newOrder } = mutation;
      if (result.days[di]) {
        const original = result.days[di].activities;
        const safeOrder = newOrder.filter((i) => i >= 0 && i < original.length);
        const missing = original.map((_, i) => i).filter((i) => !safeOrder.includes(i));
        result.days[di].activities = [...safeOrder, ...missing].map((i) => original[i]);
      }
    }
  }

  return result;
}
