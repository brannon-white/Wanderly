import { getAuth } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet, cacheDelete } from '@/utils/cache';
import { profileCacheKey } from '@/utils/getUserProfile';
import { isOnboardingComplete } from '@/utils/isOnboardingComplete';

export async function updateTravelPreferences(selected: string[]) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;

  if (await isOnboardingComplete(uid)) {
    await firestore().collection('users').doc(uid).update({
      activityPreferences: selected,
    });

    const key = profileCacheKey(uid);
    const profile = await cacheGet<any>(key);
    if (profile) {
      await cacheSet(key, { ...profile, activityPreferences: selected }, 1);
    }

    // Invalidate itinerary cache so recommendations refresh with new interests
    await cacheDelete(`itineraries:v3:${uid}`);
  }
}
