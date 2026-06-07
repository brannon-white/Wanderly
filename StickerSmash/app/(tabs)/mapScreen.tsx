import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/myTripsStyles';
import { useMyTrips, CommittedTrip, PendingGeneration, isTripActive, formatTripSubtitle } from '@/context/MyTripsContext';
import { buildHotelSearchUrl, partyToAdults, cleanDestination } from '@/services/bookingService';
import { searchPhoto } from '@/services/unsplash';

type NavProp = StackNavigationProp<RootStackParamList>;
type Tab = 'Active' | 'Passed';

function TripCard({ trip }: { trip: CommittedTrip }) {
  const navigation = useNavigation<NavProp>();
  const { removeTrip } = useMyTrips();
  const [imageUri, setImageUri] = useState<string | undefined>(
    trip.heroImage && !trip.heroImage.includes('placeholder') ? trip.heroImage : undefined
  );

  useEffect(() => {
    if (!imageUri) {
      searchPhoto(`${trip.title} travel destination`).then(url => {
        if (url) setImageUri(url);
      });
    }
  }, [trip.id]);

  const handleMenu = () => {
    Alert.alert(trip.title, undefined, [
      {
        text: 'Modify Trip',
        onPress: () => navigation.navigate('ItineraryScreen', { id: trip.templateId, source: 'mytrips', committedTripId: trip.id }),
      },
      {
        text: 'Delete Trip',
        style: 'destructive',
        onPress: () => Alert.alert('Delete Trip', 'Are you sure you want to delete this trip?', [
          { text: 'Delete', style: 'destructive', onPress: () => removeTrip(trip.id) },
          { text: 'Cancel', style: 'cancel' },
        ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('ItineraryScreen', { id: trip.templateId, source: 'mytrips', committedTripId: trip.id })}
    >
      <Image
        source={imageUri ? { uri: imageUri } : undefined}
        style={[styles.cardImage, !imageUri && { backgroundColor: '#e8e4ff' }]}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={200}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={1}>{trip.title}</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={handleMenu}>
            <Ionicons name="ellipsis-vertical" size={20} color="#555" />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardSubtitle}>{formatTripSubtitle(trip)}</Text>
        {isTripActive(trip) && (
          <TouchableOpacity
            style={styles.bookHotelsPill}
            onPress={() => Linking.openURL(buildHotelSearchUrl(
              trip.destinationName ?? cleanDestination(trip.title),
              trip.country,
              new Date(trip.startDate).toISOString().slice(0, 10),
              new Date(trip.endDate).toISOString().slice(0, 10),
              partyToAdults(trip.party),
            ))}
          >
            <Ionicons name="bed-outline" size={14} color="#6A62B7" />
            <Text style={styles.bookHotelsPillText}>Book Hotels</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function GeneratingCard({ gen, onDismiss }: { gen: PendingGeneration; onDismiss: () => void }) {
  if (gen.status === 'failed') {
    return (
      <View style={[generatingStyles.card, generatingStyles.failedCard]}>
        <View style={generatingStyles.left}>
          <Ionicons name="alert-circle" size={22} color="#c0392b" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={generatingStyles.title}>{gen.destName}</Text>
            <Text style={generatingStyles.failedSubtitle}>
              {gen.errorMessage || 'The itinerary could not be generated. Please try again.'}
            </Text>
          </View>
          <TouchableOpacity onPress={onDismiss} hitSlop={10} style={{ paddingLeft: 8 }}>
            <Ionicons name="close" size={20} color="#c0392b" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={generatingStyles.card}>
      <View style={generatingStyles.left}>
        <ActivityIndicator size="small" color="#6A62B7" style={{ marginRight: 12 }} />
        <View>
          <Text style={generatingStyles.title}>{gen.destName}</Text>
          <Text style={generatingStyles.subtitle}>Building your itinerary…</Text>
        </View>
      </View>
      <Text style={generatingStyles.note}>We'll notify you when it's ready</Text>
    </View>
  );
}

const generatingStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 18,
    backgroundColor: '#f0eeff',
    borderWidth: 1,
    borderColor: '#e0d9ff',
    padding: 16,
    gap: 8,
  },
  failedCard: {
    backgroundColor: '#fdecea',
    borderColor: '#f3c6bf',
  },
  failedSubtitle: {
    fontSize: 13,
    fontFamily: 'SourceSans3-Regular',
    color: '#a33529',
    marginTop: 2,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
    color: '#3d3780',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'SourceSans3-Regular',
    color: '#6A62B7',
    marginTop: 2,
  },
  note: {
    fontSize: 12,
    fontFamily: 'SourceSans3-Regular',
    color: '#9990d0',
    paddingLeft: 36,
  },
});

export default function MyTripsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('Active');
  const { trips, pendingGeneration, setPendingGeneration } = useMyTrips();
  const navigation = useNavigation<NavProp>();

  const filtered = trips.filter((t) =>
    activeTab === 'Active' ? isTripActive(t) : !isTripActive(t)
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>My Trips</Text>
        <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('SearchScreen')}>
          <Ionicons name="search" size={20} color="#222" />
        </TouchableOpacity>
      </View>

      {pendingGeneration && (
        <GeneratingCard gen={pendingGeneration} onDismiss={() => setPendingGeneration(null)} />
      )}

      {trips.length === 0 && !pendingGeneration ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="location-outline" size={40} color="#bdbdbd" />
          </View>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySubtext}>
            Browse destinations or pre-built itineraries and commit to a trip to see it here.
          </Text>
        </View>
      ) : trips.length === 0 ? null : (
        <>
          <View style={styles.toggleRow}>
            {(['Active', 'Passed'] as Tab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.toggleBtn, activeTab === tab && styles.toggleBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.toggleText, activeTab === tab && styles.toggleTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="location-outline" size={40} color="#bdbdbd" />
              </View>
              <Text style={styles.emptyTitle}>Empty</Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'Active'
                  ? 'No upcoming trips yet.'
                  : 'No past trips to show yet.'}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {filtered.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
