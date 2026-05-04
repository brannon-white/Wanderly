import auth from '@react-native-firebase/auth';

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
  const currentUser = auth().currentUser;

  if (!currentUser) {
    throw new Error('No Firebase auth user is currently signed in.');
  }

  const idToken = await currentUser.getIdToken(true);
  const response = await fetch(
    'https://us-central1-wanderly-dff52.cloudfunctions.net/generateItineraryHttp',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
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
