import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PersonStanding, Heart, UsersRound, Users, Briefcase } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, PRIMARY, TEXT_DARK } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useMyTrips } from '@/context/MyTripsContext';

type NavProp = StackNavigationProp<RootStackParamList>;

const PARTY_OPTIONS: { id: string; icon: LucideIcon; description: string }[] = [
  { id: 'Only Me', icon: PersonStanding, description: 'Traveling solo, just you.' },
  { id: 'A Couple', icon: Heart, description: 'A romantic getaway for two.' },
  { id: 'Family', icon: UsersRound, description: 'Quality time with your loved ones.' },
  { id: 'Friends', icon: Users, description: 'Adventure with your closest pals.' },
  { id: 'Work', icon: Briefcase, description: 'Business or corporate travel.' },
];

export default function TripPartyScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { flow, party, setParty, templateId, templateTitle, templateHeroImage, startDate, endDate, reset, destinationSnapshot } = useTripPlanning();
  const { addTrip } = useMyTrips();

  const isPrebuilt = flow === 'prebuilt';
  const progressWidth = isPrebuilt ? '100%' : '20%';

  const handleContinue = () => {
    if (isPrebuilt) {
      addTrip({
        id: `committed-${Date.now()}`,
        templateId,
        title: templateTitle,
        heroImage: templateHeroImage,
        party,
        startDate: startDate!.toISOString(),
        endDate: endDate!.toISOString(),
        origin: 'prebuilt',
        destinationName: destinationSnapshot?.name,
        country: destinationSnapshot?.country,
      });
      reset();
      navigation.navigate('Index' as any, { screen: 'MyTrips' } as any);
    } else {
      navigation.navigate('TripDates');
    }
  };

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: progressWidth }]} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={shared.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={shared.heading}>
          {isPrebuilt ? "Who's coming along?" : 'Who is going?'}
        </Text>
        <Text style={shared.subheading}>
          {isPrebuilt
            ? 'Last step — let us know who you\'re traveling with.'
            : "Let's get started by selecting who you're traveling with."}
        </Text>

        {PARTY_OPTIONS.map((option) => {
          const selected = party === option.id;
          const OptionIcon = option.icon;
          return (
            <TouchableOpacity
              key={option.id}
              style={[shared.optionCard, selected && shared.optionCardSelected]}
              onPress={() => setParty(option.id)}
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
          style={[shared.continueBtn, !party && shared.continueBtnDisabled]}
          disabled={!party}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={shared.continueBtnText}>
            {isPrebuilt ? 'Add to My Trips' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
