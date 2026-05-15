import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared } from '@/styles/tripPlanningStyles';
import { styles as prefStyles } from '@/styles/travelPreferencesStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { INTERESTS } from '@/constants/interests';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from '@react-native-firebase/auth';

type NavProp = StackNavigationProp<RootStackParamList>;

export default function TripInterestsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { interests, setInterests } = useTripPlanning();

  useEffect(() => {
    if (interests.length > 0) return;

    async function preloadSaved() {
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      try {
        const raw = await AsyncStorage.getItem(`userProfile_${uid}`);
        if (raw) {
          const profile = JSON.parse(raw);
          if (Array.isArray(profile.activityPreferences) && profile.activityPreferences.length > 0) {
            setInterests(profile.activityPreferences);
          }
        }
      } catch {}
    }

    preloadSaved();
  }, []);

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

        <View style={prefStyles.prefsGrid}>
          {INTERESTS.map((item) => {
            const selected = interests.includes(item.label);
            return (
              <TouchableOpacity
                key={item.label}
                style={[prefStyles.prefButton, selected && prefStyles.prefButtonSelected]}
                onPress={() => toggle(item.label)}
                activeOpacity={0.75}
              >
                <Text style={[prefStyles.prefText, selected && prefStyles.prefTextSelected]}>
                  {item.label}
                </Text>
                <Text style={prefStyles.prefEmoji}>{item.emoji}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {!canContinue && (
          <Text style={prefStyles.helperText}>Select at least 1 interest to continue</Text>
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
