import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary, getAllDays, mapAllDays, updateDayByIndex } from "../itinerarySchemas";

type Activity = GeneratedItinerary["stops"][number]["days"][number]["activities"][number];

// Routes API v2 — same Google Cloud project/key as Places API (New).
// The legacy Distance Matrix API is a separate product that needs separate enablement.
const ROUTES_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
// Single-route endpoint — returns geometry (polyline) + distance, which the matrix
// endpoint does not. Used for the inter-city drive leg on drive days.
const ROUTES_COMPUTE_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

type GoogleTravelMode = "DRIVE" | "WALK" | "TRANSIT";

interface RouteMatrixElement {
  originIndex: number;
  destinationIndex: number;
  status?: { code: number };
  duration?: string; // e.g. "1234s"
}

function transportModeToGoogle(mode: string): GoogleTravelMode {
  if (mode === "walk") return "WALK";
  if (mode === "subway" || mode === "bus" || mode === "train") return "TRANSIT";
  return "DRIVE";
}

function secondsToText(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// US-locale distance label (the app shows miles elsewhere).
function metersToText(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export interface DriveLeg {
  durationText: string;   // e.g. "2 hr 45 min"
  durationSeconds: number;
  distanceText: string;   // e.g. "142 mi"
  distanceMeters: number;
  encodedPolyline: string; // Google encoded polyline for a static-map route preview
}

// ── Clock helpers for sequencing depart → arrive on the drive card ──
// Parse "1:30 PM" / "01:30 PM" → minutes since midnight, or null.
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

// ── Deterministic drive-day clock layout ──────────────────────────────────────
// The model's activity times can't be trusted across a multi-hour inter-city leg —
// it will happily place an 8 PM activity in the departure city, label the drive
// "2 hr", then start the arrival city at 7 PM. We throw its clock away on drive days
// and rebuild it: departure-city activities from the morning, the real drive, then
// arrival-city activities starting when the traveler actually arrives.
const DRIVE_DAY_START_MIN = 8 * 60;        // 08:00 — departure-city morning start
const DRIVE_LATEST_DEPART_MIN = 15 * 60;   // never START a departure-city activity after 3 PM
const IN_CITY_HOP_MIN = 15;                // buffer between two stops in the same city

// Realistic activity length (minutes) when the model's own range isn't usable.
function defaultDurationMin(category: string | undefined): number {
  switch (category) {
    case "adventure": return 210; // a real hike
    case "culture": return 120;   // museum / gallery
    case "nature": return 90;
    case "nightlife": return 90;
    case "food": return 75;
    default: return 90;
  }
}

// Prefer the model's intended length (keeps its pacing) but fall back to a sane
// per-category default; clamp out nonsense (negative / >6 hr) ranges.
function activityDurationMin(time: string | undefined, category: string | undefined): number {
  if (time) {
    const parts = time.split(/\s*[–-]\s*/);
    const s = parseClock(parts[0]?.trim());
    const e = parseClock(parts[1]?.trim());
    if (s != null && e != null && e > s && e - s <= 6 * 60) return e - s;
  }
  return defaultDurationMin(category);
}

// "1 hr 30 min" / "45 min" / "2 hr" → minutes, or null.
function parseTransitMin(text: string | undefined): number | null {
  if (!text) return null;
  const h = text.match(/(\d+)\s*hr/i);
  const m = text.match(/(\d+)\s*min/i);
  if (!h && !m) return null;
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
}

interface RetimedDriveDay {
  activities: Activity[];
  departTime: string;
  arriveTime: string;
  afterActivityId: string;
}

// Lay a drive day out on a real clock. `splitIdx` is the index of the last
// departure-city activity (everything after it is in the arrival city). Departure
// activities run from the morning and are trimmed if they'd push the drive past
// mid-afternoon — keeping the departure city light so the drive happens in daylight.
function retimeDriveDay(
  activities: Activity[],
  splitIdx: number,
  driveMin: number,
): RetimedDriveDay {
  const withTime = (a: Activity, startMin: number, dur: number): Activity =>
    ({ ...a, time: `${formatClock(startMin)} - ${formatClock(startMin + dur)}` });

  // Departure block, from the morning. Stop adding once we'd start a stop after the
  // cap, so an over-packed departure day can't shove the drive into the night.
  const departure: Activity[] = [];
  let cursor = DRIVE_DAY_START_MIN;
  let departEndMin = cursor;
  for (let i = 0; i <= splitIdx; i++) {
    if (departure.length > 0 && cursor > DRIVE_LATEST_DEPART_MIN) break;
    const a = activities[i];
    const dur = activityDurationMin(a.time, a.category);
    departure.push(withTime(a, cursor, dur));
    departEndMin = cursor + dur;
    cursor = departEndMin + IN_CITY_HOP_MIN;
  }

  const arriveMin = departEndMin + Math.max(0, driveMin);

  // Arrival block, starting when the traveler actually rolls into the next city.
  const arrival: Activity[] = [];
  cursor = arriveMin;
  for (let i = splitIdx + 1; i < activities.length; i++) {
    const a = activities[i];
    const dur = activityDurationMin(a.time, a.category);
    arrival.push(withTime(a, cursor, dur));
    cursor = cursor + dur + IN_CITY_HOP_MIN;
  }

  const afterAct = departure[departure.length - 1];
  return {
    activities: [...departure, ...arrival],
    departTime: formatClock(departEndMin),
    arriveTime: formatClock(arriveMin),
    afterActivityId: afterAct?.id ?? "",
  };
}

// One Routes API call for a single drive leg between two cities/points. Returns
// duration + distance + route geometry, or null on failure (caller degrades to a
// duration-only / no-map display).
export async function computeDriveLeg(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  apiKey: string,
): Promise<DriveLeg | null> {
  const body = {
    origin: { location: { latLng: { latitude: fromLat, longitude: fromLng } } },
    destination: { location: { latLng: { latitude: toLat, longitude: toLng } } },
    travelMode: "DRIVE" as const,
  };
  try {
    const response = await fetch(ROUTES_COMPUTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      logger.warn("computeRoutes non-OK", { status: response.status, body: errorText.slice(0, 300) });
      return null;
    }
    const data = await response.json() as {
      routes?: Array<{ duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }>;
    };
    const route = data.routes?.[0];
    if (!route) return null;
    const seconds = route.duration ? parseInt(route.duration.replace("s", ""), 10) : NaN;
    const distanceMeters = route.distanceMeters ?? 0;
    return {
      durationText: !isNaN(seconds) ? secondsToText(seconds) : "",
      durationSeconds: !isNaN(seconds) ? seconds : 0,
      distanceText: distanceMeters > 0 ? metersToText(distanceMeters) : "",
      distanceMeters,
      encodedPolyline: route.polyline?.encodedPolyline ?? "",
    };
  } catch (error) {
    logger.warn("computeRoutes fetch failed", { error });
    return null;
  }
}

// One Routes API call for all N segments.
// Returns an array of duration strings indexed by segment position, or null on failure.
async function fetchSegmentTimes(
  segments: Array<{ fromLat: number; fromLng: number; toLat: number; toLng: number; mode: GoogleTravelMode }>,
  apiKey: string
): Promise<Array<string | null>> {
  if (segments.length === 0) return [];

  // Use dominant mode for the batch (mixing modes in one call isn't supported cleanly)
  const modeCounts = segments.reduce<Record<string, number>>((acc, s) => {
    acc[s.mode] = (acc[s.mode] ?? 0) + 1;
    return acc;
  }, {});
  const dominantMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0][0] as GoogleTravelMode;

  const body = {
    origins: segments.map((s) => ({
      waypoint: { location: { latLng: { latitude: s.fromLat, longitude: s.fromLng } } },
    })),
    destinations: segments.map((s) => ({
      waypoint: { location: { latLng: { latitude: s.toLat, longitude: s.toLng } } },
    })),
    travelMode: dominantMode,
  };

  try {
    const response = await fetch(ROUTES_MATRIX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Only fetch duration — minimizes response size and billing
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,status",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      logger.warn("Routes API non-OK", { status: response.status, body: errorText.slice(0, 300) });
      return segments.map(() => null);
    }

    const elements = await response.json() as RouteMatrixElement[];

    // Build a map from (originIndex, destinationIndex) → duration
    const durationMap = new Map<string, string>();
    for (const el of elements) {
      if (el.status && el.status.code !== 0) continue;
      if (!el.duration) continue;
      const seconds = parseInt(el.duration.replace("s", ""), 10);
      if (!isNaN(seconds)) {
        durationMap.set(`${el.originIndex},${el.destinationIndex}`, secondsToText(seconds));
      }
    }

    // For our N consecutive segments, origin i → destination i is what we want
    return segments.map((_, i) => durationMap.get(`${i},${i}`) ?? null);
  } catch (error) {
    logger.warn("Routes API fetch failed", { error });
    return segments.map(() => null);
  }
}

function haversineKm(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Computes the inter-city drive leg for every drive day and fills the full `drive`
// object (cities, leave/arrive times, duration, distance, route geometry, and the
// activity the drive happens AFTER so the client can place the card inline).
//
// The city jump can fall anywhere: the model sometimes keeps the whole drive day in the
// departing city and starts the arrival city the next day, and sometimes puts the
// arrival-city activities later the SAME day. So we find the largest coordinate gap
// across [the drive day's located activities + the next stop's first located activity];
// that gap IS the drive. From/to are the activities on either side of it.
//
// Run AFTER reconciliation (real coords). `dayIndex` limits work to one (global) day.
// Degrades silently — a failed route call leaves any existing drive data intact.
export async function enrichDriveLegs(
  itinerary: GeneratedItinerary,
  apiKey: string,
  opts: { dayIndex?: number } = {},
): Promise<GeneratedItinerary> {
  if (!itinerary.stops || itinerary.stops.length < 2) return itinerary;

  // Global day-index offset of each stop's first day.
  const offsets: number[] = [];
  let acc = 0;
  for (const s of itinerary.stops) { offsets.push(acc); acc += s.days.length; }

  let result = itinerary;

  for (let si = 0; si < itinerary.stops.length - 1; si++) {
    const stop = itinerary.stops[si];
    const nextStop = itinerary.stops[si + 1];
    const driveDayGlobal = offsets[si] + stop.days.length - 1; // last day of this stop
    if (opts.dayIndex != null && driveDayGlobal !== opts.dayIndex) continue;

    const driveDay = getAllDays(result)[driveDayGlobal];
    if (!driveDay?.isDriveDay) continue;

    // Candidate sequence: the day's located activities, plus the next stop's first
    // located activity (so an end-of-day boundary jump is also considered).
    const located = driveDay.activities.filter((a) => a.coordinates);
    if (located.length === 0) continue;
    const nextFirst = nextStop.days.flatMap((d) => d.activities).find((a) => a.coordinates);
    const seq = nextFirst ? [...located, nextFirst] : located;
    if (seq.length < 2) continue;

    // Largest consecutive gap = the inter-city drive.
    let bestGap = -1, gapIdx = -1;
    for (let k = 0; k < seq.length - 1; k++) {
      const c1 = seq[k].coordinates!, c2 = seq[k + 1].coordinates!;
      const km = haversineKm(c1.latitude, c1.longitude, c2.latitude, c2.longitude);
      if (km > bestGap) { bestGap = km; gapIdx = k; }
    }
    if (gapIdx < 0) continue;

    const fromAct = seq[gapIdx];
    const toAct = seq[gapIdx + 1];
    const leg = await computeDriveLeg(
      fromAct.coordinates!.latitude, fromAct.coordinates!.longitude,
      toAct.coordinates!.latitude, toAct.coordinates!.longitude,
      apiKey,
    );
    if (!leg) continue;

    // Re-time the whole day on a real clock now that we know the actual drive length.
    // arrivalOnThisDay = the inter-city jump lands on a venue still in THIS day's list
    // (the model put arrival-city activities after the drive same-day). Otherwise the
    // gap is the day boundary and every activity on this day is in the departure city.
    const driveMin = leg.durationSeconds > 0 ? Math.round(leg.durationSeconds / 60) : 0;
    const fromIdx = driveDay.activities.findIndex((a) => a.id === fromAct.id);
    const arrivalOnThisDay = gapIdx + 1 < located.length;
    const splitIdx = fromIdx >= 0 && arrivalOnThisDay ? fromIdx : driveDay.activities.length - 1;

    const retimed = retimeDriveDay(driveDay.activities, splitIdx, driveMin);

    // The leg leading INTO the arrival city IS the drive — surface it on the boundary
    // activity so the inline card reads "Drive · 2 hr 30 min".
    const activities = retimed.activities.map((a) =>
      a.id === retimed.afterActivityId && a.transport?.length
        ? { ...a, transport: a.transport.map((t, ti) => ti === 0 ? { ...t, mode: "car", time: leg.durationText } : t) }
        : a,
    );

    result = updateDayByIndex(result, driveDayGlobal, {
      ...driveDay,
      isDriveDay: true,
      activities,
      drive: {
        fromLocation: stop.location,
        toLocation: nextStop.location,
        departTime: retimed.departTime,
        arriveTime: retimed.arriveTime,
        durationText: leg.durationText,
        distanceText: leg.distanceText,
        encodedPolyline: leg.encodedPolyline,
        afterActivityId: retimed.afterActivityId,
      },
    });
  }

  return result;
}

// Distance-based fallback for a leg Google couldn't route, mirroring the client's
// estimateTransport. We use this instead of the model's invented time so a routable
// leg NEVER displays a hallucinated number — it's always either Google's value or a
// sane geometric estimate.
const WALK_MAX_KM = 1.2;
const WALK_KMH = 4.8;
const DRIVE_KMH = 30;
function estimateLeg(
  fromLat: number, fromLng: number, toLat: number, toLng: number,
): { mode: string; time: string } {
  const km = haversineKm(fromLat, fromLng, toLat, toLng);
  const walk = km <= WALK_MAX_KM;
  const mins = Math.max(1, Math.round((km / (walk ? WALK_KMH : DRIVE_KMH)) * 60));
  return { mode: walk ? "walk" : "car", time: secondsToText(mins * 60) };
}

// Re-enrich transport times for a single day — used after individual activity mutations.
export async function enrichDayTransportTimes(
  itinerary: GeneratedItinerary,
  dayIndex: number,
  apiKey: string
): Promise<GeneratedItinerary> {
  const days = getAllDays(itinerary);
  const day = days[dayIndex];
  if (!day) return itinerary;

  const segments = day.activities.flatMap((activity, i) => {
    if (i === day.activities.length - 1) return [];
    const next = day.activities[i + 1];
    const hasCoords = activity.coordinates && next.coordinates;
    const transportMode = activity.transport?.[0]?.mode ?? "";
    const skip = !hasCoords || !activity.transport?.length || transportMode === "ferry";
    return [{
      activityIndex: i,
      fromLat: activity.coordinates?.latitude ?? 0,
      fromLng: activity.coordinates?.longitude ?? 0,
      toLat: next.coordinates?.latitude ?? 0,
      toLng: next.coordinates?.longitude ?? 0,
      mode: transportModeToGoogle(transportMode) as GoogleTravelMode,
      skip,
    }];
  });

  const activeSeg = segments.map((s) => s.skip ? null : s);
  const activeOnly = activeSeg.filter((s): s is typeof segments[number] => s !== null);
  if (activeOnly.length === 0) return itinerary;

  const times = await fetchSegmentTimes(activeOnly, apiKey);

  let activeIdx = 0;
  const results = activeSeg.map((s) => {
    if (s === null) return null;
    return times[activeIdx++] ?? null;
  });

  const updatedActivities = day.activities.map((activity, i) => {
    const seg = segments[i];
    // No leg (last activity) or an unroutable leg (ferry / missing coords): leave as-is.
    if (!activity.transport?.length || !seg || seg.skip) return activity;
    // Routable leg: Google's value, or a geometric estimate — never the model's guess.
    const real = results[i];
    const leg = real
      ? { mode: activity.transport[0].mode, time: real }
      : estimateLeg(seg.fromLat, seg.fromLng, seg.toLat, seg.toLng);
    return {
      ...activity,
      transport: activity.transport.map((t, ti) => ti === 0 ? { ...t, mode: leg.mode, time: leg.time } : t),
    };
  });

  return updateDayByIndex(itinerary, dayIndex, { ...day, activities: updatedActivities });
}

// Deterministically re-flow ONE day's clock so activities never overlap and each
// has enough buffer for the travel between them — without changing any content.
// This is what the "Rework Schedule" action runs: a tight-schedule conflict is a
// timing problem, so we fix the times in place rather than asking an LLM to swap
// activities (which loses verified trail data and re-introduces bad times).
//
// Each activity keeps its own length (the model's range, or a per-category default);
// the gap after it is the real transport leg time already on the activity, falling
// back to a short in-city hop. The first activity keeps its original start so the
// day still begins when the traveler intended.
export function reflowDaySchedule(
  itinerary: GeneratedItinerary,
  dayIndex: number,
): GeneratedItinerary {
  const days = getAllDays(itinerary);
  const day = days[dayIndex];
  if (!day || day.activities.length === 0) return itinerary;

  const firstStart = parseClock(day.activities[0].time?.split(/\s*[–-]\s*/)[0]?.trim()) ?? DRIVE_DAY_START_MIN;
  let cursor = firstStart;

  const activities = day.activities.map((a, i) => {
    const dur = activityDurationMin(a.time, a.category);
    const time = `${formatClock(cursor)} - ${formatClock(cursor + dur)}`;
    const isLast = i === day.activities.length - 1;
    const transit = isLast ? 0 : (parseTransitMin(a.transport?.[0]?.time) ?? IN_CITY_HOP_MIN);
    cursor = cursor + dur + transit;
    return { ...a, time };
  });

  return updateDayByIndex(itinerary, dayIndex, { ...day, activities });
}

export async function enrichTransportTimes(
  itinerary: GeneratedItinerary,
  apiKey: string
): Promise<GeneratedItinerary> {
  type DaySegment = {
    activityIndex: number;
    fromLat: number;
    fromLng: number;
    toLat: number;
    toLng: number;
    mode: GoogleTravelMode;
    skip: boolean;
  };

  const allDays = getAllDays(itinerary);

  const perDaySegments: DaySegment[][] = allDays.map((day) =>
    day.activities.flatMap((activity, i) => {
      if (i === day.activities.length - 1) return [];
      const next = day.activities[i + 1];
      const hasCoords = activity.coordinates && next.coordinates;
      const transportMode = activity.transport?.[0]?.mode ?? "";
      const skip = !hasCoords || !activity.transport?.length || transportMode === "ferry";
      return [{
        activityIndex: i,
        fromLat: activity.coordinates?.latitude ?? 0,
        fromLng: activity.coordinates?.longitude ?? 0,
        toLat: next.coordinates?.latitude ?? 0,
        toLng: next.coordinates?.longitude ?? 0,
        mode: transportModeToGoogle(transportMode),
        skip,
      }];
    })
  );

  const perDayResults = await Promise.all(
    perDaySegments.map((segments) => {
      const activeSeg = segments.map((s) => s.skip ? null : s);
      const activeOnly = activeSeg.filter((s): s is DaySegment => s !== null);
      if (activeOnly.length === 0) return Promise.resolve(segments.map(() => null));

      return fetchSegmentTimes(activeOnly, apiKey).then((times) => {
        let activeIdx = 0;
        return activeSeg.map((s) => {
          if (s === null) return null;
          return times[activeIdx++] ?? null;
        });
      });
    })
  );

  let dayIndex = 0;
  return mapAllDays(itinerary, (day) => {
    const segs = perDaySegments[dayIndex] ?? [];
    const segResults = perDayResults[dayIndex] ?? [];
    dayIndex++;
    const activities = day.activities.map((activity, i) => {
      const seg = segs[i];
      // No leg (last activity) or an unroutable leg (ferry / missing coords): leave as-is.
      if (!activity.transport?.length || !seg || seg.skip) return activity;
      // Routable leg: Google's value, or a geometric estimate — never the model's guess.
      const real = segResults[i];
      const leg = real
        ? { mode: activity.transport[0].mode, time: real }
        : estimateLeg(seg.fromLat, seg.fromLng, seg.toLat, seg.toLng);
      const updatedTransport = activity.transport.map((t, ti) =>
        ti === 0 ? { ...t, mode: leg.mode, time: leg.time } : t
      );
      return { ...activity, transport: updatedTransport };
    });
    return { ...day, activities };
  });
}
