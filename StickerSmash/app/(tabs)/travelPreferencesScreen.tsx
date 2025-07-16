import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity,SafeAreaView } from 'react-native';
import { styles } from '@/styles/travelPreferencesStyles';

const preferences = [
  { label: 'Adventure Travel', emoji: '🏞️' },
  { label: 'City Breaks', emoji: '🏙️' },
  { label: 'Cultural Exploration', emoji: '🏛️' },
  { label: 'Glamping', emoji: '⛺' },
  { label: 'Beach Vacations', emoji: '🏖️' },
  { label: 'Nature Escapes', emoji: '🌿' },
  { label: 'Relaxing Getaways', emoji: '🏨' },
  { label: 'Road Trips', emoji: '🚗' },
  { label: 'Food Tourism', emoji: '🍔' },
  { label: 'Backpacking', emoji: '🎒' },
  { label: 'Cruise Vacations', emoji: '🛳️' },
  { label: 'Staycations', emoji: '🏡' },
  { label: 'Skiing/Snowboarding', emoji: '🎿' },
  { label: 'Wine Tours', emoji: '🍷' },
  { label: 'Wildlife Safaris', emoji: '🦁' },
  { label: 'Art Galleries', emoji: '🎨' },
  { label: 'Historical Sites', emoji: '🏰' },
  { label: 'Eco-Tourism', emoji: '🌱' },
  { label: 'Music Festivals', emoji: '🎵' },
  { label: 'Culinary Tours', emoji: '🍴' },
];

export default function TravelPreferencesScreen() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = preferences.filter(p =>
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
        <TouchableOpacity
          style={styles.continueButton}
          disabled={selected.length < 5}
        >
          <Text style={styles.continueButtonText}>
            Continue ({selected.length}/5)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}