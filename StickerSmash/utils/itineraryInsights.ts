import type { ItineraryActivity, ItineraryCoordinates } from '@/types/itinerary';

export type InsightLevel = 'warning' | 'info';

export interface ActivityInsight {
  afterIndex: number;
  level: InsightLevel;
  icon: string;
  message: string;
  actionLabel?: string;
  actionType?: 'reduce_walking' | 'rework_schedule';
}

const WALKING_WARN_KM = 2.5;
const MOTORIZED_MODES = new Set(['car', 'taxi', 'bus', 'train', 'subway', 'metro', 'ferry', 'boat']);

function isMotorizedTransit(activity: ItineraryActivity): boolean {
  if (!activity.transport?.length) return false;
  return activity.transport.some((t) => MOTORIZED_MODES.has(t.mode?.toLowerCase() ?? ''));
}
const TIGHT_TRANSFER_MINUTES = 20;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseTimeMinutes(timeStr: string): number | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function getEndTime(activity: ItineraryActivity): number | null {
  const parts = activity.time.split(' - ');
  const endStr = parts[1]?.trim();
  if (!endStr) return null;
  return parseTimeMinutes(endStr);
}

function getStartTime(activity: ItineraryActivity): number | null {
  const parts = activity.time.split(' - ');
  const startStr = parts[0]?.trim();
  if (!startStr) return null;
  return parseTimeMinutes(startStr);
}

function getTransitMinutes(activity: ItineraryActivity): number {
  if (!activity.transport?.length) return 0;
  let total = 0;
  for (const t of activity.transport) {
    const numMatch = t.time.match(/(\d+)/);
    if (numMatch) total += parseInt(numMatch[1], 10);
  }
  return total;
}

// Client-side transport estimate from two coordinates. Used (a) to fill/refresh
// the between-activity label instantly after a drag-reorder, and (b) as a fallback
// in the card when the stored backend time is stale or contradicts the live
// distance — so the "long walk" warning and the transport label never disagree.
// Backend Google Routes values overwrite this once they arrive.
const WALK_MAX_KM = 1.2;
const WALK_KMH = 4.8;
const DRIVE_KMH = 30;

export function estimateTransport(
  from: ItineraryCoordinates,
  to: ItineraryCoordinates,
): { mode: 'walk' | 'car'; minutes: number; time: string } {
  const distKm = haversineKm(from.latitude, from.longitude, to.latitude, to.longitude);
  const walk = distKm <= WALK_MAX_KM;
  const minutes = Math.max(1, Math.round((distKm / (walk ? WALK_KMH : DRIVE_KMH)) * 60));
  return { mode: walk ? 'walk' : 'car', minutes, time: `${minutes} min` };
}

export function analyzeDay(activities: ItineraryActivity[]): ActivityInsight[] {
  const insights: ActivityInsight[] = [];

  for (let i = 0; i < activities.length - 1; i++) {
    const curr = activities[i];
    const next = activities[i + 1];

    if (curr.coordinates && next.coordinates && !isMotorizedTransit(curr)) {
      const distKm = haversineKm(
        curr.coordinates.latitude,
        curr.coordinates.longitude,
        next.coordinates.latitude,
        next.coordinates.longitude,
      );

      if (distKm > WALKING_WARN_KM) {
        const km = distKm.toFixed(1);
        insights.push({
          afterIndex: i,
          level: 'warning',
          icon: '⚠️',
          message: `${km} km walk to ${next.name}`,
          actionLabel: 'Reduce Walking',
          actionType: 'reduce_walking',
        });
        continue;
      }
    }

    const currEnd = getEndTime(curr);
    const nextStart = getStartTime(next);
    const transitMins = getTransitMinutes(curr);

    if (currEnd !== null && nextStart !== null) {
      const gap = nextStart - currEnd;
      if (gap < transitMins - TIGHT_TRANSFER_MINUTES || gap < 0) {
        insights.push({
          afterIndex: i,
          level: 'warning',
          icon: '⚠️',
          message: `Tight schedule between ${curr.name} and ${next.name}`,
          actionLabel: 'Rework Schedule',
          actionType: 'rework_schedule',
        });
      }
    }
  }

  const totalWalkKm = activities.reduce((sum, a, i) => {
    if (i === 0 || isMotorizedTransit(activities[i - 1])) return sum;
    const prev = activities[i - 1];
    if (!prev.coordinates || !a.coordinates) return sum;
    return sum + haversineKm(
      prev.coordinates.latitude,
      prev.coordinates.longitude,
      a.coordinates.latitude,
      a.coordinates.longitude,
    );
  }, 0);

  if (totalWalkKm > 6) {
    insights.push({
      afterIndex: -1,
      level: 'info',
      icon: '💡',
      message: `~${Math.round(totalWalkKm)} km of walking today`,
      actionLabel: 'Reduce Walking',
      actionType: 'reduce_walking',
    });
  }

  return insights;
}
