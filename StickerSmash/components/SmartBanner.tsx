import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ActivityInsight } from '@/utils/itineraryInsights';

interface Props {
  insight: ActivityInsight;
  onAction?: (actionType: ActivityInsight['actionType']) => void;
}

export default function SmartBanner({ insight, onAction }: Props) {
  const isWarning = insight.level === 'warning';

  return (
    <View style={[styles.banner, isWarning ? styles.bannerWarning : styles.bannerInfo]}>
      <Text style={styles.icon}>{insight.icon}</Text>
      <Text style={[styles.message, isWarning ? styles.messageWarning : styles.messageInfo]} numberOfLines={2}>
        {insight.message}
      </Text>
      {insight.actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.action, isWarning ? styles.actionWarning : styles.actionInfo]}
          onPress={() => onAction(insight.actionType)}
        >
          <Text style={[styles.actionText, isWarning ? styles.actionTextWarning : styles.actionTextInfo]}>
            {insight.actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  bannerWarning: {
    backgroundColor: '#FFF8E6',
    borderLeftWidth: 3,
    borderLeftColor: '#F5A623',
  },
  bannerInfo: {
    backgroundColor: '#F0EEFF',
    borderLeftWidth: 3,
    borderLeftColor: '#6A62B7',
  },
  icon: {
    fontSize: 14,
  },
  message: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SourceSans3-Regular',
  },
  messageWarning: {
    color: '#7A5500',
  },
  messageInfo: {
    color: '#3D3555',
  },
  action: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionWarning: {
    backgroundColor: '#F5A623',
  },
  actionInfo: {
    backgroundColor: '#6A62B7',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'SourceSans3-Regular',
  },
  actionTextWarning: {
    color: '#fff',
  },
  actionTextInfo: {
    color: '#fff',
  },
});
