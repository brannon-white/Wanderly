import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles, ICON_COLOR, makeScrollContentStyle } from '../styles/TravelItinerary';
import {
  buildHotelSearchUrl,
  buildOpenTableUrl,
  buildExperienceUrl,
  buildDirectionsUrl,
  partyToAdults,
} from '@/services/bookingService';
import { DEMO_FULL_ITINERARIES } from '@/data/demoData';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useMyTrips, formatTripSubtitle } from '@/context/MyTripsContext';
import type { GeneratedItinerary, ItineraryActivity, ItineraryDay } from '@/types/itinerary';
import { getAuth } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { searchPhoto } from '@/services/unsplash';
import ShareCard from './ShareCard';

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
  ferry: 'boat-outline',
  boat: 'boat-outline',
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

function isPlaceholder(url?: string) {
  return !url || url.includes('placeholder.com') || url.includes('via.placeholder');
}

function formatCount(n: number | string | undefined): string {
  const num = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
  return isNaN(num) ? '0' : num.toLocaleString();
}

function StarRow({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= full ? 'star' : half && i === full + 1 ? 'star-half' : 'star-outline'}
          size={13}
          color="#FFB800"
          style={styles.starIcon}
        />
      ))}
    </View>
  );
}

interface ActivityCardProps {
  activity: ItineraryActivity;
  isLast: boolean;
  nextActivity?: ItineraryActivity;
  imageUri?: string;
  destinationName?: string;
  country?: string;
  checkin?: string;
  checkout?: string;
  adults?: number;
}

function ActivityCard({ activity, isLast, nextActivity, imageUri, destinationName, country, checkin = '', checkout = '', adults = 2 }: ActivityCardProps) {
  const transportOptions = Array.isArray(activity.transport) ? activity.transport : [];
  const catKey = (activity.category ?? '').toLowerCase();
  const catIcon = CATEGORY_ICONS[catKey] ?? 'location-outline';

  const openMaps = () => {
    Linking.openURL(
      activity.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(activity.name)}`
    );
  };

  return (
    <View style={styles.activityRow}>
      {/* Timeline column */}
      <View style={styles.timelineCol}>
        <View style={styles.timelineIconCircle}>
          <Ionicons name={catIcon} size={15} color={CAT_COLOR} />
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      {/* Card + transport strip stacked */}
      <View style={{ flex: 1 }}>
        <View style={styles.itineraryItem}>
          <Image
            source={imageUri ? { uri: imageUri } : undefined}
            style={[styles.itemImage, !imageUri && { backgroundColor: '#f0eeff' }]}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={200}
          />

          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle}>{activity.name}</Text>

            {typeof activity.rating === 'number' && (
              <View style={styles.ratingRow}>
                <StarRow rating={activity.rating} />
                <Text style={styles.ratingText}>
                  {'  '}{activity.rating.toFixed(1)} ({formatCount(activity.reviewCount)} reviews)
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={15} color="#6A62B7" style={styles.infoIconEl} />
              <Text style={styles.infoText}>{activity.time}</Text>
            </View>

            {activity.cost ? (
              <View style={styles.infoRow}>
                <Ionicons name="cash-outline" size={15} color="#6A62B7" style={styles.infoIconEl} />
                <Text style={styles.infoText}>{activity.cost}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={15} color="#6A62B7" style={styles.infoIconEl} />
              <TouchableOpacity onPress={openMaps}>
                <Text style={styles.mapsLink}>View on Google Maps</Text>
              </TouchableOpacity>
            </View>

            {destinationName ? (() => {
              const cat = (activity.category ?? '').toLowerCase();
              if (cat === 'hotel') return (
                <View style={styles.infoRow}>
                  <Ionicons name="bed-outline" size={15} color="#6A62B7" style={styles.infoIconEl} />
                  <TouchableOpacity onPress={() => Linking.openURL(buildHotelSearchUrl(destinationName, country, checkin, checkout, adults))}>
                    <Text style={styles.mapsLink}>Book on Booking.com</Text>
                  </TouchableOpacity>
                </View>
              );
              if (cat === 'food' || cat === 'restaurant') return (
                <View style={styles.infoRow}>
                  <Ionicons name="restaurant-outline" size={15} color="#6A62B7" style={styles.infoIconEl} />
                  {/* Phase 2: replace with OpenTable API for in-app confirmation # */}
                  <TouchableOpacity onPress={() => Linking.openURL(buildOpenTableUrl(activity.name, destinationName, checkin, adults, activity.coordinates))}>
                    <Text style={styles.mapsLink}>Reserve on OpenTable</Text>
                  </TouchableOpacity>
                </View>
              );
              if (['adventure', 'culture', 'nature', 'wellness', 'nightlife'].includes(cat)) return (
                <View style={styles.infoRow}>
                  <Ionicons name="compass-outline" size={15} color="#6A62B7" style={styles.infoIconEl} />
                  {/* Phase 2: replace with Viator Partner API for in-app confirmation # */}
                  <TouchableOpacity onPress={() => Linking.openURL(buildExperienceUrl(activity.name, destinationName))}>
                    <Text style={styles.mapsLink}>Find Experiences</Text>
                  </TouchableOpacity>
                </View>
              );
              return null;
            })() : null}
          </View>
        </View>

        {/* Transport strip — tappable to open directions to the next activity */}
        {!isLast && transportOptions.length > 0 && (
          <View style={styles.transportStrip}>
            {transportOptions.map((t, idx) => {
              const canOpenDirections = !!nextActivity;
              const onPress = canOpenDirections
                ? () => Linking.openURL(buildDirectionsUrl(
                    { name: activity.name, coordinates: activity.coordinates },
                    { name: nextActivity!.name, coordinates: nextActivity!.coordinates },
                    t.mode ?? 'walk',
                  ))
                : undefined;
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.transportStripItem}
                  onPress={onPress}
                  disabled={!canOpenDirections}
                  activeOpacity={canOpenDirections ? 0.6 : 1}
                >
                  <Ionicons
                    name={TRANSPORT_ICONS[t.mode?.toLowerCase() ?? ''] ?? 'navigate-outline'}
                    size={22}
                    color={CAT_COLOR}
                  />
                  <Text style={styles.transportStripTime}>{t.time}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

function normalizePrebuiltItinerary(data: any, docId: string): GeneratedItinerary {
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
    setEditingTripId,
    setTemplateId,
    setTemplateTitle,
    setTemplateHeroImage,
    setParty,
    setStartDate,
    setEndDate,
    setInterests,
    setBudget,
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
  const itinerary = remoteItinerary ?? demoItinerary;

  const [selectedDay, setSelectedDay] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [activityImages, setActivityImages] = useState<Record<string, string>>({});
  const shareCardRef = useRef<View>(null);
  const activities = itinerary?.days[selectedDay]?.activities ?? [];
  const MapView = MapsModule?.default;
  const Marker = MapsModule?.Marker;

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

  // Pre-resolve all activity images in parallel so cards don't stagger-load
  useEffect(() => {
    if (!itinerary) return;
    const allActivities = itinerary.days.flatMap(d => d.activities);
    Promise.all(
      allActivities.map(async a => {
        const url = isPlaceholder(a.image) ? await searchPhoto(a.name) : a.image;
        return [a.id, url] as [string, string | null | undefined];
      })
    ).then(results => {
      const map: Record<string, string> = {};
      for (const [id, url] of results) {
        if (url) map[id] = url;
      }
      setActivityImages(map);
    });
  }, [itinerary?.id]);

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

  const getDayLabel = (index: number): string => {
    if (isBrowsing || !committedTrip) return itinerary?.days[index]?.label ?? `Day ${index + 1}`;
    const d = new Date(committedTrip.startDate);
    d.setDate(d.getDate() + index);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };

  const heroSubtitle = committedTrip ? formatTripSubtitle(committedTrip) : itinerary?.subtitle ?? '';

  const handlePlanThisTrip = () => {
    if (!itinerary) return;
    reset();
    setFlow('prebuilt');
    setTemplateId(itinerary.id);
    setTemplateTitle(itinerary.title);
    setTemplateHeroImage(heroUri ?? itinerary.heroImage);
    navigation.navigate('TripDates');
  };

  const handleModifySettings = () => {
    if (!committedTrip || !itinerary) return;
    reset();
    setFlow('full');
    setEditingTripId(committedTrip.id);
    setTemplateId(itinerary.id);
    setTemplateTitle(itinerary.title);
    setTemplateHeroImage(itinerary.heroImage);
    setParty(committedTrip.party);
    setStartDate(new Date(committedTrip.startDate));
    setEndDate(new Date(committedTrip.endDate));
    setInterests(committedTrip.interests ?? []);
    setBudget(committedTrip.budget ?? '');
    navigation.navigate('TripParty');
  };

  const handleDeleteTrip = () => {
    if (committedTripId) removeTrip(committedTripId);
    navigation.navigate('Index' as any, { screen: 'MyTrips' } as any);
  };

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

  const headerTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : insets.top + 8;

  if (loadingRemote) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
        <ActivityIndicator size="large" color={ICON_COLOR} />
        <Text style={{ marginTop: 16, color: '#3D3555', fontFamily: 'SourceSans3-Regular', fontSize: 16, textAlign: 'center' }}>
          Loading your itinerary...
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
        contentContainerStyle={makeScrollContentStyle(insets.bottom, isBrowsing)}
        showsVerticalScrollIndicator={false}
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
          <View style={styles.mapContainer}>
            {MapView && Marker && mapRegion ? (
              <MapView
                style={styles.mapImage}
                region={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
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
          {(itinerary.days ?? []).map((day, index) => (
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

        {/* Day title */}
        {itinerary.days[selectedDay]?.title ? (
          <Text style={styles.dayTitle}>{itinerary.days[selectedDay].title}</Text>
        ) : null}

        {/* Activities */}
        <View style={styles.itineraryItems}>
          {activities.map((activity, idx) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              isLast={idx === activities.length - 1}
              nextActivity={activities[idx + 1]}
              imageUri={activityImages[activity.id]}
              destinationName={itinerary?.destinationName}
              country={itinerary?.country}
              checkin={committedTrip ? new Date(committedTrip.startDate).toISOString().slice(0, 10) : ''}
              checkout={committedTrip ? new Date(committedTrip.endDate).toISOString().slice(0, 10) : ''}
              adults={partyToAdults(committedTrip?.party ?? itinerary?.travelerType)}
            />
          ))}
        </View>
      </ScrollView>

      {!isBrowsing && (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={handleModifySettings}>
          <Ionicons name="pencil" size={22} color="#fff" />
        </TouchableOpacity>
      )}

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
    </View>
  );
}
