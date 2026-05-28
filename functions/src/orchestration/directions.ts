import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary, getAllDays, mapAllDays } from "../itinerarySchemas";

const DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

type GoogleTravelMode = "driving" | "walking" | "transit";

interface MatrixElement {
  status: string;
  duration?: { value: number; text: string };
}

interface MatrixRow {
  elements: MatrixElement[];
}

interface MatrixResponse {
  status: string;
  rows: MatrixRow[];
}

function transportModeToGoogle(mode: string): GoogleTravelMode {
  if (mode === "walk") return "walking";
  if (mode === "subway" || mode === "bus" || mode === "train") return "transit";
  return "driving";
}

// Calls Distance Matrix API for N consecutive segments using the diagonal approach.
// origins=[A,B,...,N-1], destinations=[B,C,...,N]
// Reads rows[i].elements[i] for pair (activities[i] → activities[i+1])
async function fetchSegmentTimes(
  segments: Array<{ fromLat: number; fromLng: number; toLat: number; toLng: number; mode: GoogleTravelMode }>,
  apiKey: string
): Promise<Array<string | null>> {
  if (segments.length === 0) return [];

  const origins = segments.map((s) => `${s.fromLat},${s.fromLng}`).join("|");
  const destinations = segments.map((s) => `${s.toLat},${s.toLng}`).join("|");

  // All segments in a day typically use the same dominant mode; pick the most common
  const modeCounts = segments.reduce<Record<string, number>>((acc, s) => {
    acc[s.mode] = (acc[s.mode] ?? 0) + 1;
    return acc;
  }, {});
  const dominantMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0][0] as GoogleTravelMode;

  const url = new URL(DISTANCE_MATRIX_URL);
  url.searchParams.set("origins", origins);
  url.searchParams.set("destinations", destinations);
  url.searchParams.set("mode", dominantMode);
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      logger.warn("Distance Matrix API non-OK", { status: response.status });
      return segments.map(() => null);
    }

    const data = await response.json() as MatrixResponse;
    if (data.status !== "OK") {
      logger.warn("Distance Matrix API error status", { status: data.status });
      return segments.map(() => null);
    }

    return segments.map((_, i) => {
      const element = data.rows[i]?.elements[i];
      if (!element || element.status !== "OK" || !element.duration) return null;
      return element.duration.text;
    });
  } catch (error) {
    logger.warn("Distance Matrix API fetch failed", { error });
    return segments.map(() => null);
  }
}

export async function enrichTransportTimes(
  itinerary: GeneratedItinerary,
  apiKey: string
): Promise<GeneratedItinerary> {
  // Collect per-day segments so we can batch one API call per day
  type DaySegment = {
    activityIndex: number;
    fromLat: number;
    fromLng: number;
    toLat: number;
    toLng: number;
    mode: GoogleTravelMode;
    skip: boolean; // ferry or missing coords
  };

  const allDays = getAllDays(itinerary);

  // Build segments per day
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

  // Fetch real travel times per day in parallel
  const perDayResults = await Promise.all(
    perDaySegments.map((segments) => {
      const activeSeg = segments.map((s) => s.skip ? null : s);
      const activeOnly = activeSeg.filter((s): s is DaySegment => s !== null);
      if (activeOnly.length === 0) return Promise.resolve(segments.map(() => null));

      return fetchSegmentTimes(activeOnly, apiKey).then((times) => {
        // Re-map back to full segment array (including skipped ones)
        let activeIdx = 0;
        return activeSeg.map((s) => {
          if (s === null) return null;
          return times[activeIdx++] ?? null;
        });
      });
    })
  );

  // Apply real times back into the itinerary
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
