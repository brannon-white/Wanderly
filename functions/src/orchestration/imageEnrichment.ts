import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary, getAllDays, mapAllDays } from "../itinerarySchemas";
import { getDestinationHero } from "./heroImages";
import { stockImage } from "./imageSources";

// An image is "real" only if it's an http(s) URL. After place resolution, an activity
// already carries a Google Places photo URL (the real venue) when one exists; anything
// else (empty, or a model placeholder) still needs a stock fallback.
function needsImage(image: string | undefined): boolean {
  return !image || !/^https?:\/\//.test(image);
}

export async function enrichWithImages(itinerary: GeneratedItinerary): Promise<GeneratedItinerary> {
  const allDays = getAllDays(itinerary);
  const allActivities = allDays.flatMap((d) => d.activities);

  // Hero: cached, beautiful city photo (Pexels → Unsplash). Fetched once per destination.
  const heroPromise = getDestinationHero(itinerary.destinationName, itinerary.country);

  // Venues already resolved to a Google Places photo keep it. Only fill the gaps
  // (trailheads, venues without a Places photo) with a stock image of that venue.
  const gaps = allActivities.filter((a) => needsImage(a.image));
  logger.info("Image enrichment: filling gaps", {
    total: allActivities.length, gaps: gaps.length, destination: itinerary.destinationName,
  });

  const imageMap = new Map<string, string>();
  await Promise.all(
    gaps.map(async (a) => {
      const query = a.name?.split(/\s+[–-]\s+/)[0].trim() || a.name;
      const url = query ? await stockImage(`${query} ${itinerary.destinationName}`) : null;
      if (url) imageMap.set(a.id, url);
    })
  );

  const heroUrl = await heroPromise;

  const withImages = mapAllDays(itinerary, (day) => ({
    ...day,
    activities: day.activities.map((a) => ({
      ...a,
      image: imageMap.get(a.id) ?? a.image,
    })),
  }));

  logger.info("Image enrichment: complete", {
    venuePhotos: allActivities.length - gaps.length,
    gapsFilled: imageMap.size,
    hero: heroUrl ? "ok" : "none",
  });

  return {
    ...withImages,
    heroImage: heroUrl ?? itinerary.heroImage,
  };
}
