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

    if (!uid) {
      setLoading(false);
      return;
    }

    async function fetchItineraries() {
      try {
        setLoading(true);

        const profile = await getUserProfile(uid).catch(() => null);
        const userInterests = new Set(
          (profile?.activityPreferences ?? []).map((i: string) => i.toLowerCase())
        );

        const cacheKey = `itineraries:v3:${uid}`;
        const cached = await cacheGet<ItineraryCardSummary[]>(cacheKey);
        if (cached && cached.length > 0) {
          setItineraries(cached);
          return;
        }

        const snapshot = await firestore()
          .collection('prebuiltItineraries')
          .get();

        const results = snapshot.docs.map(doc =>
          normalizeItinerarySummary({ ...(doc.data() as Partial<FirestoreItineraryDocument>), id: doc.id })
        );

        // Sort by number of matching interests so most relevant appear first
        const scored = results.map(itin => ({
          itin,
          score: userInterests.size > 0
            ? (itin.interests ?? []).filter((i: string) => userInterests.has(i.toLowerCase())).length
            : 0,
        }));
        scored.sort((a, b) => b.score - a.score);
        const sorted = scored.map(s => s.itin);

        setItineraries(sorted);
        if (sorted.length > 0) {
          await cacheSet(cacheKey, sorted, TTL_DAYS);
        }
      } catch (err: any) {
        setError(err.message ?? 'Failed to load recommended trips');
        console.warn('useMatchingItineraries:', err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchItineraries();
  }, [uid, isDemoMode]);

  return { prebuiltItineraries: itineraries, loading, error };
}
