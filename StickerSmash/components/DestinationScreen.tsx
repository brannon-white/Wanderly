import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
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

function WikiSection({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.wikiSection}>
      <Text style={styles.wikiSectionTitle}>{title}:</Text>
      <Text style={styles.wikiSectionText}>{text}</Text>
    </View>
  );
}

export default function DestinationScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { id, searchedDestination } = route.params;

  const { isSaved, toggleSaved } = useSaved();
  const { setDestinationId, reset } = useTripPlanning();
  const [showSavedToast, setShowSavedToast] = useState(false);

  const destination = searchedDestination
    ? { id: searchedDestination.id, name: searchedDestination.name, country: searchedDestination.country, flag: searchedDestination.flag, imageUrl: searchedDestination.imageUrl }
    : (DEMO_DESTINATIONS.find((d) => d.id === id) ?? DEMO_DESTINATIONS[0]);

  const demoDetail = searchedDestination
    ? null
    : DEMO_DESTINATION_DETAILS[destination.id];

  const { content, loading: wikiLoading } = useDestinationContent(destination.name, destination.country ?? '');

  const heroImage = destination.imageUrl || content?.wikiImageUrl;
  const description = demoDetail?.description || content?.description || '';
  // prefer seeded gallery, fall back to Unsplash results
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

  return (
    <View style={styles.container}>
      {/* Hero image */}
      {heroImage ? (
        <Image source={{ uri: heroImage }} style={styles.heroImage} />
      ) : (
        <View style={[styles.heroImage, styles.heroPlaceholder]} />
      )}

      {/* Overlay buttons */}
      <View style={[styles.heroOverlay, { paddingTop: insets.top + 8 }]}>
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

      {/* Saved toast */}
      {showSavedToast && (
        <View style={styles.savedToast}>
          <Text style={styles.savedToastText}>Saved!</Text>
        </View>
      )}

      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{destination.name}</Text>

        <View style={styles.countryRow}>
          {destination.flag ? <Text style={styles.flag}>{destination.flag}</Text> : null}
          <Text style={styles.countryName}>{destination.country}</Text>
        </View>

        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}

        {wikiLoading ? (
          <ActivityIndicator size="small" color="#6A62B7" style={{ marginTop: 24 }} />
        ) : (
          <>
            {/* Gallery — Unsplash or seeded */}
            {gallery.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Gallery</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.galleryScroll}
                >
                  {gallery.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.galleryImage} />
                  ))}
                </ScrollView>
              </>
            )}

            {sections.gettingThere && <WikiSection title="Getting There" text={sections.gettingThere} />}
            {sections.understand && <WikiSection title="Best Time to Visit" text={sections.understand} />}
            {sections.see && <WikiSection title="Must-See Attractions" text={sections.see} />}
            {sections.eat && <WikiSection title="Local Cuisine" text={sections.eat} />}
            {sections.do && <WikiSection title="Activities & Experiences" text={sections.do} />}
            {sections.sleep && <WikiSection title="Accommodations" text={sections.sleep} />}
            {sections.getAround && <WikiSection title="Transportation" text={sections.getAround} />}
            {sections.staySafe && <WikiSection title="Safety & Health Tips" text={sections.staySafe} />}
            {content?.language && <WikiSection title="Local Language" text={content.language} />}
            {content?.currency && <WikiSection title="Currency" text={content.currency} />}
          </>
        )}
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => {
            reset();
            setDestinationId(destination.id);
            navigation.navigate('TripParty');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>Start a Trip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
