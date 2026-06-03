import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { purchaseMonthly, purchaseAnnual, restorePurchases } from '@/services/purchases';
import { logPaywallShown, logPurchaseStarted, logPurchaseCompleted } from '@/services/analytics';

const PRIMARY = '#6A62B7';
const TEXT_DARK = '#1a1a2e';
const TEXT_GRAY = '#888';

interface PaywallModalProps {
  visible: boolean;
  /** 'generation' for the itinerary limit, 'regen' for the regen limit */
  reason?: 'generation' | 'regen';
  onDismiss: () => void;
  onSuccess: () => void;
}

const FEATURES = [
  'Unlimited itinerary generations',
  'Unlimited activity & day regenerations',
  'All future Pro features',
];

export default function PaywallModal({ visible, reason = 'generation', onDismiss, onSuccess }: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<'monthly' | 'annual' | 'restore' | null>(null);

  useEffect(() => {
    if (visible) logPaywallShown(reason);
  }, [visible, reason]);

  const headline =
    reason === 'regen'
      ? "You're out of regenerations"
      : "You're on a roll";
  const subtext =
    reason === 'regen'
      ? "You've used your 3 free regenerations this month. Upgrade for unlimited."
      : "You've hit your 3 free itineraries this month. Upgrade for unlimited.";

  async function handleMonthly() {
    setLoading('monthly');
    logPurchaseStarted('monthly');
    try {
      const success = await purchaseMonthly();
      if (success) { logPurchaseCompleted('monthly'); onSuccess(); }
    } catch {
      Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handleAnnual() {
    setLoading('annual');
    logPurchaseStarted('annual');
    try {
      const success = await purchaseAnnual();
      if (success) { logPurchaseCompleted('annual'); onSuccess(); }
    } catch {
      Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handleRestore() {
    setLoading('restore');
    try {
      const restored = await restorePurchases();
      if (restored) {
        onSuccess();
      } else {
        Alert.alert('No purchases found', 'No active Pro subscription was found for this account.');
      }
    } catch {
      Alert.alert('Restore failed', 'Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.handle} />

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color={TEXT_GRAY} />
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Ionicons name="map-outline" size={32} color={PRIMARY} />
          </View>

          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subtext}>{subtext}</Text>

          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Monthly — highlighted */}
          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
            onPress={handleMonthly}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {loading === 'monthly' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <View style={styles.btnBadge}>
                  <Text style={styles.btnBadgeText}>Most Popular</Text>
                </View>
                <Text style={styles.primaryBtnTitle}>Monthly</Text>
                <Text style={styles.primaryBtnPrice}>$4.99 / month</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Annual */}
          <TouchableOpacity
            style={[styles.secondaryBtn, isLoading && styles.btnDisabled]}
            onPress={handleAnnual}
            activeOpacity={0.85}
            disabled={isLoading}
          >
            {loading === 'annual' ? (
              <ActivityIndicator color={PRIMARY} />
            ) : (
              <View style={styles.annualRow}>
                <View>
                  <Text style={styles.secondaryBtnTitle}>Annual</Text>
                  <Text style={styles.secondaryBtnPrice}>$39.99 / year</Text>
                </View>
                <View style={styles.savingsChip}>
                  <Text style={styles.savingsText}>Save $20</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestore} disabled={isLoading} style={styles.restoreBtn}>
            {loading === 'restore' ? (
              <ActivityIndicator size="small" color={TEXT_GRAY} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
    marginBottom: 12,
  },
  dismissBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    padding: 4,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f0eeff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  headline: {
    fontSize: 22,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
    color: TEXT_GRAY,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  featureList: {
    width: '100%',
    marginBottom: 24,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
    color: TEXT_DARK,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  btnBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'SourceSans3-Regular',
  },
  primaryBtnTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Merriweather_24pt-Bold',
  },
  primaryBtnPrice: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: 'SourceSans3-Regular',
    marginTop: 2,
  },
  secondaryBtn: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  annualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryBtnTitle: {
    color: TEXT_DARK,
    fontSize: 17,
    fontFamily: 'Merriweather_24pt-Bold',
  },
  secondaryBtnPrice: {
    color: TEXT_GRAY,
    fontSize: 13,
    fontFamily: 'SourceSans3-Regular',
    marginTop: 2,
  },
  savingsChip: {
    backgroundColor: '#edfaf3',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  savingsText: {
    color: '#2a9c5f',
    fontSize: 13,
    fontFamily: 'SourceSans3-Regular',
  },
  restoreBtn: {
    paddingVertical: 8,
  },
  restoreText: {
    color: TEXT_GRAY,
    fontSize: 13,
    fontFamily: 'SourceSans3-Regular',
  },
});
