export const PROMPT_VERSION = "v6";
export const MODEL_NAME = "claude-sonnet-4-6";
export const FAST_MODEL_NAME = "claude-haiku-4-5-20251001";

// JSON Schema for a single activity — shared between generation and partial regeneration
export const ACTIVITY_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  required: ["id", "name", "time", "transport"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    category: {
      type: "string",
      enum: ["food", "attraction", "culture", "nature", "shopping", "art", "science", "adventure", "hotel", "nightlife", "wellness"],
    },
    description: { type: "string" },
    time: { type: "string", description: "e.g. '09:00 AM - 11:00 AM'" },
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
  required: ["label", "activities"],
  properties: {
    label: { type: "string", description: "e.g. 'Day 1'" },
    title: { type: "string", description: "Catchy day theme, e.g. 'Temples & Street Food'" },
    isDriveDay: { type: "boolean", description: "true if this is a travel/departure day between stops" },
    activities: {
      type: "array",
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
