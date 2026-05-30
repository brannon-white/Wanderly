import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, TEXT_DARK, BORDER_COLOR } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { ACTIVITY_PILLS } from '@/constants/tripVibes';
import type { LucideIcon } from 'lucide-react-native';

type NavProp = StackNavigationProp<RootStackParamList>;

export default function TripActivitiesScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { includeActivities, setIncludeActivities } = useTripPlanning();

  function toggle(label: string) {
    if (includeActivities.includes(label)) {
      setIncludeActivities(includeActivities.filter(a => a !== label));
    } else {
      setIncludeActivities([...includeActivities, label]);
    }
  }

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: '65%' }]} />
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('TripFood')}
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
        <Text style={shared.heading}>Activities & experiences</Text>
        <Text style={shared.subheading}>
          Select what you want to do. We'll build your days around these.
        </Text>

        <View style={styles.pillsGrid}>
          {ACTIVITY_PILLS.map((item) => {
            const selected = includeActivities.includes(item.label);
            return (
              <Pill
                key={item.label}
                label={item.label}
                icon={item.icon}
                selected={selected}
                onPress={() => toggle(item.label)}
              />
            );
          })}
        </View>
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={shared.continueBtn}
          onPress={() => navigation.navigate('TripFood')}
          activeOpacity={0.85}
        >
          <Text style={shared.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Pill({
  label,
  icon: Icon,
  selected,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Icon size={14} color={selected ? '#22A67A' : TEXT_DARK} style={{ marginRight: 6 }} />
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  skipText: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  pillSelected: {
    borderColor: '#22A67A',
    backgroundColor: '#EDFAF5',
  },
  pillText: {
    fontSize: 14,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-SemiBold',
  },
  pillTextSelected: {
    color: '#22A67A',
  },
});
