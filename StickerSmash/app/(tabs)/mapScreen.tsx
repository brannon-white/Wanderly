import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/myTripsStyles';
import { DEMO_FULL_ITINERARIES, DemoFullItinerary } from '@/data/demoData';
import { useDemo } from '@/context/DemoContext';

type Tab = 'Active' | 'Passed';

function TripCard({ trip }: { trip: DemoFullItinerary }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: trip.heroImage }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {trip.title}
          </Text>
          <TouchableOpacity style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color="#555" />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardSubtitle}>{trip.subtitle}</Text>
      </View>
    </View>
  );
}

export default function MyTripsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('Active');
  const { isDemoMode } = useDemo();

  const trips = isDemoMode
    ? DEMO_FULL_ITINERARIES.filter((t) => (activeTab === 'Active' ? t.isActive !== false : t.isActive === false))
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>My Trips</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search" size={20} color="#222" />
        </TouchableOpacity>
      </View>

      {trips.length === 0 && !isDemoMode ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="location-outline" size={40} color="#bdbdbd" />
          </View>
          <Text style={styles.emptyTitle}>Empty</Text>
          <Text style={styles.emptySubtext}>
            Let our AI create personalized trip plans just for you. Start planning now!
          </Text>
          <TouchableOpacity style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Search Trip</Text>
          </TouchableOpacity>
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
                <Text
                  style={[styles.toggleText, activeTab === tab && styles.toggleTextActive]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {trips.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="location-outline" size={40} color="#bdbdbd" />
              </View>
              <Text style={styles.emptyTitle}>Empty</Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'Active'
                  ? 'No upcoming trips yet. Let our AI create personalized trip plans just for you!'
                  : 'No past trips to show yet.'}
              </Text>
              {activeTab === 'Active' && (
                <TouchableOpacity style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>Search Trip</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
