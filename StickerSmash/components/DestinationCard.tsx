import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';

export default function DestinationCard({ title }: { title: string }) {
  return (
    <View style={styles.popularCard}>
      <Text style={styles.popularCardTitle}>{title}</Text>
      <View style={styles.ratingRow}>
        <Ionicons name="star" size={14} color="#FFD700" />
        <Text style={styles.ratingText}>4.5</Text>
      </View>
      <TouchableOpacity style={styles.heartIconSmall}>
        <Ionicons name="heart" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}