import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { styles } from '@/styles/discoverScreenStyles';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';

export default function FeaturedTripCard({ itinerary, featuredTrip }: { itinerary: any, featuredTrip: any }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  if (!itinerary || !featuredTrip) return null;

  const tripId = featuredTrip.tripId ?? itinerary.id;
  const durationDays = itinerary.durationDays ?? featuredTrip.durationDays;
  const summaryItems: string[] = Array.isArray(itinerary.summary) && itinerary.summary.length > 0
    ? itinerary.summary
    : [];
  const interestTags: string[] = Array.isArray(itinerary.interests) ? itinerary.interests : [];

  return (
    <View style={styles.featuredTripCard}>
      <Image
        source={{ uri: itinerary.heroImage || featuredTrip.heroImage || 'https://via.placeholder.com/400x200?text=No+Image' }}
        style={styles.featuredTripImage}
        resizeMode="cover"
      />
      <View style={styles.featuredTripContent}>
        <Text style={styles.featuredTripTitle}>{itinerary.title || featuredTrip.title}</Text>

        {durationDays ? (
          <Text style={{ fontSize: 13, color: '#6A62B7', marginBottom: 10, fontFamily: 'SourceSans3-Regular' }}>
            {durationDays} days
          </Text>
        ) : null}

        {summaryItems.length > 0 && (
          <Text style={styles.featuredTripSubtitle}>
            {summaryItems.map((item: string) => `• ${item}`).join('\n')}
          </Text>
        )}

        {interestTags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {interestTags.map((tag: string) => (
              <View key={tag} style={{ backgroundColor: '#f0eeff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: '#6A62B7', fontSize: 12, fontFamily: 'SourceSans3-Regular' }}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.featuredTripButton}
          onPress={() => navigation.navigate('ItineraryScreen', { id: tripId, source: 'browse' })}
        >
          <Text style={styles.featuredTripButtonText}>Start with this trip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}