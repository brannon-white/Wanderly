import * as logger from "firebase-functions/logger";

// Stock-photo sources for imagery we can't get a real photo for (city heroes, and
// venues without a Google Places photo such as trailheads). Pexels is primary —
// Unsplash-grade quality, far higher free limits, permissive license — with the
// existing public Unsplash demo key as a last-resort fallback.

const PEXELS_SEARCH = "https://api.pexels.com/v1/search";
const UNSPLASH_SEARCH = "https://api.unsplash.com/search/photos";
// Already public in the client bundle; only used as a fallback when Pexels misses.
const UNSPLASH_ACCESS_KEY = "REDACTED_ROTATED_KEY";

// A beautiful, landscape stock photo for `query`, or null. Pexels src URLs are
// permanent CDN links, safe to store directly.
export async function pexelsImage(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) {
      logger.warn("Pexels non-OK", { status: res.status, query });
      return null;
    }
    const data = await res.json() as { photos?: Array<{ src?: { landscape?: string; large2x?: string; large?: string } }> };
    const src = data.photos?.[0]?.src;
    return src?.landscape ?? src?.large2x ?? src?.large ?? null;
  } catch (error) {
    logger.warn("Pexels fetch failed", { error, query });
    return null;
  }
}

export async function unsplashImage(query: string): Promise<string | null> {
  try {
    const url = `${UNSPLASH_SEARCH}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ urls: { regular: string } }> };
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

// Pexels → Unsplash, first hit wins.
export async function stockImage(query: string): Promise<string | null> {
  return (await pexelsImage(query)) ?? (await unsplashImage(query));
}
