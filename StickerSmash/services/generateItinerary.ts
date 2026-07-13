import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { getAppCheckHeader } from '@/services/appCheck';

import type {
  FirestoreItineraryDocument,
  GenerateItineraryRequest,
} from '@/types/itinerary';

export interface GenerateItineraryResponse {
  itineraryId: string;
  itinerary: FirestoreItineraryDocument;
}

export async function generateItinerary(
  payload: GenerateItineraryRequest
): Promise<GenerateItineraryResponse> {
  const currentUser = getAuth().currentUser;

  if (!currentUser) {
    throw new Error('No Firebase auth user is currently signed in.');
  }

  // Cached ID token (auto-refreshed by the SDK) — forcing a refresh here added a
  // full token-mint round trip before the generation request even started.
  const [idToken, appCheckHeader] = await Promise.all([
    getIdToken(currentUser),
    getAppCheckHeader(),
  ]);
  const response = await fetch(
    'https://us-central1-wanderly-dff52.cloudfunctions.net/generateItineraryHttp',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        ...appCheckHeader,
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'The itinerary request failed.'
    );
  }

  return data as GenerateItineraryResponse;
}
