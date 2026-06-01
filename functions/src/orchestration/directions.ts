import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary, getAllDays, mapAllDays, updateDayByIndex } from "../itinerarySchemas";

// Routes API v2 — same Google Cloud project/key as Places API (New).
// The legacy Distance Matrix API is a separate product that needs separate enablement.
const ROUTES_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

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
    const realTime = results[i];
    if (!realTime || !activity.transport?.length) return activity;
    return {
      ...activity,
      transport: activity.transport.map((t, ti) => ti === 0 ? { ...t, time: realTime } : t),
    };
  });

  return updateDayByIndex(itinerary, dayIndex, { ...day, activities: updatedActivities });
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
    const segResults = perDayResults[dayIndex++] ?? [];
    const activities = day.activities.map((activity, i) => {
      const realTime = segResults[i];
      if (!realTime || !activity.transport?.length) return activity;
      const updatedTransport = activity.transport.map((t, ti) =>
        ti === 0 ? { ...t, time: realTime } : t
      );
      return { ...activity, transport: updatedTransport };
    });
    return { ...day, activities };
  });
}
