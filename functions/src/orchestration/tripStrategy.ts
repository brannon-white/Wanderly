import Anthropic from "@anthropic-ai/sdk";
import { FAST_MODEL_NAME } from "../constants";
import { type TripIntent, type TripStrategy, type SearchQuery } from "./types";

const STRATEGY_TOOL_SCHEMA = {
  type: "object" as const,
  required: ["primaryNeighborhoods", "dayThemes", "tripStyle", "dailyActivityCount", "searchQueries"],
  properties: {
    primaryNeighborhoods: {
      type: "array",
      items: { type: "string" },
      description: "Best neighborhoods/districts to focus on, ordered by day",
    },
    dayThemes: {
      type: "array",
      items: { type: "string" },
      description: "Catchy theme for each day, length must equal durationDays",
    },
    tripStyle: { type: "string", enum: ["relaxed", "balanced", "packed"] },
    dailyActivityCount: {
      type: "number",
      description: "Non-meal activities per day (relaxed=3, balanced=4, packed=5)",
    },
    activityBalance: {
      type: "object",
      properties: {
        food: { type: "number" },
        culture: { type: "number" },
        nature: { type: "number" },
        nightlife: { type: "number" },
        shopping: { type: "number" },
        wellness: { type: "number" },
      },
    },
    searchQueries: {
      type: "array",
      description: "Specific Google Places search queries to find real venues",
      items: {
        type: "object",
        required: ["query", "category"],
        properties: {
          query: {
            type: "string",
            description: "Specific search query, e.g. 'best ramen restaurants in Shibuya Tokyo'",
          },
          category: {
            type: "string",
            enum: ["restaurant", "attraction", "museum", "park", "nightlife", "shopping", "wellness", "cafe"],
          },
          neighborhood: { type: "string" },
        },
      },
    },
  },
};

const DEFAULT_BALANCE: TripStrategy["activityBalance"] = {
  food: 0.3,
  culture: 0.3,
  nature: 0.15,
  nightlife: 0.1,
  shopping: 0.1,
  wellness: 0.05,
};

export async function generateTripStrategy(intent: TripIntent): Promise<TripStrategy> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: FAST_MODEL_NAME,
    max_tokens: 2048,
    tools: [{
      name: "generate_strategy",
      description: "Generate a trip planning strategy with neighborhood focus and search queries",
      input_schema: STRATEGY_TOOL_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "generate_strategy" },
    messages: [{
      role: "user",
      content: `Generate a trip planning strategy for:
Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}
Duration: ${intent.durationDays} days | Party: ${intent.party} | Budget: ${intent.budget}
Interests (ranked): ${intent.rankedInterests.join(", ")} | Pace: ${intent.pace}

Requirements:
1. Identify the best neighborhoods/areas to focus on per day to minimize cross-city travel
2. Create a catchy theme for each of the ${intent.durationDays} days
3. Generate 12-18 specific Google Places search queries to find real venues. Include:
   - Breakfast café searches (e.g. "best breakfast cafes in Shinjuku Tokyo")
   - Lunch restaurant searches (e.g. "popular lunch spots in Harajuku Tokyo")
   - Dinner restaurant searches matching budget (e.g. "best izakaya dinner Shibuya moderate price")
   - Attraction searches per interest (e.g. "top art museums in Tokyo")
   - Nightlife/shopping/wellness if relevant to interests
   Make queries hyper-specific with neighborhood + city + category.`,
    }],
  });

  const tool = response.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") {
    throw new Error("Trip strategy generation failed: no structured output");
  }

  const raw = tool.input as {
    primaryNeighborhoods?: string[];
    dayThemes?: string[];
    tripStyle?: string;
    dailyActivityCount?: number;
    activityBalance?: TripStrategy["activityBalance"];
    searchQueries?: SearchQuery[];
  };

  return {
    primaryNeighborhoods: raw.primaryNeighborhoods ?? [intent.destination],
    dayThemes: raw.dayThemes ?? Array.from({ length: intent.durationDays }, (_, i) => `Day ${i + 1} Exploration`),
    tripStyle: (raw.tripStyle as TripStrategy["tripStyle"]) ?? intent.pace,
    dailyActivityCount: raw.dailyActivityCount ?? 4,
    activityBalance: raw.activityBalance ?? DEFAULT_BALANCE,
    searchQueries: raw.searchQueries ?? [],
  };
}
