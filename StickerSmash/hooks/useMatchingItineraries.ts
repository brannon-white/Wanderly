import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';
import { getUserProfile } from '@/utils/getUserProfile';
import { useDemo } from '@/context/DemoContext';
import { DEMO_ITINERARIES } from '@/data/demoData';

const TTL_DAYS = 5;

export function useMatchingItineraries(uid: string) {
  const { isDemoMode } = useDemo();
  const [itineraries, setItineraries] = useState<any[]>([]);
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
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
