import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useDemo } from '@/context/DemoContext';
import { DEMO_DESTINATIONS } from '@/data/demoData';

const CACHE_KEY = 'destinationsCache';
const CACHE_TIMESTAMP_KEY = 'destinationsCacheTimestamp';
const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;

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

        // Check cache and timestamp
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        const cachedTimestampStr = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
        const cachedTimestamp = cachedTimestampStr ? parseInt(cachedTimestampStr, 10) : 0;
        const now = Date.now();

        if (cached && cachedTimestamp && now - cachedTimestamp < ONE_WEEK_MS) {
          setDestinations(JSON.parse(cached));
          setLoading(false);
          return;
        }

        // Fetch from Firestore if not cached or cache expired
        const snapshot = await firestore().collection('destinations').get();
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setDestinations(data);

        // Cache the result and timestamp
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
        await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
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