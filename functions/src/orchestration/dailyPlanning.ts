import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";
import { MODEL_NAME, ITINERARY_TOOL_INPUT_SCHEMA, MIN_ACTIVITIES_BY_STYLE } from "../constants";
import { type TripIntent, type TripArchetype, type DayContext, type PlaceCandidate, type DaySupportingPlaces } from "./types";

function formatPlace(p: PlaceCandidate): string {
  const summary = p.editorialSummary ? ` — "${p.editorialSummary}"` : "";
  const priceStr = p.priceLevel > 0 ? ` | ${"$".repeat(p.priceLevel)}` : "";
  return `    • ${p.name} | ${p.rating}/5 (${p.reviewCount} reviews)${priceStr} | ${p.address.split(",").slice(0, 2).join(",")}${summary}`;
}

interface SlotDef {
  key: keyof DaySupportingPlaces;
  label: string;
  window: string;
  hint: string;
  required: boolean;        // true = must be filled on every non-drive day
  recommended?: boolean;    // true = strongly suggested, optional for slow pace
  canHoldAnchor: boolean;
}

const SLOTS: SlotDef[] = [
  { key: "breakfast",      label: "BREAKFAST",      window: "08:00–09:30", hint: "café / bakery / breakfast spot — NEVER a bar or dinner-only restaurant", required: true,  canHoldAnchor: false },
  { key: "morning",        label: "MORNING",        window: "09:30–12:00", hint: "morning activity OR the anchor if it's an AM experience (hike, sunrise, market)", required: true,  canHoldAnchor: true  },
  { key: "lunch",          label: "LUNCH",          window: "12:00–14:00", hint: "restaurant or café — 60–75 min", required: true,  canHoldAnchor: false },
  { key: "afternoon",      label: "AFTERNOON",      window: "14:00–17:00", hint: "midday activity OR the anchor (museum, gallery, tour, neighbourhood walk)", required: true,  canHoldAnchor: true  },
  { key: "late_afternoon", label: "LATE AFTERNOON", window: "17:00–18:30", hint: "golden-hour stop — scenic view, brewery / wine bar, coffee, dessert. Anchor OK if it's a sunset experience.", required: false, recommended: true, canHoldAnchor: true },
  { key: "dinner",         label: "DINNER",         window: "18:30–20:30", hint: "full-service restaurant — 75–90 min. Vary cuisine across days.", required: true,  canHoldAnchor: false },
  { key: "evening",        label: "EVENING",        window: "20:30–22:30", hint: "bar / live music / dessert / night walk. Required for balanced & packed pace; optional for relaxed.", required: false, recommended: true, canHoldAnchor: false },
];

function formatDayContext(ctx: DayContext, dayNumber: number, isRoute: boolean): string {
  const lines: string[] = [];
  const { skeleton, anchor, supporting, osmHikes, stopLocation } = ctx;

  lines.push("═".repeat(64));
  lines.push(`DAY ${dayNumber} — ${skeleton.theme.toUpperCase()}${skeleton.isDepartureDay ? " [DEPARTURE DAY]" : ""}`);
  lines.push(`Stop: ${stopLocation}  |  Vibe: ${skeleton.vibe}  |  Pace: ${skeleton.pace}`);

  if (anchor) {
    lines.push("");
    lines.push("ANCHOR (the day's centerpiece — must appear in MORNING, AFTERNOON, or LATE AFTERNOON):");
    lines.push(formatPlace(anchor));
    lines.push(`  Intent: ${skeleton.anchorIntent}`);
  } else {
    lines.push("");
    lines.push(`ANCHOR: [no Places result — use your knowledge of ${stopLocation} for: ${skeleton.anchorIntent}]`);
  }

  if (osmHikes.length > 0 && !skeleton.isDepartureDay) {
    lines.push("");
    lines.push("VERIFIED HIKING TRAILS NEARBY (use exact trail names + durations):");
    for (const h of osmHikes.slice(0, 5)) {
      lines.push(`    • ${h.name} | ${h.distanceMiles} mi | ~${h.estimatedDurationHours} hrs | ${h.difficulty}`);
    }
  }

  if (skeleton.isDepartureDay && isRoute) {
    lines.push("");
    lines.push("DEPARTURE-DAY OVERRIDE: morning only (3–4 short activities). No major hikes. Skip evening slots. Activities should lie along the drive route to the next stop.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("SLOT GRID — fill EVERY required slot. Recommended slots should be filled unless pace=slow.");

  for (const slot of SLOTS) {
    const candidates = supporting[slot.key];
    const tag = slot.required ? "★ REQUIRED" : slot.recommended ? "◆ recommended" : "optional";
    const anchorMarker = slot.canHoldAnchor ? "  [anchor may live here]" : "";
    lines.push("");
    lines.push(`  ${slot.window}  ${slot.label}  (${tag})${anchorMarker}`);
    lines.push(`    Hint: ${slot.hint}`);
    if (candidates.length > 0) {
      lines.push("    Candidates (prefer these — they're verified by Google Places):");
      candidates.forEach((p) => lines.push(formatPlace(p)));
    } else {
      lines.push(`    Candidates: [none returned — invent a real, well-known venue in ${stopLocation}]`);
    }
  }

  lines.push("");
  lines.push(`Meal intent: ${skeleton.mealIntent}`);
  lines.push(`Secondary intent: ${skeleton.secondaryIntent}`);

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

  if (intent.includeActivities?.length) lines.push(`  MUST INCLUDE: ${intent.includeActivities.join(", ")}`);
  if (intent.avoidActivities?.length) lines.push(`  NEVER INCLUDE: ${intent.avoidActivities.join(", ")}`);

  if (intent.tripPrompt) lines.push(`  User's request: "${intent.tripPrompt}"`);
  if (intent.derivedIntent?.tripMood) lines.push(`  Mood: ${intent.derivedIntent.tripMood}`);
  if (intent.derivedIntent?.themes?.length) lines.push(`  Themes: ${intent.derivedIntent.themes.join(", ")}`);

  if (tp) {
    lines.push(
      `  Food: ${tp.foodie > 0.6 ? "food-first — every meal should be special" : tp.foodie < 0.4 ? "food as fuel" : "balanced"}`,
      `  Nightlife: ${tp.nightlife > 0.5 ? "enjoys bars & live music — keep the EVENING slot lively" : "ends evenings early — EVENING slot optional"}`,
      `  Venue style: ${tp.hiddenGems > 0.6 ? "hidden gems over tourist traps" : tp.hiddenGems < 0.4 ? "well-known iconic venues" : "mix"}`,
    );
    if (tp.luxury > 0.6) lines.push("  Comfort: premium venues where possible");
    else if (tp.luxury < 0.3) lines.push("  Comfort: budget-friendly and authentic");
  }

  return lines.join("\n");
}

function buildSystemPrompt(intent: TripIntent, archetype: TripArchetype, dayContextsByStop: DayContext[][]): string {
  const isRoute = intent.tripType === "route";
  const personalizationBlock = buildPersonalizationBlock(intent);
  const minActivities = MIN_ACTIVITIES_BY_STYLE[archetype.tripStyle] ?? 6;

  const dayContextSections: string[] = [];
  let globalDayNum = 1;
  for (const stopContexts of dayContextsByStop) {
    for (const ctx of stopContexts) {
      dayContextSections.push(formatDayContext(ctx, globalDayNum, isRoute));
      globalDayNum++;
    }
  }

  const parkContextBlock = intent.destinationType === "national_park"
    ? `\nNATIONAL PARK RULES:
- In-park anchors are the morning centerpiece.
- ALL meals must be in nearby gateway towns — this is expected, not an error.
- After the morning anchor, transition to the gateway town for lunch, afternoon, late afternoon, dinner, evening.
- The afternoon and evening slots still need to be filled — pick from town candidates.\n`
    : "";

  const roadTripBlock = isRoute
    ? `\nROAD TRIP RULES:
- Departure days (last day at each non-final stop): 3–4 SHORT activities, no major hikes. Activities on the drive route. Skip evening slots.
- Non-departure days: all activities within ~45–60 min of the overnight anchor.\n`
    : "";

  return `You are a senior trip planner assembling a detailed, realistic itinerary for a mobile travel app.
Each day comes pre-designed with an anchor experience, real nearby venues organised by time slot, and verified trail data.
Your job: produce a complete day that flows from morning to night and fills every required slot.

TRIP DETAILS:
- Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}
- Duration: ${intent.durationDays} days
- Party: ${intent.party} | Budget: ${intent.budget}
- Trip type: ${isRoute ? "ROAD TRIP (multi-stop)" : "Hub (single location)"}
- Trip style: ${archetype.tripStyle} → minimum ${minActivities} activities per day (3 meals + the rest from morning/afternoon/late-afternoon/evening)
${personalizationBlock}
${parkContextBlock}
${roadTripBlock}
DAILY CONTEXTS:
${dayContextSections.join("\n\n")}

═══════════════════════════════════════════════════════════════
ASSEMBLY RULES — non-negotiable:

1. SLOT COMPLETENESS — every non-drive day MUST have:
   - BREAKFAST in 08:00–09:30
   - MORNING activity in 09:30–12:00
   - LUNCH in 12:00–14:00
   - AFTERNOON activity in 14:00–17:00
   - DINNER in 18:30–20:30
   Strongly recommended (omit only if pace=slow and the user's nightlife signal is low):
   - LATE AFTERNOON in 17:00–18:30
   - EVENING in 20:30–22:30
   Day MUST end no earlier than 20:30. A day ending at 14:30 or 17:00 is BROKEN.

2. MINIMUM ACTIVITY COUNT — at least ${minActivities} activities on every non-drive day.

3. ANCHOR PLACEMENT — the anchor takes ONE of the morning / afternoon / late-afternoon slots based on its nature.
   - Sunrise hike / market → morning
   - Museum / neighbourhood / large attraction → afternoon
   - Sunset cruise / scenic viewpoint → late afternoon
   The anchor does not replace meals. Meals still happen.

4. PREFER CANDIDATE VENUES — the candidates listed under each slot are real, verified, geographically correct.
   Use them. Invent only when a slot has no candidates and your training-data knowledge is reliable.
   Never use vague names ("local cafe", "downtown restaurant"). Every venue is a specific named place.

5. NO REPEATED VENUES — a venue appearing on Day N cannot reappear on any other day, nor twice on the same day.

6. TIME FEASIBILITY — consecutive activities cannot overlap. If A ends 11:30 and transit is 20 min, B starts ≥ 11:50.
   Time format: "09:00 AM - 10:30 AM" (12-hour, leading zero).

7. REALISTIC DURATIONS:
   - Breakfast 45–60 min | Lunch 60–75 min | Dinner 75–90 min
   - Major attraction / museum 2–3 hrs
   - Nature site (waterfall, lake, viewpoint) 1.5 hrs min
   - State/national park trail 3+ hrs (single major hike per day)
   - Bar / dessert / brewery 60–90 min

8. TRANSPORT — for each activity, the transport array describes how to reach the NEXT activity (mode + realistic time).
   Last activity of the day = empty transport array.

9. OUTDOOR TIMING — no trail or nature reserve may START after 15:00.

10. CATEGORY ASSIGNMENT — set category to "food" for all meals, "adventure" for hikes & trails, "nightlife" for bars & live-music.
    Use real Google Maps URLs of the form: https://www.google.com/maps/search/?api=1&query=Place+Name+City

11. DAY VARIETY — vary cuisine, environment, and energy across days. Don't repeat the same anchor shape two days in a row.

12. GEOGRAPHIC COHERENCE — build the day OUTWARD from the anchor. No criss-crossing the city.

OUTPUT FORMAT:
- tripType: "${isRoute ? "route" : "hub"}"
- stops: one entry per stop, each containing exactly the right number of days.
- overnightAnchor.location: the actual town/area where the traveller is sleeping.
- Drive days set isDriveDay=true; they may have fewer activities and skip evening slots.`;
}

export async function generateDailyPlans(
  dayContextsByStop: DayContext[][],
  intent: TripIntent,
  archetype: TripArchetype,
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildSystemPrompt(intent, archetype, dayContextsByStop);

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

// ─── Repair pass ──────────────────────────────────────────────────────────────
// Called when the validator finds fatal issues. Re-prompts the LLM with the
// bad itinerary, the explicit list of failures, and the original day contexts
// so it can fix only what's broken. One retry max.

export async function repairItinerary(
  badItinerary: Record<string, unknown>,
  issues: string[],
  dayContextsByStop: DayContext[][],
  intent: TripIntent,
  archetype: TripArchetype,
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const basePrompt = buildSystemPrompt(intent, archetype, dayContextsByStop);

  const repairPrompt = `${basePrompt}

═══════════════════════════════════════════════════════════════
REPAIR PASS — you previously produced the itinerary below, but it has problems.
Return a CORRECTED full itinerary that fixes every issue while preserving
the parts that are already correct.

ISSUES TO FIX:
${issues.map((i, idx) => `  ${idx + 1}. ${i}`).join("\n")}

YOUR PREVIOUS OUTPUT (fix it):
${JSON.stringify(badItinerary, null, 2)}

REPAIR RULES:
- Keep days/activities that are already valid. Don't reshuffle just for the sake of it.
- For days flagged as too short / ending too early, ADD activities in the missing slots from the slot grid.
- For missing meals, slot them into the correct window using a candidate venue.
- For duplicate venues, swap the duplicate for another candidate.
- For time overlaps, shift times so consecutive activities don't conflict.
- Output the FULL itinerary (every stop, every day, every activity) — not just the diff.`;

  logger.info("Repair pass: re-prompting with issues", { issueCount: issues.length });

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
