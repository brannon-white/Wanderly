import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';

export default function FeaturedTripCard({ itinerary, featuredTrip }: { itinerary: any, featuredTrip: any }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  if (!itinerary || !featuredTrip) return null;

  const tripId = featuredTrip.tripId ?? itinerary.id;
  const durationDays = itinerary.durationDays ?? featuredTrip.durationDays;
  const badge: string | undefined = featuredTrip.badge;
  const rating = itinerary.rating ?? featuredTrip.rating;
  const reviewCount = itinerary.reviewCount ?? featuredTrip.reviewCount;
  const summaryItems: string[] = Array.isArray(itinerary.summary) ? itinerary.summary : [];
  const interestTags: string[] = Array.isArray(itinerary.interests) ? itinerary.interests : [];

  return (
    <View style={styles.featuredTripCard}>
      <View>
        <Image
          source={{ uri: itinerary.heroImage || featuredTrip.heroImage || 'https://via.placeholder.com/400x200?text=No+Image' }}
          style={styles.featuredTripImage}
          resizeMode="cover"
        />
        {badge ? (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.featuredTripContent}>
        <Text style={styles.featuredTripTitle}>{itinerary.title || featuredTrip.title}</Text>

        {/* Rating · duration meta row */}
        {(rating || durationDays) ? (
          <View style={styles.featuredMetaRow}>
            {rating ? (
              <>
                <Ionicons name="star" size={14} color="#f5a623" />
                <Text style={styles.featuredRatingText}>{rating}</Text>
                {reviewCount ? (
                  <Text style={styles.featuredReviewText}>({Number(reviewCount).toLocaleString()})</Text>
                ) : null}
              </>
            ) : null}
            {rating && durationDays ? <Text style={styles.featuredMetaDot}>•</Text> : null}
            {durationDays ? (
              <Text style={styles.featuredDurationText}>{durationDays} days</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.featuredTripSubtitle}>
          {summaryItems.length > 0
            ? summaryItems.map((item: string) => `• ${item}`).join('\n')
            : featuredTrip.description ?? featuredTrip.subtitle ?? ''}
        </Text>

        {interestTags.length > 0 && (
          <View style={styles.featuredTagsRow}>
            {interestTags.map((tag: string) => (
              <View key={tag} style={styles.featuredTag}>
                <Text style={styles.featuredTagText}>{tag}</Text>
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
