import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';
import { getUserProfile } from '@/utils/getUserProfile';
import { useDemo } from '@/context/DemoContext';
import { DEMO_ITINERARIES } from '@/data/demoData';
import type { FirestoreItineraryDocument, ItineraryCardSummary, TasteProfile } from '@/types/itinerary';

const TTL_DAYS = 5;

// Dimension weights — most predictive of trip compatibility
const DIM_WEIGHTS: Record<keyof TasteProfile, number> = {
  pace: 1.5,
  adventure: 1.5,
  nature: 1.5,
  foodie: 1.5,
  nightlife: 1.0,
  hiddenGems: 1.0,
  luxury: 1.0,
  walkingTolerance: 0.5,
  structurePreference: 0.5,
  touristTolerance: 0.5,
};

// Returns a 0–1 score (higher = better match). Only scores dimensions present in tasteProfileTags.
function tasteProfileScore(
  userProfile: TasteProfile,
  tags: Partial<TasteProfile>
): number {
  let weightedSumSq = 0;
  let totalWeight = 0;

  for (const key of Object.keys(tags) as (keyof TasteProfile)[]) {
    const tagVal = tags[key];
    if (tagVal === undefined) continue;
    const w = DIM_WEIGHTS[key] ?? 1.0;
    const diff = userProfile[key] - tagVal;
    weightedSumSq += w * diff * diff;
    totalWeight += w;
  }

  if (totalWeight === 0) return 0.5;
  // Normalize to 0–1: max possible weighted MSE is 1.0 (all diffs = 1)
  const weightedMSE = weightedSumSq / totalWeight;
  return 1 - weightedMSE;
}

function normalizeItinerarySummary(
  itinerary: Partial<FirestoreItineraryDocument> & { id: string; tasteProfileTags?: Partial<TasteProfile> }
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
    tasteProfileTags: itinerary.tasteProfileTags,
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
        const tasteProfile: TasteProfile | undefined = profile?.tasteProfile;

        // Fall back to legacy interest matching for users without a taste profile
        const userInterests = new Set(
          (profile?.activityPreferences ?? []).map((i: string) => i.toLowerCase())
        );

        const cacheKey = `itineraries:v5:${uid}`;
        const cached = await cacheGet<ItineraryCardSummary[]>(cacheKey);
        if (cached && cached.length > 0) {
          setItineraries(cached);
          return;
        }

        const snapshot = await firestore()
          .collection('prebuiltItineraries')
          .get();

        const results = snapshot.docs
          .filter(doc => {
            const d = doc.data();
            return d.isActive === true && Array.isArray(d.days);
          })
          .map(doc => {
            const data = doc.data() as Partial<FirestoreItineraryDocument> & { tasteProfileTags?: Partial<TasteProfile> };
            return normalizeItinerarySummary({ ...data, id: doc.id });
          });

        const scored = results.map(itin => {
          let score: number;
          if (tasteProfile && itin.tasteProfileTags && Object.keys(itin.tasteProfileTags).length > 0) {
            score = tasteProfileScore(tasteProfile, itin.tasteProfileTags);
          } else {
            // Legacy: count matching interests
            score = userInterests.size > 0
              ? (itin.interests ?? []).filter((i: string) => userInterests.has(i.toLowerCase())).length / 10
              : 0;
          }
          return { itin, score };
        });

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
