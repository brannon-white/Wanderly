import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/_layout';
import { Ionicons } from '@expo/vector-icons';
import { saveOnboardingStep } from '@/utils/onboardingStorage';
import { isOnboardingComplete } from '@/utils/isOnboardingComplete';
import { getAuth } from '@react-native-firebase/auth';
import { useDemo } from '@/context/DemoContext';
import { updateTasteProfile } from '@/utils/updateTasteProfile';
import type { TasteProfile } from '@/types/itinerary';

type RouteParams = RouteProp<RootStackParamList, 'TravelPreferences'>;

const { width, height } = Dimensions.get('window');

interface SwipeCard {
  question: string;
  optionA: { headline: string; bullets: string[]; emoji: string; color: string };
  optionB: { headline: string; bullets: string[]; emoji: string; color: string };
  dimensionsA: Partial<TasteProfile>;
  dimensionsB: Partial<TasteProfile>;
}

const CARDS: SwipeCard[] = [
  {
    question: 'Which trip feels more like you?',
    optionA: {
      headline: 'Slow & Cozy',
      bullets: ['Hidden cafes', 'Lazy mornings', 'Scenic strolls', 'No rush'],
      emoji: '☕',
      color: '#FFF8F0',
    },
    optionB: {
      headline: 'Full & Packed',
      bullets: ['Famous highlights', 'Packed schedule', 'See everything', 'Every minute counts'],
      emoji: '⚡',
      color: '#F0F4FF',
    },
    dimensionsA: { pace: 0.2 },
    dimensionsB: { pace: 0.8 },
  },
  {
    question: 'How do you like to explore?',
    optionA: {
      headline: 'Off the Grid',
      bullets: ['Locals-only spots', 'Hidden streets', 'Unexpected finds', 'No tourist traps'],
      emoji: '🗺️',
      color: '#F0FFF4',
    },
    optionB: {
      headline: 'Classic Picks',
      bullets: ['Iconic attractions', 'Top-rated spots', 'Famous sights', 'Tried & true'],
      emoji: '⭐',
      color: '#FFFBF0',
    },
    dimensionsA: { hiddenGems: 0.8, touristTolerance: 0.2 },
    dimensionsB: { hiddenGems: 0.2, touristTolerance: 0.8 },
  },
  {
    question: 'Where do you feel most alive?',
    optionA: {
      headline: 'In Nature',
      bullets: ['Forests & mountains', 'Scenic viewpoints', 'Fresh air', 'Wide open spaces'],
      emoji: '🌿',
      color: '#F0FFF4',
    },
    optionB: {
      headline: 'In the City',
      bullets: ['Urban culture', 'City streets', 'Architecture', 'The buzz of a city'],
      emoji: '🏙️',
      color: '#F0F4FF',
    },
    dimensionsA: { nature: 0.8 },
    dimensionsB: { nature: 0.2 },
  },
  {
    question: 'What gets you most excited?',
    optionA: {
      headline: 'Culture & Food',
      bullets: ['Museums', 'Local cuisine', 'Art & history', 'Slow experiences'],
      emoji: '🏛️',
      color: '#FFF8F0',
    },
    optionB: {
      headline: 'Outdoor Adventure',
      bullets: ['Hiking', 'Physical challenges', 'Outdoor sports', 'Heart-pumping activities'],
      emoji: '🏔️',
      color: '#F0FFF4',
    },
    dimensionsA: { adventure: 0.2 },
    dimensionsB: { adventure: 0.8 },
  },
  {
    question: 'How important is food to you while traveling?',
    optionA: {
      headline: 'Just Fuel',
      bullets: ['Eat to keep going', 'Quick & easy', 'Food is not the focus', 'Grab and go'],
      emoji: '🥙',
      color: '#F5F5F5',
    },
    optionB: {
      headline: 'Food First',
      bullets: ['Every meal matters', 'Local specialties', 'Restaurant hunting', 'Food is the trip'],
      emoji: '🍜',
      color: '#FFF0F3',
    },
    dimensionsA: { foodie: 0.2 },
    dimensionsB: { foodie: 0.8 },
  },
  {
    question: 'What does your ideal evening look like?',
    optionA: {
      headline: 'Early Nights',
      bullets: ['Rest up for tomorrow', 'Quiet dinners', 'Back at the hotel', 'Recharge mode'],
      emoji: '🌙',
      color: '#F0F4FF',
    },
    optionB: {
      headline: 'Out All Night',
      bullets: ['Bars & live music', 'Evening scene', 'Meet locals', 'Night is young'],
      emoji: '🎶',
      color: '#FFF0F3',
    },
    dimensionsA: { nightlife: 0.2 },
    dimensionsB: { nightlife: 0.8 },
  },
  {
    question: 'How do you prefer to plan your days?',
    optionA: {
      headline: 'Go With the Flow',
      bullets: ['Open schedule', 'Follow your mood', 'Spontaneous detours', 'No plan needed'],
      emoji: '🌊',
      color: '#F0F8FF',
    },
    optionB: {
      headline: 'Plan Everything',
      bullets: ['Detailed itinerary', 'Know what\'s next', 'Booked in advance', 'No surprises'],
      emoji: '📋',
      color: '#F5F0FF',
    },
    dimensionsA: { structurePreference: 0.2 },
    dimensionsB: { structurePreference: 0.8 },
  },
  {
    question: 'What kind of experiences do you prefer?',
    optionA: {
      headline: 'Budget & Local',
      bullets: ['Street food', 'Hostels & guesthouses', 'Local markets', 'Authentic & affordable'],
      emoji: '🎒',
      color: '#FFF8F0',
    },
    optionB: {
      headline: 'Comfort & Style',
      bullets: ['Nice hotels', 'Fine dining', 'Spa & wellness', 'Premium experiences'],
      emoji: '✨',
      color: '#F5F0FF',
    },
    dimensionsA: { luxury: 0.2 },
    dimensionsB: { luxury: 0.8 },
  },
  {
    question: 'How do you feel about walking?',
    optionA: {
      headline: 'Minimize It',
      bullets: ['Prefer transit', 'Taxis & rideshares', 'Save my energy', 'Less walking = better'],
      emoji: '🚕',
      color: '#F0F4FF',
    },
    optionB: {
      headline: 'Walk Everywhere',
      bullets: ['Explore on foot', 'Stumble upon things', 'Happy to walk miles', 'Best way to see a city'],
      emoji: '👟',
      color: '#F0FFF4',
    },
    dimensionsA: { walkingTolerance: 0.2 },
    dimensionsB: { walkingTolerance: 0.8 },
  },
];

const NEUTRAL: TasteProfile = {
  pace: 0.5,
  foodie: 0.5,
  nature: 0.5,
  nightlife: 0.5,
  hiddenGems: 0.5,
  touristTolerance: 0.5,
  walkingTolerance: 0.5,
  structurePreference: 0.5,
  adventure: 0.5,
  luxury: 0.5,
};

export default function TravelPreferencesScreen() {
  const { isDemoMode } = useDemo();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const fromSettings = (route.params as any)?.fromSettings === true;

  const [cardIndex, setCardIndex] = useState(0);
  const [scores, setScores] = useState<TasteProfile>({ ...NEUTRAL });
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const card = CARDS[cardIndex];
  const isLast = cardIndex === CARDS.length - 1;
  const progress = (cardIndex + 1) / CARDS.length;

  function applyDimensions(dims: Partial<TasteProfile>) {
    setScores(prev => ({ ...prev, ...dims }));
  }

  function handleSelect(choice: 'A' | 'B') {
    if (selected) return;
    setSelected(choice);
    const dims = choice === 'A' ? card.dimensionsA : card.dimensionsB;
    applyDimensions(dims);

    setTimeout(() => {
      if (isLast) {
        finishOnboarding(choice === 'A' ? card.dimensionsA : card.dimensionsB);
      } else {
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => {
          setSelected(null);
          setCardIndex(i => i + 1);
        });
      }
    }, 350);
  }

  function handleSkip() {
    if (isLast) {
      finishOnboarding({});
    } else {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start(() => {
        setSelected(null);
        setCardIndex(i => i + 1);
      });
    }
  }

  async function finishOnboarding(lastDims: Partial<TasteProfile>) {
    const finalProfile: TasteProfile = { ...scores, ...lastDims };

    if (isDemoMode) {
      navigation.navigate('FoodPreferences');
      return;
    }

    await saveOnboardingStep('travel', finalProfile);

    if (fromSettings) {
      await updateTasteProfile(finalProfile);
      navigation.goBack();
      return;
    }

    const uid = getAuth().currentUser?.uid;
    const onboardingComplete = uid ? await isOnboardingComplete(uid) : false;
    if (onboardingComplete) {
      await updateTasteProfile(finalProfile);
      navigation.navigate('Index');
    } else {
      navigation.navigate('FoodPreferences');
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeTop}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color="#222" />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressBg} />
            <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Animated.View style={[styles.cardArea, { opacity: fadeAnim }]}>
        <Text style={styles.stepLabel}>{cardIndex + 1} of {CARDS.length}</Text>
        <Text style={styles.question}>{card.question}</Text>

        <View style={styles.optionsRow}>
          <OptionPanel
            option={card.optionA}
            onPress={() => handleSelect('A')}
            chosen={selected === 'A'}
            dimmed={selected === 'B'}
          />
          <OptionPanel
            option={card.optionB}
            onPress={() => handleSelect('B')}
            chosen={selected === 'B'}
            dimmed={selected === 'A'}
          />
        </View>
      </Animated.View>

      <View style={styles.dotsRow}>
        {CARDS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === cardIndex && styles.dotActive, i < cardIndex && styles.dotDone]}
          />
        ))}
      </View>
    </View>
  );
}

function OptionPanel({
  option,
  onPress,
  chosen,
  dimmed,
}: {
  option: SwipeCard['optionA'];
  onPress: () => void;
  chosen: boolean;
  dimmed: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.panel,
        { backgroundColor: option.color },
        chosen && styles.panelChosen,
        dimmed && styles.panelDimmed,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.panelEmoji}>{option.emoji}</Text>
      <Text style={[styles.panelHeadline, chosen && styles.panelHeadlineChosen]}>
        {option.headline}
      </Text>
      <View style={styles.bulletList}>
        {option.bullets.map((b, i) => (
          <Text key={i} style={[styles.bullet, chosen && styles.bulletChosen]}>
            · {b}
          </Text>
        ))}
      </View>
      {chosen && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={18} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeTop: {
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    padding: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  progressContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  progressBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eaeaea',
    borderRadius: 4,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6A62B7',
  },
  skipText: {
    fontSize: 15,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  stepLabel: {
    fontSize: 13,
    color: '#bbb',
    fontFamily: 'SourceSans3-Regular',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  question: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Merriweather_36pt-Bold',
    color: '#1a1a1a',
    marginBottom: 24,
    lineHeight: 32,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  panel: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'flex-start',
    position: 'relative',
    minHeight: height * 0.42,
  },
  panelChosen: {
    borderColor: '#6A62B7',
    shadowColor: '#6A62B7',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  panelDimmed: {
    opacity: 0.45,
  },
  panelEmoji: {
    fontSize: 36,
    marginBottom: 12,
  },
  panelHeadline: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Merriweather_36pt-Bold',
    color: '#1a1a1a',
    marginBottom: 10,
    lineHeight: 22,
  },
  panelHeadlineChosen: {
    color: '#6A62B7',
  },
  bulletList: {
    gap: 5,
  },
  bullet: {
    fontSize: 13.5,
    color: '#666',
    fontFamily: 'SourceSans3-Regular',
    lineHeight: 19,
  },
  bulletChosen: {
    color: '#444',
  },
  checkBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6A62B7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 32,
    paddingTop: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ddd',
  },
  dotActive: {
    backgroundColor: '#6A62B7',
    width: 20,
  },
  dotDone: {
    backgroundColor: '#b8b2e8',
  },
});
