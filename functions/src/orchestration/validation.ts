import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary } from "../itinerarySchemas";
import { MIN_ACTIVITIES_PER_DAY } from "../constants";

// ~1.5 km ≈ 18-minute walk — anything beyond this is not reasonably walkable
const MAX_WALK_KM = 1.5;

// Two meals back-to-back is only legitimate when they're in different cities (a
// departure-city lunch then an arrival-city dinner on a drive day). Within this
// radius the two restaurants are in the same place — you don't eat, then eat again.
const SAME_AREA_KM = 30;

// Normal days must end no earlier than 20:30 (dinner + evening fully in).
const MIN_DAY_END_MINUTES = 20 * 60 + 30; // 20:30

// Drive days are transition legs — lighter midday, but must still carry the
// traveler into dinner in the arrival city, so they run into the evening.
const MIN_DRIVE_DAY_END_MINUTES = 18 * 60; // 18:00

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
  fatalIssues: string[];
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

// Meal windows aligned with the planner prompt's slot grid.
// (A small ± tolerance is allowed — the prompt asks for 08:00–09:30 for
// breakfast; we accept 07:30–10:00 here so a thoughtful 09:45 breakfast
// after a sunrise stop doesn't trip the check.)
function isMealTime(startMinutes: number, window: "breakfast" | "lunch" | "dinner"): boolean {
  const windows = {
    breakfast: [7 * 60 + 30, 10 * 60],
    lunch: [11 * 60 + 30, 14 * 60 + 30],
    dinner: [18 * 60, 21 * 60],
  };
  const [min, max] = windows[window];
  return startMinutes >= min && startMinutes <= max;
}

export function validateItinerary(
  itinerary: GeneratedItinerary,
): { itinerary: GeneratedItinerary; result: ValidationResult } {
  const issues: string[] = [];
  const fatalIssues: string[] = [];
  let repaired = false;
  const seenVenues = new Set<string>();
  const minActivities = MIN_ACTIVITIES_PER_DAY;

  let globalDayIndex = 0;
  const lastStopIndex = itinerary.stops.length - 1;

  const newStops = itinerary.stops.map((stop, stopIdx) => {
    const isLastStop = stopIdx === lastStopIndex;

    const newDays = stop.days.map((day) => {
      const dayLabel = `Day ${globalDayIndex + 1}`;
      globalDayIndex++;

      const isDriveDay = day.isDriveDay === true;

      // Illegal drive day: final stop has nowhere to drive to
      if (isDriveDay && isLastStop) {
        fatalIssues.push(
          `${dayLabel}: final stop cannot have a drive day — treat as a normal full day ending at 8:30 PM`
        );
        // Fall through and validate as a normal day
      }

      // Deterministic fix: replace unreasonable walks with rideshare
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
          const walkMins = Math.round(distKm * 12);
          issues.push(
            `${dayLabel}: replaced ${walkMins}-min walk between "${activity.name}" and "${next.name}" (${distKm.toFixed(1)} km) with rideshare`
          );
          repaired = true;
          return { ...t, mode: "taxi", time: `${Math.round(distKm * 3)} min` };
        });

        return { ...activity, transport };
      });

      // Deterministic fix: drop venues that duplicate ones used on earlier days
      const dedupedActivities = activitiesWithFixedTransport.filter((activity) => {
        const key = activity.name.toLowerCase().trim();
        if (seenVenues.has(key)) {
          issues.push(`${dayLabel}: removed duplicate venue "${activity.name}"`);
          repaired = true;
          return false;
        }
        seenVenues.add(key);
        return true;
      });

      // Deterministic fix: never schedule two meals back-to-back in the same city.
      // (A departure-city meal followed by an arrival-city meal across a long drive is
      // fine — that's gated by distance below.)
      const activities = dedupedActivities.filter((activity, i) => {
        if (i === 0) return true;
        const prev = dedupedActivities[i - 1];
        if (activity.category !== "food" || prev.category !== "food") return true;
        // Keep when we can't confirm they're in the same area (avoid dropping a
        // legitimate arrival-city dinner on a drive day).
        if (!activity.coordinates || !prev.coordinates) return true;
        const distKm = haversineKm(
          prev.coordinates.latitude, prev.coordinates.longitude,
          activity.coordinates.latitude, activity.coordinates.longitude,
        );
        if (distKm > SAME_AREA_KM) return true;
        issues.push(`${dayLabel}: removed back-to-back restaurant "${activity.name}" (follows "${prev.name}" with no activity between)`);
        repaired = true;
        return false;
      });

      // Check time overlaps (informational unless severe)
      for (let i = 1; i < activities.length; i++) {
        const prev = activities[i - 1];
        const curr = activities[i];
        const prevTime = parseActivityTime(prev.time);
        const currTime = parseActivityTime(curr.time);
        if (prevTime && currTime && currTime.startMinutes < prevTime.endMinutes - 5) {
          issues.push(`${dayLabel}: time overlap — "${prev.name}" ends after "${curr.name}" starts`);
        }
      }

      // Legitimate drive day (non-final stop): lighter checks, but the traveler must
      // still have breakfast in the departure city and DINNER in the arrival city.
      if (isDriveDay && !isLastStop) {
        if (activities.length < 4) {
          fatalIssues.push(
            `${dayLabel} (drive day): only ${activities.length} activities (need at least 4 — breakfast, lunch, the drive, and dinner in the arrival city)`
          );
        }
        const driveHasBreakfast = activities.some(
          (a) => a.category === "food" && parseActivityTime(a.time) !== null &&
            isMealTime(parseActivityTime(a.time)!.startMinutes, "breakfast")
        );
        const driveHasDinner = activities.some(
          (a) => a.category === "food" && parseActivityTime(a.time) !== null &&
            isMealTime(parseActivityTime(a.time)!.startMinutes, "dinner")
        );
        if (!driveHasBreakfast) fatalIssues.push(`${dayLabel} (drive day): missing breakfast in the departure city`);
        if (!driveHasDinner) {
          fatalIssues.push(
            `${dayLabel} (drive day): missing dinner in the arrival city — add a dinner at the next stop (they still eat when arriving at night)`
          );
        }
        // Sanity floor only — dinner already forces a reasonable end time.
        const lastDriveTime = activities.length > 0
          ? parseActivityTime(activities[activities.length - 1].time)
          : null;
        if (lastDriveTime && lastDriveTime.endMinutes < MIN_DRIVE_DAY_END_MINUTES) {
          fatalIssues.push(
            `${dayLabel} (drive day): ends too early — must include dinner in the arrival city`
          );
        }
        return { ...day, activities };
      }

      // Full normal-day checks (also applies to illegal drive days on the final stop)

      // Meal completeness
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

      if (!hasMeal.breakfast) fatalIssues.push(`${dayLabel}: missing breakfast in the 07:30–10:00 window`);
      if (!hasMeal.lunch) fatalIssues.push(`${dayLabel}: missing lunch in the 11:30–14:30 window`);
      if (!hasMeal.dinner) fatalIssues.push(`${dayLabel}: missing dinner in the 18:00–21:00 window`);

      // Minimum activity count
      if (activities.length < minActivities) {
        fatalIssues.push(
          `${dayLabel}: only ${activities.length} activities (need at least ${minActivities} — add late-afternoon and/or evening activities)`
        );
      }
      if (activities.length > 10) {
        issues.push(`${dayLabel}: ${activities.length} activities may be unrealistic`);
      }

      // Day-end check
      const lastTime = activities.length > 0
        ? parseActivityTime(activities[activities.length - 1].time)
        : null;
      if (lastTime && lastTime.endMinutes < MIN_DAY_END_MINUTES) {
        const hr = Math.floor(lastTime.endMinutes / 60);
        const min = lastTime.endMinutes % 60;
        const period = hr >= 12 ? "PM" : "AM";
        const hr12 = hr % 12 === 0 ? 12 : hr % 12;
        fatalIssues.push(
          `${dayLabel}: day ends at ${hr12}:${min.toString().padStart(2, "0")} ${period} — must run until at least 8:30 PM (add dinner + evening)`
        );
      }

      // Hiking checks
      const hikingActivities = activities.filter(
        (a) => a.category === "adventure" || a.category === "nature"
      );

      const majorHikeCount = hikingActivities.filter((a) => {
        const t = parseActivityTime(a.time);
        return t !== null && t.endMinutes - t.startMinutes >= 4 * 60;
      }).length;

      if (majorHikeCount > 1) {
        issues.push(`${dayLabel}: ${majorHikeCount} major hikes (4+ hrs each) — only one allowed per day`);
      }

      const totalHikingMinutes = hikingActivities.reduce((sum, a) => {
        const t = parseActivityTime(a.time);
        return sum + (t ? t.endMinutes - t.startMinutes : 0);
      }, 0);

      if (totalHikingMinutes > 6 * 60) {
        issues.push(`${dayLabel}: ${Math.round(totalHikingMinutes / 60)}h of hiking exceeds the 6-hour daily cap`);
      }

      // Outdoor activities starting too late
      const lateOutdoor = hikingActivities.find((a) => {
        const t = parseActivityTime(a.time);
        return t !== null && t.startMinutes > 15 * 60;
      });
      if (lateOutdoor) {
        issues.push(`${dayLabel}: outdoor activity "${lateOutdoor.name}" starts after 3:00 PM`);
      }

      return { ...day, activities };
    });

    return { ...stop, days: newDays };
  });

  const validated: GeneratedItinerary = { ...itinerary, stops: newStops };

  if (issues.length > 0 || fatalIssues.length > 0) {
    logger.info("Itinerary validation complete", {
      totalIssues: issues.length,
      fatalIssues: fatalIssues.length,
      repaired,
      issues: [...fatalIssues, ...issues],
    });
  }

  return {
    itinerary: validated,
    result: {
      isValid: fatalIssues.length === 0,
      issues,
      fatalIssues,
      repaired,
    },
  };
}
