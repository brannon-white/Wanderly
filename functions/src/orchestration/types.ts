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

export type OvernightType = 'hotel' | 'camping' | 'airbnb' | 'rv' | 'flexible' | 'unknown';

export type TripType = 'hub' | 'route';

export type TravelPace = 'every_night' | 'every_few_days' | 'few_stops' | 'flexible';

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

// ─── Single-call architecture (v8) ────────────────────────────────────────────
// The new planner receives one of these per stop and decides themes, anchors,
// and activity slotting in a single Sonnet call.

export interface StopPool {
  location: string;
  region?: string;
  nightCount: number;
  stopIndex: number;
  isFirstStop: boolean;
  isLastStop: boolean;
  candidates: StopCandidatePool;
  trails: OsmHike[];
}

export interface StopCandidatePool {
  breakfast: PlaceCandidate[];   // cafés, bakeries, breakfast restaurants
  food: PlaceCandidate[];        // restaurants for lunch + dinner
  nightlife: PlaceCandidate[];   // bars, live music, dessert / late-evening
  attractions: PlaceCandidate[]; // museums, galleries, landmarks, markets
  scenic: PlaceCandidate[];      // parks, viewpoints, golden-hour spots
}

// ─── Legacy types (still consumed by placesRetrieval for partial regeneration) ─

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
