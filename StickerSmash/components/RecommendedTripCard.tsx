import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { useSaved } from '@/context/SavedContext';

export default function RecommendedTripCard({ itin }: { itin: any }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'ItineraryScreen'>>();
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(itin.id);

  return (
    <TouchableOpacity onPress={() => navigation.navigate('ItineraryScreen', { id: itin.id })} activeOpacity={0.85}>
      <View style={styles.recommendedCard}>
        <Image
          source={{ uri: itin.heroImage || 'https://via.placeholder.com/400x200?text=No+Image' }}
          style={styles.recommendedTripImage}
          resizeMode="cover"
        />
        <View style={styles.recommendedCardContent}>
          <Text style={styles.recommendedCardTitle}>{itin.title}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>{itin.rating ?? '4.5'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.heartIcon}
          onPress={() => toggleSaved({
            id: itin.id,
            type: 'itinerary',
            title: itin.title,
            imageUrl: itin.heroImage,
            rating: itin.rating,
          })}
        >
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? '#FF4B6E' : '#fff'} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
