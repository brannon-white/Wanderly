import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/destinationScreenStyles';
import { DEMO_DESTINATIONS, DEMO_DESTINATION_DETAILS } from '@/data/demoData';
import { useSaved } from '@/context/SavedContext';
import { useTripPlanning } from '@/context/TripPlanningContext';

type NavProp = StackNavigationProp<RootStackParamList, 'DestinationScreen'>;
type RoutePropType = RouteProp<RootStackParamList, 'DestinationScreen'>;

export default function DestinationScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  const { isSaved, toggleSaved } = useSaved();
  const { setDestinationId, reset } = useTripPlanning();
  const [showSavedToast, setShowSavedToast] = useState(false);

  const destination = DEMO_DESTINATIONS.find((d) => d.id === id) ?? DEMO_DESTINATIONS[0];
  const detail = DEMO_DESTINATION_DETAILS[destination.id];
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
    if (!saved) {
      setShowSavedToast(true);
    }
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

  return (
    <View style={styles.container}>
      {/* Hero image */}
      <Image source={{ uri: destination.imageUrl }} style={styles.heroImage} />

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

        {detail?.description ? (
          <Text style={styles.description}>{detail.description}</Text>
        ) : null}

        {detail?.gallery?.length ? (
          <>
            <Text style={styles.sectionTitle}>Gallery</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.galleryScroll}
            >
              {detail.gallery.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          </>
        ) : null}
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
