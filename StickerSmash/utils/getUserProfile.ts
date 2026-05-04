import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';

const TTL_DAYS = 1;
const pending = new Map<string, Promise<any>>();

export const profileCacheKey = (uid: string) => `profile:${uid}`;

export async function getUserProfile(uid: string) {
  const key = profileCacheKey(uid);
  const cached = await cacheGet(key);
  if (cached) return cached;

  if (pending.has(uid)) return pending.get(uid)!;

  const req = (async () => {
    const doc = await firestore().collection('users').doc(uid).get();
    if (!doc.exists) throw new Error('User profile not found');
    const profile = doc.data();
    await cacheSet(key, profile, TTL_DAYS);
    return profile;
  })();

  pending.set(uid, req);
  req.finally(() => pending.delete(uid));
  return req;
}
