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

const AVOID_ONLY = [
  { label: 'Crowds', emoji: '👥' },
  { label: 'Long Hikes', emoji: '🥾' },
  { label: 'Early Mornings', emoji: '🌅' },
];

const ALL_PILLS = [...INTERESTS, ...AVOID_ONLY];

export default function TripInterestsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { includeActivities, avoidActivities, setIncludeActivities, setAvoidActivities } = useTripPlanning();

  function toggleInclude(label: string) {
    if (includeActivities.includes(label)) {
      setIncludeActivities(includeActivities.filter(l => l !== label));
    } else {
      setIncludeActivities([...includeActivities, label]);
      if (avoidActivities.includes(label)) {
        setAvoidActivities(avoidActivities.filter(l => l !== label));
      }
    }
  }

  function toggleAvoid(label: string) {
    if (avoidActivities.includes(label)) {
      setAvoidActivities(avoidActivities.filter(l => l !== label));
    } else {
      setAvoidActivities([...avoidActivities, label]);
      if (includeActivities.includes(label)) {
        setIncludeActivities(includeActivities.filter(l => l !== label));
      }
    }
  }

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: '60%' }]} />
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('TripBudget')}
          hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[shared.scrollContent, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={shared.heading}>Customize this trip</Text>
        <Text style={shared.subheading}>
          Optionally tell us what to include or avoid. Both sections are optional.
        </Text>

        <SectionLabel
          icon="add-circle"
          label="Must Include"
          color="#22A67A"
          hint="We'll prioritize these in your itinerary"
        />
        <View style={styles.pillsGrid}>
          {INTERESTS.map((item) => {
            const included = includeActivities.includes(item.label);
            return (
              <Pill
                key={item.label}
                label={item.label}
                emoji={item.emoji}
                state={included ? 'include' : 'neutral'}
                onPress={() => toggleInclude(item.label)}
              />
            );
          })}
        </View>

        <View style={styles.divider} />

        <SectionLabel
          icon="close-circle"
          label="Avoid"
          color="#E04B4B"
          hint="We'll exclude these from your itinerary"
        />
        <View style={styles.pillsGrid}>
          {ALL_PILLS.map((item) => {
            const avoided = avoidActivities.includes(item.label);
            return (
              <Pill
                key={item.label}
                label={item.label}
                emoji={item.emoji}
                state={avoided ? 'avoid' : 'neutral'}
                onPress={() => toggleAvoid(item.label)}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={shared.continueBtn}
          onPress={() => navigation.navigate('TripBudget')}
          activeOpacity={0.85}
        >
          <Text style={shared.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionLabel({
  icon,
  label,
  color,
  hint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  hint: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{label}</Text>
      </View>
      <Text style={styles.sectionHint}>{hint}</Text>
    </View>
  );
}

function Pill({
  label,
  emoji,
  state,
  onPress,
}: {
  label: string;
  emoji: string;
  state: 'include' | 'avoid' | 'neutral';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        state === 'include' && styles.pillInclude,
        state === 'avoid' && styles.pillAvoid,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.pillText,
          state === 'include' && styles.pillTextInclude,
          state === 'avoid' && styles.pillTextAvoid,
        ]}
      >
        {label}
      </Text>
      <Text style={styles.pillEmoji}>{emoji}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  skipText: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Merriweather_24pt-Bold',
  },
  sectionHint: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER_COLOR,
    marginVertical: 24,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
  },
  pillInclude: {
    borderColor: '#22A67A',
    backgroundColor: '#EDFAF5',
  },
  pillAvoid: {
    borderColor: '#E04B4B',
    backgroundColor: '#FFF0F0',
  },
  pillText: {
    fontSize: 14,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
  },
  pillTextInclude: {
    color: '#22A67A',
  },
  pillTextAvoid: {
    color: '#E04B4B',
  },
  pillEmoji: {
    fontSize: 14,
    marginLeft: 5,
  },
});
