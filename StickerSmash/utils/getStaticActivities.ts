import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';

const CACHE_KEY = 'static:activities';
const TTL_DAYS = 30;

export async function getStaticActivities(): Promise<{ label: string; emoji: string }[]> {
  const cached = await cacheGet<{ label: string; emoji: string }[]>(CACHE_KEY);
  if (cached) return cached;

  const doc = await firestore().collection('staticActivities').doc('all').get();
  const data = doc.data();
  if (data && Array.isArray(data.activities)) {
    await cacheSet(CACHE_KEY, data.activities, TTL_DAYS);
    return data.activities;
  }
  return [];
}
