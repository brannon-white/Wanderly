export interface TasteProfile {
  pace: number;
  foodie: number;
  nature: number;
  nightlife: number;
  hiddenGems: number;
  touristTolerance: number;
  walkingTolerance: number;
  structurePreference: number;
  adventure: number;
  luxury: number;
}

export interface TripDerivedIntent {
  tripMood?: string;
  pace?: string;
  themes?: string[];
  avoid?: string[];
  energyLevel?: string;
  dimensionSignals?: Partial<TasteProfile>;
}

export type OvernightType = 'hotel' | 'camping' | 'airbnb' | 'rv' | 'flexible' | 'unknown';

export type TripType = 'hub' | 'route';

export type TravelPace = 'every_night' | 'every_few_days' | 'few_stops' | 'flexible';

export interface TripIntent {
  destination: string;
  country?: string;
  durationDays: number;
  budget: "budget" | "moderate" | "luxury";
  party: string;
  interests: string[];
  rankedInterests: string[];
  pace: "relaxed" | "balanced" | "packed";
  startDate?: string | null;
  endDate?: string | null;
  tasteProfile?: TasteProfile;
  effectiveTasteProfile?: TasteProfile;
  tripPrompt?: string;
  derivedIntent?: TripDerivedIntent;
  includeActivities?: string[];
  avoidActivities?: string[];
  destinationType: 'city' | 'national_park' | 'region';
  tripType: TripType;
  travelPace?: TravelPace;
}

export type PlaceCategory =
  | "restaurant"
  | "attraction"
  | "museum"
  | "park"
  | "nightlife"
  | "shopping"
  | "wellness"
  | "cafe";

export interface PlaceCandidate {
  placeId: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  rating: number;
  reviewCount: number;
  priceLevel: number;
  types: string[];
  category: PlaceCategory;
  neighborhood?: string;
  editorialSummary?: string;
}

// ─── New architecture types ───────────────────────────────────────────────────

// LLM-designed day experience blueprint — no venues yet
export interface DaySkeleton {
  theme: string;           // "Trails, Waterfalls & Alpine Meadows"
  vibe: string;            // "physical morning, relaxed afternoon in a mountain town"
  anchorIntent: string;    // behavioral: "morning hike to a dramatic waterfall"
  anchorQuery: string;     // exact Places query: "best waterfall hike near Yosemite Valley"
  secondaryIntent: string; // "explore a charming mountain town after the hike"
  mealIntent: string;      // "casual post-hike dinner at a cozy local spot"
  pace: "slow" | "moderate" | "fast";
  isDepartureDay?: boolean;
}

// Per-stop plan — one entry per overnight anchor
export interface StopArchetype {
  location: string;
  region?: string;
  nightCount: number;
  overnightType: OvernightType;
  days: DaySkeleton[];
}

// Full trip structure returned by the archetype LLM call
export interface TripArchetype {
  stops: StopArchetype[];
  tripStyle: "relaxed" | "balanced" | "packed";
  dailyActivityCount: number;
}

// Time-slot grid for a full day. The planner is required to fill every slot
// (with exceptions for relaxed pace and departure days — see dailyPlanning.ts).
export type DaySlot =
  | "breakfast"      // 08:00–09:30
  | "morning"        // 09:30–12:00 (typical anchor slot for AM experiences)
  | "lunch"          // 12:00–14:00
  | "afternoon"      // 14:00–17:00 (alternate anchor slot)
  | "late_afternoon" // 17:00–18:30 (golden hour, scenic, coffee, dessert)
  | "dinner"         // 18:30–20:30
  | "evening";       // 20:30–22:30 (bar, live music, dessert, walk)

// Candidate venues organised by slot. The planner fills each slot from these.
export interface DaySupportingPlaces {
  breakfast: PlaceCandidate[];
  morning: PlaceCandidate[];
  lunch: PlaceCandidate[];
  afternoon: PlaceCandidate[];
  late_afternoon: PlaceCandidate[];
  dinner: PlaceCandidate[];
  evening: PlaceCandidate[];
}

// Full context for one day — anchor + nearby supporting places + trails
export interface DayContext {
  skeleton: DaySkeleton;
  stopLocation: string;
  stopIndex: number;
  dayIndexInStop: number;
  anchor: PlaceCandidate | null;
  supporting: DaySupportingPlaces;
  osmHikes: OsmHike[];
}

// ─── Legacy types (kept for backward-compat with regenerateActivity) ──────────

export interface SearchQuery {
  query: string;
  category: PlaceCategory;
  neighborhood?: string;
}

export interface RankedPlace extends PlaceCandidate {
  score: number;
  interestMatch: number;
  budgetCompatible: boolean;
}

export interface PlaceCluster {
  dayIndex: number;
  stopIndex: number;
  places: RankedPlace[];
  centerLat: number;
  centerLng: number;
  neighborhood?: string;
}

export interface StopStrategy {
  location: string;
  region?: string;
  nightCount: number;
  overnightType: OvernightType;
  dayThemes: string[];
  searchQueries: SearchQuery[];
}

export interface TripStrategy {
  stops: StopStrategy[];
  tripStyle: "relaxed" | "balanced" | "packed";
  dailyActivityCount: number;
  activityBalance: {
    food: number;
    culture: number;
    nature: number;
    nightlife: number;
    shopping: number;
    wellness: number;
  };
}

export interface StopClusters {
  stopIndex: number;
  stop: StopStrategy;
  clusters: PlaceCluster[];
  osmHikes: OsmHike[];
}

export interface OsmHike {
  id: string;
  name: string;
  distanceMiles: number;
  estimatedDurationHours: number;
  difficulty: "easy" | "moderate" | "hard";
  category: "walk" | "moderate_hike" | "major_hike";
  centerLat: number;
  centerLng: number;
}
