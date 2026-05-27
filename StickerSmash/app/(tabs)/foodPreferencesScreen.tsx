import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { styles } from '@/styles/travelPreferencesStyles';
import { useOnboarding } from '@/context/OnboardingContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { saveOnboardingStep, getOnboardingStepData } from '@/utils/onboardingStorage';
import { Ionicons } from '@expo/vector-icons';
import { Search } from 'lucide-react-native';
import { getStaticFoodPreferences } from '@/utils/getStaticFoodPreferences';
import { useDemo } from '@/context/DemoContext';
import { DEMO_FOOD_PREFERENCES } from '@/data/demoData';
import { getAuth } from '@react-native-firebase/auth';
import { isOnboardingComplete } from '@/utils/isOnboardingComplete';
import { updateFoodPreferences } from '@/utils/updateFoodPreferences';

type RouteParams = RouteProp<RootStackParamList, 'FoodPreferences'>;

export default function FoodPreferencesScreen() {
  const { isDemoMode } = useDemo();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [foods, setFoods] = useState<{ label: string; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { setFoodPreferences } = useOnboarding();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const fromSettings = (route.params as any)?.fromSettings === true;

  useEffect(() => {
    if (isDemoMode) {
      setFoods(DEMO_FOOD_PREFERENCES);
      setLoading(false);
      return;
    }

    const fetchFoods = async () => {
      setLoading(true);
      try {
        const result = await getStaticFoodPreferences();
        setFoods(result);
      } catch {
        setFoods([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFoods();

    async function loadSaved() {
      const uid = getAuth().currentUser?.uid;
      // Try user profile cache first (has latest data)
      if (uid) {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const cachedProfile = await AsyncStorage.getItem(`userProfile_${uid}`);
        if (cachedProfile) {
          const profile = JSON.parse(cachedProfile);
          if (Array.isArray(profile.foodPreferences) && profile.foodPreferences.length > 0) {
            setSelected(profile.foodPreferences);
            return;
          }
        }
      }
      const saved = await getOnboardingStepData('food');
      if (saved && Array.isArray(saved)) setSelected(saved);
    }
    loadSaved();
  }, [isDemoMode]);

  const filtered = foods.filter(p =>
    p.label.toLowerCase().includes(search.toLowerCase())
  );

  function togglePref(label: string) {
    setSelected(s => s.includes(label) ? s.filter(l => l !== label) : [...s, label]);
  }

  return (
    <View style={[styles.container, { position: 'relative' }]}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backArrow}
            onPress={() => fromSettings ? navigation.goBack() : navigation.navigate('TravelPreferences')}
            hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#222" />
          </TouchableOpacity>
          {/* Progress bar only during onboarding */}
          {!fromSettings && (
            <View style={styles.progressBarAbsoluteContainer}>
              <View style={styles.progressBarWrapper}>
                <View style={styles.progressBarBg} />
                <View style={styles.progressBarFill} />
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>
          Food preferences
        </Text>
        <Text style={styles.subheading}>
          {fromSettings
            ? 'Update your food preferences to get better recommendations.'
            : "Tell us your food preferences, and we'll tailor recommendations to your taste. You can always change it later in the settings."}
        </Text>
        <View style={styles.searchBox}>
          <Search size={18} color="#bdbdbd" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food preferences"
            placeholderTextColor="#bdbdbd"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#7c5cff" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.prefsGrid}>
            {filtered.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={[styles.prefButton, selected.includes(p.label) && styles.prefButtonSelected]}
                onPress={() => togglePref(p.label)}
                activeOpacity={0.75}
              >
                <Text style={[styles.prefText, selected.includes(p.label) && styles.prefTextSelected]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={async () => {
            setFoodPreferences(selected);

            if (fromSettings) {
              await updateFoodPreferences(selected);
              navigation.goBack();
              return;
            }

            if (isDemoMode) {
              navigation.navigate('UserInfoSignUp');
              return;
            }

            await saveOnboardingStep('food', selected);
            const uid = getAuth().currentUser?.uid;
            const onboardingComplete = uid ? await isOnboardingComplete(uid) : false;
            if (onboardingComplete) {
              await updateFoodPreferences(selected);
              navigation.navigate('Index');
            } else {
              navigation.navigate('UserInfoSignUp');
            }
          }}
        >
          <Text style={styles.continueButtonText}>
            {fromSettings ? 'Save' : (selected.length < 1 ? 'Skip' : 'Continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
