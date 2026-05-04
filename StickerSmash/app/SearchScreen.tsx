import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/searchScreenStyles';
import { searchLocations, type LocationResult } from '@/services/locationSearch';
import { searchPhoto, searchPhotos } from '@/services/unsplash';

type NavProp = StackNavigationProp<RootStackParamList, 'SearchScreen'>;

const POPULAR: Array<{
  id: string;
  name: string;
  country: string;
  flag: string;
  imageUrl: string;
}> = [
  {
    id: 'new-york-city-us',
    name: 'New York City',
    country: 'United States',
    flag: '🇺🇸',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=200',
  },
  {
    id: 'barcelona-es',
    name: 'Barcelona',
    country: 'Spain',
    flag: '🇪🇸',
    imageUrl: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=200',
  },
  {
    id: 'london-gb',
    name: 'London',
    country: 'United Kingdom',
    flag: '🇬🇧',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=200',
  },
  {
    id: 'bangkok-th',
    name: 'Bangkok',
    country: 'Thailand',
    flag: '🇹🇭',
    imageUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=200',
  },
  {
    id: 'istanbul-tr',
    name: 'Istanbul',
    country: 'Türkiye',
    flag: '🇹🇷',
    imageUrl: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=200',
  },
  {
    id: 'bali-id',
    name: 'Bali',
    country: 'Indonesia',
    flag: '🇮🇩',
    imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=200',
  },
  {
    id: 'sydney-au',
    name: 'Sydney',
    country: 'Australia',
    flag: '🇦🇺',
    imageUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=200',
  },
  {
    id: 'dubai-ae',
    name: 'Dubai',
    country: 'United Arab Emirates',
    flag: '🇦🇪',
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=200',
  },
  {
    id: 'rome-it',
    name: 'Rome',
    country: 'Italy',
    flag: '🇮🇹',
    imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=200',
  },
  {
    id: 'tokyo-jp',
    name: 'Tokyo',
    country: 'Japan',
    flag: '🇯🇵',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=200',
  },
];

function ResultRow({
  item,
  onPress,
  isLoading,
}: {
  item: { id: string; name: string; country: string; flag: string; imageUrl: string | null };
  onPress: () => void;
  isLoading: boolean;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(item.imageUrl);

  useEffect(() => {
    if (!imgUrl) {
      searchPhoto(`${item.name} ${item.country} travel`).then((url) => {
        if (url) setImgUrl(url);
      });
    }
  }, [item.id]);

  return (
    <TouchableOpacity
      style={[styles.row, isLoading && styles.rowPressed]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      {imgUrl ? (
        <Image source={{ uri: imgUrl }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Ionicons name="location-outline" size={24} color="#6A62B7" />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowCountry}>
          {item.flag}  {item.country}
        </Text>
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color="#6A62B7" />
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
      )}
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchLocations(query.trim());
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
  }, [query]);

  const handleSelect = useCallback(
    async (item: { id: string; name: string; country: string; flag: string; imageUrl: string | null }) => {
      if (selectingId) return;
      setSelectingId(item.id);
      try {
        const photos = await searchPhotos(`${item.name} ${item.country} travel`, 4);
        const heroImage = item.imageUrl || photos[0] || '';
        const gallery = item.imageUrl ? photos.slice(0, 3) : photos.slice(1, 4);

        navigation.navigate('DestinationScreen', {
          searchedDestination: {
            id: item.id,
            name: item.name,
            country: item.country,
            flag: item.flag,
            imageUrl: heroImage,
            gallery,
          },
        });
      } finally {
        setSelectingId(null);
      }
    },
    [selectingId, navigation]
  );

  const showPopular = !query.trim();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#bdbdbd" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Where do you want to go?"
            placeholderTextColor="#bdbdbd"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#bdbdbd" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Popular searches */}
      {showPopular && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Most Popular Searches</Text>
          {POPULAR.map((item, index) => (
            <React.Fragment key={item.id}>
              <ResultRow
                item={item}
                onPress={() => handleSelect(item)}
                isLoading={selectingId === item.id}
              />
              {index < POPULAR.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </ScrollView>
      )}

      {/* Live search results */}
      {!showPopular && searching && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A62B7" />
        </View>
      )}

      {!showPopular && !searching && results.length === 0 && (
        <Text style={styles.emptyText}>No destinations found for "{query}"</Text>
      )}

      {!showPopular && !searching && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => (
            <ResultRow
              item={item}
              onPress={() => handleSelect(item)}
              isLoading={selectingId === item.id}
            />
          )}
        />
      )}
    </View>
  );
}
