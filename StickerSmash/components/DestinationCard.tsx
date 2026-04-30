import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/discoverScreenStyles';

type DestinationCardProps = {
  id: string;
  title: string;
  imageUrl: string;
};

export default function DestinationCard({ id, title, imageUrl }: DestinationCardProps) {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <TouchableOpacity
      style={styles.destinationCard}
      onPress={() => navigation.navigate('DestinationDetail', { id })}
      activeOpacity={0.9}
    >
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
    </TouchableOpacity>
  );
}
