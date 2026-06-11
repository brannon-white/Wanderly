import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { pexelsImage, unsplashImage } from "./imageSources";

// Beautiful city/destination hero images, cached per destination so we fetch each city
// ONCE and serve the stored URL forever. This is what removes the rate-limit problem:
// popular destinations are fetched a single time, not per trip / per user / per view.
// Cache lives in destinationHeroes/{slug}; Pexels CDN URLs are permanent, safe to store.

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Returns a hero image URL for a destination, using the cache when present and
// fetching + caching otherwise. Pexels first, Unsplash as fallback.
export async function getDestinationHero(
  destinationName: string,
  country?: string,
): Promise<string | null> {
  const slug = slugify(country ? `${destinationName}-${country}` : destinationName);
  if (!slug) return null;

  const ref = getFirestore().collection("destinationHeroes").doc(slug);

  try {
    const snap = await ref.get();
    const cached = snap.exists ? (snap.data()?.url as string | undefined) : undefined;
    if (cached) return cached;
  } catch (error) {
    logger.warn("destinationHeroes cache read failed", { slug, error });
  }

  // Cache miss → fetch once. Bias the query toward scenic cityscapes.
  const base = country ? `${destinationName} ${country}` : destinationName;
  let url = await pexelsImage(`${base} cityscape skyline`);
  let source = "pexels";
  if (!url) url = await pexelsImage(`${base} travel landscape`);
  if (!url) { url = await unsplashImage(`${base} landscape travel`); source = "unsplash"; }
  if (!url) return null;

  try {
    await ref.set({ url, source, destinationName, country: country ?? null, fetchedAt: FieldValue.serverTimestamp() });
  } catch (error) {
    logger.warn("destinationHeroes cache write failed", { slug, error });
  }
  return url;
}
