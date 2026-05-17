import Anthropic from "@anthropic-ai/sdk";
import { FAST_MODEL_NAME } from "../constants";
import { type GenerateItineraryRequest } from "../itinerarySchemas";
import { type TripIntent } from "./types";

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

function computeDays(input: GenerateItineraryRequest): number {
  if (input.startDate && input.endDate) {
    const ms = new Date(input.endDate).getTime() - new Date(input.startDate).getTime();
    return Math.max(1, Math.round(ms / 86_400_000));
  }
  return 3;
}

export async function extractIntent(input: GenerateItineraryRequest): Promise<TripIntent> {
  const durationDays = computeDays(input);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
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

Re-rank the interests by importance to a ${input.party} traveler with a ${input.budget} budget.
Infer pace: budget travelers often pack more in; luxury travelers prefer relaxed pacing; family = balanced.`,
    }],
  });

  const tool = response.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") {
    // Fallback if Claude doesn't return structured output
    return {
      destination: input.destinationName,
      country: input.country,
      durationDays,
      budget: input.budget as TripIntent["budget"],
      party: input.party,
      interests: input.interests,
      rankedInterests: input.interests,
      pace: "balanced",
      startDate: input.startDate,
      endDate: input.endDate,
    };
  }

  const raw = tool.input as { rankedInterests?: string[]; pace?: string };

  return {
    destination: input.destinationName,
    country: input.country,
    durationDays,
    budget: input.budget as TripIntent["budget"],
    party: input.party,
    interests: input.interests,
    rankedInterests: raw.rankedInterests ?? input.interests,
    pace: (raw.pace as TripIntent["pace"]) ?? "balanced",
    startDate: input.startDate,
    endDate: input.endDate,
  };
}
