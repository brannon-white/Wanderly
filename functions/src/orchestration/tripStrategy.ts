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

function buildStrategyPrompt(intent: TripIntent): string {
  const lines: string[] = [
    `Generate a trip planning strategy for:`,
    `Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}`,
    `Duration: ${intent.durationDays} days | Party: ${intent.party} | Budget: ${intent.budget}`,
    `Interests (ranked): ${intent.rankedInterests.join(", ")} | Pace: ${intent.pace}`,
  ];

  // Use the blended effective profile — already 70% prompt / 30% taste profile
  const tp = intent.effectiveTasteProfile ?? intent.tasteProfile;
  const hasPromptIntent = !!(intent.derivedIntent && Object.keys(intent.derivedIntent).length > 0);

  if (intent.derivedIntent && hasPromptIntent) {
    const di = intent.derivedIntent;
    lines.push(`\n[PRIMARY] This trip's intent — dominant signal for strategy and search queries:`);
    if (intent.tripPrompt) lines.push(`- User wrote: "${intent.tripPrompt}"`);
    if (di.tripMood) lines.push(`- Mood: ${di.tripMood}`);
    if (di.themes?.length) lines.push(`- Themes: ${di.themes.join(", ")}`);
    if (di.pace) lines.push(`- Desired pace: ${di.pace}`);
    if (di.avoid?.length) lines.push(`- Avoid: ${di.avoid.join(", ")}`);
  }

  if (tp) {
    const gemLevel = tp.hiddenGems > 0.6 ? "high" : tp.hiddenGems < 0.4 ? "low" : "medium";
    const blendNote = hasPromptIntent
      ? "(blended 70% trip intent + 30% long-term style — use for refining search query flavor, not overriding trip direction)"
      : "(long-term travel style — primary guide)";
    lines.push(
      `\n[REFINEMENT] Traveler's default style ${blendNote}:`,
      `- Hidden gem preference: ${gemLevel} (${tp.hiddenGems.toFixed(2)}) — ${gemLevel === "high" ? "append 'hidden gem', 'local favorite', 'locals only' to search queries" : gemLevel === "low" ? "prefer well-known, top-rated, iconic venues" : "mix of popular and local"}`,
      `- Food focus: ${tp.foodie > 0.6 ? "food-focused" : tp.foodie < 0.4 ? "food as fuel" : "balanced"} (${tp.foodie.toFixed(2)})`,
      `- Activity style: ${tp.adventure > 0.6 ? "outdoor/adventure" : tp.adventure < 0.4 ? "cultural/indoor" : "mixed"} (${tp.adventure.toFixed(2)})`,
      `- Nightlife: ${tp.nightlife > 0.5 ? "include evening activities" : "skip nightlife"} (${tp.nightlife.toFixed(2)})`,
      `- Luxury: ${tp.luxury > 0.6 ? "premium/upscale" : tp.luxury < 0.4 ? "budget-friendly/local" : "mid-range"} (${tp.luxury.toFixed(2)})`,
    );
  }

  if (intent.includeActivities?.length) {
    lines.push(`\nMust-include activities: ${intent.includeActivities.join(", ")} — prioritize search queries in these categories`);
  }

  if (intent.avoidActivities?.length) {
    lines.push(`Activities to EXCLUDE entirely: ${intent.avoidActivities.join(", ")} — do NOT generate search queries for these categories`);
  }

  lines.push(
    `\nRequirements:`,
    `1. Identify the best neighborhoods/areas to focus on per day to minimize cross-city travel`,
    `2. Create a catchy theme for each of the ${intent.durationDays} days`,
    `3. Generate 12-18 specific Google Places search queries to find real venues. Include:`,
    `   - Breakfast café searches (e.g. "best breakfast cafes in Shinjuku Tokyo")`,
    `   - Lunch restaurant searches (e.g. "popular lunch spots in Harajuku Tokyo")`,
    `   - Dinner restaurant searches matching budget (e.g. "best izakaya dinner Shibuya moderate price")`,
    `   - Attraction searches per interest (e.g. "top art museums in Tokyo")`,
    `   - Nightlife/shopping/wellness if relevant to interests`,
    `   Make queries hyper-specific with neighborhood + city + category.`,
  );

  return lines.join("\n");
}

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
      content: buildStrategyPrompt(intent),
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
