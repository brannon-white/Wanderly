import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';
import { useEffect, useState } from 'react';
import { useDemo } from '@/context/DemoContext';
import { DEMO_DESTINATIONS } from '@/data/demoData';

const CACHE_KEY = 'destinations';
const TTL_DAYS = 7;

export function useDestinations() {
  const { isDemoMode } = useDemo();
  const [destinations, setDestinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setDestinations(DEMO_DESTINATIONS);
      setLoading(false);
      return;
    }

    async function fetchDestinations() {
      try {
        setLoading(true);

        const cached = await cacheGet<any[]>(CACHE_KEY);
        if (cached) {
          setDestinations(cached);
          setLoading(false);
          return;
        }

        const snapshot = await firestore().collection('destinations').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDestinations(data);
        await cacheSet(CACHE_KEY, data, TTL_DAYS);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch destinations');
      } finally {
        setLoading(false);
      }
    }
    fetchDestinations();
  }, [isDemoMode]);

  return { destinations, loading, error };
}
