import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { styles } from '@/styles/travelPreferencesStyles';
import firestore from '@react-native-firebase/firestore';
import { useOnboarding } from '@/context/OnboardingContext';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { saveOnboardingStep, getOnboardingStepData } from '@/utils/onboardingStorage';
import { Ionicons } from '@expo/vector-icons';

export default function FoodPreferencesScreen() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [foods, setFoods] = useState<{ label: string; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { setFoodPreferences } = useOnboarding();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const fetchFoods = async () => {
      try {
        const doc = await firestore().collection('staticFoodPreferences').doc('all').get();
        const data = doc.data();
        if (data && Array.isArray(data.foods)) {
          setFoods(data.foods);
        } else {
          setFoods([]);
        }
      } catch (error) {
        console.error('Error fetching foods:', error);
        setFoods([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFoods();

    async function loadSaved() {
      const saved = await getOnboardingStepData('food');
      if (saved && Array.isArray(saved)) setSelected(saved);
    }
    loadSaved();
  }, []);

  const filtered = foods.filter(p =>
    p.label.toLowerCase().includes(search.toLowerCase())
  );

  function togglePref(label: string) {
    setSelected(s =>
      s.includes(label) ? s.filter(l => l !== label) : [...s, label]
    );
  }

  return (
    <View style={[styles.container, { position: 'relative' }]}>
      <SafeAreaView>
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 16 }}>
    {/* Back Arrow */}
    <TouchableOpacity
      style={{
        padding: 8,
        marginRight: 8,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderRadius: 20,
      }}
      onPress={() => navigation.navigate('TravelPreferences')}
      hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
    >
      <Ionicons name="chevron-back" size={28} color="#222" />
    </TouchableOpacity>
    {/* Progress Bar */}
    <View style={{ flex: 1 }}>
      <View style={styles.progressBarWrapper}>
        <View style={styles.progressBarBg} />
        <View style={styles.progressBarFill} />
      </View>
    </View>
  </View>
</SafeAreaView>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>
          Food preferences <Text style={styles.headingEmoji}>🍽️</Text>
        </Text>
        <Text style={styles.subheading}>
          Tell us your food preferences, and we'll tailor recommendations to your taste. You can always change it later in the settings.
        </Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}>
                      <Text style={styles.prefText}>{p.label}</Text>
                      <Text style={styles.prefEmoji}>{p.emoji}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            
          ]}
          onPress={async () => {
            setFoodPreferences(selected);
            await saveOnboardingStep('food', selected);
            navigation.navigate('UserInfoSignUp');
          }}
          disabled={false}
        >
          <Text style={styles.continueButtonText}>
            {selected.length < 1 ? 'Skip' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}