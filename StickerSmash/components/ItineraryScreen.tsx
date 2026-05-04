import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles, ICON_COLOR, ICON_COLOR_DIMMED, makeScrollContentStyle } from '../styles/TravelItinerary';
import { DEMO_FULL_ITINERARIES } from '@/data/demoData';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useMyTrips, formatTripSubtitle } from '@/context/MyTripsContext';
import type { GeneratedItinerary, ItineraryActivity } from '@/types/itinerary';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

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
};

function StarRow() {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name="star" size={13} color="#FFB800" style={styles.starIcon} />
      ))}
    </View>
  );
}

function ActivityCard({ activity }: { activity: ItineraryActivity }) {
  const transportOptions = Array.isArray(activity.transport) ? activity.transport : [];

  const openMaps = () => {
    Linking.openURL(activity.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(activity.name)}`);
  };

  return (
    <View style={styles.itineraryItem}>
      <Image source={{ uri: activity.image }} style={styles.itemImage} />
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle}>{activity.name}</Text>

        {typeof activity.rating === 'number' ? (
          <View style={styles.ratingRow}>
            <StarRow />
            <Text style={styles.ratingText}>
              {'  '}({activity.rating.toFixed(1)}) {activity.reviewCount} reviews
            </Text>
          </View>
        ) : null}

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

        <View style={styles.transportOptions}>
          {transportOptions.map((t) => (
            <View key={`${activity.id}-${t.mode}-${t.time}`} style={styles.transportOption}>
              <Ionicons
                name={TRANSPORT_ICONS[t.mode] ?? 'navigate-outline'}
                size={20}
                color={t.time === '--' ? ICON_COLOR_DIMMED : ICON_COLOR}
              />
              <Text style={[styles.transportTime, t.time === '--' && styles.transportTimeDimmed]}>
                {t.time}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
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

  const { id, source, committedTripId } = route.params;
  const isBrowsing = source !== 'mytrips';
  const demoItinerary = DEMO_FULL_ITINERARIES.find((it) => it.id === id) ?? null;
  const committedTrip = committedTripId ? trips.find(t => t.id === committedTripId) : undefined;
  const [remoteItinerary, setRemoteItinerary] = useState<GeneratedItinerary | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(!demoItinerary);
  const [remoteLoadError, setRemoteLoadError] = useState<string | null>(null);
  const itinerary = remoteItinerary ?? demoItinerary;

  const [selectedDay, setSelectedDay] = useState(0);
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

      const uid = auth().currentUser?.uid;
      if (!uid) {
        if (!cancelled) {
          setRemoteLoadError('No signed-in Firebase user was available to load this saved itinerary.');
        }
        setLoadingRemote(false);
        return;
      }

      setLoadingRemote(true);

      try {
        const snapshot = await firestore()
          .collection('users')
          .doc(uid)
          .collection('itineraries')
          .doc(id)
          .get();

        if (!snapshot.exists) {
          if (!cancelled) {
            setRemoteItinerary(null);
            setRemoteLoadError(`No saved itinerary document was found for id "${id}".`);
          }
          return;
        }

        const data = snapshot.data() as GeneratedItinerary | undefined;
        if (!cancelled && data) {
          setRemoteLoadError(null);
          setRemoteItinerary({
            ...data,
            id: data.id || snapshot.id,
          });
        }
      } catch (error) {
        console.error('Failed to load itinerary', error);
        if (!cancelled) {
          setRemoteLoadError(error instanceof Error ? error.message : 'Unknown Firestore read failure.');
        }
      } finally {
        if (!cancelled) {
          setLoadingRemote(false);
        }
      }
    }

    loadRemoteItinerary();

    return () => {
      cancelled = true;
    };
  }, [demoItinerary, id]);

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
    setTemplateHeroImage(itinerary.heroImage);
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

  const mapRegion = useMemo(() => {
    const coords = activities
      .map((activity) => activity.coordinates)
      .filter((value): value is NonNullable<typeof value> => Boolean(value));

    if (!coords.length) return undefined;

    const lats = coords.map((c) => c.latitude);
    const lngs = coords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

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
          onPress={() => {
            if (remoteLoadError) {
              Alert.alert('Saved itinerary unavailable', remoteLoadError);
            }
            navigation.goBack();
          }}
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
        <View style={styles.heroSection}>
          <Image source={{ uri: itinerary.heroImage }} style={styles.heroImage} />
          <View style={styles.heroGradient} />

          <View style={[styles.headerRow, { top: headerTop }]}> 
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerRightIcons}>
              <TouchableOpacity style={styles.headerIconBtn}>
                <Ionicons name="share-social-outline" size={20} color="#fff" />
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
                {activities
                  .filter((activity) => activity.coordinates)
                  .map((activity) => (
                    <Marker key={activity.id} coordinate={activity.coordinates!} title={activity.name} />
                  ))}
              </MapView>
            ) : (
              <View style={[styles.mapImage, { alignItems: 'center', justifyContent: 'center' }]}> 
                {activities[0]?.image ? <Image source={{ uri: activities[0].image }} style={styles.mapImage} /> : null}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    backgroundColor: 'rgba(53, 43, 88, 0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 20,
                  }}
                >
                  <Ionicons name="map-outline" size={30} color="#fff" />
                  <Text
                    style={{
                      marginTop: 10,
                      color: '#fff',
                      fontSize: 14,
                      textAlign: 'center',
                      fontFamily: 'SourceSans3-Regular',
                    }}
                  >
                    Map preview unavailable in this build. Use the activity cards below to open locations.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateSelector}
          contentContainerStyle={styles.dateSelectorContent}
        >
          {itinerary.days.map((day, index) => (
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

        <View style={styles.itineraryItems}>
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
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
    </View>
  );
}
