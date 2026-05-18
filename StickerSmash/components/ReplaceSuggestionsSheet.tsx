import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import type { ItineraryActivity, GeneratedItinerary } from '@/types/itinerary';
import { getSuggestedReplacements, confirmActivityReplacement } from '@/services/regenerateItinerary';
import { searchPhoto } from '@/services/unsplash';

export type ActivityAction =
  | 'replace'
  | 'cheaper'
  | 'similar_nearby'
  | 'more_relaxing'
  | 'more_popular'
  | 'hidden_gem'
  | 'remove';

const ACTION_LABELS: Record<ActivityAction, string> = {
  replace: 'Replace',
  cheaper: 'Cheaper Option',
  similar_nearby: 'Similar Nearby',
  more_relaxing: 'More Relaxing',
  more_popular: 'More Popular',
  hidden_gem: 'Hidden Gem Nearby',
  remove: 'Remove',
};

const REASON_FOR_ACTION: Record<ActivityAction, string | undefined> = {
  replace: undefined,
  cheaper: 'cheaper',
  similar_nearby: 'similar_nearby',
  more_relaxing: 'more_relaxing',
  more_popular: 'more_popular',
  hidden_gem: 'hidden_gem',
  remove: undefined,
};

export interface SheetTarget {
  dayIndex: number;
  activityIndex: number;
  activityName: string;
  action: ActivityAction;
}

interface Props {
  itineraryId: string;
  target: SheetTarget | null;
  onConfirmed: (updatedItinerary: GeneratedItinerary) => void;
  onDismiss: () => void;
  sheetRef: React.RefObject<BottomSheet | null>;
  onPaywallNeeded?: () => void;
}

type SheetState = 'idle' | 'loading' | 'ready' | 'confirming';

export default function ReplaceSuggestionsSheet({
  itineraryId,
  target,
  onConfirmed,
  onDismiss,
  sheetRef,
  onPaywallNeeded,
}: Props) {
  const [state, setState] = useState<SheetState>('idle');
  const [candidates, setCandidates] = useState<ItineraryActivity[]>([]);
  const [candidateImages, setCandidateImages] = useState<Record<number, string>>({});
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
  const currentTarget = useRef<SheetTarget | null>(null);

  useEffect(() => {
    if (!target) return;
    currentTarget.current = target;
    setState('loading');
    setCandidates([]);
    setCandidateImages({});

    const reason = REASON_FOR_ACTION[target.action];
    getSuggestedReplacements({
      itineraryId,
      dayIndex: target.dayIndex,
      activityIndex: target.activityIndex,
      reason,
      count: 3,
    })
      .then(({ candidates: items }) => {
        if (currentTarget.current !== target) return;
        setCandidates(items);
        setState('ready');
        items.forEach((item, idx) => {
          if (!item.name) return;
          searchPhoto(item.name).then((uri) => {
            if (uri) setCandidateImages((prev) => ({ ...prev, [idx]: uri }));
          }).catch(() => {});
        });
      })
      .catch((err) => {
        if (currentTarget.current !== target) return;
        setState('idle');
        sheetRef.current?.close();
        if (err instanceof Error && /regen_limit_reached/i.test(err.message)) {
          onPaywallNeeded?.();
        } else {
          Alert.alert('Could not fetch suggestions', err instanceof Error ? err.message : 'Please try again.');
        }
      });
  }, [target]);

  const handleSelectCandidate = useCallback(async (candidate: ItineraryActivity, index: number) => {
    if (!target || state === 'confirming') return;
    setState('confirming');
    setConfirmingIndex(index);
    try {
      const { itinerary } = await confirmActivityReplacement({
        itineraryId,
        dayIndex: target.dayIndex,
        activityIndex: target.activityIndex,
        candidateActivity: candidate,
      });
      sheetRef.current?.close();
      onConfirmed(itinerary);
    } catch (err) {
      setState('ready');
      setConfirmingIndex(null);
      Alert.alert('Could not replace activity', err instanceof Error ? err.message : 'Please try again.');
    }
  }, [target, state, itineraryId, onConfirmed, sheetRef]);

  const handleClose = useCallback(() => {
    currentTarget.current = null;
    setState('idle');
    setCandidates([]);
    sheetRef.current?.close();
    onDismiss();
  }, [onDismiss, sheetRef]);

  const snapPoints = ['65%', '90%'];

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              {target ? `${ACTION_LABELS[target.action]}` : 'Suggestions'}
            </Text>
            {target && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {target.activityName}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#555" />
          </TouchableOpacity>
        </View>

        {state === 'loading' && (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#6A62B7" />
            <Text style={styles.loadingText}>Finding alternatives...</Text>
          </View>
        )}

        {(state === 'ready' || state === 'confirming') && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.candidateList}
          >
            {candidates.map((candidate, idx) => (
              <TouchableOpacity
                key={`${candidate.name}-${idx}`}
                style={[
                  styles.candidateCard,
                  confirmingIndex === idx && styles.candidateCardConfirming,
                ]}
                onPress={() => handleSelectCandidate(candidate, idx)}
                disabled={state === 'confirming'}
                activeOpacity={0.8}
              >
                {confirmingIndex === idx ? (
                  <View style={styles.confirmingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}

                <View style={styles.candidateImageWrapper}>
                  {candidateImages[idx] ? (
                    <Image
                      source={{ uri: candidateImages[idx] }}
                      style={styles.candidateImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.candidateImage, styles.candidateImagePlaceholder]}>
                      <Ionicons name="image-outline" size={28} color="#C4BFDF" />
                    </View>
                  )}
                </View>

                <View style={styles.candidateInfo}>
                  <Text style={styles.candidateName} numberOfLines={2}>
                    {candidate.name}
                  </Text>

                  {candidate.category ? (
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{candidate.category}</Text>
                    </View>
                  ) : null}

                  <View style={styles.candidateMeta}>
                    {candidate.rating ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={11} color="#F5A623" />
                        <Text style={styles.ratingText}>{candidate.rating.toFixed(1)}</Text>
                      </View>
                    ) : null}
                    {candidate.cost ? (
                      <Text style={styles.costText}>{candidate.cost}</Text>
                    ) : null}
                  </View>

                  {candidate.time ? (
                    <Text style={styles.timeText}>{candidate.time}</Text>
                  ) : null}

                  <View style={styles.tapHint}>
                    <Text style={styles.tapHintText}>Tap to select</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    backgroundColor: '#D0CDE8',
    width: 40,
  },
  container: {
    flex: 1,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    fontFamily: 'SourceSans3-Regular',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
    fontFamily: 'SourceSans3-Regular',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 48,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
  },
  candidateList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  candidateCard: {
    width: 180,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  candidateCardConfirming: {
    opacity: 0.7,
  },
  confirmingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(106,98,183,0.6)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  candidateImageWrapper: {
    width: '100%',
    height: 110,
  },
  candidateImage: {
    width: '100%',
    height: 110,
  },
  candidateImagePlaceholder: {
    backgroundColor: '#E8E6F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateInfo: {
    padding: 10,
    gap: 4,
  },
  candidateName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
    lineHeight: 18,
    fontFamily: 'SourceSans3-Regular',
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  categoryPillText: {
    fontSize: 10,
    color: '#6A62B7',
    fontFamily: 'SourceSans3-Regular',
    textTransform: 'capitalize',
  },
  candidateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#555',
    fontFamily: 'SourceSans3-Regular',
  },
  costText: {
    fontSize: 11,
    color: '#3D9970',
    fontFamily: 'SourceSans3-Regular',
  },
  timeText: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'SourceSans3-Regular',
    marginTop: 2,
  },
  tapHint: {
    marginTop: 6,
    backgroundColor: '#6A62B7',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  tapHintText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'SourceSans3-Regular',
  },
});
