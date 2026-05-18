import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { editItineraryWithLanguage } from '@/services/regenerateItinerary';
import type { GeneratedItinerary } from '@/types/itinerary';
import { getUsageStatus } from '@/services/purchases';

interface RefinementPill {
  label: string;
  emoji: string;
  message: string;
}

const PILLS: RefinementPill[] = [
  { label: 'More Food', emoji: '🍜', message: 'Add more food and dining experiences throughout the itinerary, include interesting local restaurants and cafes' },
  { label: 'Less Walking', emoji: '🚕', message: 'Reduce walking between activities by clustering them geographically, use transport more often' },
  { label: 'Hidden Gems', emoji: '🗺️', message: 'Replace tourist hotspots with local hidden gem alternatives and off-the-beaten-path venues' },
  { label: 'More Relaxed', emoji: '☕', message: 'Make the pace more relaxed with fewer activities per day and longer time at each place' },
  { label: 'More Nature', emoji: '🌿', message: 'Add more nature, parks, and outdoor experiences to the itinerary' },
  { label: 'More Nightlife', emoji: '🎶', message: 'Add more evening activities, bars, music venues, and nightlife options' },
  { label: 'More Adventure', emoji: '🏔️', message: 'Add more outdoor adventure activities, hiking, and physical experiences' },
  { label: 'Budget Friendly', emoji: '💰', message: 'Replace expensive venues with more affordable local alternatives' },
];

interface Props {
  itineraryId: string;
  onUpdated: (itinerary: GeneratedItinerary) => void;
  onPaywallNeeded: () => void;
}

export default function ItineraryRefinementBar({ itineraryId, onUpdated, onPaywallNeeded }: Props) {
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
      });
      onUpdated(updated);
    } catch {
      // Silently fail — the AI bar below can show errors
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
                <Text style={styles.pillEmoji}>{pill.emoji}</Text>
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
  pillEmoji: {
    fontSize: 14,
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
