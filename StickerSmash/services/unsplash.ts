import { cacheGet, cacheSet } from '@/utils/cache';

const ACCESS_KEY = 'Eg54Wj6D1xnhu-IxxOv9o0w6Gx4D0rLz7rt0X1aAeFw';
const BASE = 'https://api.unsplash.com/search/photos';
const PHOTO_TTL_DAYS = 30;

export async function searchPhoto(query: string): Promise<string | null> {
  const key = `photo:${query}`;
  const cached = await cacheGet<string>(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${BASE}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${ACCESS_KEY}`
    );
    const data = await res.json();
    const url: string | undefined = data.results?.[0]?.urls?.regular;
    if (url) await cacheSet(key, url, PHOTO_TTL_DAYS);
    return url ?? null;
  } catch {
    return null;
  }
}

export async function searchPhotos(query: string, count = 4): Promise<string[]> {
  const key = `photos:${query}:${count}`;
  const cached = await cacheGet<string[]>(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${BASE}?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape&client_id=${ACCESS_KEY}`
    );
    const data = await res.json();
    const urls: string[] = (data.results ?? []).map((r: any) => r.urls.regular);
    if (urls.length) await cacheSet(key, urls, PHOTO_TTL_DAYS);
    return urls;
  } catch {
    return [];
  }
}
