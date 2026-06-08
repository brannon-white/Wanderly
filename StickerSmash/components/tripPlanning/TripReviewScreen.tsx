import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { getAuth } from '@react-native-firebase/auth';
import { PRIMARY, BORDER_COLOR, TEXT_DARK, TEXT_GRAY } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useMyTrips } from '@/context/MyTripsContext';
import { generateItinerary } from '@/services/generateItinerary';
import { requestPermissionAndSaveToken } from '@/services/notifications';
import { getUsageStatus } from '@/services/purchases';
import PaywallModal from '@/components/PaywallModal';
import { logItineraryGenerated } from '@/services/analytics';
import * as StoreReview from 'expo-store-review';
import { getUserProfile } from '@/utils/getUserProfile';

type NavProp = StackNavigationProp<RootStackParamList>;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—';
  const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  return `${fmt(start)} to ${fmt(end)}, ${end.getFullYear()}`;
}

function EditIcon({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="pencil-outline" size={20} color={PRIMARY} />
    </TouchableOpacity>
  );
}

function SectionDivider() {
  return <View style={styles.divider} />;
}

export default function TripReviewScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const {
    editingTripId,
    destinationId,
    destinationSnapshot,
    templateHeroImage,
    party,
    startDate,
    endDate,
    interests,
    budget,
    tripPrompt,
    tripVibes,
    includeActivities,
    avoidActivities,
    foodPreferences,
    tripType,
    travelPace,
    seedItineraryId,
    reset,
  } = useTripPlanning();
  const isEditing = !!editingTripId;

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const userNavigatedAway = React.useRef(false);
  const { addTrip, updateTrip, setPendingGeneration } = useMyTrips();

  const destination = destinationSnapshot ?? { id: destinationId, name: 'Unknown', country: '', flag: '', imageUrl: '' };

  const navigateToMyTrips = (pendingInfo?: { destName: string; heroImage?: string; party: string; startDate: string; endDate: string }) => {
    userNavigatedAway.current = true;
    setShowConfirmation(false);
    if (pendingInfo) setPendingGeneration(pendingInfo);
    reset();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Index', params: { screen: 'MyTrips' } as any }],
    });
  };

  const handleBuild = async () => {
    const currentUser = getAuth().currentUser;

    if (!currentUser) {
      Alert.alert(
        'Sign in required',
        'You need to be signed in to generate and save a real itinerary.'
      );
      return;
    }

    if (!destinationId || !party || !startDate || !endDate || !budget) {
      Alert.alert(
        'Trip details missing',
        'Destination, party, dates, and budget are required before generating an itinerary.'
      );
      return;
    }

    // Check generation quota before starting (backend enforces this too, but checking
    // client-side avoids a wasted full round-trip and shows the paywall earlier)
    const usage = await getUsageStatus().catch(() => null);
    // Allowed if the monthly allotment (free 3 / pro 20) has room OR there are
    // purchased credits to fall back on. Blocks free users out of free trips and
    // Pro users who've hit the monthly cap, unless they hold credits.
    if (usage && usage.generationsLeft <= 0 && usage.credits <= 0) {
      setShowPaywall(true);
      return;
    }

    // Request notification permission so we can alert them when it's ready
    await requestPermissionAndSaveToken().catch(() => {});

    // Load user taste profile to include in generation request
    const uid = currentUser.uid;
    const userProfile = await getUserProfile(uid).catch(() => null);

    // Capture values now — they'll be valid in the closure even after navigation
    const genPayload = {
      destinationId,
      destinationName: destination.state
        ? `${destination.name}, ${destination.state}`
        : destination.name,
      country: destination.country,
      party,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      interests: includeActivities.length > 0 ? [...includeActivities] : [...interests],
      budget,
      tasteProfile: (userProfile as any)?.tasteProfile,
      tripPrompt: tripPrompt || undefined,
      tripVibes: tripVibes.length > 0 ? [...tripVibes] : undefined,
      includeActivities: includeActivities.length > 0 ? [...includeActivities] : undefined,
      avoidActivities: avoidActivities.length > 0 ? [...avoidActivities] : undefined,
      foodPreferences: foodPreferences.length > 0 ? [...foodPreferences] : undefined,
      destinationType: destinationSnapshot?.destinationType ?? 'city',
      tripType: tripType ?? 'hub',
      travelPace: travelPace || undefined,
      seedItineraryId: seedItineraryId || undefined,
    };
    const savedHeroImage = templateHeroImage;
    const savedParty = party;
    const savedStartDate = startDate.toISOString();
    const savedEndDate = endDate.toISOString();
    const savedInterests = [...interests];
    const savedBudget = budget;
    const savedDestName = destination.name;
    const savedCountry = destination.country;

    userNavigatedAway.current = false;
    setShowConfirmation(true);

    try {
      const response = await generateItinerary(genPayload);

      const committedId = `committed-${response.itineraryId}`;
      addTrip({
        id: committedId,
        templateId: response.itineraryId,
        title: response.itinerary.title,
        heroImage: response.itinerary.heroImage || savedHeroImage,
        party: savedParty,
        startDate: savedStartDate,
        endDate: savedEndDate,
        origin: 'generated',
        interests: savedInterests,
        budget: savedBudget,
        destinationName: savedDestName,
        country: savedCountry,
      });
      logItineraryGenerated({
        destinationName: savedDestName,
        days: startDate && endDate ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000) : 0,
        budget: savedBudget,
      });
      StoreReview.isAvailableAsync().then((available) => {
        if (available) StoreReview.requestReview();
      }).catch(() => {});
      setPendingGeneration(null);

      if (!userNavigatedAway.current) {
        reset();
        navigation.reset({
          index: 1,
          routes: [
            { name: 'Index', params: { screen: 'MyTrips' } as any },
            {
              name: 'ItineraryScreen',
              params: { id: response.itineraryId, source: 'mytrips', committedTripId: committedId },
            },
          ],
        });
      }
    } catch (error) {
      console.warn('generateItinerary failed', error);

      if (error instanceof Error && /limit_reached/i.test(error.message)) {
        setPendingGeneration(null);
        if (!userNavigatedAway.current) setShowConfirmation(false);
        setShowPaywall(true);
        return;
      }

      // A network-level failure (request timeout, dropped connection) does NOT
      // mean generation failed: the server keeps running for up to ~9 min and
      // can still finish, after which the "itinerary ready" push fires and
      // ItineraryReadyReconciler commits the trip to My Trips. So don't show a
      // scary "failed" — keep a pending card the push will resolve, and tell the
      // user we'll notify them. (Definitive server errors come back as a parsed
      // error message below and are treated as real failures.)
      const isNetworkError =
        error instanceof Error &&
        /network request failed|timeout|timed out|aborted|network error/i.test(error.message);

      if (isNetworkError) {
        setPendingGeneration({
          destName: savedDestName,
          heroImage: savedHeroImage,
          party: savedParty,
          startDate: savedStartDate,
          endDate: savedEndDate,
          status: 'generating',
        });
        if (!userNavigatedAway.current) {
          setShowConfirmation(false);
          Alert.alert(
            'Still working on it',
            "This itinerary is taking a little longer than usual. We'll notify you the moment it's ready — feel free to keep exploring in the meantime.",
          );
        }
        return;
      }

      const message =
        error instanceof Error && /unauth/i.test(error.message)
          ? 'Your sign-in session was not attached to the request. Sign out, sign in again, and retry.'
          : 'The itinerary could not be generated right now. Please try again.';

      if (userNavigatedAway.current) {
        // User already left for My Trips — surface the failure on the pending
        // banner instead of clearing it silently.
        setPendingGeneration({
          destName: savedDestName,
          heroImage: savedHeroImage,
          party: savedParty,
          startDate: savedStartDate,
          endDate: savedEndDate,
          status: 'failed',
          errorMessage: message,
        });
      } else {
        setPendingGeneration(null);
        setShowConfirmation(false);
        Alert.alert('Generation failed', message);
      }
    }
  };

  const handleSaveChanges = () => {
    if (!editingTripId || !startDate || !endDate) return;

    updateTrip(editingTripId, {
      party,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      interests,
      budget,
    });
    reset();
    navigation.navigate('Index' as any, { screen: 'MyTrips' } as any);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}> 
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="location-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Destination</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('DestinationScreen', { searchedDestination: { id: destination.id, name: destination.name, state: destination.state, country: destination.country, flag: destination.flag, imageUrl: destination.imageUrl, gallery: [], destinationType: destinationSnapshot?.destinationType ?? 'city' } })} />
          </View>
          <View style={styles.destinationContent}>
            <Image source={{ uri: destination.imageUrl }} style={styles.destinationImage} />
            <View>
              <Text style={styles.destinationName}>{destination.name}{destination.state ? `, ${destination.state}` : ''}</Text>
              <View style={styles.countryRow}>
                {destination.flag ? <Text style={styles.flag}>{destination.flag}</Text> : null}
                <Text style={styles.countryText}>{destination.country}</Text>
              </View>
            </View>
          </View>
          {destinationSnapshot?.destinationType === 'region' && (
            <View style={styles.regionHint}>
              <Ionicons name="information-circle-outline" size={14} color="#6A62B7" />
              <Text style={styles.regionHintText}>
                {destination.name} covers a large area. For the best experience, consider a road trip so you can explore multiple cities.
              </Text>
            </View>
          )}
        </View>

        <SectionDivider />

        {tripType === 'route' && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="map-outline" size={18} color={TEXT_GRAY} />
                </View>
                <Text style={styles.sectionLabel}>Travel Style</Text>
                <View style={{ flex: 1 }} />
                <EditIcon onPress={() => navigation.navigate('TripStyle')} />
              </View>
              <Text style={styles.sectionValue}>
                Multi-stop road trip
                {travelPace ? ` · ${travelPace.replace(/_/g, ' ')}` : ''}
              </Text>
            </View>
            <SectionDivider />
          </>
        )}

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="people-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Party</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('TripBasics')} />
          </View>
          <Text style={styles.sectionValue}>{party || '—'}</Text>
        </View>

        <SectionDivider />

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="calendar-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Trip Dates</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('TripDates')} />
          </View>
          <Text style={styles.sectionValue}>{formatDateRange(startDate, endDate)}</Text>
        </View>

        <SectionDivider />

        {tripPrompt ? (
          <>
            <SectionDivider />
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={TEXT_GRAY} />
                </View>
                <Text style={styles.sectionLabel}>Trip Vibe</Text>
                <View style={{ flex: 1 }} />
                <EditIcon onPress={() => navigation.navigate('TripStyle')} />
              </View>
              <Text style={[styles.sectionValue, { fontStyle: 'italic' }]}>"{tripPrompt}"</Text>
            </View>
          </>
        ) : null}

        <SectionDivider />

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="options-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Trip Preferences</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('TripPreferences')} />
          </View>
          {tripVibes.length === 0 && includeActivities.length === 0 && foodPreferences.length === 0 ? (
            <Text style={[styles.sectionValue, { color: TEXT_GRAY }]}>None set</Text>
          ) : (
            <>
              {tripVibes.length > 0 && (
                <>
                  <Text style={styles.prefSubLabel}>Vibes</Text>
                  <View style={styles.pillsRow}>
                    {tripVibes.map(v => (
                      <View key={v} style={[styles.pill, { borderColor: '#22A67A', backgroundColor: '#EDFAF5' }]}>
                        <Text style={[styles.pillText, { color: '#22A67A' }]}>{v}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {includeActivities.length > 0 && (
                <>
                  <Text style={[styles.prefSubLabel, tripVibes.length > 0 && { marginTop: 10 }]}>Activities</Text>
                  <View style={styles.pillsRow}>
                    {includeActivities.map(a => (
                      <View key={a} style={[styles.pill, { borderColor: '#22A67A', backgroundColor: '#EDFAF5' }]}>
                        <Text style={[styles.pillText, { color: '#22A67A' }]}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {foodPreferences.length > 0 && (
                <>
                  <Text style={[styles.prefSubLabel, (tripVibes.length > 0 || includeActivities.length > 0) && { marginTop: 10 }]}>Food</Text>
                  <View style={styles.pillsRow}>
                    {foodPreferences.map(f => (
                      <View key={f} style={[styles.pill, { borderColor: '#22A67A', backgroundColor: '#EDFAF5' }]}>
                        <Text style={[styles.pillText, { color: '#22A67A' }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <SectionDivider />

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="cash-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Budget</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('TripBasics')} />
          </View>
          <Text style={styles.sectionValue}>{budget || '—'}</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}> 
        {isEditing ? (
          <TouchableOpacity style={styles.buildBtn} onPress={handleSaveChanges} activeOpacity={0.85}>
            <Text style={styles.buildBtnText}>Save Changes</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.buildBtn} onPress={handleBuild} activeOpacity={0.85}>
            <Text style={styles.buildBtnText}>Build My Itinerary</Text>
          </TouchableOpacity>
        )}
      </View>

      <PaywallModal
        visible={showPaywall}
        reason="generation"
        onDismiss={() => setShowPaywall(false)}
        onSuccess={() => {
          setShowPaywall(false);
          // Retry generation now that user has upgraded
          handleBuild();
        }}
      />

      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="paper-plane-outline" size={32} color={PRIMARY} />
            </View>
            <Text style={styles.generatingTitle}>Building Your Trip!</Text>
            <Text style={styles.generatingSubtitle}>
              Your personalized itinerary for {destination.name} is on its way.
              We'll send you a notification when it's ready — feel free to explore in the meantime.
            </Text>
            <ActivityIndicator size="small" color={PRIMARY} style={{ marginTop: 20, marginBottom: 8 }} />
            <TouchableOpacity style={styles.continueBtn} onPress={() => navigateToMyTrips({ destName: destination.name, heroImage: templateHeroImage, party, startDate: startDate?.toISOString() ?? '', endDate: endDate?.toISOString() ?? '' })} activeOpacity={0.8}>
              <Text style={styles.continueBtnText}>Continue Exploring</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  regionHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#F0EEFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  regionHintText: {
    flex: 1,
    fontSize: 12,
    color: '#6A62B7',
    lineHeight: 17,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionIcon: {
    width: 28,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
  },
  sectionValue: {
    fontSize: 15,
    fontFamily: 'SourceSans3-Regular',
    color: TEXT_DARK,
    paddingLeft: 36,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
  },
  destinationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 36,
  },
  destinationImage: {
    width: 70,
    height: 56,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  destinationName: {
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
    marginBottom: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flag: {
    fontSize: 14,
  },
  countryText: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
  },
  prefSubLabel: {
    fontSize: 12,
    fontFamily: 'SourceSans3-SemiBold',
    color: TEXT_GRAY,
    paddingLeft: 36,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 36,
  },
  pill: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 13,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-Regular',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  buildBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buildBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Merriweather_24pt-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0eeff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  generatingTitle: {
    fontSize: 18,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  generatingSubtitle: {
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
    color: TEXT_GRAY,
    textAlign: 'center',
    lineHeight: 22,
  },
  continueBtn: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 32,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  continueBtnText: {
    color: PRIMARY,
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
  },
});
