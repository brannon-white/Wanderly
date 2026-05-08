import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/discoverScreenStyles';
import { useFeaturedItinerary } from '@/hooks/userFeaturedItinerary';
import { useMatchingItineraries } from '@/hooks/useMatchingItineraries';
import { getAuth } from '@react-native-firebase/auth';
import FeaturedTripCard from '@/components/FeaturedTripCard';
import RecommendedTripCard from '@/components/RecommendedTripCard';
import DestinationCard from '@/components/DestinationCard';
import { useDestinations } from '@/hooks/useDestinations';
import { useDemo } from '@/context/DemoContext';
import { DEMO_UID } from '@/data/demoData';
import type { ItineraryCardSummary } from '@/types/itinerary';
import { getUserProfile } from '@/utils/getUserProfile';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DiscoverScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { isDemoMode } = useDemo();
  const { featuredTrip, itinerary, loading, error } = useFeaturedItinerary();
  const { destinations, loading: loadingDest, error: errorDest } = useDestinations();
  const [firstName, setFirstName] = useState('');

  const uid = isDemoMode ? DEMO_UID : (getAuth().currentUser?.uid ?? '');
  const { prebuiltItineraries, loading: loadingItins, error: errorItins } = useMatchingItineraries(uid);

  const [activeItinIndex, setActiveItinIndex] = useState(0);
  const ITIN_PAGE_WIDTH = 365;

  useEffect(() => {
    if (isDemoMode) { setFirstName('Traveler'); return; }
    const user = getAuth().currentUser;
    if (!user) return;
    getUserProfile(user.uid).then((p: any) => {
      const name = p?.fullName || '';
      setFirstName(name.split(' ')[0] || '');
    }).catch(() => {});
  }, [isDemoMode]);

  const handleItinScroll = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / ITIN_PAGE_WIDTH);
    setActiveItinIndex(index);
  };
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {firstName ? <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text> : null}
          <Text style={styles.title}>Discover</Text>
        </View>
      </View>

      {/* Search */}
      <TouchableOpacity
        style={styles.searchWrapper}
        onPress={() => navigation.navigate('SearchScreen')}
        activeOpacity={0.7}
      >
        <Ionicons name="search" size={22} color="#bdbdbd" style={{ marginRight: 8 }} />
        <Text style={[styles.searchInput, { color: '#bdbdbd' }]}>Where do you want to go?</Text>
      </TouchableOpacity>

       <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Featured Trip */}
        <Text style={styles.sectionTitleFeatured}>Featured Trip</Text>
        {loading ? (
          <Text style={{ margin: 20 }}>Loading featured trip...</Text>
        ) : error ? (
          <Text style={{ margin: 20, color: 'red' }}>{error}</Text>
        ) : featuredTrip && itinerary ? (
          <FeaturedTripCard itinerary={itinerary} featuredTrip={featuredTrip} />
        ) : null}

        {/* Recommended Trips */}
        <Text style={styles.sectionTitle}>Recommended Trips</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          onScroll={handleItinScroll}
          scrollEventThrottle={16}
        >
          {loadingItins ? (
            <Text style={{ margin: 20 }}>Loading recommended trips...</Text>
          ) : errorItins ? (
            <Text style={{ margin: 20, color: 'red' }}>{errorItins}</Text>
          ) : prebuiltItineraries && prebuiltItineraries.length > 0 ? (
            prebuiltItineraries.map((itin: ItineraryCardSummary) => (
              <RecommendedTripCard key={itin.id} itin={itin} />
            ))
          ) : (
            <Text style={{ margin: 20 }}>No recommended trips found.</Text>
          )}
        </ScrollView>

        {/* Pagination dots */}
        {prebuiltItineraries.length > 0 && (
          <View style={styles.pagination}>
            {prebuiltItineraries.slice(0, 6).map((_: any, i: number) => (
              <View key={i} style={i === activeItinIndex ? styles.dotActive : styles.dot} />
            ))}
          </View>
        )}

        {/* Popular Destinations */}
<View style={styles.rowBetween}>
  <Text style={styles.sectionTitle}>Popular Destinations</Text>
  <TouchableOpacity onPress={() => navigation.navigate('AllDestinations')}>
    <Text style={styles.viewAll}>View All</Text>
  </TouchableOpacity>
</View>
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{ paddingRight: 8 }}
  style={{ marginBottom: 16 }}
>
  {loadingDest ? (
    <Text style={{ margin: 20 }}>Loading destinations...</Text>
  ) : errorDest ? (
    <Text style={{ margin: 20, color: 'red' }}>{errorDest}</Text>
  ) : destinations && destinations.length > 0 ? (
    destinations.map((dest: any) => (
      <DestinationCard
        key={dest.id}
        id={dest.id}
        title={dest.name}
        imageUrl={dest.imageUrl}
        country={dest.country}
        flag={dest.flag}
      />
    ))
  ) : (
    <Text style={{ margin: 20 }}>No destinations found.</Text>
  )}
</ScrollView>

        {/* Popular Articles */}
        <Text style={styles.sectionTitle}>Popular Articles</Text>
        <View style={styles.articlesRow}>
          <View style={styles.articleCard} />
          <View style={styles.articleCard} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
