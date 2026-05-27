import React from 'react';
import { Alert, SafeAreaView, ScrollView, View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/savedScreenStyles';
import { useSaved } from '@/context/SavedContext';
import { SavedItem } from '@/data/demoData';

function SavedCard({ item }: { item: SavedItem }) {
  const { toggleSaved } = useSaved();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const handlePress = () => {
    if (item.type === 'destination') {
      navigation.navigate('DestinationScreen', {
        searchedDestination: { id: item.id, name: item.title, country: item.country ?? '', flag: item.flag ?? '', imageUrl: item.imageUrl, gallery: [], destinationType: 'city' as const },
      });
    } else {
      navigation.navigate('ItineraryScreen', { id: item.id, source: 'browse' });
    }
  };

  const handleMenu = () => {
    Alert.alert(item.title, undefined, [
      { text: 'Remove from Saved', style: 'destructive', onPress: () => toggleSaved(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
        <TouchableOpacity style={styles.heartBtn} onPress={() => toggleSaved(item)}>
          <Ionicons name="heart" size={20} color="#FF4B6E" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardMeta}>
          <Text style={styles.cityName}>{item.title}</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={handleMenu}>
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
    </TouchableOpacity>
  );
}

export default function BookmarksScreen() {
  const { savedItems } = useSaved();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Saved</Text>
        <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('SearchScreen')}>
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
