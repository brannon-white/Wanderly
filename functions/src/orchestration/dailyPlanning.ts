import Anthropic from "@anthropic-ai/sdk";
import { MODEL_NAME, ITINERARY_TOOL_INPUT_SCHEMA } from "../constants";
import { type TripIntent, type TripArchetype, type DayContext, type PlaceCandidate } from "./types";

function formatPlace(p: PlaceCandidate): string {
  const summary = p.editorialSummary ? ` — "${p.editorialSummary}"` : "";
  const priceStr = p.priceLevel > 0 ? ` | ${"$".repeat(p.priceLevel)}` : "";
  return `  • ${p.name} | rating: ${p.rating}/5 (${p.reviewCount} reviews)${priceStr} | ${p.address.split(",").slice(0, 2).join(",")}${summary}`;
}

function formatDayContext(ctx: DayContext, dayNumber: number, isRoute: boolean): string {
  const lines: string[] = [];
  const { skeleton, anchor, supporting, osmHikes, stopLocation } = ctx;

  lines.push(`${"═".repeat(60)}`);
  lines.push(`DAY ${dayNumber}: ${skeleton.theme.toUpperCase()}${skeleton.isDepartureDay ? " [DEPARTURE DAY]" : ""}`);
  lines.push(`Location: ${stopLocation} | Vibe: ${skeleton.vibe} | Pace: ${skeleton.pace}`);

  if (anchor) {
    lines.push(`\nDAY ANCHOR (the centerpiece — build the day around this):`);
    lines.push(formatPlace(anchor));
    lines.push(`Anchor intent: ${skeleton.anchorIntent}`);
  } else {
    lines.push(`\nANCHOR: [not found via search — use your knowledge of ${stopLocation} for: ${skeleton.anchorIntent}]`);
  }

  if (osmHikes.length > 0 && !skeleton.isDepartureDay) {
    lines.push(`\nVERIFIED HIKING TRAILS nearby (use exact names and durations):`);
    for (const h of osmHikes) {
      lines.push(`  • ${h.name} | ${h.distanceMiles} mi | ~${h.estimatedDurationHours} hrs | ${h.difficulty}`);
    }
  }

  lines.push(`\nSUPPORTING PLACES (real venues nearby — prefer these over invented names):`);

  if (supporting.breakfast.length > 0) {
    lines.push(`  Breakfast options:`);
    supporting.breakfast.forEach((p) => lines.push(formatPlace(p)));
  }

  if (supporting.lunch.length > 0) {
    lines.push(`  Lunch options:`);
    supporting.lunch.slice(0, 3).forEach((p) => lines.push(formatPlace(p)));
  }

  if (supporting.dinner.length > 0) {
    lines.push(`  Dinner options:`);
    supporting.dinner.slice(0, 3).forEach((p) => lines.push(formatPlace(p)));
  }

  if (supporting.secondary.length > 0) {
    lines.push(`  Secondary activities (complement the anchor):`);
    supporting.secondary.slice(0, 3).forEach((p) => lines.push(formatPlace(p)));
  }

  lines.push(`\nMeal intent for this day: ${skeleton.mealIntent}`);
  lines.push(`Secondary intent: ${skeleton.secondaryIntent}`);

  if (skeleton.isDepartureDay && isRoute) {
    lines.push(`\nDEPARTURE DAY RULES: Morning only (3–4 activities max). Short stops only. No hikes. Activities along the drive route.`);
  }

  return lines.join("\n");
}

function buildPersonalizationBlock(intent: TripIntent): string {
  const lines: string[] = [];
  const tp = intent.effectiveTasteProfile ?? intent.tasteProfile;
  const hasPromptIntent = !!(intent.derivedIntent && Object.keys(intent.derivedIntent).length > 0);

  if (!tp && !hasPromptIntent && !intent.includeActivities?.length && !intent.avoidActivities?.length) {
    return "";
  }

  lines.push("\nPERSONALIZATION:");

  if (intent.includeActivities?.length || intent.avoidActivities?.length) {
    if (intent.includeActivities?.length) lines.push(`  MUST INCLUDE: ${intent.includeActivities.join(", ")}`);
    if (intent.avoidActivities?.length) lines.push(`  NEVER INCLUDE: ${intent.avoidActivities.join(", ")}`);
  }

  if (intent.tripPrompt || hasPromptIntent) {
    if (intent.tripPrompt) lines.push(`  User's request: "${intent.tripPrompt}"`);
    if (intent.derivedIntent?.tripMood) lines.push(`  Mood: ${intent.derivedIntent.tripMood}`);
    if (intent.derivedIntent?.themes?.length) lines.push(`  Themes: ${intent.derivedIntent.themes.join(", ")}`);
  }

  if (tp) {
    lines.push(
      `  Food: ${tp.foodie > 0.6 ? "food-first — every meal should be special" : tp.foodie < 0.4 ? "food as fuel" : "balanced"}`,
      `  Nightlife: ${tp.nightlife > 0.5 ? "enjoys bars, live music" : "ends evenings early"}`,
      `  Venue style: ${tp.hiddenGems > 0.6 ? "hidden gems over tourist traps" : tp.hiddenGems < 0.4 ? "well-known iconic venues" : "mix"}`,
    );
    if (tp.luxury > 0.6) lines.push(`  Comfort: premium venues where possible`);
    else if (tp.luxury < 0.3) lines.push(`  Comfort: budget-friendly and authentic`);
  }

  return lines.join("\n");
}

export async function generateDailyPlans(
  dayContextsByStop: DayContext[][],
  intent: TripIntent,
  archetype: TripArchetype,
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const isRoute = intent.tripType === 'route';
  const personalizationBlock = buildPersonalizationBlock(intent);

  // Build the per-day context section
  const dayContextSections: string[] = [];
  let globalDayNum = 1;
  for (const stopContexts of dayContextsByStop) {
    for (const ctx of stopContexts) {
      dayContextSections.push(formatDayContext(ctx, globalDayNum, isRoute));
      globalDayNum++;
    }
  }

  const parkContextBlock = intent.destinationType === 'national_park'
    ? `\nNATIONAL PARK RULES:
- In-park anchors (trails, scenic areas) are the morning centerpiece.
- ALL meals must be in nearby gateway towns — this is correct and expected.
- After the morning anchor, transition to the gateway town for lunch, afternoon, and dinner.
- Out-of-park activities are expected and allowed.\n`
    : "";

  const roadTripBlock = isRoute
    ? `\nROAD TRIP RULES:
- Departure days (last day at each non-final stop): SHORT activities only. No major hikes.
  Preferred: scenic overlooks, roadside stops, coffee in town. Max 3–4 activities.
- Activities on departure days must be along the route to the NEXT stop.
- Non-departure days: all activities within ~45–60 min of the overnight anchor.\n`
    : "";

  const prompt = `You are a travel writer building a detailed, realistic itinerary for a mobile travel app.
Each day has been pre-designed with an anchor experience and real nearby venues. Your job is NARRATIVE ASSEMBLY:
sequence the day intelligently, write compelling descriptions, and build a schedule that flows naturally.

TRIP DETAILS:
- Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}
- Duration: ${intent.durationDays} days
- Party: ${intent.party} | Budget: ${intent.budget}
- Trip type: ${isRoute ? 'ROAD TRIP (multi-stop)' : 'Hub (single location)'}
${personalizationBlock}
${parkContextBlock}
${roadTripBlock}
DAILY CONTEXTS:
${dayContextSections.join("\n\n")}

ASSEMBLY RULES:
1. PREFER the real venues listed in each day's context — they are verified by Google Places.
   If a supporting place fits the slot, use it. Only invent venues when context is missing.

2. EVERY day MUST include:
   - BREAKFAST (8:00–9:30 AM): café or bakery. NEVER a bar or dinner-only restaurant.
   - LUNCH (12:00–2:00 PM): restaurant or café.
   - DINNER (6:30–9:00 PM): full-service restaurant. Vary cuisine across days.
   Set category to "food" for all meals. Departure days may skip dinner if driving all day.

3. SPECIFIC NAMED PLACES ONLY. No vague entries like "explore the area" or "local restaurants."
   Every activity must name the exact spot, trail, or venue.

4. TIME FEASIBILITY: If activity A ends at 10:00 AM and transit takes 20 min, B starts at 10:20 AM min.

5. REALISTIC DURATIONS:
   - Breakfast: 45–60 min | Major attraction: 2–3 hrs | Lunch: 60–75 min
   - Nature site (waterfall, lake, overlook): 1.5 hrs minimum
   - State/National park trail: 3+ hours
   - Dinner: 75–90 min

6. DAY STRUCTURE: Start 8:00 AM, end by 10:30 PM. Times format: "09:00 AM - 10:30 AM"

7. TRANSPORT: For each activity specify travel to the NEXT one (mode + realistic time).
   Last activity of the day = empty transport array.

8. NO VENUE REPEATED across any days.

9. Google Maps URLs: https://www.google.com/maps/search/?api=1&query=Place+Name+City

10. OUTDOOR TIMING: No trail or nature reserve to START after 3:00 PM.

11. ONE MAJOR HIKE PER DAY maximum.

12. HIKING FORMAT: name = specific trail name. category = "adventure".
    Description: include distance, time, difficulty, one feature sentence.

13. ACTIVITY VARIETY: The anchor defines the DAY'S CHARACTER, not every activity.
    A hiking anchor day still includes local restaurants, a scenic viewpoint, maybe a quick browse of a shop.
    Do NOT fill every non-meal slot with the same type as the anchor.

14. GEOGRAPHIC COHERENCE: Activities within a day should be geographically logical.
    Build the day OUTWARD from the anchor — nearby meals and secondary activities first.
    Do NOT schedule activities on opposite sides of the city from each other.

15. For hub trips: all activities within ~30–40 miles / 45–60 min of ${intent.destination}.

OUTPUT FORMAT:
- tripType: "${isRoute ? 'route' : 'hub'}"
- stops: one entry per stop, in order
- Each stop has exactly the number of days shown above
- overnightAnchor.location: where they're actually sleeping (the town/area, not just the park name)`;

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: 16000,
    tools: [{
      name: "create_itinerary",
      description: "Create a structured travel itinerary with stops and daily plans",
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
