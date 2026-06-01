import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  ScrollView,
  Linking,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ItineraryActivity } from '@/types/itinerary';
import type { ActivityAction } from './ReplaceSuggestionsSheet';
import {
  buildHotelSearchUrl,
  buildOpenTableUrl,
  buildExperienceUrl,
} from '@/services/bookingService';

const PURPLE = '#6A62B7';

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Restaurant',
  restaurant: 'Restaurant',
  culture: 'Culture',
  attraction: 'Attraction',
  landmark: 'Landmark',
  nature: 'Nature',
  shopping: 'Shopping',
  art: 'Art & Design',
  science: 'Museum',
  adventure: 'Adventure',
  hotel: 'Hotel',
  nightlife: 'Nightlife',
  wellness: 'Wellness',
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant-outline',
  restaurant: 'restaurant-outline',
  culture: 'library-outline',
  attraction: 'location-outline',
  landmark: 'location-outline',
  nature: 'leaf-outline',
  shopping: 'bag-handle-outline',
  art: 'color-palette-outline',
  science: 'flask-outline',
  adventure: 'compass-outline',
  hotel: 'bed-outline',
  nightlife: 'wine-outline',
  wellness: 'fitness-outline',
};

function StarRow({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= full ? 'star' : half && i === full + 1 ? 'star-half' : 'star-outline'}
          size={12}
          color="#FFB800"
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
}

function formatCount(n: number | string | undefined): string {
  const num = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
  if (isNaN(num)) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
}

interface Props {
  activity: ItineraryActivity | null;
  visible: boolean;
  onDismiss: () => void;
  imageUri?: string;
  destinationName?: string;
  country?: string;
  checkin?: string;
  checkout?: string;
  adults?: number;
  isBrowsing?: boolean;
  onAction?: (action: ActivityAction) => void;
}

export default function ActivityDetailSheet({
  activity,
  visible,
  onDismiss,
  imageUri,
  destinationName,
  country,
  checkin = '',
  checkout = '',
  adults = 2,
  isBrowsing = false,
  onAction,
}: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(700)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 58, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 700, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!activity) return null;

  const catKey = (activity.category ?? '').toLowerCase();
  const isVerifiedTrail = activity.trailDistanceMiles != null;
  const isTrailByName =
    (catKey === 'adventure' || catKey === 'nature') &&
    /\b(trail|loop|hike|trek|summit|ridge|peak|canyon|gorge|falls|narrows|landing|arch|mesa|butte|slot)\b/i.test(activity.name);
  const isHikingActivity = isVerifiedTrail || isTrailByName;
  const catLabel = isHikingActivity
    ? (isVerifiedTrail ? 'Trail' : 'Hiking')
    : (CATEGORY_LABELS[catKey] ?? activity.category ?? 'Activity');
  const catIcon: keyof typeof Ionicons.glyphMap = isHikingActivity
    ? 'walk-outline'
    : (CATEGORY_ICONS[catKey] ?? 'location-outline');

  const openMaps = () =>
    Linking.openURL(
      activity.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(activity.name)}`
    );

  const triggerAction = (action: ActivityAction) => {
    onDismiss();
    setTimeout(() => onAction?.(action), 200);
  };

  let bookingNode: React.ReactNode = null;
  if (destinationName) {
    if (catKey === 'hotel') {
      bookingNode = (
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL(buildHotelSearchUrl(destinationName, country, checkin, checkout, adults))}
        >
          <Ionicons name="bed-outline" size={16} color={PURPLE} />
          <Text style={styles.linkRowText}>Book on Booking.com</Text>
          <Ionicons name="chevron-forward" size={14} color={PURPLE} />
        </TouchableOpacity>
      );
    } else if (catKey === 'food' || catKey === 'restaurant') {
      bookingNode = (
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL(buildOpenTableUrl(activity.name, destinationName, checkin, adults, activity.coordinates))}
        >
          <Ionicons name="restaurant-outline" size={16} color={PURPLE} />
          <Text style={styles.linkRowText}>Reserve on OpenTable</Text>
          <Ionicons name="chevron-forward" size={14} color={PURPLE} />
        </TouchableOpacity>
      );
    } else if (['adventure', 'culture', 'nature', 'wellness', 'nightlife'].includes(catKey)) {
      bookingNode = (
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL(buildExperienceUrl(activity.name, destinationName))}
        >
          <Ionicons name="compass-outline" size={16} color={PURPLE} />
          <Text style={styles.linkRowText}>Find Experiences on Viator</Text>
          <Ionicons name="chevron-forward" size={14} color={PURPLE} />
        </TouchableOpacity>
      );
    }
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {/* Image */}
          <View style={styles.imageWrap}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
            ) : (
              <View style={[styles.image, styles.imageFallback]}>
                <Ionicons name={catIcon} size={40} color="#C4BFDF" />
              </View>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* Category badge */}
            <View style={styles.catRow}>
              <Ionicons name={catIcon} size={12} color={PURPLE} />
              <Text style={styles.catText}>{catLabel.toUpperCase()}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{activity.name}</Text>

            {/* Rating */}
            {typeof activity.rating === 'number' && (
              <View style={styles.ratingRow}>
                <StarRow rating={activity.rating} />
                <Text style={styles.ratingNum}> {activity.rating.toFixed(1)}</Text>
                {activity.reviewCount ? (
                  <Text style={styles.ratingCount}> ({formatCount(activity.reviewCount)} reviews)</Text>
                ) : null}
              </View>
            )}

            {/* Time + cost chips */}
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Ionicons name="time-outline" size={12} color={PURPLE} />
                <Text style={styles.chipText}>{activity.time}</Text>
              </View>
              {activity.cost ? (
                <View style={styles.chip}>
                  <Ionicons name="cash-outline" size={12} color={PURPLE} />
                  <Text style={styles.chipText}>{activity.cost}</Text>
                </View>
              ) : null}
            </View>

            {/* Trail stats — sourced from OSM geometry, not Claude */}
            {activity.trailDistanceMiles != null && (
              <View style={styles.trailStatsRow}>
                <View style={styles.trailStat}>
                  <Ionicons name="map-outline" size={14} color={PURPLE} />
                  <Text style={styles.trailStatValue}>{activity.trailDistanceMiles} mi</Text>
                </View>
                <View style={styles.trailStatDivider} />
                <View style={styles.trailStat}>
                  <Ionicons name="trending-up-outline" size={14} color={PURPLE} />
                  <Text style={styles.trailStatValue}>
                    {activity.trailDifficulty
                      ? activity.trailDifficulty.charAt(0).toUpperCase() + activity.trailDifficulty.slice(1)
                      : '—'}
                  </Text>
                </View>
                <View style={styles.trailStatDivider} />
                <View style={styles.trailStat}>
                  <Ionicons name="timer-outline" size={14} color={PURPLE} />
                  <Text style={styles.trailStatValue}>~{activity.trailDurationHours}h</Text>
                </View>
              </View>
            )}

            {/* Description */}
            {activity.description ? (
              <Text style={styles.description}>{activity.description}</Text>
            ) : null}

            <View style={styles.divider} />

            {/* Open in Maps */}
            <TouchableOpacity style={styles.linkRow} onPress={openMaps}>
              <Ionicons name="navigate-outline" size={16} color={PURPLE} />
              <Text style={styles.linkRowText}>Open in Google Maps</Text>
              <Ionicons name="chevron-forward" size={14} color={PURPLE} />
            </TouchableOpacity>

            {bookingNode}

            {/* Actions (non-browsing only) */}
            {!isBrowsing && onAction && (
              <>
                <View style={styles.divider} />
                <View style={styles.actionsGrid}>
                  <TouchableOpacity style={styles.actionTile} onPress={() => triggerAction('similar_nearby')}>
                    <Ionicons name="location-outline" size={20} color={PURPLE} />
                    <Text style={styles.actionTileText}>Similar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionTile} onPress={() => triggerAction('cheaper')}>
                    <Ionicons name="cash-outline" size={20} color={PURPLE} />
                    <Text style={styles.actionTileText}>Cheaper</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionTile} onPress={() => triggerAction('hidden_gem')}>
                    <Ionicons name="diamond-outline" size={20} color={PURPLE} />
                    <Text style={styles.actionTileText}>Hidden Gem</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionTile, styles.actionTileDestructive]}
                    onPress={() => triggerAction('remove')}
                  >
                    <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                    <Text style={[styles.actionTileText, { color: '#E74C3C' }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '87%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0DBEF',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  imageWrap: {
    height: 220,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    backgroundColor: '#F0EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  catText: {
    fontSize: 11,
    fontWeight: '700',
    color: PURPLE,
    letterSpacing: 0.8,
    fontFamily: 'SourceSans3-Regular',
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#1A1A2E',
    fontFamily: 'Merriweather_36pt-Bold',
    marginBottom: 10,
    lineHeight: 27,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingNum: {
    fontSize: 13,
    color: '#444',
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 13,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5F3FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    color: '#3D3555',
    fontFamily: 'SourceSans3-Regular',
  },
  trailStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  trailStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  trailStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#D4CFEF',
  },
  trailStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3D3555',
    fontFamily: 'SourceSans3-Regular',
  },
  description: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'SourceSans3-Regular',
    lineHeight: 21,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EEF8',
    marginVertical: 14,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    marginBottom: 10,
  },
  linkRowText: {
    flex: 1,
    fontSize: 14,
    color: PURPLE,
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 13,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
  },
  actionTileDestructive: {
    backgroundColor: '#FEF0EE',
  },
  actionTileText: {
    fontSize: 11,
    color: PURPLE,
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '600',
    textAlign: 'center',
  },
});
