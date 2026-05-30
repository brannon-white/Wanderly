import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Users, Footprints, Sunrise } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, TEXT_DARK, TEXT_GRAY, BORDER_COLOR } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { TRIP_VIBES, ACTIVITY_PILLS, FOOD_PILLS } from '@/constants/tripVibes';
import { INTERESTS } from '@/constants/interests';

type NavProp = StackNavigationProp<RootStackParamList>;

const AVOID_EXTRAS: { label: string; icon: LucideIcon }[] = [
  { label: 'Crowds', icon: Users },
  { label: 'Long Hikes', icon: Footprints },
  { label: 'Early Mornings', icon: Sunrise },
];

const AVOID_POOL = [...INTERESTS, ...AVOID_EXTRAS];

export default function TripPreferencesScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const {
    tripVibes, setTripVibes,
    includeActivities, setIncludeActivities,
    foodPreferences, setFoodPreferences,
    avoidActivities, setAvoidActivities,
  } = useTripPlanning();

  function toggleVibe(label: string) {
    setTripVibes(tripVibes.includes(label)
      ? tripVibes.filter(v => v !== label)
      : [...tripVibes, label]);
  }

  function toggleActivity(label: string) {
    if (includeActivities.includes(label)) {
      setIncludeActivities(includeActivities.filter(l => l !== label));
    } else {
      setIncludeActivities([...includeActivities, label]);
      if (avoidActivities.includes(label)) setAvoidActivities(avoidActivities.filter(l => l !== label));
    }
  }

  function toggleFood(label: string) {
    setFoodPreferences(foodPreferences.includes(label)
      ? foodPreferences.filter(l => l !== label)
      : [...foodPreferences, label]);
  }

  function toggleAvoid(label: string) {
    if (avoidActivities.includes(label)) {
      setAvoidActivities(avoidActivities.filter(l => l !== label));
    } else {
      setAvoidActivities([...avoidActivities, label]);
      if (includeActivities.includes(label)) setIncludeActivities(includeActivities.filter(l => l !== label));
    }
  }

  const totalSelected = tripVibes.length + includeActivities.length + foodPreferences.length + avoidActivities.length;

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: '75%' }]} />
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('TripReview')}
          hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[shared.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={shared.heading}>Your preferences</Text>
        <Text style={shared.subheading}>
          Pick everything that fits — we'll use it all to shape your itinerary.
          {totalSelected > 0 ? ` (${totalSelected} selected)` : ''}
        </Text>

        {/* ── VIBES ────────────────────────────────────────────── */}
        <SectionHeader title="VIBES" subtitle="The character of your trip" />
        <View style={styles.pillsGrid}>
          {TRIP_VIBES.map((item) => (
            <SelectPill
              key={item.label}
              label={item.label}
              icon={item.icon}
              selected={tripVibes.includes(item.label)}
              onPress={() => toggleVibe(item.label)}
              activeColor="#22A67A"
              activeBg="#EDFAF5"
            />
          ))}
        </View>

        <View style={styles.divider} />

        {/* ── ACTIVITIES ───────────────────────────────────────── */}
        <SectionHeader title="ACTIVITIES" subtitle="What you want to do" />
        <View style={styles.pillsGrid}>
          {ACTIVITY_PILLS.map((item) => (
            <SelectPill
              key={item.label}
              label={item.label}
              icon={item.icon}
              selected={includeActivities.includes(item.label)}
              onPress={() => toggleActivity(item.label)}
              activeColor="#22A67A"
              activeBg="#EDFAF5"
            />
          ))}
        </View>

        <View style={styles.divider} />

        {/* ── FOOD & DRINK ─────────────────────────────────────── */}
        <SectionHeader title="FOOD & DRINK" subtitle="Dining experiences you love" />
        <View style={styles.pillsGrid}>
          {FOOD_PILLS.map((item) => (
            <SelectPill
              key={item.label}
              label={item.label}
              icon={item.icon}
              selected={foodPreferences.includes(item.label)}
              onPress={() => toggleFood(item.label)}
              activeColor="#22A67A"
              activeBg="#EDFAF5"
            />
          ))}
        </View>

        <View style={styles.divider} />

        {/* ── THINGS TO AVOID ──────────────────────────────────── */}
        <SectionHeader title="THINGS TO AVOID" subtitle="We'll exclude these from your itinerary" color="#E04B4B" />
        <View style={styles.pillsGrid}>
          {AVOID_POOL.map((item) => (
            <SelectPill
              key={item.label}
              label={item.label}
              icon={item.icon}
              selected={avoidActivities.includes(item.label)}
              onPress={() => toggleAvoid(item.label)}
              activeColor="#E04B4B"
              activeBg="#FFF0F0"
            />
          ))}
        </View>
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={shared.continueBtn}
          onPress={() => navigation.navigate('TripReview')}
          activeOpacity={0.85}
        >
          <Text style={shared.continueBtnText}>
            {totalSelected > 0 ? 'Continue' : 'Skip'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionHeader({ title, subtitle, color = TEXT_GRAY }: { title: string; subtitle: string; color?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SelectPill({
  label,
  icon: Icon,
  selected,
  onPress,
  activeColor,
  activeBg,
}: {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onPress: () => void;
  activeColor: string;
  activeBg: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        selected && { borderColor: activeColor, backgroundColor: activeBg },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Icon size={13} color={selected ? activeColor : TEXT_DARK} style={{ marginRight: 5 }} />
      <Text style={[styles.pillText, selected && { color: activeColor }]}>{label}</Text>
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
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'SourceSans3-SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
    color: TEXT_GRAY,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER_COLOR,
    marginVertical: 28,
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
  pillText: {
    fontSize: 14,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-SemiBold',
  },
});
