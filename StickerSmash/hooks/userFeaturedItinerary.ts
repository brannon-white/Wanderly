import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';

const CACHE_KEY = 'featured:itinerary:v3';

export function useFeaturedItinerary() {
  const [featuredTrip, setFeaturedTrip] = useState<any>(null);
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const cached = await cacheGet<{ featuredTrip: any; prebuiltItinerary: any }>(CACHE_KEY);
        if (cached) {
          setFeaturedTrip(cached.featuredTrip);
          setItinerary(cached.prebuiltItinerary);
          setLoading(false);
          return;
        }

        const featuredSnap = await firestore().collection('featuredTrips').limit(1).get();
        if (!featuredSnap || featuredSnap.empty) throw new Error('No featured trip found');
        const featuredData = featuredSnap.docs[0].data();
        setFeaturedTrip(featuredData);

        const itinerarySnap = await firestore()
          .collection('prebuiltItineraries')
          .doc(featuredData.tripId)
          .get();
        if (!itinerarySnap.exists) throw new Error('Itinerary not found');
        const itineraryData = itinerarySnap.data();
        setItinerary(itineraryData);

        // Cache until the trip ends; fall back to 1 day if no end date
        const tripEndMs = featuredData.to?.seconds
          ? featuredData.to.seconds * 1000
          : Date.now() + 24 * 60 * 60 * 1000;
        const ttlDays = Math.max(1, Math.ceil((tripEndMs - Date.now()) / (1000 * 60 * 60 * 24)));

        await cacheSet(CACHE_KEY, { featuredTrip: featuredData, prebuiltItinerary: itineraryData }, ttlDays);
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
