import Anthropic from "@anthropic-ai/sdk";
import { MODEL_NAME, ITINERARY_TOOL_INPUT_SCHEMA } from "../constants";
import { type TripIntent, type TripStrategy, type PlaceCluster } from "./types";

function formatClusters(clusters: PlaceCluster[]): string {
  return clusters
    .map((cluster, i) => {
      const placeList = cluster.places
        .map((p) => {
            const summary = p.editorialSummary ? ` | "${p.editorialSummary}"` : "";
            return `  • ${p.name} | ${p.category} | rating: ${p.rating}/5 (${p.reviewCount} reviews) | price: ${"$".repeat(Math.max(1, p.priceLevel))} | lat: ${p.coordinates.lat.toFixed(5)}, lng: ${p.coordinates.lng.toFixed(5)}${summary}`;
          })
        .join("\n");

      return `DAY ${i + 1} — ${cluster.neighborhood ?? "Exploration Area"} (center: ${cluster.centerLat.toFixed(4)}, ${cluster.centerLng.toFixed(4)}):\n${placeList}`;
    })
    .join("\n\n");
}

function buildPersonalizationBlock(intent: TripIntent): string {
  const lines: string[] = [];

  if (intent.tasteProfile || intent.derivedIntent || intent.tripPrompt) {
    lines.push("\nPERSONALIZATION SIGNALS (apply these to shape the itinerary):");
  }

  if (intent.tripPrompt) {
    lines.push(`- User's trip description: "${intent.tripPrompt}"`);
  }

  if (intent.derivedIntent) {
    const di = intent.derivedIntent;
    if (di.tripMood) lines.push(`- Trip mood: ${di.tripMood}`);
    if (di.themes?.length) lines.push(`- Trip themes: ${di.themes.join(", ")}`);
    if (di.avoid?.length) lines.push(`- User wants to avoid: ${di.avoid.join(", ")}`);
  }

  if (intent.tasteProfile) {
    const tp = intent.tasteProfile;
    const activitiesPerDay = Math.round(3 + tp.pace * 3);
    lines.push(
      `- Pacing: ${tp.pace < 0.35 ? "relaxed — fewer activities, longer dwell times, unhurried feel" : tp.pace > 0.65 ? "packed — maximize activities, efficient transitions" : "balanced pacing"}`,
      `- Venue style: ${tp.hiddenGems > 0.6 ? "STRONGLY prefer hidden gems, local favorites, niche spots — avoid obvious tourist traps" : tp.hiddenGems < 0.4 ? "prefer well-known iconic venues, top-rated attractions" : "mix of popular and local spots"}`,
      `- Food focus: ${tp.foodie > 0.6 ? "food is central — make every meal special, seek local specialties" : tp.foodie < 0.4 ? "food is functional — quick, good, unpretentious" : "balanced food choices"}`,
      `- Evening activities: ${tp.nightlife > 0.5 ? "include bars, live music, or nightlife" : "no nightlife — end evenings by 10pm"}`,
      `- Activity type: ${tp.adventure > 0.6 ? "prioritize outdoor, physical, active experiences" : tp.adventure < 0.4 ? "prioritize cultural, museum, food experiences" : "mix of active and cultural"}`,
      `- Recommended activities per day: ${activitiesPerDay}`,
    );
    if (tp.walkingTolerance < 0.35) {
      lines.push(`- Minimize walking — cluster activities geographically, use transport often`);
    }
  }

  if (intent.includeActivities?.length) {
    lines.push(`- Must include these activity types: ${intent.includeActivities.join(", ")}`);
  }

  if (intent.avoidActivities?.length) {
    lines.push(`- EXCLUDE these activity types completely: ${intent.avoidActivities.join(", ")}`);
  }

  return lines.join("\n");
}

export async function generateDailyPlans(
  clusters: PlaceCluster[],
  intent: TripIntent,
  strategy: TripStrategy
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const candidateList = formatClusters(clusters);
  const hasClusters = clusters.some((c) => c.places.length > 0);
  const personalizationBlock = buildPersonalizationBlock(intent);

  const prompt = `You are an expert travel planner building a detailed, realistic itinerary for a mobile travel app.

TRIP DETAILS:
- Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}
- Duration: ${intent.durationDays} days
- Party: ${intent.party} | Budget: ${intent.budget} | Pace: ${intent.pace}
- Interests: ${intent.rankedInterests.join(", ")}
- Dates: ${intent.startDate ?? "flexible"} to ${intent.endDate ?? "flexible"}
${personalizationBlock}

${hasClusters ? `CANDIDATE PLACES FROM GOOGLE PLACES (verified real venues with accurate coordinates):
${candidateList}

PLANNING RULES:
1. PREFER the candidate places above — they are real venues with verified data. Their coordinates are accurate. Use them wherever they fit.
2. You may supplement with well-known named landmarks (museums, monuments, iconic sites) when candidates don't cover a needed activity slot.` : `PLANNING RULES:
1. Use only established, well-known venues with a strong local reputation. Prefer places that have been operating for years.`}
3. Every day MUST include:
   - BREAKFAST (8:00–9:30 AM): café, bakery, brunch spot, or hotel restaurant. NEVER a bar, dessert shop, or dinner-only restaurant.
   - LUNCH (12:00–2:00 PM): restaurant, café, or food market that serves lunch.
   - DINNER (6:30–9:00 PM): full-service restaurant matching ${intent.budget} budget. Vary cuisine across days.
   Set category to "food" for all meals.
4. SPECIFIC NAMED PLACES ONLY — no vague entries like "explore the neighborhood".
5. TIME FEASIBILITY: if activity A ends at 10:00 AM and transit takes 20 min, activity B starts at 10:20 AM minimum.
6. REALISTIC DURATIONS: Breakfast 45–60 min | Major attraction 2–3 hrs | Lunch 60–75 min | Mid attraction 1–1.5 hrs | Dinner 75–90 min | Evening 1–2 hrs.
7. DAY STRUCTURE: Start 8:00 AM, end by 11:00 PM. Times format: "09:00 AM - 10:30 AM".
8. TRANSPORT: For each activity specify travel to the NEXT one (mode + realistic time). Last activity of day = empty transport array.
9. No venue repeated across days.
10. Google Maps URLs: https://www.google.com/maps/search/?api=1&query=Place+Name+City
11. Day titles: catchy and thematic (e.g. "Temples & Street Food", "Art, Markets & Rooftops").

Day themes to follow: ${strategy.dayThemes.join(" | ")}`;

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: 16000,
    tools: [{
      name: "create_itinerary",
      description: "Create a structured travel itinerary from real place data",
      input_schema: ITINERARY_TOOL_INPUT_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "create_itinerary" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Daily planning failed: Claude did not return a structured itinerary");
  }

  return toolBlock.input as Record<string, unknown>;
}
