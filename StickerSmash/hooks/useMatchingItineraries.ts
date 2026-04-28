import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDemo } from '@/context/DemoContext';
import { DEMO_ITINERARIES } from '@/data/demoData';

const CACHE_DURATION = 1000 * 60 * 60 * 24 * 5; // 5 days in ms

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
        // Get cached user profile
        const cachedProfile = await AsyncStorage.getItem(`userProfile_${uid}`);
        if (!cachedProfile) throw new Error('No cached user profile found');
        const profile = JSON.parse(cachedProfile);
        const userInterests = profile.activityPreferences || [];
        console.log('User interests:', userInterests);
        if (!userInterests.length) {
          setItineraries([]);
          setLoading(false);
          return;
        }

        // Cache keys
        const cacheKey = `itineraries_${uid}_${userInterests.join('_')}`;
        const cacheTimeKey = `${cacheKey}_timestamp`;

        // Check cache
        const cachedItins = await AsyncStorage.getItem(cacheKey);
        const cachedTime = await AsyncStorage.getItem(cacheTimeKey);
        const now = Date.now();

        if (
          cachedItins &&
          cachedTime &&
          now - Number(cachedTime) < CACHE_DURATION
        ) {
          console.log('Loaded itineraries from cache');
          setItineraries(JSON.parse(cachedItins));
          setLoading(false);
          return;
        }

        // Fetch from Firestore
        const query = firestore()
          .collection('prebuiltItineraries')
          .where('interests', 'array-contains-any', userInterests.slice(0, 10));
        const snapshot = await query.get();
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setItineraries(results);

        // Cache results and timestamp
        await AsyncStorage.setItem(cacheKey, JSON.stringify(results));
        await AsyncStorage.setItem(cacheTimeKey, now.toString());
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