import { getAuth } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet, cacheDelete } from '@/utils/cache';
import { profileCacheKey } from '@/utils/getUserProfile';
import { isOnboardingComplete } from '@/utils/isOnboardingComplete';

export async function updateFoodPreferences(selected: string[]) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;

  if (await isOnboardingComplete(uid)) {
    await firestore().collection('users').doc(uid).update({
      foodPreferences: selected,
    });

    const key = profileCacheKey(uid);
    const profile = await cacheGet<any>(key);
    if (profile) {
      await cacheSet(key, { ...profile, foodPreferences: selected }, 1);
    }

    await cacheDelete(`itineraries:v3:${uid}`);
  }
}
