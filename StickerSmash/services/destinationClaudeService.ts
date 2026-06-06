import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { getAppCheckHeader } from '@/services/appCheck';
import { cacheGet, cacheSet } from '@/utils/cache';

export interface DestinationClaudeContent {
  description: string;
  gettingThere: string;
  bestTime: string;
  attractions: string;
  cuisine: string;
  activities: string;
  accommodations: string;
  transportation: string;
  safety: string;
  language: string;
  currency: string;
  visa: string;
}

export async function fetchDestinationClaudeContent(
  cityName: string,
  country: string,
): Promise<DestinationClaudeContent | null> {
  const cacheKey = `dest-claude:${cityName.toLowerCase()}:${country.toLowerCase()}`;
  const cached = await cacheGet<DestinationClaudeContent>(cacheKey);
  if (cached) return cached;

  try {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return null;

    const idToken = await getIdToken(currentUser, false);
    const appCheckHeader = await getAppCheckHeader();
    const res = await fetch(
      'https://us-central1-wanderly-dff52.cloudfunctions.net/getDestinationContentHttp',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          ...appCheckHeader,
        },
        body: JSON.stringify({ cityName, country }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json() as DestinationClaudeContent;
    await cacheSet(cacheKey, data, 30);
    return data;
  } catch {
    return null;
  }
}
