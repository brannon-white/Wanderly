import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';
import { getUserProfile } from '@/utils/getUserProfile';
import { useDemo } from '@/context/DemoContext';
import { DEMO_ITINERARIES } from '@/data/demoData';
import type { FirestoreItineraryDocument, ItineraryCardSummary } from '@/types/itinerary';

const TTL_DAYS = 5;

function normalizeItinerarySummary(
  itinerary: Partial<FirestoreItineraryDocument> & { id: string }
): ItineraryCardSummary {
  return {
    id: itinerary.id,
    title: itinerary.title ?? 'Untitled itinerary',
    destinationId: itinerary.destinationId ?? itinerary.id,
    destinationName: itinerary.destinationName ?? itinerary.title ?? 'Destination',
    country: itinerary.country,
    heroImage: itinerary.heroImage ?? 'https://via.placeholder.com/400x200?text=No+Image',
    rating: itinerary.rating,
    reviewCount: itinerary.reviewCount,
    summary: itinerary.summary ?? [],
    interests: itinerary.interests ?? [],
    travelerType: itinerary.travelerType,
    budget: itinerary.budget,
    durationLabel:
      itinerary.startDate && itinerary.endDate
        ? `${itinerary.startDate} - ${itinerary.endDate}`
        : undefined,
    source: itinerary.source ?? 'prebuilt',
  };
}

export function useMatchingItineraries(uid: string) {
  const { isDemoMode } = useDemo();
  const [itineraries, setItineraries] = useState<ItineraryCardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setItineraries(DEMO_ITINERARIES);
      setLoading(false);
      return;
    }

    async function fetchItineraries() {
      try {
        setLoading(true);

        const cacheKey = `itineraries:${uid}`;
        const cached = await cacheGet<any[]>(cacheKey);
        if (cached) {
          setItineraries(cached);
          setLoading(false);
          return;
        }

        const profile = await getUserProfile(uid).catch(() => null);
        const userInterests: string[] = profile?.activityPreferences ?? [];

        if (!userInterests.length) {
          setItineraries([]);
          setLoading(false);
          return;
        }

        const snapshot = await firestore()
          .collection('prebuiltItineraries')
          .where('interests', 'array-contains-any', userInterests.slice(0, 10))
          .get();

        const results = snapshot.docs.map(doc =>
          normalizeItinerarySummary({ id: doc.id, ...(doc.data() as Partial<FirestoreItineraryDocument>) })
        );

        setItineraries(results);
        await cacheSet(cacheKey, results, TTL_DAYS);
      } catch (err: any) {
        setError(err.message || 'Error fetching itineraries');
      } finally {
        setLoading(false);
      }
    }

    if (uid) fetchItineraries();
  }, [uid, isDemoMode]);

  return { prebuiltItineraries: itineraries, loading, error };
}
