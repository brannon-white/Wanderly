import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GeneratedItinerary } from '@/types/itinerary';
import { optimizeDay } from '@/services/regenerateItinerary';

type Mode = 'minimize_walking' | 'minimize_cost' | 'relax_mode' | 'maximize_sightseeing' | 'foodie_mode';

const MODES: { mode: Mode; label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }[] = [
  { mode: 'minimize_walking', label: 'Less Walking', icon: 'walk-outline' },
  { mode: 'minimize_cost', label: 'Save Money', icon: 'cash-outline' },
  { mode: 'relax_mode', label: 'Relax Mode', icon: 'leaf-outline' },
  { mode: 'maximize_sightseeing', label: 'Max Sights', icon: 'camera-outline' },
  { mode: 'foodie_mode', label: 'Foodie', icon: 'restaurant-outline' },
];

interface Props {
  itineraryId: string;
  dayIndex: number;
  onOptimized: (updatedItinerary: GeneratedItinerary) => void;
  onPaywallNeeded?: () => void;
}

export default function DayOptimizeBar({ itineraryId, dayIndex, onOptimized, onPaywallNeeded }: Props) {
  const [loading, setLoading] = useState<Mode | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleOptimize = async (mode: Mode) => {
    if (loading) return;
    setLoading(mode);
    try {
      const { itinerary } = await optimizeDay({ itineraryId, dayIndex, mode });
      onOptimized(itinerary);
      setExpanded(false);
    } catch (err) {
      if (err instanceof Error && /regen_limit_reached/i.test(err.message)) {
        onPaywallNeeded?.();
      } else {
        Alert.alert('Could not optimize day', err instanceof Error ? err.message : 'Please try again.');
      }
    } finally {
      setLoading(null);
    }
  };

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.trigger} onPress={() => setExpanded(true)}>
        <Ionicons name="options-outline" size={14} color="#6A62B7" />
        <Text style={styles.triggerText}>Optimize Day</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Optimize this day</Text>
        <TouchableOpacity onPress={() => setExpanded(false)}>
          <Ionicons name="close" size={16} color="#888" />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeList}>
        {MODES.map(({ mode, label, icon }) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeBtn, loading === mode && styles.modeBtnLoading]}
            onPress={() => handleOptimize(mode)}
            disabled={!!loading}
          >
            {loading === mode ? (
              <ActivityIndicator size="small" color="#6A62B7" />
            ) : (
              <Ionicons name={icon} size={16} color="#6A62B7" />
            )}
            <Text style={styles.modeBtnText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 12,
    gap: 4,
    backgroundColor: '#F0EEFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  triggerText: {
    fontSize: 12,
    color: '#6A62B7',
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
  },
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F0EEFF',
    borderRadius: 12,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3D3555',
    fontFamily: 'SourceSans3-Regular',
  },
  modeList: {
    gap: 8,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D0CAEF',
    minWidth: 100,
  },
  modeBtnLoading: {
    opacity: 0.6,
  },
  modeBtnText: {
    fontSize: 12,
    color: '#3D3555',
    fontFamily: 'SourceSans3-Regular',
  },
});
