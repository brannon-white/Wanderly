import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { purchaseMonthly, purchaseAnnual, restorePurchases, getCreditPacks, purchaseCreditPack, type CreditPack } from '@/services/purchases';
import { logPaywallShown, logPurchaseStarted, logPurchaseCompleted } from '@/services/analytics';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/legal';

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
  '20 itinerary generations every month',
  'Unlimited activity & day regenerations',
  'All future Pro features',
];

export default function PaywallModal({ visible, reason = 'generation', onDismiss, onSuccess }: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<'monthly' | 'annual' | 'restore' | string | null>(null);
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);

  useEffect(() => {
    if (visible) {
      logPaywallShown(reason);
      getCreditPacks().then(setCreditPacks).catch(() => {});
    }
  }, [visible, reason]);

  const headline =
    reason === 'regen'
      ? "You're out of regenerations"
      : "You're on a roll";
  const subtext =
    reason === 'regen'
      ? "You've used your 3 free regenerations this month. Go Pro for unlimited."
      : "You've used your free trips this month. Go Pro, or grab a credit pack for just the trips you need.";

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

  async function handleCreditPack(pack: CreditPack) {
    setLoading(pack.productId);
    logPurchaseStarted('credits');
    try {
      const success = await purchaseCreditPack(pack.productId);
      if (success) { logPurchaseCompleted('credits'); onSuccess(); }
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
                <Text style={styles.primaryBtnPrice}>$9.99 / month</Text>
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
                  <Text style={styles.secondaryBtnPrice}>$59.99 / year</Text>
                </View>
                <View style={styles.savingsChip}>
                  <Text style={styles.savingsText}>Save 50%</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {creditPacks.length > 0 && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or pay per trip</Text>
                <View style={styles.dividerLine} />
              </View>
              {creditPacks.map((pack) => (
                <TouchableOpacity
                  key={pack.productId}
                  style={[styles.creditBtn, isLoading && styles.btnDisabled]}
                  onPress={() => handleCreditPack(pack)}
                  activeOpacity={0.85}
                  disabled={isLoading}
                >
                  {loading === pack.productId ? (
                    <ActivityIndicator color={PRIMARY} />
                  ) : (
                    <View style={styles.creditRow}>
                      <View style={styles.creditLeft}>
                        <Ionicons name="ticket-outline" size={18} color={PRIMARY} />
                        <Text style={styles.creditTitle}>
                          {pack.credits} {pack.credits === 1 ? 'trip' : 'trips'}
                        </Text>
                      </View>
                      <Text style={styles.creditPrice}>{pack.priceString}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity onPress={handleRestore} disabled={isLoading} style={styles.restoreBtn}>
            {loading === 'restore' ? (
              <ActivityIndicator size="small" color={TEXT_GRAY} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclosure}>
            Subscriptions auto-renew at the price shown until canceled. Payment is charged to your
            App Store account; manage or cancel in your account settings. Trip credits are one-time
            purchases.
          </Text>
          <View style={styles.legalRow}>
            <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}>
              Terms of Use
            </Text>
            <Text style={styles.legalDot}>·</Text>
            <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
              Privacy Policy
            </Text>
          </View>
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
    marginBottom: 14,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontFamily: 'SourceSans3-Regular',
  },
  creditBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e6e4f5',
    backgroundColor: '#faf9ff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditTitle: {
    color: TEXT_DARK,
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
  },
  creditPrice: {
    color: PRIMARY,
    fontSize: 15,
    fontFamily: 'SourceSans3-Regular',
  },
  restoreBtn: {
    paddingVertical: 8,
    marginTop: 4,
  },
  restoreText: {
    color: TEXT_GRAY,
    fontSize: 13,
    fontFamily: 'SourceSans3-Regular',
  },
  disclosure: {
    color: TEXT_GRAY,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'SourceSans3-Regular',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  legalLink: {
    color: PRIMARY,
    fontSize: 12,
    fontFamily: 'SourceSans3-Regular',
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: TEXT_GRAY,
    fontSize: 12,
  },
});
