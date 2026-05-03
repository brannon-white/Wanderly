import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { shared, PRIMARY, PRIMARY_LIGHT, BORDER_COLOR, TEXT_DARK, TEXT_GRAY } from '@/styles/tripPlanningStyles';
import { useTripPlanning } from '@/context/TripPlanningContext';
import { useMyTrips } from '@/context/MyTripsContext';

type NavProp = StackNavigationProp<RootStackParamList>;

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7; // Monday = 0
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isBetween(date: Date, start: Date, end: Date) {
  return date > start && date < end;
}

interface MonthGridProps {
  year: number;
  month: number;
  startDate: Date | null;
  endDate: Date | null;
  onSelect: (date: Date) => void;
}

function MonthGrid({ year, month, startDate, endDate, onSelect }: MonthGridProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const offset = getFirstDayOffset(year, month);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.monthBlock}>
      <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
      <View style={styles.dayLabelsRow}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={styles.dayLabel}>{d}</Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.weekRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={styles.dayCell} />;

            const date = new Date(year, month, day);
            date.setHours(0, 0, 0, 0);
            const isPast = date < today;
            const isStart = startDate ? sameDay(date, startDate) : false;
            const isEnd = endDate ? sameDay(date, endDate) : false;
            const inRange = startDate && endDate ? isBetween(date, startDate, endDate) : false;

            return (
              <TouchableOpacity
                key={ci}
                style={[
                  styles.dayCell,
                  inRange && styles.dayCellInRange,
                  isStart && styles.dayCellRangeStart,
                  isEnd && styles.dayCellRangeEnd,
                ]}
                onPress={() => !isPast && onSelect(date)}
                activeOpacity={isPast ? 1 : 0.7}
              >
                <View style={[
                  styles.dayCircle,
                  (isStart || isEnd) && styles.dayCircleSelected,
                ]}>
                  <Text style={[
                    styles.dayText,
                    isPast && styles.dayTextPast,
                    (isStart || isEnd) && styles.dayTextSelected,
                    inRange && styles.dayTextInRange,
                  ]}>
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {/* Fill remaining cells */}
          {Array.from({ length: 7 - row.length }).map((_, ci) => (
            <View key={`pad-${ci}`} style={styles.dayCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function TripDatesScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { flow, startDate, endDate, setStartDate, setEndDate } = useTripPlanning();
  const progressWidth = flow === 'prebuilt' ? '50%' : '40%';

  const months = useMemo(() => {
    const now = new Date();
    const result: { year: number; month: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return result;
  }, []);

  const handleSelect = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
    } else if (date < startDate) {
      setStartDate(date);
      setEndDate(null);
    } else {
      setEndDate(date);
    }
  };

  const formatDate = (d: Date) =>
    `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;

  const canContinue = !!(startDate && endDate);

  return (
    <View style={shared.container}>
      <View style={[shared.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={shared.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#222" />
        </TouchableOpacity>
        <View style={shared.progressBarTrack}>
          <View style={[shared.progressBarFill, { width: progressWidth }]} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[shared.scrollContent, { paddingHorizontal: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[shared.heading, { paddingHorizontal: 4 }]}>
          When will your adventure begin and end? 📅
        </Text>
        <Text style={[shared.subheading, { paddingHorizontal: 4 }]}>
          Choose the dates for your trip. This helps us plan the perfect itinerary for your travel period.
        </Text>

        {startDate && (
          <View style={styles.selectedRow}>
            <View style={styles.selectedChip}>
              <Text style={styles.selectedChipLabel}>From</Text>
              <Text style={styles.selectedChipDate}>{formatDate(startDate)}</Text>
            </View>
            {endDate && (
              <>
                <Ionicons name="arrow-forward" size={16} color={TEXT_GRAY} />
                <View style={styles.selectedChip}>
                  <Text style={styles.selectedChipLabel}>To</Text>
                  <Text style={styles.selectedChipDate}>{formatDate(endDate)}</Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.calendarCard}>
          {months.map(({ year, month }) => (
            <MonthGrid
              key={`${year}-${month}`}
              year={year}
              month={month}
              startDate={startDate}
              endDate={endDate}
              onSelect={handleSelect}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[shared.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[shared.continueBtn, !canContinue && shared.continueBtnDisabled]}
          disabled={!canContinue}
          onPress={() => navigation.navigate(flow === 'prebuilt' ? 'TripParty' : 'TripInterests')}
          activeOpacity={0.85}
        >
          <Text style={shared.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CELL_SIZE = 44;

const styles = StyleSheet.create({
  calendarCard: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  monthBlock: {
    paddingTop: 16,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: 'Merriweather_24pt-Bold',
    color: TEXT_DARK,
    marginBottom: 12,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 13,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellInRange: {
    backgroundColor: PRIMARY_LIGHT,
  },
  dayCellRangeStart: {
    backgroundColor: PRIMARY_LIGHT,
    borderTopLeftRadius: CELL_SIZE / 2,
    borderBottomLeftRadius: CELL_SIZE / 2,
  },
  dayCellRangeEnd: {
    backgroundColor: PRIMARY_LIGHT,
    borderTopRightRadius: CELL_SIZE / 2,
    borderBottomRightRadius: CELL_SIZE / 2,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: PRIMARY,
  },
  dayText: {
    fontSize: 14,
    color: TEXT_DARK,
    fontFamily: 'SourceSans3-Regular',
  },
  dayTextPast: {
    color: '#ccc',
  },
  dayTextSelected: {
    color: '#fff',
    fontFamily: 'Merriweather_24pt-Bold',
  },
  dayTextInRange: {
    color: PRIMARY,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  selectedChip: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectedChipLabel: {
    fontSize: 11,
    color: TEXT_GRAY,
    fontFamily: 'SourceSans3-Regular',
  },
  selectedChipDate: {
    fontSize: 13,
    color: TEXT_DARK,
    fontFamily: 'Merriweather_24pt-Bold',
  },
});
