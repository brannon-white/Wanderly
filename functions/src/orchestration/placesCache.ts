import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { type PlaceCandidate } from "./types";

const COLLECTION = "placesCache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function buildCacheKey(
  destination: string,
  budget: string,
  interests: string[]
): string {
  const dest = destination.toLowerCase().replace(/[^a-z0-9]+/g, "_").substring(0, 60);
  const interestSlug = [...interests]
    .sort()
    .slice(0, 5)
    .join("_")
    .replace(/[^a-z0-9_]+/g, "")
    .substring(0, 80);
  return `${dest}__${budget}__${interestSlug}`;
}

export async function getCachedPlaces(
  cacheKey: string
): Promise<PlaceCandidate[] | null> {
  try {
    const doc = await getFirestore().collection(COLLECTION).doc(cacheKey).get();
    if (!doc.exists) return null;

    const data = doc.data() as { results: PlaceCandidate[]; expiresAt: number };
    if (Date.now() > data.expiresAt) {
      logger.info("Places cache expired", { cacheKey });
      return null;
    }

    logger.info("Places cache hit", { cacheKey, count: data.results.length });
    return data.results;
  } catch (error) {
    logger.warn("Places cache read failed (non-fatal)", { cacheKey, error });
    return null;
  }
}

export async function setCachedPlaces(
  cacheKey: string,
  results: PlaceCandidate[]
): Promise<void> {
  try {
    await getFirestore()
      .collection(COLLECTION)
      .doc(cacheKey)
      .set({ results, expiresAt: Date.now() + TTL_MS });
    logger.info("Places cache written", { cacheKey, count: results.length });
  } catch (error) {
    logger.warn("Places cache write failed (non-fatal)", { cacheKey, error });
  }
}
