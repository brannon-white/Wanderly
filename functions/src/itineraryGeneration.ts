import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";

import { MODEL_NAME, PROMPT_VERSION, ACTIVITY_TOOL_INPUT_SCHEMA } from "./constants";
import {
  generateItineraryRequestSchema,
  generatedItinerarySchema,
  type GenerateItineraryRequest,
  type GeneratedItinerary,
} from "./itinerarySchemas";

import { extractIntent } from "./orchestration/intentExtraction";
import { generateTripStrategy } from "./orchestration/tripStrategy";
import { fetchRecommendations, fetchNearbyForClusters } from "./orchestration/placesRetrieval";
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
