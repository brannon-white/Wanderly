import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { useMyTrips, type CommittedTrip } from '@/context/MyTripsContext';

// Why this exists:
// "My Trips" is backed by local AsyncStorage and is only populated when the
// synchronous generateItinerary response succeeds (TripReviewScreen → addTrip).
// But generation can run up to 9 minutes server-side; if the client request
// times out or errors first, addTrip never runs — yet the server still finishes,
// writes the itinerary to Firestore, and sends an "itinerary ready" push. Result:
// the finished trip is reachable from the push but missing from My Trips.
//
// This component listens for that push from INSIDE the MyTripsProvider tree and
// reconciles: it fetches the finished itinerary doc and commits it to My Trips
// (idempotently). So the trip lands in My Trips no matter what happened to the
// original request — success, timeout, error, or the app being backgrounded.

async function commitFinishedItinerary(
  itineraryId: string | undefined,
  committedTripId: string | undefined,
  addTrip: (t: CommittedTrip) => void,
  clearPending: () => void,
): Promise<void> {
  const uid = getAuth().currentUser?.uid;
  if (!uid || !itineraryId) return;
  try {
    const snap = await firestore()
      .collection('users').doc(uid)
      .collection('itineraries').doc(itineraryId)
      .get();
    if (!snap.exists) return;
    const d = snap.data() ?? {};
    addTrip({
      id: committedTripId || `committed-${itineraryId}`,
      templateId: itineraryId,
      title: (d.title as string) || (d.destinationName as string) || 'Your trip',
      heroImage: (d.heroImage as string) || '',
      party: (d.travelerType as string) || '',
      startDate: (d.startDate as string) || '',
      endDate: (d.endDate as string) || '',
      origin: 'generated',
      interests: d.interests as string[] | undefined,
      budget: d.budget as string | undefined,
      destinationName: d.destinationName as string | undefined,
      country: d.country as string | undefined,
    });
    // The trip is now real — drop any "generating"/"failed" pending placeholder.
    clearPending();
  } catch {
    // Non-fatal: if Firestore is unreachable the push tap still opens the trip.
  }
}

export default function ItineraryReadyReconciler() {
  const { addTrip, setPendingGeneration } = useMyTrips();

  useEffect(() => {
    const clearPending = () => setPendingGeneration(null);

    // Foreground push.
    const unsubMessage = messaging().onMessage(remoteMessage => {
      commitFinishedItinerary(
        remoteMessage.data?.itineraryId as string | undefined,
        remoteMessage.data?.committedTripId as string | undefined,
        addTrip, clearPending,
      );
    });

    // Background push tapped (app already running).
    const unsubOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      commitFinishedItinerary(
        remoteMessage.data?.itineraryId as string | undefined,
        remoteMessage.data?.committedTripId as string | undefined,
        addTrip, clearPending,
      );
    });

    // Push that cold-started the app.
    messaging().getInitialNotification().then(remoteMessage => {
      if (!remoteMessage) return;
      commitFinishedItinerary(
        remoteMessage.data?.itineraryId as string | undefined,
        remoteMessage.data?.committedTripId as string | undefined,
        addTrip, clearPending,
      );
    });

    return () => {
      unsubMessage();
      unsubOpened();
    };
  }, [addTrip, setPendingGeneration]);

  return null;
}
