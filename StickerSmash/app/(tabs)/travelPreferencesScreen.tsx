import React, { useState,useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity,SafeAreaView } from 'react-native';
import { styles } from '@/styles/travelPreferencesStyles';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useOnboarding } from '@/context/OnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveOnboardingStep, getOnboardingStepData } from '@/utils/onboardingStorage';
import { isOnboardingComplete } from '@/utils/isOnboardingComplete'; // import your function
import { updateTravelPreferences } from '@/utils/updateTravelPreferences';
import auth from '@react-native-firebase/auth';
import { getStaticActivities } from '@/utils/getStaticActivities';

import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/_layout'; // adjust path if needed
export default function TravelPreferencesScreen() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [activities, setActivities] = useState<{ label: string; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();  const { setActivityPreferences } = useOnboarding();

useEffect(() => {
  const fetchActivities = async () => {
    setLoading(true);
    try {
      const activities = await getStaticActivities();
      setActivities(activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSaved = async () => {
    const uid = auth().currentUser?.uid;
    let saved: string[] | null = null;

    // Try to load from cached user profile first
    if (uid) {
      const cachedProfile = await AsyncStorage.getItem(`userProfile_${uid}`);
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        if (profile.activityPreferences && Array.isArray(profile.activityPreferences)) {
          saved = profile.activityPreferences;
        }
      }
    }

    // Fallback to onboarding step data
    if (!saved) {
      const onboardingSaved = await getOnboardingStepData('travel');
      if (onboardingSaved && Array.isArray(onboardingSaved)) {
        saved = onboardingSaved;
      }
    }

    if (saved) setSelected(saved);
  };

  fetchActivities();
  loadSaved();
}, []);

  const filtered = activities.filter(p =>
    p.label.toLowerCase().includes(search.toLowerCase())
  );

  function togglePref(label: string) {
    setSelected(s =>
      s.includes(label) ? s.filter(l => l !== label) : [...s, label]
    );
  }


  return (
    <View style={styles.container}>
      {/* Progress bar */}
<SafeAreaView>
  <View style={{ width: '100%', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
    <View style={styles.progressBarWrapper}>
      <View style={styles.progressBarBg} />
      <View style={styles.progressBarFill} />
    </View>
  </View>
</SafeAreaView>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>
          Travel preferences <Text style={styles.headingEmoji}>✈️</Text>
        </Text>
        <Text style={styles.subheading}>
          Tell us your travel preferences, and we'll tailor recommendations to your style. Don't worry, you can always change it later in the settings.
        </Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search travel preferences"
            placeholderTextColor="#bdbdbd"
            value={search}
            onChangeText={setSearch}
          />
        </View>
<View style={styles.prefsGrid}>
  {Array.from({ length: Math.ceil(filtered.length / 2) }).map((_, rowIdx) => (
    <View style={styles.prefsRow} key={rowIdx}>
      {filtered.slice(rowIdx * 2, rowIdx * 2 + 2).map((p, colIdx) => (
<TouchableOpacity
  key={p.label}
  style={[
    styles.prefButton,
    selected.includes(p.label) && styles.prefButtonSelected,
    colIdx === 1 ? { marginTop: rowIdx % 2 === 0 ? 8 : 0 } : {},
  ]}
  onPress={() => togglePref(p.label)}
  activeOpacity={0.8}
>
  <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
    <Text style={[
      styles.prefText,
      selected.includes(p.label) && styles.prefTextSelected,
    ]}>
      {p.label}
    </Text>
    <Text style={styles.prefEmoji}>{p.emoji}</Text>
  </View>
</TouchableOpacity>
      ))}
    </View>
  ))}
</View>
      </ScrollView>
<View style={styles.bottomBar}>
  {selected.length < 2 && (
    <Text style={styles.helperText}>
      Select at least 2 preferences to continue
    </Text>
  )}
<TouchableOpacity
  style={[
    styles.continueButton,
    selected.length < 2 && { opacity: 0.5 }
  ]}
  disabled={selected.length < 2}
onPress={async () => {
  if (selected.length >= 2) {
    setActivityPreferences(selected);
    await saveOnboardingStep('travel', selected); // Save locally

    const uid = auth().currentUser?.uid;
    const onboardingComplete = uid ? await isOnboardingComplete(uid) : false;

    if (onboardingComplete) {
      await updateTravelPreferences(selected); // Update DB/cache
      navigation.navigate('Index'); // Go to home screen
    } else {
      navigation.navigate('FoodPreferences'); // Continue onboarding
    }
  }
}}
>
  <Text style={styles.continueButtonText}>
    Continue
  </Text>
</TouchableOpacity>
</View>
    </View>
  );
}
