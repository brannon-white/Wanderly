import Anthropic from "@anthropic-ai/sdk";

import {
  generateItineraryRequestSchema,
  generatedItinerarySchema,
  type GenerateItineraryRequest,
  type GeneratedItinerary,
} from "./itinerarySchemas";

export const PROMPT_VERSION = "v2";
export const MODEL_NAME = "claude-haiku-4-5-20251001";

// JSON Schema representation of generatedItinerarySchema for Claude tool use
const ITINERARY_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  required: ["id", "title", "subtitle", "destinationId", "destinationName", "heroImage", "source", "days"],
  properties: {
    id: { type: "string", description: "Unique ID, e.g. 'itin-tokyo-001'" },
    title: { type: "string" },
    subtitle: { type: "string" },
    destinationId: { type: "string" },
    destinationName: { type: "string" },
    country: { type: "string" },
    heroImage: { type: "string", description: "Leave as empty string — images are fetched separately" },
    rating: { type: "string", description: "e.g. '4.7'" },
    reviewCount: { type: "number" },
    summary: { type: "array", items: { type: "string" } },
    source: { type: "string", enum: ["ai_generated"] },
    days: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "activities"],
        properties: {
          label: { type: "string", description: "e.g. 'Day 1'" },
          title: { type: "string", description: "Catchy day theme, e.g. 'Temples & Street Food'" },
          activities: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "name", "time", "transport"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                category: {
                  type: "string",
                  enum: ["food", "attraction", "culture", "nature", "shopping", "art", "science", "adventure", "hotel", "nightlife", "wellness"],
                },
                description: { type: "string" },
                time: { type: "string", description: "e.g. '09:00 AM - 11:00 AM'" },
                cost: { type: "string", description: "Realistic cost in local or USD, e.g. '$15' or 'Free'" },
                rating: { type: "number", description: "0–5 rating based on real-world reputation" },
                reviewCount: { type: "number" },
                image: { type: "string", description: "Leave as empty string" },
                mapUrl: { type: "string", description: "Google Maps URL for this specific place" },
                coordinates: {
                  type: "object",
                  required: ["latitude", "longitude"],
                  properties: {
                    latitude: { type: "number" },
                    longitude: { type: "number" },
                  },
                },
                transport: {
                  type: "array",
                  description: "How to travel from this activity to the next one",
                  items: {
                    type: "object",
                    required: ["mode", "time"],
                    properties: {
                      mode: {
                        type: "string",
                        enum: ["walk", "subway", "train", "bus", "taxi", "car", "ferry"],
                      },
                      time: { type: "string", description: "e.g. '12 min'" },
                      label: { type: "string", description: "e.g. 'Take the Yamanote Line to Shibuya'" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

function buildPrompt(input: GenerateItineraryRequest): string {
  const nights = (() => {
    if (input.startDate && input.endDate) {
      const ms = new Date(input.endDate).getTime() - new Date(input.startDate).getTime();
      return Math.max(1, Math.round(ms / 86_400_000));
    }
    return 3;
  })();

  return `You are a professional travel planner creating a detailed itinerary for a mobile travel app.

Destination: ${input.destinationName}${input.country ? `, ${input.country}` : ""}
Trip length: ${nights} day${nights !== 1 ? "s" : ""}
Traveler party: ${input.party}
Budget style: ${input.budget}
Interests: ${input.interests.length ? input.interests.join(", ") : "general sightseeing"}
Dates: ${input.startDate ?? "flexible"} to ${input.endDate ?? "flexible"}

Guidelines:
- Create ${nights} day${nights !== 1 ? "s" : ""} with 3–5 activities each. Balance morning, afternoon, and evening.
- Use real, well-known places with accurate coordinates and realistic ratings.
- For each activity's transport array, describe the recommended way to get from THAT activity to the NEXT one. Last activity per day can have an empty transport array.
- Use accurate travel times based on real distances (e.g. don't say 5 min if it's 30 min away).
- Cost should be realistic: "Free", "$5–10", "$25", etc.
- Leave all image fields as empty strings — images are sourced separately.
- Day titles should be catchy and thematic (e.g. "Temples & Street Food", "Modern Tokyo").
- Subtitle should be 1 sentence describing the overall trip vibe.`;
}

export async function generateItineraryFlow(
  input: GenerateItineraryRequest
): Promise<GeneratedItinerary> {
  // Validate input
  generateItineraryRequestSchema.parse(input);

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: 8192,
    tools: [
      {
        name: "create_itinerary",
        description: "Create a structured travel itinerary",
        input_schema: ITINERARY_TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "create_itinerary" },
    messages: [{ role: "user", content: buildPrompt(input) }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Claude did not return a structured itinerary.");
  }

  const raw = toolBlock.input as Record<string, unknown>;

  return generatedItinerarySchema.parse({
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
    model: MODEL_NAME,
    promptVersion: PROMPT_VERSION,
    isActive: true,
  });
}
