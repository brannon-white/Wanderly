import React from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';
import { useFeaturedItinerary } from '@/hooks/userFeaturedItinerary';
import { useMatchingItineraries } from '@/hooks/useMatchingItineraries';
import auth from '@react-native-firebase/auth';
import FeaturedTripCard from '@/components/FeaturedTripCard';
import RecommendedTripCard from '@/components/RecommendedTripCard';
import DestinationCard from '@/components/DestinationCard';
import { useDestinations } from '@/hooks/useDestinations';
import { useDemo } from '@/context/DemoContext';
import { DEMO_UID } from '@/data/demoData';

export default function DiscoverScreen() {
  const { isDemoMode } = useDemo();
  const { featuredTrip, itinerary, loading, error } = useFeaturedItinerary();
  const { destinations, loading: loadingDest, error: errorDest } = useDestinations();

  const uid = isDemoMode ? DEMO_UID : (auth().currentUser?.uid ?? '');
  const { prebuiltItineraries, loading: loadingItins, error: errorItins } = useMatchingItineraries(uid);
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={22} color="#bdbdbd" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Where do you want to go?"
          placeholderTextColor="#bdbdbd"
        />
      </View>

       <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {loadingItins ? (
            <Text style={{ margin: 20 }}>Loading recommended trips...</Text>
          ) : errorItins ? (
            <Text style={{ margin: 20, color: 'red' }}>{errorItins}</Text>
          ) : prebuiltItineraries && prebuiltItineraries.length > 0 ? (
            prebuiltItineraries.map((itin: any) => (
              <RecommendedTripCard key={itin.id} itin={itin} />
            ))
          ) : (
            <Text style={{ margin: 20 }}>No recommended trips found.</Text>
          )}
        </ScrollView>

        {/* Pagination dots */}
        <View style={styles.pagination}>
          <View style={styles.dotActive} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Popular Destinations */}
<View style={styles.rowBetween}>
  <Text style={styles.sectionTitle}>Popular Destinations</Text>
  <TouchableOpacity>
    <Text style={styles.viewAll}>View All</Text>
  </TouchableOpacity>
</View>
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
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