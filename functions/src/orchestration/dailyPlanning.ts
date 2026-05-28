import Anthropic from "@anthropic-ai/sdk";
import { MODEL_NAME, ITINERARY_TOOL_INPUT_SCHEMA } from "../constants";
import { type TripIntent, type TripStrategy, type PlaceCluster, type OsmHike, type StopClusters } from "./types";

function formatClusters(clusters: PlaceCluster[], stopLocation: string): string {
  return clusters
    .map((cluster, i) => {
      const placeList = cluster.places
        .map((p) => {
          const summary = p.editorialSummary ? ` | "${p.editorialSummary}"` : "";
          return `  • ${p.name} | ${p.category} | rating: ${p.rating}/5 (${p.reviewCount} reviews) | price: ${"$".repeat(Math.max(1, p.priceLevel))} | lat: ${p.coordinates.lat.toFixed(5)}, lng: ${p.coordinates.lng.toFixed(5)}${summary}`;
        })
        .join("\n");
      return `  Day ${i + 1} — ${cluster.neighborhood ?? stopLocation} (center: ${cluster.centerLat.toFixed(4)}, ${cluster.centerLng.toFixed(4)}):\n${placeList}`;
    })
    .join("\n\n");
}

function buildPersonalizationBlock(intent: TripIntent): string {
  const lines: string[] = [];

  const tp = intent.effectiveTasteProfile ?? intent.tasteProfile;
  const hasPromptIntent = !!(intent.derivedIntent && Object.keys(intent.derivedIntent).length > 0);

  if (!tp && !hasPromptIntent && !intent.includeActivities?.length && !intent.avoidActivities?.length) {
    return "";
  }

  lines.push("\nPERSONALIZATION (three-layer priority stack):");

  if (intent.includeActivities?.length || intent.avoidActivities?.length) {
    lines.push("\n[1] HARD CONSTRAINTS — absolute rules, always override everything else:");
    if (intent.includeActivities?.length) {
      lines.push(`    MUST INCLUDE: ${intent.includeActivities.join(", ")}`);
    }
    if (intent.avoidActivities?.length) {
      lines.push(`    NEVER INCLUDE: ${intent.avoidActivities.join(", ")}`);
    }
  }

  if (intent.tripPrompt || hasPromptIntent) {
    lines.push("\n[2] THIS TRIP'S INTENT — primary flavor driver:");
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
      ? " (blended: 70% trip intent + 30% long-term style)"
      : " (long-term travel style — primary guide)";

    lines.push(`\n[3] TRAVELER'S DEFAULT STYLE${blendNote}:`);
    lines.push(
      `    Pacing: ${tp.pace < 0.35 ? "relaxed — fewer activities, longer dwell times" : tp.pace > 0.65 ? "packed — maximize activities, efficient transitions" : "balanced"}`,
      `    Venue style: ${tp.hiddenGems > 0.6 ? "prefers hidden gems and local spots" : tp.hiddenGems < 0.4 ? "prefers well-known iconic venues" : "mix of popular and local"}`,
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
  return hikes
    .map((h) => `  • ${h.name} | ${h.distanceMiles} mi | ~${h.estimatedDurationHours} hrs | ${h.difficulty} | ${h.category}`)
    .join("\n");
}

function buildStopsSection(
  stopClusters: StopClusters[],
  intent: TripIntent,
  strategy: TripStrategy
): string {
  const isRoute = intent.tripType === 'route';
  const lines: string[] = [];

  for (const sc of stopClusters) {
    const { stop, clusters, osmHikes, stopIndex } = sc;
    const hasClusters = clusters.some((c) => c.places.length > 0);
    const hasOsmHikes = osmHikes.length > 0;

    lines.push(`\n${'═'.repeat(60)}`);
    lines.push(`STOP ${stopIndex + 1}: ${stop.location.toUpperCase()} — ${stop.nightCount} night(s)`);
    lines.push(`Overnight anchor: ${stop.overnightType} near ${stop.location}`);
    if (isRoute && stopIndex < stopClusters.length - 1) {
      const nextStop = stopClusters[stopIndex + 1].stop;
      lines.push(`Next stop: ${nextStop.location} — last day here is a DEPARTURE DAY`);
    }

    if (hasClusters) {
      lines.push(`\nCANDIDATE PLACES FOR ${stop.location.toUpperCase()} (verified real venues):`);
      lines.push(formatClusters(clusters, stop.location));
    }

    if (hasOsmHikes) {
      lines.push(`\nVERIFIED HIKING TRAILS near ${stop.location} (OpenStreetMap data):`);
      lines.push(formatOsmHikes(osmHikes));
      lines.push(`  category key: walk = <2mi | moderate_hike = 2–6mi | major_hike = >6mi`);
      lines.push(`  IMPORTANT: Use these exact trail names. Use the listed durations.`);
    }

    lines.push(`\nDay themes for ${stop.location}: ${stop.dayThemes.join(" | ")}`);
  }

  return lines.join("\n");
}

export async function generateDailyPlans(
  stopClusters: StopClusters[],
  intent: TripIntent,
  strategy: TripStrategy,
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const isRoute = intent.tripType === 'route';
  const personalizationBlock = buildPersonalizationBlock(intent);

  const parkContextBlock = intent.destinationType === 'national_park'
    ? `\nDESTINATION TYPE: NATIONAL PARK
${intent.destination} is a national park. Apply these rules:
- IN-PARK ANCHORS: Named hiking trails, scenic overlooks, visitor centers are the primary morning activities.
- GATEWAY TOWNS for meals: All meals should be in nearby gateway towns. This is expected infrastructure.
- ONE ZONE PER DAY: Commit to a single park zone each day.
- GATEWAY TRANSITION: After the morning trail, transition to the nearest gateway town for lunch and dinner.
- OUT-OF-PARK ACTIVITIES: Activities outside the park boundary are EXPECTED and ALLOWED.\n`
    : "";

  const roadTripBlock = isRoute
    ? `\nROAD TRIP RULES — apply to all departure days:
- DEPARTURE DAY = the last day at each stop except the final stop.
- On departure days: schedule SHORT activities only. No major hikes. No multi-hour commitments.
  Preferred: scenic overlooks, roadside attractions, short scenic stops (≤90 min), coffee/breakfast in town.
- Departure day activities should be geographically along the ROUTE TO THE NEXT STOP — not backtracking.
- Include a "drive time" note in the day title, e.g. "Drive to Bend: Scenic Stops Along Hwy 97".
- Total activities on a departure day: 3–4 max (including breakfast).
- RADIUS CONSTRAINT per non-departure day: Activities must be within 1–1.5 hours of the overnight anchor.
  Do NOT schedule activities that are hours away from where they're sleeping.
- NEVER schedule a major hike on a departure day.\n`
    : "";

  const stopsSection = buildStopsSection(stopClusters, intent, strategy);

  const prompt = `You are an expert travel planner building a detailed, realistic itinerary for a mobile travel app.

TRIP DETAILS:
- Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}
- Duration: ${intent.durationDays} days
- Party: ${intent.party} | Budget: ${intent.budget} | Pace: ${intent.pace}
- Trip type: ${isRoute ? 'ROAD TRIP (multi-stop)' : 'Hub (single location)'}
- Interests: ${intent.rankedInterests.join(", ")}
- Dates: ${intent.startDate ?? "flexible"} to ${intent.endDate ?? "flexible"}
${personalizationBlock}
${parkContextBlock}
${roadTripBlock}
STOPS AND CANDIDATE PLACES:
${stopsSection}

PLANNING RULES (apply to every day at every stop):
1. PREFER candidate places listed above — they are real venues with verified data.
2. Supplement with well-known named landmarks when candidates don't cover a needed slot.
3. Every day MUST include:
   - BREAKFAST (8:00–9:30 AM): café, bakery, brunch spot. NEVER a bar or dinner-only restaurant.
   - LUNCH (12:00–2:00 PM): restaurant or café that serves lunch.
   - DINNER (6:30–9:00 PM): full-service restaurant matching ${intent.budget} budget. Vary cuisine across days.
   Set category to "food" for all meals. Exception: departure days may skip dinner if driving all day.
4. SPECIFIC NAMED PLACES ONLY — no vague entries. NEVER use the destination name as an activity.
   Every activity must name the specific spot, trail, restaurant, or venue.
5. TIME FEASIBILITY: if activity A ends at 10:00 AM and transit takes 20 min, activity B starts at 10:20 AM minimum.
6. REALISTIC DURATIONS: Breakfast 45–60 min | Major attraction 2–3 hrs | Lunch 60–75 min | Mid attraction 1–1.5 hrs | Dinner 75–90 min.
   NATURE ACTIVITIES (waterfalls, lakes, scenic overlooks): minimum 1.5 hrs.
   STATE/NATIONAL PARKS / HIKING TRAILS: minimum 3 hours.
7. DAY STRUCTURE: Start 8:00 AM, end by 11:00 PM. Times format: "09:00 AM - 10:30 AM".
8. TRANSPORT: For each activity specify travel to the NEXT one (mode + realistic time). Last activity of day = empty transport array.
9. No venue repeated across any days (across all stops).
10. Google Maps URLs: https://www.google.com/maps/search/?api=1&query=Place+Name+City
11. OUTDOOR TIMING: Never schedule a trail or nature reserve to START after 3:00 PM.
12. ONE MAJOR HIKE PER DAY — HARD LIMIT.
13. HIKING ACTIVITY FORMAT: name = specific trail name (never generic). category = "adventure".
    Description: include distance, estimated time, difficulty, and one feature sentence.
14. Day titles: catchy and thematic.
15. ACTIVITY VARIETY: User themes and interests define what to EMPHASIZE, not what to exclusively include.
    Each day should feel like a complete travel day — varied activity types, local exploration, and unexpected
    moments. A hiking-focused trip still visits interesting local neighborhoods, cultural stops, or scenic
    viewpoints between hikes. Do NOT fill every non-meal slot with the same activity type day after day.

OUTPUT FORMAT:
- tripType: "${isRoute ? 'route' : 'hub'}"
- stops: one entry per stop listed above, in the same order
- Each stop must have exactly the same number of days as its nightCount
- Each stop's overnightAnchor.location should reflect where they're actually sleeping (the town/area, not just the park)`;

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
