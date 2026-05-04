import firestore from '@react-native-firebase/firestore';
import { cacheGet } from '@/utils/cache';
import { profileCacheKey } from '@/utils/getUserProfile';

export async function isOnboardingComplete(uid: string): Promise<boolean> {
  const cached = await cacheGet(profileCacheKey(uid));
  if (cached) return true;

  const doc = await firestore().collection('users').doc(uid).get();
  return doc.exists();
}
