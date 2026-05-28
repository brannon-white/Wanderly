export type TripParty =
  | 'solo'
  | 'couple'
  | 'family'
  | 'friends'
  | 'group'
  | string;

export type TripBudget =
  | 'budget'
  | 'moderate'
  | 'luxury'
  | string;

export type TransportMode =
  | 'walk'
  | 'car'
  | 'bicycle'
  | 'bus'
  | 'train'
  | 'taxi'
  | string;

export type ActivityCategory =
  | 'food'
  | 'landmark'
  | 'hotel'
  | 'nature'
  | 'culture'
  | 'adventure'
  | 'shopping'
  | 'nightlife'
  | 'wellness'
  | string;

export type ItinerarySource =
  | 'ai_generated'
  | 'prebuilt'
  | 'manual'
  | 'demo';

export type OvernightType = 'hotel' | 'camping' | 'airbnb' | 'rv' | 'flexible' | 'unknown';

export type TripType = 'hub' | 'route';

export type TravelPace = 'every_night' | 'every_few_days' | 'few_stops' | 'flexible';

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

export interface GenerateItineraryRequest {
  destinationId: string;
  destinationName: string;
  country?: string;
  party: TripParty;
  startDate: string | null;
  endDate: string | null;
  interests: string[];
  budget: TripBudget;
  tasteProfile?: TasteProfile;
  tripPrompt?: string;
  derivedIntent?: TripDerivedIntent;
  includeActivities?: string[];
  avoidActivities?: string[];
  destinationType?: 'city' | 'national_park' | 'region';
  tripType?: TripType;
  travelPace?: TravelPace;
}

export interface ItineraryCoordinates {
  latitude: number;
  longitude: number;
}

export interface ItineraryTransportOption {
  mode: TransportMode;
  time: string;
  label?: string;
}

export interface ItineraryActivity {
  id: string;
  name: string;
  category?: ActivityCategory;
  description?: string;
  time: string;
  cost?: string;
  rating?: number;
  reviewCount?: number | string;
  image: string;
  mapUrl?: string;
  coordinates?: ItineraryCoordinates;
  transport: ItineraryTransportOption[];
  locked?: boolean;
  trailDistanceMiles?: number;
  trailDifficulty?: 'easy' | 'moderate' | 'hard';
  trailDurationHours?: number;
}

export interface ItineraryDay {
  label: string;
  title?: string;
  isDriveDay?: boolean;
  activities: ItineraryActivity[];
}

export interface OvernightAnchor {
  location: string;
  overnightType: OvernightType;
  coordinates?: ItineraryCoordinates;
}

export interface TripStop {
  stopIndex: number;
  location: string;
  arrivalDate?: string | null;
  departureDate?: string | null;
  overnightAnchor: OvernightAnchor;
  days: ItineraryDay[];
}

export interface GeneratedItinerary {
  id: string;
  title: string;
  subtitle: string;
  destinationId: string;
  destinationName: string;
  country?: string;
  heroImage: string;
  mapImage?: string;
  rating?: string;
  reviewCount?: number;
  summary?: string[];
  interests?: string[];
  travelerType?: string;
  budget?: TripBudget;
  startDate?: string | null;
  endDate?: string | null;
  source: ItinerarySource;
  tripType?: TripType;
  // New primary field — all new itineraries use stops[]
  stops?: TripStop[];
  // Legacy field — present in old Firestore docs generated before the migration
  days?: ItineraryDay[];
  createdAt?: string;
  updatedAt?: string;
  model?: string;
  promptVersion?: string;
  isActive?: boolean;
}

export interface ItineraryCardSummary {
  id: string;
  title: string;
  destinationId: string;
  destinationName: string;
  country?: string;
  heroImage: string;
  rating?: string;
  reviewCount?: number;
  summary?: string[];
  interests?: string[];
  travelerType?: string;
  budget?: TripBudget;
  durationLabel?: string;
  source: ItinerarySource;
  tasteProfileTags?: Partial<TasteProfile>;
}

export type FirestoreTimestampValue =
  | string
  | number
  | {
      seconds: number;
      nanoseconds: number;
    };

export interface FirestoreItineraryDocument extends GeneratedItinerary {
  userId?: string;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}
