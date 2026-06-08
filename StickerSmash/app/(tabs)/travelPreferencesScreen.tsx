import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/_layout';
import { Ionicons } from '@expo/vector-icons';
import {
  Coffee, Zap, Map, Star, Leaf, Building2, Landmark, Mountain,
  UtensilsCrossed, Utensils, Moon, Music2, Waves, ClipboardList,
  Backpack, Sparkles, Car, Footprints,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { saveOnboardingStep } from '@/utils/onboardingStorage';
import { isOnboardingComplete } from '@/utils/isOnboardingComplete';
import { getAuth } from '@react-native-firebase/auth';
import { useDemo } from '@/context/DemoContext';
import { updateTasteProfile } from '@/utils/updateTasteProfile';
import { getUserProfile } from '@/utils/getUserProfile';
import type { TasteProfile } from '@/types/itinerary';

type RouteParams = RouteProp<RootStackParamList, 'TravelPreferences'>;

const { width, height } = Dimensions.get('window');

interface SwipeCard {
  question: string;
  optionA: { headline: string; bullets: string[]; icon: LucideIcon; color: string };
  optionB: { headline: string; bullets: string[]; icon: LucideIcon; color: string };
  dimensionsA: Partial<TasteProfile>;
  dimensionsB: Partial<TasteProfile>;
}

const CARDS: SwipeCard[] = [
  {
    question: 'Which trip feels more like you?',
    optionA: {
      headline: 'Slow & Cozy',
      bullets: ['Hidden cafes', 'Lazy mornings', 'Scenic strolls', 'No rush'],
      icon: Coffee,
      color: '#FFF8F0',
    },
    optionB: {
      headline: 'Full & Packed',
      bullets: ['Famous highlights', 'Packed schedule', 'See everything', 'Every minute counts'],
      icon: Zap,
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
      icon: Map,
      color: '#F0FFF4',
    },
    optionB: {
      headline: 'Classic Picks',
      bullets: ['Iconic attractions', 'Top-rated spots', 'Famous sights', 'Tried & true'],
      icon: Star,
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
      icon: Leaf,
      color: '#F0FFF4',
    },
    optionB: {
      headline: 'In the City',
      bullets: ['Urban culture', 'City streets', 'Architecture', 'The buzz of a city'],
      icon: Building2,
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
      icon: Landmark,
      color: '#FFF8F0',
    },
    optionB: {
      headline: 'Outdoor Adventure',
      bullets: ['Hiking', 'Physical challenges', 'Outdoor sports', 'Heart-pumping activities'],
      icon: Mountain,
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
      icon: UtensilsCrossed,
      color: '#F5F5F5',
    },
    optionB: {
      headline: 'Food First',
      bullets: ['Every meal matters', 'Local specialties', 'Restaurant hunting', 'Food is the trip'],
      icon: Utensils,
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
      icon: Moon,
      color: '#F0F4FF',
    },
    optionB: {
      headline: 'Out All Night',
      bullets: ['Bars & live music', 'Evening scene', 'Meet locals', 'Night is young'],
      icon: Music2,
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
      icon: Waves,
      color: '#F0F8FF',
    },
    optionB: {
      headline: 'Plan Everything',
      bullets: ['Detailed itinerary', 'Know what\'s next', 'Booked in advance', 'No surprises'],
      icon: ClipboardList,
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
      icon: Backpack,
      color: '#FFF8F0',
    },
    optionB: {
      headline: 'Comfort & Style',
      bullets: ['Nice hotels', 'Fine dining', 'Spa & wellness', 'Premium experiences'],
      icon: Sparkles,
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
      icon: Car,
      color: '#F0F4FF',
    },
    optionB: {
      headline: 'Walk Everywhere',
      bullets: ['Explore on foot', 'Stumble upon things', 'Happy to walk miles', 'Best way to see a city'],
      icon: Footprints,
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
  const [loaded, setLoaded] = useState(!fromSettings);
  const [showSummary, setShowSummary] = useState(false);
  const [existingProfile, setExistingProfile] = useState<TasteProfile | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fromSettings) return;
    async function loadExisting() {
      const uid = getAuth().currentUser?.uid;
      if (!uid) { setLoaded(true); return; }
      try {
        const profile = await getUserProfile(uid);
        if ((profile as any)?.tasteProfile) {
          const tp = (profile as any).tasteProfile as TasteProfile;
          setScores(tp);
          setExistingProfile(tp);
          setShowSummary(true);
        }
      } catch {}
      setLoaded(true);
    }
    loadExisting();
  }, [fromSettings]);

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

  if (!loaded) return null;

  if (showSummary && existingProfile) {
    return (
      <TravelStyleSummary
        profile={existingProfile}
        onLooksGood={() => navigation.goBack()}
        onUpdate={() => setShowSummary(false)}
        onBack={() => navigation.goBack()}
      />
    );
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
            <Text style={styles.skipText}>{fromSettings ? 'Keep' : 'Skip'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Animated.View style={[styles.cardArea, { opacity: fadeAnim }]}>
        <Text style={styles.stepLabel}>
          {fromSettings ? 'Update' : 'Question'} {cardIndex + 1} of {CARDS.length}
        </Text>
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

function derivePersonalityLabel(p: TasteProfile): string {
  const pace = p.pace < 0.4 ? 'Relaxed' : p.pace > 0.6 ? 'Fast-paced' : null;
  const discovery = p.hiddenGems > 0.6 ? 'Explorer' : p.hiddenGems < 0.4 ? 'Sightseer' : 'Traveler';
  return [pace, discovery].filter(Boolean).join(' ');
}

function deriveTags(p: TasteProfile): { icon: LucideIcon; label: string }[] {
  const tags: { icon: LucideIcon; label: string }[] = [];
  if (p.foodie > 0.6) tags.push({ icon: Utensils, label: 'Foodie' });
  if (p.nightlife > 0.6) tags.push({ icon: Music2, label: 'Night Owl' });
  if (p.nature > 0.6) tags.push({ icon: Leaf, label: 'Nature Lover' });
  if (p.adventure > 0.6) tags.push({ icon: Mountain, label: 'Adventurer' });
  if (p.luxury > 0.6) tags.push({ icon: Sparkles, label: 'Comfort Seeker' });
  if (p.walkingTolerance > 0.6) tags.push({ icon: Footprints, label: 'Walker' });
  if (p.structurePreference > 0.6) tags.push({ icon: ClipboardList, label: 'Planner' });
  return tags;
}

const SUMMARY_DIMS = [
  { label: 'Pace', key: 'pace' as keyof TasteProfile, low: 'Relaxed', high: 'Packed' },
  { label: 'Discovery', key: 'hiddenGems' as keyof TasteProfile, low: 'Famous Spots', high: 'Hidden Gems' },
  { label: 'Food', key: 'foodie' as keyof TasteProfile, low: 'Just Fuel', high: 'Food First' },
  { label: 'Nature', key: 'nature' as keyof TasteProfile, low: 'Urban', high: 'Nature' },
  { label: 'Evenings', key: 'nightlife' as keyof TasteProfile, low: 'Early Nights', high: 'Night Out' },
  { label: 'Comfort', key: 'luxury' as keyof TasteProfile, low: 'Budget', high: 'Premium' },
];

function TravelStyleSummary({
  profile,
  onLooksGood,
  onUpdate,
  onBack,
}: {
  profile: TasteProfile;
  onLooksGood: () => void;
  onUpdate: () => void;
  onBack: () => void;
}) {
  const label = derivePersonalityLabel(profile);
  const tags = deriveTags(profile);

  return (
    <View style={summaryStyles.container}>
      <SafeAreaView style={summaryStyles.safeTop}>
        <View style={summaryStyles.topBar}>
          <TouchableOpacity
            style={summaryStyles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color="#222" />
          </TouchableOpacity>
          <Text style={summaryStyles.topTitle}>Travel Style</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={summaryStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <View style={summaryStyles.headerCard}>
          <View style={summaryStyles.completeBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#6A62B7" />
            <Text style={summaryStyles.completeBadgeText}>Profile saved</Text>
          </View>
          <Text style={summaryStyles.personalityLabel}>{label}</Text>
          {tags.length > 0 && (
            <View style={summaryStyles.tagsRow}>
              {tags.map(t => {
                const TagIcon = t.icon;
                return (
                  <View key={t.label} style={summaryStyles.tag}>
                    <TagIcon size={12} color="#6A62B7" />
                    <Text style={summaryStyles.tagText}>{t.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Dimension bars */}
        <View style={summaryStyles.barsCard}>
          <Text style={summaryStyles.barsTitle}>Your preferences</Text>
          {SUMMARY_DIMS.map(dim => {
            const value = profile[dim.key] as number;
            return (
              <View key={dim.label} style={summaryStyles.dimRow}>
                <Text style={summaryStyles.dimLabel}>{dim.label}</Text>
                <View style={summaryStyles.barTrack}>
                  <View style={[summaryStyles.barFill, { width: `${value * 100}%` }]} />
                  <View
                    style={[
                      summaryStyles.barThumb,
                      { left: `${value * 100}%` as any },
                    ]}
                  />
                </View>
                <Text style={summaryStyles.dimDescriptor}>
                  {value < 0.4 ? dim.low : value > 0.6 ? dim.high : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Actions */}
      <SafeAreaView style={summaryStyles.actions}>
        <TouchableOpacity style={summaryStyles.looksGoodBtn} onPress={onLooksGood} activeOpacity={0.85}>
          <Text style={summaryStyles.looksGoodText}>Looks good</Text>
        </TouchableOpacity>
        <TouchableOpacity style={summaryStyles.updateBtn} onPress={onUpdate} activeOpacity={0.7}>
          <Text style={summaryStyles.updateText}>Update my answers</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f8ff',
  },
  safeTop: {
    backgroundColor: '#f9f8ff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 17,
    fontFamily: 'Merriweather_24pt-Bold',
    color: '#1a1a1a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'flex-start',
    shadowColor: '#6A62B7',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0eeff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  completeBadgeText: {
    fontSize: 13,
    color: '#6A62B7',
    fontFamily: 'SourceSans3-Regular',
  },
  personalityLabel: {
    fontSize: 26,
    fontFamily: 'Merriweather_36pt-Bold',
    color: '#1a1a1a',
    marginBottom: 14,
    lineHeight: 34,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f4f2ff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tagText: {
    fontSize: 13,
    color: '#6A62B7',
    fontFamily: 'SourceSans3-Regular',
  },
  barsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  barsTitle: {
    fontSize: 13,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dimLabel: {
    width: 72,
    fontSize: 14,
    color: '#444',
    fontFamily: 'SourceSans3-Regular',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#eeedf9',
    borderRadius: 4,
    position: 'relative',
    overflow: 'visible',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 8,
    backgroundColor: '#6A62B7',
    borderRadius: 4,
  },
  barThumb: {
    position: 'absolute',
    top: -4,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6A62B7',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#6A62B7',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dimDescriptor: {
    width: 80,
    fontSize: 12,
    color: '#888',
    fontFamily: 'SourceSans3-Regular',
    textAlign: 'right',
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 12,
    gap: 8,
    backgroundColor: '#f9f8ff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  looksGoodBtn: {
    backgroundColor: '#6A62B7',
    borderRadius: 32,
    paddingVertical: 15,
    paddingHorizontal: 56,
    alignItems: 'center',
  },
  looksGoodText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Merriweather_24pt-Bold',
  },
  updateBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  updateText: {
    color: '#6A62B7',
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
  },
});

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
  const PanelIcon = option.icon;
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
      <View style={styles.panelIconWrapper}>
        <PanelIcon size={32} color={chosen ? '#6A62B7' : '#444'} />
      </View>
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
  panelIconWrapper: {
    marginBottom: 12,
  },
  panelHeadline: {
    fontSize: 17,
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
