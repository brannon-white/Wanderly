import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useDemo } from '@/context/DemoContext';
import { DEMO_DESTINATIONS } from '@/data/demoData';

const CACHE_KEY = 'destinationsCache';
const CACHE_TIMESTAMP_KEY = 'destinationsCacheTimestamp';
const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;

export type DestinationRecord = {
  id: string;
  name: string;
  imageUrl: string;
  country?: string;
  tagline?: string;
  rating?: number | string;
  idealLength?: string;
  bestTimeToVisit?: string;
  flightTime?: string;
  overview?: string;
  highlights?: string[];
  signatureExperiences?: string[];
  travelNotes?: string[];
};

export type DestinationDetail = {
  id: string;
  name: string;
  imageUrl: string;
  country: string;
  tagline: string;
  rating: string;
  idealLength: string;
  bestTimeToVisit: string;
  flightTime: string;
  overview: string;
  highlights: string[];
  signatureExperiences: string[];
  travelNotes: string[];
};

function defaultHighlights(name: string) {
  return [
    `Best neighborhoods to base yourself in ${name}`,
    `Food, design, and cultural moments worth prioritizing`,
    `A flexible mix of iconic sights and slower local experiences`,
  ];
}

export function normalizeDestinationDetail(
  destination?: DestinationRecord | null
): DestinationDetail | null {
  if (!destination) {
    return null;
  }

  return {
    id: destination.id,
    name: destination.name,
    imageUrl: destination.imageUrl,
    country: destination.country ?? 'Destination guide',
    tagline:
      destination.tagline ??
      `A Wanderly-ready snapshot of ${destination.name} with enough context to plan the first version of a trip.`,
    rating:
      typeof destination.rating === 'number'
        ? destination.rating.toFixed(1)
        : destination.rating ?? '4.6',
    idealLength: destination.idealLength ?? '4-6 days',
    bestTimeToVisit: destination.bestTimeToVisit ?? 'Peak shoulder season',
    flightTime: destination.flightTime ?? 'Flight time varies by departure city',
    overview:
      destination.overview ??
      `${destination.name} is a strong fit for travelers who want a balanced trip with standout landmarks, local food, and room for unplanned discoveries.`,
    highlights:
      destination.highlights?.length ? destination.highlights : defaultHighlights(destination.name),
    signatureExperiences:
      destination.signatureExperiences?.length
        ? destination.signatureExperiences
        : ['Curated local neighborhoods', 'A signature food stop', 'One memorable golden-hour moment'],
    travelNotes:
      destination.travelNotes?.length
        ? destination.travelNotes
        : ['Book the first night near your main area', 'Keep one half-day open for spontaneous plans'],
  };
}

export function useDestinations() {
  const { isDemoMode } = useDemo();
  const [destinations, setDestinations] = useState<DestinationRecord[]>([]);
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

export function useDestinationById(id: string) {
  const { destinations, loading, error } = useDestinations();
  const destination = destinations.find(item => item.id === id) ?? null;

  return {
    destination,
    detail: normalizeDestinationDetail(destination),
    loading,
    error,
  };
}
