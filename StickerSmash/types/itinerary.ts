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

export interface TasteProfile {
  pace: number;                // 0=relaxed, 1=packed
  foodie: number;              // 0=fuel only, 1=food-first
  nature: number;              // 0=urban, 1=nature-first
  nightlife: number;           // 0=early nights, 1=evening scene
  hiddenGems: number;          // 0=famous spots, 1=off the beaten path
  touristTolerance: number;    // 0=avoids crowds, 1=fine with tourists
  walkingTolerance: number;    // 0=minimize walking, 1=happy to walk
  structurePreference: number; // 0=spontaneous, 1=fully planned
  adventure: number;           // 0=cultural/dining, 1=outdoor/physical
  luxury: number;              // 0=budget local, 1=premium comfort
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
  activities: ItineraryActivity[];
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
  days: ItineraryDay[];
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
