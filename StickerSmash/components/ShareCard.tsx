import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { GeneratedItinerary } from '@/types/itinerary';
import type { CommittedTrip } from '@/context/MyTripsContext';
import { formatTripSubtitle } from '@/context/MyTripsContext';

interface ShareCardProps {
  itinerary: GeneratedItinerary;
  heroUri?: string;
  committedTrip?: CommittedTrip;
}

export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 500;

const ShareCard = React.forwardRef<View, ShareCardProps>(
  ({ itinerary, heroUri, committedTrip }, ref) => {
    const location = [itinerary.destinationName, itinerary.country]
      .filter(Boolean)
      .join(', ');
    const days = itinerary.days.slice(0, 4);

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1030' }]} />
        )}

        {/* Light scrim over top half */}
        <View style={styles.scrimTop} />
        {/* Heavy scrim over bottom half so text reads clearly */}
        <View style={styles.scrimBottom} />

        <View style={styles.content}>
          {/* Wanderly branding — top right */}
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>Wanderly</Text>
          </View>

          {/* Bottom content block */}
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>{itinerary.title}</Text>

            {!!location && (
              <Text style={styles.location}>{location}</Text>
            )}

            {committedTrip && (
              <Text style={styles.subtitle}>{formatTripSubtitle(committedTrip)}</Text>
            )}

            {/* Day summaries */}
            <View style={styles.dayList}>
              {days.map((day, i) => {
                const names = day.activities
                  .slice(0, 3)
                  .map(a => a.name)
                  .join('  ·  ');
                return (
                  <View key={i} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <Text style={styles.dayActivities} numberOfLines={1}>{names}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.deepLink}>
              wanderly://itinerary/{itinerary.id}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

export default ShareCard;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#1a1030',
    overflow: 'hidden',
  },
  scrimTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: 'rgba(10,5,30,0.80)',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  brandRow: {
    alignSelf: 'flex-end',
  },
  brandText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
    opacity: 0.9,
  },
  body: {
    gap: 4,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontFamily: 'Merriweather_36pt-Bold',
    lineHeight: 32,
    marginBottom: 4,
  },
  location: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 12,
    fontFamily: 'SourceSans3-Regular',
    marginBottom: 12,
  },
  dayList: {
    gap: 5,
    marginBottom: 16,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dayLabel: {
    color: '#B8B0E8',
    fontSize: 11,
    fontFamily: 'SourceSans3-Regular',
    width: 38,
    marginTop: 1,
  },
  dayActivities: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontFamily: 'SourceSans3-Regular',
    flex: 1,
  },
  deepLink: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 9,
    fontFamily: 'SourceSans3-Regular',
    marginTop: 4,
  },
});
