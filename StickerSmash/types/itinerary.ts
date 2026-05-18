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

export interface GenerateItineraryRequest {
  destinationId: string;
  destinationName: string;
  country?: string;
  party: TripParty;
  startDate: string | null;
  endDate: string | null;
  interests: string[];
  budget: TripBudget;
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
