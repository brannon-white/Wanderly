import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";
import {
  MODEL_NAME,
  FAST_MODEL_NAME,
  ITINERARY_TOOL_INPUT_SCHEMA,
  MIN_ACTIVITIES_PER_DAY,
} from "../constants";
import { type GenerateItineraryRequest, type TasteProfile } from "../itinerarySchemas";
import { type PlaceCandidate, type StopPool } from "./types";
import { type StopPlan } from "./contextBuilder";

// ─── 1. Stop planner (road trips only, Haiku) ─────────────────────────────────
// Hub trips skip this. Region/road-trip requests get one cheap Haiku call to
// decide stops + night counts before we can fetch Places candidates.

const STOP_PLAN_SCHEMA = {
  type: "object" as const,
  required: ["stops"],
  properties: {
    stops: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        required: ["location", "nightCount"],
        properties: {
          location: { type: "string", description: "Specific city/area + state/country, e.g. 'Bend, Oregon'" },
          region: { type: "string" },
          nightCount: { type: "number", description: "Whole number of nights at this stop" },
        },
      },
    },
  },
};

export async function planStops(
  input: GenerateItineraryRequest,
  durationDays: number,
): Promise<StopPlan[]> {
  // Hub trip: one stop, all nights there.
  if ((input.tripType ?? "hub") === "hub" && input.destinationType !== "region") {
    return [{ location: input.destinationName, nightCount: durationDays }];
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const paceHint: Record<string, string> = {
    every_night: "move to a new location every night",
    every_few_days: "stay 2–4 nights per stop",
    few_stops: "2–3 stops total, meaningful time at each",
    flexible: "choose pacing based on geography",
  };

  const prompt = `You are planning the geographic structure of a road trip.

DESTINATION: ${input.destinationName}${input.country ? `, ${input.country}` : ""}
DURATION: ${durationDays} nights total
PARTY: ${input.party}  BUDGET: ${input.budget}
TRAVEL PACE: ${input.travelPace ? paceHint[input.travelPace] : "flexible"}
${input.tripPrompt ? `USER'S OWN WORDS: "${input.tripPrompt}"` : ""}

Pick 2–4 stops that form a logical geographic route. No backtracking.
Each stop must be a SPECIFIC city or area (e.g. "Bend, Oregon"), never a state or region.
Sum of nightCount across all stops MUST equal exactly ${durationDays}.`;

  const response = await client.messages.create({
    model: FAST_MODEL_NAME,
    max_tokens: 1024,
    tools: [{
      name: "plan_stops",
      description: "Plan the stops + nights for a road trip",
      input_schema: STOP_PLAN_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "plan_stops" },
    messages: [{ role: "user", content: prompt }],
  });

  const tool = response.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") {
    // Fallback: single stop = destination
    return [{ location: input.destinationName, nightCount: durationDays }];
  }

  const raw = tool.input as { stops?: StopPlan[] };
  const stops: StopPlan[] = (raw.stops ?? []).filter((s) => s.location && s.nightCount > 0);
  if (stops.length === 0) {
    return [{ location: input.destinationName, nightCount: durationDays }];
  }

  // Force nightCount sum == durationDays by adjusting the last stop.
  const totalNights = stops.reduce((sum, s) => sum + s.nightCount, 0);
  if (totalNights !== durationDays) {
    const diff = durationDays - totalNights;
    stops[stops.length - 1].nightCount = Math.max(1, stops[stops.length - 1].nightCount + diff);
  }

  logger.info("Trip planner: stops decided", {
    stops: stops.map((s) => `${s.location} (${s.nightCount}n)`),
  });

  return stops;
}

// ─── 2. One-shot itinerary planner (Sonnet) ───────────────────────────────────

function formatPlace(p: PlaceCandidate): string {
  const summary = p.editorialSummary ? ` — "${p.editorialSummary}"` : "";
  const priceStr = p.priceLevel > 0 ? ` ${"$".repeat(p.priceLevel)}` : "";
  const addr = p.address.split(",").slice(0, 2).join(",").trim();
  return `    • ${p.name} | ${p.rating}/5 (${p.reviewCount})${priceStr} | ${addr}${summary}`;
}

function formatTasteProfile(tp: TasteProfile | undefined): string {
  if (!tp) return "";
  const lines: string[] = ["TRAVELER TASTE PROFILE (0–1 scale; higher = stronger preference):"];
  const fmt = (label: string, v: number) => `  ${label}: ${v.toFixed(2)}`;
  lines.push(fmt("pace (activity density)", tp.pace));
  lines.push(fmt("foodie", tp.foodie));
  lines.push(fmt("nightlife", tp.nightlife));
  lines.push(fmt("adventure / outdoor", tp.adventure));
  lines.push(fmt("nature", tp.nature));
  lines.push(fmt("hidden gems vs iconic", tp.hiddenGems));
  lines.push(fmt("luxury", tp.luxury));
  lines.push(fmt("walking tolerance", tp.walkingTolerance));
  return lines.join("\n");
}

function formatStopPool(pool: StopPool): string {
  const lines: string[] = [];
  lines.push("═".repeat(72));
  lines.push(`STOP ${pool.stopIndex + 1}: ${pool.location}  (${pool.nightCount} night${pool.nightCount === 1 ? "" : "s"})`);
  if (pool.isFirstStop && pool.isLastStop) {
    lines.push("(Single-stop hub trip — all days here.)");
  } else if (pool.isFirstStop) {
    lines.push("(First stop. Last day at this stop may be a drive day to the next stop.)");
  } else if (pool.isLastStop) {
    lines.push("(Final stop. Days here run normally.)");
  } else {
    lines.push("(Intermediate stop. Last day at this stop may be a drive day to the next.)");
  }

  const c = pool.candidates;

  const section = (title: string, places: PlaceCandidate[], hint: string) => {
    lines.push("");
    lines.push(`  ${title}  (${places.length} options) — ${hint}`);
    if (places.length === 0) {
      lines.push(`    [none returned — invent real venues in ${pool.location} from your knowledge]`);
      return;
    }
    places.forEach((p) => lines.push(formatPlace(p)));
  };

  section("BREAKFAST POOL", c.breakfast,
    "cafés / bakeries / breakfast restaurants. Pick a different one per morning.");
  section("FOOD POOL", c.food,
    "restaurants for lunches AND dinners. Vary cuisine across days. Never reuse a venue.");
  section("NIGHTLIFE / EVENING POOL", c.nightlife,
    "bars, live music, dessert spots. Use for the 20:30–22:30 evening slot.");
  section("ATTRACTIONS POOL", c.attractions,
    "museums, galleries, landmarks, markets, major sights. Day anchors live here.");
  section("SCENIC / OUTDOOR POOL", c.scenic,
    "parks, viewpoints, golden-hour spots. Late-afternoon slots love these.");

  if (pool.trails.length > 0) {
    lines.push("");
    lines.push(`  VERIFIED HIKING TRAILS — use these exact names when planning a hike day:`);
    for (const t of pool.trails.slice(0, 8)) {
      lines.push(`    • ${t.name} | ${t.distanceMiles} mi | ~${t.estimatedDurationHours} hrs | ${t.difficulty}`);
    }
  }

  return lines.join("\n");
}

function buildPlannerPrompt(
  input: GenerateItineraryRequest,
  pools: StopPool[],
  durationDays: number,
): string {
  const isRoute = (input.tripType ?? "hub") === "route" || pools.length > 1;
  const isNationalPark = input.destinationType === "national_park";

  const interestLine = input.interests.length > 0
    ? `INTERESTS: ${input.interests.join(", ")}`
    : "INTERESTS: general sightseeing";

  const includeLine = input.includeActivities?.length
    ? `MUST INCLUDE (hard requirement): ${input.includeActivities.join(", ")}`
    : "";
  const avoidLine = input.avoidActivities?.length
    ? `NEVER INCLUDE: ${input.avoidActivities.join(", ")}`
    : "";

  const promptLine = input.tripPrompt
    ? `USER'S OWN WORDS: "${input.tripPrompt}"  ← weight this heavily over generic preferences`
    : "";

  const tasteBlock = formatTasteProfile(input.tasteProfile);

  const parkBlock = isNationalPark
    ? `\nNATIONAL PARK CONTEXT:
- In-park anchors (trails, scenic drives) are mornings.
- Meals are in the nearest gateway town — that's expected, not a bug.
- Use the verified trail names exactly. Don't invent trail names.\n`
    : "";

  const routeBlock = isRoute
    ? `\nROAD TRIP CONTEXT:
- Stops are pre-decided (see below). Don't change them.
- The LAST day at each non-final stop should be marked isDriveDay:true, contain 3–4 short activities
  (breakfast + scenic stop + lunch + maybe one more), and end earlier (~16:00). Skip evening.
- Non-drive days run the full slot grid below.\n`
    : "";

  const poolBlocks = pools.map(formatStopPool).join("\n\n");

  return `You are a senior trip planner producing a complete, realistic ${durationDays}-day itinerary.
You have the user's full request, their taste profile, and a verified pool of real venues per stop.
Use it all to produce ONE excellent itinerary in a single pass — the way a thoughtful human planner would.

═══════════════════════════════════════════════════════════════
TRIP REQUEST

DESTINATION: ${input.destinationName}${input.country ? `, ${input.country}` : ""}
DURATION: ${durationDays} days
PARTY: ${input.party}
BUDGET: ${input.budget}
TRIP TYPE: ${isRoute ? "ROAD TRIP (multi-stop)" : "HUB (single base)"}
${interestLine}
${promptLine}
${includeLine}
${avoidLine}

${tasteBlock}
${parkBlock}${routeBlock}
═══════════════════════════════════════════════════════════════
CANDIDATE POOLS (real venues from Google Places — prefer these)

${poolBlocks}

═══════════════════════════════════════════════════════════════
PLANNING RULES — non-negotiable

DAY STRUCTURE (every non-drive day must fill these slots):

  08:00–09:30  BREAKFAST            ★ required  — pick from BREAKFAST POOL
  09:30–12:00  MORNING activity     ★ required  — typical anchor slot for AM experiences
  12:00–14:00  LUNCH                ★ required  — pick from FOOD POOL
  14:00–17:00  AFTERNOON activity   ★ required  — alternate anchor slot
  17:00–18:30  LATE AFTERNOON       ◆ strongly recommended  — scenic / golden hour / coffee / dessert / brewery
  18:30–20:30  DINNER               ★ required  — pick from FOOD POOL (different from lunch)
  20:30–22:30  EVENING              ◆ strongly recommended  — pick from NIGHTLIFE POOL (or skip only if pace=slow + low nightlife taste)

HARD CONSTRAINTS:

1. MINIMUM ${MIN_ACTIVITIES_PER_DAY} activities per non-drive day. Day must end no earlier than 20:30.
2. NO REPEATED VENUES anywhere in the trip. Each restaurant, attraction, bar appears at most once.
3. SPECIFIC NAMED PLACES ONLY. No "local cafe", no "downtown restaurant".
4. PREFER POOL VENUES over invented names. Invent only when a slot has no plausible pool match.
5. TIME FEASIBILITY: consecutive activities can't overlap. Account for transit time between coordinates.
   Format times as "09:00 AM - 10:30 AM" (12-hour, leading zero).
6. REALISTIC DURATIONS:
   - Breakfast 45–60 min | Lunch 60–75 min | Dinner 75–90 min
   - Major attraction / museum 2–3 hrs | Hike 3+ hrs
   - Bar / dessert 60–90 min
7. ONE MAJOR HIKE per day max. Trails cannot start after 15:00.
8. CATEGORY field: "food" for all meals, "adventure" for hikes/trails, "nightlife" for bars, "culture" for museums, "nature" for parks/viewpoints, "attraction" otherwise.
9. TRANSPORT array describes how to reach the NEXT activity (mode + realistic time). Last activity = empty array.
10. GOOGLE MAPS URLs: https://www.google.com/maps/search/?api=1&query=Place+Name+City

DESIGN PRINCIPLES (how a great planner thinks):

A. CONTRAST DAYS — vary anchor type day to day. Don't put two big hikes back-to-back. If Day 1 is a major hike,
   Day 2 should be cultural / urban / food-driven.

B. ENERGY CURVE — across a 5-day trip, alternate intensities. Schedule the most demanding day mid-trip,
   not on the arrival day.

C. CUISINE VARIETY — vary cuisines across days. Don't put pizza for dinner two nights in a row.
   Save one standout restaurant for a celebratory night.

D. ANCHOR PLACEMENT — each day has ONE memorable centerpiece. Sunrise hikes / markets → morning slot.
   Museums / galleries → afternoon. Sunset cruises / scenic drives → late afternoon.

E. GEOGRAPHIC COHERENCE — build days outward from the anchor. No criss-crossing the city.

F. RESPECT THE USER'S WORDS — if the user wrote "we love craft breweries", put a brewery in every stop's
   late-afternoon slot. If they said "no museums", omit them.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT

- tripType: "${isRoute ? "route" : "hub"}"
- stops: one entry per stop above, in the same order, with exactly the right nightCount worth of days.
- For each day produce label ("Day N"), title (catchy theme), activities (≥ ${MIN_ACTIVITIES_PER_DAY}).
- For each activity: id, name, category, description (2–3 sentences), time, coordinates (real lat/lng), transport.
- isDriveDay: true ONLY on departure days between road-trip stops.
- overnightAnchor.location: where the traveller actually sleeps (the town/area).`;
}

export async function planItinerary(
  input: GenerateItineraryRequest,
  pools: StopPool[],
  durationDays: number,
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPlannerPrompt(input, pools, durationDays);

  logger.info("Trip planner: calling Sonnet", {
    stopCount: pools.length,
    totalCandidates: pools.reduce(
      (sum, p) => sum + p.candidates.breakfast.length + p.candidates.food.length +
        p.candidates.nightlife.length + p.candidates.attractions.length + p.candidates.scenic.length,
      0,
    ),
    promptTokens: Math.round(prompt.length / 4),
  });

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
    throw new Error("Trip planning failed: Claude did not return a structured itinerary");
  }

  return toolBlock.input as Record<string, unknown>;
}

// ─── 3. Repair pass — called when validation fails ────────────────────────────

export async function repairItinerary(
  badItinerary: Record<string, unknown>,
  issues: string[],
  input: GenerateItineraryRequest,
  pools: StopPool[],
  durationDays: number,
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const basePrompt = buildPlannerPrompt(input, pools, durationDays);

  const repairPrompt = `${basePrompt}

═══════════════════════════════════════════════════════════════
REPAIR PASS

You produced the itinerary below and it FAILED validation. Return a corrected
full itinerary that fixes every issue while preserving the parts that are
already good. Don't reshuffle valid days for no reason.

ISSUES TO FIX:
${issues.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}

PREVIOUS OUTPUT:
${JSON.stringify(badItinerary, null, 2)}

REPAIR RULES:
- For days flagged as too short / ending too early: ADD activities in the missing slots.
- For missing meals: slot them into the correct window using a pool venue.
- For duplicate venues: swap the duplicate for a different pool venue.
- For time overlaps: shift times so consecutive activities don't conflict.
- Output the FULL corrected itinerary (every stop, every day) — not a diff.`;

  logger.info("Trip planner: repair pass", { issueCount: issues.length });

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: 16000,
    tools: [{
      name: "create_itinerary",
      description: "Return the corrected full itinerary",
      input_schema: ITINERARY_TOOL_INPUT_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "create_itinerary" },
    messages: [{ role: "user", content: repairPrompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Repair pass failed: Claude did not return a structured itinerary");
  }

  return toolBlock.input as Record<string, unknown>;
}
