import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";
import {
  MODEL_NAME,
  FAST_MODEL_NAME,
  ITINERARY_TOOL_INPUT_SCHEMA,
  ACTIVITY_TOOL_INPUT_SCHEMA,
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
      maxItems: 8,
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

/**
 * Does a planned stop's location refer to the origin city? We match on the bare
 * city token (before the first comma) so "Chattanooga" matches "Chattanooga, TN".
 */
export function isOriginStop(stopLocation: string, origin: string): boolean {
  const norm = (s: string) => s.split(",")[0].trim().toLowerCase();
  return norm(stopLocation) === norm(origin);
}

/**
 * Translate the user's pace choice into a concrete stop-count target for a trip
 * of `durationDays` nights. The road trip ALWAYS begins at the user's selected
 * destination (the origin) and fans outward — these counts include that first stop.
 */
export function paceGuidance(
  travelPace: GenerateItineraryRequest["travelPace"],
  durationDays: number,
): { targetStops: number; hint: string } {
  switch (travelPace) {
    case "every_night":
      // A new place each night: one stop per night (origin is night 1), capped at 8.
      return {
        targetStops: Math.min(8, Math.max(2, durationDays)),
        hint: `move to a new location every night — plan ${Math.min(8, Math.max(2, durationDays))} stops of 1 night each (the first being the origin)`,
      };
    case "every_few_days": {
      const target = Math.min(8, Math.max(2, Math.round(durationDays / 3)));
      return {
        targetStops: target,
        hint: `2–4 nights per stop — aim for about ${target} stops`,
      };
    }
    case "few_stops":
      return {
        targetStops: Math.min(3, Math.max(2, durationDays)),
        hint: "2–3 stops total, meaningful time at each",
      };
    case "flexible":
    default: {
      const target = Math.min(4, Math.max(2, Math.round(durationDays / 2)));
      return {
        targetStops: target,
        hint: `choose pacing based on geography — about ${target} stops`,
      };
    }
  }
}

/**
 * Make the stops' nightCounts sum to exactly `durationDays`, every stop keeping at
 * least 1 night. Drops trailing stops if there are more stops than nights (you can't
 * sleep <1 night somewhere), then adds/removes leftover nights from the end. Order is
 * preserved, so the origin (stop 1) is never dropped unless durationDays is 0.
 */
/**
 * Force the origin city to be the first stop. If it already appears later in the
 * route, move it to the front; if it's missing entirely, prepend it. This is the
 * enforcement behind "a road trip starting in X must open in X".
 */
export function anchorOriginFirst(stops: StopPlan[], origin: string): StopPlan[] {
  const result = [...stops];
  const originIdx = result.findIndex((s) => isOriginStop(s.location, origin));
  if (originIdx > 0) {
    const [originStop] = result.splice(originIdx, 1);
    result.unshift(originStop);
  } else if (originIdx === -1) {
    result.unshift({ location: origin, nightCount: 1 });
  }
  return result;
}

export function normalizeNights(stops: StopPlan[], durationDays: number): StopPlan[] {
  // Can't have more stops than nights — keep the earliest `durationDays` stops.
  let result = stops.slice(0, Math.max(1, durationDays));
  // Floor every stop at 1 night.
  result = result.map((s) => ({ ...s, nightCount: Math.max(1, Math.round(s.nightCount)) }));

  let total = result.reduce((sum, s) => sum + s.nightCount, 0);
  // Too many nights: trim from the back, never below 1 per stop.
  for (let i = result.length - 1; total > durationDays && i >= 0; ) {
    if (result[i].nightCount > 1) {
      result[i].nightCount -= 1;
      total -= 1;
    } else {
      i -= 1;
    }
  }
  // Too few nights: pile the remainder onto the last stop.
  if (total < durationDays) {
    result[result.length - 1].nightCount += durationDays - total;
  }
  return result;
}

export async function planStops(
  input: GenerateItineraryRequest,
  durationDays: number,
): Promise<StopPlan[]> {
  // Hub trip: one stop, all nights there.
  if ((input.tripType ?? "hub") === "hub" && input.destinationType !== "region") {
    return [{ location: input.destinationName, nightCount: durationDays }];
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const origin = input.destinationName;
  const { targetStops, hint } = paceGuidance(input.travelPace, durationDays);

  const prompt = `You are planning the geographic structure of a road trip.

STARTING POINT (origin): ${origin}${input.country ? `, ${input.country}` : ""}
DURATION: ${durationDays} nights total
PARTY: ${input.party}  BUDGET: ${input.budget}
TRAVEL PACE: ${hint}
${input.tripPrompt ? `USER'S OWN WORDS: "${input.tripPrompt}"` : ""}

The trip BEGINS at the origin above. Make the FIRST stop "${origin}" itself, then
travel outward to other interesting, feasible places nearby (same state/region).
Plan about ${targetStops} stops in total (including the origin as stop 1).
Build a logical one-way route — no backtracking, each stop reasonably close to the
previous one (ideally within a 2–3 hour drive). Each stop must be a SPECIFIC city or
area (e.g. "Bend, Oregon"), never a whole state or region.
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
    return [{ location: origin, nightCount: durationDays }];
  }

  const raw = tool.input as { stops?: StopPlan[] };
  let stops: StopPlan[] = (raw.stops ?? []).filter((s) => s.location && s.nightCount > 0);
  if (stops.length === 0) {
    return [{ location: origin, nightCount: durationDays }];
  }

  // Guarantee the route STARTS at the origin the user picked, then make the nights
  // sum back to the requested duration. The model is instructed to do both, but we
  // enforce them so the trip can never open in the wrong city or drift off-duration.
  stops = normalizeNights(anchorOriginFirst(stops, origin), durationDays);

  logger.info("Trip planner: stops decided", {
    origin,
    pace: input.travelPace ?? "flexible",
    targetStops,
    stops: stops.map((s) => `${s.location} (${s.nightCount}n)`),
  });

  return stops;
}

// ─── 2. One-shot itinerary planner (Sonnet) ───────────────────────────────────

function formatPlace(p: PlaceCandidate): string {
  const summary = p.editorialSummary ? ` — "${p.editorialSummary}"` : "";
  const priceStr = p.priceLevel > 0 ? ` ${"$".repeat(p.priceLevel)}` : "";
  const addr = p.address.split(",").slice(0, 2).join(",").trim();
  const hours = p.openingHours ? ` | Hours: ${p.openingHours}` : "";
  return `    • ${p.name} | ${p.rating}/5 (${p.reviewCount})${priceStr} | ${addr}${hours}${summary}`;
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
    "parks, viewpoints, golden-hour spots. Use only what's listed here — do not invent natural landmarks; if this pool is sparse, lean on the verified trails and attractions instead.");

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

  // Build a single personalization block that frames interests as a LENS, not a filter.
  const activityList = input.includeActivities?.length
    ? input.includeActivities
    : input.interests.length > 0
      ? input.interests
      : [];

  const personalizationLines: string[] = [];
  if (activityList.length || input.tripVibes?.length || input.foodPreferences?.length || input.tripPrompt) {
    personalizationLines.push("PERSONALIZATION — use these as a LENS, not a filter:");
    if (activityList.length) {
      personalizationLines.push(`  Interests/activities: ${activityList.join(", ")}`);
    }
    if (input.tripVibes?.length) {
      personalizationLines.push(`  Vibes: ${input.tripVibes.join(", ")}`);
    }
    if (input.foodPreferences?.length) {
      personalizationLines.push(`  Food: ${input.foodPreferences.join(", ")} — let these shape every meal selection`);
    }
    if (input.tripPrompt) {
      personalizationLines.push(`  User's own words: "${input.tripPrompt}" ← weight this heavily`);
    }
    personalizationLines.push(`  ↑ These shape HOW the trip feels and which version of things you choose — NOT what gets included.`);
    personalizationLines.push(`    A hiker in Rome still visits the Colosseum — they just walk the scenic route there.`);
    personalizationLines.push(`    A foodie in Tokyo still visits Shibuya — they just know the best izakaya nearby.`);
    personalizationLines.push(`    Interests guide emphasis and secondary choices. They never replace iconic destinations.`);
  }
  const personalizationBlock = personalizationLines.join("\n");

  const avoidLine = input.avoidActivities?.length
    ? `NEVER INCLUDE: ${input.avoidActivities.join(", ")}`
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
- isDriveDay RULES (read carefully):
  • isDriveDay:true ONLY for the departure day of a NON-FINAL stop (last day at stop 1 before driving to stop 2, etc.).
  • NEVER isDriveDay on a hub trip — no inter-stop travel.
  • NEVER isDriveDay on any day of the FINAL stop — you're already at the destination.
  • NEVER isDriveDay on the first day at any stop.
  • Drive days: exactly 3–4 activities (breakfast + scenic stop + lunch + optional 1 more). End ~16:00. No dinner, no evening slot.
- Non-drive days run the full 7-slot grid below.\n`
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
${personalizationBlock}
${avoidLine}

${tasteBlock}
${parkBlock}${routeBlock}
═══════════════════════════════════════════════════════════════
CANDIDATE POOLS (real venues, pre-ranked by compatibility with this traveler's taste profile — venues near the top are the best fit)

${poolBlocks}

═══════════════════════════════════════════════════════════════
PLANNING RULES — non-negotiable

DAY STRUCTURE (every non-drive day must fill these slots):

  08:00–09:30  BREAKFAST            ★ required  — pick from BREAKFAST POOL
  09:30–12:00  MORNING activity     ★ required  — typical anchor slot for AM experiences
  12:00–14:00  LUNCH                ★ required  — pick from FOOD POOL
  14:00–17:00  AFTERNOON activity   ★ required  — alternate anchor slot
  17:00–18:30  LATE AFTERNOON       ★ required  — scenic viewpoint / golden hour walk / coffee shop / dessert spot / brewery
  18:30–20:30  DINNER               ★ required  — pick from FOOD POOL (different from lunch)
  20:30–22:30  EVENING              ★ required  — pick from NIGHTLIFE POOL; if nightlife=low substitute a dessert spot, evening stroll, or stargazing

HARD CONSTRAINTS:

1. MINIMUM ${MIN_ACTIVITIES_PER_DAY} activities per non-drive day. EVERY non-drive day MUST include late afternoon, dinner, AND an evening activity. Day MUST end no earlier than 20:30. This is non-negotiable — a day ending at 2 PM or 5 PM is a broken itinerary.
2. NO REPEATED VENUES anywhere in the trip. Each restaurant, attraction, bar appears at most once.
3. SPECIFIC NAMED PLACES ONLY. No "local cafe", no "downtown restaurant".
4. POOL VENUES + VERIFIED TRAILS ONLY — this is a hard rule. Every activity name MUST come from the candidate pools above (BREAKFAST/FOOD/NIGHTLIFE/ATTRACTIONS/SCENIC) or the VERIFIED HIKING TRAILS list. NEVER invent, guess, or recall a place name from your own knowledge — not for restaurants, not for landmarks, not for natural features. Any name you make up will be rejected and replaced downstream, producing a worse trip. If a bucket is empty, use a venue from another pool bucket or leave that slot to the verified options you do have; do not fabricate.
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
11. TOP ATTRACTIONS ARE NOT OPTIONAL: Every stop must include at least one iconic landmark, cultural site, or
    must-see local experience — even when the user's interests are narrow (e.g. only hiking selected). User
    interests emphasize and frame; they do not exclude. If the ATTRACTIONS pool has highly-rated venues, use them.
    The itinerary must reflect the DESTINATION, not just the user's hobby.

DESIGN PRINCIPLES (how a great planner thinks):

A. CONTRAST DAYS — vary anchor type day to day. Don't put two big hikes back-to-back. If Day 1 is a major hike,
   Day 2 should be cultural / urban / food-driven. Even for users who selected only one interest (e.g. hiking),
   contrast is mandatory — it makes the trip feel like a journey, not a single-activity training camp.

B. ENERGY CURVE — across a 5-day trip, alternate intensities. Schedule the most demanding day mid-trip,
   not on the arrival day.

C. CUISINE VARIETY — vary cuisines across days. Don't put pizza for dinner two nights in a row.
   Save one standout restaurant for a celebratory night.

D. ANCHOR PLACEMENT — each day has ONE memorable centerpiece. Sunrise hikes / markets → morning slot.
   Museums / galleries → afternoon. Sunset cruises / scenic drives → late afternoon.

E. GEOGRAPHIC COHERENCE — build days outward from the anchor. No criss-crossing the city.

F. HONOR THE PERSONALITY — the vibes and interests define the CHARACTER of the trip, not a whitelist of allowed
   activities. "Luxury + Romantic + Scenic" means curated venues, intimate settings, and visual moments at every
   turn — even the breakfast spot should feel special. "Hiking + Adventure" means you find the most scenic,
   physically engaging version of each day — but you still visit the museum, the waterfall, the old town.
   Let the personality bleed into HOW you plan every day, not into WHAT you omit.
   Also respect the user's own words — if they wrote "we love craft breweries", put a brewery in every stop's
   late-afternoon slot. If they said "no museums", omit them.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT

- tripType: "${isRoute ? "route" : "hub"}"
- stops: one entry per stop above, in the same order, with exactly the right nightCount worth of days.
- For each day produce label ("Day N"), title (vivid theme that captures the day's spirit — e.g. "Fire, Ice & the Golden Circle" not "Day 1 in Reykjavik"), activities (≥ ${MIN_ACTIVITIES_PER_DAY} for non-drive days, 3–4 for drive days).
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

// ─── 2b. Seeded planner — expand a prebuilt itinerary instead of planning fresh ─
//
// Prebuilt itineraries are hand-seeded and thin (~3 activities/day). When a user
// builds one, we run the SAME pipeline as a new trip but seed this planning step
// with the prebuilt's existing activities: keep them as the day's backbone and
// expand each day to the full slot grid using the candidate pools. Validation +
// day-scoped repair downstream still enforce the 7/day + meal/evening rules, and
// reconcileItineraryPlaces snaps every activity (kept or added) to real Places data.

export interface SeedDay {
  label?: string;
  title?: string;
  activities: Array<{ name?: string; category?: string; time?: string; description?: string }>;
}

/**
 * Flatten a prebuilt itinerary Firestore doc into the per-day seed used to expand
 * generation. Walks stops→days→activities and keeps only the fields the seeded
 * planner prompt needs. Returns [] for a missing/malformed doc so callers can fall
 * back to a normal (unseeded) generation.
 */
export function extractSeedDays(doc: Record<string, unknown> | undefined | null): SeedDay[] {
  const stops = Array.isArray(doc?.stops) ? (doc!.stops as Array<Record<string, unknown>>) : [];
  const days: SeedDay[] = [];
  for (const stop of stops) {
    const stopDays = Array.isArray(stop.days) ? (stop.days as Array<Record<string, unknown>>) : [];
    for (const day of stopDays) {
      const activities = (Array.isArray(day.activities) ? (day.activities as Array<Record<string, unknown>>) : [])
        .map((a) => ({
          name: typeof a.name === "string" ? a.name : undefined,
          category: typeof a.category === "string" ? a.category : undefined,
          time: typeof a.time === "string" ? a.time : undefined,
          description: typeof a.description === "string" ? a.description : undefined,
        }));
      days.push({
        label: typeof day.label === "string" ? day.label : undefined,
        title: typeof day.title === "string" ? day.title : undefined,
        activities,
      });
    }
  }
  return days;
}

function formatSeedDays(seedDays: SeedDay[]): string {
  return seedDays
    .map((day, i) => {
      const header = `Day ${i + 1}${day.title ? ` — ${day.title}` : ""}`;
      const acts = (day.activities ?? [])
        .filter((a) => a && typeof a.name === "string" && a.name.trim())
        .map((a) => {
          const cat = a.category ? ` [${a.category}]` : "";
          const time = a.time ? ` (${a.time})` : "";
          return `    • ${a.name}${cat}${time}`;
        });
      return acts.length
        ? `  ${header}:\n${acts.join("\n")}`
        : `  ${header}: (no activities — plan this day fresh)`;
    })
    .join("\n");
}

export async function expandSeededItinerary(
  input: GenerateItineraryRequest,
  pools: StopPool[],
  durationDays: number,
  seedDays: SeedDay[],
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const basePrompt = buildPlannerPrompt(input, pools, durationDays);

  const seededPrompt = `${basePrompt}

═══════════════════════════════════════════════════════════════
SEED ITINERARY — expand this, don't start from scratch

This trip is based on a curated starter itinerary. KEEP its activities as the
backbone of each day, then EXPAND every day to satisfy all the rules above
(≥ ${MIN_ACTIVITIES_PER_DAY} activities, full breakfast/lunch/late-afternoon/dinner/evening slots,
day ends no earlier than 20:30).

SEED ACTIVITIES (by day):
${formatSeedDays(seedDays)}

SEED RULES:
- PRESERVE the seed activities — keep their names; you may refine times/descriptions
  and reorder within a day so the schedule flows, but don't drop them.
- FILL the gaps: add the missing meals, late-afternoon, and evening slots from the
  candidate pools so each day meets the full slot grid and minimum count.
- The trip is ${durationDays} day(s) long. If that's MORE than the seed has, plan the
  extra days fresh from the pools (matching the trip's style). If FEWER, keep the best
  ${durationDays} seed day(s) and drop the rest.
- No repeated venues across the whole trip — seed venues count toward that.
- Output the FULL itinerary (every stop, every day) in the standard format.`;

  logger.info("Trip planner: seeded expand", {
    seedDayCount: seedDays.length,
    durationDays,
    stopCount: pools.length,
    promptTokens: Math.round(seededPrompt.length / 4),
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
    messages: [{ role: "user", content: seededPrompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Seeded expand failed: Claude did not return a structured itinerary");
  }

  return toolBlock.input as Record<string, unknown>;
}

// ─── 3. Day-scoped repair — fix only the days validation flagged ──────────────
//
// An earlier version re-planned the ENTIRE trip in one giant Sonnet call on any
// validation failure, which on multi-stop route trips took 3–4 minutes — long
// enough to blow the function timeout when stacked on the initial generation.
// This repairs a single
// day at a time with a small, focused prompt (≈one regenerateDay-sized call), so a
// 7-day trip with 4 broken days costs four fast calls instead of one slow re-plan,
// and the caller can stop between days when its time budget runs out.

/**
 * Pull the distinct global day numbers (1-based, as they appear in validation
 * messages like "Day 3: missing dinner…") out of a list of issue strings.
 */
export function parseAffectedDayNumbers(issues: string[]): number[] {
  const seen = new Set<number>();
  for (const issue of issues) {
    const m = issue.match(/^Day (\d+):/);
    if (m) seen.add(Number(m[1]));
  }
  return [...seen].sort((a, b) => a - b);
}

const DAY_REPAIR_SCHEMA = {
  type: "object" as const,
  required: ["label", "title", "activities"],
  properties: {
    label: { type: "string" },
    title: { type: "string" },
    isDriveDay: { type: "boolean" },
    activities: {
      type: "array",
      minItems: MIN_ACTIVITIES_PER_DAY,
      items: ACTIVITY_TOOL_INPUT_SCHEMA,
    },
  },
};

/**
 * Repair a single day. Returns the corrected day object (label/title/activities),
 * ready to splice back into the itinerary by global index.
 *
 * @param badDay       the current (broken) day object
 * @param dayNumber    1-based global day number, for the prompt/logging
 * @param dayIssues    validation issues that mention this day
 * @param input        original generation request (for budget/personalization)
 * @param pool         the candidate pool for the stop this day belongs to
 * @param usedVenues   venue names used on OTHER days, to avoid duplicates
 */
export async function repairDay(
  badDay: Record<string, unknown>,
  dayNumber: number,
  dayIssues: string[],
  input: GenerateItineraryRequest,
  pool: StopPool,
  usedVenues: string[],
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are repairing ONE day of a travel itinerary that failed validation.
Fix every listed issue while keeping the parts of the day that already work.

TRIP CONTEXT:
- Destination / stop: ${pool.location}${input.country ? `, ${input.country}` : ""}
- Budget: ${input.budget}
- This is Day ${dayNumber} of the trip.

ISSUES TO FIX (all must be resolved):
${dayIssues.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}

DO NOT reuse any of these venues (already used on other days):
${usedVenues.length ? usedVenues.join(", ") : "(none yet)"}

CANDIDATE POOL for this stop — use ONLY these real venues (or the trip's verified
trails) to fill slots. Never invent, guess, or recall a place name yourself; any
fabricated name is rejected downstream:
${formatStopPool(pool)}

SLOT GRID — every non-drive day must fill these and end no earlier than 20:30:

  08:00–09:30  BREAKFAST   ★ required — pick from BREAKFAST POOL
  09:30–12:00  MORNING     ★ required — major anchor experience
  12:00–14:00  LUNCH       ★ required — pick from FOOD POOL
  14:00–17:00  AFTERNOON   ★ required — museum / gallery / walk / scenic stop
  17:00–18:30  LATE AFTERNOON ★ required — sunset spot, brewery, coffee, dessert
  18:30–20:30  DINNER      ★ required — pick from FOOD POOL (different from lunch)
  20:30–22:30  EVENING     ★ required — pick from NIGHTLIFE POOL; substitute dessert / stroll if sparse

RULES:
1. Minimum ${MIN_ACTIVITIES_PER_DAY} activities. Specific named places only.
2. Realistic timing with transit between activities — no overlaps. Format times as "09:00 AM - 10:30 AM".
3. category: "food" for meals, "adventure" for hikes/trails, "nightlife" for bars, "culture" for museums, "nature" for parks/viewpoints, "attraction" otherwise.
4. transport array describes how to reach the NEXT activity; the last activity = empty array.
5. One major hike per day max; trails cannot start after 15:00.
6. Outdoor activities must start before 15:00.
7. Use real coordinates for venues in ${pool.location}.

CURRENT (BROKEN) DAY:
${JSON.stringify(badDay, null, 2)}

Return the FULL corrected day.`;

  logger.info("Trip planner: day-scoped repair", { dayNumber, issueCount: dayIssues.length });

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: 4096,
    tools: [{
      name: "repair_day",
      description: "Return the corrected full day",
      input_schema: DAY_REPAIR_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "repair_day" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`Day repair failed: Claude did not return a structured day (day ${dayNumber})`);
  }

  return toolBlock.input as Record<string, unknown>;
}
