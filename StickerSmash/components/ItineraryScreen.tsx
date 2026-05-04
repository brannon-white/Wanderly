import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  StatusBar,
  Modal,
  StyleSheet,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles, ICON_COLOR, ICON_COLOR_DIMMED, makeScrollContentStyle } from '../styles/TravelItinerary';
import { DEMO_FULL_ITINERARIES, DemoActivity } from '@/data/demoData';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useMyTrips, formatTripSubtitle } from '@/context/MyTripsContext';

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

function StarRow(_: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name="star" size={13} color="#FFB800" style={styles.starIcon} />
      ))}
    </View>
  );
}

function ActivityCard({ activity }: { activity: DemoActivity }) {
  const openMaps = () => {
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(activity.name + ' Tokyo')}`);
  };

  return (
    <View style={styles.itineraryItem}>
      <Image source={{ uri: activity.image }} style={styles.itemImage} />
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle}>{activity.name}</Text>
        <View style={styles.ratingRow}>
          <StarRow rating={activity.rating} />
          <Text style={styles.ratingText}>
            {'  '}({activity.rating.toFixed(1)}) {activity.reviewCount} reviews
          </Text>
        </View>
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
          {activity.transport.map((t) => (
            <View key={t.mode} style={styles.transportOption}>
              <Ionicons
                name={TRANSPORT_ICONS[t.mode]}
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
  const { reset, setFlow, setEditingTripId, setTemplateId, setTemplateTitle, setTemplateHeroImage, setParty, setStartDate, setEndDate, setInterests, setBudget } = useTripPlanning();
  const { trips, removeTrip } = useMyTrips();

  const { id, source, committedTripId } = route.params;
  const isBrowsing = source !== 'mytrips';

  const itinerary = DEMO_FULL_ITINERARIES.find((it) => it.id === id) ?? DEMO_FULL_ITINERARIES[0];
  const committedTrip = committedTripId ? trips.find(t => t.id === committedTripId) : undefined;

  const [selectedDay, setSelectedDay] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  const activities = itinerary.days[selectedDay]?.activities ?? [];

  // When browsing show "Day 1", "Day 2" etc. When committed, show real dates.
  const getDayLabel = (index: number): string => {
    if (isBrowsing || !committedTrip) return `Day ${index + 1}`;
    const d = new Date(committedTrip.startDate);
    d.setDate(d.getDate() + index);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };

  const heroSubtitle = committedTrip
    ? formatTripSubtitle(committedTrip)
    : itinerary.subtitle;

  const handlePlanThisTrip = () => {
    reset();
    setFlow('prebuilt');
    setTemplateId(itinerary.id);
    setTemplateTitle(itinerary.title);
    setTemplateHeroImage(itinerary.heroImage);
    navigation.navigate('TripDates');
  };

  const handleDeleteTrip = () => {
    if (committedTripId) removeTrip(committedTripId);
    setMenuVisible(false);
    navigation.navigate('Index' as any, { screen: 'MyTrips' } as any);
  };

  const handleModifySettings = () => {
    if (!committedTrip) return;
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
    setMenuVisible(false);
    navigation.navigate('TripParty');
  };

  const mapRegion = useMemo(() => {
    const coords = activities.map((a) => a.coordinates);
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
  }, [selectedDay]);

  const headerTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : insets.top + 8;

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
          <Image source={{ uri: itinerary.heroImage }} style={styles.heroImage} />
          <View style={styles.heroGradient} />

          {/* Top bar */}
          <View style={[styles.headerRow, { top: headerTop }]}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerRightIcons}>
              <TouchableOpacity style={styles.headerIconBtn}>
                <Ionicons name="share-social-outline" size={20} color="#fff" />
              </TouchableOpacity>
              {!isBrowsing && (
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => setMenuVisible(true)}>
                  <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Hero text */}
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>{itinerary.title}</Text>
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapSection}>
          <View style={styles.mapContainer}>
            {mapRegion && (
              <MapView
                style={styles.mapImage}
                region={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                {activities.map((activity) => (
                  <Marker key={activity.id} coordinate={activity.coordinates} title={activity.name} />
                ))}
              </MapView>
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
          {itinerary.days.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.dateBtn, selectedDay === index && styles.dateBtnActive]}
              onPress={() => setSelectedDay(index)}
            >
              <Text style={[styles.dateBtnText, selectedDay === index && styles.dateBtnTextActive]}>
                {getDayLabel(index)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Activity cards */}
        <View style={styles.itineraryItems}>
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </View>
      </ScrollView>

      {/* Edit FAB — only for committed trips */}
      {!isBrowsing && (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 24 }]}>
          <Ionicons name="pencil" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Plan This Trip CTA — only when browsing */}
      {isBrowsing && (
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.ctaBtn} onPress={handlePlanThisTrip} activeOpacity={0.85}>
            <Text style={styles.ctaBtnText}>Plan This Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ellipsis dropdown menu */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={menuStyles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[menuStyles.card, { top: headerTop + 52, right: 16 }]}>
            <TouchableOpacity style={menuStyles.item} onPress={() => setMenuVisible(false)}>
              <Ionicons name="refresh-outline" size={20} color="#222" style={menuStyles.icon} />
              <Text style={menuStyles.itemText}>Regenerate Trip</Text>
            </TouchableOpacity>
            <View style={menuStyles.divider} />
            <TouchableOpacity style={menuStyles.item} onPress={handleModifySettings}>
              <Ionicons name="settings-outline" size={20} color="#222" style={menuStyles.icon} />
              <Text style={menuStyles.itemText}>Modify Trip Settings</Text>
            </TouchableOpacity>
            <View style={menuStyles.divider} />
            <TouchableOpacity style={menuStyles.item} onPress={handleDeleteTrip}>
              <Ionicons name="trash-outline" size={20} color="#E53935" style={menuStyles.icon} />
              <Text style={[menuStyles.itemText, { color: '#E53935' }]}>Delete Trip</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const menuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 240,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  icon: {
    marginRight: 14,
  },
  itemText: {
    fontSize: 16,
    color: '#222',
    fontFamily: 'SourceSans3-Regular',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 0,
  },
});
