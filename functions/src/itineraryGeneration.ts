import Anthropic from "@anthropic-ai/sdk";

import {
  generateItineraryRequestSchema,
  generatedItinerarySchema,
  type GenerateItineraryRequest,
  type GeneratedItinerary,
} from "./itinerarySchemas";

export const PROMPT_VERSION = "v3";
export const MODEL_NAME = "claude-sonnet-4-6";

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

  return `You are an expert travel planner building a detailed, realistic itinerary for a mobile travel app. Every detail must be accurate and specific.

TRIP DETAILS:
- Destination: ${input.destinationName}${input.country ? `, ${input.country}` : ""}
- Duration: ${nights} day${nights !== 1 ? "s" : ""}
- Party: ${input.party}
- Budget: ${input.budget}
- Interests: ${input.interests.length ? input.interests.join(", ") : "general sightseeing"}
- Dates: ${input.startDate ?? "flexible"} to ${input.endDate ?? "flexible"}

STRICT RULES — follow every rule exactly:

1. MEALS ARE REQUIRED: Every single day MUST include breakfast, lunch, AND dinner, each at a real named restaurant or café that actually exists in ${input.destinationName}. Use the exact establishment name (e.g. "Café de Flore", not "a charming local café"). Set category to "food" for all meals.

2. SPECIFIC NAMED PLACES ONLY: Every non-meal activity must be a real, named attraction — no vague entries like "explore the neighborhood" or "stroll along the waterfront". Use actual names (e.g. "Louvre Museum", "Shibuya Crossing", "Central Park").

3. TIME FEASIBILITY — CRITICAL: Schedule activities so a traveler can physically get from one to the next in time. If an activity ends at 10:00 AM and transit to the next place takes 25 minutes, the next activity starts at 10:25 AM at the earliest. Never overlap times or leave gaps that are too short for the transit between locations.

4. REALISTIC DURATIONS: Allocate appropriate time at each place:
   - Breakfast: 45–60 min
   - Major museum or landmark: 2–3 hours
   - Lunch: 60–75 min
   - Mid-size attraction: 1–1.5 hours
   - Dinner: 75–90 min
   - Bar or evening activity: 1–2 hours

5. DAY STRUCTURE: Start no earlier than 8:00 AM (breakfast). End no later than 11:00 PM. Format all times as "09:00 AM - 10:30 AM".

6. TRANSPORT: For each activity's transport array, specify exactly how to travel from THAT place to the NEXT one (mode + realistic transit time based on actual distance). The last activity of each day has an empty transport array.

7. DO NOT REPEAT: Never use the same restaurant or attraction on more than one day.

8. GOOGLE MAPS URLS: Format as https://www.google.com/maps/search/?api=1&query=Place+Name+City

Each day should follow this rough shape:
- ~8:00 AM: Breakfast at a named café or bakery
- Morning: 1–2 specific attractions or activities
- ~12:30–1:00 PM: Lunch at a named restaurant
- Afternoon: 1–2 specific attractions or activities
- ~7:00–8:00 PM: Dinner at a named restaurant
- Optional: evening bar, show, or nightlife spot

Day titles should be catchy and thematic (e.g. "Temples & Street Food", "Art, Markets & Rooftops").
Subtitle: one sentence capturing the overall trip vibe.`;
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
    max_tokens: 16000,
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
