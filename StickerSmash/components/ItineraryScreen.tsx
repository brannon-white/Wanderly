import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Footprints } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles, ICON_COLOR, makeScrollContentStyle } from '../styles/TravelItinerary';
import {
  buildDirectionsUrl,
  partyToAdults,
} from '@/services/bookingService';
import { DEMO_FULL_ITINERARIES } from '@/data/demoData';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useMyTrips, formatTripSubtitle } from '@/context/MyTripsContext';
import type { GeneratedItinerary, ItineraryActivity, ItineraryDay } from '@/types/itinerary';
import { getItineraryDays, updateItineraryDay, isRouteTrip, getStopForDayIndex } from '@/utils/itineraryHelpers';
import { getAuth } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { searchPhoto } from '@/services/unsplash';
import ShareCard from './ShareCard';
import { getUsageStatus } from '@/services/purchases';
import PaywallModal from './PaywallModal';
import ReplaceSuggestionsSheet, { type ActivityAction, type SheetTarget } from './ReplaceSuggestionsSheet';
import ActivityDetailSheet from './ActivityDetailSheet';
import SmartBanner from './SmartBanner';
import DayOptimizeBar from './DayOptimizeBar';
import { editItineraryWithLanguage, getSuggestedReplacements, optimizeDay } from '@/services/regenerateItinerary';
import { analyzeDay, type ActivityInsight } from '@/utils/itineraryInsights';
import ItineraryRefinementBar from './ItineraryRefinementBar';
import { logRegenAttempted } from '@/services/analytics';

let MapsModule:
  | {
      default: React.ComponentType<any>;
      Marker: React.ComponentType<any>;
    }
  | null = null;

try {
  MapsModule = require('react-native-maps');
} catch {
  MapsModule = null;
}

type NavProp = StackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'ItineraryScreen'>;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TRANSPORT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  walk: 'walk-outline',
  car: 'car-outline',
  bicycle: 'bicycle-outline',
  bus: 'bus-outline',
  train: 'train-outline',
  subway: 'train-outline',
  metro: 'train-outline',
  taxi: 'car-outline',
  rideshare: 'car-outline',
  ferry: 'boat-outline',
  boat: 'boat-outline',
};

const TRANSPORT_LABELS: Record<string, string> = {
  walk: 'Walk',
  car: 'Drive',
  taxi: 'Drive',
  rideshare: 'Drive',
  bus: 'Bus',
  train: 'Train',
  subway: 'Subway',
  metro: 'Subway',
  bicycle: 'Bike',
  ferry: 'Ferry',
  boat: 'Ferry',
};

const CAT_COLOR = '#6A62B7';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant-outline',
  restaurant: 'restaurant-outline',
  culture: 'library-outline',
  attraction: 'location-outline',
  landmark: 'location-outline',
  nature: 'leaf-outline',
  shopping: 'bag-handle-outline',
  art: 'color-palette-outline',
  science: 'flask-outline',
  adventure: 'compass-outline',
  hotel: 'bed-outline',
  nightlife: 'wine-outline',
  wellness: 'fitness-outline',
};

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Restaurant',
  restaurant: 'Restaurant',
  culture: 'Culture',
  attraction: 'Attraction',
  landmark: 'Landmark',
  nature: 'Nature',
  shopping: 'Shopping',
  art: 'Art',
  science: 'Museum',
  adventure: 'Adventure',
  hotel: 'Hotel',
  nightlife: 'Nightlife',
  wellness: 'Wellness',
};

function parseDuration(timeStr: string): string {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '';
  const toMin = (h: number, m: number, p: string) => {
    let hrs = h;
    if (p.toUpperCase() === 'PM' && h !== 12) hrs += 12;
    if (p.toUpperCase() === 'AM' && h === 12) hrs = 0;
    return hrs * 60 + m;
  };
  const mins = toMin(+match[4], +match[5], match[6]) - toMin(+match[1], +match[2], match[3]);
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function parseStartTime(timeStr: string): string {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return timeStr.split(' - ')[0] ?? timeStr;
  return `${match[1]}:${match[2]} ${match[3].toUpperCase()}`;
}

function isPlaceholder(url?: string) {
  return !url || url.includes('placeholder.com') || url.includes('via.placeholder');
}


interface ActivityCardProps {
  activity: ItineraryActivity;
  isLast: boolean;
  nextActivity?: ItineraryActivity;
  imageUri?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  isDragging?: boolean;
}

function ActivityCard({ activity, isLast, nextActivity, imageUri, onPress, onLongPress, isDragging }: ActivityCardProps) {
  const transportOptions = Array.isArray(activity.transport) ? activity.transport : [];
  const catKey = (activity.category ?? '').toLowerCase();
  const catIcon = CATEGORY_ICONS[catKey] ?? 'location-outline';
  const startTime = parseStartTime(activity.time);

  const isOutdoorCategory = catKey === 'adventure' || catKey === 'nature';

  // Detect trail by name keywords, but only for outdoor-category activities.
  // Gating on category prevents "Canyon Coffee" (food) from triggering the boot emoji.
  const isTrailByName =
    isOutdoorCategory &&
    /\b(trail|loop|hike|trek|summit|ridge|peak|canyon|gorge|falls|narrows|landing|arch|mesa|butte|slot)\b/i.test(activity.name);

  const difficultyLabel =
    activity.trailDifficulty === 'easy' ? 'Easy' :
    activity.trailDifficulty === 'moderate' ? 'Moderate' :
    activity.trailDifficulty === 'hard' ? 'Hard' : null;

  // Meta line priority:
  // 1. OSM-verified stats — only shown when our orchestration actually matched the trail
  // 2. Trail keyword in name (adventure/nature category) → generic trail label
  // 3. Everything else → Category · ★rating · duration
  let metaLine: string;
  let isTrail = false;
  if (activity.trailDistanceMiles != null) {
    const parts = [`${activity.trailDistanceMiles} mi`];
    if (difficultyLabel) parts.push(difficultyLabel);
    if (activity.trailDurationHours != null) parts.push(`~${activity.trailDurationHours}h`);
    metaLine = parts.join(' · ');
    isTrail = true;
  } else if (isTrailByName) {
    metaLine = 'Trail';
    isTrail = true;
  } else {
    const catLabel = CATEGORY_LABELS[catKey] ?? activity.category ?? '';
    const duration = parseDuration(activity.time);
    const parts: string[] = [];
    if (catLabel) parts.push(catLabel);
    if (typeof activity.rating === 'number') parts.push(`★ ${activity.rating.toFixed(1)}`);
    if (duration) parts.push(duration);
    metaLine = parts.join(' · ');
  }

  const firstTransport = transportOptions[0];
  const transportLabel = firstTransport
    ? `${TRANSPORT_LABELS[firstTransport.mode?.toLowerCase() ?? ''] ?? 'Travel'} · ${firstTransport.time}`
    : null;
  const transportIcon = firstTransport
    ? (TRANSPORT_ICONS[firstTransport.mode?.toLowerCase() ?? ''] ?? 'navigate-outline')
    : null;

  const duration = parseDuration(activity.time);

  const handleTransportPress = firstTransport && nextActivity
    ? () => Linking.openURL(buildDirectionsUrl(
        { name: activity.name, placeId: activity.placeId, coordinates: activity.coordinates },
        { name: nextActivity.name, placeId: nextActivity.placeId, coordinates: nextActivity.coordinates },
        firstTransport.mode ?? 'walk',
      ))
    : undefined;

  return (
    <TouchableOpacity
      style={[styles.activityRow, isDragging && styles.activityRowDragging]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      activeOpacity={0.82}
    >
      {/* Timeline spine */}
      <View style={styles.timelineCol}>
        <View style={styles.timelineIconCircle}>
          <Ionicons name={catIcon} size={15} color={CAT_COLOR} />
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      {/* Card + inline transport connector */}
      <View style={{ flex: 1 }}>
        <View style={styles.compactCard}>
          {/* Cinematic image — falls back to a category-icon placeholder when no URL resolved */}
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.compactImage}
              cachePolicy="memory-disk"
              contentFit="cover"
              transition={250}
            />
          ) : (
            <View style={[styles.compactImage, styles.compactImageFallback]}>
              <View style={styles.compactImageFallbackHalo} />
              <Ionicons name={catIcon} size={44} color="#6A62B7" />
            </View>
          )}

          {/* Text content */}
          <View style={styles.compactBody}>
            <Text style={styles.compactTitle} numberOfLines={2}>{activity.name}</Text>

            <View style={styles.compactMetaRow}>
              {isTrail && <Footprints size={11} color="#aaa" style={{ marginRight: 3 }} />}
              <Text style={styles.compactMeta} numberOfLines={1}>{metaLine}</Text>
            </View>

            <View style={styles.compactTimeRow}>
              <Text style={styles.compactTime}>{startTime}</Text>
              {duration ? <Text style={styles.compactDuration}>· {duration}</Text> : null}
            </View>

            {activity.description ? (
              <Text style={styles.compactDescription} numberOfLines={2}>
                "{activity.description}"
              </Text>
            ) : null}
          </View>
        </View>

        {/* Inline transport connector */}
        {!isLast && transportLabel && (
          <TouchableOpacity
            style={styles.transportConnector}
            onPress={handleTransportPress}
            disabled={!handleTransportPress}
            activeOpacity={handleTransportPress ? 0.6 : 1}
          >
            <View style={styles.transportConnectorLine} />
            {transportIcon && (
              <Ionicons name={transportIcon} size={13} color="#bbb" />
            )}
            <Text style={styles.transportConnectorText}>{transportLabel}</Text>
            {handleTransportPress && (
              <Ionicons name="chevron-forward-outline" size={12} color="#ccc" />
            )}
            <View style={styles.transportConnectorLine} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function normalizePrebuiltItinerary(data: any, docId: string): GeneratedItinerary {
  // Already migrated to stops — return as-is
  if (Array.isArray(data.stops) && data.stops.length > 0) {
    return { ...data, id: docId };
  }
  // Legacy prebuilt format: normalise to a single-stop itinerary
  const days: ItineraryDay[] = Array.isArray(data.days) && data.days.length > 0
    ? data.days
    : (data.template ?? []).map((dayEntry: any, dayIdx: number) => {
        const activities: ItineraryActivity[] = (dayEntry.slots ?? []).map((slot: any, slotIdx: number) => ({
          id: `day-${dayIdx + 1}-slot-${slotIdx + 1}`,
          name: slot.title ?? '',
          description: slot.description,
          category: slot.type,
          time: slot.when ?? '',
          image: '',
          transport: [],
          coordinates: slot.location?.lat != null
            ? { latitude: slot.location.lat, longitude: slot.location.lng }
            : undefined,
        }));
        return { label: `Day ${dayEntry.day ?? dayIdx + 1}`, activities };
      });
  return { ...data, id: docId, days };
}

export default function ItineraryScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const {
    reset,
    setFlow,
    setDestination,
    setSeedItineraryId,
    setTemplateId,
    setTemplateTitle,
    setTemplateHeroImage,
  } = useTripPlanning();
  const { trips, removeTrip } = useMyTrips();

  const { id, source, committedTripId } = route.params ?? {};
  const isBrowsing = source !== 'mytrips';
  const demoItinerary = DEMO_FULL_ITINERARIES.find((it) => it.id === id) ?? null;
  const committedTrip = committedTripId ? trips.find(t => t.id === committedTripId) : undefined;
  const [remoteItinerary, setRemoteItinerary] = useState<GeneratedItinerary | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(!!id && !demoItinerary);
  const [remoteLoadError, setRemoteLoadError] = useState<string | null>(null);
  const [heroUri, setHeroUri] = useState<string | undefined>(undefined);
  const [imagesReady, setImagesReady] = useState(false);
  const itinerary = remoteItinerary ?? demoItinerary;

  const [selectedDay, setSelectedDay] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [activityImages, setActivityImages] = useState<Record<string, string>>({});
  const loadedImageIds = useRef(new Set<string>());
  const imageRetryCount = useRef(0);
  const [imageRetryTick, setImageRetryTick] = useState(0);
  const [showRegenPaywall, setShowRegenPaywall] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const [detailActivity, setDetailActivity] = useState<{ activity: ItineraryActivity; dayIndex: number; activityIndex: number } | null>(null);
  const [preloadedSuggestions, setPreloadedSuggestions] = useState<Record<string, ItineraryActivity[]>>({});
  const [aiBarMessage, setAiBarMessage] = useState('');
  const [aiBarLoading, setAiBarLoading] = useState(false);
  const shareCardRef = useRef<View>(null);
  const [showUpsellSnack, setShowUpsellSnack] = useState(false);
  const snackAnim = useRef(new Animated.Value(0)).current;
  const [showUpgradePaywall, setShowUpgradePaywall] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const allDays = itinerary ? getItineraryDays(itinerary) : [];
  const activities = allDays[selectedDay]?.activities ?? [];
  const MapView = MapsModule?.default;
  const Marker = MapsModule?.Marker;
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRemoteItinerary() {
      if (demoItinerary) {
        setRemoteLoadError(null);
        setLoadingRemote(false);
        return;
      }

      setLoadingRemote(true);

      try {
        // For mytrips source, look in user's saved itineraries (AI-generated)
        if (!isBrowsing) {
          const uid = getAuth().currentUser?.uid;
          if (!uid) {
            if (!cancelled) {
              setRemoteLoadError('Sign in to view your saved itineraries.');
            }
            setLoadingRemote(false);
            return;
          }

          const userSnapshot = await firestore()
            .collection('users')
            .doc(uid)
            .collection('itineraries')
            .doc(id)
            .get();

          if (userSnapshot.exists) {
            const data = userSnapshot.data() as GeneratedItinerary | undefined;
            if (!cancelled && data) {
              setRemoteLoadError(null);
              setRemoteItinerary({ ...data, id: data.id || userSnapshot.id });
            }
            return;
          }
        }

        // For browsing mode (or fallback): check prebuilt itineraries
        const prebuiltSnapshot = await firestore()
          .collection('prebuiltItineraries')
          .doc(id)
          .get();

        if (!prebuiltSnapshot.exists) {
          if (!cancelled) {
            setRemoteItinerary(null);
            setRemoteLoadError(`No itinerary found for id "${id}".`);
          }
          return;
        }

        const data = prebuiltSnapshot.data();
        if (!cancelled && data) {
          setRemoteLoadError(null);
          setRemoteItinerary(normalizePrebuiltItinerary(data, prebuiltSnapshot.id));
        }
      } catch (error) {
        console.error('Failed to load itinerary', error);
        if (!cancelled) {
          setRemoteLoadError(error instanceof Error ? error.message : 'Unknown Firestore read failure.');
        }
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    }

    loadRemoteItinerary();
    return () => { cancelled = true; };
  }, [demoItinerary, id]);

  // Reset image cache when itinerary changes
  useEffect(() => {
    loadedImageIds.current = new Set();
    imageRetryCount.current = 0;
    setActivityImages({});
    setImageRetryTick(0);
    setImagesReady(false);
  }, [itinerary?.id]);

  // Mark images ready once day 0 images are all resolved (server pre-fetches real URLs; this
  // handles the legacy path where placeholder strings still arrive from Firestore).
  useEffect(() => {
    if (!itinerary) return;
    const day0 = getItineraryDays(itinerary)[0]?.activities ?? [];
    if (day0.length === 0) { setImagesReady(true); return; }
    const allHaveRealUrls = day0.every((a) => !isPlaceholder(a.image));
    if (allHaveRealUrls) { setImagesReady(true); return; }
    // Legacy path: wait until activityImages has an entry (or confirmed null) for each day-0 activity
    const allResolved = day0.every((a) => !isPlaceholder(a.image) || activityImages[a.id] !== undefined);
    if (allResolved) setImagesReady(true);
  }, [itinerary?.id, activityImages]);

  // Show a soft upsell snackbar for free users after their first look at a generated itinerary.
  useEffect(() => {
    if (!imagesReady || isBrowsing) return;
    let timer: ReturnType<typeof setTimeout>;
    getUsageStatus().then((usage) => {
      if (usage.isPro) return;
      setShowUpsellSnack(true);
      Animated.timing(snackAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      timer = setTimeout(() => {
        Animated.timing(snackAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
          setShowUpsellSnack(false)
        );
      }, 5000);
    }).catch(() => {});
    return () => clearTimeout(timer);
  }, [imagesReady, isBrowsing]);

  // Load images for the selected day sequentially to avoid Unsplash rate limits.
  // Parallel fire-and-forget hits rate limits; sequential + retry ensures all images load.
  useEffect(() => {
    if (!itinerary) return;
    let cancelled = false;
    const dayActivities = getItineraryDays(itinerary)[selectedDay]?.activities ?? [];
    const currentStop = isRouteTrip(itinerary) ? getStopForDayIndex(itinerary, selectedDay) : null;
    const locationContext = currentStop?.location ?? itinerary.destinationName;

    async function loadSequentially() {
      let anyFailed = false;
      for (const a of dayActivities) {
        if (cancelled) return;
        if (loadedImageIds.current.has(a.id)) continue;
        loadedImageIds.current.add(a.id);

        let url: string | null = null;
        if (isPlaceholder(a.image)) {
          // Strip suffixes like " – Breakfast" / " - Lunch" that hurt Unsplash matches
          const baseName = a.name.split(/\s+[–-]\s+/)[0].trim();
          url = await searchPhoto(baseName);
          if (cancelled) return;
          // Generic fallback: category + location (e.g. "Restaurant Portland, OR")
          if (!url) {
            const catLabel = CATEGORY_LABELS[(a.category ?? '').toLowerCase()] ?? a.category;
            const fallbackQuery = [catLabel, locationContext].filter(Boolean).join(' ').trim();
            if (fallbackQuery) {
              url = await searchPhoto(fallbackQuery);
              if (cancelled) return;
            }
          }
        } else {
          url = a.image;
        }
        if (url) {
          setActivityImages((prev) => ({ ...prev, [a.id]: url }));
        } else {
          // Store empty string as sentinel so the imagesReady gate knows this slot is resolved.
          // The card renders a category-icon placeholder for this state.
          setActivityImages((prev) => ({ ...prev, [a.id]: '' }));
          loadedImageIds.current.delete(a.id);
          anyFailed = true;
        }
      }

      // If some images failed (rate limit / network), retry up to 3 times with backoff
      if (anyFailed && !cancelled && imageRetryCount.current < 3) {
        imageRetryCount.current += 1;
        const delay = 1500 * imageRetryCount.current;
        setTimeout(() => {
          if (!cancelled) setImageRetryTick((t) => t + 1);
        }, delay);
      }
    }

    loadSequentially();
    return () => { cancelled = true; };
  }, [itinerary?.id, selectedDay, imageRetryTick]);

  // Resolve hero image — fetch from Unsplash if Gemini generated a placeholder
  useEffect(() => {
    if (!itinerary) return;
    if (!isPlaceholder(itinerary.heroImage)) {
      setHeroUri(itinerary.heroImage);
      return;
    }
    searchPhoto(`${itinerary.destinationName} ${itinerary.country ?? ''}`).then(url => {
      setHeroUri(url ?? undefined);
    });
  }, [itinerary?.id]);

  // Prefetch "Similar" suggestions the moment an activity sheet opens so
  // there's no loading delay when the user taps the Similar button.
  useEffect(() => {
    if (!detailActivity || !id || isBrowsing) return;
    const { dayIndex, activityIndex } = detailActivity;
    const key = `${dayIndex}-${activityIndex}`;
    if (preloadedSuggestions[key]) return; // already cached
    getSuggestedReplacements({ itineraryId: id, dayIndex, activityIndex, reason: 'similar_nearby', count: 3 })
      .then(({ candidates }) => {
        setPreloadedSuggestions((prev) => ({ ...prev, [key]: candidates }));
      })
      .catch(() => {}); // silent — will fetch normally on tap if this fails
  }, [detailActivity?.dayIndex, detailActivity?.activityIndex, id]);

  const getDayLabel = (index: number): string => {
    if (isBrowsing || !committedTrip) return (itinerary ? getItineraryDays(itinerary)[index]?.label : null) ?? `Day ${index + 1}`;
    const d = new Date(committedTrip.startDate);
    d.setDate(d.getDate() + index);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };

  const heroSubtitle = committedTrip ? formatTripSubtitle(committedTrip) : itinerary?.subtitle ?? '';

  const handlePlanThisTrip = () => {
    if (!itinerary) return;
    // Prebuilt trips now run the SAME full builder + generation flow as a new trip,
    // just with the destination pre-filled and the prebuilt attached as a seed. The
    // pipeline keeps the seed's activities, snaps them to real Places data, and
    // expands each day to the full structure. Mirror DestinationScreen's entry so the
    // downstream screens behave identically to a freshly-picked destination.
    reset();
    setFlow('full');
    setDestination({
      id: (itinerary as any).destinationId ?? itinerary.id,
      name: (itinerary as any).destinationName ?? itinerary.title,
      state: (itinerary as any).state,
      country: (itinerary as any).country ?? '',
      flag: (itinerary as any).flag ?? '',
      imageUrl: heroUri ?? itinerary.heroImage ?? '',
      destinationType: (itinerary as any).destinationType === 'national_park' ? 'national_park' : 'city',
    });
    setSeedItineraryId(itinerary.id);
    setTemplateId(itinerary.id);
    setTemplateTitle(itinerary.title);
    setTemplateHeroImage(heroUri ?? itinerary.heroImage);
    navigation.navigate('TripBasics');
  };

  const handleDeleteTrip = () => {
    if (committedTripId) removeTrip(committedTripId);
    navigation.navigate('Index' as any, { screen: 'MyTrips' } as any);
  };

  const handleRemoveActivity = useCallback(async (dayIndex: number, activityIndex: number) => {
    if (!itinerary || !id) return;
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const currentDay = allDays[dayIndex];
    if (!currentDay) return;
    const updatedDay = { ...currentDay, activities: currentDay.activities.filter((_, ai) => ai !== activityIndex) };
    const updatedItinerary = updateItineraryDay(itinerary, dayIndex, updatedDay);
    setRemoteItinerary(updatedItinerary);
    try {
      const firestoreUpdate = updatedItinerary.stops
        ? { stops: updatedItinerary.stops, updatedAt: firestore.FieldValue.serverTimestamp() }
        : { days: (updatedItinerary as any).days, updatedAt: firestore.FieldValue.serverTimestamp() };
      await firestore()
        .collection('users').doc(uid)
        .collection('itineraries').doc(id)
        .update(firestoreUpdate);
    } catch (err) {
      setRemoteItinerary(itinerary);
      Alert.alert('Could not remove activity', err instanceof Error ? err.message : 'Please try again.');
    }
  }, [itinerary, id, allDays]);

  const handleAction = useCallback(async (dayIndex: number, activityIndex: number, activity: ItineraryActivity, action: ActivityAction) => {
    if (action === 'remove') {
      Alert.alert(
        'Remove Activity',
        `Remove "${activity.name}" from your itinerary?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => handleRemoveActivity(dayIndex, activityIndex) },
        ]
      );
      return;
    }

    const usage = await getUsageStatus().catch(() => null);
    if (usage && !usage.isPro && usage.regensLeft <= 0) {
      setShowRegenPaywall(true);
      return;
    }

    logRegenAttempted('activity');
    setSheetTarget({ dayIndex, activityIndex, activityName: activity.name, action });
    sheetRef.current?.expand();
  }, [handleRemoveActivity]);

  const handleConfirmed = useCallback((updatedItinerary: GeneratedItinerary) => {
    setRemoteItinerary(updatedItinerary);
    setSheetTarget(null);
  }, []);

  const handleDragEnd = useCallback(async ({ data }: { data: ItineraryActivity[] }) => {
    if (!itinerary || !id) return;
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    const currentDay = allDays[selectedDay];
    if (!currentDay) return;
    const updatedDay = { ...currentDay, activities: data };
    const updatedItinerary = updateItineraryDay(itinerary, selectedDay, updatedDay);
    setRemoteItinerary(updatedItinerary);
    try {
      const firestoreUpdate = updatedItinerary.stops
        ? { stops: updatedItinerary.stops, updatedAt: firestore.FieldValue.serverTimestamp() }
        : { days: (updatedItinerary as any).days, updatedAt: firestore.FieldValue.serverTimestamp() };
      await firestore()
        .collection('users').doc(uid)
        .collection('itineraries').doc(id)
        .update(firestoreUpdate);
    } catch {
      setRemoteItinerary(itinerary);
    }
  }, [itinerary, id, selectedDay, allDays]);

  const sendAiMessage = useCallback(async (message: string) => {
    if (!message.trim() || !id || aiBarLoading) return;
    const usage = await getUsageStatus().catch(() => null);
    if (usage && !usage.isPro && usage.regensLeft <= 0) {
      setShowRegenPaywall(true);
      return;
    }
    logRegenAttempted('ai_bar');
    setAiBarLoading(true);
    try {
      const { itinerary: updated } = await editItineraryWithLanguage({ itineraryId: id, message: message.trim(), dayIndex: selectedDay });
      setRemoteItinerary(updated);
    } catch (err) {
      if (err instanceof Error && /regen_limit_reached/i.test(err.message)) {
        setShowRegenPaywall(true);
      } else {
        Alert.alert('Could not apply changes', err instanceof Error ? err.message : 'Please try again.');
      }
    } finally {
      setAiBarLoading(false);
    }
  }, [id, aiBarLoading, selectedDay]);

  // Whole-day "Reduce Walking" — reorders the day to minimize walking (keeps meals
  // in place). Distinct from the between-activity reduce_walking, which swaps a venue.
  const handleReduceWalkingDay = useCallback(async () => {
    if (!id || aiBarLoading) return;
    const usage = await getUsageStatus().catch(() => null);
    if (usage && !usage.isPro && usage.regensLeft <= 0) {
      setShowRegenPaywall(true);
      return;
    }
    logRegenAttempted('day');
    setAiBarLoading(true);
    try {
      const { itinerary: updated } = await optimizeDay({ itineraryId: id, dayIndex: selectedDay, mode: 'minimize_walking' });
      setRemoteItinerary(updated);
    } catch (err) {
      if (err instanceof Error && /regen_limit_reached/i.test(err.message)) {
        setShowRegenPaywall(true);
      } else {
        Alert.alert('Could not reduce walking', err instanceof Error ? err.message : 'Please try again.');
      }
    } finally {
      setAiBarLoading(false);
    }
  }, [id, aiBarLoading, selectedDay]);

  const handleAiBarSubmit = useCallback(() => {
    const message = aiBarMessage.trim();
    if (!message) return;
    setAiBarMessage('');
    sendAiMessage(message);
  }, [aiBarMessage, sendAiMessage]);

  const handleShare = async () => {
    if (!itinerary || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: 'jpg', quality: 0.92 });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        dialogTitle: itinerary.title,
      });
    } catch {
      // dismissed or capture error
    } finally {
      setSharing(false);
    }
  };

  const dayInsights = useMemo((): ActivityInsight[] => {
    if (isBrowsing || !activities.length) return [];
    return analyzeDay(activities);
  }, [activities, isBrowsing]);

  const mapRegion = useMemo(() => {
    const coords = activities
      .map((a) => a.coordinates)
      .filter((v): v is NonNullable<typeof v> => Boolean(v));
    if (!coords.length) return undefined;
    const lats = coords.map((c) => c.latitude);
    const lngs = coords.map((c) => c.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.02) * 1.4,
      longitudeDelta: Math.max(maxLng - minLng, 0.02) * 1.4,
    };
  }, [activities]);

  // Recenter the map when the selected day (and thus its region) changes,
  // while still allowing the user to pan/zoom freely in between.
  useEffect(() => {
    if (mapRegion && mapRef.current) {
      mapRef.current.animateToRegion(mapRegion, 350);
    }
  }, [mapRegion]);

  const headerTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : insets.top + 8;

  const isLoadingAll = loadingRemote || (!imagesReady && !isBrowsing && !!id && !demoItinerary);

  if (isLoadingAll) {
    const msg = loadingRemote ? 'Loading your itinerary...' : 'Preparing your adventure...';
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
        <ActivityIndicator size="large" color={ICON_COLOR} />
        <Text style={{ marginTop: 16, color: '#3D3555', fontFamily: 'SourceSans3-Regular', fontSize: 16, textAlign: 'center' }}>
          {msg}
        </Text>
      </View>
    );
  }

  if (!itinerary) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
        <Ionicons name="warning-outline" size={36} color={ICON_COLOR} />
        <Text style={{ marginTop: 16, color: '#3D3555', fontFamily: 'SourceSans3-SemiBold', fontSize: 18, textAlign: 'center' }}>
          Saved itinerary unavailable
        </Text>
        <Text style={{ marginTop: 8, color: '#5E5670', fontFamily: 'SourceSans3-Regular', fontSize: 15, textAlign: 'center' }}>
          {remoteLoadError ?? 'The app could not load the saved itinerary document.'}
        </Text>
        <TouchableOpacity
          style={[styles.planTripButton, { marginTop: 24 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.planTripButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <ScrollView
        style={styles.itineraryContainer}
        contentContainerStyle={makeScrollContentStyle(insets.bottom, isBrowsing, !isBrowsing)}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapInteracting}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: '#3D3555' }]} />
          )}
          <View style={styles.heroGradient} />

          <View style={[styles.headerRow, { top: headerTop }]}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => {
                if (isBrowsing) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Index' as any, { screen: 'MyTrips' } as any);
                }
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerRightIcons}>
              <TouchableOpacity style={styles.headerIconBtn} onPress={handleShare} disabled={sharing}>
                {sharing
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="share-social-outline" size={20} color="#fff" />}
              </TouchableOpacity>
              {!isBrowsing && (
                <TouchableOpacity style={styles.headerIconBtn} onPress={handleDeleteTrip}>
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>{itinerary.title}</Text>
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapSection}>
          <View
            style={styles.mapContainer}
            onTouchStart={() => setMapInteracting(true)}
            onTouchEnd={() => setMapInteracting(false)}
            onTouchCancel={() => setMapInteracting(false)}
          >
            {MapView && Marker && mapRegion ? (
              <MapView
                ref={mapRef}
                style={styles.mapImage}
                initialRegion={mapRegion}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                {activities.filter((a) => a.coordinates).map((a) => (
                  <Marker key={a.id} coordinate={a.coordinates!} title={a.name} />
                ))}
              </MapView>
            ) : (
              <View style={[styles.mapImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ede7fa' }]}>
                <Ionicons name="map-outline" size={30} color="#6A62B7" />
                <Text style={{ marginTop: 8, color: '#6A62B7', fontSize: 13, fontFamily: 'SourceSans3-Regular', textAlign: 'center', paddingHorizontal: 20 }}>
                  Map unavailable — tap each activity to open in Google Maps
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Day tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateSelector}
          contentContainerStyle={styles.dateSelectorContent}
        >
          {allDays.map((day, index) => (
            <TouchableOpacity
              key={`${day.label}-${index}`}
              style={[styles.dateBtn, selectedDay === index && styles.dateBtnActive]}
              onPress={() => setSelectedDay(index)}
            >
              <Text style={[styles.dateBtnText, selectedDay === index && styles.dateBtnTextActive]}>
                {getDayLabel(index)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stop card (route trips) — wraps day title + overnight info with a left accent bar */}
        {itinerary && isRouteTrip(itinerary) ? (() => {
          const stop = getStopForDayIndex(itinerary, selectedDay);
          const dayTitle = allDays[selectedDay]?.title;
          const daytime = stop?.location;
          const overnight = stop?.overnightAnchor?.location;
          if (!stop && !dayTitle) return null;
          return (
            <View style={styles.stopCard}>
              <View style={styles.stopCardAccent} />
              <View style={styles.stopCardBody}>
                {daytime ? (
                  <View style={styles.stopCardLocationRow}>
                    <Ionicons name="location" size={12} color="#6A62B7" />
                    <Text style={styles.stopCardLocation} numberOfLines={1}>{daytime}</Text>
                  </View>
                ) : null}
                {dayTitle ? <Text style={styles.stopCardTitle}>{dayTitle}</Text> : null}
                {overnight && overnight !== daytime ? (
                  <View style={styles.stopCardOvernightRow}>
                    <Ionicons name="moon-outline" size={11} color="#9890C8" />
                    <Text style={styles.stopCardOvernight} numberOfLines={1}>Overnight in {overnight}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })() : (
          allDays[selectedDay]?.title ? (
            <Text style={styles.dayTitle}>{allDays[selectedDay].title}</Text>
          ) : null
        )}

        {/* Smart insights (info-level shown at top of day) */}
        {dayInsights.filter((ins) => ins.afterIndex === -1).map((ins, i) => (
          <SmartBanner
            key={`top-insight-${i}`}
            insight={ins}
            onAction={(actionType) => {
              if (actionType === 'reduce_walking') {
                handleReduceWalkingDay();
              }
            }}
          />
        ))}

        {/* Day optimize bar */}
        {!isBrowsing && id && (
          <DayOptimizeBar
            itineraryId={id}
            dayIndex={selectedDay}
            onOptimized={(updated) => setRemoteItinerary(updated)}
            onPaywallNeeded={() => setShowRegenPaywall(true)}
          />
        )}

        {/* Activities */}
        <View style={styles.itineraryItems}>
          <DraggableFlatList
            data={activities}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            onDragEnd={!isBrowsing ? handleDragEnd : undefined}
            activationDistance={!isBrowsing ? 20 : 999}
            renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<ItineraryActivity>) => {
              const idx = getIndex() ?? 0;
              const locked = item.locked;
              const betweenInsights = dayInsights.filter((ins) => ins.afterIndex === idx);
              return (
                <ScaleDecorator activeScale={1.02}>
                  <ActivityCard
                    activity={item}
                    isLast={idx === activities.length - 1}
                    nextActivity={activities[idx + 1]}
                    imageUri={activityImages[item.id] || (!isPlaceholder(item.image) ? item.image : undefined)}
                    onPress={() => setDetailActivity({ activity: item, dayIndex: selectedDay, activityIndex: idx })}
                    onLongPress={!isBrowsing && !locked ? drag : undefined}
                    isDragging={isActive}
                  />
                  {betweenInsights.map((ins, i) => (
                    <SmartBanner
                      key={`insight-${idx}-${i}`}
                      insight={ins}
                      onAction={async (actionType) => {
                        if (!id || aiBarLoading) return;
                        const usage = await getUsageStatus().catch(() => null);
                        if (usage && !usage.isPro && usage.regensLeft <= 0) {
                          setShowRegenPaywall(true);
                          return;
                        }
                        const curr = activities[idx];
                        const next = activities[idx + 1];
                        let message = '';
                        if (actionType === 'rework_schedule' && curr && next) {
                          message = `Fix the tight schedule conflict between "${curr.name}" and "${next.name}". Adjust the times so there is enough buffer for travel between them, or remove the less important activity.`;
                        } else if (actionType === 'reduce_walking' && curr && next) {
                          message = `Reduce the walking distance between "${curr.name}" and "${next.name}" by suggesting a closer alternative for one of them, or adding a transport step.`;
                        }
                        if (!message) return;
                        setAiBarLoading(true);
                        try {
                          const { itinerary: updated } = await editItineraryWithLanguage({ itineraryId: id, message, dayIndex: selectedDay });
                          setRemoteItinerary(updated);
                        } catch {
                          Alert.alert('Could not apply changes', 'Please try again.');
                        } finally {
                          setAiBarLoading(false);
                        }
                      }}
                    />
                  ))}
                </ScaleDecorator>
              );
            }}
          />
        </View>
      </ScrollView>

      {isBrowsing && (
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.ctaBtn} onPress={handlePlanThisTrip} activeOpacity={0.85}>
            <Text style={styles.ctaBtnText}>Plan This Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Off-screen share card — rendered but invisible, captured on share tap */}
      {itinerary && (
        <View style={{ position: 'absolute', left: -10000, top: 0 }} pointerEvents="none">
          <ShareCard
            ref={shareCardRef}
            itinerary={itinerary}
            heroUri={heroUri}
            committedTrip={committedTrip}
          />
        </View>
      )}

      {!isBrowsing && id && (
        <ItineraryRefinementBar
          itineraryId={id}
          onUpdated={(updated) => setRemoteItinerary(updated)}
          onPaywallNeeded={() => setShowRegenPaywall(true)}
        />
      )}

      {!isBrowsing && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.aiBarWrapper}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.aiBarChips}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
          >
            {[
              { label: "🌧️ It's raining", message: "It's raining today. Replace any outdoor activities with good indoor alternatives nearby." },
              { label: "😴 We're tired", message: "We're feeling tired. Make today's schedule lighter with fewer activities and more relaxed pacing." },
              { label: "⏩ Shorter day", message: "Shorten today's itinerary. Remove one or two activities and give us more downtime." },
              { label: "🔁 Mix it up", message: "Today feels repetitive. Swap some activities for more variety — try a different neighborhood or type of experience." },
              { label: "📍 Stay local", message: "Keep everything close together today. Remove any activity that requires long travel and replace with something nearby." },
            ].map((chip) => (
              <TouchableOpacity
                key={chip.label}
                style={styles.aiBarChip}
                onPress={() => sendAiMessage(chip.message)}
                disabled={aiBarLoading}
              >
                <Text style={styles.aiBarChipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[styles.aiBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
            <TextInput
              style={styles.aiBarInput}
              placeholder="Ask me to change anything..."
              placeholderTextColor="#AAA"
              value={aiBarMessage}
              onChangeText={setAiBarMessage}
              onSubmitEditing={handleAiBarSubmit}
              returnKeyType="send"
              editable={!aiBarLoading}
            />
            <TouchableOpacity
              style={[styles.aiBarSend, (!aiBarMessage.trim() || aiBarLoading) && styles.aiBarSendDisabled]}
              onPress={handleAiBarSubmit}
              disabled={!aiBarMessage.trim() || aiBarLoading}
            >
              {aiBarLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-up" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <ActivityDetailSheet
        activity={detailActivity?.activity ?? null}
        visible={detailActivity !== null}
        onDismiss={() => setDetailActivity(null)}
        imageUri={detailActivity ? activityImages[detailActivity.activity.id] : undefined}
        destinationName={itinerary?.destinationName}
        country={itinerary?.country}
        checkin={committedTrip ? new Date(committedTrip.startDate).toISOString().slice(0, 10) : ''}
        checkout={committedTrip ? new Date(committedTrip.endDate).toISOString().slice(0, 10) : ''}
        adults={partyToAdults(committedTrip?.party ?? itinerary?.travelerType)}
        isBrowsing={isBrowsing}
        onAction={(action) => {
          if (!detailActivity) return;
          handleAction(detailActivity.dayIndex, detailActivity.activityIndex, detailActivity.activity, action);
        }}
      />

      <PaywallModal
        visible={showRegenPaywall}
        reason="regen"
        onDismiss={() => setShowRegenPaywall(false)}
        onSuccess={() => setShowRegenPaywall(false)}
      />

      {!isBrowsing && id && (
        <ReplaceSuggestionsSheet
          itineraryId={id}
          target={sheetTarget}
          preloadedCandidates={
            sheetTarget?.action === 'similar_nearby'
              ? preloadedSuggestions[`${sheetTarget.dayIndex}-${sheetTarget.activityIndex}`]
              : undefined
          }
          onConfirmed={handleConfirmed}
          onDismiss={() => setSheetTarget(null)}
          sheetRef={sheetRef}
          onPaywallNeeded={() => setShowRegenPaywall(true)}
        />
      )}

      <PaywallModal
        visible={showUpgradePaywall}
        reason="generation"
        onDismiss={() => setShowUpgradePaywall(false)}
        onSuccess={() => setShowUpgradePaywall(false)}
      />

      {showUpsellSnack && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 32,
            left: 16,
            right: 16,
            backgroundColor: '#1a1a2e',
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: snackAnim,
            transform: [{ translateY: snackAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'SourceSans3-Regular', flex: 1 }}>
            Love it? Go Pro for 20 trips a month — $9.99/mo
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowUpsellSnack(false);
              setShowUpgradePaywall(true);
            }}
            style={{ marginLeft: 12, backgroundColor: '#6A62B7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'SourceSans3-Regular' }}>Go Pro</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}
