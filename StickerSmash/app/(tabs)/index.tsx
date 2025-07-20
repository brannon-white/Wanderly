import React from 'react';
import { SafeAreaView, View, Text, TextInput, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';
import { useFeaturedItinerary } from '@/hooks/userFeaturedItinerary';
import { useMatchingItineraries } from '@/hooks/useMatchingItineraries';
import auth from '@react-native-firebase/auth'; // Add this import

export default function DiscoverScreen() {
  const { featuredTrip, itinerary, loading, error } = useFeaturedItinerary();

  // Get the current user's uid
  const uid = auth().currentUser?.uid ?? '';
  const { prebuiltItineraries, loading: loadingItins, error: errorItins } = useMatchingItineraries(uid);
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Feather name="menu" size={28} color="#222" />
        </TouchableOpacity>
        <Text style={styles.title}>Discover</Text>
        <TouchableOpacity>
          <Image
            source={require('@/assets/images/OnboardingParrot.png')}
            style={styles.avatar}
          />
        </TouchableOpacity>
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
  <View style={styles.featuredTripCard}>
    <Image
      source={{ uri: itinerary.heroImage || 'https://via.placeholder.com/400x200?text=No+Image' }}
      style={styles.featuredTripImage}
      resizeMode="cover"
    />
    <View style={styles.featuredTripContent}>
      <Text style={styles.featuredTripTitle}>{itinerary.title}</Text>
      <Text style={styles.featuredTripSubtitle}>
        {Array.isArray(itinerary.summary)
          ? itinerary.summary.map((item: string) => `• ${item}`).join('\n')
          : ''}
      </Text>
      <TouchableOpacity style={styles.featuredTripButton}>
        <Text style={styles.featuredTripButtonText}>Start with this trip</Text>
      </TouchableOpacity>
      {featuredTrip.badge && (
        <Text style={{ marginTop: 8, color: '#6A62B7', fontWeight: 'bold' }}>
          {featuredTrip.badge}
        </Text>
      )}
    </View>
  </View>
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
      <View key={itin.id} style={styles.recommendedCard}>
        <View style={styles.recommendedCardContent}>
          <Text style={styles.recommendedCardTitle}>{itin.title}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>
              {itin.rating ? itin.rating : '4.5'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.heartIcon}>
          <Ionicons name="heart" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
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
        <View style={styles.popularRow}>
          <View style={styles.popularCard}>
            <Text style={styles.popularCardTitle}>Greenough, Montana</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>4.5</Text>
            </View>
            <TouchableOpacity style={styles.heartIconSmall}>
              <Ionicons name="heart" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.popularCard}>
            <Text style={styles.popularCardTitle}>North Mountain</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>4.5</Text>
            </View>
            <TouchableOpacity style={styles.heartIconSmall}>
              <Ionicons name="heart" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

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