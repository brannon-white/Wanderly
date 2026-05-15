import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, PRIMARY, PRIMARY_LIGHT, BORDER_COLOR, TEXT_DARK, TEXT_GRAY } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { INTERESTS } from '@/constants/interests';

type NavProp = StackNavigationProp<RootStackParamList>;

export default function TripInterestsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { interests, setInterests } = useTripPlanning();

  const toggle = (label: string) => {
    setInterests(
      interests.includes(label)
        ? interests.filter(i => i !== label)
        : [...interests, label]
    );
  };

  const canContinue = interests.length >= 1;

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: '60%' }]} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={shared.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={shared.heading}>Tailor your adventure to your tastes ⭐</Text>
        <Text style={shared.subheading}>
          Select your travel preferences to customize your trip plan.
        </Text>

        <View style={styles.grid}>
          {Array.from({ length: Math.ceil(INTERESTS.length / 2) }).map((_, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {INTERESTS.slice(rowIdx * 2, rowIdx * 2 + 2).map((item) => {
                const selected = interests.includes(item.label);
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.pill, selected && styles.pillSelected]}
                    onPress={() => toggle(item.label)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                      {item.label} {item.emoji}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {!canContinue && (
          <Text style={styles.helperText}>Select at least 1 interest to continue</Text>
        )}
        <TouchableOpacity
          style={[shared.continueBtn, !canContinue && shared.continueBtnDisabled]}
          disabled={!canContinue}
          onPress={() => navigation.navigate('TripBudget')}
          activeOpacity={0.85}
        >
          <Text style={shared.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    justifyContent: 'flex-start',
  },
  pill: {
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 32,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    flexShrink: 1,
  },
  pillSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  pillText: {
    fontSize: 13,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
  },
  pillTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  helperText: {
    textAlign: 'center',
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
    fontSize: 13,
    marginBottom: 8,
  },
});
