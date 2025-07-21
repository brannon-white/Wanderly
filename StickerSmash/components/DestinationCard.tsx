import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';

export default function DestinationCard({ title, imageUrl }: { title: string; imageUrl: string }) {
  return (
    <View style={styles.destinationCard}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.recommendedTripImage}
        resizeMode="cover"
      />
      <View style={styles.destinationCardContent}>
        <Text style={styles.recommendedCardTitle}>{title}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>4.5</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.heartIconSmall}>
        <Ionicons name="heart" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}