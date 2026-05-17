import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary } from "../itinerarySchemas";

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

    // Remove duplicate venues across all days
    const activities = day.activities.filter((activity) => {
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
