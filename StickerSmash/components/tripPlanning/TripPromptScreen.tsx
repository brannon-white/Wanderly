import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, PRIMARY, PRIMARY_LIGHT, BORDER_COLOR, TEXT_DARK, TEXT_GRAY } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';

type NavProp = StackNavigationProp<RootStackParamList>;

const EXAMPLE_PROMPTS = [
  'A cozy road trip with coffee shops and small towns',
  'Fast-paced city break with great food and nightlife',
  'Relaxing escape with nature and slow mornings',
  'Adventure trip with hiking and outdoor activities',
];

const MAX_CHARS = 300;

export default function TripPromptScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { setTripPrompt } = useTripPlanning();
  const [text, setText] = useState('');

  function handleContinue() {
    setTripPrompt(text.trim());
    navigation.navigate('TripInterests');
  }

  function handleSkip() {
    setTripPrompt('');
    navigation.navigate('TripInterests');
  }

  return (
    <KeyboardAvoidingView
      style={shared.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[shared.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={shared.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: '50%' }]} />
        </View>
        <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[shared.scrollContent, { paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={shared.heading}>Describe your{'\n'}ideal trip</Text>
        <Text style={shared.subheading}>
          Tell us the vibe — we'll use it to shape your itinerary. No need to be specific.
        </Text>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. A cozy Oregon road trip with coffee shops, forests, and small towns…"
            placeholderTextColor="#bbb"
            multiline
            value={text}
            onChangeText={t => setText(t.slice(0, MAX_CHARS))}
            textAlignVertical="top"
            autoFocus={false}
          />
          <Text style={styles.charCount}>{text.length}/{MAX_CHARS}</Text>
        </View>

        <Text style={styles.examplesLabel}>Quick starts</Text>
        <View style={styles.chipsRow}>
          {EXAMPLE_PROMPTS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, text === p && styles.chipSelected]}
              onPress={() => setText(p)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, text === p && styles.chipTextSelected]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={shared.continueBtn}
          onPress={handleContinue}
        >
          <Text style={shared.continueBtnText}>
            {text.trim() ? 'Continue' : 'Skip'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  skipText: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fafafa',
    marginBottom: 24,
    minHeight: 140,
  },
  textInput: {
    fontSize: 16,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-Regular',
    lineHeight: 24,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#ccc',
    fontFamily: 'SourceSans3-Regular',
    textAlign: 'right',
    marginTop: 8,
  },
  examplesLabel: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  chipsRow: {
    gap: 10,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  chipSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY_LIGHT,
  },
  chipText: {
    fontSize: 14,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-Regular',
  },
  chipTextSelected: {
    color: PRIMARY,
    fontWeight: '600',
  },
});
