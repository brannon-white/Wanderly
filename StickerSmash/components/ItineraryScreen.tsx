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
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles, ICON_COLOR, ICON_COLOR_DIMMED, makeScrollContentStyle } from '../styles/TravelItinerary';
import { DEMO_FULL_ITINERARIES, DemoActivity } from '@/data/demoData';

type NavProp = StackNavigationProp<RootStackParamList, 'ItineraryScreen'>;
type RoutePropType = RouteProp<RootStackParamList, 'ItineraryScreen'>;

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
    Linking.openURL(
      `https://maps.google.com/?q=${encodeURIComponent(activity.name + ' Tokyo')}`
    );
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

  const { id } = route.params;
  const itinerary =
    DEMO_FULL_ITINERARIES.find((it) => it.id === id) ?? DEMO_FULL_ITINERARIES[0];

  const [selectedDay, setSelectedDay] = useState(0);
  const activities = itinerary.days[selectedDay]?.activities ?? [];

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
        contentContainerStyle={makeScrollContentStyle(insets.bottom)}
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
              <TouchableOpacity style={styles.headerIconBtn}>
                <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero text */}
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>{itinerary.title}</Text>
            <Text style={styles.heroSubtitle}>{itinerary.subtitle}</Text>
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapSection}>
          <View style={styles.mapContainer}>
            {mapRegion && (
              <MapView style={styles.mapImage} region={mapRegion} scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}>
                {activities.map((activity) => (
                  <Marker
                    key={activity.id}
                    coordinate={activity.coordinates}
                    title={activity.name}
                  />
                ))}
              </MapView>
            )}
          </View>
        </View>

        {/* Date tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dateSelector}
          contentContainerStyle={styles.dateSelectorContent}
        >
          {itinerary.days.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.dateBtn, selectedDay === index && styles.dateBtnActive]}
              onPress={() => setSelectedDay(index)}
            >
              <Text
                style={[styles.dateBtnText, selectedDay === index && styles.dateBtnTextActive]}
              >
                {day.label}
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

      {/* Edit FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 24 }]}>
        <Ionicons name="pencil" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
