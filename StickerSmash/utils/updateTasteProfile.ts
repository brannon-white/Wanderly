import { getAuth } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet, cacheDelete } from '@/utils/cache';
import { profileCacheKey } from '@/utils/getUserProfile';
import type { TasteProfile } from '@/types/itinerary';

export async function updateTasteProfile(tasteProfile: TasteProfile) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;

  await firestore().collection('users').doc(uid).update({ tasteProfile });

  const key = profileCacheKey(uid);
  const profile = await cacheGet<any>(key);
  if (profile) {
    await cacheSet(key, { ...profile, tasteProfile }, 1);
  }

  await cacheDelete(`itineraries:v3:${uid}`);
}
