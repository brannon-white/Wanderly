import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PersonStanding, Heart, UsersRound, Users, Briefcase, DollarSign, Gem, Target } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, PRIMARY, TEXT_DARK, TEXT_GRAY, BORDER_COLOR, PRIMARY_LIGHT } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';

type NavProp = StackNavigationProp<RootStackParamList>;

const PARTY_OPTIONS: { id: string; icon: LucideIcon }[] = [
  { id: 'Only Me', icon: PersonStanding },
  { id: 'A Couple', icon: Heart },
  { id: 'Family', icon: UsersRound },
  { id: 'Friends', icon: Users },
  { id: 'Work', icon: Briefcase },
];

const BUDGET_OPTIONS: { id: string; icon: LucideIcon; description: string }[] = [
  { id: 'Cheap', icon: DollarSign, description: 'Budget-friendly' },
  { id: 'Balanced', icon: Briefcase, description: 'Moderate spending' },
  { id: 'Luxury', icon: Gem, description: 'High-end experiences' },
  { id: 'Flexible', icon: Target, description: 'No restrictions' },
];

export default function TripBasicsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { party, setParty, budget, setBudget } = useTripPlanning();

  const canContinue = !!party && !!budget;

  const handleContinue = () => {
    navigation.navigate('TripDates');
  };

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: '20%' }]} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[shared.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={shared.heading}>Let's start with the basics</Text>
        <Text style={shared.subheading}>Who's going and what's your budget?</Text>

        <Text style={styles.sectionLabel}>WHO'S TRAVELING?</Text>
        <View style={styles.partyGrid}>
          {PARTY_OPTIONS.map((option, index) => {
            const selected = party === option.id;
            const OptionIcon = option.icon;
            const isLastOdd = PARTY_OPTIONS.length % 2 !== 0 && index === PARTY_OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.partyCard,
                  selected && styles.partyCardSelected,
                  isLastOdd && styles.partyCardFull,
                ]}
                onPress={() => setParty(option.id)}
                activeOpacity={0.75}
              >
                <OptionIcon size={20} color={selected ? PRIMARY : TEXT_DARK} />
                <Text style={[styles.partyLabel, selected && styles.partyLabelSelected]}>
                  {option.id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>YOUR BUDGET</Text>
        <View style={styles.budgetGrid}>
          {BUDGET_OPTIONS.map((option) => {
            const selected = budget === option.id;
            const OptionIcon = option.icon;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.budgetCard, selected && styles.budgetCardSelected]}
                onPress={() => setBudget(option.id)}
                activeOpacity={0.75}
              >
                <OptionIcon size={20} color={selected ? PRIMARY : TEXT_GRAY} />
                <Text style={[styles.budgetLabel, selected && styles.budgetLabelSelected]}>
                  {option.id}
                </Text>
                <Text style={styles.budgetDesc}>{option.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'SourceSans3-SemiBold',
    color: TEXT_GRAY,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  partyCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
  },
  partyCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY_LIGHT,
  },
  partyCardFull: {
    width: '100%',
  },
  partyLabel: {
    fontSize: 15,
    fontFamily: 'SourceSans3-SemiBold',
    color: TEXT_DARK,
  },
  partyLabelSelected: {
    color: PRIMARY,
  },
  budgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  budgetCard: {
    width: '48%',
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
    gap: 6,
  },
  budgetCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY_LIGHT,
  },
  budgetLabel: {
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
  },
  budgetLabelSelected: {
    color: PRIMARY,
  },
  budgetDesc: {
    fontSize: 12,
    fontFamily: 'SourceSans3-Regular',
    color: TEXT_GRAY,
  },
});
