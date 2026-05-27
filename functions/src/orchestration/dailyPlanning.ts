import Anthropic from "@anthropic-ai/sdk";
import { MODEL_NAME, ITINERARY_TOOL_INPUT_SCHEMA } from "../constants";
import { type TripIntent, type TripStrategy, type PlaceCluster, type OsmHike } from "./types";

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

  // Use the blended effective profile when available
  const tp = intent.effectiveTasteProfile ?? intent.tasteProfile;
  const hasPromptIntent = !!(intent.derivedIntent && Object.keys(intent.derivedIntent).length > 0);

  if (!tp && !hasPromptIntent && !intent.includeActivities?.length && !intent.avoidActivities?.length) {
    return "";
  }

  lines.push("\nPERSONALIZATION (three-layer priority stack):");

  // ── Layer 1: Hard constraints (always win) ──────────────────────────────
  if (intent.includeActivities?.length || intent.avoidActivities?.length) {
    lines.push("\n[1] HARD CONSTRAINTS — absolute rules, always override everything else:");
    if (intent.includeActivities?.length) {
      lines.push(`    MUST INCLUDE: ${intent.includeActivities.join(", ")}`);
    }
    if (intent.avoidActivities?.length) {
      lines.push(`    NEVER INCLUDE: ${intent.avoidActivities.join(", ")}`);
    }
  }

  // ── Layer 2: Trip prompt — primary driver for this trip ─────────────────
  if (intent.tripPrompt || hasPromptIntent) {
    lines.push("\n[2] THIS TRIP'S INTENT — primary flavor driver (treat as the dominant signal):");
    if (intent.tripPrompt) {
      lines.push(`    User wrote: "${intent.tripPrompt}"`);
    }
    if (intent.derivedIntent) {
      const di = intent.derivedIntent;
      if (di.tripMood) lines.push(`    Mood: ${di.tripMood}`);
      if (di.themes?.length) lines.push(`    Themes: ${di.themes.join(", ")}`);
      if (di.pace) lines.push(`    Desired pace: ${di.pace}`);
      if (di.avoid?.length) lines.push(`    Mentioned avoiding: ${di.avoid.join(", ")}`);
    }
  }

  // ── Layer 3: Effective taste profile (blended) — refinement layer ───────
  if (tp) {
    const isOutdoorHeavy =
      tp.adventure > 0.6 ||
      tp.nature > 0.6 ||
      intent.rankedInterests.some((i) =>
        ["hiking", "nature", "parks", "adventure", "outdoors"].includes(i.toLowerCase())
      ) ||
      intent.includeActivities?.some((a) =>
        ["hiking", "nature", "parks", "trails", "outdoors"].includes(a.toLowerCase())
      );

    const activitiesPerDay = isOutdoorHeavy
      ? Math.round(2 + tp.pace * 2)
      : Math.round(3 + tp.pace * 3);

    const blendNote = hasPromptIntent
      ? " (blended: 70% trip intent above + 30% long-term style — use for tie-breaking and subtle refinement)"
      : " (long-term travel style — primary guide since no trip prompt given)";

    lines.push(`\n[3] TRAVELER'S DEFAULT STYLE${blendNote}:`);
    lines.push(
      `    Pacing: ${tp.pace < 0.35 ? "relaxed — fewer activities, longer dwell times" : tp.pace > 0.65 ? "packed — maximize activities, efficient transitions" : "balanced"}`,
      `    Venue style: ${tp.hiddenGems > 0.6 ? "prefers hidden gems and local spots over tourist traps" : tp.hiddenGems < 0.4 ? "prefers well-known iconic venues" : "mix of popular and local"}`,
      `    Food: ${tp.foodie > 0.6 ? "food-first — every meal should be special" : tp.foodie < 0.4 ? "food as fuel — quick and easy" : "balanced food choices"}`,
      `    Evenings: ${tp.nightlife > 0.5 ? "enjoys bars, live music, nightlife" : "ends evenings early, no nightlife"}`,
      `    Activities: ${tp.adventure > 0.6 ? "outdoor and physical" : tp.adventure < 0.4 ? "cultural, museums, food" : "mixed"}`,
      `    Suggested activities/day: ${activitiesPerDay}${isOutdoorHeavy ? " (outdoor trip — parks are half-day anchors)" : ""}`,
    );
    if (tp.walkingTolerance < 0.35) {
      lines.push(`    Walking: minimize — cluster geographically, use transport`);
    }
    if (tp.luxury > 0.6) {
      lines.push(`    Comfort: premium — upscale venues where possible`);
    } else if (tp.luxury < 0.3) {
      lines.push(`    Comfort: budget-friendly — local and authentic over polished`);
    }
  }

  return lines.join("\n");
}

function formatOsmHikes(hikes: OsmHike[]): string {
  const lines = hikes.map(
    (h) =>
      `  • ${h.name} | ${h.distanceMiles} mi | ~${h.estimatedDurationHours} hrs | ${h.difficulty} | ${h.category}`
  );
  return lines.join("\n");
}

export async function generateDailyPlans(
  clusters: PlaceCluster[],
  intent: TripIntent,
  strategy: TripStrategy,
  osmHikes: OsmHike[] = []
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const candidateList = formatClusters(clusters);
  const hasClusters = clusters.some((c) => c.places.length > 0);
  const personalizationBlock = buildPersonalizationBlock(intent);
  const hasOsmHikes = osmHikes.length > 0;
  const osmHikeBlock = hasOsmHikes
    ? `\nVERIFIED HIKING TRAILS (OpenStreetMap data — real trail distances computed from GPS geometry):
${formatOsmHikes(osmHikes)}

  category key: walk = <2mi easy stroll | moderate_hike = 2–6mi half-day | major_hike = >6mi full commitment
  IMPORTANT: Use the specific trail names above when scheduling hikes — never just "hiking" or the park name.
  Use the listed durations exactly. Do not compress them.\n`
    : "";

  const parkContextBlock = intent.destinationType === 'national_park'
    ? `\nDESTINATION TYPE: NATIONAL PARK
${intent.destination} is a national park. Apply these planning rules in addition to the standard rules below:
- IN-PARK ANCHORS: Named hiking trails, scenic overlooks, visitor centers, and scenic drives are the primary activity anchors for each day. Schedule them in the MORNING.
- GATEWAY TOWNS for meals: All meals (breakfast, lunch, dinner) and evening activities should be in nearby gateway towns (${strategy.primaryNeighborhoods.join(', ')}). Gateway town dining is NOT "leaving the destination" — it is the normal and expected infrastructure for a park trip.
- ONE ZONE PER DAY: Commit to a single park zone each day (e.g. Zion Canyon one day, Kolob Canyons another). Do not try to cover the whole park in a single day — parks span dozens of miles.
- GATEWAY TRANSITION: After the morning/midday trail, transition to the nearest gateway town for lunch and dinner. Restaurants and cafes in gateway towns are 5–20 minutes from most park trailheads.
- OUT-OF-PARK ACTIVITIES: Activities outside the park boundary are EXPECTED and ALLOWED as long as they are geographically close to that day's park zone. Do not treat gateway town restaurants as "off-topic".\n`
    : "";

  const prompt = `You are an expert travel planner building a detailed, realistic itinerary for a mobile travel app.

TRIP DETAILS:
- Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}
- Duration: ${intent.durationDays} days
- Party: ${intent.party} | Budget: ${intent.budget} | Pace: ${intent.pace}
- Interests: ${intent.rankedInterests.join(", ")}
- Dates: ${intent.startDate ?? "flexible"} to ${intent.endDate ?? "flexible"}
${personalizationBlock}
${parkContextBlock}
${hasClusters ? `CANDIDATE PLACES FROM GOOGLE PLACES (verified real venues with accurate coordinates):
${candidateList}
` : ""}${osmHikeBlock}PLANNING RULES:
1. ${hasClusters ? "PREFER the candidate places above — they are real venues with verified data. Their coordinates are accurate. Use them wherever they fit." : "Use only established, well-known venues with a strong local reputation. Prefer places that have been operating for years."}
2. ${hasClusters ? "You may supplement with well-known named landmarks (museums, monuments, iconic sites) when candidates don't cover a needed activity slot." : "Supplement with well-known named landmarks when needed."}
3. Every day MUST include:
   - BREAKFAST (8:00–9:30 AM): café, bakery, brunch spot, or hotel restaurant. NEVER a bar, dessert shop, or dinner-only restaurant.
   - LUNCH (12:00–2:00 PM): restaurant, café, or food market that serves lunch.
   - DINNER (6:30–9:00 PM): full-service restaurant matching ${intent.budget} budget. Vary cuisine across days.
   Set category to "food" for all meals.
4. SPECIFIC NAMED PLACES ONLY — no vague entries. NEVER use just the destination or park name as an activity (e.g., "Zion National Park", "Grand Canyon", "Yellowstone" are NOT valid activities — they are the destination, not something to do within it). Every activity must name the specific spot, trail, restaurant, or venue.
5. TIME FEASIBILITY: if activity A ends at 10:00 AM and transit takes 20 min, activity B starts at 10:20 AM minimum.
6. REALISTIC DURATIONS: Breakfast 45–60 min | Major attraction 2–3 hrs | Lunch 60–75 min | Mid attraction 1–1.5 hrs | Dinner 75–90 min | Evening 1–2 hrs.
   NATURE ACTIVITIES (waterfalls, lakes, scenic overlooks, botanical gardens, beaches, gorges, natural areas): minimum 1.5 hrs, typically 2 hrs. Never schedule a nature stop for less than 1.5 hours — reaching it, exploring, and leaving takes time.
   STATE PARKS / NATIONAL PARKS / HIKING TRAILS / NATURE RESERVES: minimum 3 hours, typically 3–5 hrs. These are half-day anchors, never quick stops.
7. DAY STRUCTURE: Start 8:00 AM, end by 11:00 PM. Times format: "09:00 AM - 10:30 AM".
8. TRANSPORT: For each activity specify travel to the NEXT one (mode + realistic time). Last activity of day = empty transport array.
9. No venue repeated across days.
10. Google Maps URLs: https://www.google.com/maps/search/?api=1&query=Place+Name+City
11. OUTDOOR TIMING: Never schedule a state park, national park, hiking trail, or nature reserve to START after 3:00 PM. Schedule them in the morning (ideally 8–10 AM) or early afternoon at the latest. Trails close at dusk and late arrivals are unsafe and unrealistic.
12. ONE MAJOR HIKE PER DAY — HARD LIMIT: Never schedule more than one major_hike (>6 miles or >4 hours) in a single day. This is non-negotiable. After the major hike, transition to a nearby town for lunch, a scenic viewpoint requiring no hiking, or a casual dinner — never stack another trail on the same day.
13. TRAIL TIME ESTIMATION: ${hasOsmHikes ? "Use the durations from the VERIFIED HIKING TRAILS section above when scheduling those trails. For any trail not listed there:" : "When scheduling a hiking trail:"} a moderate 5-mile trail takes 3–4 hours; a strenuous 8+ mile trail takes 5–7 hours. Always add 30–45 minutes for parking, gear prep, and rest stops. Never schedule a hiking trail for less than 3 hours.
14. TRAILHEAD DRIVE TIME: State and national parks in the same region are often 30–90 minutes apart by car. If two outdoor destinations appear in the same day cluster, check whether driving between them is realistic given the time remaining after the first activity. When in doubt, keep only the better-rated one and fill the rest of the day with a nearby town or viewpoint that requires no hiking.
15. DAILY HIKING CAP: Total hiking time across all trails in a single day must not exceed 6 hours. Budget accordingly — one major_hike already consumes most of that cap.
16. HIKING ACTIVITY FORMAT — always follow this for any hiking, trail, or outdoor walk activity:
    - name: the specific trail name — NEVER a generic name. REJECT THESE: "Hiking", "Morning Hike", "Afternoon Trek", "Zion National Park", "Explore Zion", "Trail Walk". USE THESE: "Angels Landing Trail", "The Narrows", "Emerald Pools Loop", "Hidden Canyon Trail", "Canyon Overlook Trail", "Observation Point Trail"
    - category: "adventure" (always — never "nature" for a named hiking trail)
    - description: include the trail distance (e.g. "5.4-mile out-and-back"), estimated hiking time, difficulty, and one sentence on what makes it special (views, features, etc.)
    - time: block realistic time — short trail 2–3 hrs, moderate trail 3–5 hrs, long trail 5–7 hrs
    - cost: "Free" for most national park trails (entry fee already paid) or note permit cost if applicable
    - IMPORTANT: If VERIFIED HIKING TRAILS are listed above, you MUST pick from that list. Use the exact trail name as given — do not abbreviate or rename it.
17. Day titles: catchy and thematic (e.g. "Temples & Street Food", "Art, Markets & Rooftops").

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
