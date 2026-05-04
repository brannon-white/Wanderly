import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import auth from '@react-native-firebase/auth';
import { PRIMARY, BORDER_COLOR, TEXT_DARK, TEXT_GRAY } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useMyTrips } from '@/context/MyTripsContext';
import { generateItinerary } from '@/services/generateItinerary';

type NavProp = StackNavigationProp<RootStackParamList>;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—';
  const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  return `${fmt(start)} to ${fmt(end)}, ${end.getFullYear()}`;
}

function EditIcon({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="pencil-outline" size={20} color={PRIMARY} />
    </TouchableOpacity>
  );
}

function SectionDivider() {
  return <View style={styles.divider} />;
}

export default function TripReviewScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const {
    editingTripId,
    destinationId,
    destinationSnapshot,
    party,
    startDate,
    endDate,
    interests,
    budget,
    reset,
  } = useTripPlanning();
  const isEditing = !!editingTripId;

  const [generating, setGenerating] = useState(false);
  const { addTrip, updateTrip } = useMyTrips();

  const destination = destinationSnapshot ?? { id: destinationId, name: 'Unknown', country: '', flag: '', imageUrl: '' };

  const handleBuild = async () => {
    const currentUser = auth().currentUser;

    if (!currentUser) {
      Alert.alert(
        'Sign in required',
        'You need to be signed in to generate and save a real itinerary.'
      );
      return;
    }

    if (!destinationId || !party || !startDate || !endDate || !budget) {
      Alert.alert(
        'Trip details missing',
        'Destination, party, dates, and budget are required before generating an itinerary.'
      );
      return;
    }

    setGenerating(true);

    try {
      const response = await generateItinerary({
        destinationId,
        destinationName: destination.name,
        country: destination.country,
        party,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interests,
        budget,
      });

      const committedId = `committed-${response.itineraryId}`;
      addTrip({
        id: committedId,
        templateId: response.itineraryId,
        title: response.itinerary.title,
        heroImage: response.itinerary.heroImage,
        party,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        origin: 'generated',
        interests,
        budget,
      });

      setTimeout(() => {
        setGenerating(false);
        reset();
        navigation.navigate('ItineraryScreen', {
          id: response.itineraryId,
          source: 'mytrips',
          committedTripId: committedId,
        });
      }, 300);
    } catch (error) {
      console.warn('generateItinerary failed', error);
      setGenerating(false);
      const message =
        error instanceof Error && /unauth/i.test(error.message)
          ? 'Your sign-in session was not attached to the request. Sign out, sign in again, and retry.'
          : 'The itinerary could not be generated right now. Please try again.';
      Alert.alert('Generation failed', message);
    }
  };

  const handleSaveChanges = () => {
    if (!editingTripId || !startDate || !endDate) return;

    updateTrip(editingTripId, {
      party,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      interests,
      budget,
    });
    reset();
    navigation.navigate('Index' as any, { screen: 'MyTrips' } as any);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}> 
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="location-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Destination</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('DestinationScreen', { searchedDestination: { id: destination.id, name: destination.name, country: destination.country, flag: destination.flag, imageUrl: destination.imageUrl, gallery: [] } })} />
          </View>
          <View style={styles.destinationContent}>
            <Image source={{ uri: destination.imageUrl }} style={styles.destinationImage} />
            <View>
              <Text style={styles.destinationName}>{destination.name}, {destination.country}</Text>
              <View style={styles.countryRow}>
                {destination.flag ? <Text style={styles.flag}>{destination.flag}</Text> : null}
                <Text style={styles.countryText}>{destination.country}</Text>
              </View>
            </View>
          </View>
        </View>

        <SectionDivider />

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="people-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Party</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('TripParty')} />
          </View>
          <Text style={styles.sectionValue}>{party || '—'}</Text>
        </View>

        <SectionDivider />

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="calendar-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Trip Dates</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('TripDates')} />
          </View>
          <Text style={styles.sectionValue}>{formatDateRange(startDate, endDate)}</Text>
        </View>

        <SectionDivider />

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="star-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>
              {interests.length} {interests.length === 1 ? 'Interest' : 'Interests'}
            </Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('TripInterests')} />
          </View>
          <View style={styles.pillsRow}>
            {interests.map(i => (
              <View key={i} style={styles.pill}>
                <Text style={styles.pillText}>{i}</Text>
              </View>
            ))}
          </View>
        </View>

        <SectionDivider />

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="cash-outline" size={18} color={TEXT_GRAY} />
            </View>
            <Text style={styles.sectionLabel}>Budget</Text>
            <View style={{ flex: 1 }} />
            <EditIcon onPress={() => navigation.navigate('TripBudget')} />
          </View>
          <Text style={styles.sectionValue}>{budget || '—'}</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}> 
        {isEditing ? (
          <TouchableOpacity style={styles.buildBtn} onPress={handleSaveChanges} activeOpacity={0.85}>
            <Text style={styles.buildBtnText}>Save Changes</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.buildBtn} onPress={handleBuild} activeOpacity={0.85}>
            <Text style={styles.buildBtnText}>Build My Itinerary</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={generating} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginBottom: 20 }} />
            <Text style={styles.generatingTitle}>Generating Itinerary...</Text>
            <Text style={styles.generatingSubtitle}>
              Please wait while our AI works its magic to create the perfect trip plan tailored to your preferences.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionIcon: {
    width: 28,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
  },
  sectionValue: {
    fontSize: 15,
    fontFamily: 'SourceSans3-Regular',
    color: TEXT_DARK,
    paddingLeft: 36,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
  },
  destinationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 36,
  },
  destinationImage: {
    width: 70,
    height: 56,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  destinationName: {
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
    marginBottom: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flag: {
    fontSize: 14,
  },
  countryText: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 36,
  },
  pill: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 13,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-Regular',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  buildBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 32,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buildBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Merriweather_24pt-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  generatingTitle: {
    fontSize: 18,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 12,
  },
  generatingSubtitle: {
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
    color: TEXT_GRAY,
    textAlign: 'center',
    lineHeight: 22,
  },
});
