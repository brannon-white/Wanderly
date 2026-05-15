import React, { useState, useEffect } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/myTripsStyles';
import { useMyTrips, CommittedTrip, isTripActive, formatTripSubtitle } from '@/context/MyTripsContext';
import { searchPhoto } from '@/services/unsplash';

type NavProp = StackNavigationProp<RootStackParamList>;
type Tab = 'Active' | 'Passed';

function TripCard({ trip }: { trip: CommittedTrip }) {
  const navigation = useNavigation<NavProp>();
  const { removeTrip } = useMyTrips();
  const [imageUri, setImageUri] = useState<string | undefined>(trip.heroImage || undefined);

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
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: '#e8e4ff', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color="#6A62B7" />
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={1}>{trip.title}</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={handleMenu}>
            <Ionicons name="ellipsis-vertical" size={20} color="#555" />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardSubtitle}>{formatTripSubtitle(trip)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MyTripsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('Active');
  const { trips } = useMyTrips();
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

      {trips.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="location-outline" size={40} color="#bdbdbd" />
          </View>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySubtext}>
            Browse destinations or pre-built itineraries and commit to a trip to see it here.
          </Text>
        </View>
      ) : (
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
