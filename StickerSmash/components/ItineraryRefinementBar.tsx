import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Utensils, Car, Map, Coffee, Leaf, Music2, Mountain, DollarSign } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { editItineraryWithLanguage } from '@/services/regenerateItinerary';
import type { GeneratedItinerary } from '@/types/itinerary';
import { getUsageStatus } from '@/services/purchases';

interface RefinementPill {
  label: string;
  icon: LucideIcon;
  message: string;
}

// Messages are phrased for the day the user is viewing — the bar passes
// forceScopeToDay so every refinement is applied only to that day's city.
const PILLS: RefinementPill[] = [
  { label: 'More Food', icon: Utensils, message: 'Add more food and dining experiences to this day, include interesting local restaurants and cafes nearby' },
  { label: 'Less Walking', icon: Car, message: 'Reduce walking between activities on this day by clustering them geographically, use transport more often' },
  { label: 'Hidden Gems', icon: Map, message: 'Replace tourist hotspots on this day with local hidden gem alternatives and off-the-beaten-path venues nearby' },
  { label: 'More Relaxed', icon: Coffee, message: 'Make this day more relaxed with fewer activities and longer time at each place' },
  { label: 'More Nature', icon: Leaf, message: 'Add more nature, parks, and outdoor experiences to this day nearby' },
  { label: 'More Nightlife', icon: Music2, message: 'Add more evening activities, bars, music venues, and nightlife options to this day nearby' },
  { label: 'More Adventure', icon: Mountain, message: 'Add more outdoor adventure activities, hiking, and physical experiences to this day nearby' },
  { label: 'Budget Friendly', icon: DollarSign, message: 'Replace expensive venues on this day with more affordable local alternatives nearby' },
];

interface Props {
  itineraryId: string;
  dayIndex: number;
  onUpdated: (itinerary: GeneratedItinerary) => void;
  onPaywallNeeded: () => void;
}

export default function ItineraryRefinementBar({ itineraryId, dayIndex, onUpdated, onPaywallNeeded }: Props) {
  const [loadingPill, setLoadingPill] = useState<string | null>(null);

  async function handlePill(pill: RefinementPill) {
    if (loadingPill) return;

    const usage = await getUsageStatus().catch(() => null);
    if (usage && !usage.isPro && usage.regensLeft <= 0) {
      onPaywallNeeded();
      return;
    }

    setLoadingPill(pill.label);
    try {
      const { itinerary: updated } = await editItineraryWithLanguage({
        itineraryId,
        message: pill.message,
        dayIndex,
        forceScopeToDay: true,
      });
      onUpdated(updated);
    } catch (err) {
      // A tap that ends with no visible change and no message reads as a dead
      // button — surface the failure like the other regen actions do.
      if (err instanceof Error && /regen_limit_reached/i.test(err.message)) {
        onPaywallNeeded();
      } else {
        Alert.alert('Could not refine day', err instanceof Error ? err.message : 'Please try again.');
      }
    } finally {
      setLoadingPill(null);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Quick Refine</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {PILLS.map((pill) => {
          const isLoading = loadingPill === pill.label;
          const isDimmed = loadingPill !== null && !isLoading;
          return (
            <TouchableOpacity
              key={pill.label}
              style={[styles.pill, isLoading && styles.pillLoading, isDimmed && styles.pillDimmed]}
              onPress={() => handlePill(pill)}
              activeOpacity={0.75}
              disabled={loadingPill !== null}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#6A62B7" style={{ marginRight: 6 }} />
              ) : (
                <pill.icon size={14} color="#6A62B7" style={{ marginRight: 2 }} />
              )}
              <Text style={[styles.pillText, isLoading && styles.pillTextLoading]}>
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    paddingBottom: 8,
  },
  label: {
    fontSize: 11,
    color: '#bbb',
    fontFamily: 'SourceSans3-Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
    gap: 5,
  },
  pillLoading: {
    borderColor: '#6A62B7',
    backgroundColor: '#f3f0ff',
  },
  pillDimmed: {
    opacity: 0.4,
  },
  pillText: {
    fontSize: 13.5,
    color: '#333',
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
  },
  pillTextLoading: {
    color: '#6A62B7',
  },
});
