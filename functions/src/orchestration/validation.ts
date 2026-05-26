import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary } from "../itinerarySchemas";

// ~1.5 km ≈ 18-minute walk — anything beyond this is not reasonably walkable
const MAX_WALK_KM = 1.5;

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  repaired: boolean;
}

interface ParsedTime {
  startMinutes: number;
  endMinutes: number;
}

function parseActivityTime(timeStr: string): ParsedTime | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  const toMinutes = (h: number, m: number, period: string): number => {
    let hours = h;
    if (period.toUpperCase() === "PM" && h !== 12) hours += 12;
    if (period.toUpperCase() === "AM" && h === 12) hours = 0;
    return hours * 60 + m;
  };

  return {
    startMinutes: toMinutes(parseInt(match[1]), parseInt(match[2]), match[3]),
    endMinutes: toMinutes(parseInt(match[4]), parseInt(match[5]), match[6]),
  };
}

function isMealTime(startMinutes: number, window: "breakfast" | "lunch" | "dinner"): boolean {
  const windows = {
    breakfast: [7 * 60, 10 * 60],   // 7:00 AM – 10:00 AM
    lunch: [11 * 60, 15 * 60],       // 11:00 AM – 3:00 PM
    dinner: [17 * 60, 21 * 60 + 30], // 5:00 PM – 9:30 PM
  };
  const [min, max] = windows[window];
  return startMinutes >= min && startMinutes <= max;
}

export function validateItinerary(
  itinerary: GeneratedItinerary
): { itinerary: GeneratedItinerary; result: ValidationResult } {
  const issues: string[] = [];
  let repaired = false;
  const seenVenues = new Set<string>();

  const days = itinerary.days.map((day, dayIndex) => {
    const dayLabel = `Day ${dayIndex + 1}`;

    // Fix unrealistic walking legs: if the AI recommended walking but the
    // two coordinates are more than MAX_WALK_KM apart, switch to rideshare.
    const activitiesWithFixedTransport = day.activities.map((activity, i) => {
      if (i === day.activities.length - 1) return activity;
      const next = day.activities[i + 1];
      if (!activity.coordinates || !next.coordinates) return activity;

      const distKm = haversineKm(
        activity.coordinates.latitude, activity.coordinates.longitude,
        next.coordinates.latitude, next.coordinates.longitude,
      );

      if (distKm <= MAX_WALK_KM) return activity;

      const transport = (activity.transport ?? []).map((t) => {
        if (t.mode?.toLowerCase() !== "walk") return t;
        const walkMins = Math.round(distKm * 12); // ~12 min/km walking pace
        issues.push(
          `${dayLabel}: replaced ${walkMins}-min walk between "${activity.name}" and "${next.name}" (${distKm.toFixed(1)} km) with rideshare`
        );
        repaired = true;
        return { ...t, mode: "rideshare", time: `${Math.round(distKm * 3)} min` };
      });

      return { ...activity, transport };
    });

    // Remove duplicate venues across all days
    const activities = activitiesWithFixedTransport.filter((activity) => {
      const key = activity.name.toLowerCase().trim();
      if (seenVenues.has(key)) {
        issues.push(`${dayLabel}: removed duplicate venue "${activity.name}"`);
        repaired = true;
        return false;
      }
      seenVenues.add(key);
      return true;
    });

    // Check time overlaps (best-effort — Claude usually handles this)
    for (let i = 1; i < activities.length; i++) {
      const prev = activities[i - 1];
      const curr = activities[i];
      const prevTime = parseActivityTime(prev.time);
      const currTime = parseActivityTime(curr.time);

      if (prevTime && currTime && currTime.startMinutes < prevTime.endMinutes - 5) {
        issues.push(
          `${dayLabel}: possible time overlap — "${prev.name}" ends after "${curr.name}" starts`
        );
        // Note: we log but don't repair overlap; the scheduling change would require regeneration
      }
    }

    // Check meal coverage
    const hasMeal = {
      breakfast: activities.some(
        (a) => a.category === "food" && parseActivityTime(a.time) !== null &&
          isMealTime(parseActivityTime(a.time)!.startMinutes, "breakfast")
      ),
      lunch: activities.some(
        (a) => a.category === "food" && parseActivityTime(a.time) !== null &&
          isMealTime(parseActivityTime(a.time)!.startMinutes, "lunch")
      ),
      dinner: activities.some(
        (a) => a.category === "food" && parseActivityTime(a.time) !== null &&
          isMealTime(parseActivityTime(a.time)!.startMinutes, "dinner")
      ),
    };

    if (!hasMeal.breakfast) issues.push(`${dayLabel}: missing breakfast`);
    if (!hasMeal.lunch) issues.push(`${dayLabel}: missing lunch`);
    if (!hasMeal.dinner) issues.push(`${dayLabel}: missing dinner`);

    // Check activity count is reasonable (3–8 per day)
    if (activities.length < 3) {
      issues.push(`${dayLabel}: only ${activities.length} activities (expected at least 3)`);
    }
    if (activities.length > 10) {
      issues.push(`${dayLabel}: ${activities.length} activities may be unrealistic`);
    }

    // Hiking feasibility checks
    const hikingActivities = activities.filter(
      (a) => a.category === "adventure" || a.category === "nature"
    );

    const majorHikeCount = hikingActivities.filter((a) => {
      const t = parseActivityTime(a.time);
      return t !== null && t.endMinutes - t.startMinutes >= 4 * 60;
    }).length;

    if (majorHikeCount > 1) {
      issues.push(
        `${dayLabel}: ${majorHikeCount} major hikes (4+ hrs each) scheduled — only one allowed per day`
      );
    }

    const totalHikingMinutes = hikingActivities.reduce((sum, a) => {
      const t = parseActivityTime(a.time);
      return sum + (t ? t.endMinutes - t.startMinutes : 0);
    }, 0);

    if (totalHikingMinutes > 6 * 60) {
      issues.push(
        `${dayLabel}: ${Math.round(totalHikingMinutes / 60)}h of hiking exceeds the 6-hour daily cap`
      );
    }

    return { ...day, activities };
  });

  const fatalIssues = issues.filter(
    (i) => !i.includes("removed duplicate") && !i.includes("possible time overlap")
  );

  if (issues.length > 0) {
    logger.info("Itinerary validation complete", {
      totalIssues: issues.length,
      repaired,
      fatalIssues: fatalIssues.length,
      issues,
    });
  }

  return {
    itinerary: { ...itinerary, days },
    result: {
      isValid: fatalIssues.length === 0,
      issues,
      repaired,
    },
  };
}
