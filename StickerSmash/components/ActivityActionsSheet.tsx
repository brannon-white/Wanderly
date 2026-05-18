import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ItineraryActivity } from '@/types/itinerary';
import type { ActivityAction } from './ReplaceSuggestionsSheet';

const ACTIONS: {
  action: ActivityAction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  separator?: boolean;
}[] = [
  { action: 'replace', label: 'Replace Activity', icon: 'refresh-outline' },
  { action: 'cheaper', label: 'Cheaper Option', icon: 'cash-outline' },
  { action: 'similar_nearby', label: 'Similar Nearby', icon: 'location-outline' },
  { action: 'more_relaxing', label: 'More Relaxing', icon: 'leaf-outline' },
  { action: 'more_popular', label: 'More Popular', icon: 'star-outline' },
  { action: 'hidden_gem', label: 'Hidden Gem Nearby', icon: 'compass-outline', separator: true },
  { action: 'remove', label: 'Remove Activity', icon: 'trash-outline', destructive: true },
];

interface Props {
  activity: ItineraryActivity | null;
  visible: boolean;
  onAction: (action: ActivityAction) => void;
  onDismiss: () => void;
}

export default function ActivityActionsSheet({ activity, visible, onAction, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!activity) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 8, transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="box-none"
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Activity header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="location" size={14} color="#6A62B7" />
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>{activity.name}</Text>
          {activity.locked && (
            <Ionicons name="lock-closed" size={13} color="#AAA" style={{ marginLeft: 6 }} />
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions */}
        {ACTIONS.map(({ action, label, icon, destructive, separator }) => (
          <React.Fragment key={action}>
            {separator && <View style={styles.thinDivider} />}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                onDismiss();
                setTimeout(() => onAction(action), 160);
              }}
              activeOpacity={0.65}
            >
              <View style={[styles.iconWrap, destructive && styles.iconWrapDestructive]}>
                <Ionicons
                  name={icon}
                  size={17}
                  color={destructive ? '#E74C3C' : '#6A62B7'}
                />
              </View>
              <Text style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}>
                {label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0DBEF',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  headerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F0EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-Regular',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EEF8',
    marginBottom: 6,
  },
  thinDivider: {
    height: 1,
    backgroundColor: '#F7F5FF',
    marginHorizontal: 20,
    marginVertical: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F0EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDestructive: {
    backgroundColor: '#FEF0EE',
  },
  actionLabel: {
    fontSize: 15,
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-Regular',
  },
  actionLabelDestructive: {
    color: '#E74C3C',
  },
});
