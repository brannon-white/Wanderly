import Anthropic from "@anthropic-ai/sdk";
import { FAST_MODEL_NAME } from "../constants";
import { type GenerateItineraryRequest } from "../itinerarySchemas";
import { type TripIntent, type TripDerivedIntent } from "./types";

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

  // Parallel: ranked interests + optional prompt intent extraction
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

  // Taste profile pace overrides inferred pace when available
  const inferredPace = (raw.pace as TripIntent["pace"]) ?? "balanced";
  const pace: TripIntent["pace"] = input.tasteProfile
    ? tasteProfileToPace(input.tasteProfile.pace)
    : inferredPace;

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
    tripPrompt: input.tripPrompt,
    derivedIntent: Object.keys(derivedIntent).length > 0 ? derivedIntent : undefined,
    includeActivities: input.includeActivities,
    avoidActivities: input.avoidActivities,
  };
}
