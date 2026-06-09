import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GeneratedItinerary } from '@/types/itinerary';
import { suggestStopAlternatives, reworkStop } from '@/services/regenerateItinerary';
import { getUsageStatus } from '@/services/purchases';

const PURPLE = '#6A62B7';

interface Props {
  itineraryId: string;
  stopIndex: number | null;
  stopLocation?: string;
  onDone: (updated: GeneratedItinerary) => void;
  onDismiss: () => void;
  onPaywallNeeded: () => void;
}

type Mode = 'menu' | 'swap';

export default function StopReworkSheet({
  itineraryId, stopIndex, stopLocation, onDone, onDismiss, onPaywallNeeded,
}: Props) {
  const visible = stopIndex !== null;
  const [mode, setMode] = useState<Mode>('menu');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [customCity, setCustomCity] = useState('');
  const [working, setWorking] = useState(false);

  // Reset to the menu each time the sheet opens for a stop.
  useEffect(() => {
    if (visible) {
      setMode('menu');
      setAlternatives([]);
      setCustomCity('');
      setWorking(false);
    }
  }, [visible, stopIndex]);

  async function hasCreditOrPaywall(): Promise<boolean> {
    const usage = await getUsageStatus().catch(() => null);
    if (usage && !usage.isPro && usage.regensLeft <= 0) {
      onPaywallNeeded();
      return false;
    }
    return true;
  }

  async function openSwap() {
    setMode('swap');
    if (stopIndex === null) return;
    setLoadingAlts(true);
    try {
      const { alternatives: alts } = await suggestStopAlternatives({ itineraryId, stopIndex });
      setAlternatives(alts);
    } catch {
      setAlternatives([]);
    } finally {
      setLoadingAlts(false);
    }
  }

  async function doRework(action: 'remove' | 'replace', newLocation?: string) {
    if (stopIndex === null || working) return;
    if (!(await hasCreditOrPaywall())) return;
    setWorking(true);
    try {
      const { itinerary } = await reworkStop({ itineraryId, stopIndex, action, newLocation });
      onDone(itinerary);
    } catch (e) {
      Alert.alert('Could not update trip', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  }

  function confirmRemove() {
    Alert.alert(
      `Remove ${stopLocation ?? 'this city'}?`,
      'Its days will be folded into the previous stop so your trip keeps the same length.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => doRework('remove') },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={working ? undefined : onDismiss}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.handle} />

          {working ? (
            <View style={styles.workingBox}>
              <ActivityIndicator size="large" color={PURPLE} />
              <Text style={styles.workingText}>Reworking your trip…</Text>
              <Text style={styles.workingSub}>Re-planning the stop and re-routing the drive.</Text>
            </View>
          ) : mode === 'menu' ? (
            <>
              <Text style={styles.title}>{stopLocation ?? 'This city'}</Text>
              <Text style={styles.subtitle}>Not feeling this stop? Swap it for somewhere else or remove it.</Text>

              <TouchableOpacity style={styles.row} onPress={openSwap}>
                <Ionicons name="swap-horizontal" size={20} color={PURPLE} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Swap city</Text>
                  <Text style={styles.rowSub}>Pick a different city for these days</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#bbb" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.row} onPress={confirmRemove}>
                <Ionicons name="trash-outline" size={20} color="#C2683B" />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: '#C2683B' }]}>Remove city</Text>
                  <Text style={styles.rowSub}>Fold its days into the previous stop</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.swapHeader}>
                <TouchableOpacity onPress={() => setMode('menu')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={22} color={PURPLE} />
                </TouchableOpacity>
                <Text style={styles.title}>Swap {stopLocation ?? 'city'}</Text>
                <View style={{ width: 22 }} />
              </View>

              <Text style={styles.subtitle}>Suggested along your route</Text>
              {loadingAlts ? (
                <ActivityIndicator color={PURPLE} style={{ marginVertical: 16 }} />
              ) : alternatives.length > 0 ? (
                <ScrollView style={{ maxHeight: 200 }}>
                  {alternatives.map((city) => (
                    <TouchableOpacity key={city} style={styles.chip} onPress={() => doRework('replace', city)}>
                      <Ionicons name="location-outline" size={16} color={PURPLE} />
                      <Text style={styles.chipText}>{city}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptyText}>No suggestions right now — type a city below.</Text>
              )}

              <Text style={[styles.subtitle, { marginTop: 14 }]}>Or enter a city</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Memphis, TN"
                  placeholderTextColor="#aaa"
                  value={customCity}
                  onChangeText={setCustomCity}
                  autoCapitalize="words"
                  returnKeyType="go"
                  onSubmitEditing={() => customCity.trim() && doRework('replace', customCity.trim())}
                />
                <TouchableOpacity
                  style={[styles.goBtn, !customCity.trim() && styles.goBtnDisabled]}
                  disabled={!customCity.trim()}
                  onPress={() => doRework('replace', customCity.trim())}
                >
                  <Text style={styles.goText}>Go</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-SemiBold',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'SourceSans3-Regular',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-SemiBold',
  },
  rowSub: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
    marginTop: 1,
  },
  cancelBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    color: PURPLE,
    fontFamily: 'SourceSans3-SemiBold',
  },
  swapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F2FE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  chipText: {
    fontSize: 15,
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-SemiBold',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
    marginTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2ddef',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-Regular',
  },
  goBtn: {
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  goBtnDisabled: { opacity: 0.4 },
  goText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'SourceSans3-SemiBold',
  },
  workingBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  workingText: {
    fontSize: 16,
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-SemiBold',
    marginTop: 16,
  },
  workingSub: {
    fontSize: 13,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
    marginTop: 4,
  },
});
