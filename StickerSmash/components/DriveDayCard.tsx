import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DriveLeg } from '@/types/itinerary';
import { decodePolyline, regionForPoints } from '@/utils/polyline';

// Lazy require so the component still renders (map omitted) where native maps
// aren't available — mirrors the pattern in ItineraryScreen.
let MapsModule:
  | {
      default: React.ComponentType<any>;
      Marker: React.ComponentType<any>;
      Polyline: React.ComponentType<any>;
    }
  | null = null;
try {
  MapsModule = require('react-native-maps');
} catch {
  MapsModule = null;
}

const ORANGE = '#C2683B';
const PURPLE = '#6A62B7';

interface DriveDayCardProps {
  drive: DriveLeg;
  fallbackFrom?: string;
  fallbackTo?: string;
  onPress?: () => void;
}

// Renders the inter-city drive as the closing step of a travel day: a vertical
// Depart → (drive: map + duration/distance) → Arrive sequence so it reads in order.
export default function DriveDayCard({ drive, fallbackFrom, fallbackTo, onPress }: DriveDayCardProps) {
  const from = drive.fromLocation || fallbackFrom || 'Start';
  const to = drive.toLocation || fallbackTo || 'Destination';

  const points = drive.encodedPolyline ? decodePolyline(drive.encodedPolyline) : [];
  const region = regionForPoints(points);
  const MapView = MapsModule?.default;
  const Marker = MapsModule?.Marker;
  const Polyline = MapsModule?.Polyline;
  const showMap = !!(MapView && Marker && Polyline && region && points.length > 1);

  const metric = [drive.durationText, drive.distanceText].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.85 : 1} onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="car-sport" size={14} color={ORANGE} />
        <Text style={styles.headerText}>Travel to {to}</Text>
      </View>

      <View style={styles.body}>
        {/* Vertical timeline spine */}
        <View style={styles.spine}>
          <View style={[styles.node, { backgroundColor: ORANGE }]} />
          <View style={styles.spineLine} />
          <View style={styles.carDot}>
            <Ionicons name="car-sport" size={11} color="#fff" />
          </View>
          <View style={styles.spineLine} />
          <View style={[styles.node, { backgroundColor: PURPLE }]} />
        </View>

        {/* Sequenced rows */}
        <View style={styles.rows}>
          {/* Depart */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>DEPART</Text>
            <Text style={styles.city} numberOfLines={1}>{from}</Text>
            {drive.departTime ? <Text style={styles.time}>Leave around {drive.departTime}</Text> : null}
          </View>

          {/* Drive (map + metric) */}
          <View style={styles.driveRow}>
            {showMap ? (
              <View style={styles.mapWrap} pointerEvents="none">
                <MapView
                  style={StyleSheet.absoluteFill}
                  initialRegion={region}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  liteMode
                >
                  <Polyline coordinates={points} strokeColor={ORANGE} strokeWidth={4} />
                  <Marker coordinate={points[0]} pinColor={ORANGE} />
                  <Marker coordinate={points[points.length - 1]} pinColor={PURPLE} />
                </MapView>
              </View>
            ) : null}
            {metric ? (
              <View style={styles.metricPill}>
                <Ionicons name="navigate" size={12} color={ORANGE} />
                <Text style={styles.metricText}>{metric}</Text>
              </View>
            ) : null}
          </View>

          {/* Arrive */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>ARRIVE</Text>
            <Text style={styles.city} numberOfLines={1}>{to}</Text>
            {drive.arriveTime ? <Text style={styles.time}>Around {drive.arriveTime}</Text> : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1E4DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FBEFE7',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerText: {
    fontSize: 13,
    color: ORANGE,
    fontFamily: 'SourceSans3-SemiBold',
    letterSpacing: 0.2,
  },
  body: {
    flexDirection: 'row',
    padding: 14,
  },
  spine: {
    width: 24,
    alignItems: 'center',
    paddingTop: 4,
  },
  node: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  spineLine: {
    width: 2,
    flex: 1,
    minHeight: 26,
    backgroundColor: '#EADFD7',
  },
  carDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    flex: 1,
    paddingLeft: 6,
  },
  row: {
    minHeight: 15,
  },
  rowLabel: {
    fontSize: 10,
    color: '#B79A8B',
    fontFamily: 'SourceSans3-SemiBold',
    letterSpacing: 0.8,
  },
  city: {
    fontSize: 15,
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-SemiBold',
  },
  time: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
    marginTop: 1,
  },
  driveRow: {
    paddingVertical: 10,
  },
  mapWrap: {
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ede7fa',
    marginBottom: 8,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#FBEFE7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metricText: {
    fontSize: 12,
    color: ORANGE,
    fontFamily: 'SourceSans3-SemiBold',
  },
});
