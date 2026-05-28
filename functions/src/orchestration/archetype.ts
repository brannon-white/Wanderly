import Anthropic from "@anthropic-ai/sdk";
import { FAST_MODEL_NAME } from "../constants";
import { type TripIntent, type TripArchetype, type StopArchetype, type OvernightType } from "./types";

const DAY_SKELETON_SCHEMA = {
  type: "object" as const,
  required: ["theme", "vibe", "anchorIntent", "anchorQuery", "secondaryIntent", "mealIntent", "pace"],
  properties: {
    theme: { type: "string", description: "Catchy, specific day title" },
    vibe: { type: "string", description: "One sentence capturing the emotional tone. E.g. 'physical morning, lazy afternoon in a sun-drenched harbor town'" },
    anchorIntent: {
      type: "string",
      description: "The ONE defining experience. Behavioral — no venue names. E.g. 'morning hike to a dramatic waterfall with alpine views' or 'self-guided walk through a vibrant historic neighborhood'",
    },
    anchorQuery: {
      type: "string",
      description: "Exact Google Places text search query to find the anchor. Must include the location. E.g. 'best waterfall hike near Yosemite Valley' or 'top historic walking district Portland Oregon'",
    },
    secondaryIntent: {
      type: "string",
      description: "One supporting experience that complements the anchor. E.g. 'browse independent bookshops and galleries' or 'afternoon coffee and people-watching in a lively square'",
    },
    mealIntent: {
      type: "string",
      description: "What kind of dining this day calls for. E.g. 'quick trailside lunch, celebratory dinner at a scenic restaurant' or 'deep dive into the local food scene'",
    },
    pace: { type: "string", enum: ["slow", "moderate", "fast"] },
    isDepartureDay: { type: "boolean", description: "True only for the drive-out day at the end of a road trip stop" },
  },
};

const STOP_SCHEMA = {
  type: "object" as const,
  required: ["location", "nightCount", "overnightType", "days"],
  properties: {
    location: { type: "string", description: "Specific city, area, or park name. E.g. 'Yosemite Valley, CA'" },
    region: { type: "string" },
    nightCount: { type: "number" },
    overnightType: { type: "string", enum: ["hotel", "camping", "airbnb", "rv", "flexible", "unknown"] },
    days: { type: "array", items: DAY_SKELETON_SCHEMA },
  },
};

const ARCHETYPE_SCHEMA = {
  type: "object" as const,
  required: ["stops", "tripStyle", "dailyActivityCount"],
  properties: {
    stops: { type: "array", items: STOP_SCHEMA },
    tripStyle: { type: "string", enum: ["relaxed", "balanced", "packed"] },
    dailyActivityCount: { type: "number", description: "Non-meal activities per day: relaxed=2-3, balanced=3-4, packed=4-5" },
  },
};

function buildArchetypePrompt(intent: TripIntent): string {
  const isRoute = intent.tripType === 'route';

  const lines: string[] = [
    `You are a creative travel experience designer. Your job is to design the EXPERIENCE ARC of this trip — not to list activities.`,
    ``,
    `TRIP DETAILS:`,
    `- Destination: ${intent.destination}${intent.country ? `, ${intent.country}` : ""}`,
    `- Duration: ${intent.durationDays} days | Party: ${intent.party} | Budget: ${intent.budget}`,
    `- Trip type: ${isRoute ? 'ROAD TRIP (multi-stop)' : 'Hub (single location)'}`,
    `- Interests: ${intent.rankedInterests.join(", ")} | Pace: ${intent.pace}`,
  ];

  if (intent.tripPrompt) {
    lines.push(`- User's own words: "${intent.tripPrompt}"`);
  }
  if (intent.derivedIntent?.themes?.length) {
    lines.push(`- Trip themes detected: ${intent.derivedIntent.themes.join(", ")}`);
  }
  if (intent.derivedIntent?.tripMood) {
    lines.push(`- Trip mood: ${intent.derivedIntent.tripMood}`);
  }
  if (intent.includeActivities?.length) {
    lines.push(`- Must include: ${intent.includeActivities.join(", ")}`);
  }
  if (intent.avoidActivities?.length) {
    lines.push(`- Hard avoid: ${intent.avoidActivities.join(", ")}`);
  }

  const tp = intent.effectiveTasteProfile ?? intent.tasteProfile;
  if (tp) {
    lines.push(
      ``,
      `TRAVELER PROFILE:`,
      `- Adventure/outdoors: ${tp.adventure > 0.6 ? "loves it" : tp.adventure < 0.4 ? "prefers cultural/indoor" : "enjoys occasionally"}`,
      `- Food focus: ${tp.foodie > 0.6 ? "food is central to the trip" : tp.foodie < 0.4 ? "food as fuel" : "balanced"}`,
      `- Pace: ${tp.pace > 0.65 ? "wants a lot of activities" : tp.pace < 0.35 ? "prefers slow travel with longer dwell times" : "moderate"}`,
      `- Venue style: ${tp.hiddenGems > 0.6 ? "strongly prefers local hidden gems over tourist spots" : tp.hiddenGems < 0.4 ? "prefers iconic well-known venues" : "mix of popular and local"}`,
    );
  }

  lines.push(
    ``,
    `DESIGN PRINCIPLES — follow these exactly:`,
    ``,
    `1. CONTRAST DAYS: Each day must feel different from the others. If Day 1 is a major hike, Day 2 should be`,
    `   cultural/urban/food-focused. Never schedule the same type of anchor two days in a row.`,
    ``,
    `2. USER INTERESTS = EMPHASIS, NOT EXCLUSIVITY: A hiking-focused trip still has days exploring local`,
    `   neighborhoods, visiting markets, or relaxing at a scenic viewpoint. Variety is essential.`,
    ``,
    `3. ANCHOR FIRST: Every day has ONE defining centerpiece. Everything else supports it.`,
    `   The anchor should be the most memorable part of the day.`,
    ``,
    `4. anchorIntent = BEHAVIORAL DESCRIPTION (no venue names):`,
    `   GOOD: "sunrise hike to a dramatic alpine lake" or "self-guided walk through a historic market district"`,
    `   BAD: "visit Half Dome" or "go to Pike Place Market" (names go in anchorQuery, not anchorIntent)`,
    ``,
    `5. anchorQuery = EXACT GOOGLE PLACES SEARCH (include location, be specific):`,
    `   GOOD: "best alpine lake hiking trail near Jackson Hole Wyoming"`,
    `   GOOD: "top historic neighborhood walking tour Seattle"`,
    `   BAD: "things to do" or "hike" (too vague)`,
    ``,
    `6. ENERGY CURVE: Vary pace across the trip. Don't schedule "fast" every day.`,
    `   A typical 5-day trip might be: moderate → fast → slow → fast → moderate`,
  );

  if (intent.destinationType === 'national_park') {
    lines.push(
      ``,
      `NATIONAL PARK RULES:`,
      `- Anchors should be specific park zones, named trail areas, or scenic drives`,
      `- After each morning anchor (trail/zone), the day transitions to the nearest gateway town`,
      `- Gateway town = lunch + afternoon + dinner (this is expected and correct)`,
      `- anchorQuery examples: "best half-day hike Zion Narrows" or "Angels Landing trail Zion National Park"`,
    );
  }

  if (isRoute) {
    const paceDesc: Record<string, string> = {
      every_night: 'move to a new location every night',
      every_few_days: 'stay 2–4 nights per stop',
      few_stops: '2–3 stops total, spending meaningful time at each',
      flexible: 'AI decides pacing based on geography',
    };
    lines.push(
      ``,
      `ROAD TRIP STRUCTURE:`,
      `- Travel pace: ${intent.travelPace ? paceDesc[intent.travelPace] : 'flexible'}`,
      `- Choose 2–4 overnight anchors that form a logical geographic route through ${intent.destination}`,
      `- Order stops so driving flows naturally (no backtracking)`,
      `- Total nightCount across all stops must equal exactly ${intent.durationDays}`,
      `- DEPARTURE DAYS: Last day at each non-final stop → isDepartureDay: true`,
      `  Departure day anchor = something SHORT and scenic along the drive route (overlook, quick walk, coffee stop)`,
      `  anchorQuery for departure days: "scenic roadside stop near [current stop] on route to [next stop]"`,
    );
  } else {
    lines.push(
      ``,
      `HUB STRUCTURE:`,
      `- One stop, nightCount = ${intent.durationDays}, all days in ${intent.destination}`,
      `- anchorQuery must include "${intent.destination}" in every query`,
    );
  }

  return lines.join("\n");
}

export async function generateTripArchetype(intent: TripIntent): Promise<TripArchetype> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: FAST_MODEL_NAME,
    max_tokens: 4096,
    tools: [{
      name: "design_trip_archetype",
      description: "Design the experience arc of a trip: stops, day themes, and anchor experiences",
      input_schema: ARCHETYPE_SCHEMA,
    }],
    tool_choice: { type: "tool", name: "design_trip_archetype" },
    messages: [{ role: "user", content: buildArchetypePrompt(intent) }],
  });

  const tool = response.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") {
    throw new Error("Trip archetype generation failed: no structured output");
  }

  const raw = tool.input as {
    stops?: StopArchetype[];
    tripStyle?: string;
    dailyActivityCount?: number;
  };

  const stops: StopArchetype[] = raw.stops?.length
    ? raw.stops
    : [{
        location: intent.destination,
        nightCount: intent.durationDays,
        overnightType: 'flexible' as OvernightType,
        days: Array.from({ length: intent.durationDays }, (_, i) => ({
          theme: `Day ${i + 1} in ${intent.destination}`,
          vibe: "exploration and discovery",
          anchorIntent: "key local landmark or cultural experience",
          anchorQuery: `top things to do ${intent.destination}`,
          secondaryIntent: "local neighborhood walk",
          mealIntent: "local restaurants for breakfast, lunch, and dinner",
          pace: "moderate" as const,
        })),
      }];

  // Normalize total nights
  const totalNights = stops.reduce((s, st) => s + st.nightCount, 0);
  if (totalNights !== intent.durationDays && stops.length > 0) {
    const diff = intent.durationDays - totalNights;
    stops[stops.length - 1].nightCount = Math.max(1, stops[stops.length - 1].nightCount + diff);
  }

  // Ensure each stop has the right number of day skeletons
  for (const stop of stops) {
    while (stop.days.length < stop.nightCount) {
      const idx = stop.days.length;
      stop.days.push({
        theme: `Exploration Day ${idx + 1}`,
        vibe: "relaxed local discovery",
        anchorIntent: "local attraction or cultural site",
        anchorQuery: `top attractions ${stop.location}`,
        secondaryIntent: "neighborhood walk",
        mealIntent: "local restaurants",
        pace: "moderate",
      });
    }
    stop.days = stop.days.slice(0, stop.nightCount);
  }

  return {
    stops,
    tripStyle: (raw.tripStyle as TripArchetype["tripStyle"]) ?? intent.pace,
    dailyActivityCount: raw.dailyActivityCount ?? 4,
  };
}
