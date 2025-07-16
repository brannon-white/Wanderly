import React, { useState,useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity,SafeAreaView } from 'react-native';
import { styles } from '@/styles/travelPreferencesStyles';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useOnboarding } from '@/context/OnboardingContext';

export default function TravelPreferencesScreen() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [activities, setActivities] = useState<{ label: string; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const { setActivityPreferences } = useOnboarding();

    useEffect(() => {
    const fetchActivities = async () => {
      try {
        const doc = await firestore().collection('staticActivities').doc('all').get();
        const data = doc.data();
        if (data && Array.isArray(data.activities)) {
          setActivities(data.activities);
        } else {
          setActivities([]);
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
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
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarBg} />
          <View style={styles.progressBarFill} />
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
            // Add playful stagger
            colIdx === 1 ? { marginTop: rowIdx % 2 === 0 ? 8 : 0 } : {},
          ]}
          onPress={() => togglePref(p.label)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.prefText,
            selected.includes(p.label) && styles.prefTextSelected,
          ]}>
            {p.label} <Text style={styles.prefEmoji}>{p.emoji}</Text>
          </Text>
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
  onPress={() => {
    if (selected.length >= 2) {
      setActivityPreferences(selected);
      (navigation as any).navigate('FoodPreferences', {});
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
