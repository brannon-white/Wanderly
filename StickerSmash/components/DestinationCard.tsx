import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';
import { useSaved } from '@/context/SavedContext';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';

type NavProp = StackNavigationProp<RootStackParamList, 'DestinationScreen'>;

interface Props {
  id: string;
  title: string;
  imageUrl: string;
  country?: string;
  flag?: string;
}

export default function DestinationCard({ id, title, imageUrl, country, flag }: Props) {
  const { isSaved, toggleSaved } = useSaved();
  const navigation = useNavigation<NavProp>();
  const saved = isSaved(id);

  return (
    <TouchableOpacity
      style={styles.destinationCard}
      onPress={() => navigation.navigate('DestinationScreen', { id })}
      activeOpacity={0.9}
    >
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
    </TouchableOpacity>
  );
}
