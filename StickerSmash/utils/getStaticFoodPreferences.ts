import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';

const CACHE_KEY = 'static:foods';
const TTL_DAYS = 30;

export async function getStaticFoodPreferences(): Promise<{ label: string; emoji: string }[]> {
  const cached = await cacheGet<{ label: string; emoji: string }[]>(CACHE_KEY);
  if (cached) return cached;

  const doc = await firestore().collection('staticFoodPreferences').doc('all').get();
  const data = doc.data();
  if (data && Array.isArray(data.foods)) {
    await cacheSet(CACHE_KEY, data.foods, TTL_DAYS);
    return data.foods;
  }
  return [];
}
