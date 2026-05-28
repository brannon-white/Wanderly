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
  // Dimension signals extracted from the prompt — only populated for dimensions the prompt explicitly addresses
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
  // Blended profile: 70% prompt signals + 30% taste profile for conflicting dimensions.
  effectiveTasteProfile?: TasteProfile;
  tripPrompt?: string;
  derivedIntent?: TripDerivedIntent;
  includeActivities?: string[];
  avoidActivities?: string[];
  destinationType: 'city' | 'national_park';
  tripType: TripType;
  travelPace?: TravelPace;
}

export interface SearchQuery {
  query: string;
  category: PlaceCategory;
  neighborhood?: string;
}

// Per-stop planning strategy — one entry per overnight anchor
export interface StopStrategy {
  location: string;             // e.g. "Bend, Oregon"
  region?: string;              // e.g. "Central Oregon"
  nightCount: number;           // nights sleeping here
  overnightType: OvernightType;
  dayThemes: string[];          // catchy theme per day (length === nightCount for hub, +1 for departure day on route)
  searchQueries: SearchQuery[]; // place searches scoped to this stop's location
}

export interface TripStrategy {
  stops: StopStrategy[];        // replaces primaryNeighborhoods / dayThemes / searchQueries
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
  dayIndex: number;       // day index within this stop (0-based)
  stopIndex: number;      // which stop this cluster belongs to
  places: RankedPlace[];
  centerLat: number;
  centerLng: number;
  neighborhood?: string;  // day theme
}

// Per-stop clusters + trails — one entry per stop in TripStrategy.stops
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
