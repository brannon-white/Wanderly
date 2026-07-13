import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { getAppCheckHeader } from '@/services/appCheck';
import type { FirestoreItineraryDocument, GeneratedItinerary, ItineraryActivity } from '@/types/itinerary';

const BASE_URL = 'https://us-central1-wanderly-dff52.cloudfunctions.net';

async function getBearerToken(): Promise<string> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error('No Firebase auth user is currently signed in.');
  // No force-refresh: the SDK returns its cached ID token (auto-refreshed before
  // expiry), so this resolves locally instead of adding a token-mint round trip
  // to every regen/suggestion/optimize call.
  return getIdToken(currentUser);
}

async function callEndpoint<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const [idToken, appCheckHeader] = await Promise.all([getBearerToken(), getAppCheckHeader()]);
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...appCheckHeader,
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
  dayIndex?: number;
  forceScopeToDay?: boolean;
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

export interface RecalculateDayTransportResponse {
  itinerary: GeneratedItinerary;
}

// Re-enriches only the transport times for one day (used after a drag-reorder).
// Does not regenerate any activities, so it does not consume a regen credit.
export async function recalculateDayTransport(params: {
  itineraryId: string;
  dayIndex: number;
}): Promise<RecalculateDayTransportResponse> {
  return callEndpoint<RecalculateDayTransportResponse>('recalculateDayTransportHttp', params);
}

export interface ReflowDayScheduleResponse {
  itinerary: GeneratedItinerary;
}

// Deterministically fixes a tight-schedule conflict by re-flowing the day's activity
// times (no content change → verified trail data is preserved). Consumes a regen credit.
export async function reflowDaySchedule(params: {
  itineraryId: string;
  dayIndex: number;
}): Promise<ReflowDayScheduleResponse> {
  return callEndpoint<ReflowDayScheduleResponse>('reflowDayScheduleHttp', params);
}

export interface SuggestStopAlternativesResponse {
  alternatives: string[];
}

// Suggests alternative cities for a stop the user wants to swap. No regen credit cost.
export async function suggestStopAlternatives(params: {
  itineraryId: string;
  stopIndex: number;
}): Promise<SuggestStopAlternativesResponse> {
  return callEndpoint<SuggestStopAlternativesResponse>('suggestStopAlternativesHttp', params);
}

export interface ReworkStopResponse {
  itinerary: GeneratedItinerary;
}

// Removes or replaces an entire city stop. Heavy (re-plans a stop) → consumes a credit.
export async function reworkStop(params: {
  itineraryId: string;
  stopIndex: number;
  action: 'remove' | 'replace';
  newLocation?: string;
}): Promise<ReworkStopResponse> {
  return callEndpoint<ReworkStopResponse>('reworkStopHttp', params);
}
