export const PROMPT_VERSION = "v7";
export const MODEL_NAME = "claude-sonnet-4-6";
export const FAST_MODEL_NAME = "claude-haiku-4-5-20251001";

// Minimum activities per day, by trip style. Drive/departure days are exempt
// and validated separately.
export const MIN_ACTIVITIES_BY_STYLE: Record<"relaxed" | "balanced" | "packed", number> = {
  relaxed: 5,
  balanced: 6,
  packed: 7,
};

// JSON Schema for a single activity — shared between generation and partial regeneration
export const ACTIVITY_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  required: ["id", "name", "category", "description", "time", "coordinates", "transport"],
  properties: {
    id: { type: "string" },
    name: { type: "string", description: "Specific named venue, trail, or attraction — never vague" },
    category: {
      type: "string",
      enum: ["food", "attraction", "culture", "nature", "shopping", "art", "science", "adventure", "hotel", "nightlife", "wellness"],
    },
    description: {
      type: "string",
      description: "2–3 sentences. What it is, why it fits this day, one specific detail (signature dish, named view, etc.).",
    },
    time: {
      type: "string",
      description: "Time window in the form '09:00 AM - 11:00 AM'. Durations must be realistic for the activity type.",
    },
    cost: { type: "string" },
    rating: { type: "number" },
    reviewCount: { type: "number" },
    image: { type: "string", description: "Leave as empty string" },
    mapUrl: { type: "string" },
    coordinates: {
      type: "object",
      required: ["latitude", "longitude"],
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
    },
    transport: {
      type: "array",
      description: "How to get from THIS activity to the NEXT one. Empty array for the last activity of the day.",
      items: {
        type: "object",
        required: ["mode", "time"],
        properties: {
          mode: { type: "string", enum: ["walk", "subway", "train", "bus", "taxi", "car", "ferry"] },
          time: { type: "string" },
          label: { type: "string" },
        },
      },
    },
  },
};

const DAY_SCHEMA = {
  type: "object" as const,
  required: ["label", "title", "activities"],
  properties: {
    label: { type: "string", description: "e.g. 'Day 1'" },
    title: { type: "string", description: "Catchy day theme, e.g. 'Temples & Street Food'" },
    isDriveDay: { type: "boolean", description: "true if this is a travel/departure day between stops" },
    activities: {
      type: "array",
      // Hard floor: every non-drive day must have at least 5 activities (breakfast,
      // lunch, dinner, plus 2 non-meal items). The prompt asks for more based on
      // tripStyle, and the validator enforces the style-specific minimum.
      minItems: 5,
      items: ACTIVITY_TOOL_INPUT_SCHEMA,
    },
  },
};

// Full itinerary schema — uses stops[] for both hub and route trips
// Hub trips have one stop; route trips have multiple stops
export const ITINERARY_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  required: ["id", "title", "subtitle", "destinationId", "destinationName", "heroImage", "source", "tripType", "stops"],
  properties: {
    id: { type: "string", description: "Unique ID, e.g. 'itin-oregon-road-trip-001'" },
    title: { type: "string" },
    subtitle: { type: "string" },
    destinationId: { type: "string" },
    destinationName: { type: "string" },
    country: { type: "string" },
    heroImage: { type: "string", description: "Leave as empty string — images are fetched separately" },
    rating: { type: "string", description: "e.g. '4.7'" },
    reviewCount: { type: "number" },
    summary: { type: "array", items: { type: "string" } },
    source: { type: "string", enum: ["ai_generated"] },
    tripType: { type: "string", enum: ["hub", "route"], description: "hub = one location, route = multi-stop road trip" },
    stops: {
      type: "array",
      description: "One entry per overnight anchor. Hub trips have a single stop; route trips have multiple.",
      items: {
        type: "object",
        required: ["stopIndex", "location", "overnightAnchor", "days"],
        properties: {
          stopIndex: { type: "number", description: "0-based index of this stop" },
          location: { type: "string", description: "City/area name, e.g. 'Bend, Oregon'" },
          arrivalDate: { type: "string", description: "ISO date the traveler arrives, e.g. '2026-07-12'" },
          departureDate: { type: "string", description: "ISO date the traveler departs for next stop" },
          overnightAnchor: {
            type: "object",
            required: ["location", "overnightType"],
            properties: {
              location: { type: "string", description: "Where they sleep, e.g. 'Near Bend'" },
              overnightType: {
                type: "string",
                enum: ["hotel", "camping", "airbnb", "rv", "flexible", "unknown"],
              },
            },
          },
          days: {
            type: "array",
            description: "Days spent at this stop. Last day may be a drive/departure day.",
            items: DAY_SCHEMA,
          },
        },
      },
    },
  },
};
