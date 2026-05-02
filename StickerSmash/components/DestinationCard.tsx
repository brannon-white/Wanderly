import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';
import { useSaved } from '@/context/SavedContext';

interface Props {
  id: string;
  title: string;
  imageUrl: string;
  country?: string;
  flag?: string;
}

export default function DestinationCard({ id, title, imageUrl, country, flag }: Props) {
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(id);

  return (
    <View style={styles.destinationCard}>
      <Image source={{ uri: imageUrl }} style={styles.recommendedTripImage} resizeMode="cover" />
      <View style={styles.destinationCardContent}>
        <Text style={styles.recommendedCardTitle}>{title}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>4.5</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.heartIconSmall}
        onPress={() => toggleSaved({
          id,
          type: 'destination',
          title,
          imageUrl,
          country,
          flag,
        })}
      >
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={16} color={saved ? '#FF4B6E' : '#fff'} />
      </TouchableOpacity>
    </View>
  );
}
