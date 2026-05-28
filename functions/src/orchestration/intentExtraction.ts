import Anthropic from "@anthropic-ai/sdk";
import { FAST_MODEL_NAME } from "../constants";
import { type GenerateItineraryRequest } from "../itinerarySchemas";
import { type TripIntent, type TripDerivedIntent, type TasteProfile } from "./types";

const INTENT_TOOL_SCHEMA = {
  type: "object" as const,
  required: ["rankedInterests", "pace"],
  properties: {
    rankedInterests: {
      type: "array",
      items: { type: "string" },
      description: "User interests re-ranked by how central they should be to the itinerary",
    },
    pace: {
      type: "string",
      enum: ["relaxed", "balanced", "packed"],
      description: "Inferred trip pace based on budget, party, and interests",
    },
  },
};

const TRIP_INTENT_EXTRACTION_SCHEMA = {
  type: "object" as const,
  required: ["tripMood", "pace", "themes"],
  properties: {
    tripMood: { type: "string", description: "Single word or short phrase: cozy, adventurous, romantic, cultural, relaxed, etc." },
    pace: { type: "string", enum: ["relaxed", "moderate", "fast-paced"] },
    themes: { type: "array", items: { type: "string" }, description: "2-4 recurring themes from the description" },
    avoid: { type: "array", items: { type: "string" }, description: "Things the user wants to avoid, if mentioned" },
    energyLevel: { type: "string", enum: ["low", "medium", "high"] },
    dimensionSignals: {
      type: "object",
      description: "0.0–1.0 signals for taste dimensions the prompt explicitly targets. Leave out any dimension not clearly addressed.",
      properties: {
        pace:                { type: "number", minimum: 0, maximum: 1 },
        nightlife:           { type: "number", minimum: 0, maximum: 1 },
        luxury:              { type: "number", minimum: 0, maximum: 1 },
        foodie:              { type: "number", minimum: 0, maximum: 1 },
        hiddenGems:          { type: "number", minimum: 0, maximum: 1 },
        touristTolerance:    { type: "number", minimum: 0, maximum: 1 },
        nature:              { type: "number", minimum: 0, maximum: 1 },
        adventure:           { type: "number", minimum: 0, maximum: 1 },
        structurePreference: { type: "number", minimum: 0, maximum: 1 },
        walkingTolerance:    { type: "number", minimum: 0, maximum: 1 },
      },
    },
  },
};

function computeDays(input: GenerateItineraryRequest): number {
  if (input.startDate && input.endDate) {
    const ms = new Date(input.endDate).getTime() - new Date(input.startDate).getTime();
    return Math.max(1, Math.round(ms / 86_400_000));
  }
  return 3;
}

function tasteProfileToPace(paceScore: number): TripIntent["pace"] {
  if (paceScore < 0.35) return "relaxed";
  if (paceScore > 0.65) return "packed";
  return "balanced";
}

function paceLabelToFloat(pace: string): number | null {
  if (pace === "relaxed") return 0.2;
  if (pace === "moderate") return 0.5;
  if (pace === "fast-paced") return 0.8;
  return null;
}

function blendTasteProfileWithPrompt(
  tasteProfile: TasteProfile,
  derivedIntent: TripDerivedIntent
): TasteProfile {
  const blended = { ...tasteProfile };
  const signals: Partial<TasteProfile> = { ...(derivedIntent.dimensionSignals ?? {}) };

  if (derivedIntent.pace && signals.pace === undefined) {
    const f = paceLabelToFloat(derivedIntent.pace);
    if (f !== null) signals.pace = f;
  }
  if (derivedIntent.energyLevel === "high") {
    if (signals.nightlife === undefined) signals.nightlife = Math.max(tasteProfile.nightlife, 0.75);
    if (signals.adventure === undefined) signals.adventure = Math.max(tasteProfile.adventure, 0.7);
  } else if (derivedIntent.energyLevel === "low") {
    if (signals.pace === undefined) signals.pace = Math.min(tasteProfile.pace, 0.3);
  }

  for (const key of Object.keys(signals) as (keyof TasteProfile)[]) {
    const promptVal = signals[key];
    if (promptVal === undefined) continue;
    const profileVal = tasteProfile[key];
    blended[key] = promptVal * 0.7 + profileVal * 0.3;
  }

  return blended;
}

async function extractPromptIntent(
  client: Anthropic,
  tripPrompt: string,
  destination: string
): Promise<TripDerivedIntent> {
  try {
    const response = await client.messages.create({
      model: FAST_MODEL_NAME,
      max_tokens: 256,
      tools: [{
        name: "extract_trip_intent",
        description: "Extract structured trip intent from a user's freeform trip description",
        input_schema: TRIP_INTENT_EXTRACTION_SCHEMA,
      }],
      tool_choice: { type: "tool", name: "extract_trip_intent" },
      messages: [{
        role: "user",
        content: `Extract trip intent from this description for a trip to ${destination}:\n"${tripPrompt}"`,
      }],
    });
    const tool = response.content.find((b) => b.type === "tool_use");
    if (tool && tool.type === "tool_use") {
      return tool.input as TripDerivedIntent;
    }
  } catch {}
  return {};
}

export async function extractIntent(input: GenerateItineraryRequest): Promise<TripIntent> {
  const durationDays = computeDays(input);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const [intentResponse, derivedIntent] = await Promise.all([
    client.messages.create({
      model: FAST_MODEL_NAME,
      max_tokens: 512,
      tools: [{
        name: "extract_intent",
        description: "Extract structured trip intent from user parameters",
        input_schema: INTENT_TOOL_SCHEMA,
      }],
      tool_choice: { type: "tool", name: "extract_intent" },
      messages: [{
        role: "user",
        content: `Extract structured trip intent for:
Destination: ${input.destinationName}${input.country ? `, ${input.country}` : ""}
Duration: ${durationDays} days | Party: ${input.party} | Budget: ${input.budget}
Trip type: ${input.tripType ?? 'hub'}${input.travelPace ? ` (${input.travelPace})` : ""}
Interests: ${input.interests.join(", ") || "general sightseeing"}
${input.tripPrompt ? `Trip description: "${input.tripPrompt}"` : ""}

Re-rank the interests by importance to a ${input.party} traveler with a ${input.budget} budget.
Infer pace: budget travelers often pack more in; luxury travelers prefer relaxed pacing; family = balanced.`,
      }],
    }),
    input.tripPrompt
      ? extractPromptIntent(client, input.tripPrompt, input.destinationName)
      : Promise.resolve<TripDerivedIntent>({}),
  ]);

  const tool = intentResponse.content.find((b) => b.type === "tool_use");
  const raw = tool && tool.type === "tool_use"
    ? (tool.input as { rankedInterests?: string[]; pace?: string })
    : {};

  const inferredPace = (raw.pace as TripIntent["pace"]) ?? "balanced";
  const promptPaceLabel = derivedIntent.pace;
  const promptPaceEnum = promptPaceLabel === "fast-paced" ? "packed"
    : promptPaceLabel === "moderate" ? "balanced"
    : promptPaceLabel === "relaxed" ? "relaxed"
    : null;
  const tasteProfilePace = input.tasteProfile
    ? tasteProfileToPace(input.tasteProfile.pace)
    : null;
  const pace: TripIntent["pace"] = promptPaceEnum ?? tasteProfilePace ?? inferredPace;

  const hasDerivedIntent = Object.keys(derivedIntent).length > 0;
  const effectiveTasteProfile =
    input.tasteProfile && hasDerivedIntent
      ? blendTasteProfileWithPrompt(input.tasteProfile, derivedIntent)
      : input.tasteProfile;

  return {
    destination: input.destinationName,
    country: input.country,
    durationDays,
    budget: input.budget as TripIntent["budget"],
    party: input.party,
    interests: input.interests,
    rankedInterests: raw.rankedInterests ?? input.interests,
    pace,
    startDate: input.startDate,
    endDate: input.endDate,
    tasteProfile: input.tasteProfile,
    effectiveTasteProfile,
    tripPrompt: input.tripPrompt,
    derivedIntent: hasDerivedIntent ? derivedIntent : undefined,
    includeActivities: input.includeActivities,
    avoidActivities: input.avoidActivities,
    destinationType: input.destinationType ?? 'city',
    tripType: input.tripType ?? 'hub',
    travelPace: input.travelPace,
  };
}
