import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, PRIMARY, PRIMARY_LIGHT, BORDER_COLOR, TEXT_DARK, TEXT_GRAY } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import type { TripType, TravelPace } from '@/types/itinerary';

type NavProp = StackNavigationProp<RootStackParamList>;

interface StyleOption {
  key: TripType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  examples: string;
}

interface PaceOption {
  key: TravelPace;
  label: string;
  description: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    key: 'hub',
    label: 'Stay in one place',
    description: 'Base yourself in one city or area and explore from there.',
    icon: 'home-outline',
    examples: 'NYC, Tokyo, Beach resorts, Vegas',
  },
  {
    key: 'route',
    label: 'Multi-stop road trip',
    description: 'Move through multiple locations along a route.',
    icon: 'map-outline',
    examples: 'Oregon coast, Iceland ring road, Pacific Coast Hwy',
  },
];

const PACE_OPTIONS: PaceOption[] = [
  { key: 'every_night', label: 'Every night', description: 'A new location each day — maximum variety' },
  { key: 'every_few_days', label: 'Every few days', description: '2–4 nights per stop — balance depth and breadth' },
  { key: 'few_stops', label: 'Only 2–3 stops', description: 'Fewer stops, more time to settle in each place' },
  { key: 'flexible', label: 'Let AI decide', description: 'Generate the best route automatically' },
];

export default function TripStyleScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { tripType, travelPace, setTripType, setTravelPace, flow } = useTripPlanning();

  const [selectedStyle, setSelectedStyle] = useState<TripType>(tripType || 'hub');
  const [selectedPace, setSelectedPace] = useState<TravelPace | ''>(travelPace || '');

  const isRoute = selectedStyle === 'route';
  const canContinue = !isRoute || selectedPace !== '';

  const handleContinue = () => {
    setTripType(selectedStyle);
    setTravelPace(isRoute ? (selectedPace as TravelPace) : '');
    navigation.navigate('TripPrompt');
  };

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: '50%' }]} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[shared.scrollContent, { paddingHorizontal: 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={shared.heading}>How do you want to travel?</Text>
        <Text style={shared.subheading}>
          This helps us build an itinerary that actually works for how you move.
        </Text>

        <View style={styles.optionsSection}>
          {STYLE_OPTIONS.map(option => {
            const selected = selectedStyle === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => {
                  setSelectedStyle(option.key);
                  if (option.key === 'hub') setSelectedPace('');
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                  <Ionicons name={option.icon} size={24} color={selected ? '#fff' : TEXT_GRAY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.cardDesc}>{option.description}</Text>
                  <Text style={styles.cardExamples}>{option.examples}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={PRIMARY} style={{ marginLeft: 8 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {isRoute && (
          <>
            <Text style={[shared.heading, { fontSize: 18, marginTop: 24 }]}>
              How often do you want to move?
            </Text>
            <Text style={[shared.subheading, { marginTop: 4 }]}>
              This shapes how many overnight stops the AI plans for you.
            </Text>
            <View style={styles.optionsSection}>
              {PACE_OPTIONS.map(option => {
                const paceSelected = selectedPace === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.paceCard, paceSelected && styles.paceCardSelected]}
                    onPress={() => setSelectedPace(option.key)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.paceLabel, paceSelected && styles.paceLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.paceDesc}>{option.description}</Text>
                    </View>
                    {paceSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[shared.continueBtn, !canContinue && shared.continueBtnDisabled]}
          disabled={!canContinue}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={shared.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  optionsSection: {
    marginTop: 12,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
    gap: 14,
  },
  cardSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY_LIGHT,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: PRIMARY,
  },
  cardLabel: {
    fontSize: 16,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
    marginBottom: 3,
  },
  cardLabelSelected: {
    color: PRIMARY,
  },
  cardDesc: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
    lineHeight: 18,
  },
  cardExamples: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
    marginTop: 4,
    fontStyle: 'italic',
  },
  paceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    gap: 10,
  },
  paceCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY_LIGHT,
  },
  paceLabel: {
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
    marginBottom: 2,
  },
  paceLabelSelected: {
    color: PRIMARY,
  },
  paceDesc: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
  },
});
