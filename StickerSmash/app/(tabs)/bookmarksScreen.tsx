import React from 'react';
import { SafeAreaView, ScrollView, View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '@/styles/savedScreenStyles';
import { useSaved } from '@/context/SavedContext';
import { SavedItem } from '@/data/demoData';

function SavedCard({ item }: { item: SavedItem }) {
  const { toggleSaved } = useSaved();

  return (
    <View style={styles.card}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
        <TouchableOpacity style={styles.heartBtn} onPress={() => toggleSaved(item)}>
          <Ionicons name="heart" size={20} color="#FF4B6E" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardMeta}>
          <Text style={styles.cityName}>{item.title}</Text>
          <TouchableOpacity style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color="#555" />
          </TouchableOpacity>
        </View>

        {item.type === 'destination' ? (
          <View style={styles.countryRow}>
            {item.flag ? <Text style={styles.flag}>{item.flag}</Text> : null}
            <Text style={styles.countryName}>{item.country}</Text>
          </View>
        ) : (
          <View style={styles.countryRow}>
            <Ionicons name="star" size={13} color="#FFB800" />
            <Text style={styles.countryName}>{item.rating ?? '4.5'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function BookmarksScreen() {
  const { savedItems } = useSaved();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Saved</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search" size={20} color="#222" />
        </TouchableOpacity>
      </View>

      {savedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Nothing saved yet</Text>
          <Text style={styles.emptySubtext}>Heart destinations and trips on the home screen to save them here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {savedItems.map((item) => (
            <SavedCard key={item.id} item={item} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
