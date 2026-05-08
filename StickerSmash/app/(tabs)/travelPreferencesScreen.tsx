import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { styles } from '@/styles/travelPreferencesStyles';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useOnboarding } from '@/context/OnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveOnboardingStep, getOnboardingStepData } from '@/utils/onboardingStorage';
import { isOnboardingComplete } from '@/utils/isOnboardingComplete';
import { updateTravelPreferences } from '@/utils/updateTravelPreferences';
import { getAuth } from '@react-native-firebase/auth';
import { getStaticActivities } from '@/utils/getStaticActivities';
import { useDemo } from '@/context/DemoContext';
import { DEMO_ACTIVITIES } from '@/data/demoData';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/_layout';

type RouteParams = RouteProp<RootStackParamList, 'TravelPreferences'>;

export default function TravelPreferencesScreen() {
  const { isDemoMode } = useDemo();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [activities, setActivities] = useState<{ label: string; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const fromSettings = (route.params as any)?.fromSettings === true;
  const { setActivityPreferences } = useOnboarding();

  useEffect(() => {
    if (isDemoMode) {
      setActivities(DEMO_ACTIVITIES);
      setLoading(false);
      return;
    }

    const fetchActivities = async () => {
      setLoading(true);
      try {
        const result = await getStaticActivities();
        setActivities(result);
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };

    const loadSaved = async () => {
      const uid = getAuth().currentUser?.uid;
      let saved: string[] | null = null;
      if (uid) {
        const cachedProfile = await AsyncStorage.getItem(`userProfile_${uid}`);
        if (cachedProfile) {
          const profile = JSON.parse(cachedProfile);
          if (Array.isArray(profile.activityPreferences)) {
            saved = profile.activityPreferences;
          }
        }
      }
      if (!saved) {
        const onboardingSaved = await getOnboardingStepData('travel');
        if (onboardingSaved && Array.isArray(onboardingSaved)) saved = onboardingSaved;
      }
      if (saved) setSelected(saved);
    };

    fetchActivities();
    loadSaved();
  }, [isDemoMode]);

  const filtered = activities.filter(p =>
    p.label.toLowerCase().includes(search.toLowerCase())
  );

  function togglePref(label: string) {
    setSelected(s => s.includes(label) ? s.filter(l => l !== label) : [...s, label]);
  }

  return (
    <View style={styles.container}>
      <SafeAreaView>
        {fromSettings ? (
          /* Settings mode: simple back button header, no progress bar */
          <View style={[styles.topBar, { justifyContent: 'flex-start' }]}>
            <TouchableOpacity
              style={styles.backArrow}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={28} color="#222" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Onboarding mode: progress bar centered */
          <View style={{ width: '100%', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarBg} />
              <View style={styles.progressBarFill} />
            </View>
          </View>
        )}
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
          {fromSettings
            ? 'Update your travel preferences to get better recommendations.'
            : "Tell us your travel preferences, and we'll tailor recommendations to your style. Don't worry, you can always change it later in the settings."}
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
        {!fromSettings && selected.length < 2 && (
          <Text style={styles.helperText}>Select at least 2 preferences to continue</Text>
        )}
        <TouchableOpacity
          style={[
            styles.continueButton,
            !fromSettings && selected.length < 2 && { opacity: 0.5 },
          ]}
          disabled={!fromSettings && selected.length < 2}
          onPress={async () => {
            setActivityPreferences(selected);

            if (fromSettings) {
              await updateTravelPreferences(selected);
              navigation.goBack();
              return;
            }

            if (isDemoMode) {
              navigation.navigate('FoodPreferences');
              return;
            }

            await saveOnboardingStep('travel', selected);
            const uid = getAuth().currentUser?.uid;
            const onboardingComplete = uid ? await isOnboardingComplete(uid) : false;
            if (onboardingComplete) {
              await updateTravelPreferences(selected);
              navigation.navigate('Index');
            } else {
              navigation.navigate('FoodPreferences');
            }
          }}
        >
          <Text style={styles.continueButtonText}>
            {fromSettings ? 'Save' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
