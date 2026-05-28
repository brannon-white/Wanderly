import Anthropic from "@anthropic-ai/sdk";
import { FAST_MODEL_NAME } from "../constants";
import { type TripIntent, type TripStrategy, type StopStrategy } from "./types";

const STOP_SCHEMA = {
  type: "object" as const,
  required: ["location", "nightCount", "overnightType", "dayThemes", "searchQueries"],
  properties: {
    location: { type: "string", description: "City or area name, e.g. 'Bend, Oregon'" },
    region: { type: "string", description: "Broader region, e.g. 'Central Oregon'" },
    nightCount: { type: "number", description: "Nights sleeping here" },
    overnightType: {
      type: "string",
      enum: ["hotel", "camping", "airbnb", "rv", "flexible", "unknown"],
      description: "Best guess at accommodation type based on destination and trip style",
    },
    dayThemes: {
      type: "array",
      items: { type: "string" },
      description: "Catchy theme per day — must match nightCount for hub trips, nightCount+1 for all stops except the last in a route (last day is a departure day)",
    },
    searchQueries: {
      type: "array",
      description: "Google Places search queries scoped to THIS stop's location",
      items: {
        type: "object",
        required: ["query", "category"],
        properties: {
          query: { type: "string" },
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

const STRATEGY_TOOL_SCHEMA = {
  type: "object" as const,
  required: ["stops", "tripStyle", "dailyActivityCount"],
  properties: {
    stops: {
      type: "array",
      description: "One entry per overnight anchor. Hub trips: one stop. Route trips: 2+ stops in travel order.",
      items: STOP_SCHEMA,
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
  const isRoute = intent.tripType === 'route';
  const lines: string[] = [
    `Generate a trip planning strategy for:`,
    `Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}`,
    `Duration: ${intent.durationDays} days | Party: ${intent.party} | Budget: ${intent.budget}`,
    `Trip type: ${isRoute ? 'ROAD TRIP (multi-stop)' : 'Hub (single location)'}`,
    `Interests (ranked): ${intent.rankedInterests.join(", ")} | Pace: ${intent.pace}`,
  ];

  if (isRoute && intent.travelPace) {
    const paceDesc: Record<string, string> = {
      every_night: 'move to a new location every night — maximize different places',
      every_few_days: 'stay 2–4 nights per stop — good balance of depth and breadth',
      few_stops: 'only 2–3 stops total — spend meaningful time at each place',
      flexible: 'flexible pacing — AI decides based on what makes sense geographically',
    };
    lines.push(`Travel pace: ${paceDesc[intent.travelPace] ?? intent.travelPace}`);
  }

  const tp = intent.effectiveTasteProfile ?? intent.tasteProfile;
  const hasPromptIntent = !!(intent.derivedIntent && Object.keys(intent.derivedIntent).length > 0);

  if (intent.derivedIntent && hasPromptIntent) {
    const di = intent.derivedIntent;
    lines.push(`\n[PRIMARY] This trip's intent — dominant signal for strategy:`);
    if (intent.tripPrompt) lines.push(`- User wrote: "${intent.tripPrompt}"`);
    if (di.tripMood) lines.push(`- Mood: ${di.tripMood}`);
    if (di.themes?.length) lines.push(`- Themes: ${di.themes.join(", ")}`);
    if (di.pace) lines.push(`- Desired pace: ${di.pace}`);
    if (di.avoid?.length) lines.push(`- Avoid: ${di.avoid.join(", ")}`);
  }

  if (tp) {
    const gemLevel = tp.hiddenGems > 0.6 ? "high" : tp.hiddenGems < 0.4 ? "low" : "medium";
    const blendNote = hasPromptIntent
      ? "(blended 70% trip intent + 30% long-term style)"
      : "(long-term travel style — primary guide)";
    lines.push(
      `\n[REFINEMENT] Traveler's default style ${blendNote}:`,
      `- Hidden gem preference: ${gemLevel} — ${gemLevel === "high" ? "append 'hidden gem', 'local favorite' to queries" : gemLevel === "low" ? "prefer well-known, top-rated venues" : "mix of popular and local"}`,
      `- Food focus: ${tp.foodie > 0.6 ? "food-focused" : tp.foodie < 0.4 ? "food as fuel" : "balanced"} (${tp.foodie.toFixed(2)})`,
      `- Activity style: ${tp.adventure > 0.6 ? "outdoor/adventure" : tp.adventure < 0.4 ? "cultural/indoor" : "mixed"} (${tp.adventure.toFixed(2)})`,
      `- Nightlife: ${tp.nightlife > 0.5 ? "include evening activities" : "skip nightlife"} (${tp.nightlife.toFixed(2)})`,
      `- Luxury: ${tp.luxury > 0.6 ? "premium/upscale" : tp.luxury < 0.4 ? "budget-friendly/local" : "mid-range"} (${tp.luxury.toFixed(2)})`,
    );
  }

  if (intent.includeActivities?.length) {
    lines.push(`\nMust-include activities: ${intent.includeActivities.join(", ")}`);
  }
  if (intent.avoidActivities?.length) {
    lines.push(`Activities to EXCLUDE entirely: ${intent.avoidActivities.join(", ")}`);
  }

  lines.push(
    `\nTRIP BALANCE RULE: The user's prompt and interests define EMPHASIS and PRIORITY — not an exclusive list of allowed activities.`,
    `Every well-crafted itinerary includes variety: food, local exploration, cultural moments, and unexpected discoveries.`,
    `User themes tell you what to PRIORITIZE, not what to RESTRICT. Include diverse activity types even when not explicitly mentioned.`,
  );

  if (isRoute) {
    lines.push(
      `\nROAD TRIP REQUIREMENTS:`,
      `1. Determine 2–4 overnight anchor locations that form a logical route through "${intent.destination}".`,
      `   Picks must be geographically sensible — order stops so driving flows naturally (e.g. Portland → Hood River → Bend, not Bend → Portland → Hood River).`,
      `2. Distribute ${intent.durationDays} days across stops based on travel pace preference.`,
      `   Ensure total nightCount across all stops equals ${intent.durationDays}.`,
      `3. Each stop's dayThemes must have exactly nightCount themes (the last day at each non-final stop is the drive-out day).`,
      `4. Each stop's searchQueries must be scoped to that stop's location — never mix locations in one stop's queries.`,
      `   Include 8–12 queries per stop. ALWAYS include:`,
      `   - Baseline: "top things to do in [stop location]", "best [stop location] neighborhoods" — REQUIRED regardless of interests`,
      `   - Meals: breakfast cafes, lunch spots, dinner restaurants`,
      `   - Interest-specific attractions (priority, not exclusive)`,
      `5. overnightType: use "camping" for remote park areas, "hotel" for cities, "flexible" when either works.`,
      `6. DEPARTURE DAYS: the last day at each stop (except the final stop) should have a theme like "Drive to [Next Stop]: [Scenic Route Activity]".`,
      `   Activities on departure days should be short scenic stops along the route, not full-day commitments.`,
    );
  } else if (intent.destinationType === 'national_park') {
    lines.push(
      `\nNATIONAL PARK REQUIREMENTS (single hub stop):`,
      `1. One stop with nightCount = ${intent.durationDays}`,
      `2. "location" must be the park name + gateway town, e.g. "Zion National Park / Springdale, UT"`,
      `3. "dayThemes" must have exactly ${intent.durationDays} themes, each covering one park zone + gateway town.`,
      `4. searchQueries must include named trailheads, scenic areas, visitor centers, and gateway town restaurants.`,
      `   ALWAYS include: "top things to do near [park name]", "best [gateway town] restaurants" as baseline queries.`,
      `5. Generate 12–18 specific queries.`,
    );
  } else {
    lines.push(
      `\nHUB TRIP REQUIREMENTS (single location):`,
      `1. One stop with nightCount = ${intent.durationDays}`,
      `2. "dayThemes" must have exactly ${intent.durationDays} themes.`,
      `3. searchQueries: 12–18 specific Google Places queries. ALWAYS include:`,
      `   - Baseline (REQUIRED regardless of stated interests):`,
      `     • "top things to do in ${intent.destination}"`,
      `     • "best ${intent.destination} neighborhoods to explore"`,
      `     • "${intent.destination} iconic landmarks attractions"`,
      `   - Meals: breakfast café searches, lunch spots, dinner restaurants matching budget`,
      `   - Interest-specific attraction searches (these get priority, but are not the only activities)`,
      `   - Nightlife/shopping/wellness if relevant to traveler style`,
    );
  }

  return lines.join("\n");
}

export async function generateTripStrategy(intent: TripIntent): Promise<TripStrategy> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: FAST_MODEL_NAME,
    max_tokens: 4096,
    tools: [{
      name: "generate_strategy",
      description: "Generate a trip planning strategy with per-stop overnight anchors and search queries",
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
    stops?: StopStrategy[];
    tripStyle?: string;
    dailyActivityCount?: number;
    activityBalance?: TripStrategy["activityBalance"];
  };

  // Fallback: if AI didn't produce stops, synthesize one hub stop from intent
  const stops: StopStrategy[] = raw.stops?.length
    ? raw.stops
    : [{
        location: intent.destination,
        nightCount: intent.durationDays,
        overnightType: 'flexible',
        dayThemes: Array.from({ length: intent.durationDays }, (_, i) => `Day ${i + 1} Exploration`),
        searchQueries: [],
      }];

  // Ensure total nightCount matches trip duration
  const totalNights = stops.reduce((s, st) => s + st.nightCount, 0);
  if (totalNights !== intent.durationDays && stops.length > 0) {
    const diff = intent.durationDays - totalNights;
    stops[stops.length - 1].nightCount = Math.max(1, stops[stops.length - 1].nightCount + diff);
    const last = stops[stops.length - 1];
    while (last.dayThemes.length < last.nightCount) {
      last.dayThemes.push(`Exploration Day ${last.dayThemes.length + 1}`);
    }
    last.dayThemes = last.dayThemes.slice(0, last.nightCount);
  }

  return {
    stops,
    tripStyle: (raw.tripStyle as TripStrategy["tripStyle"]) ?? intent.pace,
    dailyActivityCount: raw.dailyActivityCount ?? 4,
    activityBalance: raw.activityBalance ?? DEFAULT_BALANCE,
  };
}
