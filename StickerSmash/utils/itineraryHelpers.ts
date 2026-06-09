import type { GeneratedItinerary, ItineraryDay, TripStop, OvernightType } from '@/types/itinerary';

// Returns all days as a flat array, whether the itinerary uses stops or legacy days[]
export function getItineraryDays(itinerary: GeneratedItinerary): ItineraryDay[] {
  if (itinerary.stops?.length) {
    return itinerary.stops.flatMap(s => s.days);
  }
  return itinerary.days ?? [];
}

// Returns stops[], synthesizing a single stop from legacy days[] if needed
export function getItineraryStops(itinerary: GeneratedItinerary): TripStop[] {
  if (itinerary.stops?.length) return itinerary.stops;
  return [{
    stopIndex: 0,
    location: itinerary.destinationName,
    arrivalDate: itinerary.startDate ?? null,
    departureDate: itinerary.endDate ?? null,
    overnightAnchor: { location: itinerary.destinationName, overnightType: 'unknown' as OvernightType },
    days: itinerary.days ?? [],
  }];
}

// Returns the stop a global day index belongs to
export function getStopForDayIndex(itinerary: GeneratedItinerary, globalDayIndex: number): TripStop | null {
  const stops = getItineraryStops(itinerary);
  let cumulative = 0;
  for (const stop of stops) {
    if (globalDayIndex < cumulative + stop.days.length) return stop;
    cumulative += stop.days.length;
  }
  return null;
}

// Returns total number of days across all stops
export function getTotalDays(itinerary: GeneratedItinerary): number {
  return getItineraryDays(itinerary).length;
}

// Returns the location of the stop AFTER the one this global day index belongs to
// (the arrival city on a drive day), or null if this is the last stop.
export function getNextStopLocation(itinerary: GeneratedItinerary, globalDayIndex: number): string | null {
  const stops = getItineraryStops(itinerary);
  let cumulative = 0;
  for (let i = 0; i < stops.length; i++) {
    if (globalDayIndex < cumulative + stops[i].days.length) {
      return stops[i + 1]?.location ?? null;
    }
    cumulative += stops[i].days.length;
  }
  return null;
}

// Updates a day at a global index, returning a new itinerary
export function updateItineraryDay(
  itinerary: GeneratedItinerary,
  globalDayIndex: number,
  newDay: ItineraryDay
): GeneratedItinerary {
  if (itinerary.stops?.length) {
    let cumulative = 0;
    const newStops = itinerary.stops.map(stop => {
      const stopEnd = cumulative + stop.days.length;
      if (globalDayIndex >= cumulative && globalDayIndex < stopEnd) {
        const localIdx = globalDayIndex - cumulative;
        cumulative = stopEnd;
        return { ...stop, days: stop.days.map((d, i) => (i === localIdx ? newDay : d)) };
      }
      cumulative = stopEnd;
      return stop;
    });
    return { ...itinerary, stops: newStops };
  }
  // Legacy days[]
  const newDays = (itinerary.days ?? []).map((d, i) => (i === globalDayIndex ? newDay : d));
  return { ...itinerary, days: newDays };
}

// Returns true if the itinerary is a multi-stop road trip
export function isRouteTrip(itinerary: GeneratedItinerary): boolean {
  if (itinerary.tripType === 'route') return true;
  return (itinerary.stops?.length ?? 0) > 1;
}
