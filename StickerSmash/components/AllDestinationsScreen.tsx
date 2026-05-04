import React from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { useDestinations } from '@/hooks/useDestinations';
import { useSaved } from '@/context/SavedContext';

type NavProp = StackNavigationProp<RootStackParamList>;

function DestinationGridCard({ item }: { item: any }) {
  const navigation = useNavigation<NavProp>();
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(item.id);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('DestinationScreen', {
        searchedDestination: { id: item.id, name: item.name, country: item.country ?? '', flag: item.flag ?? '', imageUrl: item.imageUrl, gallery: [] },
      })}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
      <TouchableOpacity
        style={styles.heart}
        onPress={() => toggleSaved({
          id: item.id,
          type: 'destination',
          title: item.name,
          imageUrl: item.imageUrl,
          country: item.country,
          flag: item.flag,
        })}
      >
        <Ionicons name={saved ? 'heart' : 'heart-outline'} size={16} color={saved ? '#FF4B6E' : '#fff'} />
      </TouchableOpacity>
      <View style={styles.cardFooter}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardCountry} numberOfLines={1}>
          {item.flag ? `${item.flag} ` : ''}{item.country}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AllDestinationsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { destinations, loading } = useDestinations();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <Text style={styles.title}>Popular Destinations</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={destinations}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <DestinationGridCard item={item} />}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.empty}>Loading destinations…</Text>
          ) : (
            <Text style={styles.empty}>No destinations found.</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: '48%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  cardImage: {
    width: '100%',
    height: 140,
  },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 12,
    padding: 4,
  },
  cardFooter: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  cardName: {
    fontSize: 14,
    color: '#6A62B7',
    fontFamily: 'Merriweather_24pt-Bold',
    marginBottom: 2,
  },
  cardCountry: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'SourceSans3-Regular',
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#aaa',
    fontFamily: 'SourceSans3-Regular',
    fontSize: 15,
  },
});
