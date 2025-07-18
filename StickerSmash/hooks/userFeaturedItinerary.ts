import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

export function useFeaturedItinerary() {
  const [featuredTrip, setFeaturedTrip] = useState<any>(null);
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Query for the first featured trip
        const featuredSnap = await firestore().collection('featuredTrips').limit(1).get();
        if (featuredSnap.empty) throw new Error('No featured trip found');
        const featuredDoc = featuredSnap.docs[0];
        const featuredData = featuredDoc.data();
        setFeaturedTrip(featuredData);

        // Get the itinerary using tripId
        const itinerarySnap = await firestore().collection('prebuiltItineraries').doc(featuredData.tripId).get();
        if (!itinerarySnap.exists) throw new Error('Itinerary not found');
        setItinerary(itinerarySnap.data());
      } catch (err: any) {
        setError(err.message || 'Error fetching featured trip');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { featuredTrip, itinerary, loading, error };
}