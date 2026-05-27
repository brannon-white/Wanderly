import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DollarSign, Briefcase, Gem, Target } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, PRIMARY, TEXT_DARK } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';

type NavProp = StackNavigationProp<RootStackParamList>;

const BUDGET_OPTIONS: { id: string; icon: LucideIcon; description: string }[] = [
  { id: 'Cheap', icon: DollarSign, description: 'Budget-friendly, economical travel.' },
  { id: 'Balanced', icon: Briefcase, description: 'Moderate spending for a balanced trip.' },
  { id: 'Luxury', icon: Gem, description: 'High-end, indulgent experiences.' },
  { id: 'Flexible', icon: Target, description: 'No budget restrictions.' },
];

export default function TripBudgetScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { budget, setBudget } = useTripPlanning();

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: '80%' }]} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={shared.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={shared.heading}>Set your trip budget</Text>
        <Text style={shared.subheading}>
          Let us know your budget preference, and we'll craft an itinerary that suits your financial comfort.
        </Text>

        {BUDGET_OPTIONS.map((option) => {
          const selected = budget === option.id;
          const OptionIcon = option.icon;
          return (
            <TouchableOpacity
              key={option.id}
              style={[shared.optionCard, selected && shared.optionCardSelected]}
              onPress={() => setBudget(option.id)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <OptionIcon size={18} color={selected ? PRIMARY : TEXT_DARK} />
                <Text style={[shared.optionTitle, selected && shared.optionTitleSelected, { marginBottom: 0 }]}>
                  {option.id}
                </Text>
              </View>
              <Text style={shared.optionSubtitle}>{option.description}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[shared.continueBtn, !budget && shared.continueBtnDisabled]}
          disabled={!budget}
          onPress={() => navigation.navigate('TripReview')}
          activeOpacity={0.85}
        >
          <Text style={shared.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
