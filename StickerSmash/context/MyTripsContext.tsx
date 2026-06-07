import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from '@react-native-firebase/auth';
import { useDemo } from './DemoContext';

const STORAGE_KEY = () => {
  const uid = getAuth().currentUser?.uid;
  return uid ? `committedTrips:${uid}` : 'committedTrips:guest';
};

export interface CommittedTrip {
  id: string;
  templateId: string;
  title: string;
  heroImage: string;
  party: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  origin: 'prebuilt' | 'generated';
  interests?: string[];
  budget?: string;
  destinationName?: string;
  country?: string;
  bookedItems?: Record<string, boolean>; // activityId → booked
}

export interface PendingGeneration {
  destName: string;
  heroImage?: string;
  party: string;
  startDate: string;
  endDate: string;
  // 'generating' (default) shows the spinner card; 'failed' shows a dismissible
  // error card so a generation that errored after the user left the review screen
  // doesn't just silently vanish.
  status?: 'generating' | 'failed';
  errorMessage?: string;
}

interface MyTripsContextType {
  trips: CommittedTrip[];
  addTrip: (trip: CommittedTrip) => void;
  removeTrip: (id: string) => void;
  updateTrip: (id: string, updates: Partial<CommittedTrip>) => void;
  markActivityBooked: (tripId: string, activityId: string) => void;
  pendingGeneration: PendingGeneration | null;
  setPendingGeneration: (gen: PendingGeneration | null) => void;
}

const MyTripsContext = createContext<MyTripsContextType>({
  trips: [],
  addTrip: () => {},
  removeTrip: () => {},
  updateTrip: () => {},
  markActivityBooked: () => {},
  pendingGeneration: null,
  setPendingGeneration: () => {},
});

// Future dates for the active demo trip
const ACTIVE_START = new Date();
ACTIVE_START.setDate(ACTIVE_START.getDate() + 30);
const ACTIVE_END = new Date(ACTIVE_START);
ACTIVE_END.setDate(ACTIVE_END.getDate() + 4);

// Past dates for the passed demo trip
const PAST_END = new Date();
PAST_END.setDate(PAST_END.getDate() - 10);
const PAST_START = new Date(PAST_END);
PAST_START.setDate(PAST_START.getDate() - 3);

const DEMO_TRIPS: CommittedTrip[] = [
  {
    id: 'committed-demo-1',
    templateId: 'demo-itin-1',
    title: 'Tokyo, Japan 🇯🇵',
    heroImage: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
    party: 'A Couple',
    startDate: ACTIVE_START.toISOString(),
    endDate: ACTIVE_END.toISOString(),
    origin: 'generated',
  },
  {
    id: 'committed-demo-2',
    templateId: 'demo-itin-1',
    title: 'Weekend in Kyoto',
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    party: 'Friends',
    startDate: PAST_START.toISOString(),
    endDate: PAST_END.toISOString(),
    origin: 'prebuilt',
  },
];

export function MyTripsProvider({ children }: { children: React.ReactNode }) {
  const { isDemoMode } = useDemo();
  const [trips, setTrips] = useState<CommittedTrip[]>(isDemoMode ? DEMO_TRIPS : []);
  const [loaded, setLoaded] = useState(isDemoMode);
  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null);

  // Load persisted trips on mount (non-demo only)
  useEffect(() => {
    if (isDemoMode) return;
    AsyncStorage.getItem(STORAGE_KEY()).then(raw => {
      if (raw) {
        try {
          const saved: CommittedTrip[] = JSON.parse(raw);
          if (Array.isArray(saved)) setTrips(saved);
        } catch {}
      }
      setLoaded(true);
    });
  }, [isDemoMode]);

  // Persist whenever trips change (non-demo, after initial load)
  useEffect(() => {
    if (isDemoMode || !loaded) return;
    AsyncStorage.setItem(STORAGE_KEY(), JSON.stringify(trips)).catch(() => {});
  }, [trips, isDemoMode, loaded]);

  const addTrip = (trip: CommittedTrip) => {
    setTrips(prev => [trip, ...prev]);
  };

  const removeTrip = (id: string) => {
    setTrips(prev => prev.filter(t => t.id !== id));
  };

  const updateTrip = (id: string, updates: Partial<CommittedTrip>) => {
    setTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const markActivityBooked = (tripId: string, activityId: string) => {
    setTrips(prev => prev.map(t => {
      if (t.id !== tripId) return t;
      return { ...t, bookedItems: { ...(t.bookedItems ?? {}), [activityId]: true } };
    }));
  };

  return (
    <MyTripsContext.Provider value={{ trips, addTrip, removeTrip, updateTrip, markActivityBooked, pendingGeneration, setPendingGeneration }}>
      {children}
    </MyTripsContext.Provider>
  );
}

export const useMyTrips = () => useContext(MyTripsContext);

// Helper: is the trip upcoming (active) or in the past?
export function isTripActive(trip: CommittedTrip): boolean {
  return new Date(trip.endDate) >= new Date();
}

// Helper: format "Dec 12 – Dec 14, 2024  •  A Couple"
export function formatTripSubtitle(trip: CommittedTrip): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const startStr = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const endStr = `${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  return `${startStr} – ${endStr}  •  ${trip.party}`;
}
