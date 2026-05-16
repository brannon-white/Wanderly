import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { useSaved } from '@/context/SavedContext';
import type { ItineraryCardSummary } from '@/types/itinerary';
import { searchPhoto } from '@/services/unsplash';

function isPlaceholderUrl(url?: string) {
  return !url || url.includes('placeholder.com') || url.includes('via.placeholder');
}

export default function RecommendedTripCard({ itin }: { itin: ItineraryCardSummary }) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'ItineraryScreen'>>();
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(itin.id);
  const [imageUri, setImageUri] = useState<string | undefined>(
    isPlaceholderUrl(itin.heroImage) ? undefined : itin.heroImage
  );

  useEffect(() => {
    if (!imageUri) {
      searchPhoto(`${itin.destinationName} ${itin.country ?? ''} travel`).then(url => {
        if (url) setImageUri(url);
      });
    }
  }, [itin.id]);

  return (
    <TouchableOpacity onPress={() => navigation.navigate('ItineraryScreen', { id: itin.id, source: 'browse' })} activeOpacity={0.85}>
      <View style={styles.recommendedCard}>
        <Image
          source={imageUri ? { uri: imageUri } : undefined}
          style={[styles.recommendedTripImage, !imageUri && { backgroundColor: '#e8e4ff' }]}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={200}
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
