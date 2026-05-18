import { getAuth, getIdToken } from '@react-native-firebase/auth';
import type { FirestoreItineraryDocument, GeneratedItinerary, ItineraryActivity } from '@/types/itinerary';

const BASE_URL = 'https://us-central1-wanderly-dff52.cloudfunctions.net';

async function getBearerToken(): Promise<string> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error('No Firebase auth user is currently signed in.');
  return getIdToken(currentUser, true);
}

async function callEndpoint<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const idToken = await getBearerToken();
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `${endpoint} failed.`);
  }

  return data as T;
}

export interface RegenerateActivityResponse {
  itinerary: FirestoreItineraryDocument;
}

export async function regenerateActivity(params: {
  itineraryId: string;
  dayIndex: number;
  activityIndex: number;
  reason?: string;
}): Promise<RegenerateActivityResponse> {
  return callEndpoint<RegenerateActivityResponse>('regenerateActivityHttp', params);
}

export interface RegenerateDayResponse {
  itinerary: FirestoreItineraryDocument;
}

export async function regenerateDay(params: {
  itineraryId: string;
  dayIndex: number;
  modifications?: {
    budget?: string;
    theme?: string;
    excludePlaces?: string[];
  };
}): Promise<RegenerateDayResponse> {
  return callEndpoint<RegenerateDayResponse>('regenerateDayHttp', params);
}

export interface GetSuggestedReplacementsResponse {
  candidates: ItineraryActivity[];
}

export async function getSuggestedReplacements(params: {
  itineraryId: string;
  dayIndex: number;
  activityIndex: number;
  reason?: string;
  count?: number;
}): Promise<GetSuggestedReplacementsResponse> {
  return callEndpoint<GetSuggestedReplacementsResponse>('getSuggestedReplacementsHttp', params);
}

export interface ConfirmActivityReplacementResponse {
  itinerary: GeneratedItinerary;
}

export async function confirmActivityReplacement(params: {
  itineraryId: string;
  dayIndex: number;
  activityIndex: number;
  candidateActivity: ItineraryActivity;
}): Promise<ConfirmActivityReplacementResponse> {
  return callEndpoint<ConfirmActivityReplacementResponse>('confirmActivityReplacementHttp', params);
}

export interface EditItineraryWithLanguageResponse {
  itinerary: GeneratedItinerary;
}

export async function editItineraryWithLanguage(params: {
  itineraryId: string;
  message: string;
}): Promise<EditItineraryWithLanguageResponse> {
  return callEndpoint<EditItineraryWithLanguageResponse>('editItineraryWithLanguageHttp', params);
}

export interface OptimizeDayResponse {
  itinerary: GeneratedItinerary;
}

export async function optimizeDay(params: {
  itineraryId: string;
  dayIndex: number;
  mode: 'minimize_walking' | 'minimize_cost' | 'relax_mode' | 'maximize_sightseeing' | 'foodie_mode';
}): Promise<OptimizeDayResponse> {
  return callEndpoint<OptimizeDayResponse>('optimizeDayHttp', params);
}
