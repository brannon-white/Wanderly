import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDemo } from '@/context/DemoContext';
import { DEMO_FEATURED_TRIP, DEMO_FEATURED_ITINERARY } from '@/data/demoData';

export function useFeaturedItinerary() {
  const { isDemoMode } = useDemo();
  const [featuredTrip, setFeaturedTrip] = useState<any>(null);
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setFeaturedTrip(DEMO_FEATURED_TRIP);
      setItinerary(DEMO_FEATURED_ITINERARY);
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);

        // Try to load cached data from AsyncStorage
        const cachedStr = await AsyncStorage.getItem('featuredItineraryCache');
        const cached = cachedStr ? JSON.parse(cachedStr) : null;

        const now = new Date();

      if (
        cached &&
        cached.featuredTrip &&
        cached.featuredTrip.to &&
        cached.prebuiltItinerary &&
        cached.prebuiltItinerary.id === cached.featuredTrip.tripId &&
        new Date(cached.featuredTrip.to.seconds * 1000) > now
      ) {
        setFeaturedTrip(cached.featuredTrip);
        setItinerary(cached.prebuiltItinerary);
        setLoading(false);
        console.log('Loaded featured trip from cache');
        return;
      }
        // Query for the first featured trip
        const featuredSnap = await firestore().collection('featuredTrips').limit(1).get();
        if (featuredSnap.empty) throw new Error('No featured trip found');
        const featuredDoc = featuredSnap.docs[0];
        const featuredData = featuredDoc.data();
        setFeaturedTrip(featuredData);
        console.log('Fetched featured trip from db:', featuredData);

        // Get the itinerary using tripId
        const itinerarySnap = await firestore().collection('prebuiltItineraries').doc(featuredData.tripId).get();
        if (!itinerarySnap.exists) throw new Error('Itinerary not found');
        const itineraryData = itinerarySnap.data();
        setItinerary(itineraryData);

        // Cache the result in AsyncStorage
        await AsyncStorage.setItem(
          'featuredItineraryCache',
          JSON.stringify({ featuredTrip: featuredData, prebuiltItinerary: itineraryData })
        );
      } catch (err: any) {
        setError(err.message || 'Error fetching featured trip');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isDemoMode]);

  return { featuredTrip, itinerary, loading, error };
}