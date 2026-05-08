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
  const [itineraries, setItineraries] = useState<ItineraryCardSummary[]>(DEMO_ITINERARIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setItineraries(DEMO_ITINERARIES);
      return;
    }

    if (!uid) {
      setItineraries(DEMO_ITINERARIES);
      return;
    }

    async function fetchItineraries() {
      try {
        setLoading(true);

        const cacheKey = `itineraries:v2:${uid}`;
        const cached = await cacheGet<ItineraryCardSummary[]>(cacheKey);
        if (cached && cached.length > 0) {
          setItineraries(cached);
          return;
        }

        const profile = await getUserProfile(uid).catch(() => null);
        const userInterests: string[] = profile?.activityPreferences ?? [];

        let snapshot;
        if (userInterests.length) {
          snapshot = await firestore()
            .collection('prebuiltItineraries')
            .where('interests', 'array-contains-any', userInterests.slice(0, 10))
            .get();
        } else {
          snapshot = await firestore()
            .collection('prebuiltItineraries')
            .limit(10)
            .get();
        }

        const results = snapshot.docs.map(doc =>
          normalizeItinerarySummary({ id: doc.id, ...(doc.data() as Partial<FirestoreItineraryDocument>) })
        );

        if (results.length > 0) {
          setItineraries(results);
          await cacheSet(cacheKey, results, TTL_DAYS);
        }
        // If results empty, DEMO_ITINERARIES from initial state stay visible
      } catch (err: any) {
        // Firestore failure — DEMO_ITINERARIES from initial state stay visible
        console.warn('useMatchingItineraries:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchItineraries();
  }, [uid, isDemoMode]);

  return { prebuiltItineraries: itineraries, loading, error };
}
