import { Platform } from 'react-native';

export const BOOKING_COM_AID = '';    // sign up at booking.com/affiliate-program
export const OPENTABLE_AID = '';     // sign up at cj.com → search "OpenTable" advertiser
export const GYG_PARTNER_ID = '';    // sign up at partner.getyourguide.com

// Handles both internal enum values ('solo', 'couple') and display strings ('A Couple', 'Friends')
export function partyToAdults(party: string | undefined): number {
  const p = (party ?? '').toLowerCase();
  if (p.includes('solo')) return 1;
  if (p.includes('couple')) return 2;
  if (p.includes('friend')) return 3;
  if (p.includes('family') || p.includes('group')) return 4;
  return 2;
}

// Strip emoji and non-ASCII characters so destination strings are URL-safe
export function cleanDestination(raw: string): string {
  return raw.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}

// Booking.com destination search — pass country for unambiguous results (e.g. "Paris, France")
export function buildHotelSearchUrl(
  destination: string,
  country: string | undefined,
  checkin: string,
  checkout: string,
  adults: number,
): string {
  const searchTerm = cleanDestination(country ? `${destination}, ${country}` : destination);
  const params = new URLSearchParams({
    ss: searchTerm,
    checkin,
    checkout,
    group_adults: String(adults),
    no_rooms: '1',
  });
  if (BOOKING_COM_AID) params.set('aid', BOOKING_COM_AID);
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

// OpenTable affiliate search.
// Location priority: coordinates (most precise, from activity data) → metroName (city fallback).
// OpenTable only returns venues listed on it, so if a restaurant isn't there the user sees
// no results rather than the wrong place.
// Earn commission by signing up at cj.com (search "OpenTable" advertiser) and setting OPENTABLE_AID.
export function buildOpenTableUrl(
  restaurantName: string,
  destination: string,
  date: string,
  partySize: number,
  coordinates?: { latitude: number; longitude: number },
): string {
  const params = new URLSearchParams({
    term: restaurantName,
    covers: String(partySize),
  });
  if (date) params.set('dateTime', `${date}T19:00`);
  if (coordinates) {
    params.set('latitude', String(coordinates.latitude));
    params.set('longitude', String(coordinates.longitude));
  } else {
    params.set('metroName', cleanDestination(destination));
  }
  if (OPENTABLE_AID) params.set('aid', OPENTABLE_AID);
  return `https://www.opentable.com/s/?${params.toString()}`;
}

interface MapLocation {
  name: string;
  coordinates?: { latitude: number; longitude: number };
}

// Opens turn-by-turn directions between two activities.
// Uses Apple Maps on iOS (native, no app required) and Google Maps URL on Android.
// Coordinates are used when available; falls back to place name search.
export function buildDirectionsUrl(from: MapLocation, to: MapLocation, transportMode: string): string {
  const m = transportMode.toLowerCase();

  if (Platform.OS === 'ios') {
    const dirflg = m === 'walk' ? 'w'
      : m === 'bicycle' ? 'b'
      : ['bus', 'train', 'subway', 'metro', 'ferry', 'boat'].includes(m) ? 'r'
      : 'd'; // car, taxi, default
    const saddr = from.coordinates
      ? `${from.coordinates.latitude},${from.coordinates.longitude}`
      : encodeURIComponent(from.name);
    const daddr = to.coordinates
      ? `${to.coordinates.latitude},${to.coordinates.longitude}`
      : encodeURIComponent(to.name);
    return `maps://?saddr=${saddr}&daddr=${daddr}&dirflg=${dirflg}`;
  } else {
    const travelmode = m === 'walk' ? 'walking'
      : m === 'bicycle' ? 'bicycling'
      : ['bus', 'train', 'subway', 'metro', 'ferry', 'boat'].includes(m) ? 'transit'
      : 'driving';
    const origin = from.coordinates
      ? `${from.coordinates.latitude},${from.coordinates.longitude}`
      : encodeURIComponent(from.name);
    const dest = to.coordinates
      ? `${to.coordinates.latitude},${to.coordinates.longitude}`
      : encodeURIComponent(to.name);
    return `https://www.google.com/maps/dir/${origin}/${dest}/?travelmode=${travelmode}`;
  }
}

// GetYourGuide search — clearly a search, not a guaranteed listing
export function buildExperienceUrl(activityName: string, destination: string): string {
  const params = new URLSearchParams({ q: `${activityName} ${cleanDestination(destination)}` });
  if (GYG_PARTNER_ID) params.set('partner_id', GYG_PARTNER_ID);
  return `https://www.getyourguide.com/s/?${params.toString()}`;
}
