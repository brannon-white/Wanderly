import * as logger from "firebase-functions/logger";
import { type GeneratedItinerary, getAllDays, mapAllDays } from "../itinerarySchemas";

const UNSPLASH_BASE = "https://api.unsplash.com/search/photos";
// Same key used client-side — already public in the app bundle
const UNSPLASH_ACCESS_KEY = "REDACTED_ROTATED_KEY";

async function fetchUnsplashImage(query: string): Promise<string | null> {
  try {
    const url = `${UNSPLASH_BASE}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ urls: { regular: string } }> };
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

export async function enrichWithImages(itinerary: GeneratedItinerary): Promise<GeneratedItinerary> {
  const allDays = getAllDays(itinerary);
  const allActivities = allDays.flatMap((d) => d.activities);

  // Fetch hero + all activity images in parallel
  const heroQuery = `${itinerary.destinationName} ${itinerary.country ?? ""} landscape travel`;
  const queries = [heroQuery, ...allActivities.map((a) => a.name)];

  logger.info("Image enrichment: fetching images", { count: queries.length, destination: itinerary.destinationName });

  const urls = await Promise.all(queries.map((q) => fetchUnsplashImage(q)));
  const [heroUrl, ...activityUrls] = urls;

  const imageMap = new Map<string, string>();
  allActivities.forEach((a, i) => {
    const url = activityUrls[i];
    if (url) imageMap.set(a.id, url);
  });

  const successCount = [...imageMap.values()].length + (heroUrl ? 1 : 0);
  logger.info("Image enrichment: complete", { total: queries.length, succeeded: successCount });

  const withImages = mapAllDays(itinerary, (day) => ({
    ...day,
    activities: day.activities.map((a) => ({
      ...a,
      image: imageMap.get(a.id) ?? a.image,
    })),
  }));

  return {
    ...withImages,
    heroImage: heroUrl ?? itinerary.heroImage,
  };
}
