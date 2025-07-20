import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { styles } from '@/styles/discoverScreenStyles';

export default function FeaturedTripCard({ itinerary, featuredTrip }: { itinerary: any, featuredTrip: any }) {
  if (!itinerary || !featuredTrip) return null;
  return (
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
  );
}