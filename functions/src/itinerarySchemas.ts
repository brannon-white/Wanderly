import { z } from "zod";

const tasteProfileSchema = z.object({
  pace: z.number().min(0).max(1),
  foodie: z.number().min(0).max(1),
  nature: z.number().min(0).max(1),
  nightlife: z.number().min(0).max(1),
  hiddenGems: z.number().min(0).max(1),
  touristTolerance: z.number().min(0).max(1),
  walkingTolerance: z.number().min(0).max(1),
  structurePreference: z.number().min(0).max(1),
  adventure: z.number().min(0).max(1),
  luxury: z.number().min(0).max(1),
}).optional();

const tripDerivedIntentSchema = z.object({
  tripMood: z.string().optional(),
  pace: z.string().optional(),
  themes: z.array(z.string()).optional(),
  avoid: z.array(z.string()).optional(),
  energyLevel: z.string().optional(),
}).optional();

export const generateItineraryRequestSchema = z.object({
  destinationId: z.string().min(1),
  destinationName: z.string().min(1),
  country: z.string().optional(),
  party: z.string().min(1),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  interests: z.array(z.string()).default([]),
  budget: z.string().min(1),
  tasteProfile: tasteProfileSchema,
  tripPrompt: z.string().optional(),
  derivedIntent: tripDerivedIntentSchema,
  tripVibes: z.array(z.string()).optional(),
  includeActivities: z.array(z.string()).optional(),
  avoidActivities: z.array(z.string()).optional(),
  foodPreferences: z.array(z.string()).optional(),
  destinationType: z.enum(['city', 'national_park', 'region']).optional(),
  tripType: z.enum(['hub', 'route']).default('hub'),
  travelPace: z.enum(['every_night', 'every_few_days', 'few_stops', 'flexible']).optional(),
  // When set, the pipeline seeds generation with the activities of this prebuilt
  // itinerary (keep + enrich + expand) instead of planning the trip from scratch.
  seedItineraryId: z.string().optional(),
});

export type TasteProfile = NonNullable<z.infer<typeof tasteProfileSchema>>;
export type TripDerivedIntent = NonNullable<z.infer<typeof tripDerivedIntentSchema>>;

export const itineraryTransportOptionSchema = z.object({
  mode: z.string().min(1),
  time: z.string().min(1),
  label: z.string().optional(),
});

export const itineraryCoordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const itineraryActivitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  time: z.string().min(1),
  cost: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.union([z.number(), z.string()]).optional(),
  image: z.string().default(""),
  mapUrl: z.string().optional(),
  placeId: z.string().optional(),
  coordinates: itineraryCoordinatesSchema.optional(),
  transport: z.array(itineraryTransportOptionSchema).default([]),
  locked: z.boolean().optional(),
  trailDistanceMiles: z.number().optional(),
  trailDifficulty: z.enum(['easy', 'moderate', 'hard']).optional(),
  trailDurationHours: z.number().optional(),
});

// Structured inter-city drive leg, stamped onto drive days for a rich commute card.
export const driveLegSchema = z.object({
  fromLocation: z.string().optional(),
  toLocation: z.string().optional(),
  departTime: z.string().optional(),
  arriveTime: z.string().optional(),
  durationText: z.string().optional(),
  distanceText: z.string().optional(),
  encodedPolyline: z.string().optional(),
  // Id of the activity the drive happens AFTER, so the client can place the card
  // inline at the real city-jump (which may be mid-day, not at the end).
  afterActivityId: z.string().optional(),
});

export const itineraryDaySchema = z.object({
  label: z.string().min(1),
  title: z.string().optional(),
  isDriveDay: z.boolean().optional(),
  drive: driveLegSchema.optional(),
  activities: z.array(itineraryActivitySchema).min(1),
});

export const overnightAnchorSchema = z.object({
  location: z.string().min(1),
  overnightType: z.enum(['hotel', 'camping', 'airbnb', 'rv', 'flexible', 'unknown']).default('unknown'),
  coordinates: itineraryCoordinatesSchema.optional(),
});

export const tripStopSchema = z.object({
  stopIndex: z.number().int().nonnegative(),
  location: z.string().min(1),
  arrivalDate: z.string().nullable().optional(),
  departureDate: z.string().nullable().optional(),
  overnightAnchor: overnightAnchorSchema,
  days: z.array(itineraryDaySchema).min(1),
});

export const generatedItinerarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  destinationId: z.string().min(1),
  destinationName: z.string().min(1),
  country: z.string().optional(),
  heroImage: z.string().default(""),
  mapImage: z.string().optional(),
  rating: z.string().optional(),
  reviewCount: z.number().optional(),
  summary: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  travelerType: z.string().optional(),
  budget: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  source: z.enum(["ai_generated", "prebuilt", "manual", "demo"]),
  tripType: z.enum(["hub", "route"]).default("hub"),
  stops: z.array(tripStopSchema).min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const callableGenerateItineraryResponseSchema = z.object({
  itineraryId: z.string().min(1),
  itinerary: generatedItinerarySchema.extend({
    userId: z.string().optional(),
    createdAt: z.union([
      z.string(),
      z.number(),
      z.object({
        seconds: z.number(),
        nanoseconds: z.number(),
      }),
    ]),
    updatedAt: z.union([
      z.string(),
      z.number(),
      z.object({
        seconds: z.number(),
        nanoseconds: z.number(),
      }),
    ]),
  }),
});

export const regenerateActivityRequestSchema = z.object({
  itineraryId: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
  activityIndex: z.number().int().nonnegative(),
  reason: z.string().optional(),
});

export const regenerateDayRequestSchema = z.object({
  itineraryId: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
  modifications: z
    .object({
      budget: z.string().optional(),
      theme: z.string().optional(),
      excludePlaces: z.array(z.string()).optional(),
    })
    .optional(),
});

export const suggestStopAlternativesRequestSchema = z.object({
  itineraryId: z.string().min(1),
  stopIndex: z.number().int().nonnegative(),
});

export const reworkStopRequestSchema = z.object({
  itineraryId: z.string().min(1),
  stopIndex: z.number().int().positive(), // never the origin (index 0)
  action: z.enum(["remove", "replace"]),
  newLocation: z.string().min(1).optional(),
}).refine((d) => d.action !== "replace" || (d.newLocation && d.newLocation.trim().length > 0), {
  message: "newLocation is required when action is 'replace'",
});

export type GenerateItineraryRequest = z.infer<typeof generateItineraryRequestSchema>;
export type GeneratedItinerary = z.infer<typeof generatedItinerarySchema>;
export type TripStop = z.infer<typeof tripStopSchema>;
export type OvernightAnchor = z.infer<typeof overnightAnchorSchema>;
export type CallableGenerateItineraryResponse = z.infer<typeof callableGenerateItineraryResponseSchema>;
export type RegenerateActivityRequest = z.infer<typeof regenerateActivityRequestSchema>;
export type RegenerateDayRequest = z.infer<typeof regenerateDayRequestSchema>;

export const getSuggestedReplacementsRequestSchema = z.object({
  itineraryId: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
  activityIndex: z.number().int().nonnegative(),
  reason: z.string().optional(),
  count: z.number().int().min(1).max(4).default(3),
});

export const confirmActivityReplacementRequestSchema = z.object({
  itineraryId: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
  activityIndex: z.number().int().nonnegative(),
  candidateActivity: itineraryActivitySchema,
});

export const editItineraryWithLanguageRequestSchema = z.object({
  itineraryId: z.string().min(1),
  message: z.string().min(1).max(500),
  dayIndex: z.number().int().nonnegative().optional(),
  // Pill/chip requests set this so the edit is locked to the viewed day.
  forceScopeToDay: z.boolean().optional(),
});

export const optimizeDayRequestSchema = z.object({
  itineraryId: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
  mode: z.enum(["minimize_walking", "minimize_cost", "relax_mode", "maximize_sightseeing", "foodie_mode"]),
});

export const recalculateDayTransportRequestSchema = z.object({
  itineraryId: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
});

export const reflowDayScheduleRequestSchema = z.object({
  itineraryId: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
});

export type GetSuggestedReplacementsRequest = z.infer<typeof getSuggestedReplacementsRequestSchema>;
export type ConfirmActivityReplacementRequest = z.infer<typeof confirmActivityReplacementRequestSchema>;
export type EditItineraryWithLanguageRequest = z.infer<typeof editItineraryWithLanguageRequestSchema>;
export type OptimizeDayRequest = z.infer<typeof optimizeDayRequestSchema>;

// ─── Helper: flatten all days across stops for global day-index operations ───

export function getAllDays(itinerary: GeneratedItinerary): GeneratedItinerary["stops"][number]["days"] {
  return itinerary.stops.flatMap(s => s.days);
}

export function mapAllDays(
  itinerary: GeneratedItinerary,
  fn: (day: GeneratedItinerary["stops"][number]["days"][number], globalDayIndex: number) => GeneratedItinerary["stops"][number]["days"][number]
): GeneratedItinerary {
  let globalIdx = 0;
  const newStops = itinerary.stops.map(stop => ({
    ...stop,
    days: stop.days.map(day => fn(day, globalIdx++)),
  }));
  return { ...itinerary, stops: newStops };
}

export function updateDayByIndex(
  itinerary: GeneratedItinerary,
  globalDayIndex: number,
  newDay: GeneratedItinerary["stops"][number]["days"][number]
): GeneratedItinerary {
  let cumulative = 0;
  const newStops = itinerary.stops.map(stop => {
    const stopEnd = cumulative + stop.days.length;
    if (globalDayIndex >= cumulative && globalDayIndex < stopEnd) {
      const localIdx = globalDayIndex - cumulative;
      const newDays = stop.days.map((d, i) => (i === localIdx ? newDay : d));
      cumulative = stopEnd;
      return { ...stop, days: newDays };
    }
    cumulative = stopEnd;
    return stop;
  });
  return { ...itinerary, stops: newStops };
}
