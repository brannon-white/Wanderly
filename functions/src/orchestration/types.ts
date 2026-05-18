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
}

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
  tripPrompt?: string;
  derivedIntent?: TripDerivedIntent;
  includeActivities?: string[];
  avoidActivities?: string[];
}

export interface TripStrategy {
  primaryNeighborhoods: string[];
  dayThemes: string[];
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
  searchQueries: SearchQuery[];
}

export interface SearchQuery {
  query: string;
  category: PlaceCategory;
  neighborhood?: string;
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
  priceLevel: number; // 0-4
  types: string[];
  category: PlaceCategory;
  neighborhood?: string;
  editorialSummary?: string;
}

export interface RankedPlace extends PlaceCandidate {
  score: number;
  interestMatch: number;
  budgetCompatible: boolean;
}

export interface PlaceCluster {
  dayIndex: number;
  places: RankedPlace[];
  centerLat: number;
  centerLng: number;
  neighborhood?: string;
}
