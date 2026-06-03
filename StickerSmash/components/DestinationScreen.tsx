import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/destinationScreenStyles';
import { DEMO_DESTINATIONS, DEMO_DESTINATION_DETAILS } from '@/data/demoData';
import type { SearchedDestination } from '@/services/locationSearch';
import { useSaved } from '@/context/SavedContext';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useDestinationContent } from '@/hooks/useDestinationContent';

type NavProp = StackNavigationProp<RootStackParamList, 'DestinationScreen'>;
type RoutePropType = RouteProp<RootStackParamList, 'DestinationScreen'>;

const SECTION_CONFIG = (cityName: string) => [
  { key: 'gettingThere' as const, title: `Getting to ${cityName}` },
  { key: 'understand' as const, title: 'Best Time to Visit' },
  { key: 'see' as const, title: 'Must-See Attractions' },
  { key: 'eat' as const, title: 'Local Cuisine' },
  { key: 'do' as const, title: 'Activities & Experiences' },
  { key: 'sleep' as const, title: 'Accommodations' },
  { key: 'getAround' as const, title: 'Transportation' },
  { key: 'staySafe' as const, title: 'Safety & Health Tips' },
  { key: 'visa' as const, title: 'Visa & Entry Requirements' },
];

function ContentSection({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}:</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

export default function DestinationScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { id, searchedDestination } = route.params;

  const { isSaved, toggleSaved } = useSaved();
  const { setDestination, reset } = useTripPlanning();
  const [showSavedToast, setShowSavedToast] = useState(false);

  const destination = searchedDestination
    ? { id: searchedDestination.id, name: searchedDestination.name, state: searchedDestination.state, country: searchedDestination.country, flag: searchedDestination.flag, imageUrl: searchedDestination.imageUrl, destinationType: searchedDestination.destinationType }
    : (DEMO_DESTINATIONS.find((d) => d.id === id) ?? DEMO_DESTINATIONS[0]);

  const demoDetail = searchedDestination
    ? null
    : DEMO_DESTINATION_DETAILS[destination.id];

  const { content, loading: wikiLoading } = useDestinationContent(destination.name, destination.country ?? '');

  const heroImage = destination.imageUrl || content?.wikiImageUrl;
  const description = demoDetail?.description || content?.description || '';
  const gallery = (demoDetail?.gallery ?? []).length > 0
    ? (demoDetail?.gallery ?? [])
    : (content?.gallery ?? []);

  const saved = isSaved(destination.id);

  const handleBookmark = () => {
    toggleSaved({
      id: destination.id,
      type: 'destination',
      title: destination.name,
      imageUrl: destination.imageUrl,
      country: destination.country,
      flag: destination.flag,
    });
    if (!saved) setShowSavedToast(true);
  };

  useEffect(() => {
    if (showSavedToast) {
      const t = setTimeout(() => setShowSavedToast(false), 1800);
      return () => clearTimeout(t);
    }
  }, [showSavedToast]);

  const handleShare = async () => {
    await Share.share({ message: `Check out ${destination.name}, ${destination.country} on Wanderly!` });
  };

  const { sections } = content ?? { sections: {} };
  const headerTop = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 24) + 8
    : insets.top + 8;

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Overlay header buttons — always on top */}
      <View style={[styles.heroOverlay, { top: headerTop }]}>
        <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={styles.heroRightBtns}>
          <TouchableOpacity style={styles.heroBtn} onPress={handleBookmark}>
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={saved ? '#6A62B7' : '#222'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color="#222" />
          </TouchableOpacity>
        </View>
      </View>

      {showSavedToast && (
        <View style={styles.savedToast}>
          <Text style={styles.savedToastText}>Saved!</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        <View style={styles.heroWrapper}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]} />
          )}
        </View>

        {/* Content card */}
        <View style={styles.card}>
          <Text style={styles.title}>{destination.name}</Text>

          <View style={styles.countryRow}>
            {destination.flag
              ? <Text style={styles.flagEmoji}>{destination.flag}</Text>
              : <View style={styles.flagDot} />
            }
            <Text style={styles.countryName}>{destination.country}</Text>
          </View>

          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}

          {wikiLoading ? (
            <ActivityIndicator size="small" color="#6A62B7" style={{ marginTop: 24 }} />
          ) : (
            <>
              {gallery.length > 0 && (
                <View style={styles.galleryBlock}>
                  <Text style={styles.galleryHeader}>Gallery</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.galleryRow}
                  >
                    {gallery.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={styles.galleryImage} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {SECTION_CONFIG(destination.name).map(({ key, title }) =>
                sections[key] ? (
                  <ContentSection key={key} title={title} text={sections[key]!} />
                ) : null
              )}

              {content?.language && !sections.gettingThere && (
                <ContentSection title="Local Language" text={content.language} />
              )}
              {content?.currency && !sections.gettingThere && (
                <ContentSection title="Currency" text={content.currency} />
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => {
            reset();
            setDestination({
              id: destination.id,
              name: destination.name,
              state: (destination as any).state,
              country: destination.country ?? '',
              flag: destination.flag ?? '',
              imageUrl: destination.imageUrl ?? '',
              destinationType: (destination as any).destinationType ?? 'city',
            });
            navigation.navigate('TripBasics');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>Start a Trip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
