export const PROMPT_VERSION = "v5";
export const MODEL_NAME = "claude-sonnet-4-6";
export const FAST_MODEL_NAME = "claude-haiku-4-5-20251001";

// JSON Schema for Claude tool use — shared between initial generation and partial regeneration
export const ITINERARY_TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  required: ["id", "title", "subtitle", "destinationId", "destinationName", "heroImage", "source", "days"],
  properties: {
    id: { type: "string", description: "Unique ID, e.g. 'itin-tokyo-001'" },
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
    days: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "activities"],
        properties: {
          label: { type: "string", description: "e.g. 'Day 1'" },
          title: { type: "string", description: "Catchy day theme, e.g. 'Temples & Street Food'" },
          activities: {
            type: "array",
            items: {
              type: "object",
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
                cost: { type: "string", description: "Realistic cost in local or USD, e.g. '$15' or 'Free'" },
                rating: { type: "number", description: "0–5 rating based on real-world reputation" },
                reviewCount: { type: "number" },
                image: { type: "string", description: "Leave as empty string" },
                mapUrl: { type: "string", description: "Google Maps URL for this specific place" },
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
                  description: "How to travel from this activity to the next one",
                  items: {
                    type: "object",
                    required: ["mode", "time"],
                    properties: {
                      mode: {
                        type: "string",
                        enum: ["walk", "subway", "train", "bus", "taxi", "car", "ferry"],
                      },
                      time: { type: "string", description: "e.g. '12 min'" },
                      label: { type: "string", description: "e.g. 'Take the Yamanote Line to Shibuya'" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

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
