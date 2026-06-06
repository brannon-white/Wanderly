import { Firestore, Timestamp } from "firebase-admin/firestore";

/**
 * Featured Trip rotation.
 *
 * The Discover screen reads a single document — `featuredTrips/current` — to
 * decide which prebuilt itinerary to spotlight. This module advances that
 * spotlight through an ordered pool of itineraries, one step at a time, so every
 * trip gets featured before any repeats (sequential round-robin).
 *
 * Used by:
 *   - `rotateFeaturedTripWeekly` (scheduled, weekly) in index.ts
 *   - `scripts/rotateFeatured.js` (manual / seed runs, via compiled lib)
 */

// Ordered rotation pool — the 9 "new" rich prebuilt itineraries.
// `rome-family-adventure` (the legacy demo trip) is intentionally excluded.
export const FEATURED_POOL: string[] = [
  "santorini-romantic-escape",
  "kyoto-cultural-weekend",
  "bali-beach-wellness",
  "iceland-northern-lights",
  "nyc-weekend-explorer",
  "lisbon-budget-foodie",
  "machu-picchu-inca-trail",
  "bangkok-food-temples",
  "maldives-luxury-retreat",
];

// The single doc the client reads for the current featured trip.
export const CURRENT_DOC = "featuredTrips/current";

const FEATURED_BADGE = "✨ Trip of the Week";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Total trip length = number of day entries across all stops. */
function countDurationDays(itinerary: any): number | null {
  const stops = Array.isArray(itinerary?.stops) ? itinerary.stops : [];
  let days = 0;
  for (const stop of stops) {
    if (Array.isArray(stop?.days)) days += stop.days.length;
  }
  return days > 0 ? days : null;
}

export interface RotateOptions {
  /**
   * When true (default) advance to the next itinerary in the pool.
   * When false, re-publish the current index (a forced refresh that keeps the
   * same trip but refreshes hero image / dates).
   */
  advance?: boolean;
}

export interface RotateResult {
  tripId: string;
  rotationIndex: number;
  heroImage: string;
}

export async function rotateFeatured(
  db: Firestore,
  opts: RotateOptions = {}
): Promise<RotateResult> {
  const advance = opts.advance !== false;

  const currentRef = db.doc(CURRENT_DOC);
  const currentSnap = await currentRef.get();
  const prevIndex: number = currentSnap.exists
    ? currentSnap.data()?.rotationIndex ?? -1
    : -1;

  const nextIndex = advance
    ? (prevIndex + 1) % FEATURED_POOL.length
    : Math.max(0, prevIndex) % FEATURED_POOL.length;
  const tripId = FEATURED_POOL[nextIndex];

  const itinSnap = await db.doc(`prebuiltItineraries/${tripId}`).get();
  if (!itinSnap.exists) {
    throw new Error(`Featured rotation: itinerary "${tripId}" not found`);
  }
  const itin = itinSnap.data() as any;

  // Itineraries store heroImage as '' — fall back to the destination's image.
  let heroImage: string = itin.heroImage || "";
  if (!heroImage && itin.destinationId) {
    const destSnap = await db.doc(`destinations/${itin.destinationId}`).get();
    heroImage = destSnap.exists ? destSnap.data()?.imageUrl ?? "" : "";
  }

  const now = Timestamp.now();
  const to = Timestamp.fromMillis(now.toMillis() + WEEK_MS);

  const payload: Record<string, unknown> = {
    tripId,
    title: itin.title ?? "",
    subtitle: itin.subtitle ?? "",
    description: itin.subtitle ?? "",
    heroImage,
    destination: itin.destinationId ?? "",
    durationDays: countDurationDays(itin),
    rating: itin.rating ?? null,
    reviewCount: itin.reviewCount ?? null,
    badge: FEATURED_BADGE,
    featured: true,
    rotationIndex: nextIndex,
    from: now,
    to,
    updatedAt: now,
  };
  if (!currentSnap.exists) payload.createdAt = now;

  await currentRef.set(payload, { merge: true });

  return { tripId, rotationIndex: nextIndex, heroImage };
}
