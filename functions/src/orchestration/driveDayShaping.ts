import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary, getAllDays, updateDayByIndex } from "../itinerarySchemas";
import { type StopPool, type PlaceCandidate } from "./types";

// Deterministic drive-day structure. Trip *shape* should not depend on the model
// getting it right: on a multi-stop road trip the last day at every non-final stop
// is, by definition, the travel day to the next stop. This module marks those days
// (overriding whatever the model guessed) and guarantees the traveler still has a
// real dinner waiting in the city they arrive in — pulled from that stop's verified
// candidate pool, not invented. The model still chooses the rest of the day's
// content; code owns the skeleton.

type Activity = GeneratedItinerary["stops"][number]["days"][number]["activities"][number];

// A food activity counts as the "arrival dinner" only if it actually sits in the
// arrival city — within this radius of that stop's candidate-pool center.
const ARRIVAL_DINNER_MAX_KM = 25;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Center of a stop = the median coordinate of its pooled venues (all real, all in
// that city). Avoids an extra geocode call.
function poolCenter(pool: StopPool | undefined): { lat: number; lng: number } | null {
  if (!pool) return null;
  const c = pool.candidates;
  const all = [...c.food, ...c.attractions, ...c.breakfast, ...c.scenic, ...c.nightlife];
  if (all.length === 0) return null;
  return {
    lat: median(all.map((p) => p.coordinates.lat)),
    lng: median(all.map((p) => p.coordinates.lng)),
  };
}

// "9:00 AM - 11:00 AM" → { start: "9:00 AM", end: "11:00 AM" }. Tolerant of en-dash.
function splitTimeRange(time: string | undefined): { start?: string; end?: string } {
  if (!time) return {};
  const parts = time.split(/\s*[–-]\s*/);
  return { start: parts[0]?.trim() || undefined, end: parts[1]?.trim() || undefined };
}

// "7:30 PM" → minutes since midnight, or null.
function parseClock(t: string | undefined): number | null {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function formatClock(minsOfDay: number): string {
  const m = ((minsOfDay % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const min = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(min).padStart(2, "0")} ${ap}`;
}

// Builds the fallback drive skeleton (cities + leave time). The real duration,
// distance, route geometry, and arrival time are filled by enrichDriveLegs (async API)
// — this only ensures the card has cities + a leave time if that call fails. The drive
// spans the day boundary (arrival city is the next day), so leave time = end of the
// drive day's last activity.
function buildDriveSkeleton(
  fromLocation: string,
  toLocation: string,
  activities: Activity[],
): GeneratedItinerary["stops"][number]["days"][number]["drive"] {
  const last = activities[activities.length - 1];
  const departTime = splitTimeRange(last?.time).end ?? splitTimeRange(last?.time).start;
  return { fromLocation, toLocation, departTime };
}

// Start time for the next appended arrival-city activity: right after the day's
// current last activity (a short hop). Overwritten precisely by enrichDriveLegs.
function nextStartAfter(activities: Activity[]): number {
  const last = activities[activities.length - 1];
  const prevEnd = parseClock(splitTimeRange(last?.time).end ?? splitTimeRange(last?.time).start);
  if (prevEnd == null) return 19 * 60;
  return prevEnd + 15;
}

function activityFromCandidate(
  c: PlaceCandidate,
  category: string,
  idPrefix: string,
  startMin: number,
  durationMin: number,
): Activity {
  return {
    id: `${idPrefix}-${c.placeId}`,
    name: c.name,
    category,
    description: c.editorialSummary ?? "",
    time: `${formatClock(startMin)} - ${formatClock(startMin + durationMin)}`,
    image: "",
    placeId: c.placeId,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name)}&query_place_id=${c.placeId}`,
    coordinates: { latitude: c.coordinates.lat, longitude: c.coordinates.lng },
    rating: c.rating,
    transport: [],
  };
}

// First real, unused arrival-city sight to anchor the evening so a drive day isn't
// just meals — preferring a proper attraction, then a scenic spot, then nightlife.
function pickArrivalSight(
  pool: StopPool,
  used: Set<string>,
): { candidate: PlaceCandidate; category: string } | null {
  const buckets: Array<{ list: PlaceCandidate[]; category: string }> = [
    { list: pool.candidates.attractions ?? [], category: "attraction" },
    { list: pool.candidates.scenic ?? [], category: "nature" },
    { list: pool.candidates.nightlife ?? [], category: "nightlife" },
  ];
  for (const { list, category } of buckets) {
    const found = list.find((v) => v.placeId && !used.has(v.placeId));
    if (found) return { candidate: found, category };
  }
  return null;
}

export function shapeDriveDays(
  itinerary: GeneratedItinerary,
  pools: StopPool[],
): GeneratedItinerary {
  if (!itinerary.stops || itinerary.stops.length < 2) return itinerary;

  // Every venue already on the trip, so an appended dinner never duplicates one.
  const used = new Set<string>();
  for (const s of itinerary.stops)
    for (const d of s.days)
      for (const a of d.activities) if (a.placeId) used.add(a.placeId);

  // Global day-index offset of each stop's first day.
  const offsets: number[] = [];
  let acc = 0;
  for (const s of itinerary.stops) { offsets.push(acc); acc += s.days.length; }

  let result = itinerary;
  let shaped = 0;

  for (let si = 0; si < itinerary.stops.length; si++) {
    const isFinal = si === itinerary.stops.length - 1;
    const stop = itinerary.stops[si];

    for (let di = 0; di < stop.days.length; di++) {
      const globalIdx = offsets[si] + di;
      const isLastDayOfStop = di === stop.days.length - 1;
      const shouldBeDrive = !isFinal && isLastDayOfStop;
      const day = getAllDays(result)[globalIdx];

      if (!shouldBeDrive) {
        // Code owns the flag — clear any false positive the model set.
        if (day.isDriveDay) {
          result = updateDayByIndex(result, globalIdx, { ...day, isDriveDay: false });
        }
        continue;
      }

      const arrivalPool = pools[si + 1];
      const arrivalCenter = poolCenter(arrivalPool);
      let activities = [...day.activities];

      const nearArrival = (a: Activity): boolean =>
        Boolean(arrivalCenter && a.coordinates &&
          haversineKm(arrivalCenter.lat, arrivalCenter.lng, a.coordinates.latitude, a.coordinates.longitude) <= ARRIVAL_DINNER_MAX_KM);

      // What does the arrival city already have on this day? Without a pool center we
      // fall back to "any food / any non-food" rather than skipping the guarantee.
      const hasArrivalDinner = arrivalCenter
        ? activities.some((a) => a.category === "food" && nearArrival(a))
        : activities.some((a) => a.category === "food");
      const hasArrivalSight = arrivalCenter
        ? activities.some((a) => a.category !== "food" && nearArrival(a))
        : activities.some((a) => a.category !== "food");

      if (arrivalPool && (!hasArrivalDinner || !hasArrivalSight)) {
        // The leg leading into the FIRST appended arrival activity is the drive — mark
        // it so the itinerary shows "Drive · …". Real duration is filled by enrichment.
        const departureEndIdx = activities.length - 1;
        let appendedAny = false;

        // A real arrival-city sight so the travel day isn't two restaurants in a row.
        if (!hasArrivalSight) {
          const sight = pickArrivalSight(arrivalPool, used);
          if (sight) {
            used.add(sight.candidate.placeId);
            activities.push(activityFromCandidate(sight.candidate, sight.category, "arrival-sight", nextStartAfter(activities), 90));
            appendedAny = true;
          }
        }

        // A real dinner waiting in the city they arrive in.
        if (!hasArrivalDinner) {
          const dinner = (arrivalPool.candidates.food ?? []).find((v) => v.placeId && !used.has(v.placeId));
          if (dinner) {
            used.add(dinner.placeId);
            activities.push(activityFromCandidate(dinner, "food", "arrival-dinner", nextStartAfter(activities), 90));
            appendedAny = true;
          }
        }

        if (appendedAny && departureEndIdx >= 0) {
          const prev = activities[departureEndIdx];
          const existing = prev.transport?.[0];
          activities[departureEndIdx] = { ...prev, transport: [{ mode: "car", time: existing?.time ?? "1 hr" }] };
        }
      }

      const nextStop = itinerary.stops[si + 1];
      const drive = buildDriveSkeleton(stop.location, nextStop?.location ?? "", activities);
      result = updateDayByIndex(result, globalIdx, { ...day, isDriveDay: true, drive, activities });
      shaped++;
    }
  }

  if (shaped > 0) logger.info("Drive-day shaping", { driveDays: shaped });
  return result;
}

// Pool-free re-flagging for stop edits (remove/replace). After a stop is added or
// removed, "the last day of a stop" shifts, so isDriveDay must be recomputed. Unlike
// shapeDriveDays this needs no candidate pools — the arrival dinners already exist on
// the days — it only re-marks the flag and rebuilds the drive skeleton (cities/times)
// from the itinerary itself. Route metrics are filled afterwards by enrichDriveLegs.
export function reflagDriveDays(itinerary: GeneratedItinerary): GeneratedItinerary {
  if (!itinerary.stops || itinerary.stops.length === 0) return itinerary;

  const stops = itinerary.stops.map((stop, si) => {
    const isFinal = si === itinerary.stops.length - 1;
    const nextStop = itinerary.stops[si + 1];
    const days = stop.days.map((day, di) => {
      const shouldBeDrive = !isFinal && di === stop.days.length - 1;
      if (!shouldBeDrive) {
        if (day.isDriveDay || day.drive) {
          const { drive: _drive, ...rest } = day;
          return { ...rest, isDriveDay: false };
        }
        return day;
      }
      const drive = buildDriveSkeleton(stop.location, nextStop?.location ?? "", day.activities);
      return { ...day, isDriveDay: true, drive };
    });
    return { ...stop, days };
  });

  return { ...itinerary, stops };
}

// Sequential "Day N" labels across all stops — call after adding/removing a stop.
export function relabelDays(itinerary: GeneratedItinerary): GeneratedItinerary {
  if (!itinerary.stops) return itinerary;
  let n = 0;
  const stops = itinerary.stops.map((stop, si) => ({
    ...stop,
    stopIndex: si,
    days: stop.days.map((day) => ({ ...day, label: `Day ${++n}` })),
  }));
  return { ...itinerary, stops };
}
